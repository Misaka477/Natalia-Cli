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
import type { AppRoute } from "../context/route";
import { registerNataliaKeymap } from "../modal/mode-stack";
import { App } from "./App";

export type RuntimeHandle = {
  renderer: CliRenderer;
  events: RuntimeEvent[];
  stop(): Promise<void>;
};

/**
 * Reports a failure from a call that nothing awaits. These run while the UI is
 * being torn down, so stderr is the only sink left, and swallowing them would
 * hide real problems while crashing on them would stop the process from
 * exiting cleanly and leave the terminal in the alternate screen.
 */
function reportTeardownFailure(stage: string, error: unknown) {
  process.stderr.write(
    `natalia: ${stage} failed during shutdown: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
}

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
    initialRoute?: AppRoute;
    onHistoryControls?: (controls: {
      loadOlder(): Promise<void>;
      loadNewer(): Promise<void>;
    }) => void;
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
  let backendDisposed = false;
  const disposeBackend = async () => {
    if (backendDisposed) return;
    backendDisposed = true;
    await backend.dispose?.();
  };
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
                        <App
                          backend={backend}
                          createBackend={input.createBackend}
                          workspaceRoot={input.workspaceRoot}
                          onSessionChange={input.onSessionChange}
                          initialRoute={input.initialRoute}
                          onHistoryControls={input.onHistoryControls}
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
    setTimeout(() => {
      void backend
        .submit(input.initialPrompt!)
        .catch((error: unknown) => reportTeardownFailure("submit", error));
    }, 100);
  // Teardown runs with no UI left to report into, and an unhandled rejection
  // here would kill the process instead of letting it exit, so the failure is
  // written out and the shutdown continues.
  renderer.once("destroy", () => {
    void disposeBackend().catch((error: unknown) =>
      reportTeardownFailure("dispose", error),
    );
  });
  return {
    renderer,
    events,
    stop: async () => {
      cleanupKeymap();
      await disposeBackend();
      renderer.destroy();
    },
  };
}

export const runSpike = runTuiShell;
