import { createContext, createMemo, createSignal, useContext, type JSX } from "solid-js";
import {
  buildKeybindMap,
  type ResolvedKeybindMap,
  type UserKeybindOverrides,
} from "../keymap";

type KeybindContext = {
  overrides(): UserKeybindOverrides;
  resolved(): ResolvedKeybindMap;
  bindings(command: string, fallback: readonly string[]): string[];
  set(overrides: UserKeybindOverrides): void;
};

const defaultResolved = buildKeybindMap();
const defaultContext: KeybindContext = {
  overrides: () => ({}),
  resolved: () => defaultResolved,
  bindings(command, fallback) {
    return defaultResolved.bindings[command] ?? [...fallback];
  },
  set() {},
};
const Context = createContext<KeybindContext>(defaultContext);

export function KeybindProvider(props: { children: JSX.Element }) {
  const [overrides, setOverrides] = createSignal<UserKeybindOverrides>({});
  const resolved = createMemo(() => buildKeybindMap(overrides()));
  const value: KeybindContext = {
    overrides,
    resolved,
    bindings(command, fallback) {
      return resolved().bindings[command] ?? [...fallback];
    },
    set(overrides) {
      setOverrides(overrides);
    },
  };
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}

export function useKeybinds() {
  return useContext(Context);
}
