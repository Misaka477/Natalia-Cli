/**
 * Checkpoint controllers per session — runtime/checkpoint-runtime module.
 *
 * `checkpointControllerFor` resolves and caches the checkpoint factory's
 * controller for a session; `initializeCheckpointController` drives its init
 * exactly once. Reads what it needs from `RuntimeContext` at call time.
 */
import {
  CHECKPOINT_FACTORY_SERVICE,
  type CheckpointFactory,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "../real-runtime";

export function createCheckpointRuntime(ctx: RuntimeContext) {
  return {
    checkpointControllerFor,
    initializeCheckpointController,
  };

  function checkpointControllerFor(exec: SessionExecutionState) {
    const {
      getCapabilityRegistry,
      getTsRuntimeConfig,
      getSubagentsController,
      getWorkLedgerController,
      publishForSession,
    } = ctx.ports;
    const { checkpointControllerBySession } = ctx.state;
    const id = exec.session.id;
    const existing = checkpointControllerBySession.get(id);
    if (existing) return existing;
    const factory = getCapabilityRegistry().service<CheckpointFactory>(
      CHECKPOINT_FACTORY_SERVICE,
    );
    if (!factory) return undefined;
    const controller = factory({
      sessionID: () => id,
      checkpoint: () => getTsRuntimeConfig()?.checkpoint,
      workspace: () => getTsRuntimeConfig()?.workspace,
      publish: (event) => publishForSession(exec, event),
      context: () => exec.context,
      subagents: () =>
        (getSubagentsController()?.enabled() ?? false)
          ? getSubagentsController()
          : undefined,
      activeAbort: () => exec.activeAbort,
      workLedger: () => getWorkLedgerController(),
    });
    checkpointControllerBySession.set(id, controller);
    return controller;
  }

  async function initializeCheckpointController(exec: SessionExecutionState) {
    const { checkpointControllerBySession, checkpointInitBySession } =
      ctx.state;
    const id = exec.session.id;
    let pending = checkpointInitBySession.get(id);
    if (!pending) {
      const controller = checkpointControllerFor(exec);
      if (!controller) return undefined;
      pending = controller.init();
      checkpointInitBySession.set(id, pending);
    }
    await pending;
    return checkpointControllerFor(exec);
  }
}
