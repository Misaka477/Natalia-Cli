import type { Plugin } from "@natalia/plugin";
import {
  createCheckpointController,
  type CheckpointController,
  type CheckpointControllerAccessors,
} from "./checkpoint-controller";

export const CHECKPOINT_PLUGIN_ID = "natalia-checkpoint";
export const CHECKPOINT_FACTORY_SERVICE = "checkpoint.factory";

export type CheckpointControllerFactory = (
  accessors: CheckpointControllerAccessors,
) => CheckpointController;

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
      const factory: CheckpointControllerFactory = (accessors) => {
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
