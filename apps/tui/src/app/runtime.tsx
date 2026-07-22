import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { createFakeBackend, createRealRuntimeClient } from "@natalia/client";
import { resolveTuiConfig } from "../config";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { ClipboardProvider } from "../context/clipboard";
import { ToastProvider } from "../context/toast";
import { RuntimeProvider } from "../context/runtime";
import { PromptRefProvider } from "../context/prompt";
import { KeybindProvider } from "../context/keybind";
import { LocalProvider } from "../context/local";
import { ThemeProvider } from "../context/theme";
import { RouteProvider } from "../context/route";
import { DialogProvider } from "../dialog/provider";
import { registerNataliaKeymap } from "../modal/mode-stack";
import { App } from "./App";

export type RuntimeHandle = {
  renderer: CliRenderer;
  events: RuntimeEvent[];
  stop(): void;
};

export async function runTuiShell(
  input: {
    onEvent?: (event: RuntimeEvent) => void;
    initialPrompt?: string;
    backend?: RuntimeClient;
    createBackend?: (sessionID?: string) => RuntimeClient;
    workspaceRoot?: string;
    onSessionChange?: (sessionID?: string) => void;
    fixture?: boolean;
    closeAfterInitialTurn?: boolean;
    rendererSize?: { width: number; height: number };
  } = {},
): Promise<RuntimeHandle> {
  const renderer = await createCliRenderer({
    width: input.rendererSize?.width,
    height: input.rendererSize?.height,
    targetFps: 60,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
    autoFocus: true,
  });
  const backend =
    input.backend ??
    (input.fixture
      ? createFakeBackend()
      : createRealRuntimeClient({ workspaceRoot: input.workspaceRoot }));
  const events: RuntimeEvent[] = [];
  const keymap = createDefaultOpenTuiKeymap(renderer);
  const tuiConfig = input.workspaceRoot
    ? (await resolveTuiConfig(input.workspaceRoot)).config
    : undefined;
  const disposeKeymap = registerNataliaKeymap(keymap, renderer, {
    leaderKey: tuiConfig?.leaderKey,
    leaderTimeoutMs: tuiConfig?.leaderTimeoutMs,
  });
  let keymapDisposed = false;
  const cleanupKeymap = () => {
    if (keymapDisposed) return;
    keymapDisposed = true;
    disposeKeymap();
  };
  renderer.once("destroy", cleanupKeymap);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ClipboardProvider>
          <ToastProvider>
            <RuntimeProvider>
              <PromptRefProvider>
                <KeybindProvider>
                  <RouteProvider>
                    <ThemeProvider workspaceRoot={input.workspaceRoot}>
                      <LocalProvider workspaceRoot={input.workspaceRoot}>
                        <DialogProvider>
                          <App
                            backend={backend}
                            createBackend={input.createBackend}
                            workspaceRoot={input.workspaceRoot}
                            onSessionChange={input.onSessionChange}
                            onDispatch={(event) => {
                              events.push(event);
                              input.onEvent?.(event);
                              if (
                                input.initialPrompt &&
                                input.closeAfterInitialTurn !== false &&
                                event.type === "turn.finished"
                              ) {
                                if (process.env.NATALIA_TUI_SMOKE_MARKER)
                                  void Bun.write(
                                    process.env.NATALIA_TUI_SMOKE_MARKER,
                                    "done",
                                  );
                                setTimeout(
                                  () => renderer.destroy(),
                                  process.env.NATALIA_TUI_SMOKE_MARKER
                                    ? 1000
                                    : 50,
                                );
                              }
                            }}
                          />
                        </DialogProvider>
                      </LocalProvider>
                    </ThemeProvider>
                  </RouteProvider>
                </KeybindProvider>
              </PromptRefProvider>
            </RuntimeProvider>
          </ToastProvider>
        </ClipboardProvider>
      </KeymapProvider>
    ),
    renderer,
  );
  if (input.initialPrompt)
    setTimeout(() => void backend.submit(input.initialPrompt!), 100);
  return {
    renderer,
    events,
    stop: () => {
      cleanupKeymap();
      renderer.destroy();
    },
  };
}

export const runSpike = runTuiShell;
