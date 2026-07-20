import { TextAttributes } from "@opentui/core";
import { For } from "solid-js";
import { createStore } from "solid-js/store";
import { useBindings } from "@opentui/keymap/solid";
import { darkTheme } from "../theme/theme";
import { useDialog, type DialogContext } from "./provider";

export type DialogConfirmProps = {
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  label?: string;
};

export type DialogConfirmResult = boolean | undefined;

export function DialogConfirm(props: DialogConfirmProps) {
  const dialog = useDialog();
  const [store, setStore] = createStore({
    active: "confirm" as "confirm" | "cancel",
  });

  useBindings(() => ({
    mode: "modal",
    bindings: [
      {
        key: "return",
        desc: "Confirm dialog selection",
        group: "Dialog",
        cmd: () => {
          if (store.active === "confirm") props.onConfirm?.();
          if (store.active === "cancel") props.onCancel?.();
          dialog.clear();
        },
      },
      {
        key: "left",
        desc: "Previous dialog option",
        group: "Dialog",
        cmd: () => {
          setStore("active", store.active === "confirm" ? "cancel" : "confirm");
        },
      },
      {
        key: "right",
        desc: "Next dialog option",
        group: "Dialog",
        cmd: () => {
          setStore("active", store.active === "confirm" ? "cancel" : "confirm");
        },
      },
    ],
  }));

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
      <box paddingBottom={1}>
        <text fg={darkTheme.muted}>{props.message}</text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <For each={["cancel", "confirm"] as const}>
          {(key) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={
                key === store.active ? darkTheme.accent : undefined
              }
              onMouseUp={() => {
                if (key === "confirm") props.onConfirm?.();
                if (key === "cancel") props.onCancel?.();
                dialog.clear();
              }}
            >
              <text
                fg={
                  key === store.active
                    ? darkTheme.background
                    : darkTheme.muted
                }
              >
                {key === "cancel"
                  ? props.label ?? "cancel"
                  : key}
              </text>
            </box>
          )}
        </For>
      </box>
    </box>
  );
}

DialogConfirm.show = (
  dialog: DialogContext,
  title: string,
  message: string,
  label?: string,
) => {
  return new Promise<DialogConfirmResult>((resolve) => {
    dialog.replace(
      () => (
        <DialogConfirm
          title={title}
          message={message}
          onConfirm={() => resolve(true)}
          onCancel={() => resolve(false)}
          label={label}
        />
      ),
      () => resolve(undefined),
    );
  });
};
