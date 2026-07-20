import {
  InputRenderable,
  TextareaRenderable,
  type CliRenderer,
  type KeyEvent,
  type Renderable,
} from "@opentui/core";
import type { Keymap } from "@opentui/keymap";
import {
  registerBackspacePopsPendingSequence,
  registerBaseLayoutFallback,
  registerEscapeClearsPendingSequence,
  registerManagedTextareaLayer,
} from "@opentui/keymap/addons/opentui";
import { useKeymap } from "@opentui/keymap/solid";

type TuiKeymap = Keymap<Renderable, KeyEvent>;

const NATALIA_MODE_KEY = "natalia.mode";
const NATALIA_BASE_MODE = "base";

const modeStacks = new WeakMap<TuiKeymap, ModeStack>();

export interface ModeStack {
  current(): string;
  push(mode: string): () => void;
  dispose(): void;
}

function createModeStack(keymap: TuiKeymap): ModeStack {
  keymap.setData(NATALIA_MODE_KEY, NATALIA_BASE_MODE);

  const offFields = keymap.registerLayerFields({
    mode(
      value: unknown,
      ctx: { require: (key: string, value: unknown) => void },
    ) {
      ctx.require(NATALIA_MODE_KEY, value);
    },
  });

  const stack: { id: symbol; mode: string }[] = [];
  let disposed = false;

  const update = () => {
    keymap.setData(NATALIA_MODE_KEY, stack.at(-1)?.mode ?? NATALIA_BASE_MODE);
  };

  const api: ModeStack = {
    current() {
      return stack.at(-1)?.mode ?? NATALIA_BASE_MODE;
    },
    push(mode: string) {
      if (disposed) return () => {};
      const id = Symbol(mode);
      let active = true;
      stack.push({ id, mode });
      update();

      return () => {
        if (!active) return;
        active = false;
        const index = stack.findIndex((item) => item.id === id);
        if (index !== -1) stack.splice(index, 1);
        update();
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stack.length = 0;
      offFields();
      keymap.setData(NATALIA_MODE_KEY, undefined);
      modeStacks.delete(keymap);
    },
  };

  modeStacks.set(keymap, api);
  return api;
}

export function getOrCreateModeStack(keymap: TuiKeymap): ModeStack {
  let existing = modeStacks.get(keymap);
  if (!existing) {
    existing = createModeStack(keymap);
  }
  return existing;
}

export function useModeStack(): ModeStack {
  return getOrCreateModeStack(useKeymap());
}

export function registerNataliaKeymap(
  keymap: TuiKeymap,
  renderer: CliRenderer,
) {
  const modeStack = getOrCreateModeStack(keymap);
  const offBaseLayout = registerBaseLayoutFallback(keymap);
  const offEscape = registerEscapeClearsPendingSequence(keymap);
  const offBackspace = registerBackspacePopsPendingSequence(keymap);
  const offInputBindings = registerManagedTextareaLayer(keymap, renderer, {
    enabled: () => {
      const editor = renderer.currentFocusedEditor;
      return editor instanceof TextareaRenderable && !(editor instanceof InputRenderable);
    },
  });

  return () => {
    offInputBindings();
    offBackspace();
    offEscape();
    offBaseLayout();
    modeStack.dispose();
  };
}
