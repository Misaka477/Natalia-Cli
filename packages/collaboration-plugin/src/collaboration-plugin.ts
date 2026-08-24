/**
 * The collaboration built-in plugin: the interactive approval/question waiter.
 *
 * The waiter is the runtime's only blocking conversation with a human — the
 * pending records, the waiters, the session-scoped grants and the terminal
 * approval scopes. It now lives on the unified plugin lifecycle and is provided
 * as the `collaboration.waiter` service, so a disabled or absent plugin
 * constructs no waiter at all (and therefore never blocks on a human).
 *
 * Main-agent collaboration tools are owned by this plugin and disappear with
 * it. Provider-driven chat turns remain behind narrow host ports for now.
 */
import type { Plugin, PluginManifest } from "@natalia/plugin";
import { createInteractiveWaiter } from "./interactive-waiter";
import {
  COLLABORATION_WAITER_SERVICE,
  type InteractiveWaiterDeps,
} from "@natalia/runtime-services";
import {
  collaborationTools,
  type CollaborationToolPorts,
} from "./collaboration-tools";

export const COLLABORATION_PLUGIN_ID = "natalia-collaboration";
export type CollaborationPluginInput = {
  waiter: InteractiveWaiterDeps;
  tools: CollaborationToolPorts;
};

export const COLLABORATION_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: COLLABORATION_PLUGIN_ID,
  version: "1.0.0",
  name: "Collaboration",
  description: "Interactive waiting and Live Work Chat collaboration.",
  entry: "natalia:collaboration",
  scope: "workspace",
  provides: [COLLABORATION_WAITER_SERVICE],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["services", "tools"],
};

export function createCollaborationPlugin(
  input: CollaborationPluginInput,
): Plugin {
  let waiter: ReturnType<typeof createInteractiveWaiter> | undefined;
  return {
    manifest: COLLABORATION_PLUGIN_MANIFEST,
    setup(api) {
      waiter = createInteractiveWaiter(input.waiter);
      api.services.provide(COLLABORATION_WAITER_SERVICE, waiter);
      for (const tool of collaborationTools(input.tools))
        api.tools.register(tool);
    },
    dispose() {
      waiter = undefined;
    },
  };
}
