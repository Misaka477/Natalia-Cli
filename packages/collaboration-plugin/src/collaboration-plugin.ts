/**
 * The collaboration built-in plugin: the interactive approval/question waiter.
 *
 * The waiter is the runtime's only blocking conversation with a human — the
 * pending records, the waiters, the session-scoped grants and the terminal
 * approval scopes. It now lives on the unified plugin lifecycle and is provided
 * as the `collaboration.waiter` service, so a disabled or absent plugin
 * constructs no waiter at all (and therefore never blocks on a human).
 *
 * Mailbox projections and the mailbox_acknowledge tool also live in this
 * package. Provider-driven collaboration orchestration remains in the host
 * until its session and wake dependencies have plugin service contracts.
 */
import type { Plugin } from "@natalia/plugin";
import type { InteractiveWaiterDeps } from "./interactive-waiter";
import { createInteractiveWaiter } from "./interactive-waiter";

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
