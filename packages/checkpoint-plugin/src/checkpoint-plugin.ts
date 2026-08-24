import type { Plugin } from "@natalia/plugin";
import type { SessionID } from "@natalia/contracts";
import { runCheckpointCommand } from "@natalia/runtime";
import { createCheckpointController } from "./checkpoint-controller";
import {
  CHECKPOINT_FACTORY_SERVICE,
  type CheckpointController,
  type CheckpointFactory,
} from "@natalia/runtime-services";

export const CHECKPOINT_PLUGIN_ID = "natalia-checkpoint";
export type CheckpointPluginInput = {
  workspaceRoot: string;
  commands?: {
    controller(sessionID: SessionID): Promise<CheckpointController | undefined>;
    context(sessionID: SessionID): import("@natalia/runtime").ContextLedger;
    referencedObjectIDs(): Promise<Set<string>>;
  };
};

export function createCheckpointControllerPlugin(
  input: CheckpointPluginInput,
): Plugin {
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
      integrationPoints: ["services", "commands"],
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
      for (const name of ["checkpoint", "checkpoints", "rollback"])
        api.commands.register({
          name,
          title: `${name[0]!.toUpperCase()}${name.slice(1)}`,
          async run(invocation) {
            if (!invocation?.sessionID)
              throw new Error("checkpoint command requires a session");
            if (!input.commands)
              throw new Error("checkpoint command host is unavailable");
            const sessionID = invocation.sessionID as SessionID;
            const controller = await input.commands.controller(sessionID);
            if (!controller)
              throw new Error(
                "checkpoint controller unavailable (natalia-checkpoint)",
              );
            if (!controller.isEnabled())
              throw new Error("checkpoint store is not initialized");
            const result = await runCheckpointCommand(
              controller.get(),
              input.commands.context(sessionID),
              invocation.raw,
              controller.rollbackOptions(),
              input.commands.referencedObjectIDs,
            );
            return result.output;
          },
        });
    },
    dispose() {
      controllers.clear();
    },
  };
}
