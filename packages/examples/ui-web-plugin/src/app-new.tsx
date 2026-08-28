import type { UiPluginContext } from "@natalia/ui-host";
import { cloneState } from "@natalia/view-store";
import { createSignal, onCleanup, Show } from "solid-js";
import { TopNav } from "./components/TopNav";
import { Sidebar } from "./components/Sidebar";
import { RightPanel, type RightPanelProps } from "./components/RightPanel";
import { Transcript, MessageRow } from "./components/Transcript";
import { Composer } from "./components/Composer";
import type { NavWorkspace, Message, ToolCall, MessageAction } from "./types";

export function App(props: { ctx: UiPluginContext }) {
  const [state, setState] = createSignal(
    cloneState(props.ctx.projection.getState())
  );
  const [mainDraft, setMainDraft] = createSignal("");
  const [chatDraft, setChatDraft] = createSignal("");
  const [mainAttachments, setMainAttachments] = createSignal<string[]>([]);
  const [chatAttachments, setChatAttachments] = createSignal<string[]>([]);
  const [rightPanelTab, setRightPanelTab] = createSignal<RightPanelProps["activeTab"]>("review");
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

  onCleanup(
    props.ctx.projection.subscribe((next) => setState(cloneState(next)))
  );

  const mainWorkspaces = (): NavWorkspace[] => [
    {
      id: "ws-cli",
      name: "natalia-cli",
      sessions: [
        {
          id: "session-1",
          title: "修 rollback",
          state: state().activeTurn ? "running" : "idle",
          active: true,
        },
        {
          id: "session-2",
          title: "调研 Tauri",
          state: "idle",
        },
        {
          id: "session-3",
          title: "写第二套 UI",
          state: "idle",
        },
      ],
    },
    {
      id: "ws-audio",
      name: "audio controller",
      sessions: [
        {
          id: "session-4",
          title: "音频处理",
          state: "idle",
        },
        {
          id: "session-5",
          title: "模型调优",
          state: "error",
        },
      ],
    },
  ];

  const mainMessages = (): Message[] => (state().messages ?? []).map((msg, idx) => ({
    id: `msg-${idx}`,
    role: msg.role === "user" ? "user" : msg.role === "thinking" || msg.role === "system" ? "system" : "assistant",
    content: msg.text + (msg.pendingText || ""),
    timestamp: undefined,
    status: state().activeTurn && idx === (state().messages?.length ?? 0) - 1 ? "running" : undefined,
    streaming: Boolean(state().activeTurn && idx === (state().messages?.length ?? 0) - 1 && (msg.pendingText ?? "").length > 0),
    toolCalls: msg.tool
      ? [
          {
            name: msg.tool.name,
            output: msg.tool.result,
          } satisfies ToolCall,
        ]
      : undefined,
    actions: idx === (state().messages?.length ?? 0) - 1 && msg.role === "user"
      ? [{ label: "重试", primary: false, onClick: () => {} }]
      : undefined,
  }));

  function handleMainSubmit() {
    const text = mainDraft();
    if (!text.trim()) return;
    setMainDraft("");
    props.ctx.runtime.submit?.(text);
  }

  function handleChatSubmit() {
    const text = chatDraft();
    if (!text.trim()) return;
    setChatDraft("");
    props.ctx.runtime.chatSubmit?.({ text });
  }

  function handleStop() {
    props.ctx.runtime.cancel?.();
  }

  function handleAttachment() {
    const path = prompt("文件路径:");
    if (path) setMainAttachments([...mainAttachments(), path]);
  }

  return (
    <div class="natalia-app" data-sidebar-collapsed={sidebarCollapsed()}>
      <TopNav ctx={props.ctx} />

      <div class="natalia-app-body">
        <Sidebar
          workspaces={mainWorkspaces()}
          currentSessionId="session-1"
          collapsed={sidebarCollapsed()}
          onSelectSession={(id) => console.log("Select:", id)}
          onNewSession={() => console.log("New session")}
        />

        <section class="natalia-main-panel">
          <div class="natalia-chat-header">
            <h2 class="natalia-panel-title">Main Agent</h2>
            <div class="natalia-chat-header-actions">
              <Show when={state().activeTurn}>
                <span class="natalia-badge natalia-badge-running">运行中</span>
              </Show>
              <Show when={!state().activeTurn}>
                <span class="natalia-badge natalia-badge-idle">空闲</span>
              </Show>
            </div>
          </div>

          <div class="natalia-chat-scroll">
            <Transcript
              messages={mainMessages()}
              emptyTitle="Natalia 已准备好"
              emptyHint="开始对话，Natalia 会帮你完成开发工作。"
            />
          </div>

          <Composer
            value={mainDraft()}
            placeholder={
              state().activeTurn
                ? "工作中 — 此消息将加入当前回合"
                : "向 Natalia 提问或描述任务..."
            }
            busy={Boolean(state().activeTurn)}
            onInput={setMainDraft}
            onSubmit={handleMainSubmit}
            onStop={handleStop}
            attachments={mainAttachments()}
            onAddAttachment={handleAttachment}
            onRemoveAttachment={(path) => setMainAttachments(mainAttachments().filter((p) => p !== path))}
          >
            <select class="natalia-select">
              <option>Claude Opus 4</option>
              <option>Claude Sonnet 4</option>
            </select>
            <select class="natalia-select">
              <option>标准推理</option>
              <option>低</option>
              <option>中</option>
              <option>高</option>
              <option>xhigh</option>
            </select>
          </Composer>
        </section>

        <section class="natalia-chat-panel">
          <div class="natalia-chat-panel-header">
            <h2 class="natalia-panel-title">NavChat</h2>
            <Show when={state().chatActivity}>
              <span class="natalia-badge natalia-badge-running">active</span>
            </Show>
            <Show when={!state().chatActivity}>
              <span class="natalia-badge natalia-badge-default">idle</span>
            </Show>
          </div>

          <div class="natalia-chat-scroll">
            <Transcript
              messages={(state().chatMessages ?? []).map((msg, idx) => ({
                id: `chat-${idx}`,
                role: msg.role === "user" ? "user" : "assistant",
                content: msg.text + (msg.pendingText || ""),
                streaming: Boolean(state().chatActivity && idx === state().chatMessages.length - 1),
              }))}
              emptyTitle="向 Navi 提问"
              emptyHint="聊天用于规划和审查，不会直接操作工作区。"
            />
          </div>

          <Composer
            value={chatDraft()}
            placeholder="向 Navi 提问..."
            busy={Boolean(state().chatActivity)}
            onInput={setChatDraft}
            onSubmit={handleChatSubmit}
            attachments={chatAttachments()}
            onAddAttachment={() => {
              const path = prompt("文件路径:");
              if (path) setChatAttachments([...chatAttachments(), path]);
            }}
            onRemoveAttachment={(path) => setChatAttachments(chatAttachments().filter((p) => p !== path))}
          >
            <select class="natalia-select">
              <option>Claude Sonnet 4</option>
              <option>Claude Opus 4</option>
            </select>
            <label class="natalia-toggle">
              <input type="checkbox" />
              <span>Expert</span>
            </label>
          </Composer>
        </section>

        <RightPanel activeTab={rightPanelTab()} onTabChange={setRightPanelTab} />
      </div>
    </div>
  );
}
