import type { UiPluginContext } from "@natalia/ui-host";
import { selectPrimaryActivity } from "@natalia/view-store";
import type { RuntimeEvent, RuntimeModelCatalogEntry, RuntimeModelSelection, RuntimeSessionSummary, RuntimeSkillCatalogEntry, ChatModelProfile, ConfigV3, RuntimeClient, WorkspaceSummary } from "@natalia/contracts";
import { cloneState } from "@natalia/view-store";
import { createSignal, createEffect, createMemo, onCleanup, onMount, For, Show } from "solid-js";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import {
  ReviewPane,
  TerminalPane,
  BrowserPane,
} from "./components/RightPanel";
import { SettingsPanel } from "./settings-panel";
import { PluginManagerPanel } from "./plugin-manager-panel";
import { applyNeuTheme, NEU_THEME_MODES } from "./styles";
import { SessionActionsPanel } from "./session-actions-panel";
import { AgentPanel } from "./agent-panel";
import { BrowserPanel } from "./browser-panel";
import { TodoPanel } from "./todo-panel";
import { WorkspacePanel } from "./workspace-panel";
import { WorkspaceSettingsPanel } from "./workspace-settings-panel";
import { NeuSelect } from "./components/NeuSelect";
import { PermissionPanel } from "./permission-panel";
import { QuestionPanel } from "./components/QuestionPanel";
import { StatusPanel } from "./status-panel";
import { SearchPanel } from "./search-panel";
import { HelpPanel } from "./help-panel";
import { StashPanel } from "./stash-panel";
import { FlowTaskPanel } from "./flow-task-panel";
import { SandboxPanel } from "./sandbox-panel";
import { GovernancePanel } from "./governance-panel";
import { ModelPanel } from "./model-panel";
import type { Message } from "./types";

type RightTab = "diff" | "terminal" | "files" | "browser" | "agent" | "todo";

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 360;
const MIN_RIGHT_WIDTH = 440;
const MAX_RIGHT_WIDTH = 560;

function rightPanelMaxWidth(): number {
  if (typeof window === "undefined") return MAX_RIGHT_WIDTH;
  // On small/compact layouts the right panel is the most space-hungry
  // surface (terminal/browser/diff), so allow it to take up to 2/3 width.
  return Math.max(MIN_RIGHT_WIDTH, Math.floor(window.innerWidth * 2 / 3));
}

function StatusDot(props: { status: string }) {
  return <span class="neu-status-dot" data-status={props.status} title={props.status} />;
}

function TreeRow(props: {
  label: string;
  selected?: boolean;
  status?: string;
  badge?: string;
  depth?: number;
  onClick?: () => void;
  onEdit?: () => void;
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
      onClick={props.onClick}
    >
      {props.status ? <StatusDot status={props.status} /> : null}
      <Show
        when={props.editValue !== undefined}
        fallback={
          <>
            <span class="neu-tree-label">{props.label}</span>
            {props.badge ? <span class="neu-badge">{props.badge}</span> : null}
            <Show when={props.onEdit}>
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
}) {
  const [editingID, setEditingID] = createSignal<string | null>(null);
  const [draftName, setDraftName] = createSignal("");
  const groups = createMemo(() => {
    const byWorkspace = new Map<string, RuntimeSessionSummary[]>();
    const activeID = props.workspaces.find((workspace) => workspace.status === "active")?.workspaceID;
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
      sessions: (byWorkspace.get(workspace.workspaceID) ?? []).map((session) => ({
        id: session.id,
        name: session.title,
        status: session.status ?? (session.cancelled ? "error" : session.resumable ? "idle" : "running"),
        archived: Boolean(session.archived),
      })),
    }));
  });

  return (
    <div class="neu-tree">
      <div class="neu-tree-title">工作区 ({props.workspaces.length})</div>
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
                  onEdit={() => {
                    setEditingID(session.id);
                    setDraftName(session.name);
                  }}
                  editValue={editingID() === session.id ? draftName() : undefined}
                  onEditChange={setDraftName}
                  onEditCommit={() => {
                    const title = draftName().trim();
                    if (editingID() === session.id && title && title !== session.name) {
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
  const [state, setState] = createSignal(
    cloneState(props.ctx.projection.getState()),
  );
  const [rightTab, setRightTab] = createSignal<RightTab>("diff");
  const [leftWidth, setLeftWidth] = createSignal(240);
  const [rightWidth, setRightWidth] = createSignal(
    typeof window === "undefined"
      ? 440
      : Math.max(MIN_RIGHT_WIDTH, Math.floor(window.innerWidth / 3)),
  );
  const [leftVisible, setLeftVisible] = createSignal(true);
  const [rightVisible, setRightVisible] = createSignal(true);
  const [layoutMode, setLayoutMode] = createSignal<"wide" | "compact" | "tiny">("wide");
  const [naviOpen, setNaviOpen] = createSignal(true);
  const [mainDraft, setMainDraft] = createSignal("");
  const [chatDraft, setChatDraft] = createSignal("");
  const [selectedSession, setSelectedSession] = createSignal("");
  const [selectedSessionID, setSelectedSessionID] = createSignal("");
  const [sessionList, setSessionList] = createSignal<RuntimeSessionSummary[]>([]);
  const [workspaces, setWorkspaces] = createSignal<WorkspaceSummary[]>([]);
  const [registeredTools, setRegisteredTools] = createSignal<string[]>([]);
  const [skillCatalog, setSkillCatalog] = createSignal<RuntimeSkillCatalogEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [pluginManagerOpen, setPluginManagerOpen] = createSignal(false);
  const [themeMode, setThemeMode] = createSignal(
    props.ctx.preferences.get<string>("themeMode") ?? "light",
  );
  const [sessionMenuOpen, setSessionMenuOpen] = createSignal(false);
  const [showArchived, setShowArchived] = createSignal(false);
  const [workspaceOpen, setWorkspaceOpen] = createSignal(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = createSignal(false);
  const [workspaceError, setWorkspaceError] = createSignal<string>("");
  const [reviewRequestedTab, setReviewRequestedTab] = createSignal<"git" | "sandbox" | "checkpoint">("git");
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
  const [currentApproval, setCurrentApproval] = createSignal<Extract<RuntimeEvent, { type: "approval.request" }> | null>(null);
  const [currentQuestion, setCurrentQuestion] = createSignal<Extract<RuntimeEvent, { type: "question.request" }> | null>(null);
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
  const [activeTurnStartedAtValue, setActiveTurnStartedAt] = activeTurnStartedAt;
  const [modelOpen, setModelOpen] = createSignal(false);
  const [modelCatalog, setModelCatalog] = createSignal<RuntimeModelCatalogEntry[]>([]);
  const [config, setConfig] = createSignal<ConfigV3 | undefined>(undefined);
  const [reasoningEffort, setReasoningEffortSignal] = createSignal<string>("medium");
  const [chatProfile, setChatProfile] = createSignal<ChatModelProfile>({});
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [stashOpen, setStashOpen] = createSignal(false);
  const [flowTaskOpen, setFlowTaskOpen] = createSignal(false);
  const [sandboxOpen, setSandboxOpen] = createSignal(false);
  const [governanceOpen, setGovernanceOpen] = createSignal(false);

  let projectionFramePending = false;
  onCleanup(
    props.ctx.projection.subscribe((next) => {
      const replaying = (globalThis as unknown as {
        __nataliaReplayingHistory?: boolean;
      }).__nataliaReplayingHistory;
      // During a full history replay the projection emits one event at a time.
      // Cloning the whole AppState after every raw event is O(n^2) for long
      // sessions, so skip the heavy clones until the replay completes and then
      // take one final snapshot in openUnresolvedInteractives.
      if (replaying) return;
      // Live events stream as many small deltas per second. Clone the
      // projection at most once per animation frame and let Solid paint one
      // batched frame instead of one clone/update per raw event.
      if (projectionFramePending) return;
      projectionFramePending = true;
      requestAnimationFrame(() => {
        projectionFramePending = false;
        const projected = cloneState(props.ctx.projection.getState());
        setState(projected);
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
      });
    }),
  );

  async function refreshWorkspaces() {
    if (workspacesRefreshInFlight) return workspacesRefreshInFlight;
    workspacesRefreshInFlight = (async () => {
      const roots = await props.ctx.runtime.workspaceRoots?.();
      if (roots) setWorkspaces(roots);
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
    timings[phase] = performance.now() - global.__nataliaStartupStart;
  }

  function debouncedRefreshWorkspaces(delay = 150) {
    if (workspacesRefreshTimer) clearTimeout(workspacesRefreshTimer);
    workspacesRefreshTimer = setTimeout(() => {
      workspacesRefreshTimer = undefined;
      void refreshWorkspaces();
    }, delay);
  }

  function sessionRecency(session: RuntimeSessionSummary) {
    return new Date(session.lastAccessedAt ?? session.createdAt).getTime();
  }

  function debouncedRefreshSessions(delay = 150) {
    if (sessionsRefreshTimer) clearTimeout(sessionsRefreshTimer);
    sessionsRefreshTimer = setTimeout(() => {
      sessionsRefreshTimer = undefined;
      void refreshSessions();
    }, delay);
  }

  async function refreshSessions() {
    if (sessionsRefreshInFlight) return sessionsRefreshInFlight;
    const token = ++sessionsRefreshToken;
    let operation: Promise<void>;
    operation = (async () => {
      try {
        const sessions = await props.ctx.runtime.sessionList?.();
        if (token !== sessionsRefreshToken) return;
        if (sessions) {
          setSessionList(sessions);
          if (!userSelectedSession && sessions.length) {
            const active = state().sessionID;
            const target = active
              ? sessions.find((session) => session.id === active && !session.archived)
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
              const fallback = recent[0] ?? sessions[0];
              if (fallback) {
                setSelectedSessionID(fallback.id);
                setSelectedSession(fallback.title);
              }
            }
          }
        }
      } finally {
        if (sessionsRefreshInFlight === operation) {
          sessionsRefreshInFlight = undefined;
        }
      }
    })();
    sessionsRefreshInFlight = operation;
    return operation;
  }

  const visibleSessions = (): RuntimeSessionSummary[] =>
    sessionList().filter((session) =>
      showArchived() ? Boolean(session.archived) : !session.archived,
    );

  async function createSession() {
    await props.ctx.runtime.sessionNew?.();
    await refreshSessions();
  }

  async function removeWorkspace(workspaceID: string) {
    try {
      await props.ctx.runtime.workspaceRemove?.(workspaceID);
      await refreshWorkspaces();
      await refreshSessions();
    } catch (error: unknown) {
      setWorkspaceError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  function selectedSessionIsActive() {
    return Boolean(
      selectedSessionID() && selectedSessionID() === state().sessionID,
    );
  }

  async function removeSelectedSession() {
    const targetID = selectedSessionID();
    if (!targetID) return;
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
        `移除会话失败：${error instanceof Error ? error.message : String(error)}`,
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

  async function physicallyDeleteSelectedSession() {
    const targetID = selectedSessionID();
    if (!targetID) return;
    if (!window.confirm(`确定要彻底删除会话“${selectedSession()}”吗？这会删除会话记录和附件，无法恢复。`)) {
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

  onMount(() => {
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
        const replaying = (globalThis as unknown as {
          __nataliaReplayingHistory?: boolean;
        }).__nataliaReplayingHistory;
        if (replaying) return;
        const currentSession = selectedSessionID() || state().sessionID;
        if (
          currentSession &&
          event.sessionID &&
          event.sessionID !== currentSession
        )
          return;
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
        if (event.type === "chat.message.added" && event.role === "user") {
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
      setCurrentApproval(null);
      setPermissionOpen(false);
      setCurrentQuestion(null);
      setQuestionOpen(false);
      props.ctx.projection.reset?.();
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
      if (state().chatActivity?.startedAt)
        setChatElapsedMs(Date.now() - state().chatActivity!.startedAt);
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

    const hydrateRecentMessages = async () => {
      // Message-first startup: the latest projected page replaces the old
      // full-log replay. The page is newest-last on the wire; reverse it so the
      // projection's older-merge keeps transcript order.
      const page = await props.ctx.runtime.messages?.({ limit: 100 });
      if (!page?.data.length) return;
      props.ctx.projection.hydrateMessages?.(
        [...page.data].reverse(),
        "older",
      );
      historyCursor = page.cursor.next;
      newerHistoryCursor = undefined;
      markStartup("main.messages");
      // Chat and subagents are secondary surfaces. Hydrate them in the
      // background so the primary transcript paints first and does not wait
      // for extra RPCs before the first visible frame.
      const loadToken = (globalThis as unknown as {
        __nataliaSessionLoadToken?: number;
      }).__nataliaSessionLoadToken;
      void (async () => {
        const chat = await props.ctx.runtime.chatMessages?.();
        if (
          chat &&
          loadToken ===
            (globalThis as unknown as { __nataliaSessionLoadToken?: number })
              .__nataliaSessionLoadToken
        )
          props.ctx.projection.hydrateChatMessages?.(chat);
        const subagents = await props.ctx.runtime.subagents?.();
        if (
          subagents &&
          loadToken ===
            (globalThis as unknown as { __nataliaSessionLoadToken?: number })
              .__nataliaSessionLoadToken
        )
          props.ctx.projection.hydrateSubagents?.(subagents);
        markStartup("secondary.loaded");
        const timings = (
          globalThis as unknown as {
            __nataliaStartupTimings?: Record<string, number>;
          }
        ).__nataliaStartupTimings;
        if (timings) {
          console.warn("[startup] complete", timings);
          console.table(timings);
        }
      })();
    };

    const openUnresolvedInteractives = (event: Event) => {
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
        await refreshSessions();
        if (isStaleLoad()) return;
        await hydrateRecentMessages();
        if (isStaleLoad()) return;
        // Session loading finished; take one projection snapshot instead of
        // cloning once per raw event.
        const projected = cloneState(props.ctx.projection.getState());
        setState(projected);
        if (projected.workspaces.length) setWorkspaces(projected.workspaces);
        markStartup("first.paint");
        logStartupSummary();
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

    void props.ctx.runtime.modelCatalog?.().then((catalog) => setModelCatalog(catalog));
    void props.ctx.runtime.reasoningEffort?.().then((effort) => {
      if (effort) setReasoningEffortSignal(effort);
    });
    void props.ctx.runtime.chatModelProfile?.().then((profile) => {
      if (profile) setChatProfile(profile);
    });
    void props.ctx.runtime.registeredTools?.().then((tools) => {
      if (tools) setRegisteredTools(tools.map((tool) => tool.name));
    });
    void props.ctx.runtime.skills?.().then((skills) => {
      if (skills) setSkillCatalog(skills);
    });
    // DSH-style resize follow: while a pane is pinned to the bottom, any
    // height change (streaming growth, tool expansion, image load) re-snaps
    // it to the true floor instead of waiting for another content event.
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
    const transcriptContent =
      transcriptEl()?.querySelector<HTMLElement>(".natalia-transcript-content");
    const chatContent =
      chatTranscriptEl()?.querySelector<HTMLElement>(".natalia-transcript-content");
    // Content growth (streaming, tool cards, images) re-pins via the content
    // node; viewport/window size changes re-pin via the scrollport itself.
    if (transcriptContent) followObserver?.observe(transcriptContent);
    if (chatContent) followObserver?.observe(chatContent);
    if (transcriptEl()) followObserver?.observe(transcriptEl());
    if (chatTranscriptEl()) followObserver?.observe(chatTranscriptEl());
    onCleanup(() => followObserver?.disconnect());

    void refreshSessions();
    void refreshWorkspaces();
    void props.ctx.runtime.configGet?.().then((nextConfig) => setConfig(nextConfig));
    void props.ctx.runtime.plugins?.().then((plugins) => {
      setInteractiveTerminalAvailable(
        plugins.some((plugin) => plugin.id === "natalia-tool-terminal"),
      );
    }).catch(() => setInteractiveTerminalAvailable(false));
  });


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
    await props.ctx.runtime.setChatModelProfile?.(next);
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
              Array.isArray(answer)
                ? answer.map(String)
                : [String(answer)],
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
      if (
        rect.bottom > containerRect.top &&
        rect.top < containerRect.bottom
      ) {
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
    el.scrollTop = el.scrollTop + (rowRect.top - containerRect.top) - anchor.top;
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
    if (!newerHistoryCursor || loadingNewerHistory || !historyReplayDone) return;
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
    const activity = state().chatActivity;
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
    return state().activeTurn ? "Working" : "Ready";
  }

  const mainMessages = createMemo<Message[]>(() =>
    (state().messages ?? []).map((msg, idx) => {
      if (msg.tool) {
        return {
          id: msg.id,
          role: "assistant",
          content: "",
          status:
            state().activeTurn && idx === (state().messages?.length ?? 0) - 1
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
        content: msg.text + (msg.pendingText || ""),
        status:
          state().activeTurn && idx === (state().messages?.length ?? 0) - 1
            ? "running"
            : undefined,
        streaming: Boolean(
          state().activeTurn &&
            idx === (state().messages?.length ?? 0) - 1 &&
            msg.role !== "user" &&
            (msg.pendingText ?? "").length > 0,
        ),
      };
    }),
  );

  const chatMessages = createMemo<Message[]>(() =>
    (state().chatMessages ?? []).map((msg, idx) => {
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
          state().chatActivity &&
            idx === state().chatMessages.length - 1 &&
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
        Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + next.clientX - startX)),
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

  const filePanel = () => {
    panelRevision();
    return props.ctx.host
      ?.listPanels()
      .find((item) => item.panel.id === "files");
  };

  const terminalPanel = () => {
    panelRevision();
    return interactiveTerminalAvailable() && props.ctx.host
      ?.listPanels()
      .find((item) => item.panel.id === "terminal");
  };

  const browserPanel = () => {
    panelRevision();
    return props.ctx.host
      ?.listPanels()
      .find((item) => item.panel.id === "browser");
  };

  const rightTabs = () => {
    panelRevision();
    const tabs: { id: RightTab; label: string }[] = [
      { id: "diff", label: "审阅 / Diff" },
      { id: "todo", label: "待办" },
      { id: "agent", label: "协同" },
      ...(terminalPanel() ? [{ id: "terminal" as RightTab, label: "终端" }] : []),
      ...(filePanel() ? [{ id: "files" as RightTab, label: "文件" }] : []),
      ...(browserPanel() ? [{ id: "browser" as RightTab, label: "浏览器" }] : []),
    ];
    return tabs;
  };
  function mountFilePanel(container: HTMLDivElement) {
    const panel = filePanel();
    if (!panel || !props.ctx.host) return;
    void props.ctx.host.mountPanel(panel.pluginId, panel.panel.id, container);
  }

  onMount(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const screenWidth = window.screen?.availWidth || window.screen?.width || width;
      const screenHeight = window.screen?.availHeight || window.screen?.height || height;
      const area = width * height;
      const quarterArea = screenWidth * screenHeight * 0.25;
      const tiny =
        width <= 1000 ||
        height <= screenHeight * 0.5 ||
        area <= quarterArea;
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
    (layoutMode() === "tiny" && naviOpen() && !leftVisible() && !rightVisible());

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
      data-right-open={rightVisible()}
    >
      <header class="neu-topbar">
        <div class="neu-topbar-left">
          <span class="neu-topbar-logo">N</span>
          <div class="neu-topbar-meta">
            <span class="neu-topbar-title">Natalia</span>
            <span class="neu-topbar-sub">natalia-cli</span>
          </div>
        </div>
        <div class="neu-topbar-right">
          <button
            type="button"
            class="neu-topbar-btn"
            data-active={leftVisible()}
            onClick={() => setLeftVisible((value) => !value)}
          >
            左栏
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            data-active={rightVisible()}
            onClick={() => setRightVisible((value) => !value)}
          >
            右栏
          </button>
          <Show when={layoutMode() === "tiny"}>
            <button
              type="button"
              class="neu-topbar-btn"
              data-active={naviOpen()}
              onClick={() => setNaviOpen((value) => !value)}
            >
              Navi
            </button>
          </Show>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setSearchOpen(true)}
          >
            搜索
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setStatusOpen(true)}
          >
            状态
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setHelpOpen(true)}
          >
            帮助
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setStashOpen(true)}
          >
            暂存
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setFlowTaskOpen(true)}
          >
            任务
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setSandboxOpen(true)}
          >
            沙箱
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setGovernanceOpen(true)}
          >
            治理
          </button>
          <button
            type="button"
            class="neu-topbar-btn"
            onClick={() => setPluginManagerOpen(true)}
          >
            插件
          </button>
          <button
            type="button"
            class="neu-topbar-btn neu-topbar-btn-primary"
            onClick={() => setSettingsOpen(true)}
          >
            设置
          </button>
        </div>
      </header>
      <div class="neu-app">
      {/* Left session tree */}
      {leftVisible() ? (
        <>
          <aside class="neu-sidebar" style={{ width: `${leftWidth()}px` }}>
            <div class="neu-sidebar-title">会话管理</div>
            <div class="neu-session-toolbar">
              <span class="neu-session-toolbar-label">操作</span>
              <button
                type="button"
                class="neu-session-toolbar-btn"
                onClick={() => setSessionMenuOpen(true)}
              >
                会话
              </button>
              <button
                type="button"
                class="neu-session-toolbar-btn"
                disabled={showArchived()}
                onClick={() => void createSession()}
              >
                新建
              </button>
              <button
                type="button"
                class="neu-session-toolbar-btn"
                disabled={!selectedSessionID() || showArchived()}
                onClick={() => void removeSelectedSession()}
              >
                移除
              </button>
              <button
                type="button"
                class="neu-session-toolbar-btn"
                data-active={showArchived()}
                onClick={() => setShowArchived((value) => !value)}
              >
                归档
              </button>
              <button
                type="button"
                class="neu-session-toolbar-btn"
                onClick={() => setWorkspaceOpen(true)}
              >
                工作区
              </button>
              <button
                type="button"
                class="neu-session-toolbar-btn"
                onClick={() => setWorkspaceSettingsOpen(true)}
              >
                设置
              </button>
            </div>
            <div class="neu-sidebar-content">
              <SessionTree
                selected={selectedSessionID()}
                sessions={visibleSessions()}
                workspaces={workspaces()}
                onRename={(id, title) => {
                  void props.ctx.runtime.sessionRename?.(id, title).then(() => refreshSessions());
                }}
                onSelect={(id, name) => {
                  userSelectedSession = true;
                  setSelectedSessionID(id);
                  setSelectedSession(name);
                  void props.ctx.runtime
                    .sessionAttach?.(id)
                    .then(() => refreshSessions());
                }}
                onRemoveWorkspace={(workspaceID) => {
                  void removeWorkspace(workspaceID);
                }}
                onRestore={(sessionID) => {
                  void restoreSession(sessionID);
                }}
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
              <span class="neu-pane-status" data-running={state().activeTurn}>
                {state().activeTurn ? "running" : "idle"}
              </span>
            </div>
            <div class="neu-pane-content">
              <Show when={selectedSessionID() || state().sessionID || "none"} keyed>
              <Transcript
                messages={mainMessages()}
                emptyTitle="Natalia 已准备好"
                emptyHint="Natalia 会直接处理工作区任务。"
                assistantName="Natalia"
                assistantInitial="N"
                scrollRef={setTranscriptEl}
                onScroll={handleTranscriptScroll}
              />
              </Show>
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
              <div class="neu-activity-bar" data-running={state().activeTurn}>
                <span class="neu-activity-pulse" />
                <span class="neu-activity-label">
                  {state().activeTurn
                    ? `${activityLabel()} · ${formatDuration(turnElapsedMs())}`
                    : "idle"}
                </span>
              </div>
              <div class="neu-main-toolbar">
                <NeuSelect
                  value={state().modelSelection?.modelID ?? ""}
                  options={modelOptions()}
                  onChange={(modelID) => void props.ctx.runtime.selectModel?.(modelID)}
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
                    setReasoningEffortSignal(effort);
                    void props.ctx.runtime.setReasoningEffort?.(effort as "minimal" | "low" | "medium" | "high" | "xhigh");
                  }}
                  placeholder="推理强度"
                  menuPosition="top"
                />
                <NeuSelect
                  value={config()?.defaultAgentMode ?? "ask"}
                  options={permissionOptions()}
                  onChange={(permission) => void changePermission(permission)}
                  placeholder="选择权限"
                  menuPosition="top"
                />
              </div>
              <Composer
                value={mainDraft()}
                placeholder="输入消息，使用 @ 提及文件…"
                busy={Boolean(state().activeTurn)}
                onInput={setMainDraft}
                onSubmit={() => {
                  const text = mainDraft();
                  if (text.trim()) {
                    console.log("[web-plugin] send", text);
                    props.ctx.runtime.submit?.(text);
                    setMainDraft("");
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
              <span class="neu-pane-status" data-running={state().chatActivity}>
                {state().chatActivity ? "running" : "idle"}
              </span>
            </div>
            <div class="neu-pane-content">
              <Show when={selectedSessionID() || state().sessionID || "none"} keyed>
              <Transcript
                messages={chatMessages()}
                emptyTitle="向 Navi 提问"
                emptyHint="Navi 用于规划和审查，不直接操作工作区。"
                assistantName="Navi"
                assistantInitial="V"
                scrollRef={setChatTranscriptEl}
                onScroll={handleChatTranscriptScroll}
              />
              </Show>
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
              <div class="neu-activity-bar" data-running={Boolean(state().chatActivity)}>
                <span class="neu-activity-pulse" />
                <span class="neu-activity-label">
                  {state().chatActivity
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
                        reasoningEffort: effort as "minimal" | "low" | "medium" | "high" | "xhigh",
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
                        reasoningEffort: effort as "minimal" | "low" | "medium" | "high" | "xhigh",
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
                busy={Boolean(state().chatActivity)}
                onInput={setChatDraft}
                onSubmit={() => {
                  const text = chatDraft();
                  if (text.trim()) {
                    props.ctx.runtime.chatSubmit?.({ text });
                    setChatDraft("");
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
                <ReviewPane runtime={props.ctx.runtime} requestedTab={reviewRequestedTab()} />
              </Show>
              <Show when={rightTab() === "todo"}>
                <TodoPanel state={state()} />
              </Show>
              <Show when={rightTab() === "agent"}>
                <AgentPanel
                  state={state()}
                  runtime={props.ctx.runtime}
                  onOpenTerminal={() => setRightTab("terminal")}
                />
              </Show>
              <Show when={rightTab() === "terminal" && terminalPanel()}>
                <TerminalPane
                  runtime={props.ctx.runtime}
                  sessionID={selectedSessionID()}
                  runtimeURL={
                    (props.ctx.extra as { runtimeURL?: string } | undefined)
                      ?.runtimeURL
                  }
                  active={rightTab() === "terminal"}
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
              <Show when={rightTab() === "browser" && browserPanel()}>
                <BrowserPanel state={state()} />
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
        workspaceID={workspaces().find((entry) => entry.status === "active")?.workspaceID}
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
              setWorkspaceError("当前 runtime 不支持 workspaceAdd，请确认连接的是 Natalia runtime serve");
              throw new Error("workspaceAdd unsupported");
            }
            const workspace = (await props.ctx.runtime.workspaceAdd({ path })) as WorkspaceSummary;
            if (!workspace) throw new Error("workspaceAdd returned no workspace");
            if (workspace.status !== "active") {
              await props.ctx.runtime.workspaceActivate?.(workspace.workspaceID);
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
        onNew={async () => {
          await props.ctx.runtime.sessionNew?.();
          await refreshSessions();
        }}
        onFork={() =>
          props.ctx.runtime.sessionDuplicate?.(
            selectedSessionID() || state().sessionID || "current",
            `Fork of ${selectedSession()}`,
          )
        }
        onRename={async () => {
          if (!selectedSessionID()) return;
          const title = window.prompt("新标题", selectedSession());
          if (!title) return;
          await props.ctx.runtime.sessionRename?.(selectedSessionID(), title);
          await refreshSessions();
        }}
        onPin={async () => {
          if (!selectedSessionID()) return;
          const target = sessionList().find((entry) => entry.id === selectedSessionID());
          await props.ctx.runtime.sessionPin?.(selectedSessionID(), !target?.pinned);
          await refreshSessions();
        }}
        onAttach={async () => {
          if (!selectedSessionID()) return;
          userSelectedSession = true;
          await props.ctx.runtime.sessionAttach?.(selectedSessionID());
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
      <GovernancePanel open={governanceOpen()} onClose={() => setGovernanceOpen(false)} state={state()} runtime={props.ctx.runtime} />
      <SandboxPanel
        open={sandboxOpen()}
        onClose={() => setSandboxOpen(false)}
        sandboxes={state().sandboxes}
        runtime={props.ctx.runtime}
      />
      <FlowTaskPanel
        open={flowTaskOpen()}
        onClose={() => setFlowTaskOpen(false)}
        runtime={props.ctx.runtime}
        onSaveFlow={(flow) =>
          props.ctx.runtime.saveFlowDocument?.({
            path: `${flow.flowID}.yaml`,
            document: {
              kind: "natalia-flow",
              version: 1,
              flowID: flow.flowID,
              displayName: flow.displayName,
              modules: flow.modules.map((mod) => ({
                id: mod.id,
                type: mod.type as "read_search" | "terminal" | "shell_command" | "workspace_changes" | "web_fetch" | "skills" | "mcp" | "subagents" | "report_output",
                displayName: mod.displayName,
                enabled: mod.enabled,
                instructions: mod.instructions,
                minimumConditions: mod.minimumConditions.map((text) => ({ id: `cond_${mod.id}_${text}`, text })),
                idealConditions: mod.idealConditions.map((text) => ({ id: `ideal_${mod.id}_${text}`, text })),
                commandRules: {
                  mode: mod.commandMode,
                  rules: mod.commandRules.map((command) => ({ command })),
                },
              })),
            },
          })
        }
        onDeleteFlow={(flowID) =>
          props.ctx.runtime.deleteFlowDocument?.({ path: `${flowID}.yaml` })
        }
        onSaveTask={(task) =>
          props.ctx.runtime.saveTaskDocument?.({
            path: `${task.taskID}.yaml`,
            document: {
              kind: "natalia-task",
              version: 1,
              taskID: task.taskID,
              displayName: task.displayName,
              schedule: task.schedule,
              prompt: task.prompt,
              permissionProfile: task.permissionProfile,
              flow: { flowID: task.flowID },
              retry: task.retry as never,
              alerts: task.alerts,
            },
          })
        }
        onDeleteTask={(taskID) =>
          props.ctx.runtime.deleteTaskDocument?.({ path: `${taskID}.yaml` })
        }
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
        selection={state().modelSelection ?? undefined}
        providers={config()?.providers}
        config={config()}
        onSetDefault={(modelID) => props.ctx.runtime.selectModel?.(modelID)}
        onAddProvider={async (input) => {
          console.log("[provider-save] input", JSON.stringify(input, null, 2));
          const currentProviders = config()?.providers ?? {};
          const inferredPreviousName =
            input.previousName ||
            Object.keys(currentProviders).find(
              (key) =>
                key !== input.name &&
                currentProviders[key]?.name === input.label,
            ) ||
            Object.keys(currentProviders).find(
              (key) =>
                key !== input.name &&
                currentProviders[key]?.connection?.baseURL === input.baseURL &&
                currentProviders[key]?.connection?.apiKey === input.apiKey,
            );
          console.log("[provider-save] inferredPreviousName", inferredPreviousName);
          const providerPatch: Record<string, unknown> = {
            [input.name]: {
              name: input.label || input.name,
              driver: input.type,
              enabled: true,
              connection: {
                baseURL: input.baseURL || undefined,
                apiKey: input.apiKey,
              },
              requestDefaults: {
                headers: input.headers ?? {},
              },
            },
            ...(inferredPreviousName ? { [inferredPreviousName]: undefined } : {}),
          };
          const modelsPatch = input.models?.length
            ? Object.fromEntries(
                input.models.map((model) => [
                  model.id,
                  {
                    name: model.name || model.id,
                    capabilities: {
                      reasoning: model.reasoning ?? false,
                      imageInput: model.image ?? false,
                    },
                    limits: {},
                    status: "stable",
                    source: "manual",
                  },
                ]),
              )
            : undefined;
          const patch = {
            providers: providerPatch,
            ...(modelsPatch
              ? {
                  catalog: {
                    providers: {
                      [input.name]: { models: modelsPatch },
                      ...(inferredPreviousName ? { [inferredPreviousName]: undefined } : {}),
                    },
                  },
                }
              : {}),
          } as never;
          console.log("[provider-save] patch", JSON.stringify(patch, null, 2));
          try {
            await props.ctx.runtime.updateConfig?.({ patch, scope: "global" });
            console.log("[provider-save] updateConfig ok");
          } catch (error) {
            console.error("[provider-save] updateConfig failed", error);
            throw error;
          }
          const [nextConfig, nextCatalog] = await Promise.all([
            props.ctx.runtime.configGet?.(),
            props.ctx.runtime.modelCatalog?.(),
          ]);
          if (nextConfig) {
            console.log("[provider-save] config providers", Object.keys(nextConfig.providers));
            setConfig(nextConfig);
          }
          if (nextCatalog) setModelCatalog(nextCatalog);
        }}
      />
      <StatusPanel open={statusOpen()} onClose={() => setStatusOpen(false)} state={state()} runtime={props.ctx.runtime} />
      <PluginManagerPanel
        open={pluginManagerOpen()}
        onClose={() => setPluginManagerOpen(false)}
        ctx={props.ctx}
      />
      <SettingsPanel
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
        skills={skillCatalog()}
        onUpdateConfig={async (patch) => {
          await props.ctx.runtime.updateConfig?.({
            patch,
            scope: "global",
          });
          const next = await props.ctx.runtime.configGet?.();
          if (next) setConfig(next);
        }}
        onAddMcp={(input) => props.ctx.runtime.mcpServerAdd?.(input)}
        onRemoveMcp={(name) => props.ctx.runtime.mcpServerRemove?.(name)}
      />
    </div>
  );
}
