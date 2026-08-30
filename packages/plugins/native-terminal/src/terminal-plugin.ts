import type { Plugin, PluginManifest } from "@natalia/plugin";
import {
  TERMINAL_CONTROLLER_SERVICE,
  type TerminalController,
  type TerminalControllerInput,
} from "@natalia/runtime-services";
import { createTerminalController } from "./terminal-controller";
import { createPtyTerminalController } from "./pty-terminal-controller";
import { terminalTools, terminalToolFamily } from "./terminal-tools";
import type { NativeTerminalRegistry } from "./native-terminal";

export const TERMINAL_PLUGIN_ID = "natalia-tool-terminal";

export const TERMINAL_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: TERMINAL_PLUGIN_ID,
  version: "1.0.0",
  name: "Terminal Tools",
  description: "Native terminal panes and interactive programs.",
  entry: "index.js",
  scope: "session",
  provides: [TERMINAL_CONTROLLER_SERVICE],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["tools", "services"],
};

/**
 * The one true terminal plugin. It owns the native host implementation, the
 * terminal resource controller and the terminal tools/aliases: on setup it
 * constructs the controller, provides `TERMINAL_CONTROLLER_SERVICE` and
 * registers the tool surface; on unload it disposes the controller so every
 * pane stops and the host is torn down.
 */
export function createTerminalPlugin(input: TerminalControllerInput): Plugin {
  let controller: TerminalController | undefined;
  return {
    manifest: TERMINAL_PLUGIN_MANIFEST,
    setup(api) {
      // The controller input crosses the runtime-services boundary with the
      // host registry typed as `unknown`; the plugin owns the concrete type.
      controller =
        input.backend === "wezterm" || input.external
          ? createTerminalController({
              ...input,
              external: input.external as NativeTerminalRegistry | undefined,
            })
          : createPtyTerminalController(input);
      api.services.provide(TERMINAL_CONTROLLER_SERVICE, controller);
      for (const tool of terminalTools()) api.tools.register(tool);
      for (const [alias, target] of Object.entries(
        terminalToolFamily().aliases ?? {},
      ))
        api.tools.registerAlias(alias, target);
    },
    async dispose() {
      await controller?.close();
      controller = undefined;
    },
  };
}
