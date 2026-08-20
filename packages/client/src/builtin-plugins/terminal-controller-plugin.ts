/**
 * The terminal controller built-in plugin.
 *
 * Previously a visibility-only record; the controller now lives on the unified
 * plugin lifecycle. The plugin constructs it in `setup()` and provides it as the
 * `terminal.controller` service, so a disabled or absent plugin constructs no
 * native terminal registry and starts no WezTerm watcher.
 */
import type { Plugin } from "@natalia/plugin";
import type { RuntimeEvent } from "@natalia/contracts";
import type { NativeTerminalRegistry } from "@natalia/native-terminal";
import { createTerminalController } from "../terminal-controller";

export const TERMINAL_PLUGIN_ID = "natalia-terminal";
export const TERMINAL_CONTROLLER_SERVICE = "terminal.controller";

export function createTerminalControllerPlugin(input: {
  workspaceRoot: string;
  publish(event: RuntimeEvent): void;
  onPerformance(name: string, durationMs: number): void;
  runtimeID(): string;
  userRuntimeHome(): string | undefined;
  windowMode(): "auto" | "windowless" | "window";
  external?: NativeTerminalRegistry;
}): Plugin {
  let controller: ReturnType<typeof createTerminalController> | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: TERMINAL_PLUGIN_ID,
      version: "1.0.0",
      name: "Terminal",
      description: "Native terminal panes and interactive programs.",
      entry: "natalia:terminal",
      scope: "session",
      provides: [TERMINAL_CONTROLLER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      controller = createTerminalController(input);
      api.services.provide(TERMINAL_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller = undefined;
    },
  };
}
