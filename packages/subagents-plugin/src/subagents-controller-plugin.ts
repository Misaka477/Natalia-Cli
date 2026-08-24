/**
 * The subagents controller built-in plugin.
 *
 * The controller now lives on the unified plugin lifecycle: the plugin
 * constructs it in `setup()` and provides its operational `subagents.service`
 * service, so a disabled or absent plugin constructs no `SubagentRegistry` at
 * all. The host wires the subagent execution runner through `init` after it
 * resolves the service — the runner belongs to the host because it drives the
 * provider/agent loop.
 */
import type { Plugin, PluginManifest } from "@natalia/plugin";
import { SUBAGENTS_SERVICE } from "@natalia/runtime-services";
import { createSubagentsController } from "./subagents-controller";

export const SUBAGENTS_PLUGIN_ID = "natalia-subagents";
export const SUBAGENTS_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: SUBAGENTS_PLUGIN_ID,
  version: "1.0.0",
  name: "Subagents",
  description: "Delegated work to sub-agents.",
  entry: "natalia:subagents",
  scope: "workspace",
  provides: [SUBAGENTS_SERVICE],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["services"],
};
export function createSubagentsControllerPlugin(input: {
  workDir: string;
  sessionID?: () => string | undefined;
}): Plugin {
  let controller: ReturnType<typeof createSubagentsController> | undefined;
  return {
    manifest: SUBAGENTS_PLUGIN_MANIFEST,
    setup(api) {
      controller = createSubagentsController(input);
      api.services.provide(SUBAGENTS_SERVICE, controller);
    },
    dispose() {
      controller = undefined;
    },
  };
}
