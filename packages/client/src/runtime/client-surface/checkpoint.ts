import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  type StatusSnapshotController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  "checkpointList" | "checkpointPreview" | "checkpointRollback"
>;
export function createCheckpointSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async checkpointList() {
      await ctx.ports.getReady();
      const owner = ctx.ports.getActiveExec();
      if (!owner) throw new Error("session is not initialized");
      const controller = await ctx.ports.initializeCheckpointController(owner);
      if (!controller)
        throw new Error(
          "checkpoint controller unavailable (natalia-checkpoint)",
        );
      return (await controller.get().list()).map((record) => ({
        id: record.id,
        sequence: record.sequence,
        turnID: record.turnID,
        stepID: record.stepID,
        step: record.step,
        reason: record.reason,
        createdAt: record.createdAt,
        complete: record.complete,
        errors: record.errors,
        files: Object.keys(record.manifest.entries).length,
        changes: record.changes.length,
        tokenEstimate: record.context.tokenEstimate,
        diskUsageBytes: record.diskUsageBytes,
      }));
    },
    async checkpointPreview(id) {
      await ctx.ports.getReady();
      const owner = ctx.ports.getActiveExec();
      if (!owner) throw new Error("session is not initialized");
      const controller = await ctx.ports.initializeCheckpointController(owner);
      if (!controller)
        throw new Error(
          "checkpoint controller unavailable (natalia-checkpoint)",
        );
      return await controller
        .get()
        .previewRollback(id, owner.context, controller.resources(), true);
    },
    async checkpointRollback(input) {
      await ctx.ports.getReady();
      const owner = ctx.ports.getActiveExec();
      if (!owner) throw new Error("session is not initialized");
      const controller = await ctx.ports.initializeCheckpointController(owner);
      if (!controller)
        throw new Error(
          "checkpoint controller unavailable (natalia-checkpoint)",
        );
      const preview = await controller.get().rollbackTo(input.id, {
        context: owner.context,
        dryRun: input.dryRun,
        ...controller.rollbackOptions(),
      });
      const status = ctx.ports.resolveService<StatusSnapshotController>(
        STATUS_SNAPSHOT_CONTROLLER_SERVICE,
      );
      if (!status)
        throw new Error("runtime UI unavailable (natalia-runtime-ui)");
      ctx.ports.publishForSession(
        owner,
        await status.snapshotFor({
          provider: owner.provider,
          context: owner.context,
          permissionMode: owner.permissionMode,
        }),
      );
      return preview;
    },
  };
}
