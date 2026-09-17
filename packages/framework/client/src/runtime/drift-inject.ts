/**
 * Auto-inject a drift finding into the Main Agent's next step — runtime/
 * drift-inject.ts (EI §3.5 / Phase 2 B3).
 *
 * A warning/high finding is admitted as an internal next-step input so the
 * next provider request must respond to it: drift_acknowledge (explain or
 * dispute), correct the work, or detour_declare a sanctioned detour. advisory
 * findings are noise-level and are not injected. The text carries only the
 * findingID, severity and the rules that fired — never chain-of-thought,
 * objective prose or evidence payloads.
 *
 * Both finding writers share this: the boundary reconcile (workspace-change
 * detection) and the `evaluateDrift` surface (an explicit evaluation).
 */
import { admitInput, buildInputAdmission } from "@natalia/session";
import type { RuntimeEvent } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";

export function injectFindingIntoMainAgent(
  ctx: RuntimeContext,
  target: SessionExecutionState,
  finding: Extract<RuntimeEvent, { type: "drift.finding_opened" }>,
): void {
  if (finding.severity !== "warning" && finding.severity !== "high") return;
  const rules = (finding.ruleHits ?? []).map((hit) => hit.rule).join(", ");
  const id = `turn_drift_${finding.findingID.replace(/[^a-zA-Z0-9]/gu, "_")}`;
  const text =
    `(internal drift finding ${finding.findingID} [${finding.severity}]` +
    `${rules ? ` fired: ${rules}` : ""}. In your next step you must respond to ` +
    `it: call drift_acknowledge to explain or dispute it (with a rationale), ` +
    `correct the work, or detour_declare a sanctioned detour. This is not a ` +
    `user message.)`;
  let admitted;
  try {
    admitted = admitInput(target.session, {
      id,
      text,
      delivery: "next-step",
      internal: true,
    });
  } catch {
    // A conflicting admission for the same id already exists; do not duplicate.
    return;
  }
  ctx.ports.publishForSession(
    target,
    buildInputAdmission({
      id: admitted.id,
      text: admitted.text,
      internal: true,
      delivery: admitted.delivery,
      admittedAt: admitted.admittedAt,
      admittedSeq: admitted.admittedSeq,
    }),
  );
}
