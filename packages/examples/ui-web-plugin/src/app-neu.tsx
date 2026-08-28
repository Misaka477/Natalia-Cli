import type { UiPluginContext } from "@natalia/ui-host";
import { cloneState } from "@natalia/view-store";
import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import {
  ReviewPane,
  TerminalPane,
  BrowserPane,
} from "./components/RightPanel";
import { FileEditor } from "./file-editor";
import { SettingsPanel } from "./settings-panel";
import { SessionActionsPanel } from "./session-actions-panel";
import { CheckpointPanel } from "./checkpoint-panel";
import { PermissionPanel } from "./permission-panel";
import { StatusPanel } from "./status-panel";
import { SearchPanel } from "./search-panel";
import { HelpPanel } from "./help-panel";
import { StashPanel } from "./stash-panel";
import { FlowTaskPanel } from "./flow-task-panel";
import { SandboxPanel } from "./sandbox-panel";
import { GovernancePanel } from "./governance-panel";
import { ModelPanel } from "./model-panel";
import type { Message } from "./types";

type RightTab = "diff" | "terminal" | "files" | "browser";

const demoMainMessages: Message[] = [
  {
    id: "demo-m1",
    role: "user",
    content: "帮我看一下当前项目的计划，并检查 rollback 相关的问题。",
    timestamp: "10:24",
  },
  {
    id: "demo-a1",
    role: "assistant",
    content: "我已经读取了当前项目计划，正在检查 `rollback` 相关改动。",
    timestamp: "10:25",
    status: "completed",
  },
  {
    id: "demo-a2",
    role: "system",
    content: "当前模型：Opus 4 · 标准推理",
    timestamp: "10:25",
  },
  {
    id: "demo-a3",
    role: "assistant",
    content: "先执行一次检查，看看当前状态。",
    timestamp: "10:25",
    status: "completed",
    toolCalls: [
      {
        name: "bash",
        output: "$ pwd\n/home/aquama/Development/Natalia_Project/natalia-cli",
      },
      {
        name: "read",
        output: "# natalia-second-ui-as-plugin.zh-CN.md\n> 让 Natalia 第二套 UI 以插件包形态自举",
      },
    ],
  },
  {
    id: "demo-a4",
    role: "assistant",
    content: "发现一个问题：`stop` 语义与计划不一致，需要确认。",
    timestamp: "10:26",
    status: "completed",
  },
];

const demoChatMessages: Message[] = [
  {
    id: "demo-chat-1",
    role: "user",
    content: "你说一下当前 plan 的下一步建议。",
    timestamp: "10:27",
  },
  {
    id: "demo-chat-a1",
    role: "assistant",
    content: "建议先跑完 `tsc -b`，再核对 diff 中的 rollback 行为。",
    timestamp: "10:27",
    status: "completed",
  },
  {
    id: "demo-chat-a2",
    role: "system",
    content: "Navi 当前上下文：计划 / 审阅",
    timestamp: "10:27",
  },
  {
    id: "demo-chat-a3",
    role: "assistant",
    content: "可以帮你把关键改动整理成 review 清单。",
    timestamp: "10:28",
    status: "completed",
    toolCalls: [
      {
        name: "search",
        output: "matched 3 files\napps/tui/src/app/App.tsx\napps/tui/src/runtime.tsx",
      },
    ],
  },
];

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 360;
const MIN_RIGHT_WIDTH = 440;
const MAX_RIGHT_WIDTH = 560;

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
      <span class="neu-tree-label">{props.label}</span>
      {props.badge ? <span class="neu-badge">{props.badge}</span> : null}
    </button>
  );
}

function SessionTree(props: {
  selected: string;
  onSelect: (name: string) => void;
}) {
  const groups = [
    {
      workspace: "NATALIA-CLI",
      sessions: [
        { name: "修 rollback", status: "running" },
        { name: "调研 Tauri", status: "idle" },
        { name: "写第二套 UI", status: "idle" },
      ],
    },
    {
      workspace: "AUDIO CONTROLLER",
      sessions: [
        { name: "音频处理", status: "idle" },
        { name: "模型调优", status: "error" },
      ],
    },
  ];

  return (
    <div class="neu-tree">
      <div class="neu-tree-title">工作区</div>
      <For each={groups}>
        {(group) => (
          <>
            <div class="neu-workspace-row">
              <span class="neu-workspace-name">{group.workspace}</span>
              <span class="neu-count">{group.sessions.length}</span>
            </div>
            <For each={group.sessions}>
              {(session) => (
                <TreeRow
                  label={session.name}
                  selected={props.selected === session.name}
                  status={session.status}
                  depth={1}
                  onClick={() => props.onSelect(session.name)}
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
  const [rightWidth, setRightWidth] = createSignal(440);
  const [leftVisible, setLeftVisible] = createSignal(true);
  const [rightVisible, setRightVisible] = createSignal(true);
  const [mainDraft, setMainDraft] = createSignal("");
  const [chatDraft, setChatDraft] = createSignal("");
  const [selectedSession, setSelectedSession] = createSignal("修 rollback");
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [sessionMenuOpen, setSessionMenuOpen] = createSignal(false);
  const [checkpointOpen, setCheckpointOpen] = createSignal(false);
  const [permissionOpen, setPermissionOpen] = createSignal(false);
  const [statusOpen, setStatusOpen] = createSignal(false);
  const [modelOpen, setModelOpen] = createSignal(false);
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [stashOpen, setStashOpen] = createSignal(false);
  const [flowTaskOpen, setFlowTaskOpen] = createSignal(false);
  const [sandboxOpen, setSandboxOpen] = createSignal(false);
  const [governanceOpen, setGovernanceOpen] = createSignal(false);

  onCleanup(
    props.ctx.projection.subscribe((next) => setState(cloneState(next))),
  );

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

    // Prototype: simulate the model requesting permission while working.
    const timer = window.setTimeout(() => setPermissionOpen(true), 900);
    onCleanup(() => window.clearTimeout(timer));
  });

  const mainMessages = (): Message[] => {
    const real: Message[] = (state().messages ?? []).map((msg, idx) => ({
      id: `msg-${idx}`,
      role:
        msg.role === "user"
          ? "user"
          : msg.role === "thinking" || msg.role === "system"
            ? "system"
            : "assistant",
      content: msg.text + (msg.pendingText || ""),
      status:
        state().activeTurn && idx === (state().messages?.length ?? 0) - 1
          ? "running"
          : undefined,
      streaming: Boolean(
        state().activeTurn &&
          idx === (state().messages?.length ?? 0) - 1 &&
          (msg.pendingText ?? "").length > 0,
      ),
    }));
    return real.length > 0 ? real : demoMainMessages;
  };

  const chatMessages = (): Message[] => {
    const real: Message[] = (state().chatMessages ?? []).map((msg, idx) => ({
      id: `chat-${idx}`,
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text + (msg.pendingText || ""),
      streaming: Boolean(
        state().chatActivity && idx === state().chatMessages.length - 1,
      ),
    }));
    return real.length > 0 ? real : demoChatMessages;
  };

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
        Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, startWidth - (next.clientX - startX))),
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

  const rightTabs: { id: RightTab; label: string }[] = [
    { id: "diff", label: "审阅 / Diff" },
    { id: "terminal", label: "终端" },
    { id: "files", label: "文件" },
    { id: "browser", label: "浏览器" },
  ];

  return (
    <div class="neu-shell">
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
                onClick={() => setCheckpointOpen(true)}
              >
                Checkpoint
              </button>
            </div>
            <div class="neu-sidebar-content">
              <SessionTree selected={selectedSession()} onSelect={setSelectedSession} />
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
              />
              <Composer
                value={mainDraft()}
                placeholder="输入消息，使用 @ 提及文件…"
                busy={Boolean(state().activeTurn)}
                onInput={setMainDraft}
                onSubmit={() => {
                  const text = mainDraft();
                  if (text.trim()) {
                    props.ctx.runtime.submit?.(text);
                    setMainDraft("");
                  }
                }}
                onStop={() => props.ctx.runtime.cancel?.()}
              />
            </div>
          </div>

          <div class="neu-pane-divider" />

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
              />
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
              <For each={rightTabs}>
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
                <ReviewPane />
              </Show>
              <Show when={rightTab() === "terminal"}>
                <TerminalPane />
              </Show>
              <Show when={rightTab() === "files"}>
                <FileEditor />
              </Show>
              <Show when={rightTab() === "browser"}>
                <BrowserPane />
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
      <PermissionPanel open={permissionOpen()} onClose={() => setPermissionOpen(false)} />
      <SessionActionsPanel
        open={sessionMenuOpen()}
        session={selectedSession()}
        onClose={() => setSessionMenuOpen(false)}
      />
      <CheckpointPanel
        open={checkpointOpen()}
        session={selectedSession()}
        onClose={() => setCheckpointOpen(false)}
      />
      <GovernancePanel open={governanceOpen()} onClose={() => setGovernanceOpen(false)} />
      <SandboxPanel open={sandboxOpen()} onClose={() => setSandboxOpen(false)} />
      <FlowTaskPanel open={flowTaskOpen()} onClose={() => setFlowTaskOpen(false)} />
      <StashPanel open={stashOpen()} onClose={() => setStashOpen(false)} />
      <HelpPanel open={helpOpen()} onClose={() => setHelpOpen(false)} />
      <SearchPanel open={searchOpen()} onClose={() => setSearchOpen(false)} />
      <ModelPanel open={modelOpen()} onClose={() => setModelOpen(false)} />
      <StatusPanel open={statusOpen()} onClose={() => setStatusOpen(false)} />
      <SettingsPanel
        open={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
        onOpenModels={() => {
          setModelOpen(true);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
