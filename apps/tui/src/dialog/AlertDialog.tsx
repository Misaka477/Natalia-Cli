import { createEffect, onCleanup, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { darkTheme } from "../theme/theme";
import { setModalKeyHandler } from "../modal/key-handler";

export function AlertDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose(): void;
}) {
  createEffect(() => {
    if (!props.open) return;
    const dispose = setModalKeyHandler((key) => {
      if (key === "escape" || key === "return" || key === "enter") {
        props.onClose();
        return true;
      }
      return false;
    });
    onCleanup(dispose);
  });
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
