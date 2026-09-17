/**
 * Constitution / Decision ledger writers — the production half of P1.
 *
 * CST1 shipped the schema, journal, projection, queries and TUI commands;
 * CST2 wired `constitution.check` into tool preflight. But `constitution.rule_added`
 * and `decision.recorded` had **zero production emit points**: the rule library
 * every query read stayed empty, and the only enforcement that ever ran was the
 * hard-coded `SELF_PROTECTION_PATTERNS` in the runtime tool-execution path. §5 of the mainline
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
 * metadata; the runtime tool-execution path keeps the regex matcher and looks these up.
 */
export const SELF_PROTECTION_RULES: ReadonlyArray<{
  ruleID: string;
  statement: string;
  enforcement: "deny" | "approval" | "warn";
  overridePolicy?: "forbidden" | "user_scoped" | "user_explicit";
}> = [
  {
    ruleID: "C-TERM-001",
    statement: "禁止直接杀掉 wezterm-mux-server",
    enforcement: "deny",
  },
  {
    ruleID: "C-TERM-002",
    statement: "禁止删除 Natalia 运行时目录",
    enforcement: "deny",
  },
  {
    ruleID: "C-TERM-003",
    statement: "禁止删除 Natalia 临时目录",
    enforcement: "deny",
  },
  {
    ruleID: "C-REL-001",
    statement: "git 写操作强制审批",
    enforcement: "approval",
    overridePolicy: "user_scoped",
  },
  {
    ruleID: "C-REL-002",
    statement: "未知副作用不自动 replay",
    enforcement: "deny",
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
): Array<
  Extract<
    RuntimeEvent,
    { type: "constitution.rule_added" | "constitution.rule_updated" }
  >
> {
  type EffectiveRule = {
    statement: string;
    priority: "critical" | "high" | "medium" | "low";
    enforcement: "deny" | "approval" | "warn";
    overridePolicy: "forbidden" | "user_scoped" | "user_explicit";
  };
  const effective = new Map<string, EffectiveRule>();
  for (const event of events) {
    if (event.type === "constitution.rule_added") {
      if (!effective.has(event.ruleID))
        effective.set(event.ruleID, {
          statement: event.statement,
          priority: event.priority,
          enforcement: event.enforcement,
          overridePolicy: event.overridePolicy,
        });
      continue;
    }
    if (event.type === "constitution.rule_updated") {
      const current = effective.get(event.ruleID);
      if (!current) continue;
      effective.set(event.ruleID, {
        ...current,
        ...(event.statement ? { statement: event.statement } : {}),
        ...(event.priority ? { priority: event.priority } : {}),
        ...(event.enforcement ? { enforcement: event.enforcement } : {}),
        ...(event.overridePolicy
          ? { overridePolicy: event.overridePolicy }
          : {}),
      });
    }
  }

  const seeded: Array<
    Extract<
      RuntimeEvent,
      { type: "constitution.rule_added" | "constitution.rule_updated" }
    >
  > = [];
  for (const rule of SELF_PROTECTION_RULES) {
    const overridePolicy = rule.overridePolicy ?? "forbidden";
    const current = effective.get(rule.ruleID);
    if (!current) {
      seeded.push({
        type: "constitution.rule_added",
        id: `constitution:${rule.ruleID.toLowerCase()}`,
        ruleID: rule.ruleID,
        statement: rule.statement,
        scope: "release",
        priority: "critical",
        source: "policy",
        enforcement: rule.enforcement,
        overridePolicy,
      });
      continue;
    }
    if (
      current.statement === rule.statement &&
      current.enforcement === rule.enforcement &&
      current.overridePolicy === overridePolicy
    )
      continue;
    seeded.push({
      type: "constitution.rule_updated",
      id: `constitution:update:${rule.ruleID.toLowerCase()}`,
      ruleID: rule.ruleID,
      statement: rule.statement,
      priority: "critical",
      enforcement: rule.enforcement,
      overridePolicy,
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
  scope?: "session" | "workspace";
}): Extract<RuntimeEvent, { type: "decision.recorded" }> {
  return {
    type: "decision.recorded",
    id: input.id,
    decision: input.decision,
    ...(input.scope ? { scope: input.scope } : {}),
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

/* ---------------------------------------------------------------------------
 * Model rule proposals and the disable / remove lifecycle (EI §3.8 P-1.c).
 *
 * The document authoring face and the journal execution face share one rule
 * vocabulary, but only the journal face is executable: a prose paragraph is a
 * soft constraint (warn), an HTML-comment-annotated or promoted rule with a
 * non-empty appliesTo is a hard one. A model may only PROPOSE rules that
 * tighten itself; a user owns approval, disable and removal.
 * ------------------------------------------------------------------------- */

export type ConstitutionRuleProposal = {
  statement: string;
  enforcement: "deny" | "approval" | "warn";
  appliesTo?: {
    tools?: string[];
    paths?: string[];
    commandPattern?: string;
  };
  priority?: "critical" | "high" | "medium" | "low";
  /**
   * Raw scope as proposed (the model's tool arguments are untrusted JSON): only
   * "project" and "package" are user-owned; "release" is runtime
   * self-protection and rejected here.
   */
  scope?: string;
};

/**
 * Validates a model rule proposal before the gate (EI §3.8 P-1.c):
 *
 * - `deny` / `approval` require a non-empty `appliesTo` — a hard rule the
 *   runtime matcher cannot execute is not a rule, it is a slogan;
 * - `scope: "release"` is rejected — the runtime self-protection rules are not
 *   a model's to touch.
 *
 * Returns the rejection reasons; an empty array means the proposal is valid.
 */
export function validateConstitutionRuleProposal(
  proposal: ConstitutionRuleProposal,
): string[] {
  const problems: string[] = [];
  if (!proposal.statement.trim()) problems.push("statement must be non-empty");
  if (
    proposal.scope !== undefined &&
    proposal.scope !== "project" &&
    proposal.scope !== "package"
  )
    problems.push(
      `scope "${proposal.scope}" is not user-owned; only project or package rules can be proposed`,
    );
  if (proposal.enforcement === "deny" || proposal.enforcement === "approval") {
    const anchor = proposal.appliesTo;
    const anchored =
      (anchor?.tools?.length ?? 0) > 0 ||
      (anchor?.paths?.length ?? 0) > 0 ||
      Boolean(anchor?.commandPattern?.trim());
    if (!anchored)
      problems.push(
        `${proposal.enforcement} rules require a non-empty appliesTo (tools, paths or commandPattern)`,
      );
  }
  return problems;
}

/**
 * Builds a `constitution.rule_added` event for a user-approved model proposal
 * (EI §3.8 P-1.c): `source: "agent_proposed"` + the user's approval is the
 * provenance; the rule is permanent (no once/session semantics — a one-time
 * exemption is `override_granted`'s job).
 */
export function buildProposedConstitutionRule(input: {
  id: string;
  ruleID: string;
  proposal: ConstitutionRuleProposal;
  priority?: "critical" | "high" | "medium" | "low";
}): Extract<RuntimeEvent, { type: "constitution.rule_added" }> {
  return {
    type: "constitution.rule_added",
    id: input.id,
    ruleID: input.ruleID,
    statement: input.proposal.statement,
    scope: input.proposal.scope === "package" ? "package" : "project",
    priority: input.proposal.priority ?? "high",
    source: "agent_proposed",
    enforcement: input.proposal.enforcement,
    overridePolicy: "user_explicit",
    ...(input.proposal.appliesTo
      ? { appliesTo: input.proposal.appliesTo }
      : {}),
  };
}

/**
 * Builds a `constitution.rule_updated` event that disables (or re-enables) a
 * rule (EI §3.8 P-1.c): a disable is reversible and keeps the rule in the
 * journal; only `rule_removed` is the durable tombstone.
 */
export function buildConstitutionRuleEnabledChange(input: {
  id: string;
  ruleID: string;
  enabled: boolean;
  statement?: string;
  priority?: "critical" | "high" | "medium" | "low";
  enforcement?: "deny" | "approval" | "warn";
}): Extract<RuntimeEvent, { type: "constitution.rule_updated" }> {
  return {
    type: "constitution.rule_updated",
    id: input.id,
    ruleID: input.ruleID,
    enabled: input.enabled,
    ...(input.statement ? { statement: input.statement } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.enforcement ? { enforcement: input.enforcement } : {}),
  };
}

/**
 * Builds the append-only `constitution.rule_removed` tombstone (EI §3.8
 * P-1.c): the journal keeps the full history of the rule's life, the
 * projection only drops it from the effective set. `removedBy` is always a
 * user — a model never deletes or weakens an existing rule.
 */
export function buildConstitutionRuleRemoved(input: {
  id: string;
  ruleID: string;
  removedAt: string;
}): Extract<RuntimeEvent, { type: "constitution.rule_removed" }> {
  return {
    type: "constitution.rule_removed",
    id: input.id,
    ruleID: input.ruleID,
    removedAt: input.removedAt,
    removedBy: "user",
  };
}
