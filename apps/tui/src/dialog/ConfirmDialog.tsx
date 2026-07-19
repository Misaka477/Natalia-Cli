import { createEffect, onCleanup, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { darkTheme } from "../theme/theme";
import { setModalKeyHandler } from "../modal/key-handler";

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
  createEffect(() => {
    if (!props.open) return;
    const dispose = setModalKeyHandler((key) => {
      if (key === "escape") {
        props.onClose();
        return true;
      }
      if (key === "y" || key === "return" || key === "enter") {
        props.onConfirm();
        return true;
      }
      if (key === "n") {
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
