import { For, Show, createSignal } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";

type QuestionItem = {
  id?: string;
  header?: string;
  question?: string;
  options?: Array<{ label: string; description?: string }>;
  multiple?: boolean;
  custom?: boolean;
};

export function QuestionPanel(props: {
  open: boolean;
  request: {
    id: string;
    title: string;
    questions?: QuestionItem[];
  } | null;
  runtime?: Pick<RuntimeClient, "respondQuestion">;
  onClose: () => void;
}) {
  const [answers, setAnswers] = createSignal<string[][]>([]);

  function toggleOption(qIndex: number, option: string, multiple?: boolean) {
    const current = [...answers()];
    const existing = [...(current[qIndex] ?? [])];
    if (multiple) {
      const next = existing.includes(option)
        ? existing.filter((item) => item !== option)
        : [...existing, option];
      current[qIndex] = next;
    } else {
      current[qIndex] = [option];
    }
    setAnswers(current);
  }

  function setCustom(qIndex: number, value: string) {
    const current = [...answers()];
    current[qIndex] = [value];
    setAnswers(current);
  }

  function submit() {
    if (!props.request) return;
    props.runtime?.respondQuestion?.({
      requestID: props.request.id,
      answers: answers(),
    });
    props.onClose();
  }

  function reject() {
    if (!props.request) return;
    props.runtime?.respondQuestion?.({
      requestID: props.request.id,
      answers: [],
      rejected: true,
    });
    props.onClose();
  }

  return (
    <Show when={props.open && props.request}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div
          class="neu-permission-window"
          onClick={(event) => event.stopPropagation()}
        >
          <div class="neu-settings-header">
            <span class="neu-settings-title">
              {props.request?.title ?? "问题"}
            </span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭问题"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="neu-permission-body">
            <For each={props.request?.questions ?? []}>
              {(question, index) => (
                <div class="neu-question-item">
                  <div class="neu-question-header">
                    {question.header}
                  </div>
                  <div class="neu-permission-command">
                    <div class="neu-permission-label">问题</div>
                    <div class="neu-permission-command-text">
                      {question.question}
                    </div>
                  </div>
                  <div class="neu-question-options">
                    <For each={question.options}>
                      {(option) => (
                        <button
                          type="button"
                          class="neu-permission-btn"
                          classList={{
                            "neu-question-option-active": (
                              answers()[index()] ?? []
                            ).includes(option.label),
                          }}
                          onClick={() =>
                            toggleOption(
                              index(),
                              option.label,
                              question.multiple,
                            )
                          }
                        >
                          <span>{option.label}</span>
                          {option.description ? (
                            <span class="neu-question-option-description">
                              {option.description}
                            </span>
                          ) : null}
                        </button>
                      )}
                    </For>
                    <Show when={question.custom}>
                      <input
                        class="neu-question-custom"
                        placeholder="输入自定义回答"
                        value={(answers()[index()] ?? [])[0] ?? ""}
                        onInput={(event) =>
                          setCustom(index(), event.currentTarget.value)
                        }
                      />
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
          <div class="neu-permission-actions">
            <button
              type="button"
              class="neu-permission-btn neu-permission-deny"
              onClick={reject}
            >
              拒绝
            </button>
            <button
              type="button"
              class="neu-permission-btn neu-permission-allow"
              onClick={submit}
            >
              提交回答
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
