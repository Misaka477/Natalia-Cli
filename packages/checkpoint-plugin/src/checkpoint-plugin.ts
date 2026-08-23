import type { Plugin } from "@natalia/plugin";
import { createCheckpointController } from "./checkpoint-controller";
import {
  CHECKPOINT_FACTORY_SERVICE,
  type CheckpointController,
  type CheckpointFactory,
} from "@natalia/runtime-services";

export const CHECKPOINT_PLUGIN_ID = "natalia-checkpoint";
export function createCheckpointControllerPlugin(input: {
  workspaceRoot: string;
}): Plugin {
  const controllers = new Set<CheckpointController>();
  return {
    manifest: {
      apiVersion: 2,
      id: CHECKPOINT_PLUGIN_ID,
      version: "1.0.0",
      name: "Checkpoint",
      description: "Durable session checkpoints and rollback.",
      entry: "natalia:checkpoint",
      scope: "workspace",
      provides: [CHECKPOINT_FACTORY_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      const factory: CheckpointFactory = (accessors) => {
        const controller = createCheckpointController({
          workspaceRoot: input.workspaceRoot,
          ...accessors,
        });
        controllers.add(controller);
        return controller;
      };
      api.services.provide(CHECKPOINT_FACTORY_SERVICE, factory);
    },
    dispose() {
      controllers.clear();
    },
  };
}
