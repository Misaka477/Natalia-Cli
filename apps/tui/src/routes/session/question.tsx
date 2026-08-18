import { TextareaRenderable } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { createStore } from "solid-js/store";
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { useToast } from "../../context/toast";
import { themeTokens as darkTheme } from "../../theme/theme";
import { useModeStack } from "../../modal/mode-stack";

const MODE = "question";

export function QuestionPrompt(props: {
  request: Extract<ModalRequest, { kind: "question" }>;
  backend: RuntimeClient;
  onExit(): void;
}) {
  // Inline bottom card: registering the mode here (rather than through an
  // overlay surface) gates the prompt's keys for as long as it is mounted and
  // releases them when it resolves, keeping the timeline visible above it.
  const modes = useModeStack();
  onMount(() => {
    const release = modes.push(MODE);
    onCleanup(release);
  });
  const renderer = useRenderer();
  const toast = useToast();
  const questions = () => props.request.questions ?? [];
  const single = () =>
    questions().length === 1 && questions()[0]?.multiple !== true;
  const tabs = () => (single() ? 1 : questions().length + 1);
  const [tabHover, setTabHover] = createSignal<number | "confirm" | null>(null);
  const [store, setStore] = createStore({
    tab: 0,
    answers: [] as string[][],
    custom: [] as string[],
    selected: 0,
    editing: false,
  });

  let textarea: TextareaRenderable | undefined;

  const question = () => questions()[store.tab];
  const confirm = () => !single() && store.tab === questions().length;
  const options = () => question()?.options ?? [];
  const custom = () => question()?.custom !== false;
  const other = () => custom() && store.selected === options().length;
  const input = () => store.custom[store.tab] ?? "";
  const multi = () => question()?.multiple === true;
  const customPicked = () => {
    const value = input();
    if (!value) return false;
    return store.answers[store.tab]?.includes(value) ?? false;
  };

  function submit() {
    // Answers are read out of the Solid store, whose elements are deep
    // proxies. Structured-clone (postMessage) cannot clone them, so they must
    // be flattened to plain arrays before the response leaves the TUI.
    deliver(
      {
        requestID: props.request.id,
        answers: questions().map((_, index) => {
          const answer = store.answers[index];
          return answer ? [...answer] : [];
        }),
      },
      "answer",
    );
  }

  function reject() {
    deliver(
      {
        requestID: props.request.id,
        answers: [],
        rejected: true,
      },
      "dismissal",
    );
  }

  // The runtime worker can go away underneath the TUI (e.g. the provider
  // connection drops and the worker exits). A rejected delivery must never
  // become an unhandled rejection that takes the whole TUI down: surface it,
  // keep the card open, and let the human retry.
  function deliver(
    response: Parameters<NonNullable<RuntimeClient["respondQuestion"]>>[0],
    verb: string,
  ) {
    const outcome = props.backend.respondQuestion?.(response);
    if (outcome instanceof Promise)
      void outcome.catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        toast.show({
          variant: "error",
          message: `Your ${verb} could not be delivered: ${detail}`.slice(
            0,
            160,
          ),
        });
      });
  }

  function pick(answer: string, customAnswer = false) {
    const answers = [...store.answers];
    answers[store.tab] = [answer];
    setStore("answers", answers);
    if (customAnswer) {
      const inputs = [...store.custom];
      inputs[store.tab] = answer;
      setStore("custom", inputs);
    }
    if (single()) {
      submit();
      return;
    }
    setStore("tab", store.tab + 1);
    setStore("selected", 0);
  }

  function toggle(answer: string) {
    const existing = store.answers[store.tab] ?? [];
    const next = [...existing];
    const index = next.indexOf(answer);
    if (index === -1) next.push(answer);
    if (index !== -1) next.splice(index, 1);
    const answers = [...store.answers];
    answers[store.tab] = next;
    setStore("answers", answers);
  }

  function moveTo(index: number) {
    setStore("selected", index);
  }

  function selectTab(index: number) {
    setStore("tab", index);
    setStore("selected", 0);
  }

  function selectOption() {
    if (other()) {
      setStore("editing", true);
      return;
    }
    const option = options()[store.selected];
    if (!option) return;
    if (multi()) {
      toggle(option.label);
      return;
    }
    pick(option.label);
  }

  useBindings(() => ({
    mode: MODE,
    enabled: store.editing && !confirm(),
    bindings: [
      {
        key: "escape",
        desc: "Cancel answer edit",
        group: "Question",
        cmd: () => setStore("editing", false),
      },
      {
        key: "return",
        desc: "Submit answer edit",
        group: "Question",
        cmd: () => {
          const text = textarea?.plainText?.trim() ?? "";
          const previous = store.custom[store.tab];

          if (!text) {
            if (previous) {
              const inputs = [...store.custom];
              inputs[store.tab] = "";
              setStore("custom", inputs);
              const answers = [...store.answers];
              answers[store.tab] = (answers[store.tab] ?? []).filter(
                (value) => value !== previous,
              );
              setStore("answers", answers);
            }
            setStore("editing", false);
            return;
          }

          if (multi()) {
            const inputs = [...store.custom];
            inputs[store.tab] = text;
            setStore("custom", inputs);
            const existing = store.answers[store.tab] ?? [];
            const next = [...existing];
            if (previous) {
              const index = next.indexOf(previous);
              if (index !== -1) next.splice(index, 1);
            }
            if (!next.includes(text)) next.push(text);
            const answers = [...store.answers];
            answers[store.tab] = next;
            setStore("answers", answers);
            setStore("editing", false);
            return;
          }

          pick(text, true);
          setStore("editing", false);
        },
      },
    ],
  }));

  useBindings(() => {
    const total = options().length + (custom() ? 1 : 0);
    const max = Math.min(total, 9);
    return {
      mode: MODE,
      enabled: !store.editing,
      bindings: [
        {
          key: "left",
          desc: "Previous question",
          group: "Question",
          cmd: () => selectTab((store.tab - 1 + tabs()) % tabs()),
        },
        {
          key: "h",
          desc: "Previous question",
          group: "Question",
          cmd: () => selectTab((store.tab - 1 + tabs()) % tabs()),
        },
        {
          key: "right",
          desc: "Next question",
          group: "Question",
          cmd: () => selectTab((store.tab + 1) % tabs()),
        },
        {
          key: "l",
          desc: "Next question",
          group: "Question",
          cmd: () => selectTab((store.tab + 1) % tabs()),
        },
        {
          key: "tab",
          desc: "Next question",
          group: "Question",
          cmd: () => selectTab((store.tab + 1) % tabs()),
        },
        ...(confirm()
          ? [
              {
                key: "return",
                desc: "Submit answer",
                group: "Question",
                cmd: () => submit(),
              },
              {
                key: "escape",
                desc: "Dismiss question",
                group: "Question",
                cmd: () => reject(),
              },
            ]
          : [
              ...Array.from({ length: max }, (_, index) => ({
                key: String(index + 1),
                desc: `Select answer ${index + 1}`,
                group: "Question",
                cmd: () => {
                  moveTo(index);
                  selectOption();
                },
              })),
              {
                key: "up",
                desc: "Previous answer",
                group: "Question",
                cmd: () => moveTo((store.selected - 1 + total) % total),
              },
              {
                key: "k",
                desc: "Previous answer",
                group: "Question",
                cmd: () => moveTo((store.selected - 1 + total) % total),
              },
              {
                key: "down",
                desc: "Next answer",
                group: "Question",
                cmd: () => moveTo((store.selected + 1) % total),
              },
              {
                key: "j",
                desc: "Next answer",
                group: "Question",
                cmd: () => moveTo((store.selected + 1) % total),
              },
              {
                key: "return",
                desc: "Select answer",
                group: "Question",
                cmd: () => selectOption(),
              },
              {
                key: "escape",
                desc: "Dismiss question",
                group: "Question",
                cmd: () => reject(),
              },
            ]),
      ],
    };
  });

  return (
    <box
      flexShrink={0}
      backgroundColor={darkTheme.panel}
      border={["left"]}
      borderColor={darkTheme.accent}
    >
      <box
        gap={1}
        paddingLeft={1}
        paddingRight={3}
        paddingTop={1}
        paddingBottom={1}
      >
        <Show when={!single()}>
          <box flexDirection="row" gap={1} paddingLeft={1}>
            <For each={questions()}>
              {(item, index) => (
                <box
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={
                    index() === store.tab
                      ? darkTheme.accent
                      : tabHover() === index()
                        ? darkTheme.background
                        : darkTheme.panel
                  }
                  onMouseOver={() => setTabHover(index())}
                  onMouseOut={() => setTabHover(null)}
                  onMouseUp={() => {
                    if (renderer.getSelection()?.getSelectedText()) return;
                    selectTab(index());
                  }}
                >
                  <text
                    fg={
                      index() === store.tab
                        ? onAccentText()
                        : (store.answers[index()]?.length ?? 0) > 0
                          ? darkTheme.text
                          : darkTheme.muted
                    }
                  >
                    {item.header}
                  </text>
                </box>
              )}
            </For>
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={
                confirm()
                  ? darkTheme.accent
                  : tabHover() === "confirm"
                    ? darkTheme.background
                    : darkTheme.panel
              }
              onMouseOver={() => setTabHover("confirm")}
              onMouseOut={() => setTabHover(null)}
              onMouseUp={() => {
                if (renderer.getSelection()?.getSelectedText()) return;
                selectTab(questions().length);
              }}
            >
              <text fg={confirm() ? onAccentText() : darkTheme.muted}>
                Confirm
              </text>
            </box>
          </box>
        </Show>

        <Show when={!confirm()}>
          <box paddingLeft={1} gap={1} flexShrink={0}>
            <box flexShrink={0}>
              <text fg={darkTheme.text}>
                {question()?.question}
                {multi() ? " (select all that apply)" : ""}
              </text>
            </box>
            <box>
              <For each={options()}>
                {(option, index) => {
                  const active = () => index() === store.selected;
                  const picked = () =>
                    store.answers[store.tab]?.includes(option.label) ?? false;
                  return (
                    <box
                      flexShrink={0}
                      onMouseOver={() => moveTo(index())}
                      onMouseDown={() => moveTo(index())}
                      onMouseUp={() => {
                        if (renderer.getSelection()?.getSelectedText()) return;
                        selectOption();
                      }}
                    >
                      <box flexDirection="row">
                        <box
                          backgroundColor={
                            active() ? darkTheme.background : undefined
                          }
                          paddingRight={1}
                        >
                          <text
                            fg={active() ? darkTheme.accent : darkTheme.muted}
                          >
                            {`${index() + 1}.`}
                          </text>
                        </box>
                        <box
                          backgroundColor={
                            active() ? darkTheme.background : undefined
                          }
                        >
                          <text
                            fg={
                              active()
                                ? darkTheme.accent
                                : picked()
                                  ? darkTheme.success
                                  : darkTheme.text
                            }
                          >
                            {multi()
                              ? `[${picked() ? "✓" : " "}] ${option.label}`
                              : option.label}
                          </text>
                        </box>
                        <Show when={!multi() && picked()}>
                          <text fg={darkTheme.success}> ✓</text>
                        </Show>
                      </box>
                      <Show when={option.description}>
                        <box paddingLeft={3}>
                          <text fg={darkTheme.muted}>{option.description}</text>
                        </box>
                      </Show>
                    </box>
                  );
                }}
              </For>
              <Show when={custom()}>
                <box
                  flexShrink={0}
                  onMouseOver={() => moveTo(options().length)}
                  onMouseDown={() => moveTo(options().length)}
                  onMouseUp={() => {
                    if (renderer.getSelection()?.getSelectedText()) return;
                    selectOption();
                  }}
                >
                  <box flexDirection="row">
                    <box
                      backgroundColor={
                        other() ? darkTheme.background : undefined
                      }
                      paddingRight={1}
                    >
                      <text fg={other() ? darkTheme.accent : darkTheme.muted}>
                        {`${options().length + 1}.`}
                      </text>
                    </box>
                    <box
                      backgroundColor={
                        other() ? darkTheme.background : undefined
                      }
                    >
                      <text
                        fg={
                          other()
                            ? darkTheme.accent
                            : customPicked()
                              ? darkTheme.success
                              : darkTheme.text
                        }
                      >
                        {multi()
                          ? `[${customPicked() ? "✓" : " "}] Type your own answer`
                          : "Type your own answer"}
                      </text>
                    </box>
                    <Show when={!multi() && customPicked()}>
                      <text fg={darkTheme.success}> ✓</text>
                    </Show>
                  </box>
                  <Show when={store.editing}>
                    <box paddingLeft={3}>
                      <textarea
                        ref={(value: TextareaRenderable) => {
                          textarea = value;
                          value.traits = { status: "ANSWER" };
                          queueMicrotask(() => value.focus());
                        }}
                        initialValue={input()}
                        placeholder="Type your own answer"
                        placeholderColor={darkTheme.muted}
                        minHeight={1}
                        maxHeight={6}
                        textColor={darkTheme.text}
                        focusedTextColor={darkTheme.text}
                        cursorColor={darkTheme.accent}
                      />
                    </box>
                  </Show>
                  <Show when={!store.editing && input()}>
                    <box paddingLeft={3}>
                      <text fg={darkTheme.muted}>{input()}</text>
                    </box>
                  </Show>
                </box>
              </Show>
            </box>
          </box>
        </Show>

        <Show when={confirm() && !single()}>
          <box paddingLeft={1}>
            <text fg={darkTheme.text}>Review</text>
          </box>
          <For each={questions()}>
            {(item, index) => {
              const value = () => store.answers[index()]?.join(", ") ?? "";
              return (
                <box paddingLeft={1}>
                  <text>
                    <span style={{ fg: darkTheme.muted }}>{item.header}:</span>{" "}
                    <span
                      style={{
                        fg: value() ? darkTheme.text : darkTheme.danger,
                      }}
                    >
                      {value() ? value() : "(not answered)"}
                    </span>
                  </text>
                </box>
              );
            }}
          </For>
        </Show>
      </box>
      <box
        flexDirection="row"
        flexShrink={0}
        gap={1}
        paddingLeft={2}
        paddingRight={3}
        paddingBottom={1}
      >
        <Show when={!single()}>
          <text fg={darkTheme.text}>
            {"⇆"} <span style={{ fg: darkTheme.muted }}>tab</span>
          </text>
        </Show>
        <Show when={!confirm()}>
          <text fg={darkTheme.text}>
            {"↑↓"} <span style={{ fg: darkTheme.muted }}>select</span>
          </text>
        </Show>
        <text fg={darkTheme.text}>
          enter{" "}
          <span style={{ fg: darkTheme.muted }}>
            {confirm()
              ? "submit"
              : multi()
                ? "toggle"
                : single()
                  ? "submit"
                  : "confirm"}
          </span>
        </text>
        <text fg={darkTheme.text}>
          esc <span style={{ fg: darkTheme.muted }}>dismiss</span>
        </text>
      </box>
    </box>
  );
}

/** Foreground readable on an accent-filled tab, for either theme mode. */
function onAccentText() {
  const hex = darkTheme.accent.slice(1);
  const rgb = [0, 2, 4].map((index) =>
    parseInt(hex.slice(index, index + 2), 16),
  );
  const luminance =
    (0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!) / 255;
  return luminance > 0.5 ? darkTheme.background : darkTheme.text;
}
