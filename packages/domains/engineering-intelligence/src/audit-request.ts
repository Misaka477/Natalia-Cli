import { workLedgerController } from "@natalia/work-ledger";
import type { RuntimeEvent } from "@anthelia/contracts";
import type {
  RuntimeContext,
  SessionExecutionState,
} from "@anthelia/substrate";
import type { WorkLedgerController } from "@natalia/work-ledger";

/**
 * EI §3.9: completion.recorded is a durable audit trigger. The request is
 * written before waking Nia so restart/dedup have a journal shadow, and both
 * the model tool and the SDK surface go through this one path.
 */
export function requestAuditAfterCompletion(
  ctx: RuntimeContext,
  exec: SessionExecutionState,
  completion: Extract<RuntimeEvent, { type: "completion.recorded" }>,
): void {
  const alreadyRequested = exec.session.events.some(
    (candidate) =>
      candidate.type === "audit.requested" &&
      candidate.triggerEventID === completion.id,
  );
  if (alreadyRequested) return;
  const ledger = ctx.state.serviceDirectory.getOptional(workLedgerController);
  if (!ledger) return;
  const planID = completion.taskID;
  const round =
    exec.session.events.filter(
      (candidate) =>
        candidate.type === "audit.requested" && candidate.planID === planID,
    ).length + 1;
  ctx.ports.publishForSession(
    exec,
    ledger.buildAuditRequested({
      id: `audit:${planID}:${ctx.ports.nextPlanSequence()}`,
      planID,
      planVersion: 1,
      triggerEventID: completion.id,
      round,
      scope: "completion_recorded",
      at: completion.recordedAt,
    }),
  );
  ctx.ports.requestNiaWake(exec);
}
