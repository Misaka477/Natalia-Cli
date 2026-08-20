/**
 * The checkpoint built-in plugin.
 *
 * Previously a visibility-only record; the checkpoint resource controller now
 * lives on the unified plugin lifecycle. Checkpoint stores are per session and
 * created lazily, so the plugin owns the per-session factory as the
 * `checkpoint.factory` service: the host asks the factory for a session's
 * controller, and the factory constructs it with the workspace it holds. A
 * disabled or absent plugin provides no factory, so no checkpoint store opens.
 */
import type { Plugin } from "@natalia/plugin";
import {
  createCheckpointController,
  type CheckpointControllerAccessors,
} from "../checkpoint-controller";

export const CHECKPOINT_PLUGIN_ID = "natalia-checkpoint";
export const CHECKPOINT_FACTORY_SERVICE = "checkpoint.factory";

export type CheckpointControllerFactory = (
  accessors: CheckpointControllerAccessors,
) => ReturnType<typeof createCheckpointController>;

export function createCheckpointControllerPlugin(input: {
  workspaceRoot: string;
}): Plugin {
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
      const factory: CheckpointControllerFactory = (accessors) =>
        createCheckpointController({
          workspaceRoot: input.workspaceRoot,
          ...accessors,
        });
      api.services.provide(CHECKPOINT_FACTORY_SERVICE, factory);
    },
  };
}
