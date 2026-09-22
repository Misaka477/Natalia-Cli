import type { RuntimeContext } from "../context";

export function initializeConstants(ctx: RuntimeContext) {
  const names = ctx.state.initialize.serviceNames;
  return {
    WORK_LEDGER_CONTROLLER_SERVICE: names.workLedgerController,
    SANDBOX_SERVICE: names.sandbox,
    SUBAGENTS_SERVICE: names.subagents,
    SESSION_STORE_CONTROLLER_SERVICE: names.sessionStoreController,
    TOOL_POLICY_SERVICE: names.toolPolicy,
  };
}
