import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@anthelia/contracts";
import {
  projectedConstitutionRules,
  projectedWorkContracts,
  sessionFactStateFromEvents,
} from "@anthelia/session";
import type { SessionExecutionState } from "@anthelia/substrate";
import { driftConstraintReadsFor } from "../src/boundary";

/**
 * The drift judgement's constraint inputs (boundary.ts's read policy): the
 * constitution rules and work contracts come from the complete fact state
 * when available. A fast-attach execution holds only the post-epoch tail —
 * judging a turn against a tail's empty constraint set is worse than not
 * judging at all, and that is exactly what this policy prevents.
 */

const rule: RuntimeEvent = {
  type: "constitution.rule_added",
  id: "rule:1",
  ruleID: "C-001",
  statement: "Never commit without approval",
  scope: "project",
  priority: "critical",
  source: "user",
  enforcement: "approval",
  overridePolicy: "forbidden",
};

const contract: RuntimeEvent = {
  type: "work_contract.accepted",
  id: "work_contract:plan_1:accepted",
  planID: "plan_1",
  planVersion: 1,
  scope: ["src/**"],
  verification: ["bun test"],
  constraints: ["never commit without approval"],
  acceptedBy: "user",
  acceptedAt: "2026-01-01T00:00:00.000Z",
};

/** The pre-epoch facts, then the noise a fast attach would still hold. */
function journal(): RuntimeEvent[] {
  const all: RuntimeEvent[] = [rule, contract];
  for (let index = 0; index < 50; index += 1)
    all.push({
      type: "tool.update",
      id: `turn_1:call_${index}`,
      name: "read_file",
      callID: `call_${index}`,
      status: "succeeded",
      summary: "read",
    });
  return all;
}

test("the fact path keeps pre-epoch rules and contracts on a fast attach", () => {
  const all = journal();
  const tail = all.slice(-2);
  const exec = {
    session: { id: "ses_boundary", events: tail },
    factStateComplete: true,
    factState: sessionFactStateFromEvents(all),
  } as unknown as SessionExecutionState;

  const reads = driftConstraintReadsFor(exec);
  expect(reads.constitutionRules.map((r) => r.ruleID)).toEqual(["C-001"]);
  expect(reads.workContracts).toEqual(projectedWorkContracts(all));
  expect(reads.workContracts[0]?.status).toBe("current");
});

test("the belt path folds the resident array when the state is incomplete", () => {
  const all = journal();
  const exec = {
    session: { id: "ses_boundary", events: all },
    factStateComplete: false,
  } as unknown as SessionExecutionState;

  const reads = driftConstraintReadsFor(exec);
  expect(reads.constitutionRules).toEqual(projectedConstitutionRules(all));
  expect(reads.workContracts).toEqual(projectedWorkContracts(all));
});

test("a tail-only belt is the debt this policy exists to prevent", () => {
  const all = journal();
  const tail = all.slice(-2);
  const exec = {
    session: { id: "ses_boundary", events: tail },
    factStateComplete: false,
  } as unknown as SessionExecutionState;

  // What the pre-fix reconcile path saw on every turn-end: the pre-epoch
  // rule and contract are invisible, so the judge would have judged the
  // work against an empty constraint set.
  const reads = driftConstraintReadsFor(exec);
  expect(reads.constitutionRules).toEqual([]);
  expect(reads.workContracts).toEqual([]);
});
