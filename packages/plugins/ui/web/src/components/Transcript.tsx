import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
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

const DEFAULT_ROW_HEIGHT = 80;
const OVERSCAN = 8;

export function Transcript(props: TranscriptProps) {
  const [heights, setHeights] = createSignal<Map<string, number>>(new Map());
  const [windowStart, setWindowStart] = createSignal(0);
  const [windowEnd, setWindowEnd] = createSignal(0);
  let scrollEl: HTMLDivElement | undefined;
  let firstAnchorId: string | undefined;
  let firstAnchorOffset = 0;
  let lastMessageCount = -1;
  const rowRefs = new Map<string, HTMLDivElement>();
  const observedElements = new Map<string, HTMLDivElement>();

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver((entries) => {
          let dirty = false;
          const next = new Map(heights());
          for (const entry of entries) {
            const el = entry.target as HTMLElement;
            const id = el.dataset.messageId;
            if (!id) continue;
            const height = Math.ceil(entry.contentRect.height);
            if (next.get(id) !== height) {
              next.set(id, height);
              dirty = true;
            }
          }
          if (dirty) {
            setHeights(next);
          }
        });

  onCleanup(() => resizeObserver?.disconnect());

  function heightOf(id: string) {
    return heights().get(id) ?? DEFAULT_ROW_HEIGHT;
  }

  function prefix(list: Message[]) {
    const result = [0];
    let sum = 0;
    for (const message of list) {
      sum += heightOf(message.id);
      result.push(sum);
    }
    return result;
  }

  function indexAt(prefixList: number[], y: number) {
    let lo = 0;
    let hi = prefixList.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (prefixList[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return Math.max(0, Math.min(lo, props.messages.length - 1));
  }

  function updateWindow(el: HTMLDivElement) {
    const list = props.messages;
    if (list.length === 0) {
      setWindowStart(0);
      setWindowEnd(0);
      return;
    }
    const prefixList = prefix(list);
    const first = indexAt(prefixList, el.scrollTop);
    const last = indexAt(prefixList, el.scrollTop + el.clientHeight);
    const start = Math.max(0, first - OVERSCAN);
    const end = Math.min(list.length, last + OVERSCAN + 1);
    setWindowStart(start);
    setWindowEnd(end);

    // Keep a stable visible anchor for prepend compensation.
    const anchored = list[first];
    if (anchored) {
      firstAnchorId = anchored.id;
      firstAnchorOffset = el.scrollTop - (prefixList[first] ?? 0);
    }
  }

  function compensateForPrepend() {
    if (!scrollEl || !firstAnchorId) return;
    const anchorEl = rowRefs.get(firstAnchorId);
    if (!anchorEl) return;
    const containerTop = scrollEl.getBoundingClientRect().top;
    const rowTop = anchorEl.getBoundingClientRect().top;
    scrollEl.scrollTop =
      scrollEl.scrollTop + rowTop - containerTop - firstAnchorOffset;
    updateWindow(scrollEl);
  }

  createEffect(() => {
    const count = props.messages.length;
    if (lastMessageCount >= 0 && count > lastMessageCount && scrollEl) {
      requestAnimationFrame(() => compensateForPrepend());
    }
    lastMessageCount = count;
    if (scrollEl) updateWindow(scrollEl);
  });

  onMount(() => {
    if (scrollEl) updateWindow(scrollEl);
  });

  function registerRow(id: string, el?: HTMLDivElement) {
    if (!el) {
      const previous = observedElements.get(id);
      if (previous) {
        resizeObserver?.unobserve(previous);
        observedElements.delete(id);
      }
      rowRefs.delete(id);
      return;
    }
    const previous = observedElements.get(id);
    if (previous && previous !== el) resizeObserver?.unobserve(previous);
    observedElements.set(id, el);
    rowRefs.set(id, el);
    el.dataset.messageId = id;
    resizeObserver?.observe(el);
    const height = Math.ceil(el.getBoundingClientRect().height);
    if (height > 0 && heights().get(id) !== height) {
      const next = new Map(heights());
      next.set(id, height);
      setHeights(next);
    }
  }

  const visible = () => {
    const start = windowStart();
    const end = windowEnd();
    if (start === 0 && end === 0) return props.messages.slice(0, 0);
    return props.messages.slice(start, end);
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
        <div style={{ height: `${prefix(props.messages)[windowStart()] ?? 0}px` }} />
        <For each={visible()}>
          {(message) => (
            <MessageRow
              message={message}
              assistantName={props.assistantName}
              assistantInitial={props.assistantInitial}
              ref={(el) => registerRow(message.id, el)}
            />
          )}
        </For>
        <div
          style={{
            height: `${
              (prefix(props.messages)[props.messages.length] ?? 0) -
              (prefix(props.messages)[windowEnd()] ?? 0)
            }px`,
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
  ref?: (el: HTMLDivElement) => void;
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
    <article
      class="natalia-message"
      data-role={props.message.role}
      ref={props.ref}
    >
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
