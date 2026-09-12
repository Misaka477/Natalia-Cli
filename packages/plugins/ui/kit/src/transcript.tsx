import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import type { JSX } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { marked } from "marked";
import type { Attachment, Message } from "./message";

const VIRTUALIZE_THRESHOLD = 80;
const VIRTUAL_OVERSCAN = 8;

function uiDebugEnabled() {
  try {
    if (globalThis.localStorage?.getItem("natalia.debug.ui") === "1")
      return true;
    const href = globalThis.location?.href;
    if (!href) return false;
    return new URL(href).searchParams.get("nataliaDebugUi") === "1";
  } catch {
    return false;
  }
}

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
  loadAttachmentUrl?: (attachment: Attachment) => Promise<string>;
  onFork?: (turnID: string) => void;
  onRollback?: (message: Message) => void;
  checkpointIDForMessage?: (message: Message) => string | undefined;
}

export function Transcript(props: TranscriptProps) {
  const [scrollEl, setScrollEl] = createSignal<HTMLDivElement>();
  const virtualize = () => props.messages.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return props.messages.length;
    },
    getScrollElement: () => scrollEl() ?? null,
    estimateSize: (index) => estimateMessageHeight(props.messages[index]!),
    getItemKey: (index) => props.messages[index]?.id ?? index,
    overscan: VIRTUAL_OVERSCAN,
  });

  const setScrollRef = (el: HTMLDivElement) => {
    setScrollEl(el);
    props.scrollRef?.(el);
  };

  const virtualItems = () => virtualizer.getVirtualItems();
  // TanStack needs one paint to observe the scroll element. Until it has
  // produced a window, render the ordinary list so long histories are never
  // blank and the first scroll cannot jump against a zero-height spacer.
  const useVirtual = () => virtualize() && virtualItems().length > 0;

  onMount(() => {
    console.log("[natalia-ui] transcript mounted", {
      messages: props.messages.length,
      debug: uiDebugEnabled(),
      virtualizeThreshold: VIRTUALIZE_THRESHOLD,
    });
  });

  let lastVirtualScrollEl: HTMLDivElement | undefined;
  let lastVirtualEnabled = false;
  createEffect(() => {
    const el = scrollEl();
    const enabled = props.messages.length > VIRTUALIZE_THRESHOLD;
    if (el === lastVirtualScrollEl && enabled === lastVirtualEnabled) return;
    lastVirtualScrollEl = el;
    lastVirtualEnabled = enabled;
    if (!el || !enabled) return;
    // Force the virtualizer to pick up the element even if the Solid option
    // proxy did not observe the ref signal, then rebuild measurements once.
    virtualizer._willUpdate();
    requestAnimationFrame(() => {
      if (enabled) virtualizer.measure();
    });
  });

  const handleScroll = (event: Event) => {
    const startedAt = performance.now();
    props.onScroll?.(event);
    if (!uiDebugEnabled()) return;
    const el = scrollEl();
    const mounted = useVirtual() ? virtualItems() : [];
    console.log("[natalia-ui] transcript scroll", {
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      scrollTop: el?.scrollTop,
      clientHeight: el?.clientHeight,
      scrollHeight: el?.scrollHeight,
      mounted: mounted.length,
      firstMounted: mounted[0]?.index,
      lastMounted: mounted.at(-1)?.index,
    });
  };

  createEffect(() => {
    if (!uiDebugEnabled()) return;
    const mounted = useVirtual() ? virtualItems() : [];
    console.log("[natalia-ui] transcript window", {
      messages: props.messages.length,
      virtualized: virtualize(),
      virtualReady: useVirtual(),
      mounted: mounted.length,
      firstMounted: mounted[0]?.index,
      lastMounted: mounted.at(-1)?.index,
      totalSize: useVirtual() ? virtualizer.getTotalSize() : null,
    });
  });

  return (
    <div class="natalia-transcript" ref={setScrollRef} onScroll={handleScroll}>
      <div
        class="natalia-transcript-content"
        style={
          useVirtual()
            ? {
                position: "relative",
                height: `${virtualizer.getTotalSize()}px`,
              }
            : undefined
        }
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
          <Show
            when={useVirtual()}
            fallback={
              <For each={props.messages}>
                {(message) => (
                  <MessageGroup
                    message={message}
                    assistantName={props.assistantName}
                    assistantInitial={props.assistantInitial}
                    loadAttachmentUrl={props.loadAttachmentUrl}
                    onFork={props.onFork}
                    onRollback={props.onRollback}
                  />
                )}
              </For>
            }
          >
            <For each={virtualItems()}>
              {(item) => (
                <MessageGroup
                  message={props.messages[item.index]!}
                  assistantName={props.assistantName}
                  assistantInitial={props.assistantInitial}
                  loadAttachmentUrl={props.loadAttachmentUrl}
                  onFork={props.onFork}
                  onRollback={props.onRollback}
                  rowRef={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: "0",
                    left: "0",
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                />
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
}

function estimateMessageHeight(message: Message): number {
  const attachments = message.attachments?.length ?? 0;
  const toolCalls = message.toolCalls?.length ?? 0;
  const contentLines = Math.max(1, Math.ceil(message.content.length / 110));
  if (attachments > 0) return 220 + Math.min(180, contentLines * 20);
  if (toolCalls > 0) return 160 + Math.min(240, contentLines * 22);
  if (message.thinking) return 100 + Math.min(160, contentLines * 20);
  return 64 + Math.min(180, contentLines * 22);
}

function MessageGroup(props: {
  message: Message;
  assistantName?: string;
  assistantInitial?: string;
  loadAttachmentUrl?: (attachment: Attachment) => Promise<string>;
  onFork?: (turnID: string) => void;
  onRollback?: (message: Message) => void;
  rowRef?: (el: HTMLDivElement) => void;
  style?: JSX.CSSProperties;
}) {
  return (
    <div
      class="natalia-message-group"
      data-role={props.message.role}
      data-message-id={props.message.id}
      ref={props.rowRef}
      style={props.style}
    >
      <MessageRow
        message={props.message}
        assistantName={props.assistantName}
        assistantInitial={props.assistantInitial}
        loadAttachmentUrl={props.loadAttachmentUrl}
      />
      <Show when={props.message.role !== "system"}>
        <div class="natalia-message-group-actions">
          <button
            type="button"
            class="natalia-message-icon-btn"
            title="复制内容"
            onClick={() =>
              navigator.clipboard?.writeText(props.message.content)
            }
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect
                x="5.5"
                y="5.5"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.3"
              />
              <path
                d="M10.5 4.5H11.5A1.5 1.5 0 0 1 13 6V11"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
            </svg>
            <span>复制</span>
          </button>
          <Show when={props.onFork && sessionTurnID(props.message.id)}>
            <button
              type="button"
              class="natalia-message-icon-btn"
              title="从此消息 Fork 会话"
              onClick={() => props.onFork?.(sessionTurnID(props.message.id)!)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="5"
                  cy="4"
                  r="1.6"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
                <circle
                  cx="5"
                  cy="12"
                  r="1.6"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
                <circle
                  cx="11"
                  cy="12"
                  r="1.6"
                  stroke="currentColor"
                  stroke-width="1.2"
                />
                <path
                  d="M5 5.6V10.4M5 10.4H11"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                />
              </svg>
              <span>Fork</span>
            </button>
          </Show>
          <Show when={props.onRollback}>
            <button
              type="button"
              class="natalia-message-icon-btn"
              title="回滚到此处"
              onClick={() => props.onRollback?.(props.message)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6.5 3.5L3 7L6.5 10.5"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M7 7H13"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                />
                <path
                  d="M11 4.5L13 7L11 9.5"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>回滚</span>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
export interface MessageRowProps {
  message: Message;
  assistantName?: string;
  assistantInitial?: string;
  loadAttachmentUrl?: (attachment: Attachment) => Promise<string>;
}

function imageBox(attachment: Attachment) {
  const width = attachment.width ?? 160;
  const height = attachment.height ?? 120;
  const scale = Math.min(1, 240 / Math.max(width, height));
  return {
    width: Math.max(48, Math.round(width * scale)),
    height: Math.max(48, Math.round(height * scale)),
  };
}

function AttachmentImage(props: {
  attachment: Attachment;
  load?: (attachment: Attachment) => Promise<string>;
}) {
  const [src, setSrc] = createSignal("");
  const [status, setStatus] = createSignal<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [lightbox, setLightbox] = createSignal(false);
  const box = imageBox(props.attachment);
  const load = () => {
    const type = props.attachment.mediaType ?? "";
    if (!type.startsWith("image/") || !props.load) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    void props
      .load(props.attachment)
      .then((value) => {
        setSrc(value);
        setStatus("loaded");
      })
      .catch(() => setStatus("error"));
  };
  onMount(load);

  const placeholder = () => (
    <button
      type="button"
      class="natalia-message-attachment-placeholder"
      style={{
        width: `${box.width}px`,
        height: `${box.height}px`,
      }}
      title={
        status() === "error" ? "加载失败，点击重试" : props.attachment.name
      }
      onClick={() => {
        if (status() === "error") load();
      }}
    >
      <Show when={status() === "loading"}>加载中…</Show>
      <Show when={status() === "error"}>加载失败 · 重试</Show>
      <Show when={status() === "idle"}>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          class="natalia-message-attachment-icon"
        >
          <path
            d="M8.5 3.5L11.5 6.5L8.5 9.5M4.5 6.5H11.5"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{props.attachment.name}</span>
      </Show>
    </button>
  );

  return (
    <>
      <Show when={status() === "loaded" && src()} fallback={placeholder()}>
        <button
          type="button"
          class="natalia-message-image-button"
          onClick={() => setLightbox(true)}
        >
          <img
            class="natalia-message-image"
            src={src()}
            alt={props.attachment.name}
            width={box.width}
            height={box.height}
            loading="lazy"
          />
        </button>
      </Show>
      <Show when={lightbox()}>
        <div
          class="natalia-message-lightbox"
          style={{
            position: "fixed",
            inset: "0",
            "z-index": "80",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            padding: "24px",
            background: "rgba(0,0,0,0.78)",
            cursor: "zoom-out",
          }}
          onClick={() => setLightbox(false)}
        >
          <img
            src={src()}
            alt={props.attachment.name}
            style={{
              "max-width": "min(92vw, 1200px)",
              "max-height": "92vh",
              "object-fit": "contain",
            }}
          />
        </div>
      </Show>
    </>
  );
}

function sessionTurnID(messageID: string) {
  if (!messageID.startsWith("turn_")) return undefined;
  return messageID.replace(/:(?:user|assistant|thinking|system)$/u, "");
}

export function MessageRow(props: MessageRowProps) {
  const isUser = () => props.message.role === "user";
  const isSystem = () => props.message.role === "system";

  return (
    <article
      class="natalia-message"
      data-role={props.message.role}
      data-message-id={props.message.id}
    >
      <div class="natalia-message-header">
        <div class="natalia-message-avatar" data-role={props.message.role}>
          {isUser() ? "U" : isSystem() ? "S" : (props.assistantInitial ?? "N")}
        </div>
        <div class="natalia-message-meta">
          <span class="natalia-message-author">
            {isUser()
              ? "You"
              : isSystem()
                ? "System"
                : (props.assistantName ?? "Natalia")}
          </span>
          <span class="natalia-message-time">
            {props.message.timestamp ?? ""}
          </span>
        </div>
        <Show when={props.message.steering}>
          <span
            class="natalia-badge natalia-badge-steering"
            title="运行中注入当前轮"
          >
            已注入
          </span>
        </Show>
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
        when={props.message.attachments && props.message.attachments.length > 0}
      >
        <div class="natalia-message-attachments">
          <For each={props.message.attachments ?? []}>
            {(attachment) => (
              <AttachmentImage
                attachment={attachment}
                load={props.loadAttachmentUrl}
              />
            )}
          </For>
        </div>
      </Show>

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
