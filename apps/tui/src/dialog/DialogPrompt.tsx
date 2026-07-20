import {
  TextareaRenderable,
  TextAttributes,
} from "@opentui/core";
import {
  Show,
  createEffect,
  createSignal,
  onMount,
  type JSX,
} from "solid-js";
import { useBindings } from "@opentui/keymap/solid";
import { darkTheme } from "../theme/theme";
import { useDialog, type DialogContext } from "./provider";

export type DialogPromptProps = {
  title: string;
  description?: () => JSX.Element;
  placeholder?: string;
  value?: string;
  busy?: boolean;
  busyText?: string;
  onConfirm?: (value: string) => void;
  onCancel?: () => void;
};

export function DialogPrompt(props: DialogPromptProps) {
  const dialog = useDialog();
  const [textareaTarget, setTextareaTarget] =
    createSignal<TextareaRenderable>();
  let textarea: TextareaRenderable | undefined;

  function confirm() {
    if (props.busy || !textarea) return;
    props.onConfirm?.(textarea.plainText);
  }

  useBindings(() => ({
    mode: "modal",
    target: textareaTarget,
    enabled: textareaTarget() !== undefined && !props.busy,
    priority: 1,
    commands: [
      {
        name: "dialog.prompt.submit",
        title: "Submit dialog prompt",
        category: "Dialog",
        run: confirm,
      },
    ],
    bindings: [
      {
        key: "return",
        desc: "Submit dialog prompt",
        group: "Dialog",
        cmd: confirm,
      },
    ],
  }));

  onMount(() => {
    dialog.setSize("medium");
    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return;
      if (props.busy) return;
      textarea.focus();
    }, 1);
    textarea?.gotoLineEnd();
  });

  createEffect(() => {
    if (!textarea || textarea.isDestroyed) return;
    const traits = props.busy
      ? ({ suspend: true, status: "BUSY" } as const)
      : {};
    textarea.traits = traits;
    if (props.busy) {
      textarea.blur();
      return;
    }
    textarea.focus();
  });

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
          {props.title}
        </text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box gap={1}>
        {props.description?.()}
        <textarea
          height={3}
          ref={(val: TextareaRenderable) => {
            textarea = val;
            setTextareaTarget(val);
          }}
          initialValue={props.value}
          placeholder={props.placeholder ?? "Enter text"}
          placeholderColor={darkTheme.muted}
          textColor={
            props.busy ? darkTheme.muted : darkTheme.text
          }
          focusedTextColor={
            props.busy ? darkTheme.muted : darkTheme.text
          }
          cursorColor={
            props.busy ? darkTheme.panel : darkTheme.text
          }
        />
      </box>
      <box paddingBottom={1} gap={1} flexDirection="row">
        <Show
          when={!props.busy}
          fallback={
            <text fg={darkTheme.muted}>processing...</text>
          }
        >
          <text fg={darkTheme.text}>
            return{" "}
            <span style={{ fg: darkTheme.muted }}>submit</span>
          </text>
        </Show>
      </box>
    </box>
  );
}

DialogPrompt.show = (
  dialog: DialogContext,
  title: string,
  options?: Omit<DialogPromptProps, "title">,
) => {
  return new Promise<string | null>((resolve) => {
    dialog.replace(
      () => (
        <DialogPrompt
          title={title}
          {...options}
          onConfirm={(value) => resolve(value)}
          onCancel={() => resolve(null)}
        />
      ),
      () => resolve(null),
    );
  });
};
