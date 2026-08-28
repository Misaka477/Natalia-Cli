import { For, Show } from "solid-js";
import type { Message } from "../types";

export interface TranscriptCodexProps {
  messages: Message[];
  emptyTitle?: string;
  emptyHint?: string;
}

export function TranscriptCodex(props: TranscriptCodexProps) {
  return (
    <div class="codex-thread">
      <div class="codex-thread-inner">
        <Show
          when={props.messages.length > 0}
          fallback={
            <div class="codex-empty">
              <div class="codex-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <Show when={props.emptyTitle}>
                <div class="codex-empty-title">{props.emptyTitle}</div>
              </Show>
              <Show when={props.emptyHint}>
                <div class="codex-empty-hint">{props.emptyHint}</div>
              </Show>
            </div>
          }
        >
          <For each={props.messages}>
            {(message) => <MessageCodex message={message} />}
          </For>
        </Show>
      </div>
    </div>
  );
}

export interface MessageCodexProps {
  message: Message;
}

export function MessageCodex(props: MessageCodexProps) {
  return (
    <article class="codex-message" data-role={props.message.role}>
      <div class="codex-message-header">
        <div class="codex-message-avatar">
          {props.message.role === "user" ? "U" : "A"}
        </div>
        <span class="codex-message-author">
          {props.message.role === "user" ? "You" : "Natalia"}
        </span>
        <Show when={props.message.timestamp}>
          <span class="codex-message-timestamp">{props.message.timestamp}</span>
        </Show>
        <Show when={props.message.status}>
          <span
            class="codex-badge codex-badge-sm"
            classList={{
              "codex-badge-running": props.message.status === "running",
              "codex-badge-success": props.message.status === "completed",
              "codex-badge-error": props.message.status === "error",
            }}
          >
            {props.message.status}
          </span>
        </Show>
      </div>
      <div class="codex-message-content">
        <Show
          when={!props.message.streaming}
          fallback={
            <div style={{ display: "flex", "align-items": "center", gap: "8px", color: "var(--text-dim)" }}>
              <div class="codex-spinner" />
              <span>正在思考...</span>
            </div>
          }
        >
          <div innerHTML={formatMessageContent(props.message.content)} />
        </Show>
      </div>
      <Show when={props.message.toolCalls && props.message.toolCalls.length > 0}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "var(--space-2)", "margin-top": "var(--space-2)" }}>
          <For each={props.message.toolCalls}>
            {(toolCall) => (
              <div
                style={{
                  padding: "var(--space-3)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-subtle)",
                  "border-radius": "var(--radius-lg)",
                }}
              >
                <div style={{ display: "flex", "align-items": "center", gap: "var(--space-2)", "margin-bottom": "var(--space-2)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "var(--accent-primary)" }}>
                    <path
                      d="M8 1L3 6L8 11L13 6L8 1Z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span style={{ "font-size": "var(--font-size-sm)", "font-weight": "500" }}>{toolCall.name}</span>
                  <span class="codex-badge codex-badge-default">tool</span>
                </div>
                <Show when={toolCall.output}>
                  <pre
                    style={{
                      margin: "0",
                      padding: "var(--space-2)",
                      background: "var(--surface-0)",
                      "border-radius": "var(--radius-sm)",
                      "font-family": "var(--font-family-mono)",
                      "font-size": "var(--font-size-xs)",
                      color: "var(--text-secondary)",
                      "overflow-x": "auto",
                    }}
                  >
                    {toolCall.output}
                  </pre>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.message.actions && props.message.actions.length > 0}>
        <div style={{ display: "flex", gap: "var(--space-2)", "margin-top": "var(--space-2)" }}>
          <For each={props.message.actions}>
            {(action) => (
              <button
                type="button"
                class="codex-button codex-button-sm"
                classList={{
                  "codex-button-primary": action.primary,
                  "codex-button-secondary": !action.primary,
                }}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </article>
  );
}

function formatMessageContent(content: string): string {
  // Simple markdown-like formatting
  let html = content;
  
  // Escape HTML
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  
  // Paragraphs
  html = html.split("\n\n").map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  
  return html;
}
