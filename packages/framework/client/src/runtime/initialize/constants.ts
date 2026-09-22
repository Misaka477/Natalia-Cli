import type { RuntimeContext } from "../context";

export function initializeConstants(ctx: RuntimeContext) {
  const names = ctx.state.initialize.serviceNames;
  return {
    ATTACHMENT_SERVICE: names.attachment,
    RETRY_SERVICE: names.retry,
    CONTEXT_LEDGER_FACTORY_SERVICE: names.contextLedgerFactory,
    COMPACTION_SERVICE: names.compaction,
    STATUS_SNAPSHOT_CONTROLLER_SERVICE: names.statusSnapshotController,
    WORK_LEDGER_CONTROLLER_SERVICE: names.workLedgerController,
    GOVERNANCE_LEDGER_CONTROLLER_SERVICE: names.governanceLedgerController,
    TURN_CONTROLLER_SERVICE: names.turnController,
    CHECKPOINT_FACTORY_SERVICE: names.checkpointFactory,
    WORKSPACE_WRITE_LOCK_SERVICE: names.workspaceWriteLock,
    WORKSPACE_MUTATIONS_SERVICE: names.workspaceMutations,
    WORKSPACE_FILES_SERVICE: names.workspaceFiles,
    SANDBOX_SERVICE: names.sandbox,
    SUBAGENTS_SERVICE: names.subagents,
    SESSION_STORE_CONTROLLER_SERVICE: names.sessionStoreController,
    TOOL_POLICY_SERVICE: names.toolPolicy,
    PROVIDER_MODEL_CONTROLLER_SERVICE: names.providerModelController,
  };
}
