import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { createFakeBackend } from "@natalia/client";
import type { RuntimeEvent } from "@natalia/contracts";
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
  } = {},
): Promise<RuntimeHandle> {
  const renderer = await createCliRenderer({
    targetFps: 30,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
    autoFocus: true,
  });
  const backend = createFakeBackend();
  const events: RuntimeEvent[] = [];
  const keymap = createDefaultOpenTuiKeymap(renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <App
          backend={backend}
          onDispatch={(event) => {
            events.push(event);
            input.onEvent?.(event);
            if (input.initialPrompt && event.type === "turn.finished") {
              if (process.env.NATALIA_TUI_SMOKE_MARKER)
                void Bun.write(process.env.NATALIA_TUI_SMOKE_MARKER, "done");
              setTimeout(
                () => renderer.destroy(),
                process.env.NATALIA_TUI_SMOKE_MARKER ? 1000 : 50,
              );
            }
          }}
        />
      </KeymapProvider>
    ),
    renderer,
  );
  if (input.initialPrompt)
    setTimeout(() => void backend.submit(input.initialPrompt!), 100);
  return { renderer, events, stop: () => renderer.destroy() };
}

export const runSpike = runTuiShell;
