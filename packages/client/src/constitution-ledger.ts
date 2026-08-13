/**
 * Constitution / Decision ledger writers — the production half of P1.
 *
 * CST1 shipped the schema, journal, projection, queries and TUI commands;
 * CST2 wired `constitution.check` into tool preflight. But `constitution.rule_added`
 * and `decision.recorded` had **zero production emit points**: the rule library
 * every query read stayed empty, and the only enforcement that ever ran was the
 * hard-coded `SELF_PROTECTION_PATTERNS` in `real-runtime.ts`. §5 of the mainline
 * plan calls this out: "当前实际规则应迁移为第一批 facts".
 *
 * This module is that migration's pure half, following the work-graph and
 * session-intelligence writers: event construction lives here, idempotency is
 * explicit, and the tests cover the pure functions without building a runtime.
 *
 * Rules carry no executable code — `statement`/`ruleID`/`priority`/`enforcement`
 * are the durable facts; the regex matcher that enforces them stays in the
 * runtime. `source` is `policy` because the self-protection rules are runtime
 * policy, and `overridePolicy` is `forbidden` because a critical runtime-boundary
 * rule must not be silently loosened (不可回退规则: critical/high 规则不能由 Main
 * Agent 或 Live Work Chat 静默修改).
 */
import type { RuntimeEvent } from "@natalia/contracts";

/**
 * The built-in runtime self-protection rules, migrated verbatim from the
 * runtime's hard-coded matcher. This is the single source of truth for the rule
 * metadata; `real-runtime.ts` keeps the regex matcher and looks these up.
 */
export const SELF_PROTECTION_RULES: ReadonlyArray<{
  ruleID: string;
  statement: string;
}> = [
  {
    ruleID: "C-TERM-001",
    statement: "禁止直接杀掉 wezterm-mux-server",
  },
  {
    ruleID: "C-TERM-002",
    statement: "禁止删除 Natalia 运行时目录",
  },
  {
    ruleID: "C-TERM-003",
    statement: "禁止删除 Natalia 临时目录",
  },
];

/**
 * Builds the `constitution.rule_added` events for the self-protection rules,
 * skipping any ruleID already present in the journal. Called on every session
 * boot so the rules are durable facts in every new session, and harmless on
 * replay (the journal already holds them).
 */
export function seedConstitutionRules(
  events: RuntimeEvent[],
): Array<Extract<RuntimeEvent, { type: "constitution.rule_added" }>> {
  const present = new Set(
    events
      .filter(
        (
          event,
        ): event is Extract<
          RuntimeEvent,
          { type: "constitution.rule_added" }
        > => event.type === "constitution.rule_added",
      )
      .map((event) => event.ruleID),
  );
  const seeded: Array<
    Extract<RuntimeEvent, { type: "constitution.rule_added" }>
  > = [];
  for (const rule of SELF_PROTECTION_RULES) {
    if (present.has(rule.ruleID)) continue;
    seeded.push({
      type: "constitution.rule_added",
      id: `constitution:${rule.ruleID.toLowerCase()}`,
      ruleID: rule.ruleID,
      statement: rule.statement,
      scope: "release",
      priority: "critical",
      source: "policy",
      enforcement: "deny",
      overridePolicy: "forbidden",
    });
  }
  return seeded;
}

/**
 * Constructs a `decision.recorded` event. The decision text and rationale are
 * durable facts (they may reach the journal); alternatives and consequences are
 * optional and must be safe prose — never tool output, file content or secrets.
 */
export function recordDecision(input: {
  id: string;
  decision: string;
  rationale?: string[];
  alternatives?: { option: string; rejectedReason?: string }[];
  consequences?: string[];
  linkedPlans?: string[];
  linkedConstraints?: string[];
}): Extract<RuntimeEvent, { type: "decision.recorded" }> {
  return {
    type: "decision.recorded",
    id: input.id,
    decision: input.decision,
    ...(input.rationale ? { rationale: input.rationale } : {}),
    ...(input.alternatives ? { alternatives: input.alternatives } : {}),
    ...(input.consequences ? { consequences: input.consequences } : {}),
    ...(input.linkedPlans ? { linkedPlans: input.linkedPlans } : {}),
    ...(input.linkedConstraints
      ? { linkedConstraints: input.linkedConstraints }
      : {}),
    status: "accepted",
  };
}
