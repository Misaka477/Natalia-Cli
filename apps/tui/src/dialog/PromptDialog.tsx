import { createSignal, Show } from "solid-js";
import { TextareaRenderable, TextAttributes } from "@opentui/core";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";
import { ConfirmDialog } from "./ConfirmDialog";

export function PromptDialog(props: {
  open: boolean;
  title: string;
  description: string;
  initialValue?: string;
  secret?: boolean;
  validate?: (value: string) => string | undefined;
  onClose(): void;
  onSubmit(value: string): void;
}) {
  const [error, setError] = createSignal("");
  const [confirmDiscard, setConfirmDiscard] = createSignal(false);
  let input: TextareaRenderable | undefined;

  function closeOrConfirmDiscard() {
    if (!hasUnsavedPromptChanges(input?.plainText ?? "", props.initialValue)) {
      props.onClose();
      return;
    }
    setConfirmDiscard(true);
  }
  function submit() {
    const value = input?.plainText ?? "";
    const error = props.validate?.(value);
    if (error) {
      setError(error);
      return;
    }
    props.onSubmit(value);
  }
  useBindings(() => ({
    mode: "modal",
    enabled: props.open,
    bindings: [
      {
        key: "escape",
        desc: "Cancel prompt",
        group: "Dialog",
        cmd: closeOrConfirmDiscard,
      },
      {
        key: "return",
        desc: "Submit prompt",
        group: "Dialog",
        cmd: submit,
      },
    ],
  }));
  return (
    <Show when={props.open}>
      <box
        position="absolute"
        top="20%"
        left="12%"
        right="12%"
        border
        borderColor={darkTheme.accent}
        backgroundColor={darkTheme.panel}
        padding={2}
        flexDirection="column"
        gap={1}
      >
        <text fg={darkTheme.accent} attributes={TextAttributes.BOLD}>
          {props.title}
        </text>
        <text fg={darkTheme.muted}>{props.description}</text>
        <textarea
          ref={(value: TextareaRenderable) => {
            input = value;
            value.setText(props.initialValue ?? "");
            queueMicrotask(() => value.focus());
          }}
          minHeight={1}
          maxHeight={4}
          width="100%"
          textColor={darkTheme.text}
          focusedTextColor={darkTheme.text}
          cursorColor={darkTheme.accent}
          onKeyDown={(event: {
            name?: string;
            key?: string;
            preventDefault(): void;
          }) => {
            const key = event.name ?? event.key;
            if (key === "escape") {
              event.preventDefault();
              closeOrConfirmDiscard();
            }
            if (key === "return") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Show when={error()}>
          <text fg={darkTheme.danger}>{error()}</text>
        </Show>
        <text fg={darkTheme.muted}>Enter save · Escape cancel</text>
      </box>
      <ConfirmDialog
        open={confirmDiscard()}
        title="Discard changes?"
        message="This field has unsaved changes. Discard them?"
        confirmLabel="discard"
        cancelLabel="keep editing"
        dangerous
        onClose={() => {
          setConfirmDiscard(false);
          queueMicrotask(() => input?.focus());
        }}
        onConfirm={() => {
          setConfirmDiscard(false);
          props.onClose();
        }}
      />
    </Show>
  );
}

export function hasUnsavedPromptChanges(value: string, initialValue?: string) {
  return value !== (initialValue ?? "");
}
