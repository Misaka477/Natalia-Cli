import type { RuntimeContext } from "../context";

export function initializeConstants(ctx: RuntimeContext) {
  const names = ctx.state.initialize.serviceNames;
  return {
    ATTACHMENT_SERVICE: names.attachment,
    STATUS_SNAPSHOT_CONTROLLER_SERVICE: names.statusSnapshotController,
    WORK_LEDGER_CONTROLLER_SERVICE: names.workLedgerController,
    GOVERNANCE_LEDGER_CONTROLLER_SERVICE: names.governanceLedgerController,
    SANDBOX_SERVICE: names.sandbox,
    SUBAGENTS_SERVICE: names.subagents,
    SESSION_STORE_CONTROLLER_SERVICE: names.sessionStoreController,
    TOOL_POLICY_SERVICE: names.toolPolicy,
  };
}
