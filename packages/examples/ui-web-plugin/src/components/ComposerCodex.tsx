import { For, Show, type JSX, createSignal, onMount } from "solid-js";

export interface ComposerCodexProps {
  value: string;
  placeholder?: string;
  busy?: boolean;
  disabled?: boolean;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  attachments?: string[];
  onAddAttachment?: () => void;
  onRemoveAttachment?: (path: string) => void;
  onPaste?: (event: ClipboardEvent) => void;
  children?: JSX.Element;
}

export function ComposerCodex(props: ComposerCodexProps) {
  let textareaRef: HTMLTextAreaElement | undefined;

  onMount(() => {
    adjustHeight();
  });

  function adjustHeight() {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + "px";
  }

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLTextAreaElement;
    props.onInput(target.value);
    adjustHeight();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (props.value.trim() && !props.busy && !props.disabled) {
        props.onSubmit();
        setTimeout(() => adjustHeight(), 0);
      }
    }
  }

  function handleSubmit() {
    if (props.busy && props.onStop) {
      props.onStop();
    } else if (props.value.trim()) {
      props.onSubmit();
      setTimeout(() => adjustHeight(), 0);
    }
  }

  return (
    <div class="codex-input-container">
      <div class="codex-input-wrapper">
        <div class="codex-input">
          <Show when={props.attachments && props.attachments.length > 0}>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "var(--space-2)" }}>
              <For each={props.attachments}>
                {(attachment) => (
                  <div class="codex-attachment">
                    <svg class="codex-attachment-icon" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8.5 3.5L11.5 6.5L8.5 9.5M4.5 6.5H11.5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    <span class="codex-attachment-name">
                      {attachment.split("/").pop()}
                    </span>
                    <button
                      type="button"
                      class="codex-attachment-remove"
                      onClick={() => props.onRemoveAttachment?.(attachment)}
                      aria-label="移除附件"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M9 3L3 9M3 3L9 9"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <textarea
            ref={textareaRef}
            value={props.value}
            placeholder={props.placeholder ?? "输入消息..."}
            disabled={props.disabled}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={props.onPaste}
            rows={1}
          />

          <div class="codex-input-toolbar">
            {props.children}
            <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "var(--space-2)" }}>
              <Show when={props.onAddAttachment}>
                <button
                  type="button"
                  class="codex-icon-btn"
                  onClick={props.onAddAttachment}
                  disabled={props.disabled}
                  title="添加附件"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M17 9V13C17 15.2091 15.2091 17 13 17H7C4.79086 17 3 15.2091 3 13V7C3 4.79086 4.79086 3 7 3H11"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                    <path
                      d="M14 3H17M17 3V6M17 3L11 9"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </Show>
              <button
                type="button"
                class="codex-send-btn"
                data-busy={props.busy}
                onClick={handleSubmit}
                disabled={props.disabled || (!props.busy && !props.value.trim())}
                title={props.busy ? "停止" : "发送"}
              >
                <Show
                  when={props.busy}
                  fallback={
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M16 9L3 16V2L16 9Z"
                        fill="currentColor"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linejoin="round"
                      />
                    </svg>
                  }
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="3"
                      y="3"
                      width="10"
                      height="10"
                      rx="2"
                      fill="currentColor"
                    />
                  </svg>
                </Show>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
