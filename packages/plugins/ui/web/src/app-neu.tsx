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
  return Math.max(MIN_RIGHT_WIDTH, Math.floor(window.innerWidth / 3));
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
  let userSelectedSession = false;
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
      console.log("[web-plugin] projection update", {
        messages: next.messages.length,
        sessions: next.sessions.length,
        workspaces: next.workspaces.length,
      });
      const projected = cloneState(next);
      setState(projected);
      if (projected.workspaces.length) setWorkspaces(projected.workspaces);
      setTimeout(() => {
        if (followBottom() && transcriptEl()) {
          const el = transcriptEl()!;
          el.scrollTop = el.scrollHeight;
        }
        if (chatFollowBottom() && chatTranscriptEl()) {
          const el = chatTranscriptEl()!;
          el.scrollTop = el.scrollHeight;
        }
      }, 0);
      const currentTurn = projected.activeTurn;
      if (currentTurn && activeTurnStartedAtValue() === undefined) {
        setActiveTurnStartedAt(Date.now());
      } else if (!currentTurn && activeTurnStartedAtValue() !== undefined) {
        setActiveTurnStartedAt(undefined);
        setTurnElapsedMs(0);
      }
    }),
  );

  async function refreshWorkspaces() {
    const roots = await props.ctx.runtime.workspaceRoots?.();
    if (roots) setWorkspaces(roots);
  }

  async function refreshSessions() {
    const sessions = await props.ctx.runtime.sessionList?.();
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
          setSelectedSessionID(sessions[0].id);
          setSelectedSession(sessions[0].title);
        }
      }
    }
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
        if (event.type === "approval.request") {
          setCurrentApproval(event);
          setPermissionOpen(true);
        }
        if (event.type === "question.request") {
          setCurrentQuestion(event);
          setQuestionOpen(true);
        }
        if (
          event.type.startsWith("workspace.") ||
          event.type === "session.created" ||
          event.type === "session.ready"
        ) {
          void refreshWorkspaces();
          void refreshSessions();
        }
      }),
    );

    // After history replay completes, surface only still-unresolved
    // approvals/questions from the restored session. Resolved historical
    // requests are not re-opened because their response events clear them
    // from the view-store pending state during replay.
    const resetProjectionForSessionSwitch = () => {
      setFollowBottom(true);
      setShowJumpToBottom(false);
      setChatFollowBottom(true);
      setChatShowJumpToBottom(false);
      props.ctx.projection.reset?.();
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

    const openUnresolvedInteractives = () => {
      void (async () => {
        const replayGlobal = globalThis as unknown as {
          __nataliaReplayingHistory?: boolean;
        };
        // Defensive: even if a replay path failed to clear the flag, live
        // events after this point must be rendered normally.
        replayGlobal.__nataliaReplayingHistory = false;
        await refreshSessions();
        // History replay just finished; take one projection snapshot instead of
        // cloning once per replayed event.
        const projected = cloneState(props.ctx.projection.getState());
        setState(projected);
        if (projected.workspaces.length) setWorkspaces(projected.workspaces);
        const approvals = projected.pendingApprovals;
        if (approvals.length) {
          setCurrentApproval(approvals[0]);
          setPermissionOpen(true);
        }
        const questions = projected.pendingQuestions;
        if (questions.length) {
          setCurrentQuestion(questions[0]);
          setQuestionOpen(true);
        }
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

  function formatToolOutput(name: string, output: string): string {
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

  function handleTranscriptScroll() {
    const el = transcriptEl();
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setFollowBottom(nearBottom);
    setShowJumpToBottom(!nearBottom);
  }

  function jumpToBottom() {
    const el = transcriptEl();
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setFollowBottom(true);
    setShowJumpToBottom(false);
  }

  function handleChatTranscriptScroll() {
    const el = chatTranscriptEl();
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setChatFollowBottom(nearBottom);
    setChatShowJumpToBottom(!nearBottom);
  }

  function jumpChatToBottom() {
    const el = chatTranscriptEl();
    if (!el) return;
    el.scrollTop = el.scrollHeight;
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

  const mainMessages = (): Message[] =>
    (state().messages ?? []).map((msg, idx) => {
      if (msg.tool) {
        return {
          id: `msg-${idx}`,
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
        id: `msg-${idx}`,
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
    });

  const chatMessages = (): Message[] =>
    (state().chatMessages ?? []).map((msg, idx) => {
      if (msg.tool) {
        return {
          id: `chat-${idx}`,
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
        id: `chat-${idx}`,
        role: msg.role === "user" ? "user" : "assistant",
        thinking: msg.role === "thinking" && msg.reasoningVisible !== false,
        content: msg.text + (msg.pendingText || ""),
        streaming: Boolean(
          state().chatActivity &&
            idx === state().chatMessages.length - 1 &&
            msg.role !== "user",
        ),
      };
    });

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
      const mode = width <= 1000 ? "tiny" : width <= 1400 ? "compact" : "wide";
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
          <div class="neu-pane">
            <div class="neu-pane-header">
              <span class="neu-pane-title">Natalia</span>
              <span class="neu-pane-status" data-running={state().activeTurn}>
                {state().activeTurn ? "running" : "idle"}
              </span>
            </div>
            <div class="neu-pane-content">
              <Transcript
                messages={mainMessages()}
                emptyTitle="Natalia 已准备好"
                emptyHint="Natalia 会直接处理工作区任务。"
                assistantName="Natalia"
                assistantInitial="N"
                scrollRef={setTranscriptEl}
                onScroll={handleTranscriptScroll}
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

          <div class="neu-pane-divider" />

          <Show when={layoutMode() !== "tiny" || naviOpen()}>
          <div class="neu-pane">
            <div class="neu-pane-header">
              <span class="neu-pane-title">Navi</span>
              <span class="neu-pane-status" data-running={state().chatActivity}>
                {state().chatActivity ? "running" : "idle"}
              </span>
            </div>
            <div class="neu-pane-content">
              <Transcript
                messages={chatMessages()}
                emptyTitle="向 Navi 提问"
                emptyHint="Navi 用于规划和审查，不直接操作工作区。"
                assistantName="Navi"
                assistantInitial="V"
                scrollRef={setChatTranscriptEl}
                onScroll={handleChatTranscriptScroll}
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
