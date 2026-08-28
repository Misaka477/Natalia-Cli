import type { UiPluginContext } from "@natalia/ui-host";
import { cloneState } from "@natalia/view-store";
import { createSignal, onCleanup, For } from "solid-js";
import { SidebarCodex } from "./components/SidebarCodex";
import { TranscriptCodex } from "./components/TranscriptCodex";
import { ComposerCodex } from "./components/ComposerCodex";
import type { NavWorkspace, Message } from "./types";

export function AppCodex(props: { ctx: UiPluginContext }) {
  const [state, setState] = createSignal(
    cloneState(props.ctx.projection.getState())
  );
  const [draft, setDraft] = createSignal("");
  const [attachments, setAttachments] = createSignal<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

  onCleanup(
    props.ctx.projection.subscribe((next) => setState(cloneState(next)))
  );

  // Mock workspaces
  const workspaces = (): NavWorkspace[] => [
    {
      id: "ws-1",
      name: "natalia-cli",
      sessions: [
        {
          id: "session-1",
          title: state().title || "当前会话",
          state: state().activeTurn ? "running" : "idle",
          active: true,
        },
      ],
    },
  ];

  // Transform messages
  const messages = (): Message[] => {
    return (state().messages || []).map((msg, idx) => ({
      id: `msg-${idx}`,
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text || "",
      timestamp: undefined,
      status: state().activeTurn && idx === state().messages.length - 1 ? "running" : undefined,
      streaming: Boolean(state().activeTurn && idx === state().messages.length - 1),
    }));
  };

  function handleSubmit() {
    const text = draft();
    if (!text.trim()) return;
    setDraft("");
    console.log("Submit:", text);
  }

  function handleStop() {
    console.log("Stop");
  }

  return (
    <div class="codex-layout" data-sidebar-collapsed={sidebarCollapsed()}>
      {/* Top bar */}
      <div class="codex-topbar">
        <button
          type="button"
          class="codex-icon-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed())}
          title="切换侧边栏"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 10H17M3 5H17M3 15H17"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <div style={{ flex: 1, display: "flex", "align-items": "center", gap: "var(--space-3)" }}>
          <span style={{ "font-size": "var(--font-size-md)", "font-weight": "500" }}>
            {state().title || "新对话"}
          </span>
          <span
            class="codex-badge"
            classList={{
              "codex-badge-running": Boolean(state().activeTurn),
              "codex-badge-idle": !state().activeTurn,
            }}
          >
            {state().activeTurn ? "运行中" : "空闲"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button type="button" class="codex-button codex-button-ghost codex-button-sm">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <path
                d="M13 8C13 8 11 4 8 4C5 4 3 8 3 8C3 8 5 12 8 12C11 12 13 8 13 8Z"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
            模型设置
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <SidebarCodex
        workspaces={workspaces()}
        currentSessionId="session-1"
        collapsed={sidebarCollapsed()}
        onSelectSession={(id) => console.log("Select:", id)}
        onNewSession={() => console.log("New session")}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed())}
      />

      {/* Main content */}
      <div class="codex-main">
        <TranscriptCodex
          messages={messages()}
          emptyTitle="Natalia 已准备好"
          emptyHint="开始对话，Natalia 会帮你完成开发工作。"
        />

        <ComposerCodex
          value={draft()}
          placeholder={
            state().activeTurn
              ? "工作中 — 此消息将加入当前回合"
              : "向 Natalia 提问或描述任务..."
          }
          busy={Boolean(state().activeTurn)}
          onInput={setDraft}
          onSubmit={handleSubmit}
          onStop={handleStop}
          attachments={attachments()}
          onAddAttachment={() => {
            const path = prompt("文件路径:");
            if (path) setAttachments([...attachments(), path]);
          }}
          onRemoveAttachment={(path) => {
            setAttachments(attachments().filter((p) => p !== path));
          }}
        >
          <select class="codex-select">
            <option>Claude Opus 4</option>
            <option>Claude Sonnet 4</option>
            <option>GPT-4</option>
          </select>
          <select class="codex-select">
            <option>标准推理</option>
            <option>低</option>
            <option>中</option>
            <option>高</option>
          </select>
        </ComposerCodex>
      </div>
    </div>
  );
}
