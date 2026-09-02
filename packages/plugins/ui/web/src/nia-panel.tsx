import { For, Show, createMemo, createSignal } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";
import { NeuSelect } from "./components/NeuSelect";

export function NiaPanel(props: { state: AppState; runtime?: RuntimeClient }) {
  const [draft, setDraft] = createSignal("");
  const [modelID, setModelID] = createSignal("");
  const [reasoning, setReasoning] = createSignal("medium");
  const [busy, setBusy] = createSignal(false);

  const messages = createMemo(() =>
    (props.state.chatMessages ?? []).filter(
      (message) => (message.channel ?? "navi") === "nia",
    ),
  );

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy()) return;
    setBusy(true);
    try {
      await props.runtime?.chatSubmit?.({
        text: trimmed,
        channel: "nia",
        reasoningEffort: reasoning() as "minimal" | "low" | "medium" | "high" | "xhigh",
      });
      setDraft("");
    } catch (cause) {
      console.error("[nia-ui] submit failed", cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="review-pane">
      <div class="review-header">
        <div class="review-title">
          <span>Nia 审计</span>
        </div>
        <div class="review-meta">
          <span class="review-count" data-running={messages().length}>
            {busy() ? "running" : `${messages().length} messages`}
          </span>
        </div>
      </div>
      <div class="review-body">
        <Show
          when={messages().length}
          fallback={
            <div class="agent-empty-full">
              <div class="review-empty-icon">🔍</div>
              <div class="review-empty-title">Nia 尚未开始审计</div>
              <div class="review-empty-desc">
                Nia 始终在线，收到审计消息后会自动启动。
              </div>
            </div>
          }
        >
          <div class="nia-transcript">
            <For each={messages()}>
              {(message) => (
                <div class="nia-message" data-role={message.role}>
                  <div class="nia-message-role">
                    {message.role === "user" ? "你" : "Nia"}
                  </div>
                  <div class="nia-message-text">{message.text + message.pendingText}</div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <div class="plan-panel-mark-row">
          <button
            type="button"
            class="review-action"
            onClick={() => void send("请审计当前选中的 Plan，按计划源文件逐项核对。")}
          >
            手动启动 Nia
          </button>
        </div>
        <div class="neu-main-toolbar">
          <NeuSelect
            value={modelID()}
            options={[]}
            placeholder="Nia 模型"
            onChange={setModelID}
            menuPosition="top"
          />
          <NeuSelect
            value={reasoning()}
            options={[
              { value: "minimal", label: "minimal" },
              { value: "low", label: "low" },
              { value: "medium", label: "medium" },
              { value: "high", label: "high" },
              { value: "xhigh", label: "xhigh" },
            ]}
            onChange={setReasoning}
            placeholder="Nia 推理"
            menuPosition="top"
          />
        </div>
        <textarea
          class="plan-panel-editor"
          value={draft()}
          placeholder="向 Nia 提问…"
          onInput={(event) => setDraft(event.currentTarget.value)}
        />
        <div class="plan-panel-mark-row">
          <button
            type="button"
            class="review-action"
            onClick={() => void send(draft())}
            disabled={busy() || !draft().trim()}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
