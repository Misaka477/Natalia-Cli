import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  type JSX,
} from "solid-js";
import { TextareaRenderable, TextAttributes } from "@opentui/core";
import type { RuntimeClient } from "@natalia/contracts";
import { activeModal, type ModalRequest } from "@natalia/ui-model";
import { useAppState } from "../context/state";
import { darkTheme } from "../theme/theme";
import { setModalKeyHandler } from "../modal/key-handler";

export function DialogLayer(props: {
  backend: RuntimeClient;
  onExit: () => void;
}) {
  const { state, dispatch } = useAppState();
  const modal = createMemo(() => activeModal(state.modal));
  return (
    <Show
      when={modal()}
      keyed
      fallback={
        <PaletteDialog
          open={state.dialog === "palette"}
          onClose={() => dispatch({ type: "dialog.close" })}
        />
      }
    >
      {(request) => (
        <RuntimeModal
          request={request}
          backend={props.backend}
          onExit={props.onExit}
        />
      )}
    </Show>
  );
}

function PaletteDialog(props: { open: boolean; onClose: () => void }) {
  return (
    <Show when={props.open}>
      <DialogFrame title="Command / Palette" tone="accent">
        <text fg={darkTheme.text}>
          Palette placeholder: /long, /retry, /modal, snapshot, cancel.
        </text>
        <text fg={darkTheme.muted}>
          Escape to close dialog and resume normal input.
        </text>
      </DialogFrame>
    </Show>
  );
}

function RuntimeModal(props: {
  request?: ModalRequest;
  backend: RuntimeClient;
  onExit: () => void;
}) {
  if (!props.request) return null;
  if (props.request.kind === "approval") {
    return (
      <ApprovalDialog
        request={props.request}
        backend={props.backend}
        onExit={props.onExit}
      />
    );
  }
  return (
    <QuestionDialog
      request={props.request}
      backend={props.backend}
      onExit={props.onExit}
    />
  );
}

function ApprovalDialog(props: {
  request: Extract<ModalRequest, { kind: "approval" }>;
  backend: RuntimeClient;
  onExit: () => void;
}) {
  const [selected, setSelected] = createSignal(0);
  const [stage, setStage] = createSignal<"decision" | "feedback">("decision");
  const [feedback, setFeedback] = createSignal("");
  const [expanded, setExpanded] = createSignal(false);
  const actions = ["once", "session", "reject"] as const;
  let input: TextareaRenderable | undefined;

  function confirm(
    feedbackOverride = feedback(),
    decision = actions[selected()],
  ) {
    if (decision === "reject" && stage() === "decision") {
      setStage("feedback");
      queueMicrotask(() => input?.focus());
      return;
    }
    queueMicrotask(() =>
      props.backend.respondApproval({
        requestID: props.request.id,
        decision,
        feedback:
          decision === "reject"
            ? feedbackOverride.trim() || undefined
            : undefined,
      }),
    );
  }

  function rejectImmediately() {
    queueMicrotask(() =>
      props.backend.respondApproval({
        requestID: props.request.id,
        decision: "reject",
        feedback: feedback().trim() || "rejected from modal",
      }),
    );
  }

  createEffect(() => {
    setModalKeyHandler((key) => {
      if (stage() === "feedback") {
        if (key === "escape") {
          setStage("decision");
          return true;
        }
        return false;
      }
      if (key === "left" || key === "up") {
        setSelected((selected() + actions.length - 1) % actions.length);
        return true;
      }
      if (key === "right" || key === "down" || key === "tab") {
        setSelected((selected() + 1) % actions.length);
        return true;
      }
      if (/^[1-9]$/.test(key)) {
        const index = Math.min(Number(key) - 1, actions.length - 1);
        setSelected(index);
        confirm(feedback(), actions[index]);
        return true;
      }
      if (key === "return") {
        confirm();
        return true;
      }
      if (key === "escape") {
        rejectImmediately();
        return true;
      }
      if (key === "d") {
        setExpanded((value) => !value);
        return true;
      }
      return false;
    });
    onCleanup(() => setModalKeyHandler(undefined));
  });

  return (
    <DialogFrame title="Approval required" tone="warning">
      <box flexDirection="column" gap={1}>
        <text
          attributes={TextAttributes.BOLD}
          fg={darkTheme.text}
          wrapMode="word"
        >
          {props.request.title}
        </text>
        <text fg={darkTheme.text} wrapMode="word">
          {props.request.preview}
        </text>
        <Show when={props.request.keyArguments?.length}>
          <text fg={darkTheme.muted} wrapMode="word">
            args: {props.request.keyArguments?.join(", ")}
          </text>
        </Show>
        <Show when={props.request.sensitive}>
          <text fg={darkTheme.warning}>sensitive fields are redacted</text>
        </Show>
        <Show when={props.request.detail}>
          <box flexDirection="column">
            <text fg={darkTheme.muted}>
              {expanded() ? "detail pager open" : "detail available"} (d
              toggles)
            </text>
            <Show when={expanded()}>
              <scrollbox
                height={8}
                borderColor={darkTheme.muted}
                border={["left"]}
                paddingLeft={1}
              >
                <text fg={darkTheme.text} wrapMode="word">
                  {props.request.detail}
                </text>
              </scrollbox>
            </Show>
          </box>
        </Show>
        <Show when={stage() === "feedback"}>
          <box flexDirection="column" gap={1}>
            <text fg={darkTheme.muted}>
              Reject feedback does not enter prompt history.
            </text>
            <textarea
              ref={(value: TextareaRenderable) => {
                input = value;
                value.traits = { status: "REJECT" };
                queueMicrotask(() => value.focus());
              }}
              minHeight={1}
              maxHeight={4}
              placeholder="Tell Natalia what to do differently"
              placeholderColor={darkTheme.muted}
              textColor={darkTheme.text}
              focusedTextColor={darkTheme.text}
              cursorColor={darkTheme.warning}
              onKeyDown={(event: ModalKeyEvent) => {
                if (isExitChord(event)) {
                  consumeModalKey(event);
                  props.onExit();
                  return;
                }
                if (
                  normalizeModalKey(event.name ?? event.key ?? "") !== "return"
                )
                  return;
                consumeModalKey(event);
                const text = input?.plainText ?? "";
                setFeedback(text);
                confirm(text);
              }}
            />
          </box>
        </Show>
        <ModalActions
          actions={["Allow once", "Allow session", "Reject"]}
          selected={selected()}
          onSelect={setSelected}
          onConfirm={confirm}
          onQuickSelect={(index) => {
            setSelected(index);
            confirm(feedback(), actions[index]);
          }}
          onCancel={rejectImmediately}
          onToggleDetail={() => setExpanded((value) => !value)}
          onExit={props.onExit}
        />
      </box>
    </DialogFrame>
  );
}

function QuestionDialog(props: {
  request: Extract<ModalRequest, { kind: "question" }>;
  backend: RuntimeClient;
  onExit: () => void;
}) {
  const request = props.request;
  const requestID = request.id;
  const title = request.title;
  const questionItems = request.questions ?? [];
  const [tab, setTab] = createSignal(0);
  const [selected, setSelected] = createSignal(0);
  const [editing, setEditing] = createSignal(false);
  const [custom, setCustom] = createSignal<string[]>([]);
  const [answers, setAnswers] = createSignal<string[][]>([]);
  let input: TextareaRenderable | undefined;
  const questions = () => questionItems;
  const single = () => questions().length === 1 && !questions()[0]?.multiple;
  const confirmTab = () => !single() && tab() === questions().length;
  const question = () => questions()[tab()];
  const options = () => question()?.options ?? [];
  const customEnabled = () => question()?.custom !== false;
  const customSelected = () => selected() === options().length;
  const currentAnswers = () => answers()[tab()] ?? [];

  createEffect(() => {
    setModalKeyHandler((key) => {
      if (editing()) {
        if (key === "escape") {
          setEditing(false);
          return true;
        }
        return false;
      }
      if (key === "up") {
        moveSelected(-1);
        return true;
      }
      if (key === "down") {
        moveSelected(1);
        return true;
      }
      if (key === "left") {
        moveTab(-1);
        return true;
      }
      if (key === "right" || key === "tab") {
        moveTab(1);
        return true;
      }
      if (/^[1-9]$/.test(key)) {
        const max = options().length + (customEnabled() ? 1 : 0);
        selectIndex(Math.min(Number(key) - 1, Math.max(0, max - 1)));
        return true;
      }
      if (key === "return") {
        selectCurrent();
        return true;
      }
      if (key === "escape") {
        reject();
        return true;
      }
      return false;
    });
    onCleanup(() => setModalKeyHandler(undefined));
  });

  function setAnswer(index: number, value: string[]) {
    const next = [...answers()];
    next[index] = value;
    setAnswers(next);
  }

  function pick(value: string) {
    if (question()?.multiple) {
      const existing = currentAnswers();
      setAnswer(
        tab(),
        existing.includes(value)
          ? existing.filter((item) => item !== value)
          : [...existing, value],
      );
      return;
    }
    setAnswer(tab(), [value]);
    if (single()) submit();
    if (!single()) moveTab(1);
  }

  function submitCustom() {
    const text = (input?.plainText ?? "").trim();
    const next = [...custom()];
    if (!text) {
      next[tab()] = "";
      setCustom(next);
      setAnswer(tab(), []);
      setEditing(false);
      return;
    }
    next[tab()] = text;
    setCustom(next);
    pick(text);
    setEditing(false);
  }

  function selectCurrent() {
    selectIndex(selected());
  }

  function selectIndex(index: number) {
    if (confirmTab()) {
      submit();
      return;
    }
    setSelected(index);
    if (index === options().length && customEnabled()) {
      setEditing(true);
      queueMicrotask(() => input?.focus());
      return;
    }
    const option = options()[index];
    if (option) pick(option.label);
  }

  function moveTab(delta: number) {
    const count = questions().length + (single() ? 0 : 1);
    setTab(Math.max(0, Math.min(count - 1, tab() + delta)));
    setSelected(0);
    setEditing(false);
  }

  function moveSelected(delta: number) {
    const max = Math.max(1, options().length + (customEnabled() ? 1 : 0));
    setSelected((selected() + delta + max) % max);
  }

  function submit() {
    const submittedAnswers = questions().map(
      (_, index) => answers()[index] ?? [],
    );
    queueMicrotask(() =>
      props.backend.respondQuestion({
        requestID,
        answers: submittedAnswers,
      }),
    );
  }

  function reject() {
    queueMicrotask(() =>
      props.backend.respondQuestion({
        requestID,
        answers: [],
        rejected: true,
      }),
    );
  }

  return (
    <DialogFrame title={title} tone="accent">
      <box flexDirection="column" gap={1}>
        <Show when={!single()}>
          <box flexDirection="row" gap={1}>
            <For each={questions()}>
              {(item, index) => (
                <text
                  fg={index() === tab() ? darkTheme.accent : darkTheme.muted}
                >
                  {index() === tab() ? "[" : " "}
                  {item.header}
                  {answers()[index()]?.length ? "*" : ""}
                  {index() === tab() ? "]" : " "}
                </text>
              )}
            </For>
            <text fg={confirmTab() ? darkTheme.accent : darkTheme.muted}>
              [Confirm]
            </text>
          </box>
        </Show>
        <Show
          when={!confirmTab()}
          fallback={
            <QuestionReview questions={questions()} answers={answers()} />
          }
        >
          <box flexDirection="column" gap={1}>
            <text fg={darkTheme.text} wrapMode="word">
              {question()?.question}
              {question()?.multiple ? " (select all that apply)" : ""}
            </text>
            <For each={options()}>
              {(option, index) => (
                <QuestionOptionRow
                  index={index()}
                  selected={selected() === index()}
                  picked={currentAnswers().includes(option.label)}
                  multiple={question()?.multiple === true}
                  label={option.label}
                  description={option.description}
                />
              )}
            </For>
            <Show when={customEnabled()}>
              <QuestionOptionRow
                index={options().length}
                selected={customSelected()}
                picked={Boolean(
                  custom()[tab()] && currentAnswers().includes(custom()[tab()]),
                )}
                multiple={question()?.multiple === true}
                label="Type your own answer"
                description={custom()[tab()]}
              />
              <Show when={editing()}>
                <textarea
                  ref={(value: TextareaRenderable) => {
                    input = value;
                    value.traits = { status: "ANSWER" };
                    queueMicrotask(() => value.focus());
                  }}
                  initialValue={custom()[tab()] ?? ""}
                  minHeight={1}
                  maxHeight={4}
                  placeholder="Type your own answer"
                  placeholderColor={darkTheme.muted}
                  textColor={darkTheme.text}
                  focusedTextColor={darkTheme.text}
                  cursorColor={darkTheme.accent}
                  onKeyDown={(event: ModalKeyEvent) => {
                    if (isExitChord(event)) {
                      consumeModalKey(event);
                      props.onExit();
                      return;
                    }
                    const key = normalizeModalKey(
                      event.name ?? event.key ?? "",
                    );
                    if (key === "escape") {
                      consumeModalKey(event);
                      setEditing(false);
                      queueMicrotask(() => input?.blur?.());
                      reject();
                      return;
                    }
                    if (key === "return") {
                      consumeModalKey(event);
                      submitCustom();
                      return;
                    }
                  }}
                />
              </Show>
            </Show>
          </box>
        </Show>
        <QuestionActions
          confirm={confirmTab()}
          editing={editing()}
          multiple={question()?.multiple === true}
          selected={selected()}
          max={options().length + (customEnabled() ? 1 : 0)}
          onMove={(delta) =>
            setSelected(
              (selected() +
                delta +
                Math.max(1, options().length + (customEnabled() ? 1 : 0))) %
                Math.max(1, options().length + (customEnabled() ? 1 : 0)),
            )
          }
          onTab={moveTab}
          onSelect={selectCurrent}
          onQuickSelect={selectIndex}
          onReject={reject}
          onExit={props.onExit}
        />
      </box>
    </DialogFrame>
  );
}

function QuestionOptionRow(props: {
  index: number;
  selected: boolean;
  picked: boolean;
  multiple: boolean;
  label: string;
  description?: string;
}) {
  return (
    <box flexDirection="column">
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

function QuestionReview(props: {
  questions: Array<{ header: string }>;
  answers: string[][];
}) {
  return (
    <box flexDirection="column" gap={1}>
      <text fg={darkTheme.text}>Review answers</text>
      <For each={props.questions}>
        {(question, index) => (
          <text
            fg={
              props.answers[index()]?.length ? darkTheme.text : darkTheme.danger
            }
          >
            {question.header}:{" "}
            {props.answers[index()]?.join(", ") || "(not answered)"}
          </text>
        )}
      </For>
    </box>
  );
}

function ModalActions(props: {
  actions: string[];
  selected: number;
  onSelect(index: number): void;
  onConfirm(): void;
  onQuickSelect(index: number): void;
  onCancel(): void;
  onToggleDetail(): void;
  onExit(): void;
}) {
  return (
    <ModalKeyCapture
      onExit={props.onExit}
      onKey={(key) => {
        if (key === "left" || key === "up")
          props.onSelect(
            (props.selected + props.actions.length - 1) % props.actions.length,
          );
        if (key === "right" || key === "down" || key === "tab")
          props.onSelect((props.selected + 1) % props.actions.length);
        if (/^[1-9]$/.test(key))
          props.onQuickSelect(
            Math.min(Number(key) - 1, props.actions.length - 1),
          );
        if (key === "return") props.onConfirm();
        if (key === "escape") props.onCancel();
        if (key === "d") props.onToggleDetail();
      }}
    >
      <box flexDirection="row" justifyContent="space-between" gap={1}>
        <For each={props.actions}>
          {(action, index) => (
            <box
              backgroundColor={
                index() === props.selected ? darkTheme.warning : darkTheme.panel
              }
              paddingLeft={1}
              paddingRight={1}
            >
              <text
                fg={
                  index() === props.selected
                    ? darkTheme.background
                    : darkTheme.text
                }
              >
                {action}
              </text>
            </box>
          )}
        </For>
        <text fg={darkTheme.muted}>
          ←→ select · 1-9 quick · enter confirm · esc reject · d detail
        </text>
      </box>
    </ModalKeyCapture>
  );
}

function QuestionActions(props: {
  confirm: boolean;
  editing: boolean;
  multiple: boolean;
  selected: number;
  max: number;
  onMove(delta: number): void;
  onTab(delta: number): void;
  onSelect(): void;
  onQuickSelect(index: number): void;
  onReject(): void;
  onExit(): void;
}) {
  return (
    <ModalKeyCapture
      enabled={!props.editing}
      onExit={props.onExit}
      onKey={(key) => {
        if (key === "up") props.onMove(-1);
        if (key === "down") props.onMove(1);
        if (key === "left") props.onTab(-1);
        if (key === "right" || key === "tab") props.onTab(1);
        if (/^[1-9]$/.test(key))
          props.onQuickSelect(
            Math.min(Number(key) - 1, Math.max(0, props.max - 1)),
          );
        if (key === "return") props.onSelect();
        if (key === "escape") props.onReject();
      }}
    >
      <box flexDirection="row" gap={2}>
        <text fg={darkTheme.text}>Tab/→ next</text>
        <text fg={darkTheme.text}>← back</text>
        <text fg={darkTheme.text}>↑↓ select</text>
        <text fg={darkTheme.text}>1-{Math.min(9, props.max)} quick</text>
        <text fg={darkTheme.text}>
          enter{" "}
          {props.confirm ? "submit" : props.multiple ? "toggle" : "select"}
        </text>
        <Show when={props.multiple && !props.confirm}>
          <text fg={darkTheme.muted}>
            Tab/→ to Confirm; Enter there submits
          </text>
        </Show>
        <text fg={darkTheme.text}>esc reject</text>
      </box>
    </ModalKeyCapture>
  );
}

function ModalKeyCapture(props: {
  children: JSX.Element;
  enabled?: boolean;
  onKey(key: string): void;
  onExit?: () => void;
}) {
  let capture: TextareaRenderable | undefined;
  createEffect(() => {
    if (props.enabled === false) return;
    queueMicrotask(() => capture?.focus());
  });
  return (
    <box flexDirection="column" gap={1}>
      <textarea
        ref={(value: TextareaRenderable) => {
          capture = value;
          queueMicrotask(() => value.focus());
        }}
        minHeight={0}
        maxHeight={0}
        focused={props.enabled !== false}
        onKeyDown={(event: ModalKeyEvent) => {
          if (isExitChord(event)) {
            consumeModalKey(event);
            props.onExit?.();
            return;
          }
          const key = normalizeModalKey(event.name ?? event.key ?? "");
          if (!key) return;
          consumeModalKey(event);
          props.onKey(key);
        }}
      />
      {props.children}
    </box>
  );
}

function DialogFrame(props: {
  title: string;
  tone: "accent" | "warning";
  children: JSX.Element;
}) {
  const color = props.tone === "warning" ? darkTheme.warning : darkTheme.accent;
  return (
    <box
      position="absolute"
      left={4}
      right={4}
      bottom={3}
      maxHeight="80%"
      border
      borderColor={color}
      backgroundColor={darkTheme.panel}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="column"
      gap={1}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={color}>
          {props.title}
        </text>
        <text fg={darkTheme.muted}>M7 modal queue</text>
      </box>
      {props.children}
    </box>
  );
}

type ModalKeyEvent = {
  name?: string;
  key?: string;
  ctrl?: boolean;
  control?: boolean;
  meta?: boolean;
  preventDefault(): void;
  stopPropagation?(): void;
};

function isExitChord(event: ModalKeyEvent) {
  const key = normalizeModalKey(event.name ?? event.key ?? "");
  return (
    (event.ctrl || event.control || event.meta) && (key === "c" || key === "d")
  );
}

function consumeModalKey(event: ModalKeyEvent) {
  event.preventDefault();
  event.stopPropagation?.();
}

function normalizeModalKey(key: string) {
  if (key === "enter") return "return";
  return key;
}
