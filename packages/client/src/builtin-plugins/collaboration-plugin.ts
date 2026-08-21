/**
 * The collaboration built-in plugin: the interactive approval/question waiter.
 *
 * The waiter is the runtime's only blocking conversation with a human — the
 * pending records, the waiters, the session-scoped grants and the terminal
 * approval scopes. It now lives on the unified plugin lifecycle and is provided
 * as the `collaboration.waiter` service, so a disabled or absent plugin
 * constructs no waiter at all (and therefore never blocks on a human).
 *
 * The mailbox and collab_respond tools remain host tools for now: their state
 * settles inside the turn loop, which is the provider-model extraction's scope.
 */
import type { Plugin } from "@natalia/plugin";
import type { InteractiveWaiterDeps } from "../interactive-waiter";
import { createInteractiveWaiter } from "../interactive-waiter";

export const COLLABORATION_PLUGIN_ID = "natalia-collaboration";
export const COLLABORATION_WAITER_SERVICE = "collaboration.waiter";

export function createCollaborationPlugin(input: {
  waiter: InteractiveWaiterDeps;
}): Plugin {
  let waiter: ReturnType<typeof createInteractiveWaiter> | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: COLLABORATION_PLUGIN_ID,
      version: "1.0.0",
      name: "Collaboration",
      description: "Interactive approval and question waiting.",
      entry: "natalia:collaboration",
      scope: "workspace",
      provides: [COLLABORATION_WAITER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      waiter = createInteractiveWaiter(input.waiter);
      api.services.provide(COLLABORATION_WAITER_SERVICE, waiter);
    },
    dispose() {
      waiter = undefined;
    },
  };
}
