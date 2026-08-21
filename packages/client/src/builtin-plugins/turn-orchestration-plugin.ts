import type { Plugin } from "@natalia/plugin";
import {
  createTurnController,
  type TurnController,
  type TurnControllerInput,
} from "../turn-controller";
export type { TurnController } from "../turn-controller";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  SESSION_STORE_PLUGIN_ID,
} from "./session-store-controller-plugin";

export const TURN_ORCHESTRATION_PLUGIN_ID = "natalia-turn-orchestration";
export const TURN_CONTROLLER_SERVICE = "turn.controller";

export function createTurnOrchestrationPlugin(
  input: TurnControllerInput,
): Plugin {
  let controller: TurnController | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: TURN_ORCHESTRATION_PLUGIN_ID,
      version: "1.0.0",
      name: "Turn Orchestration",
      description: "Durable turn admission, promotion and dispatch ordering.",
      entry: "natalia:turn-orchestration",
      scope: "workspace",
      provides: [TURN_CONTROLLER_SERVICE],
      requires: [SESSION_STORE_CONTROLLER_SERVICE],
      optionalRequires: [],
      conflicts: [],
      dependencies: [
        {
          id: SESSION_STORE_PLUGIN_ID,
          spec: ">=1.0.0",
          optional: false,
          peer: false,
        },
      ],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      if (!api.services.get(SESSION_STORE_CONTROLLER_SERVICE))
        throw new Error("session store unavailable (natalia-session-store)");
      controller = createTurnController(input);
      api.services.provide(TURN_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller?.dispose();
      controller = undefined;
    },
  };
}
