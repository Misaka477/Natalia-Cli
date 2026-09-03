/**
 * Checkpoint controllers per session — runtime/checkpoint-runtime module.
 *
 * Resolves the checkpoint plugin service at call time. The plugin owns the
 * per-session controller lifecycle; this runtime module never retains a
 * concrete plugin controller.
 */
import {
  CHECKPOINT_FACTORY_SERVICE,
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  SUBAGENTS_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  type CheckpointController,
  type CheckpointFactory,
  type SubagentsService,
  type RuntimeServiceClient,
  type StatusSnapshotController,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";

export function createCheckpointRuntime(ctx: RuntimeContext) {
  return {
    checkpointControllerFor,
    initializeCheckpointController,
    checkpointList,
    checkpointPreview,
    checkpointRollback,
    checkpointRename,
    createSafetyCheckpoint,
    workspaceDiff,
  };

  async function requireInitializedController(sessionID?: string) {
    await ctx.ports.getReady();
    const owner = sessionID
      ? ctx.ports
          .getExecutionBySession()
          .get(sessionID as SessionID) ?? ctx.ports.getActiveExec()
      : ctx.ports.getActiveExec();
    if (!owner) throw new Error("session is not initialized");
    const controller = await initializeCheckpointController(owner);
    if (!controller)
      throw new Error("checkpoint controller unavailable (natalia-checkpoint)");
    return { controller, owner };
  }

  async function checkpointList(sessionID?: string): Promise<
    Awaited<ReturnType<NonNullable<RuntimeServiceClient["checkpointList"]>>>
  > {
    const { controller } = await requireInitializedController(sessionID);
    return (await controller.list()).map(toRuntimeCheckpoint);
  }

  async function checkpointPreview(id: string, sessionID?: string) {
    const { controller } = await requireInitializedController(sessionID);
    return await controller.preview(id);
  }

  async function workspaceDiff(): Promise<
    Awaited<ReturnType<NonNullable<RuntimeServiceClient["workspaceDiff"]>>>
  > {
    const { controller } = await requireInitializedController();
    return await controller.get().workspaceDiff();
  }

  async function checkpointRollback(input: { id: string; dryRun?: boolean; sessionID?: string }) {
    const { controller, owner } = await requireInitializedController(input.sessionID);
    const preview = await controller.rollback(input.id, {
      dryRun: input.dryRun,
    });
    const status = ctx.ports.resolveService<StatusSnapshotController>(
      STATUS_SNAPSHOT_CONTROLLER_SERVICE,
    );
    if (!status) throw new Error("runtime UI unavailable (natalia-runtime-ui)");
    ctx.ports.publishForSession(
      owner,
      await status.snapshotFor({
        provider: owner.provider,
        context: owner.context,
        permissionMode: owner.permissionMode,
      }),
    );
    return preview;
  }

  async function checkpointRename(input: { id: string; name: string; sessionID?: string }) {
    const { controller } = await requireInitializedController(input.sessionID);
    return toRuntimeCheckpoint(await controller.rename(input.id, input.name));
  }

  async function createSafetyCheckpoint() {
    const { controller, owner } = await requireInitializedController();
    if (!controller.isEnabled()) return undefined;
    const record = await controller.createCheckpoint({
      reason: "rollback_safety",
      context: owner.context,
      step: owner.context.journalStatus().messageCount,
      status: "rollback_safety",
    });
    if (!record.complete)
      throw new Error(
        "rollback safety checkpoint is incomplete; refusing message rollback",
      );
    return record.id;
  }

  function toRuntimeCheckpoint(
    record: Awaited<ReturnType<CheckpointController["list"]>>[number],
  ): Awaited<ReturnType<NonNullable<RuntimeServiceClient["checkpointList"]>>>[number] {
    return {
      id: record.id,
      sequence: record.sequence,
      turnID: record.turnID,
      stepID: record.stepID,
      step: record.step,
      reason: record.reason,
      ...(record.name ? { name: record.name } : {}),
      createdAt: record.createdAt,
      complete: record.complete,
      errors: record.errors,
      files: Object.keys(record.manifest.entries).length,
      changes: record.changes.length,
      tokenEstimate: record.context.tokenEstimate,
      diskUsageBytes: record.diskUsageBytes,
    };
  }

  function checkpointControllerFor(exec: SessionExecutionState) {
    const { getTsRuntimeConfig, publishForSession } = ctx.ports;
    const id = exec.session.id;
    const factory = ctx.ports.resolveService<CheckpointFactory>(
      CHECKPOINT_FACTORY_SERVICE,
    );
    if (!factory) return undefined;
    if (
      !ctx.ports.resolveService<WorkLedgerController>(
        WORK_LEDGER_CONTROLLER_SERVICE,
      )
    )
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    return factory({
      sessionID: () => id,
      checkpoint: () => getTsRuntimeConfig()?.checkpoint,
      workspace: () => getTsRuntimeConfig()?.workspace,
      publish: (event) => publishForSession(exec, event),
      context: () => exec.context,
      subagents: () => {
        const subagents =
          ctx.ports.resolveService<SubagentsService>(SUBAGENTS_SERVICE);
        return subagents?.enabled() ? subagents : undefined;
      },
      activeAbort: () => exec.activeAbort,
      workLedger: () => {
        const workLedger = ctx.ports.resolveService<WorkLedgerController>(
          WORK_LEDGER_CONTROLLER_SERVICE,
        );
        if (!workLedger)
          throw new Error("work ledger unavailable (natalia-work-ledger)");
        return workLedger;
      },
    });
  }

  async function initializeCheckpointController(exec: SessionExecutionState) {
    const controller = checkpointControllerFor(exec);
    if (!controller) return undefined;
    await controller.init();
    return controller;
  }
}
