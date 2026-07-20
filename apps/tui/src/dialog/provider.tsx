import { useRenderer } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import {
  batch,
  createContext,
  createEffect,
  createMemo,
  onCleanup,
  Show,
  useContext,
  type JSX,
  type ParentProps,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useModeStack } from "../modal/mode-stack";
import { Dialog } from "./Dialog";
import type { Renderable } from "@opentui/core";

interface StackItem {
  element: JSX.Element;
  onClose?: () => void;
}

export interface DialogContext {
  clear(): void;
  pop(): void;
  push(element: any, onClose?: () => void): void;
  replace(element: any, onClose?: () => void): void;
  readonly stack: readonly StackItem[];
  readonly size: "medium" | "large" | "xlarge";
  setSize(size: "medium" | "large" | "xlarge"): void;
}

function init(): DialogContext {
  const [store, setStore] = createStore({
    stack: [] as StackItem[],
    size: "medium" as "medium" | "large" | "xlarge",
  });

  const renderer = useRenderer();
  const modeStack = useModeStack();

  createEffect(() => {
    if (store.stack.length === 0) return;
    const popMode = modeStack.push("modal");
    onCleanup(popMode);
  });

  let focus: Renderable | null = null;
  let context: DialogContext;

  function refocus() {
    setTimeout(() => {
      if (!focus || focus.isDestroyed) return;
      function find(item: Renderable): boolean {
        for (const child of item.getChildren()) {
          if (child === focus) return true;
          if (find(child)) return true;
        }
        return false;
      }
      if (!find(renderer.root)) return;
      focus.focus();
    }, 1);
  }

  useBindings(() => ({
    mode: "modal",
    enabled:
      store.stack.length > 0 && !renderer.getSelection()?.getSelectedText(),
    bindings: [
      {
        key: "escape",
        desc: "Close dialog",
        group: "Dialog",
        cmd: () => {
          if (renderer.getSelection()) {
            renderer.clearSelection();
          }
          context.pop();
        },
      },
      {
        key: "ctrl+c",
        desc: "Close dialog",
        group: "Dialog",
        cmd: () => {
          if (renderer.getSelection()) {
            renderer.clearSelection();
          }
          context.pop();
        },
      },
    ],
  }));

  context = {
    pop() {
      const current = store.stack.at(-1);
      current?.onClose?.();
      setStore("stack", store.stack.slice(0, -1));
      if (store.stack.length <= 1) refocus();
    },
    clear() {
      for (const item of store.stack) {
        item.onClose?.();
      }
      batch(() => {
        setStore("size", "medium");
        setStore("stack", []);
      });
      refocus();
    },
    push(element: JSX.Element, onClose?: () => void) {
      if (store.stack.length === 0) {
        focus = renderer.currentFocusedRenderable;
        focus?.blur();
      }
      setStore("stack", [...store.stack, { element, onClose }]);
    },
    replace(element: JSX.Element, onClose?: () => void) {
      if (store.stack.length === 0) {
        focus = renderer.currentFocusedRenderable;
        focus?.blur();
      }
      for (const item of store.stack) {
        item.onClose?.();
      }
      setStore("size", "medium");
      setStore("stack", [{ element, onClose }]);
    },
    get stack() {
      return store.stack;
    },
    get size() {
      return store.size;
    },
    setSize(size: "medium" | "large" | "xlarge") {
      setStore("size", size);
    },
  };

  return context;
}

const DialogCtx = createContext<DialogContext>();

export function DialogProvider(props: ParentProps) {
  const value = init();

  return (
    <DialogCtx.Provider value={value}>
      {props.children}
      <Show when={value.stack.length}>
        <Dialog onClose={() => value.clear()} size={value.size}>
          {value.stack.at(-1)!.element}
        </Dialog>
      </Show>
    </DialogCtx.Provider>
  );
}

export function useDialog(): DialogContext {
  const value = useContext(DialogCtx);
  if (!value) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return value;
}
