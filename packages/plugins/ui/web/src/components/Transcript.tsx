import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { marked } from "marked";
import type { Message } from "../types";

declare global {
  interface Window {
    _nataliaCodeBlocks?: string[];
  }
}

export interface TranscriptProps {
  messages: Message[];
  emptyTitle?: string;
  emptyHint?: string;
  assistantName?: string;
  assistantInitial?: string;
  scrollRef?: (el: HTMLDivElement) => void;
  onScroll?: (event: Event) => void;
}

const ROW_HEIGHT = 120;
const OVERSCAN = 8;

export function Transcript(props: TranscriptProps) {
  const [windowStart, setWindowStart] = createSignal(0);
  const [windowEnd, setWindowEnd] = createSignal(0);
  let scrollEl: HTMLDivElement | undefined;

  function updateWindow(el: HTMLDivElement) {
    const count = props.messages.length;
    if (count === 0) {
      setWindowStart(0);
      setWindowEnd(0);
      return;
    }
    const first = Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT) - OVERSCAN);
    const last = Math.min(
      count,
      Math.ceil((el.scrollTop + el.clientHeight) / ROW_HEIGHT) + OVERSCAN,
    );
    setWindowStart(first);
    setWindowEnd(Math.max(first + 1, last));
  }

  onMount(() => {
    if (scrollEl) updateWindow(scrollEl);
  });
  createEffect(() => {
    if (scrollEl) updateWindow(scrollEl);
  });

  const visible = () => {
    const start = windowStart();
    const end = windowEnd();
    return start === 0 && end === 0
      ? props.messages.slice(0, 0)
      : props.messages.slice(start, end);
  };

  return (
    <div
      class="natalia-transcript"
      ref={(el) => {
        scrollEl = el;
        props.scrollRef?.(el);
      }}
      onScroll={(event) => {
        props.onScroll?.(event);
        if (scrollEl) updateWindow(scrollEl);
      }}
    >
      <Show
        when={props.messages.length > 0}
        fallback={
          <div class="natalia-transcript-empty">
            <div class="natalia-transcript-empty-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path
                  d="M20 5C14.4772 5 10 9.47715 10 15V22C10 24.2091 8.20914 26 6 26H5C3.89543 26 3 26.8954 3 28V30C3 31.1046 3.89543 32 5 32H35C36.1046 32 37 31.1046 37 30V28C37 26.8954 36.1046 26 35 26H34C31.7909 26 30 24.2091 30 22V15C30 9.47715 25.5225 5 20 5Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div class="natalia-transcript-empty-title">
              {props.emptyTitle ?? ""}
            </div>
            <div class="natalia-transcript-empty-hint">
              {props.emptyHint ?? ""}
            </div>
          </div>
        }
      >
        <div
          style={{
            height: `${windowStart() * ROW_HEIGHT}px`,
            "flex-shrink": "0",
          }}
        />
        <For each={visible()}>
          {(message) => (
            <MessageRow
              message={message}
              assistantName={props.assistantName}
              assistantInitial={props.assistantInitial}
            />
          )}
        </For>
        <div
          style={{
            height: `${(props.messages.length - windowEnd()) * ROW_HEIGHT}px`,
            "flex-shrink": "0",
          }}
        />
      </Show>
    </div>
  );
}

export interface MessageRowProps {
  message: Message;
  assistantName?: string;
  assistantInitial?: string;
}

export function MessageRow(props: MessageRowProps) {
  const [copied, setCopied] = createSignal(false);

  function handleCopy(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isUser = () => props.message.role === "user";
  const isSystem = () => props.message.role === "system";

  return (
    <article class="natalia-message" data-role={props.message.role}>
      <div class="natalia-message-header">
        <div class="natalia-message-avatar" data-role={props.message.role}>
          {isUser() ? "U" : isSystem() ? "S" : (props.assistantInitial ?? "N")}
        </div>
        <div class="natalia-message-meta">
          <span class="natalia-message-author">
            {isUser() ? "You" : isSystem() ? "System" : (props.assistantName ?? "Natalia")}
          </span>
          <span class="natalia-message-time">
            {props.message.timestamp ?? ""}
          </span>
        </div>
        <Show when={props.message.status}>
          <span
            class="natalia-badge"
            classList={{
              "natalia-badge-running": props.message.status === "running",
              "natalia-badge-success":
                props.message.status === "completed" ||
                props.message.status === "done",
              "natalia-badge-error":
                props.message.status === "error" ||
                props.message.status === "failed",
            }}
          >
            {props.message.status}
          </span>
        </Show>
      </div>

      <div class="natalia-message-body">
        <Show
          when={props.message.thinking}
          fallback={
            <Show
              when={props.message.content || !props.message.toolCalls?.length}
            >
              <Show
                when={props.message.streaming}
                fallback={
                  <div
                    class="natalia-message-text"
                    innerHTML={formatContent(props.message.content)}
                  />
                }
              >
                <div
                  class="natalia-message-text"
                  innerHTML={formatContent(props.message.content)}
                />
                <div class="natalia-streaming-indicator">
                  <div class="natalia-streaming-dot" />
                  <div class="natalia-streaming-dot" />
                  <div class="natalia-streaming-dot" />
                  <span class="natalia-streaming-label">正在思考...</span>
                </div>
              </Show>
            </Show>
          }
        >
          <div class="natalia-thinking-block">
            <span class="natalia-thinking-label">Thinking</span>
            <div
              class="natalia-thinking-text"
              innerHTML={formatContent(props.message.content)}
            />
          </div>
        </Show>
      </div>

      <Show
        when={props.message.toolCalls && props.message.toolCalls.length > 0}
      >
        <div class="natalia-tool-calls">
          <For each={props.message.toolCalls}>
            {(toolCall) => (
              <div class="natalia-tool-card">
                <div class="natalia-tool-header">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style="color: var(--accent-primary); flex-shrink: 0;"
                  >
                    <path
                      d="M7 1L3 5L7 9L11 5L7 1Z"
                      stroke="currentColor"
                      stroke-width="1.3"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span class="natalia-tool-name">{toolCall.name}</span>
                  <Show when={toolCall.summary}>
                    <span class="natalia-tool-summary">{toolCall.summary}</span>
                  </Show>
                  <span class="natalia-badge natalia-badge-default">
                    {toolCall.status ?? "tool"}
                  </span>
                </div>
                <Show when={toolCall.output}>
                  <div class="natalia-tool-output">
                    <pre>{toolCall.output}</pre>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.message.actions && props.message.actions.length > 0}>
        <div class="natalia-message-actions">
          <For each={props.message.actions}>
            {(action) => (
              <button
                type="button"
                class="natalia-action-btn"
                classList={{
                  "natalia-action-btn-primary": action.primary,
                  "natalia-action-btn-secondary": !action.primary,
                }}
                onClick={() => action.onClick()}
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

const markdownCache = new Map<string, string>();
const MARKDOWN_CACHE_LIMIT = 512;

function formatContent(text: string): string {
  const cached = markdownCache.get(text);
  if (cached !== undefined) return cached;
  const html = marked.parse(text, {
    gfm: true,
    breaks: true,
  }) as string;
  if (markdownCache.size >= MARKDOWN_CACHE_LIMIT) {
    const oldest = markdownCache.keys().next().value;
    if (oldest !== undefined) markdownCache.delete(oldest);
  }
  markdownCache.set(text, html);
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatBashBlocks(
  text: string,
): { type: "bash" | "result" | "text"; content: string }[] {
  const blocks: { type: "bash" | "result" | "text"; content: string }[] = [];
  const regex = /Bash\s*\n```[\w]*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ type: "bash", content: match[1].trim() });
  }
  const resultRegex = /结果:\s*\n```[\w]*\n([\s\S]*?)\n```/;
  const resultMatch = resultRegex.exec(text);
  if (resultMatch) {
    blocks.push({ type: "result", content: resultMatch[1].trim() });
  }
  return blocks;
}
