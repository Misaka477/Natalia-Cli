import { Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
  onClose(): void;
  onConfirm(): void;
}) {
  useBindings(() => ({
    mode: "modal",
    enabled: props.open,
    bindings: [
      {
        key: "escape",
        desc: "Cancel",
        group: "Dialog",
        cmd: props.onClose,
      },
      {
        key: "return",
        desc: "Confirm",
        group: "Dialog",
        cmd: props.onConfirm,
      },
      {
        key: "y",
        desc: "Confirm",
        group: "Dialog",
        cmd: props.onConfirm,
      },
      {
        key: "n",
        desc: "Cancel",
        group: "Dialog",
        cmd: props.onClose,
      },
    ],
  }));
  return (
    <Show when={props.open}>
      <box
        position="absolute"
        top="30%"
        left="15%"
        right="15%"
        border
        borderColor={props.dangerous ? darkTheme.danger : darkTheme.accent}
        backgroundColor={darkTheme.panel}
        padding={2}
        flexDirection="column"
        gap={1}
      >
        <text
          fg={props.dangerous ? darkTheme.danger : darkTheme.accent}
          attributes={TextAttributes.BOLD}
        >
          {props.title}
        </text>
        <text fg={darkTheme.text}>{props.message}</text>
        <text fg={darkTheme.muted}>
          Enter/Y {props.confirmLabel ?? "confirm"} · Escape/N{" "}
          {props.cancelLabel ?? "cancel"}
        </text>
      </box>
    </Show>
  );
}
