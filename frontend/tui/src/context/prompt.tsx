import { createContext, useContext, type JSX } from "solid-js";
import type { TextareaRenderable } from "@opentui/core";

export type PromptRef = {
  get current(): TextareaRenderable | undefined;
  set(value: TextareaRenderable | undefined): void;
  focus(): void;
  clear(): void;
};

const PromptContext = createContext<PromptRef>();

export function PromptRefProvider(props: { children: JSX.Element }) {
  let current: TextareaRenderable | undefined;
  const ref: PromptRef = {
    get current() {
      return current;
    },
    set(value) {
      current = value;
    },
    focus() {
      current?.focus();
    },
    clear() {
      current?.clear();
    },
  };
  return (
    <PromptContext.Provider value={ref}>
      {props.children}
    </PromptContext.Provider>
  );
}

export function usePromptRef() {
  const value = useContext(PromptContext);
  if (!value) throw new Error("PromptRefProvider missing");
  return value;
}
