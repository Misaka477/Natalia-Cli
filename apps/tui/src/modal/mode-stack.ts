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
  registerCommaBindings,
  registerEscapeClearsPendingSequence,
  registerManagedTextareaLayer,
  registerTimedLeader,
} from "@opentui/keymap/addons/opentui";
import { useKeymap } from "@opentui/keymap/solid";
import { createSignal } from "solid-js";

type TuiKeymap = Keymap<Renderable, KeyEvent>;

/**
 * Paint order for presented surfaces is derived from the same stack that gates
 * key dispatch, so the surface that receives Escape is always the one drawn on
 * top. Deriving both from one order is what keeps an approval prompt from
 * silently taking keys aimed at a dialog above it.
 */
const SURFACE_BASE_Z_INDEX = 3000;
const SURFACE_Z_INDEX_STEP = 10;

export interface SurfaceHandle {
  release(): void;
  zIndex(): number;
  isTop(): boolean;
}

const NATALIA_MODE_KEY = "natalia.mode";
const NATALIA_BASE_MODE = "base";

const modeStacks = new WeakMap<TuiKeymap, ModeStack>();

export interface ModeStack {
  current(): string;
  push(mode: string): () => void;
  pushSurface(mode: string): SurfaceHandle;
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
  // Surfaces read their own position, so a plain array is not enough: the read
  // has to re-run when the stack changes.
  const [revision, setRevision] = createSignal(0);

  const update = () => {
    keymap.setData(NATALIA_MODE_KEY, stack.at(-1)?.mode ?? NATALIA_BASE_MODE);
    setRevision((value) => value + 1);
  };

  function pushEntry(mode: string) {
    const id = Symbol(mode);
    if (disposed) return { id, release: () => {} };
    let active = true;
    stack.push({ id, mode });
    update();
    return {
      id,
      release() {
        if (!active) return;
        active = false;
        const index = stack.findIndex((item) => item.id === id);
        if (index !== -1) stack.splice(index, 1);
        update();
      },
    };
  }

  const api: ModeStack = {
    current() {
      return stack.at(-1)?.mode ?? NATALIA_BASE_MODE;
    },
    push(mode: string) {
      return pushEntry(mode).release;
    },
    pushSurface(mode: string) {
      const entry = pushEntry(mode);
      return {
        release: entry.release,
        zIndex() {
          revision();
          const index = stack.findIndex((item) => item.id === entry.id);
          return (
            SURFACE_BASE_Z_INDEX + Math.max(index, 0) * SURFACE_Z_INDEX_STEP
          );
        },
        isTop() {
          revision();
          return stack.at(-1)?.id === entry.id;
        },
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
  options: { leaderKey?: string; leaderTimeoutMs?: number } = {},
) {
  const modeStack = getOrCreateModeStack(keymap);
  const offCommaBindings = registerCommaBindings(keymap);
  const offBaseLayout = registerBaseLayoutFallback(keymap);
  const offLeader = registerTimedLeader(keymap, {
    trigger: options.leaderKey ?? "ctrl+x",
    name: "leader",
    timeoutMs: options.leaderTimeoutMs ?? 2000,
  });
  const offEscape = registerEscapeClearsPendingSequence(keymap);
  const offBackspace = registerBackspacePopsPendingSequence(keymap);
  const offInputBindings = registerManagedTextareaLayer(keymap, renderer, {
    enabled: () => {
      const editor = renderer.currentFocusedEditor;
      return (
        editor instanceof TextareaRenderable &&
        !(editor instanceof InputRenderable)
      );
    },
  });
  // Keymap dispatch runs before renderable handlers. A global binding or an
  // incomplete leader sequence must not consume committed text from a focused
  // editor before OpenTUI can insert it.
  const offCommittedText = keymap.intercept("key", (context) => {
    const editor = renderer.currentFocusedEditor;
    const text = committedText(context.event);
    if (!editor || editor.isDestroyed || text === undefined) return;
    keymap.clearPendingSequence();
    editor.insertText(text);
    context.consume();
  });

  return () => {
    offCommittedText();
    offInputBindings();
    offBackspace();
    offEscape();
    offLeader();
    offBaseLayout();
    offCommaBindings();
    modeStack.dispose();
  };
}

function committedText(event: KeyEvent) {
  if (event.ctrl || event.meta || event.option || event.super || event.hyper)
    return undefined;
  // Key sequences for navigation/function keys contain control bytes. A
  // printable raw or Kitty committed-text event contains only text codepoints.
  if (!event.sequence || /[\p{Cc}\p{Cf}]/u.test(event.sequence))
    return undefined;
  return event.sequence;
}
