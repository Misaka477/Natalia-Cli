import {
  createContext,
  createSignal,
  onCleanup,
  Show,
  useContext,
  type JSX,
} from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import { darkTheme } from "../theme/theme";

export type ToastOptions = {
  title?: string;
  message: string;
  variant: "info" | "success" | "warning" | "error";
  duration?: number;
};

export function createToastController() {
  const [currentToast, setCurrentToast] = createSignal<ToastOptions>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = {
    currentToast,
    show(options: ToastOptions) {
      if (timer) clearTimeout(timer);
      setCurrentToast(options);
      timer = setTimeout(() => setCurrentToast(), options.duration ?? 5000);
      timer.unref?.();
    },
    error(error: unknown) {
      controller.show({
        variant: "error",
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    },
    dismiss() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      setCurrentToast();
    },
  };
  return controller;
}

type ToastController = ReturnType<typeof createToastController>;
const ToastContext = createContext<ToastController>();

export function ToastProvider(props: { children: JSX.Element }) {
  const controller = createToastController();
  onCleanup(controller.dismiss);
  return (
    <ToastContext.Provider value={controller}>
      {props.children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const controller = useContext(ToastContext);
  if (!controller) throw new Error("ToastProvider missing");
  return controller;
}

export function ToastRegion() {
  const toast = useToast();
  const dimensions = useTerminalDimensions();
  const color = (variant: ToastOptions["variant"]) =>
    variant === "success"
      ? darkTheme.success
      : variant === "warning"
        ? darkTheme.warning
        : variant === "error"
          ? darkTheme.danger
          : darkTheme.accent;
  return (
    <Show when={toast.currentToast()}>
      {(current) => (
        <box
          position="absolute"
          top={2}
          right={2}
          zIndex={100}
          maxWidth={Math.max(20, Math.min(60, dimensions().width - 6))}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={darkTheme.panel}
          border={["left", "right"]}
          borderColor={color(current().variant)}
          onMouseUp={toast.dismiss}
        >
          <Show when={current().title}>
            <text
              fg={darkTheme.text}
              attributes={TextAttributes.BOLD}
              marginBottom={1}
            >
              {current().title}
            </text>
          </Show>
          <text fg={darkTheme.text} wrapMode="word" width="100%">
            {current().message}
          </text>
        </box>
      )}
    </Show>
  );
}
