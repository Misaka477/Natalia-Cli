import { TextareaRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { usePromptRef } from "../../context/prompt";
import { useModeStack } from "../../modal/mode-stack";
import { darkTheme } from "../../theme/theme";

const MODE = "question";

export function QuestionPrompt(props: {
  request: Extract<ModalRequest, { kind: "question" }>;
  backend: RuntimeClient;
  onExit(): void;
}) {
  const [tab, setTab] = createSignal(0);
  const [selected, setSelected] = createSignal(0);
  const [editing, setEditing] = createSignal(false);
  const [answers, setAnswers] = createSignal<string[][]>([]);
  const [custom, setCustom] = createSignal<string[]>([]);
  const prompt = usePromptRef();
  const modes = useModeStack();
  let input: TextareaRenderable | undefined;
  const questions = () => props.request.questions ?? [];
  const single = () => questions().length === 1 && !questions()[0]?.multiple;
  const confirm = () => !single() && tab() === questions().length;
  const question = () => questions()[tab()];
  const options = () => question()?.options ?? [];
  const customEnabled = () => question()?.custom !== false;
  const total = () => options().length + (customEnabled() ? 1 : 0);

  onMount(() => {
    const pop = modes.push(MODE);
    onCleanup(pop);
  });

  useBindings(() => ({
    mode: MODE,
    enabled: editing(),
    bindings: [
      {
        key: "escape",
        desc: "Cancel answer edit",
        group: "Question",
        cmd: () => setEditing(false),
      },
      {
        key: "return",
        desc: "Submit answer edit",
        group: "Question",
        cmd: () => submitCustom(),
      },
    ],
  }));

  useBindings(() => ({
    mode: MODE,
    enabled: !editing(),
    bindings: [
      {
        key: "left",
        desc: "Previous question",
        group: "Question",
        cmd: () => selectTab(tab() - 1),
      },
      {
        key: "h",
        desc: "Previous question",
        group: "Question",
        cmd: () => selectTab(tab() - 1),
      },
      {
        key: "right",
        desc: "Next question",
        group: "Question",
        cmd: () => selectTab(tab() + 1),
      },
      {
        key: "l",
        desc: "Next question",
        group: "Question",
        cmd: () => selectTab(tab() + 1),
      },
      {
        key: "tab",
        desc: "Next question",
        group: "Question",
        cmd: () => selectTab(tab() + 1),
      },
      {
        key: "up",
        desc: "Previous answer",
        group: "Question",
        cmd: () => setSelected((selected() - 1 + total()) % total()),
      },
      {
        key: "k",
        desc: "Previous answer",
        group: "Question",
        cmd: () => setSelected((selected() - 1 + total()) % total()),
      },
      {
        key: "down",
        desc: "Next answer",
        group: "Question",
        cmd: () => setSelected((selected() + 1) % total()),
      },
      {
        key: "j",
        desc: "Next answer",
        group: "Question",
        cmd: () => setSelected((selected() + 1) % total()),
      },
      {
        key: "return",
        desc: "Select answer",
        group: "Question",
        cmd: () => select(),
      },
      {
        key: "escape",
        desc: "Reject question",
        group: "Question",
        cmd: reject,
      },
      ...Array.from({ length: Math.min(total(), 9) }, (_, index) => ({
        key: String(index + 1),
        desc: `Select answer ${index + 1}`,
        group: "Question",
        cmd: () => select(index),
      })),
    ],
  }));

  function setAnswer(index: number, value: string[]) {
    const next = [...answers()];
    next[index] = value;
    setAnswers(next);
  }

  function selectTab(index: number) {
    const count = questions().length + (single() ? 0 : 1);
    setTab((index + count) % count);
    setSelected(0);
    setEditing(false);
  }

  function select(index = selected()) {
    if (confirm()) return submit();
    setSelected(index);
    if (index === options().length && customEnabled()) {
      setEditing(true);
      queueMicrotask(() => input?.focus());
      return;
    }
    const answer = options()[index]?.label;
    if (!answer) return;
    if (question()?.multiple) {
      const current = answers()[tab()] ?? [];
      setAnswer(
        tab(),
        current.includes(answer)
          ? current.filter((item) => item !== answer)
          : [...current, answer],
      );
      return;
    }
    setAnswer(tab(), [answer]);
    if (single()) return submit();
    selectTab(tab() + 1);
  }

  function submitCustom() {
    const value = input?.plainText.trim() ?? "";
    setEditing(false);
    if (!value) return;
    const next = [...custom()];
    next[tab()] = value;
    setCustom(next);
    const current = answers()[tab()] ?? [];
    if (question()?.multiple) {
      setAnswer(tab(), current.includes(value) ? current : [...current, value]);
      return;
    }
    setAnswer(tab(), [value]);
    if (single()) return submit();
    selectTab(tab() + 1);
  }

  function submit() {
    props.backend.respondQuestion({
      requestID: props.request.id,
      answers: questions().map((_, index) => answers()[index] ?? []),
    });
    queueMicrotask(() => prompt.focus());
  }

  function reject() {
    props.backend.respondQuestion({
      requestID: props.request.id,
      answers: [],
      rejected: true,
    });
    queueMicrotask(() => prompt.focus());
  }

  return (
    <box
      backgroundColor={darkTheme.panel}
      border={["left"]}
      borderColor={darkTheme.accent}
      flexDirection="column"
    >
      <box
        flexDirection="column"
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <Show when={!single()}>
          <box flexDirection="row" gap={1}>
            <For each={questions()}>
              {(item, index) => (
                <text
                  fg={index() === tab() ? darkTheme.accent : darkTheme.muted}
                >
                  {item.header}
                  {answers()[index()]?.length ? " *" : ""}
                </text>
              )}
            </For>
            <text fg={confirm() ? darkTheme.accent : darkTheme.muted}>
              Confirm
            </text>
          </box>
        </Show>
        <Show
          when={!confirm()}
          fallback={<Review questions={questions()} answers={answers()} />}
        >
          <text fg={darkTheme.text} wrapMode="word">
            {question()?.question}
            {question()?.multiple ? " (select all that apply)" : ""}
          </text>
          <For each={options()}>
            {(option, index) => (
              <Option
                index={index()}
                selected={selected() === index()}
                picked={(answers()[tab()] ?? []).includes(option.label)}
                multiple={question()?.multiple === true}
                label={option.label}
                description={option.description}
                onSelect={() => select(index())}
              />
            )}
          </For>
          <Show when={customEnabled()}>
            <Option
              index={options().length}
              selected={selected() === options().length}
              picked={Boolean(
                custom()[tab()] &&
                  (answers()[tab()] ?? []).includes(custom()[tab()]!),
              )}
              multiple={question()?.multiple === true}
              label="Type your own answer"
              description={custom()[tab()]}
              onSelect={() => select(options().length)}
            />
            <Show when={editing()}>
              <textarea
                ref={(value: TextareaRenderable) => {
                  input = value;
                  value.traits = { status: "ANSWER" };
                }}
                focused
                initialValue={custom()[tab()] ?? ""}
                placeholder="Type your own answer"
                placeholderColor={darkTheme.muted}
                textColor={darkTheme.text}
                focusedTextColor={darkTheme.text}
                cursorColor={darkTheme.accent}
              />
            </Show>
          </Show>
        </Show>
      </box>
      <box
        flexDirection="row"
        gap={2}
        paddingLeft={2}
        paddingRight={2}
        paddingBottom={1}
      >
        <text fg={darkTheme.muted}>
          ↑↓ select · ←→ tab · enter confirm · esc reject
        </text>
      </box>
    </box>
  );
}

function Option(props: {
  index: number;
  selected: boolean;
  picked: boolean;
  multiple: boolean;
  label: string;
  description?: string;
  onSelect(): void;
}) {
  return (
    <box flexDirection="column" onMouseUp={props.onSelect}>
      <text
        fg={
          props.selected
            ? darkTheme.accent
            : props.picked
              ? darkTheme.success
              : darkTheme.text
        }
      >
        {props.index + 1}.{" "}
        {props.multiple ? `[${props.picked ? "x" : " "}] ` : ""}
        {props.label}
      </text>
      <Show when={props.description}>
        <text fg={darkTheme.muted} paddingLeft={3} wrapMode="word">
          {props.description}
        </text>
      </Show>
    </box>
  );
}

function Review(props: {
  questions: Array<{ header: string }>;
  answers: string[][];
}) {
  return (
    <box flexDirection="column">
      <text fg={darkTheme.text}>Review</text>
      <For each={props.questions}>
        {(item, index) => (
          <text
            fg={
              props.answers[index()]?.length ? darkTheme.text : darkTheme.danger
            }
          >
            {item.header}:{" "}
            {props.answers[index()]?.join(", ") || "(not answered)"}
          </text>
        )}
      </For>
    </box>
  );
}
