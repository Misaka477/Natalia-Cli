import { workLedgerController } from "@natalia/work-ledger";
import type { RuntimeEvent } from "@anthelia/contracts";
import { scanAuditRequestFacts } from "@anthelia/substrate";
import type {
  RuntimeContext,
  SessionExecutionState,
} from "@anthelia/substrate";
import type { WorkLedgerController } from "@natalia/work-ledger";

/**
 * EI §3.9: completion.recorded is a durable audit trigger. The request is
 * written before waking Nia so restart/dedup have a journal shadow, and both
 * the model tool and the SDK surface go through this one path.
 *
 * The dedupe/round facts are paged from the durable log (the shared scan): a
 * fast attach holds only the post-epoch tail, where an older audit.requested
 * for this plan is invisible — the request would republish or its round would
 * restart.
 */
export async function requestAuditAfterCompletion(
  ctx: RuntimeContext,
  exec: SessionExecutionState,
  completion: Extract<RuntimeEvent, { type: "completion.recorded" }>,
): Promise<void> {
  const auditFacts = await scanAuditRequestFacts(ctx, exec, completion.taskID);
  if (auditFacts.triggerEventIDs.includes(completion.id)) return;
  const ledger = ctx.state.serviceDirectory.getOptional(workLedgerController);
  if (!ledger) return;
  const round = auditFacts.count + 1;
  ctx.ports.publishForSession(
    exec,
    ledger.buildAuditRequested({
      id: `audit:${completion.taskID}:${ctx.ports.nextPlanSequence()}`,
      planID: completion.taskID,
      planVersion: 1,
      triggerEventID: completion.id,
      round,
      scope: "completion_recorded",
      at: completion.recordedAt,
    }),
  );
  ctx.ports.requestNiaWake(exec);
}
