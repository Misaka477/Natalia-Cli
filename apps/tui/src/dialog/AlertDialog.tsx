import { Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { darkTheme } from "../theme/theme";
import { useBindings } from "@opentui/keymap/solid";

export function AlertDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose(): void;
}) {
  useBindings(() => ({
    enabled: props.open,
    bindings: [
      {
        key: "escape",
        desc: "Dismiss alert",
        group: "Dialog",
        cmd: props.onClose,
      },
      {
        key: "return",
        desc: "Dismiss alert",
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
        left="20%"
        right="20%"
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
        <text fg={darkTheme.text}>{props.message}</text>
        <text fg={darkTheme.muted}>
          Enter/Escape {props.confirmLabel ?? "dismiss"}
        </text>
      </box>
    </Show>
  );
}
