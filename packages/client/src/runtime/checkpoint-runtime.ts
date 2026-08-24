/**
 * Checkpoint controllers per session — runtime/checkpoint-runtime module.
 *
 * `checkpointControllerFor` resolves and caches the checkpoint factory's
 * controller for a session; `initializeCheckpointController` drives its init
 * exactly once per factory. The cache is keyed by the resolved factory: a
 * plugin reload publishes a new factory, so the session gets a fresh
 * controller instead of reusing the old plugin's disposed instance. Reads
 * what it needs from `RuntimeContext` at call time.
 */
import {
  CHECKPOINT_FACTORY_SERVICE,
  SUBAGENTS_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  type CheckpointFactory,
  type SubagentsService,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";

export function createCheckpointRuntime(ctx: RuntimeContext) {
  return {
    checkpointControllerFor,
    initializeCheckpointController,
  };

  function checkpointControllerFor(exec: SessionExecutionState) {
    const { getTsRuntimeConfig, publishForSession } = ctx.ports;
    const { checkpointControllerBySession } = ctx.state;
    const id = exec.session.id;
    const factory = ctx.ports.resolveService<CheckpointFactory>(
      CHECKPOINT_FACTORY_SERVICE,
    );
    if (!factory) return undefined;
    const existing = checkpointControllerBySession.get(id);
    if (existing?.factory === factory) return existing.controller;
    if (
      !ctx.ports.resolveService<WorkLedgerController>(
        WORK_LEDGER_CONTROLLER_SERVICE,
      )
    )
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    const controller = factory({
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
    checkpointControllerBySession.set(id, { factory, controller });
    return controller;
  }

  async function initializeCheckpointController(exec: SessionExecutionState) {
    const { checkpointInitBySession } = ctx.state;
    const id = exec.session.id;
    const factory = ctx.ports.resolveService<CheckpointFactory>(
      CHECKPOINT_FACTORY_SERVICE,
    );
    if (!factory) return undefined;
    let pending = checkpointInitBySession.get(id);
    if (!pending || pending.factory !== factory) {
      const controller = checkpointControllerFor(exec);
      if (!controller) return undefined;
      pending = { factory, promise: controller.init() };
      checkpointInitBySession.set(id, pending);
    }
    await pending.promise;
    return checkpointControllerFor(exec);
  }
}
