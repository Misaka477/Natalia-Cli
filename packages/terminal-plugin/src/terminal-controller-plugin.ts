/**
 * The terminal controller built-in plugin.
 *
 * Previously a visibility-only record; the controller now lives on the unified
 * plugin lifecycle. The plugin constructs it in `setup()` and provides it as the
 * `terminal.controller` service, so a disabled or absent plugin constructs no
 * native terminal registry and starts no WezTerm watcher.
 */
import type { Plugin, PluginManifest } from "@natalia/plugin";
import type { NativeTerminalRegistry } from "@natalia/native-terminal";
import { createTerminalController } from "./terminal-controller";
import {
  TERMINAL_CONTROLLER_SERVICE,
  type TerminalControllerPluginInput,
} from "@natalia/runtime-services";

export const TERMINAL_PLUGIN_ID = "natalia-terminal";

export const TERMINAL_PLUGIN_MANIFEST: PluginManifest = {
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
};

export function createTerminalControllerPlugin(
  input: TerminalControllerPluginInput,
): Plugin {
  let controller: ReturnType<typeof createTerminalController> | undefined;
  return {
    manifest: TERMINAL_PLUGIN_MANIFEST,
    setup(api) {
      controller = createTerminalController({
        ...input,
        external: input.external as NativeTerminalRegistry | undefined,
      });
      api.services.provide(TERMINAL_CONTROLLER_SERVICE, controller);
    },
    async dispose() {
      await controller?.close();
      controller = undefined;
    },
  };
}
