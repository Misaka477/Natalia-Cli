import type { UiPluginContext } from "@natalia/ui-host";
import { selectPrimaryActivity } from "@natalia/view-store";
import type {
  RuntimeEvent,
  RuntimeModelCatalogEntry,
  RuntimeModelSelection,
  RuntimeSessionSummary,
  ChatModelProfile,
  ConfigV3,
  RuntimeClient,
  WorkspaceSummary,
} from "@natalia/contracts";
import { type AppState, cloneState } from "@natalia/view-store";
import { cloneStateInWorker } from "./clone-state-worker-client";
import {
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  onMount,
  batch,
  For,
  Show,
} from "solid-js";
import { Transcript } from "@natalia/ui-kit";
import { Composer, type ComposerAttachment } from "./components/Composer";
import { ReviewPane } from "./components/RightPanel";
import { SettingsPanel } from "./settings-panel";
import {
  createUiPanelRequirementContext,
  uiPanelRequirementsSatisfied,
  type UiPanelRequirementContext,
} from "./ui-requirements";
import { PluginManagerPanel } from "./plugin-manager-panel";
import { applyNeuTheme, NATALIA_SKINS, NEU_THEME_MODES } from "./styles";
import { SessionActionsPanel } from "./session-actions-panel";
import { AgentPanel } from "./agent-panel";
import { PlanPanel } from "./plan-panel";
import { NiaPanel } from "./nia-panel";
import { WorkspacePanel } from "./workspace-panel";
import { WorkspaceSettingsPanel } from "./workspace-settings-panel";
import { NeuSelect } from "./components/NeuSelect";
import { PermissionPanel } from "./permission-panel";
import { QuestionPanel } from "./components/QuestionPanel";
import { StatusPanel } from "./status-panel";
import { SearchPanel } from "./search-panel";
import { HelpPanel } from "./help-panel";
import { StashPanel } from "./stash-panel";
import { SandboxPanel } from "./sandbox-panel";
import { GovernancePanel } from "./governance-panel";
import { ModelPanel } from "./model-panel";
import type { Message } from "./types";

const perfLog = (...args: unknown[]) => {
  if (
    (globalThis as { __NATALIA_PERF_VERBOSE?: number })
      .__NATALIA_PERF_VERBOSE === 1
  ) {
    console.warn(...args);
  }
};

type RightTab =
  | "diff"
  | "plan"
  | "nia"
  | "terminal"
  | "files"
  | "agent"
  | "todo";

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 360;
const MIN_RIGHT_WIDTH = 440;
const MAX_RIGHT_WIDTH = 560;

function sessionTurnID(messageID: string) {
  if (!messageID.startsWith("turn_")) return undefined;
  return messageID.replace(/:(?:user|assistant|thinking|system)$/u, "");
}

function rightPanelMaxWidth(): number {
  if (typeof window === "undefined") return MAX_RIGHT_WIDTH;
  // On small/compact layouts the right panel is the most space-hungry
  // surface (terminal/diff), so allow it to take up to 2/3 width.
  return Math.max(MIN_RIGHT_WIDTH, Math.floor((window.innerWidth * 2) / 3));
}

function StatusDot(props: { status: string }) {
  return (
    <span
      class="neu-status-dot"
      data-status={props.status}
      title={props.status}
    />
  );
}

function TreeRow(props: {
  label: string;
  selected?: boolean;
  status?: string;
  badge?: string;
  depth?: number;
  onClick?: () => void;
  onEdit?: () => void;
  onAction?: () => void;
  actionTitle?: string;
  actionIcon?: string;
  bulkMode?: boolean;
  bulkSelected?: boolean;
  onBulkToggle?: () => void;
  editValue?: string;
  onEditChange?: (value: string) => void;
  onEditCommit?: () => void;
  onEditCancel?: () => void;
}) {
  return (
    <button
      type="button"
      class="neu-tree-row"
      data-selected={props.selected}
      style={{ "padding-left": `${18 + (props.depth ?? 1) * 14}px` }}
      onClick={() => {
        if (props.bulkMode) props.onBulkToggle?.();
        else props.onClick?.();
      }}
    >
      <Show when={props.bulkMode}>
        <span class="neu-bulk-check" data-checked={props.bulkSelected} />
      </Show>
      {props.status ? <StatusDot status={props.status} /> : null}
      <Show
        when={props.editValue !== undefined}
        fallback={
          <>
            <span class="neu-tree-label">{props.label}</span>
            {props.status === "running" ? (
              <span class="neu-badge neu-badge-running">并行中</span>
            ) : null}
            {props.badge ? <span class="neu-badge">{props.badge}</span> : null}
            <Show when={!props.bulkMode && props.onAction}>
              <button
                type="button"
                class="neu-tree-edit"
                title={props.actionTitle}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onAction?.();
                }}
              >
                {props.actionIcon}
              </button>
            </Show>
            <Show when={!props.bulkMode && props.onEdit}>
              <button
                type="button"
                class="neu-tree-edit"
                title="重命名"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onEdit?.();
                }}
              >
                ✎
              </button>
            </Show>
          </>
        }
      >
        <input
          class="neu-tree-edit-input"
          value={props.editValue}
          onInput={(event) => props.onEditChange?.(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.stopPropagation();
              props.onEditCommit?.();
            } else if (event.key === "Escape") {
              event.stopPropagation();
              props.onEditCancel?.();
            }
          }}
          onBlur={() => props.onEditCommit?.()}
          onClick={(event) => event.stopPropagation()}
        />
      </Show>
    </button>
  );
}

function SessionTree(props: {
  selected: string;
  sessions: RuntimeSessionSummary[];
  workspaces: WorkspaceSummary[];
  onSelect: (id: string, name: string) => void;
  onRename?: (id: string, title: string) => unknown;
  onRemoveWorkspace?: (workspaceID: string) => void;
  onRestore?: (sessionID: string) => void;
  onArchive?: (sessionID: string) => void;
  bulkMode?: boolean;
  bulkSelected?: (id: string) => boolean;
  onBulkToggle?: (id: string) => void;
}) {
  const [editingID, setEditingID] = createSignal<string | null>(null);
  const [draftName, setDraftName] = createSignal("");
  const groups = createMemo(() => {
    const byWorkspace = new Map<string, RuntimeSessionSummary[]>();
    const activeID = props.workspaces.find(
      (workspace) => workspace.status === "active",
    )?.workspaceID;
    for (const session of props.sessions) {
      const key = session.workspaceID ?? activeID;
      if (!key) continue;
      const list = byWorkspace.get(key) ?? [];
      list.push(session);
      byWorkspace.set(key, list);
    }
    return props.workspaces.map((workspace) => ({
      workspaceID: workspace.workspaceID,
      workspace: workspace.title,
      sessions: (byWorkspace.get(workspace.workspaceID) ?? []).map(
        (session) => ({
          id: session.id,
          name: session.title,
          status:
            session.status ??
            (session.cancelled
              ? "error"
              : session.resumable
                ? "idle"
                : "running"),
          archived: Boolean(session.archived),
        }),
      ),
    }));
  });

  const runningSessions = createMemo(() =>
    props.sessions
      .map((session) => ({
        id: session.id,
        name: session.title,
        status:
          session.status ??
          (session.cancelled
            ? "error"
            : session.resumable
              ? "idle"
              : "running"),
        archived: Boolean(session.archived),
      }))
      .filter((session) => session.status === "running"),
  );

  return (
    <div class="neu-tree">
      <Show when={runningSessions().length > 0}>
        <div class="neu-workspace-row">
          <span class="neu-workspace-name">并行会话</span>
          <span class="neu-count">{runningSessions().length}</span>
        </div>
        <For each={runningSessions()}>
          {(session) => (
            <TreeRow
              label={session.name}
              selected={props.selected === session.id}
              status={session.status}
              depth={0}
              onClick={() => props.onSelect(session.id, session.name)}
            />
          )}
        </For>
      </Show>
      <For each={groups()}>
        {(group) => (
          <>
            <div class="neu-workspace-row">
              <span class="neu-workspace-name">{group.workspace}</span>
              <span class="neu-count">{group.sessions.length}</span>
              <Show when={props.onRemoveWorkspace}>
                <button
                  type="button"
                  class="neu-workspace-remove"
                  title="移除工作区"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onRemoveWorkspace?.(group.workspaceID);
                  }}
                >
                  ×
                </button>
              </Show>
            </div>
            <For each={group.sessions}>
              {(session) => (
                <TreeRow
                  label={session.name}
                  selected={props.selected === session.id}
                  status={session.status}
                  badge={session.archived ? "点击恢复" : undefined}
                  depth={1}
                  onClick={() => {
                    if (session.archived && props.onRestore) {
                      props.onRestore(session.id);
                    } else {
                      props.onSelect(session.id, session.name);
                    }
                  }}
                  onAction={
                    session.archived
                      ? props.onRestore
                        ? () => props.onRestore?.(session.id)
                        : undefined
                      : props.onArchive
                        ? () => props.onArchive?.(session.id)
                        : undefined
                  }
                  actionTitle={session.archived ? "恢复会话" : "归档会话"}
                  actionIcon={session.archived ? "↩" : "↓"}
                  bulkMode={props.bulkMode}
                  bulkSelected={props.bulkSelected?.(session.id)}
                  onBulkToggle={
                    props.onBulkToggle
                      ? () => props.onBulkToggle?.(session.id)
                      : undefined
                  }
                  onEdit={() => {
                    setEditingID(session.id);
                    setDraftName(session.name);
                  }}
                  editValue={
                    editingID() === session.id ? draftName() : undefined
                  }
                  onEditChange={setDraftName}
                  onEditCommit={() => {
                    const title = draftName().trim();
                    if (
                      editingID() === session.id &&
                      title &&
                      title !== session.name
                    ) {
                      void props.onRename?.(session.id, title);
                    }
                    setEditingID(null);
                  }}
                  onEditCancel={() => setEditingID(null)}
                />
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}

export function AppNeu(props: { ctx: UiPluginContext }) {
  const appNeuStart = performance.now();
  perfLog(
    `[perf] AppNeu component start +${(appNeuStart - ((globalThis as unknown as { __nataliaStartupStart?: number }).__nataliaStartupStart ?? appNeuStart)).toFixed(1)}ms`,
  );
  const [state, setState] = createSignal(
    cloneState(props.ctx.projection.getState()),
  );
  const [rightTab, setRightTab] = createSignal<RightTab>("plan");
  const [leftWidth, setLeftWidth] = createSignal(240);
  const [rightWidth, setRightWidth] = createSignal(
    typeof window === "undefined"
      ? 440
      : Math.max(MIN_RIGHT_WIDTH, Math.floor(window.innerWidth / 3)),
  );
  const [leftVisible, setLeftVisible] = createSignal(true);
  const [rightVisible, setRightVisible] = createSignal(true);
  const [layoutMode, setLayoutMode] = createSignal<"wide" | "compact" | "tiny">(
    "wide",
  );
  const [naviOpen, setNaviOpen] = createSignal(true);
  const [mainDraft, setMainDraft] = createSignal("");
  const [chatDraft, setChatDraft] = createSignal("");
  const [mainAttachments, setMainAttachments] = createSignal<
    ComposerAttachment[]
  >([]);
  const [chatAttachments, setChatAttachments] = createSignal<
    ComposerAttachment[]
  >([]);
  const [selectedSession, setSelectedSession] = createSignal("");
  const [selectedSessionID, setSelectedSessionID] = createSignal("");
  const [sessionList, setSessionList] = createSignal<RuntimeSessionSummary[]>(
    [],
  );
  const [workspaces, setWorkspaces] = createSignal<WorkspaceSummary[]>([]);
  const [registeredTools, setRegisteredTools] = createSignal<string[]>([]);
  const [panelRequirementContext, setPanelRequirementContext] = createSignal<
    UiPanelRequirementContext | undefined
  >(undefined);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [pluginManagerOpen, setPluginManagerOpen] = createSignal(false);
  const [themeMode, setThemeMode] = createSignal(
    props.ctx.preferences.get<string>("themeMode") ?? "light",
  );
  const layoutProfile = () => NATALIA_SKINS[themeMode()]?.layout;

  createEffect(() => {
    const layout = layoutProfile();
    const left = layout?.regions?.left;
    const right = layout?.regions?.right;
    if (left?.width) setLeftWidth(left.width);
    if (right?.width) setRightWidth(right.width);
    if (left?.visible !== undefined) setLeftVisible(left.visible);
    if (right?.visible !== undefined) setRightVisible(right.visible);
    if (right?.order?.[0]) {
      const first = right.order[0] as RightTab;
      if (rightTabs().some((tab) => tab.id === first)) setRightTab(first);
    }
  });
  const [sessionMenuOpen, setSessionMenuOpen] = createSignal(false);
  const [showArchived, setShowArchived] = createSignal(false);
  const [sessionSearchOpen, setSessionSearchOpen] = createSignal(false);
  const [sessionQuery, setSessionQuery] = createSignal("");
  const [sidebarMenuOpen, setSidebarMenuOpen] = createSignal(false);
  const [bulkSelectMode, setBulkSelectMode] = createSignal(false);
  const [bulkSelected, setBulkSelected] = createSignal<Set<string>>(new Set());
  const [workspaceOpen, setWorkspaceOpen] = createSignal(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = createSignal(false);
  const [workspaceError, setWorkspaceError] = createSignal<string>("");
  const [reviewRequestedTab, setReviewRequestedTab] = createSignal<
    "git" | "sandbox" | "checkpoint"
  >("git");
  const [reviewRequestedCheckpointID, setReviewRequestedCheckpointID] =
    createSignal<string | undefined>();
  const [pendingRollback, setPendingRollback] = createSignal<
    | {
        turnID: string;
        checkpointID?: string;
        label: string;
        hiddenAfter?: number;
      }
    | undefined
  >();
  const [rollbackNotice, setRollbackNotice] = createSignal<
    | {
        text: string;
        safetyCheckpointID?: string;
        restoredCount: number;
      }
    | undefined
  >();
  const [panelRevision, setPanelRevision] = createSignal(0);
  const [interactiveTerminalAvailable, setInteractiveTerminalAvailable] =
    createSignal(false);
  let historyReplayDone = false;
  let userSelectedSession = false;
  let sessionsRefreshToken = 0;
  let sessionsRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  let workspacesRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  let sessionsRefreshInFlight: Promise<void> | undefined;
  let workspacesRefreshInFlight: Promise<void> | undefined;
  let historyCursor: string | undefined;
  let newerHistoryCursor: string | undefined;
  let loadingOlderHistory = false;
  let loadingNewerHistory = false;
  let transcriptObservedTop = 0;
  let chatObservedTop = 0;
  type ScrollAnchor = { id: string; top: number };
  let transcriptPagingAnchor: ScrollAnchor | undefined;
  let chatPagingAnchor: ScrollAnchor | undefined;
  let mainForceScroll = false;
  let chatForceScroll = false;
  const [permissionOpen, setPermissionOpen] = createSignal(false);
  const [currentApproval, setCurrentApproval] = createSignal<Extract<
    RuntimeEvent,
    { type: "approval.request" }
  > | null>(null);
  const [currentQuestion, setCurrentQuestion] = createSignal<Extract<
    RuntimeEvent,
    { type: "question.request" }
  > | null>(null);
  const [questionOpen, setQuestionOpen] = createSignal(false);
  const [statusOpen, setStatusOpen] = createSignal(false);
  const [turnElapsedMs, setTurnElapsedMs] = createSignal(0);
  const transcriptRef = createSignal<HTMLDivElement | undefined>(undefined);
  const [transcriptEl, setTranscriptEl] = transcriptRef;
  const [followBottom, setFollowBottom] = createSignal(true);
  const [showJumpToBottom, setShowJumpToBottom] = createSignal(false);
  const chatTranscriptRef = createSignal<HTMLDivElement | undefined>(undefined);
  const [chatTranscriptEl, setChatTranscriptEl] = chatTranscriptRef;
  const [chatFollowBottom, setChatFollowBottom] = createSignal(true);
  const [chatShowJumpToBottom, setChatShowJumpToBottom] = createSignal(false);
  const [chatElapsedMs, setChatElapsedMs] = createSignal(0);
  const activeTurnStartedAt = createSignal<number | undefined>(undefined);
  const [activeTurnStartedAtValue, setActiveTurnStartedAt] =
    activeTurnStartedAt;
  const [modelOpen, setModelOpen] = createSignal(false);
  const [modelCatalog, setModelCatalog] = createSignal<
    RuntimeModelCatalogEntry[]
  >([]);
  const [modelSelectionSignal, setModelSelectionSignal] = createSignal<
    { modelID?: string; variant?: string } | undefined
  >(undefined);
  const [config, setConfig] = createSignal<ConfigV3 | undefined>(undefined);
  const [reasoningEffort, setReasoningEffortSignal] =
    createSignal<string>("medium");
  const [chatProfile, setChatProfile] = createSignal<ChatModelProfile>({});
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [stashOpen, setStashOpen] = createSignal(false);
  const [sandboxOpen, setSandboxOpen] = createSignal(false);
  const [governanceOpen, setGovernanceOpen] = createSignal(false);
  const [topbarPanel, setTopbarPanel] = createSignal<{
    pluginId: string;
    panelId: string;
  } | null>(null);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [viewOpen, setViewOpen] = createSignal(false);
  let topbarPanelRef: HTMLDivElement | undefined;

  async function refreshModelConfig() {
    if (!props.ctx.runtime.configGet) {
      throw new Error("configGet runtime method unavailable");
    }
    if (!props.ctx.runtime.modelCatalog) {
      throw new Error("modelCatalog runtime method unavailable");
    }
    const [nextConfig, nextCatalog] = await Promise.all([
      props.ctx.runtime.configGet(),
      props.ctx.runtime.modelCatalog(),
    ]);
    setConfig(nextConfig);
    setModelCatalog(nextCatalog);
  }

  let projectionFramePending = false;
  let suppressProjectionClones = false;
  onCleanup(
    props.ctx.projection.subscribe((next) => {
      const replaying = (
        globalThis as unknown as {
          __nataliaReplayingHistory?: boolean;
        }
      ).__nataliaReplayingHistory;
      // During a full history replay the projection emits one event at a time.
      // Cloning the whole AppState after every raw event is O(n^2) for long
      // sessions, so skip the heavy clones until the replay completes and then
      // take one final snapshot in openUnresolvedInteractives.
      if (replaying || suppressProjectionClones) return;
      // Live events stream as many small deltas per second. Clone the
      // projection at most once per animation frame and let Solid paint one
      // batched frame instead of one clone/update per raw event.
      if (projectionFramePending) return;
      projectionFramePending = true;
      requestAnimationFrame(() => {
        projectionFramePending = false;
        void (async () => {
          let projected: AppState;
          try {
            projected = await cloneStateInWorker(
              props.ctx.projection.getState(),
            );
          } catch {
            projected = cloneState(props.ctx.projection.getState());
          }
          const setStart = performance.now();
          setState(projected);
          const setMs = performance.now() - setStart;
          perfLog(
            `[perf] renderer projection frame messages=${projected.messages.length} navi=${projected.navi.messages.length} nia=${projected.nia.messages.length} set=${setMs.toFixed(1)}ms`,
          );
          if (projected.workspaces.length) setWorkspaces(projected.workspaces);
          if (mainForceScroll) {
            mainForceScroll = false;
            requestAnimationFrame(() => {
              if (transcriptEl()) {
                const el = transcriptEl()!;
                el.scrollTop = el.scrollHeight;
                transcriptObservedTop = el.scrollTop;
              }
            });
          }
          if (chatForceScroll) {
            chatForceScroll = false;
            requestAnimationFrame(() => {
              if (chatTranscriptEl()) {
                const el = chatTranscriptEl()!;
                el.scrollTop = el.scrollHeight;
                chatObservedTop = el.scrollTop;
              }
            });
          }
          const currentTurn = projected.activeTurn;
          if (currentTurn && activeTurnStartedAtValue() === undefined) {
            setActiveTurnStartedAt(Date.now());
          } else if (!currentTurn && activeTurnStartedAtValue() !== undefined) {
            setActiveTurnStartedAt(undefined);
            setTurnElapsedMs(0);
          }
        })();
      });
    }),
  );

  const followObserver =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => {
          if (followBottom() && transcriptEl()) {
            const el = transcriptEl()!;
            el.scrollTop = el.scrollHeight;
            transcriptObservedTop = el.scrollTop;
          }
          if (chatFollowBottom() && chatTranscriptEl()) {
            const el = chatTranscriptEl()!;
            el.scrollTop = el.scrollHeight;
            chatObservedTop = el.scrollTop;
          }
        });
  onCleanup(() => followObserver?.disconnect());

  // Transcripts mount after the session id resolves and again when layout
  // mode hides/shows a pane. Observe and re-apply pinned-to-bottom whenever an
  // element (re)appears.
  createEffect(() => {
    const el = transcriptEl();
    const content = el?.querySelector<HTMLElement>(
      ".natalia-transcript-content",
    );
    if (el) followObserver?.observe(el);
    if (content) followObserver?.observe(content);
    if (el) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (followBottom() && transcriptEl()) {
            const target = transcriptEl()!;
            target.scrollTop = target.scrollHeight;
            transcriptObservedTop = target.scrollTop;
          }
        });
      });
    }
    const chatEl = chatTranscriptEl();
    const chatContent = chatEl?.querySelector<HTMLElement>(
      ".natalia-transcript-content",
    );
    if (chatEl) followObserver?.observe(chatEl);
    if (chatContent) followObserver?.observe(chatContent);
    if (chatEl) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (chatFollowBottom() && chatTranscriptEl()) {
            const target = chatTranscriptEl()!;
            target.scrollTop = target.scrollHeight;
            chatObservedTop = target.scrollTop;
          }
        });
      });
    }
  });

  async function refreshWorkspaces() {
    if (workspacesRefreshInFlight) return workspacesRefreshInFlight;
    const phaseStart = performance.now();
    workspacesRefreshInFlight = (async () => {
      const roots = await props.ctx.runtime.workspaceRoots?.();
      perfLog(
        `[perf] refreshWorkspaces done roots=${roots?.length ?? 0} +${(performance.now() - phaseStart).toFixed(1)}ms`,
      );
      if (roots) {
        const current = workspaces();
        if (!current || JSON.stringify(current) !== JSON.stringify(roots)) {
          setWorkspaces(roots);
        }
      }
    })().finally(() => {
      workspacesRefreshInFlight = undefined;
    });
    return workspacesRefreshInFlight;
  }

  function markStartup(phase: string) {
    const global = globalThis as unknown as {
      __nataliaStartupStart?: number;
      __nataliaStartupTimings?: Record<string, number>;
    };
    global.__nataliaStartupStart ??= performance.now();
    const timings = (global.__nataliaStartupTimings ??= {});
    const elapsed = performance.now() - global.__nataliaStartupStart;
    timings[phase] = elapsed;
    perfLog(`[startup] ${phase} +${elapsed.toFixed(1)}ms`);
  }

  function logStartupSummary() {
    (
      globalThis as unknown as {
        __nataliaStartupComplete?: boolean;
      }
    ).__nataliaStartupComplete = true;
    perfLog("[web-ui] startup complete");
  }

  async function loadAttachmentUrl(path: string, mediaType?: string) {
    const result = await props.ctx.runtime.attachmentDataUrl?.({
      path,
      mediaType: mediaType ?? "image/png",
    });
    return result ?? "";
  }

  function handlePasteAttachments(
    event: ClipboardEvent,
    current: ComposerAttachment[],
    setAttachments: (value: ComposerAttachment[]) => void,
  ) {
    const items = Array.from(event.clipboardData?.items ?? []);
    const files = items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (!files.length) return;
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    event.preventDefault();
    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const base64 = dataUrl.split(",")[1];
        if (!base64) return;
        void props.ctx.runtime
          .uploadAttachment?.({
            name: file.name || "clipboard.png",
            mediaType: file.type || "image/png",
            data: base64,
          })
          .then((attachment) => {
            setAttachments([
              ...current,
              {
                path: attachment.path,
                previewUrl: dataUrl,
                name: attachment.filename,
              },
            ]);
          });
      };
      reader.readAsDataURL(file);
    }
  }

  function debouncedRefreshWorkspaces(delay = 1000) {
    if (workspacesRefreshTimer) clearTimeout(workspacesRefreshTimer);
    workspacesRefreshTimer = setTimeout(() => {
      workspacesRefreshTimer = undefined;
      runIdle(() => void refreshWorkspaces());
    }, delay);
  }

  function sessionRecency(session: RuntimeSessionSummary) {
    return new Date(session.lastAccessedAt ?? session.createdAt).getTime();
  }

  function debouncedRefreshSessions(delay = 1000) {
    if (sessionsRefreshTimer) clearTimeout(sessionsRefreshTimer);
    sessionsRefreshTimer = setTimeout(() => {
      sessionsRefreshTimer = undefined;
      runIdle(() => void refreshSessions());
    }, delay);
  }

  async function refreshSessions() {
    if (sessionsRefreshInFlight) return sessionsRefreshInFlight;
    const phaseStart = performance.now();
    const token = ++sessionsRefreshToken;
    let operation: Promise<void>;
    operation = (async () => {
      try {
        const sessions = await props.ctx.runtime.sessionList?.();
        perfLog(
          `[perf] refreshSessions done count=${sessions?.length ?? 0} +${(performance.now() - phaseStart).toFixed(1)}ms`,
        );
        if (token !== sessionsRefreshToken) return;
        if (sessions) {
          const current = sessionList();
          if (
            !current ||
            JSON.stringify(current) !== JSON.stringify(sessions)
          ) {
            setSessionList(sessions);
          }
          if (!userSelectedSession && sessions.length) {
            const active = state().sessionID;
            const target = active
              ? sessions.find(
                  (session) => session.id === active && !session.archived,
                )
              : undefined;
            if (target) {
              setSelectedSessionID(target.id);
              setSelectedSession(target.title);
            } else if (!selectedSessionID()) {
              // While the runtime is still attaching/restoring the startup session,
              // do not race it with a local fallback. The final selection is
              // determined by natalia:recent-session-restored / session.ready and
              // then projected once by openUnresolvedInteractives.
              const load = globalThis as unknown as {
                __nataliaReplayingHistory?: boolean;
              };
              if (load.__nataliaReplayingHistory) return;
              const recent = sessions
                .filter((session) => !session.archived)
                .sort((a, b) => sessionRecency(b) - sessionRecency(a));
              const touched = recent.filter(
                (session) => session.lastAccessedAt,
              );
              const meaningful = recent.filter(
                (session) => session.title && session.title !== "New session",
              );
              const nonEmpty = recent.filter((session) => session.events > 0);
              const fallbackSource = touched.length
                ? touched
                : meaningful.length
                  ? meaningful
                  : nonEmpty.length
                    ? nonEmpty
                    : recent;
              const fallback = fallbackSource[0] ?? sessions[0];
              if (fallback) {
                setSelectedSessionID(fallback.id);
                setSelectedSession(fallback.title);
              }
            }
          }
        }
      } finally {
        if (token === sessionsRefreshToken) {
          sessionsRefreshInFlight = undefined;
        }
      }
    })();
    sessionsRefreshInFlight = operation;
    return operation;
  }

  const visibleSessions = (): RuntimeSessionSummary[] => {
    const query = sessionQuery().trim().toLowerCase();
    return sessionList().filter((session) => {
      if (showArchived() ? !session.archived : session.archived) return false;
      if (query && !session.title.toLowerCase().includes(query)) return false;
      return true;
    });
  };

  async function createSession() {
    const created = await props.ctx.runtime.sessionNew?.();
    if (created?.sessionID) {
      userSelectedSession = true;
      await props.ctx.runtime.sessionAttach?.(created.sessionID);
      setSelectedSessionID(created.sessionID);
      setSelectedSession("新会话");
      void loadPerSessionModelConfig(created.sessionID);
    }
    await refreshSessions();
  }

  async function removeWorkspace(workspaceID: string) {
    try {
      await props.ctx.runtime.workspaceRemove?.(workspaceID);
      await refreshWorkspaces();
      await refreshSessions();
    } catch (error: unknown) {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    }
  }

  function selectedSessionIsActive() {
    return Boolean(
      selectedSessionID() && selectedSessionID() === state().sessionID,
    );
  }

  async function archiveSession(targetID: string) {
    try {
      if (targetID === selectedSessionID() && selectedSessionIsActive()) {
        const other = sessionList().find(
          (session) => session.id !== targetID && !session.archived,
        );
        if (other) {
          await props.ctx.runtime.sessionAttach?.(other.id);
          setSelectedSessionID(other.id);
          setSelectedSession(other.title);
        } else {
          const created = await props.ctx.runtime.sessionNew?.();
          if (!created?.sessionID) {
            props.ctx.runtime.diagnostic?.(
              "移除当前唯一会话前需要先创建并切换到新会话，但当前 runtime 不支持。",
              "warning",
            );
            return;
          }
          await props.ctx.runtime.sessionAttach?.(created.sessionID);
          setSelectedSessionID(created.sessionID);
          setSelectedSession("新会话");
        }
      }
      await props.ctx.runtime.sessionArchive?.(targetID);
      await refreshSessions();
    } catch (error: unknown) {
      props.ctx.runtime.diagnostic?.(
        `归档会话失败：${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    }
  }

  async function restoreSession(sessionID: string) {
    try {
      await props.ctx.runtime.sessionRestore?.(sessionID);
      await refreshSessions();
    } catch (error: unknown) {
      props.ctx.runtime.diagnostic?.(
        `恢复会话失败：${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    }
  }

  async function forkSessionAtTurn(turnID: string) {
    const sourceID = selectedSessionID() || state().sessionID;
    if (!sourceID) return;
    try {
      const result = await props.ctx.runtime.sessionFork?.(
        sourceID,
        turnID,
        `Fork of ${selectedSession()}`,
      );
      if (result) await refreshSessions();
    } catch (error: unknown) {
      props.ctx.runtime.diagnostic?.(
        `Fork 会话失败：${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    }
  }

  function toggleBulkSelected(id: string) {
    const next = new Set(bulkSelected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBulkSelected(next);
  }

  function toggleSelectAllVisible() {
    const ids = visibleSessions().map((session) => session.id);
    if (!ids.length) return;
    const next = new Set(bulkSelected());
    const allSelected = ids.every((id) => next.has(id));
    for (const id of ids) {
      if (allSelected) next.delete(id);
      else next.add(id);
    }
    setBulkSelected(next);
  }

  async function switchAwayFromActiveIfNeeded(ids: string[]) {
    const active = state().sessionID;
    if (!active || !ids.includes(active)) return true;
    const other = sessionList().find(
      (session) => !ids.includes(session.id) && !session.archived,
    );
    if (other) {
      await props.ctx.runtime.sessionAttach?.(other.id);
      setSelectedSessionID(other.id);
      setSelectedSession(other.title);
      return true;
    }
    const created = await props.ctx.runtime.sessionNew?.();
    if (!created?.sessionID) {
      props.ctx.runtime.diagnostic?.(
        "批量操作当前唯一会话前需要先创建并切换到新会话。",
        "warning",
      );
      return false;
    }
    await props.ctx.runtime.sessionAttach?.(created.sessionID);
    setSelectedSessionID(created.sessionID);
    setSelectedSession("新会话");
    return true;
  }

  async function bulkArchiveSelected() {
    const ids = [...bulkSelected()];
    if (!ids.length) return;
    if (!(await switchAwayFromActiveIfNeeded(ids))) return;
    for (const id of ids) await props.ctx.runtime.sessionArchive?.(id);
    await refreshSessions();
    setBulkSelected(new Set<string>());
    setBulkSelectMode(false);
  }

  async function bulkRestoreSelected() {
    const ids = [...bulkSelected()];
    if (!ids.length) return;
    for (const id of ids) await props.ctx.runtime.sessionRestore?.(id);
    await refreshSessions();
    setBulkSelected(new Set<string>());
    setBulkSelectMode(false);
  }

  async function bulkDeleteSelected() {
    const ids = [...bulkSelected()];
    if (!ids.length) return;
    if (
      !window.confirm(
        `确定彻底删除选中的 ${ids.length} 个会话吗？这会删除会话记录和附件，无法恢复。`,
      )
    )
      return;
    try {
      if (!(await switchAwayFromActiveIfNeeded(ids))) return;
      if (!props.ctx.runtime.sessionDelete) {
        props.ctx.runtime.diagnostic?.(
          "当前 runtime 不支持彻底删除会话。",
          "warning",
        );
        return;
      }
      for (const id of ids) await props.ctx.runtime.sessionDelete(id);
      await refreshSessions();
      setBulkSelected(new Set<string>());
      setBulkSelectMode(false);
    } catch (error: unknown) {
      props.ctx.runtime.diagnostic?.(
        `批量删除失败：${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    }
  }

  function checkpointIDForMessage(message: Message) {
    const turnID = sessionTurnID(message.id);
    if (!turnID) return undefined;
    const checkpoint = state()
      .checkpoints.filter((candidate) => candidate.turnID === turnID)
      .sort((a, b) => b.sequence - a.sequence)[0];
    return checkpoint?.id;
  }

  function rollbackDraftFromMessage(message: Message) {
    const checkpointID = checkpointIDForMessage(message);
    const turnID = sessionTurnID(message.id);
    const messages = mainMessages();
    const userMessage = turnID
      ? messages.find(
          (candidate) =>
            sessionTurnID(candidate.id) === turnID && candidate.role === "user",
        )
      : undefined;
    const targetIndex = messages.findIndex(
      (candidate) => candidate.id === message.id,
    );
    if (userMessage) setMainDraft(userMessage.content);
    setPendingRollback({
      turnID: turnID ?? message.id,
      ...(checkpointID ? { checkpointID } : {}),
      label: userMessage?.content || message.content || "该消息",
      hiddenAfter: targetIndex >= 0 ? targetIndex + 1 : undefined,
    });
    setRollbackNotice(undefined);
    if (checkpointID) {
      setReviewRequestedTab("checkpoint");
      setReviewRequestedCheckpointID(checkpointID);
      setRightVisible(true);
      setRightTab("diff");
    }
  }

  async function hydrateRecentMessages(options?: { replace?: boolean }) {
    const sessionID = selectedSessionID() || state().sessionID;
    await hydrateRecentMessagesForSession(sessionID, () => true, options);
  }

  async function hydrateRecentMessagesForSession(
    sessionID: string | undefined,
    isCurrent: () => boolean,
    options?: { replace?: boolean },
  ) {
    const hydrateStart = performance.now();
    const page = sessionID
      ? await props.ctx.runtime.messages?.({ limit: 100, sessionID })
      : await props.ctx.runtime.messages?.({ limit: 100 });
    if (!isCurrent()) return;
    perfLog(
      `[perf] messages rpc ${(performance.now() - hydrateStart).toFixed(1)}ms`,
    );
    if (!page?.data.length) {
      props.ctx.projection.hydrateMessages?.([], "older", options);
      historyCursor = undefined;
      newerHistoryCursor = undefined;
      return;
    }
    props.ctx.projection.hydrateMessages?.(
      [...page.data].reverse(),
      "older",
      options,
    );
    historyCursor = page.cursor.next;
    newerHistoryCursor = undefined;
    perfLog(
      `[perf] messages hydrate total ${(performance.now() - hydrateStart).toFixed(1)}ms`,
    );
  }

  async function refreshTranscript() {
    await hydrateRecentMessages({ replace: true });
    setState(cloneState(props.ctx.projection.getState()));
  }

  function cancelPendingRollback() {
    setPendingRollback(undefined);
  }

  async function redoAppliedRollback() {
    const notice = rollbackNotice();
    if (!notice?.safetyCheckpointID) {
      setRollbackNotice(undefined);
      return;
    }
    try {
      await props.ctx.runtime.checkpointRollback?.({
        id: notice.safetyCheckpointID,
      });
      await refreshTranscript();
    } catch (error: unknown) {
      props.ctx.runtime.diagnostic?.(
        `重做失败：${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    } finally {
      setRollbackNotice(undefined);
    }
  }

  async function physicallyDeleteSelectedSession() {
    const targetID = selectedSessionID();
    if (!targetID) return;
    if (
      !window.confirm(
        `确定要彻底删除会话“${selectedSession()}”吗？这会删除会话记录和附件，无法恢复。`,
      )
    ) {
      return;
    }
    try {
      if (selectedSessionIsActive()) {
        const other = sessionList().find(
          (session) => session.id !== targetID && !session.archived,
        );
        if (other) {
          await props.ctx.runtime.sessionAttach?.(other.id);
          setSelectedSessionID(other.id);
          setSelectedSession(other.title);
        } else {
          const created = await props.ctx.runtime.sessionNew?.();
          if (!created?.sessionID) {
            props.ctx.runtime.diagnostic?.(
              "彻底删除当前唯一会话前需要先创建并切换到新会话。",
              "warning",
            );
            return;
          }
          await props.ctx.runtime.sessionAttach?.(created.sessionID);
          setSelectedSessionID(created.sessionID);
          setSelectedSession("新会话");
        }
      }
      await props.ctx.runtime.sessionDelete?.(targetID);
      await refreshSessions();
    } catch (error: unknown) {
      props.ctx.runtime.diagnostic?.(
        `彻底删除会话失败：${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    }
  }

  let perSessionLoadToken = 0;
  async function loadPerSessionModelConfig(sessionID: string) {
    const token = ++perSessionLoadToken;
    setModelSelectionSignal(undefined);
    setReasoningEffortSignal("medium");
    setChatProfile({});
    const [selectionResult, effortResult, profileResult] =
      await Promise.allSettled([
        props.ctx.runtime.modelSelection?.(sessionID),
        props.ctx.runtime.reasoningEffort?.(sessionID),
        props.ctx.runtime.chatModelProfile?.("navi", sessionID),
      ]);
    const appliedStart = performance.now();
    if (token !== perSessionLoadToken) return;
    const selectionValue =
      selectionResult.status === "fulfilled"
        ? selectionResult.value
        : undefined;
    const effortValue =
      effortResult.status === "fulfilled" ? effortResult.value : undefined;
    const profileValue =
      profileResult.status === "fulfilled" ? profileResult.value : undefined;
    batch(() => {
      if (selectionValue?.modelID) setModelSelectionSignal(selectionValue);
      if (effortValue) setReasoningEffortSignal(effortValue);
      if (
        profileValue &&
        (profileValue.normal?.modelID || profileValue.expert?.modelID)
      )
        setChatProfile(profileValue);
    });
    perfLog(
      `[perf] perSessionModelConfig applied selection=${selectionValue?.modelID ?? "-"} reasoning=${effortValue ?? "-"} profile=${profileValue?.normal?.modelID ?? "-"} +${(performance.now() - appliedStart).toFixed(1)}ms`,
    );
  }

  createEffect(() => {
    const sessionID = selectedSessionID() || state().sessionID;
    if (sessionID) void loadPerSessionModelConfig(sessionID);
  });

  onMount(() => {
    const mountStart = performance.now();
    perfLog(
      `[perf] AppNeu onMount +${(mountStart - ((globalThis as unknown as { __nataliaStartupStart?: number }).__nataliaStartupStart ?? mountStart)).toFixed(1)}ms`,
    );
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setLeftVisible((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setRightVisible((value) => !value);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));

    // Real runtime integration: open the approval modal when the model asks
    // for permission during a turn, and refresh workspace/session navigation
    // whenever the multi-workspace runtime publishes a routing event.
    onCleanup(
      props.ctx.events.subscribe((event) => {
        const replaying = (
          globalThis as unknown as {
            __nataliaReplayingHistory?: boolean;
          }
        ).__nataliaReplayingHistory;
        if (replaying) return;
        const currentSession = selectedSessionID() || state().sessionID;
        if (event.type === "approval.request" && historyReplayDone) {
          setCurrentApproval(event);
          setPermissionOpen(true);
        }
        if (event.type === "question.request" && historyReplayDone) {
          setCurrentQuestion(event);
          setQuestionOpen(true);
        }
        if (event.type === "turn.submitted" && event.delivery !== "queue") {
          mainForceScroll = true;
          setFollowBottom(true);
        }
        if (
          (event.type === "navi.chat.message.new" ||
            event.type === "navi.chat.message.added") &&
          event.role === "user"
        ) {
          chatForceScroll = true;
          setChatFollowBottom(true);
        }
        if (
          event.type.startsWith("workspace.") ||
          event.type === "session.created" ||
          event.type === "session.ready"
        ) {
          debouncedRefreshWorkspaces();
          debouncedRefreshSessions();
        }
      }),
    );

    // After history replay completes, surface only still-unresolved
    // approvals/questions from the restored session. Resolved historical
    // requests are not re-opened because their response events clear them
    // from the view-store pending state during replay.
    const resetProjectionForSessionSwitch = () => {
      historyReplayDone = false;
      messagesHydrationStarted = false;
      lastHydratedSessionID = undefined;
      historyCursor = undefined;
      newerHistoryCursor = undefined;
      loadingOlderHistory = false;
      loadingNewerHistory = false;
      toolOutputCache.clear();
      setFollowBottom(true);
      setShowJumpToBottom(false);
      setChatFollowBottom(true);
      setChatShowJumpToBottom(false);
      setMainDraft("");
      setChatDraft("");
      setMainAttachments([]);
      setChatAttachments([]);
      setCurrentApproval(null);
      setPermissionOpen(false);
      setCurrentQuestion(null);
      setQuestionOpen(false);
      const projected = cloneState(props.ctx.projection.getState());
      setState(projected);
    };
    const unsubscribePanels = props.ctx.host?.subscribePanels(() => {
      setPanelRevision((revision) => revision + 1);
    });
    onCleanup(() => unsubscribePanels?.());
    const elapsedTimer = setInterval(() => {
      if (activeTurnStartedAtValue() !== undefined)
        setTurnElapsedMs(Date.now() - activeTurnStartedAtValue()!);
      if (naviChatActivity()?.startedAt)
        setChatElapsedMs(Date.now() - naviChatActivity()!.startedAt);
    }, 1000);
    onCleanup(() => clearInterval(elapsedTimer));

    window.addEventListener(
      "natalia:session-switch-reset",
      resetProjectionForSessionSwitch,
    );
    onCleanup(() =>
      window.removeEventListener(
        "natalia:session-switch-reset",
        resetProjectionForSessionSwitch,
      ),
    );

    const onRecentSessionRestored = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionID?: string }>).detail;
      if (!detail?.sessionID || userSelectedSession) return;
      const restored = sessionList().find(
        (session) => session.id === detail.sessionID && !session.archived,
      );
      if (restored) {
        setSelectedSessionID(restored.id);
        setSelectedSession(restored.title);
      } else {
        setSelectedSessionID(detail.sessionID);
        setSelectedSession("");
      }
    };
    window.addEventListener(
      "natalia:recent-session-restored",
      onRecentSessionRestored,
    );
    onCleanup(() =>
      window.removeEventListener(
        "natalia:recent-session-restored",
        onRecentSessionRestored,
      ),
    );

    let messagesHydrationStarted = false;
    let lastHydratedSessionID: string | undefined;
    const hydrateRecentMessagesOnLoad = async () => {
      const sessionID = selectedSessionID() || state().sessionID;
      if (sessionID && sessionID === lastHydratedSessionID) return;
      messagesHydrationStarted = true;
      lastHydratedSessionID = sessionID;
      const loadToken = (
        globalThis as unknown as { __nataliaSessionLoadToken?: number }
      ).__nataliaSessionLoadToken;
      const isCurrentLoad = () =>
        loadToken ===
          (globalThis as unknown as { __nataliaSessionLoadToken?: number })
            .__nataliaSessionLoadToken &&
        sessionID === (selectedSessionID() || state().sessionID);
      const hydrateStart = performance.now();
      perfLog(
        `[perf] hydrateRecentMessagesOnLoad start +${(hydrateStart - ((globalThis as unknown as { __nataliaStartupStart?: number }).__nataliaStartupStart ?? hydrateStart)).toFixed(1)}ms`,
      );
      // Message-first startup: the latest projected page replaces the old
      // full-log replay. The page is newest-last on the wire; reverse it so the
      // projection's older-merge keeps transcript order.
      await hydrateRecentMessagesForSession(sessionID, isCurrentLoad);
      if (!isCurrentLoad()) return;
      markStartup("main.messages");
      // Chat and subagents are secondary surfaces. Hydrate them in the
      // background so the primary transcript paints first and does not wait
      // for extra RPCs before the first visible frame.
      void (async () => {
        const chatStart = performance.now();
        props.ctx.projection.beginNaviHydration?.();
        props.ctx.projection.beginNiaHydration?.();
        const [naviChat, niaChat] = await Promise.all([
          props.ctx.runtime.chatMessages?.("navi", sessionID),
          props.ctx.runtime.chatMessages?.("nia", sessionID),
        ]);
        perfLog(
          `[perf] secondary chatMessages ${(performance.now() - chatStart).toFixed(1)}ms`,
        );
        if (isCurrentLoad()) {
          // Empty snapshots intentionally replace the selected stream and clear
          // stale durable history. Each hydration targets its explicit stream.
          props.ctx.projection.hydrateNaviMessages?.(naviChat ?? []);
          props.ctx.projection.hydrateNiaMessages?.(niaChat ?? []);
          perfLog(
            `[perf] secondary chat applied +${(performance.now() - chatStart).toFixed(1)}ms`,
          );
        }
        markStartup("secondary.loaded");
        const timings = (
          globalThis as unknown as {
            __nataliaStartupTimings?: Record<string, number>;
          }
        ).__nataliaStartupTimings;
        if (timings) {
          perfLog("[startup] complete", timings);
          if (
            (globalThis as { __NATALIA_PERF_VERBOSE?: number })
              .__NATALIA_PERF_VERBOSE === 1
          ) {
            console.table(timings);
          }
        }
        // Sub-agent data is not part of the primary Natalia/Navi/Nia view.
        // Load it slightly later on idle so it never delays first paint or the
        // main-agent chat surfaces.
        void new Promise<void>((resolve) => {
          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(() => resolve(), { timeout: 3000 });
          } else {
            setTimeout(resolve, 1500);
          }
        }).then(async () => {
          if (!isCurrentLoad()) return;
          const subagentsStart = performance.now();
          const subagents = await props.ctx.runtime.subagents?.(sessionID);
          perfLog(
            `[perf] background subagents ${(performance.now() - subagentsStart).toFixed(1)}ms`,
          );
          if (subagents && isCurrentLoad())
            props.ctx.projection.hydrateSubagents?.(subagents);
          const subagentHistoryStart = performance.now();
          const subagentHistory =
            await props.ctx.runtime.subagentHistory?.(sessionID);
          perfLog(
            `[perf] background subagentHistory ${(performance.now() - subagentHistoryStart).toFixed(1)}ms`,
          );
          if (subagentHistory && isCurrentLoad())
            props.ctx.projection.hydrateSubagentHistory?.(subagentHistory);
        });
      })();
    };

    const onSessionAttached = (event: Event) => {
      const sessionID = (event as CustomEvent<{ sessionID?: string }>).detail
        ?.sessionID;
      if (sessionID)
        props.ctx.projection.activateSession?.(
          sessionID,
          state().activeWorkspaceID,
        );
      void hydrateRecentMessagesOnLoad();
    };
    window.addEventListener("natalia:session-attached", onSessionAttached);
    onCleanup(() =>
      window.removeEventListener("natalia:session-attached", onSessionAttached),
    );
    // The host may start and restore the session before this plugin mounts, so
    // hydration must not depend solely on the session-attached event.
    void hydrateRecentMessagesOnLoad();

    const openUnresolvedInteractives = (event: Event) => {
      const openStart = performance.now();
      perfLog(
        `[perf] openUnresolvedInteractives start +${(openStart - ((globalThis as unknown as { __nataliaStartupStart?: number }).__nataliaStartupStart ?? openStart)).toFixed(1)}ms`,
      );
      const detail = (
        event as CustomEvent<{ token?: number; sessionID?: string }>
      ).detail;
      const replayGlobal = globalThis as unknown as {
        __nataliaReplayingHistory?: boolean;
        __nataliaSessionLoadToken?: number;
      };
      const isStaleLoad = () =>
        detail?.token !== undefined &&
        replayGlobal.__nataliaSessionLoadToken !== undefined &&
        detail.token !== replayGlobal.__nataliaSessionLoadToken;
      if (isStaleLoad()) return;
      void (async () => {
        if (isStaleLoad()) return;
        suppressProjectionClones = true;
        try {
          await Promise.all([refreshSessions(), hydrateRecentMessagesOnLoad()]);
        } finally {
          suppressProjectionClones = false;
        }
        if (isStaleLoad()) return;
        // Session loading finished; take one projection snapshot instead of
        // cloning once per raw event.
        const projected = cloneState(props.ctx.projection.getState());
        const cloneStart = performance.now();
        setState(projected);
        if (projected.workspaces.length) setWorkspaces(projected.workspaces);
        perfLog(
          `[perf] openUnresolvedInteractives hydrate/state clone +${(performance.now() - cloneStart).toFixed(1)}ms`,
        );
        markStartup("first.paint");
        const startupMask = document.getElementById("natalia-startup-mask");
        if (startupMask) {
          startupMask.classList.add("natalia-startup-mask-hide");
          setTimeout(() => startupMask.remove(), 500);
        }
        logStartupSummary();
        void loadSecondaryStartupData();
        const scrollToBottom = () => {
          if (transcriptEl()) {
            const el = transcriptEl()!;
            el.scrollTop = el.scrollHeight;
            transcriptObservedTop = el.scrollTop;
          }
          if (chatTranscriptEl()) {
            const el = chatTranscriptEl()!;
            el.scrollTop = el.scrollHeight;
            chatObservedTop = el.scrollTop;
          }
        };
        // Initial layout settles over a few frames (fonts, images, tool cards
        // and chat/subagent hydration can change scrollHeight after paint).
        const settleToBottom = (remaining = 5) => {
          scrollToBottom();
          if (remaining > 0) {
            requestAnimationFrame(() => settleToBottom(remaining - 1));
          }
        };
        settleToBottom();
        setTimeout(scrollToBottom, 250);
        const interactiveStart = performance.now();
        const interactive = await props.ctx.runtime.pendingInteractive?.();
        if (isStaleLoad()) return;
        const approvals = interactive?.approvals ?? [];
        if (approvals.length) {
          setCurrentApproval(approvals[0]);
          setPermissionOpen(true);
        }
        const questions = interactive?.questions ?? [];
        if (questions.length) {
          setCurrentQuestion(questions[0]);
          setQuestionOpen(true);
        }
        perfLog(
          `[perf] pendingInteractive applied approvals=${approvals.length} questions=${questions.length} +${(performance.now() - interactiveStart).toFixed(1)}ms`,
        );
        perfLog(
          `[perf] openUnresolvedInteractives done +${(performance.now() - openStart).toFixed(1)}ms`,
        );
        historyReplayDone = true;
      })();
    };
    window.addEventListener(
      "natalia:history-replay-complete",
      openUnresolvedInteractives,
    );
    onCleanup(() =>
      window.removeEventListener(
        "natalia:history-replay-complete",
        openUnresolvedInteractives,
      ),
    );
    // Fast session restore can finish before this UI module mounts. When the
    // history-replay-complete event has already fired, replay it locally so
    // the first attach still hydrates messages/chat/terminal instead of
    // waiting forever for an event that will never arrive again.
    const startupTimings = (
      globalThis as unknown as {
        __nataliaStartupTimings?: Record<string, number>;
      }
    ).__nataliaStartupTimings;
    if (startupTimings?.["session.loaded"] !== undefined) {
      queueMicrotask(() =>
        openUnresolvedInteractives(
          new Event("natalia:history-replay-complete"),
        ),
      );
    }

    const applyTheme = () => {
      applyNeuTheme(themeMode(), props.ctx.root);
    };
    applyTheme();
    createEffect(applyTheme);

    // The keyed Transcript remounts when the resolved session id changes.
    // Re-apply the pinned-to-bottom position after that remount commits.
    createEffect(() => {
      const sessionID = selectedSessionID() || state().sessionID;
      if (!sessionID) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (followBottom() && transcriptEl()) {
            const el = transcriptEl()!;
            el.scrollTop = el.scrollHeight;
            transcriptObservedTop = el.scrollTop;
          }
          if (chatFollowBottom() && chatTranscriptEl()) {
            const el = chatTranscriptEl()!;
            el.scrollTop = el.scrollHeight;
            chatObservedTop = el.scrollTop;
          }
        });
      });
    });

    // Non-critical startup queries are deferred until the primary transcript
    // has painted. Running them before session.messages competes for the
    // desktop main-process event loop and makes first paint wait longer.
  });

  function runIdle(callback: () => void) {
    const idle = (
      globalThis as unknown as {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout?: number },
        ) => number;
      }
    ).requestIdleCallback;
    if (idle) {
      idle(callback, { timeout: 1000 });
    } else {
      setTimeout(callback, 0);
    }
  }

  function loadSecondaryStartupData() {
    const secondaryStart = performance.now();
    perfLog(
      `[perf] loadSecondaryStartupData start +${(secondaryStart - ((globalThis as unknown as { __nataliaStartupStart?: number }).__nataliaStartupStart ?? secondaryStart)).toFixed(1)}ms`,
    );
    runIdle(() => {
      void Promise.all([
        createUiPanelRequirementContext(props.ctx.runtime).catch(
          () => undefined,
        ),
        props.ctx.runtime.modelCatalog?.().catch(() => undefined),
        props.ctx.runtime.registeredTools?.().catch(() => undefined),
        props.ctx.runtime.configGet?.().catch(() => undefined),
        props.ctx.runtime.plugins?.().catch(() => undefined),
      ]).then(([requirementContext, catalog, tools, nextConfig, plugins]) => {
        const appliedAt = performance.now();
        batch(() => {
          if (requirementContext)
            setPanelRequirementContext(requirementContext);
          if (catalog) setModelCatalog(catalog);
          if (tools) setRegisteredTools(tools.map((tool) => tool.name));
          if (nextConfig) setConfig(nextConfig);
          setInteractiveTerminalAvailable(
            Boolean(
              plugins?.some((plugin) => plugin.id === "natalia-tool-terminal"),
            ),
          );
        });
        perfLog(
          `[perf] secondary all applied catalog=${catalog?.length ?? 0} tools=${tools?.length ?? 0} plugins=${plugins?.length ?? 0} +${(performance.now() - appliedAt).toFixed(1)}ms`,
        );
      });
    });
    runIdle(() => {
      void debouncedRefreshSessions();
    });
    runIdle(() => {
      void debouncedRefreshWorkspaces();
    });
    perfLog(
      `[perf] loadSecondaryStartupData scheduled +${(performance.now() - secondaryStart).toFixed(1)}ms`,
    );
  }

  const modelOptions = () =>
    (modelCatalog() ?? []).map((entry) => ({
      value: entry.id,
      label: entry.id,
    }));

  const permissionOptions = () =>
    Object.entries(config()?.agentModes ?? {}).map(([name, mode]) => ({
      value: name,
      label: `${name}${config()?.defaultAgentMode === name ? "（默认）" : ""}`,
    }));

  async function changePermission(permission: string) {
    await props.ctx.runtime.updateConfig?.({
      patch: { defaultAgentMode: permission },
      scope: "global",
    } as never);
    const next = await props.ctx.runtime.configGet?.();
    if (next) setConfig(next);
  }

  async function updateChatProfile(next: ChatModelProfile) {
    setChatProfile(next);
    const sessionID = selectedSessionID() || state().sessionID;
    await props.ctx.runtime.setChatModelProfile?.(next, "navi", sessionID);
  }
  function formatValue(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (Array.isArray(value))
      return value
        .map((item) =>
          typeof item === "object" && item !== null
            ? JSON.stringify(item)
            : String(item),
        )
        .join(", ");
    return "";
  }

  const toolOutputCache = new Map<string, string>();
  function formatToolOutput(name: string, output: string): string {
    const cacheKey = `${name}\n${output}`;
    const cached = toolOutputCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const formatted = formatToolOutputUncached(name, output);
    if (toolOutputCache.size >= 512) {
      const oldest = toolOutputCache.keys().next().value;
      if (oldest !== undefined) toolOutputCache.delete(oldest);
    }
    toolOutputCache.set(cacheKey, formatted);
    return formatted;
  }

  function formatToolOutputUncached(name: string, output: string): string {
    if (name === "ask_user") {
      try {
        const parsed = JSON.parse(output) as { answers?: unknown };
        if (Array.isArray(parsed.answers)) {
          const text = parsed.answers
            .flatMap((answer) =>
              Array.isArray(answer) ? answer.map(String) : [String(answer)],
            )
            .filter(Boolean)
            .join("; ");
          if (text) return text;
        }
      } catch {
        // fall through
      }
      return output;
    }
    try {
      const parsed = JSON.parse(output) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => formatValue(item))
          .filter(Boolean)
          .join("\n");
      }
      if (parsed && typeof parsed === "object") {
        return Object.entries(parsed as Record<string, unknown>)
          .map(([key, value]) => {
            const text = formatValue(value);
            return text ? `${key}: ${text}` : key;
          })
          .join("\n");
      }
    } catch {
      // not JSON: keep plain text
    }
    return output;
  }

  function captureScrollAnchor(
    el: HTMLDivElement | undefined,
  ): ScrollAnchor | undefined {
    if (!el) return undefined;
    const containerRect = el.getBoundingClientRect();
    for (const row of el.querySelectorAll<HTMLElement>("[data-message-id]")) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
        const id = row.dataset.messageId;
        if (id) return { id, top: rect.top - containerRect.top };
      }
    }
    return undefined;
  }

  function restoreScrollAnchor(
    el: HTMLDivElement | undefined,
    anchor: ScrollAnchor | undefined,
    ledger: "transcript" | "chat",
  ) {
    if (!el || !anchor) return;
    const row = [...el.querySelectorAll<HTMLElement>("[data-message-id]")].find(
      (candidate) => candidate.dataset.messageId === anchor.id,
    );
    if (!row) return;
    const containerRect = el.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    el.scrollTop =
      el.scrollTop + (rowRect.top - containerRect.top) - anchor.top;
    if (ledger === "transcript") transcriptObservedTop = el.scrollTop;
    else chatObservedTop = el.scrollTop;
  }

  async function loadOlderHistory() {
    if (!historyCursor || loadingOlderHistory || !historyReplayDone) return;
    loadingOlderHistory = true;
    const anchor = captureScrollAnchor(transcriptEl());
    transcriptPagingAnchor = anchor;
    try {
      const page = await props.ctx.runtime.messages?.({
        cursor: historyCursor,
        limit: 100,
      });
      if (!page) return;
      const evicted = props.ctx.projection.hydrateMessages?.(
        [...page.data].reverse(),
        "older",
      );
      if (evicted) newerHistoryCursor = page.cursor.previous;
      historyCursor = page.cursor.next;
    } finally {
      loadingOlderHistory = false;
      const pendingAnchor = transcriptPagingAnchor;
      transcriptPagingAnchor = undefined;
      requestAnimationFrame(() => {
        requestAnimationFrame(() =>
          restoreScrollAnchor(transcriptEl(), pendingAnchor, "transcript"),
        );
      });
    }
  }

  async function loadNewerHistory() {
    if (!newerHistoryCursor || loadingNewerHistory || !historyReplayDone)
      return;
    loadingNewerHistory = true;
    try {
      const page = await props.ctx.runtime.messages?.({
        cursor: newerHistoryCursor,
        limit: 100,
      });
      if (!page) return;
      const evicted = props.ctx.projection.hydrateMessages?.(
        [...page.data].reverse(),
        "newer",
      );
      if (evicted) historyCursor = page.cursor.next;
      newerHistoryCursor = page.cursor.previous;
    } finally {
      loadingNewerHistory = false;
    }
  }

  function handleTranscriptScroll() {
    const scrollStart = performance.now();
    const el = transcriptEl();
    if (!el) return;
    const floor = Math.max(0, el.scrollHeight - el.clientHeight);
    const ledger = Math.min(transcriptObservedTop, floor);
    const movedByReader = Math.abs(el.scrollTop - ledger) > 1;
    if (!movedByReader) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      if (nearBottom) {
        el.scrollTop = el.scrollHeight;
      }
      transcriptObservedTop = el.scrollTop;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setFollowBottom(nearBottom);
    setShowJumpToBottom(!nearBottom);
    transcriptObservedTop = el.scrollTop;
    if (el.scrollTop < 80) void loadOlderHistory();
    const scrollMs = performance.now() - scrollStart;
    if (scrollMs > 16)
      perfLog(
        `[perf] renderer scroll transcript ${scrollMs.toFixed(1)}ms scrollTop=${el.scrollTop} height=${el.scrollHeight}`,
      );
  }

  function jumpToBottom() {
    const el = transcriptEl();
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    transcriptObservedTop = el.scrollTop;
    setFollowBottom(true);
    setShowJumpToBottom(false);
  }

  function handleChatTranscriptScroll() {
    const scrollStart = performance.now();
    const el = chatTranscriptEl();
    if (!el) return;
    const floor = Math.max(0, el.scrollHeight - el.clientHeight);
    const ledger = Math.min(chatObservedTop, floor);
    const movedByReader = Math.abs(el.scrollTop - ledger) > 1;
    if (!movedByReader) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      if (nearBottom) {
        el.scrollTop = el.scrollHeight;
      }
      chatObservedTop = el.scrollTop;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setChatFollowBottom(nearBottom);
    setChatShowJumpToBottom(!nearBottom);
    chatObservedTop = el.scrollTop;
    const scrollMs = performance.now() - scrollStart;
    if (scrollMs > 16)
      perfLog(
        `[perf] renderer scroll chat ${scrollMs.toFixed(1)}ms scrollTop=${el.scrollTop} height=${el.scrollHeight}`,
      );
  }

  function jumpChatToBottom() {
    const el = chatTranscriptEl();
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    chatObservedTop = el.scrollTop;
    setChatFollowBottom(true);
    setChatShowJumpToBottom(false);
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 1) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }

  function chatActivityLabel(): string {
    const activity = naviChatActivity();
    if (!activity) return "idle";
    switch (activity.phase) {
      case "waiting":
        return "Waiting";
      case "thinking":
        return "Thinking";
      case "generating":
        return "Generating";
      case "using_tool":
        return activity.toolName
          ? `Using ${activity.toolName}`
          : "Using a tool";
    }
  }

  function activityLabel(): string {
    const activity = selectPrimaryActivity(state());
    if (activity) {
      switch (activity.kind) {
        case "planning":
          return "Planning";
        case "thinking":
          return "Thinking";
        case "generating":
          return "Generating";
        case "tool":
          return activity.label ? `Using ${activity.label}` : "Using a tool";
        case "command":
          return "Running command";
        case "workflow":
          return "Running workflow";
        case "subagent":
          return "Working with subagent";
        case "compacting":
          return "Compacting context";
        case "retrying":
          return "Retrying";
        case "waiting_for_user":
          return "Waiting for input";
        case "paused":
          return "Paused";
      }
    }
    return state().natalia.activeTurn ? "Working" : "Ready";
  }

  const mainMessages = createMemo<Message[]>(() =>
    state().natalia.messages.map((msg, idx) => {
      if (msg.tool) {
        return {
          id: msg.id,
          role: "assistant",
          content: "",
          status:
            state().natalia.activeTurn &&
            idx === state().natalia.messages.length - 1
              ? "running"
              : (msg.tool.status as Message["status"]),
          toolCalls: [
            {
              name: msg.tool.name,
              output: formatToolOutput(
                msg.tool.name,
                msg.tool.result ?? msg.tool.summary,
              ),
              status: msg.tool.status,
              summary: msg.tool.summary,
            },
          ],
        };
      }
      return {
        id: msg.id,
        role:
          msg.role === "user"
            ? "user"
            : msg.role === "system"
              ? "system"
              : "assistant",
        thinking: msg.role === "thinking" && msg.reasoningVisible !== false,
        ...(msg.role === "user" && msg.attachments?.length
          ? (() => {
              console.warn("[msg-attachments]", msg.id, msg.attachments.length);
              return {
                attachments: msg.attachments.map((attachment) => ({
                  path: attachment.path,
                  name: attachment.filename,
                  mediaType: attachment.mediaType,
                })),
              };
            })()
          : {}),
        content: msg.text + (msg.pendingText || ""),
        status:
          state().natalia.activeTurn &&
          idx === state().natalia.messages.length - 1
            ? "running"
            : undefined,
        streaming: Boolean(
          state().natalia.activeTurn &&
            idx === state().natalia.messages.length - 1 &&
            msg.role !== "user" &&
            (msg.pendingText ?? "").length > 0,
        ),
      };
    }),
  );

  const visibleMainMessages = createMemo<Message[]>(() => {
    const hiddenAfter = pendingRollback()?.hiddenAfter;
    const messages = mainMessages();
    if (hiddenAfter === undefined) return messages;
    return messages.slice(0, hiddenAfter);
  });

  const naviChatActivity = () => state().navi.activity;

  const chatMessages = createMemo<Message[]>(() =>
    state().navi.messages.map((msg, idx) => {
      if (msg.tool) {
        return {
          id: msg.id,
          role: "assistant",
          content: "",
          toolCalls: [
            {
              name: msg.tool.name,
              output: formatToolOutput(
                msg.tool.name,
                msg.tool.result ?? msg.tool.summary,
              ),
            },
          ],
        };
      }
      return {
        id: msg.id,
        role: msg.role === "user" ? "user" : "assistant",
        thinking: msg.role === "thinking" && msg.reasoningVisible !== false,
        content: msg.text + (msg.pendingText || ""),
        streaming: Boolean(
          naviChatActivity() &&
            idx === state().navi.messages.length - 1 &&
            msg.role !== "user",
        ),
      };
    }),
  );

  function startLeftResize(event: PointerEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = leftWidth();
    const move = (next: PointerEvent) =>
      setLeftWidth(
        Math.max(
          MIN_SIDEBAR_WIDTH,
          Math.min(MAX_SIDEBAR_WIDTH, startWidth + next.clientX - startX),
        ),
      );
    const finish = (next: PointerEvent) => {
      target.releasePointerCapture?.(next.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  }

  function startRightResize(event: PointerEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = rightWidth();
    const move = (next: PointerEvent) =>
      setRightWidth(
        Math.max(
          MIN_RIGHT_WIDTH,
          Math.min(rightPanelMaxWidth(), startWidth - (next.clientX - startX)),
        ),
      );
    const finish = (next: PointerEvent) => {
      target.releasePointerCapture?.(next.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  }

  function cycleThemeMode() {
    const modes = NEU_THEME_MODES;
    const current = themeMode() as (typeof modes)[number];
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    setThemeMode(next);
    props.ctx.preferences.set("themeMode", next);
  }

  function panelVisible(panel: {
    requires?: import("@natalia/contracts").UiPanelRequirement[];
  }) {
    const context = panelRequirementContext();
    if (!context) return true;
    return uiPanelRequirementsSatisfied(context, panel.requires);
  }

  const filePanel = () => {
    panelRevision();
    return props.ctx.host
      ?.listPanels()
      .find((item) => item.panel.id === "files" && panelVisible(item.panel));
  };

  const terminalPanel = () => {
    panelRevision();
    return (
      interactiveTerminalAvailable() &&
      props.ctx.host
        ?.listPanels()
        .find(
          (item) => item.panel.id === "terminal" && panelVisible(item.panel),
        )
    );
  };

  const todoPanel = () => {
    panelRevision();
    return props.ctx.host
      ?.listPanels()
      .find((item) => item.panel.id === "todo" && panelVisible(item.panel));
  };

  const rightTabs = () => {
    panelRevision();
    const tabs: { id: RightTab; label: string }[] = [
      { id: "diff", label: "审阅 / Diff" },
      { id: "plan", label: "计划" },
      { id: "nia", label: "Nia" },
      ...(todoPanel() ? [{ id: "todo" as RightTab, label: "待办" }] : []),
      { id: "agent", label: "协同" },
      ...(terminalPanel()
        ? [{ id: "terminal" as RightTab, label: "终端" }]
        : []),
      ...(filePanel() ? [{ id: "files" as RightTab, label: "文件" }] : []),
    ];
    const layout = layoutProfile();
    const order = layout?.regions?.right?.order;
    if (order?.length) {
      tabs.sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        return (
          (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi)
        );
      });
    }
    return tabs;
  };
  function mountFilePanel(container: HTMLDivElement) {
    const panel = filePanel();
    if (!panel || !props.ctx.host) return;
    void props.ctx.host.mountPanel(panel.pluginId, panel.panel.id, container);
  }

  function mountTerminalPanel(container: HTMLDivElement) {
    const panel = terminalPanel();
    if (!panel || !props.ctx.host) return;
    void props.ctx.host.mountPanel(panel.pluginId, panel.panel.id, container);
  }

  function mountTodoPanel(container: HTMLDivElement) {
    const panel = todoPanel();
    if (!panel || !props.ctx.host) return;
    void props.ctx.host.mountPanel(panel.pluginId, panel.panel.id, container);
  }

  const topbarPanels = () => {
    panelRevision();
    return (
      props.ctx.host
        ?.listPanels()
        .filter(
          (item) => item.panel.region === "topbar" && panelVisible(item.panel),
        ) ?? []
    );
  };

  const groupedTopbarPanels = () => {
    const groups = new Map<string, ReturnType<typeof topbarPanels>>();
    for (const item of topbarPanels()) {
      const group = item.panel.group ?? "更多";
      const list = groups.get(group) ?? [];
      list.push(item);
      groups.set(group, list);
    }
    return [...groups.entries()];
  };

  function mountTopbarPanel(panel: ReturnType<typeof topbarPanels>[number]) {
    setTopbarPanel({ pluginId: panel.pluginId, panelId: panel.panel.id });
    requestAnimationFrame(() => {
      if (topbarPanelRef && props.ctx.host) {
        void props.ctx.host.mountPanel(
          panel.pluginId,
          panel.panel.id,
          topbarPanelRef,
        );
      }
    });
  }

  onMount(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const screenWidth =
        window.screen?.availWidth || window.screen?.width || width;
      const screenHeight =
        window.screen?.availHeight || window.screen?.height || height;
      const area = width * height;
      const quarterArea = screenWidth * screenHeight * 0.25;
      const tiny =
        width <= 1000 || height <= screenHeight * 0.5 || area <= quarterArea;
      const mode = tiny ? "tiny" : width <= 1700 ? "compact" : "wide";
      setLayoutMode(mode);
      if (mode !== "wide") {
        setLeftVisible(false);
        setRightVisible(false);
      } else {
        setLeftVisible(true);
        setRightVisible(true);
      }
      setNaviOpen(mode !== "tiny");
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    onCleanup(() => window.removeEventListener("resize", updateLayout));
  });

  const nataliaVisible = () => layoutMode() !== "tiny" || !naviOpen();
  const naviVisible = () =>
    layoutMode() === "wide" ||
    (layoutMode() === "compact" && !leftVisible() && !rightVisible()) ||
    (layoutMode() === "tiny" &&
      naviOpen() &&
      !leftVisible() &&
      !rightVisible());

  let leftSidebarWasVisible = true;
  createEffect(() => {
    const visible = leftVisible();
    if (visible && !leftSidebarWasVisible) {
      debouncedRefreshSessions();
      debouncedRefreshWorkspaces();
    }
    leftSidebarWasVisible = visible;
  });

  return (
    <div
      class="neu-shell"
      data-compact={layoutMode() !== "wide"}
      data-tiny={layoutMode() === "tiny"}
      data-left-open={leftVisible()}
      data-left-wide={leftWidth() >= 230}
      data-right-open={rightVisible()}
    >
      <header class="neu-topbar">
        <div class="neu-topbar-left">
          <span class="neu-topbar-logo">N</span>
          <div class="neu-topbar-meta">
            <span class="neu-topbar-title">Natalia</span>
            <span class="neu-topbar-sub">
              The world is not beautiful; therefore it is.
            </span>
          </div>
        </div>
        <div class="neu-topbar-right">
          <button
            type="button"
            class="neu-topbar-btn"
            data-active={viewOpen()}
            onClick={() => setViewOpen((value) => !value)}
          >
            视图
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setSearchOpen(true)}
          >
            搜索
          </button>
          <button
            type="button"
            class="neu-topbar-btn neu-topbar-btn-primary"
            onClick={() => setSettingsOpen(true)}
          >
            设置
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            data-active={moreOpen()}
            onClick={() => setMoreOpen((value) => !value)}
          >
            更多
          </button>
        </div>
        <Show when={topbarPanel()}>
          <div class="neu-topbar-panel-dropdown">
            <div class="neu-topbar-panel-content" ref={topbarPanelRef} />
            <button
              type="button"
              class="neu-topbar-panel-close"
              onClick={() => setTopbarPanel(null)}
            >
              关闭
            </button>
          </div>
        </Show>
        <Show when={viewOpen()}>
          <div class="neu-topbar-view-dropdown">
            <button
              type="button"
              class="neu-topbar-more-item"
              data-active={leftVisible()}
              onClick={() => {
                setLeftVisible((value) => !value);
                setViewOpen(false);
              }}
            >
              左栏
            </button>
            <button
              type="button"
              class="neu-topbar-more-item"
              data-active={rightVisible()}
              onClick={() => {
                setRightVisible((value) => !value);
                setViewOpen(false);
              }}
            >
              右栏
            </button>
            <Show when={layoutMode() === "tiny"}>
              <button
                type="button"
                class="neu-topbar-more-item"
                data-active={naviOpen()}
                onClick={() => {
                  setNaviOpen((value) => !value);
                  setViewOpen(false);
                }}
              >
                Navi
              </button>
            </Show>
          </div>
        </Show>
        <Show when={moreOpen()}>
          <div class="neu-topbar-more-dropdown">
            <button
              type="button"
              class="neu-topbar-more-item"
              onClick={() => {
                setStatusOpen(true);
                setMoreOpen(false);
              }}
            >
              状态
            </button>
            <button
              type="button"
              class="neu-topbar-more-item"
              onClick={() => {
                setHelpOpen(true);
                setMoreOpen(false);
              }}
            >
              帮助
            </button>
            <button
              type="button"
              class="neu-topbar-more-item"
              onClick={() => {
                setStashOpen(true);
                setMoreOpen(false);
              }}
            >
              暂存
            </button>
            <button
              type="button"
              class="neu-topbar-more-item"
              onClick={() => {
                setSandboxOpen(true);
                setMoreOpen(false);
              }}
            >
              沙箱
            </button>
            <button
              type="button"
              class="neu-topbar-more-item"
              onClick={() => {
                setGovernanceOpen(true);
                setMoreOpen(false);
              }}
            >
              治理
            </button>
            <button
              type="button"
              class="neu-topbar-more-item"
              onClick={() => {
                setPluginManagerOpen(true);
                setMoreOpen(false);
              }}
            >
              插件
            </button>
            <div class="neu-topbar-more-separator" />
            <For each={groupedTopbarPanels()}>
              {([group, panels]) => (
                <div class="neu-topbar-more-group">
                  <span class="neu-topbar-group-label">{group}</span>
                  <For each={panels}>
                    {(panel) => (
                      <button
                        type="button"
                        class="neu-topbar-more-item"
                        onClick={() => {
                          mountTopbarPanel(panel);
                          setMoreOpen(false);
                        }}
                      >
                        {panel.panel.title}
                      </button>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </Show>
      </header>
      <div class="neu-app">
        {/* Left session tree */}
        {leftVisible() ? (
          <>
            <aside class="neu-sidebar" style={{ width: `${leftWidth()}px` }}>
              <div class="neu-sidebar-header">
                <span class="neu-sidebar-title">工作区</span>
                <div class="neu-sidebar-actions">
                  <button
                    type="button"
                    class="neu-icon-btn"
                    title="搜索会话"
                    data-active={sessionSearchOpen()}
                    onClick={() => {
                      setSessionSearchOpen((value) => !value);
                      setSidebarMenuOpen(false);
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <circle
                        cx="7"
                        cy="7"
                        r="4.5"
                        stroke="currentColor"
                        stroke-width="1.4"
                      />
                      <path
                        d="M10.3 10.3L13.5 13.5"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="neu-icon-btn"
                    title="更多会话操作"
                    data-active={sidebarMenuOpen()}
                    onClick={() => {
                      setSidebarMenuOpen((value) => !value);
                      setSessionSearchOpen(false);
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 4.5h10"
                        stroke="currentColor"
                        stroke-width="1.3"
                        stroke-linecap="round"
                      />
                      <circle
                        cx="6"
                        cy="4.5"
                        r="1.6"
                        fill="var(--neu-bg-light)"
                        stroke="currentColor"
                        stroke-width="1.3"
                      />
                      <path
                        d="M3 11.5h10"
                        stroke="currentColor"
                        stroke-width="1.3"
                        stroke-linecap="round"
                      />
                      <circle
                        cx="10"
                        cy="11.5"
                        r="1.6"
                        fill="var(--neu-bg-light)"
                        stroke="currentColor"
                        stroke-width="1.3"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="neu-icon-btn"
                    title="批量选择"
                    data-active={bulkSelectMode()}
                    onClick={() => {
                      setSidebarMenuOpen(false);
                      setSessionSearchOpen(false);
                      setBulkSelectMode((value) => !value);
                      setBulkSelected(new Set<string>());
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <rect
                        x="2.5"
                        y="2.5"
                        width="11"
                        height="11"
                        rx="2"
                        stroke="currentColor"
                        stroke-width="1.3"
                      />
                      <path
                        d="M5.2 8.2L7 10L10.8 6.2"
                        stroke="currentColor"
                        stroke-width="1.3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="neu-icon-btn"
                    title="新建会话"
                    onClick={() => {
                      setSidebarMenuOpen(false);
                      void createSession();
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 3v10M3 8h10"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <Show when={sessionSearchOpen()}>
                <input
                  class="neu-session-search"
                  placeholder="搜索会话..."
                  value={sessionQuery()}
                  onInput={(event) =>
                    setSessionQuery(event.currentTarget.value)
                  }
                />
              </Show>
              <Show when={bulkSelectMode()}>
                <div class="neu-bulk-bar">
                  <span class="neu-bulk-count">
                    已选 {bulkSelected().size} 项
                  </span>
                  <div class="neu-bulk-actions">
                    <button
                      type="button"
                      class="neu-bulk-btn"
                      onClick={() => toggleSelectAllVisible()}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      class="neu-bulk-btn"
                      onClick={() => void bulkArchiveSelected()}
                    >
                      归档
                    </button>
                    <button
                      type="button"
                      class="neu-bulk-btn"
                      onClick={() => void bulkRestoreSelected()}
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      class="neu-bulk-btn neu-bulk-btn-danger"
                      onClick={() => void bulkDeleteSelected()}
                    >
                      删除
                    </button>
                    <button
                      type="button"
                      class="neu-bulk-btn"
                      onClick={() => {
                        setBulkSelectMode(false);
                        setBulkSelected(new Set<string>());
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </Show>
              <Show when={sidebarMenuOpen()}>
                <div class="neu-sidebar-menu">
                  <button
                    type="button"
                    class="neu-sidebar-menu-item"
                    onClick={() => {
                      setSidebarMenuOpen(false);
                      setSessionMenuOpen(true);
                    }}
                  >
                    会话操作
                  </button>
                  <button
                    type="button"
                    class="neu-sidebar-menu-item"
                    onClick={() => {
                      setSidebarMenuOpen(false);
                      setWorkspaceOpen(true);
                    }}
                  >
                    工作区管理
                  </button>
                  <button
                    type="button"
                    class="neu-sidebar-menu-item"
                    onClick={() => {
                      setSidebarMenuOpen(false);
                      setWorkspaceSettingsOpen(true);
                    }}
                  >
                    工作区设置
                  </button>
                  <button
                    type="button"
                    class="neu-sidebar-menu-item neu-sidebar-menu-toggle"
                    data-active={showArchived()}
                    onClick={() => setShowArchived((value) => !value)}
                  >
                    显示归档
                  </button>
                </div>
              </Show>
              <div class="neu-sidebar-content">
                <SessionTree
                  selected={selectedSessionID()}
                  sessions={visibleSessions()}
                  workspaces={workspaces()}
                  onRename={(id, title) => {
                    void props.ctx.runtime
                      .sessionRename?.(id, title)
                      .then(() => refreshSessions());
                  }}
                  onSelect={(id, name) => {
                    userSelectedSession = true;
                    setSelectedSessionID(id);
                    setSelectedSession(name);
                    void props.ctx.runtime.sessionAttach?.(id).then(() => {
                      refreshSessions();
                      void loadPerSessionModelConfig(id);
                    });
                  }}
                  onRemoveWorkspace={(workspaceID) => {
                    void removeWorkspace(workspaceID);
                  }}
                  onRestore={(sessionID) => {
                    void restoreSession(sessionID);
                  }}
                  onArchive={(sessionID) => {
                    void archiveSession(sessionID);
                  }}
                  bulkMode={bulkSelectMode()}
                  bulkSelected={(sessionID) => bulkSelected().has(sessionID)}
                  onBulkToggle={(sessionID) => toggleBulkSelected(sessionID)}
                />
              </div>
            </aside>
            <div
              class="neu-resizer"
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startLeftResize}
            />
          </>
        ) : (
          <button
            type="button"
            class="neu-collapsed-rail neu-left-rail"
            onClick={() => setLeftVisible(true)}
            title="展开左侧栏（Ctrl+B）"
          >
            <span class="neu-rail-dots" />
          </button>
        )}

        {/* Middle dual agent panes */}
        <section class="neu-main">
          <div class="neu-main-panes">
            <Show when={nataliaVisible()}>
              <div class="neu-pane">
                <div class="neu-pane-header">
                  <span class="neu-pane-title">Natalia</span>
                  <span
                    class="neu-pane-status"
                    data-running={state().natalia.activeTurn}
                  >
                    {state().natalia.activeTurn ? "running" : "idle"}
                  </span>
                </div>
                <div class="neu-pane-content">
                  <Show
                    when={selectedSessionID() || state().sessionID || "none"}
                    keyed
                  >
                    <div class="main-transcript-wrap">
                      <Transcript
                        messages={visibleMainMessages()}
                        emptyTitle="Natalia 已准备好"
                        emptyHint="Natalia 会直接处理工作区任务。"
                        assistantName="Natalia"
                        assistantInitial="N"
                        scrollRef={setTranscriptEl}
                        onScroll={handleTranscriptScroll}
                        loadAttachmentUrl={loadAttachmentUrl}
                        onFork={forkSessionAtTurn}
                        onRollback={rollbackDraftFromMessage}
                        checkpointIDForMessage={checkpointIDForMessage}
                      />
                      <Show when={showJumpToBottom()}>
                        <button
                          type="button"
                          class="neu-jump-bottom"
                          onClick={jumpToBottom}
                          title="跳到底部"
                        >
                          ↓
                        </button>
                      </Show>
                    </div>
                  </Show>
                  <div
                    class="neu-activity-bar"
                    data-running={state().natalia.activeTurn}
                  >
                    <span class="neu-activity-pulse" />
                    <span class="neu-activity-label">
                      {state().natalia.activeTurn
                        ? `${activityLabel()} · ${formatDuration(turnElapsedMs())}`
                        : "idle"}
                    </span>
                  </div>
                  <div class="neu-main-toolbar">
                    <NeuSelect
                      value={modelSelectionSignal()?.modelID ?? ""}
                      options={modelOptions()}
                      onChange={(modelID) => {
                        const sessionID =
                          selectedSessionID() || state().sessionID;
                        setModelSelectionSignal({
                          modelID,
                          variant: undefined,
                        });
                        void props.ctx.runtime.selectModel?.(
                          modelID,
                          undefined,
                          sessionID,
                        );
                      }}
                      placeholder="选择模型"
                      menuPosition="top"
                    />
                    <NeuSelect
                      value={reasoningEffort()}
                      options={[
                        { value: "minimal", label: "minimal" },
                        { value: "low", label: "low" },
                        { value: "medium", label: "medium" },
                        { value: "high", label: "high" },
                        { value: "xhigh", label: "xhigh" },
                      ]}
                      onChange={(effort) => {
                        const sessionID =
                          selectedSessionID() || state().sessionID;
                        setReasoningEffortSignal(effort);
                        void props.ctx.runtime.setReasoningEffort?.(
                          effort as
                            | "minimal"
                            | "low"
                            | "medium"
                            | "high"
                            | "xhigh",
                          sessionID,
                        );
                      }}
                      placeholder="推理强度"
                      menuPosition="top"
                    />
                    <NeuSelect
                      value={config()?.defaultAgentMode ?? "ask"}
                      options={permissionOptions()}
                      onChange={(permission) =>
                        void changePermission(permission)
                      }
                      placeholder="选择权限"
                      menuPosition="top"
                    />
                  </div>
                  <Show when={pendingRollback()}>
                    <div class="neu-rollback-banner">
                      <span>已准备回滚：{pendingRollback()!.label}</span>
                      <span class="neu-rollback-hint">发送新消息后生效</span>
                      <button
                        type="button"
                        class="neu-rollback-cancel"
                        onClick={() => cancelPendingRollback()}
                      >
                        取消
                      </button>
                    </div>
                  </Show>
                  <Show when={!pendingRollback() && rollbackNotice()}>
                    <div class="neu-rollback-banner">
                      <span>{rollbackNotice()!.text}</span>
                      <span class="neu-rollback-hint">
                        发送新消息前可以重做这些更改
                      </span>
                      <Show when={rollbackNotice()!.safetyCheckpointID}>
                        <button
                          type="button"
                          class="neu-rollback-redo"
                          onClick={() => void redoAppliedRollback()}
                        >
                          重做
                        </button>
                      </Show>
                      <button
                        type="button"
                        class="neu-rollback-cancel"
                        onClick={() => setRollbackNotice(undefined)}
                      >
                        知道了
                      </button>
                    </div>
                  </Show>
                  <Composer
                    value={mainDraft()}
                    placeholder="输入消息，使用 @ 提及文件…"
                    busy={Boolean(state().natalia.activeTurn)}
                    onInput={setMainDraft}
                    attachments={mainAttachments()}
                    onRemoveAttachment={(path) =>
                      setMainAttachments(
                        mainAttachments().filter((item) => item.path !== path),
                      )
                    }
                    onPaste={(event) =>
                      handlePasteAttachments(
                        event,
                        mainAttachments(),
                        setMainAttachments,
                      )
                    }
                    onSubmit={() => {
                      const text = mainDraft();
                      const paths = mainAttachments().map((item) => item.path);
                      if (text.trim() || paths.length) {
                        const rollback = pendingRollback();
                        const submit = async () => {
                          try {
                            if (rollback) {
                              const sessionID =
                                selectedSessionID() || state().sessionID;
                              const messageResult =
                                rollback.turnID && sessionID
                                  ? await props.ctx.runtime.sessionRollbackMessages?.(
                                      sessionID,
                                      rollback.turnID,
                                    )
                                  : undefined;
                              const preview = rollback.checkpointID
                                ? await props.ctx.runtime.checkpointRollback?.({
                                    id: rollback.checkpointID,
                                  })
                                : undefined;
                              await refreshTranscript();
                              if (messageResult || preview) {
                                setRollbackNotice({
                                  text:
                                    messageResult && preview
                                      ? `已还原消息，并恢复工作区检查点。`
                                      : preview
                                        ? `已恢复工作区检查点。`
                                        : messageResult?.safetyCheckpointID
                                          ? `已还原 1 条消息，并创建了安全后悔点。`
                                          : `已还原 1 条消息。没有可用的文件检查点，因此未恢复工作区更改。`,
                                  safetyCheckpointID:
                                    messageResult?.safetyCheckpointID ??
                                    preview?.safetyCheckpointID,
                                  restoredCount: 1,
                                });
                              }
                            } else {
                              setRollbackNotice(undefined);
                            }
                            console.log("[web-plugin] send", text);
                            if (paths.length && props.ctx.runtime.submitInput) {
                              props.ctx.runtime.submitInput?.({
                                text,
                                attachments: paths,
                              });
                            } else {
                              props.ctx.runtime.submit?.(text);
                            }
                          } finally {
                            setMainDraft("");
                            setMainAttachments([]);
                            setPendingRollback(undefined);
                          }
                        };
                        void submit();
                      }
                    }}
                    onStop={() => props.ctx.runtime.cancel?.()}
                  />
                </div>
              </div>
            </Show>

            <Show when={layoutMode() !== "tiny"}>
              <div class="neu-pane-divider" />
            </Show>

            <Show when={naviVisible()}>
              <div class="neu-pane">
                <div class="neu-pane-header">
                  <span class="neu-pane-title">Navi</span>
                  <span
                    class="neu-pane-status"
                    data-running={naviChatActivity()}
                  >
                    {naviChatActivity() ? "running" : "idle"}
                  </span>
                </div>
                <div class="neu-pane-content">
                  <Show
                    when={selectedSessionID() || state().sessionID || "none"}
                    keyed
                  >
                    <div class="chat-transcript-wrap">
                      <Transcript
                        messages={chatMessages()}
                        emptyTitle="向 Navi 提问"
                        emptyHint="Navi 用于规划和审查，不直接操作工作区。"
                        assistantName="Navi"
                        assistantInitial="V"
                        scrollRef={setChatTranscriptEl}
                        onScroll={handleChatTranscriptScroll}
                        loadAttachmentUrl={loadAttachmentUrl}
                      />
                      <Show when={chatShowJumpToBottom()}>
                        <button
                          type="button"
                          class="neu-jump-bottom"
                          onClick={jumpChatToBottom}
                          title="跳到底部"
                        >
                          ↓
                        </button>
                      </Show>
                    </div>
                  </Show>
                  <div
                    class="neu-activity-bar"
                    data-running={Boolean(naviChatActivity())}
                  >
                    <span class="neu-activity-pulse" />
                    <span class="neu-activity-label">
                      {naviChatActivity()
                        ? `${chatActivityLabel()} · ${formatDuration(chatElapsedMs())}`
                        : "idle"}
                    </span>
                  </div>
                  <div class="neu-main-toolbar">
                    <NeuSelect
                      value={chatProfile().normal?.modelID ?? ""}
                      options={modelOptions()}
                      onChange={(modelID) =>
                        void updateChatProfile({
                          ...chatProfile(),
                          normal: { ...chatProfile().normal, modelID },
                        })
                      }
                      placeholder="Chat 模型"
                      menuPosition="top"
                    />
                    <NeuSelect
                      value={chatProfile().normal?.reasoningEffort ?? "medium"}
                      options={[
                        { value: "minimal", label: "minimal" },
                        { value: "low", label: "low" },
                        { value: "medium", label: "medium" },
                        { value: "high", label: "high" },
                        { value: "xhigh", label: "xhigh" },
                      ]}
                      onChange={(effort) =>
                        void updateChatProfile({
                          ...chatProfile(),
                          normal: {
                            ...chatProfile().normal,
                            reasoningEffort: effort as
                              | "minimal"
                              | "low"
                              | "medium"
                              | "high"
                              | "xhigh",
                          },
                        })
                      }
                      placeholder="Chat 推理"
                      menuPosition="top"
                    />
                    <NeuSelect
                      value={chatProfile().expert?.modelID ?? ""}
                      options={modelOptions()}
                      onChange={(modelID) =>
                        void updateChatProfile({
                          ...chatProfile(),
                          expert: { ...chatProfile().expert, modelID },
                        })
                      }
                      placeholder="专家模型"
                      menuPosition="top"
                    />
                    <NeuSelect
                      value={chatProfile().expert?.reasoningEffort ?? "medium"}
                      options={[
                        { value: "minimal", label: "minimal" },
                        { value: "low", label: "low" },
                        { value: "medium", label: "medium" },
                        { value: "high", label: "high" },
                        { value: "xhigh", label: "xhigh" },
                      ]}
                      onChange={(effort) =>
                        void updateChatProfile({
                          ...chatProfile(),
                          expert: {
                            ...chatProfile().expert,
                            reasoningEffort: effort as
                              | "minimal"
                              | "low"
                              | "medium"
                              | "high"
                              | "xhigh",
                          },
                        })
                      }
                      placeholder="专家推理"
                      menuPosition="top"
                    />
                  </div>
                  <Composer
                    value={chatDraft()}
                    placeholder="向 Navi 提问…"
                    busy={Boolean(naviChatActivity())}
                    onInput={setChatDraft}
                    onStop={() => void props.ctx.runtime.chatAbort?.()}
                    attachments={chatAttachments()}
                    onRemoveAttachment={(path) =>
                      setChatAttachments(
                        chatAttachments().filter((item) => item.path !== path),
                      )
                    }
                    onPaste={(event) =>
                      handlePasteAttachments(
                        event,
                        chatAttachments(),
                        setChatAttachments,
                      )
                    }
                    onSubmit={() => {
                      const text = chatDraft();
                      if (text.trim() || chatAttachments().length) {
                        console.log("[navi-ui] submitting chat", {
                          text,
                          attachments: chatAttachments().map(
                            (item) => item.path,
                          ),
                        });
                        const result = props.ctx.runtime.chatSubmit?.({
                          text,
                          ...(chatAttachments().length
                            ? {
                                attachments: chatAttachments().map(
                                  (item) => item.path,
                                ),
                              }
                            : {}),
                        });
                        if (result && typeof result.then === "function") {
                          void result
                            .then((value) =>
                              console.log(
                                "[navi-ui] chatSubmit resolved",
                                value,
                              ),
                            )
                            .catch((cause) =>
                              console.error(
                                "[navi-ui] chatSubmit failed",
                                cause instanceof Error
                                  ? cause.message
                                  : String(cause),
                              ),
                            );
                        }
                        setChatDraft("");
                        setChatAttachments([]);
                      }
                    }}
                  />
                </div>
              </div>
            </Show>
          </div>
        </section>

        {/* Right secondary tabs */}
        {rightVisible() ? (
          <>
            <div
              class="neu-right-resizer"
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startRightResize}
            />
            <aside class="neu-secondary" style={{ width: `${rightWidth()}px` }}>
              <div class="neu-secondary-tabs">
                <For each={rightTabs()}>
                  {(tab) => (
                    <button
                      type="button"
                      class="neu-secondary-tab"
                      data-active={rightTab() === tab.id}
                      onClick={() => setRightTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  )}
                </For>
              </div>
              <div class="neu-secondary-content">
                <Show when={rightTab() === "diff"}>
                  <ReviewPane
                    runtime={props.ctx.runtime}
                    requestedTab={reviewRequestedTab()}
                    requestedCheckpointID={reviewRequestedCheckpointID()}
                    sessionID={selectedSessionID() || state().sessionID}
                  />
                </Show>
                <Show when={rightTab() === "plan"}>
                  <PlanPanel state={state()} runtime={props.ctx.runtime} />
                </Show>
                <Show
                  when={
                    rightTab() === "nia"
                      ? selectedSessionID() || state().sessionID || "none"
                      : false
                  }
                  keyed
                >
                  <NiaPanel
                    state={state()}
                    runtime={props.ctx.runtime}
                    catalog={modelCatalog()}
                    sessionID={selectedSessionID() || state().sessionID}
                  />
                </Show>
                <Show when={rightTab() === "todo" && todoPanel()}>
                  <div
                    class="neu-todo-host"
                    style="height:100%;"
                    ref={(element) => {
                      if (element) mountTodoPanel(element);
                    }}
                  />
                </Show>
                <Show when={rightTab() === "agent"}>
                  <AgentPanel
                    state={state()}
                    runtime={props.ctx.runtime}
                    onOpenTerminal={() => setRightTab("terminal")}
                  />
                </Show>
                <Show when={rightTab() === "terminal" && terminalPanel()}>
                  <div
                    class="neu-terminal-host"
                    style="height:100%;"
                    ref={(element) => {
                      if (element) mountTerminalPanel(element);
                    }}
                  />
                </Show>
                <Show when={rightTab() === "files" && filePanel()}>
                  <div
                    class="neu-file-editor-host"
                    ref={(element) => {
                      if (element) mountFilePanel(element);
                    }}
                  />
                </Show>
              </div>
            </aside>
          </>
        ) : (
          <button
            type="button"
            class="neu-collapsed-rail neu-right-rail"
            onClick={() => setRightVisible(true)}
            title="展开右侧栏（Ctrl+J）"
          >
            <span class="neu-rail-dots" />
          </button>
        )}
      </div>
      <PermissionPanel
        open={permissionOpen()}
        approval={currentApproval()}
        runtime={props.ctx.runtime}
        onClose={() => {
          setPermissionOpen(false);
          setCurrentApproval(null);
        }}
      />
      <QuestionPanel
        open={questionOpen()}
        request={currentQuestion()}
        runtime={props.ctx.runtime}
        onClose={() => {
          setQuestionOpen(false);
          setCurrentQuestion(null);
        }}
      />
      <WorkspaceSettingsPanel
        open={workspaceSettingsOpen()}
        workspaceID={
          workspaces().find((entry) => entry.status === "active")?.workspaceID
        }
        runtime={props.ctx.runtime}
        onClose={() => setWorkspaceSettingsOpen(false)}
      />
      <WorkspacePanel
        open={workspaceOpen()}
        onClose={() => setWorkspaceOpen(false)}
        error={workspaceError()}
        workspaces={workspaces()}
        onAdd={async (path) => {
          setWorkspaceError("");
          try {
            if (!path) return;
            if (!props.ctx.runtime.workspaceAdd) {
              setWorkspaceError(
                "当前 runtime 不支持 workspaceAdd，请确认连接的是 Natalia runtime serve",
              );
              throw new Error("workspaceAdd unsupported");
            }
            const workspace = (await props.ctx.runtime.workspaceAdd({
              path,
            })) as WorkspaceSummary;
            if (!workspace)
              throw new Error("workspaceAdd returned no workspace");
            if (workspace.status !== "active") {
              await props.ctx.runtime.workspaceActivate?.(
                workspace.workspaceID,
              );
            }
            await refreshWorkspaces();
            await refreshSessions();
          } catch (error: unknown) {
            setWorkspaceError(
              error instanceof Error ? error.message : String(error),
            );
            throw error;
          }
        }}
        onActivate={async (workspaceID) => {
          try {
            await props.ctx.runtime.workspaceActivate?.(workspaceID);
            await refreshWorkspaces();
            await refreshSessions();
          } catch (error: unknown) {
            setWorkspaceError(
              error instanceof Error ? error.message : String(error),
            );
          }
        }}
        onRemove={(workspaceID) => removeWorkspace(workspaceID)}
      />
      <SessionActionsPanel
        open={sessionMenuOpen()}
        session={selectedSession()}
        onClose={() => setSessionMenuOpen(false)}
        onPin={async () => {
          if (!selectedSessionID()) return;
          const target = sessionList().find(
            (entry) => entry.id === selectedSessionID(),
          );
          await props.ctx.runtime.sessionPin?.(
            selectedSessionID(),
            !target?.pinned,
          );
          await refreshSessions();
        }}
        onSnapshot={() => props.ctx.runtime.snapshot()}
        onRollback={() =>
          props.ctx.runtime.checkpointRollback?.({
            id: state().checkpoints[state().checkpoints.length - 1]?.id ?? "",
          })
        }
        onDelete={() => physicallyDeleteSelectedSession()}
      />
      <GovernancePanel
        open={governanceOpen()}
        onClose={() => setGovernanceOpen(false)}
        state={state()}
        runtime={props.ctx.runtime}
      />
      <SandboxPanel
        open={sandboxOpen()}
        onClose={() => setSandboxOpen(false)}
        sandboxes={state().sandboxes}
        runtime={props.ctx.runtime}
      />
      <StashPanel open={stashOpen()} onClose={() => setStashOpen(false)} />
      <HelpPanel open={helpOpen()} onClose={() => setHelpOpen(false)} />
      <SearchPanel
        open={searchOpen()}
        onClose={() => setSearchOpen(false)}
        onSearch={(query) =>
          props.ctx.runtime.workspaceSearch?.({
            query,
            limit: 50,
          })
        }
      />
      <ModelPanel
        open={modelOpen()}
        onClose={() => setModelOpen(false)}
        catalog={modelCatalog()}
        selection={modelSelectionSignal() ?? undefined}
        providers={config()?.providers}
        config={config()}
        onSetDefault={(modelID) => props.ctx.runtime.selectModel?.(modelID)}
        onAddProvider={async (input) => {
          if (!props.ctx.runtime.providerAdd) {
            throw new Error("providerAdd runtime method unavailable");
          }
          const result = await props.ctx.runtime.providerAdd(input);
          if (!result.saved)
            throw new Error("providerAdd did not save provider");
          await refreshModelConfig();
        }}
        onDiscoverModels={async (input) => {
          if (!props.ctx.runtime.providerDiscover) {
            throw new Error("providerDiscover runtime method unavailable");
          }
          return await props.ctx.runtime.providerDiscover(input);
        }}
        onRemoveProvider={async (name) => {
          if (!props.ctx.runtime.providerRemove) {
            throw new Error("providerRemove runtime method unavailable");
          }
          const result = await props.ctx.runtime.providerRemove(name);
          if (result.removed) await refreshModelConfig();
          return result;
        }}
      />
      <StatusPanel
        open={statusOpen()}
        onClose={() => setStatusOpen(false)}
        state={state()}
        runtime={props.ctx.runtime}
      />
      <PluginManagerPanel
        open={pluginManagerOpen()}
        onClose={() => setPluginManagerOpen(false)}
        ctx={props.ctx}
      />
      <SettingsPanel
        host={props.ctx.host}
        open={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
        onOpenModels={() => {
          setModelOpen(true);
          setSettingsOpen(false);
        }}
        themeMode={themeMode()}
        onCycleThemeMode={cycleThemeMode}
        state={state()}
        config={config()}
        preferences={props.ctx.preferences}
        registeredTools={registeredTools()}
        runtime={props.ctx.runtime}
        onUpdateConfig={async (patch) => {
          await props.ctx.runtime.updateConfig?.({
            patch,
            scope: "global",
          });
          const next = await props.ctx.runtime.configGet?.();
          if (next) setConfig(next);
        }}
      />
    </div>
  );
}
