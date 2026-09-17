import { expect, test } from "bun:test";
import {
  SELF_PROTECTION_RULES,
  buildConstitutionRuleUpdate,
  buildConstitutionRuleRemoved,
  buildProposedConstitutionRule,
  recordDecision,
  seedConstitutionRules,
  validateConstitutionRuleProposal,
} from "../src/constitution-ledger";
import type { RuntimeEvent } from "@natalia/contracts";

test("the self-protection rules are the runtime's real rule metadata", () => {
  expect(SELF_PROTECTION_RULES.map((rule) => rule.ruleID)).toEqual([
    "C-TERM-001",
    "C-TERM-002",
    "C-TERM-003",
    "C-REL-001",
    "C-REL-002",
  ]);
});

test("seeding a fresh journal publishes all three rules as durable facts", () => {
  const seeded = seedConstitutionRules([]);
  expect(seeded).toHaveLength(5);
  for (const rule of seeded) {
    expect(rule.type).toBe("constitution.rule_added");
    if (rule.type !== "constitution.rule_added") continue;
    expect(rule.scope).toBe("release");
    expect(rule.priority).toBe("critical");
    expect(rule.source).toBe("policy");
    expect(rule.enforcement).toBe(
      rule.ruleID === "C-REL-001" ? "approval" : "deny",
    );
  }
  expect(seeded.map((rule) => rule.ruleID)).toEqual([
    "C-TERM-001",
    "C-TERM-002",
    "C-TERM-003",
    "C-REL-001",
    "C-REL-002",
  ]);
  expect(
    seeded.find((rule) => rule.ruleID === "C-REL-001")?.overridePolicy,
  ).toBe("user_scoped");
  expect(
    seeded.find((rule) => rule.ruleID === "C-REL-002")?.overridePolicy,
  ).toBe("forbidden");
});

test("seeding is idempotent: a journal that already holds a rule is not reseeded", () => {
  const existing: RuntimeEvent[] = [
    {
      type: "constitution.rule_added",
      id: "constitution:c-term-001",
      ruleID: "C-TERM-001",
      statement: "禁止直接杀掉 wezterm-mux-server",
      scope: "release",
      priority: "critical",
      source: "policy",
      enforcement: "deny",
      overridePolicy: "forbidden",
    },
  ];
  const seeded = seedConstitutionRules(existing);
  expect(seeded.map((rule) => rule.ruleID)).toEqual([
    "C-TERM-002",
    "C-TERM-003",
    "C-REL-001",
    "C-REL-002",
  ]);
});

test("seeding migrates the old C-REL-001 deny rule to forced approval", () => {
  const existing: RuntimeEvent[] = [
    {
      type: "constitution.rule_added",
      id: "constitution:c-rel-001",
      ruleID: "C-REL-001",
      statement: "默认不 commit/push",
      scope: "release",
      priority: "critical",
      source: "policy",
      enforcement: "deny",
      overridePolicy: "user_scoped",
    },
  ];
  const seeded = seedConstitutionRules(existing);
  expect(seeded).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "constitution.rule_updated",
        ruleID: "C-REL-001",
        enforcement: "approval",
      }),
    ]),
  );
});

test("recordDecision builds an accepted durable decision", () => {
  const event = recordDecision({
    id: "decision:abc",
    decision: "workspace isolation is not container/VM security",
    rationale: ["the sandbox is a workspace boundary"],
    alternatives: [{ option: "VM per sandbox", rejectedReason: "too heavy" }],
    consequences: ["callers must not assume a kernel boundary"],
    linkedConstraints: ["C-TERM-001"],
  });
  expect(event).toMatchObject({
    type: "decision.recorded",
    id: "decision:abc",
    status: "accepted",
    decision: "workspace isolation is not container/VM security",
    rationale: ["the sandbox is a workspace boundary"],
    alternatives: [{ option: "VM per sandbox", rejectedReason: "too heavy" }],
    consequences: ["callers must not assume a kernel boundary"],
    linkedConstraints: ["C-TERM-001"],
  });
});

test("recordDecision stays minimal when optional fields are omitted", () => {
  const event = recordDecision({
    id: "decision:min",
    decision: "default no commit/push",
  });
  expect(event.status).toBe("accepted");
  expect("rationale" in event).toBe(false);
  expect("alternatives" in event).toBe(false);
  expect("consequences" in event).toBe(false);
});

test("a model proposal must carry a structured anchor for hard enforcement", () => {
  // deny without appliesTo is a slogan, not a rule the matcher can execute.
  expect(
    validateConstitutionRuleProposal({
      statement: "never force push",
      enforcement: "deny",
    }),
  ).toEqual([
    "deny rules require a non-empty appliesTo (tools, paths or commandPattern)",
  ]);
  expect(
    validateConstitutionRuleProposal({
      statement: "never force push",
      enforcement: "approval",
      appliesTo: { tools: [] },
    }),
  ).toHaveLength(1);
  expect(
    validateConstitutionRuleProposal({
      statement: "never force push",
      enforcement: "deny",
      appliesTo: { tools: ["run_shell"], commandPattern: "git push.*--force" },
    }),
  ).toEqual([]);
});

test("a model proposal cannot target release scope", () => {
  expect(
    validateConstitutionRuleProposal({
      statement: "relax the terminal guard",
      enforcement: "deny",
      scope: "release",
      appliesTo: { paths: ["packages/framework/runtime"] },
    }),
  ).toEqual([
    'scope "release" is not user-owned; only project or package rules can be proposed',
  ]);
  expect(
    validateConstitutionRuleProposal({
      statement: "keep runtime covered",
      enforcement: "warn",
      scope: "project",
    }),
  ).toEqual([]);
});

test("an approved model proposal lands as agent_proposed provenance", () => {
  const event = buildProposedConstitutionRule({
    id: "constitution:rule:prompt-1",
    ruleID: "P-TEST-001",
    proposal: {
      statement: "no new runtime dependencies",
      enforcement: "deny",
      appliesTo: { paths: ["packages/framework/runtime/src"] },
      scope: "project",
    },
  });
  expect(event).toMatchObject({
    type: "constitution.rule_added",
    ruleID: "P-TEST-001",
    scope: "project",
    source: "agent_proposed",
    enforcement: "deny",
    overridePolicy: "user_explicit",
    appliesTo: { paths: ["packages/framework/runtime/src"] },
  });
});

test("a disable is reversible and a removal is a durable tombstone", () => {
  const disabled = buildConstitutionRuleUpdate({
    id: "constitution:update:prompt-1",
    ruleID: "P-TEST-001",
    enabled: false,
  });
  expect(disabled).toEqual({
    type: "constitution.rule_updated",
    id: "constitution:update:prompt-1",
    ruleID: "P-TEST-001",
    enabled: false,
  });
  const removed = buildConstitutionRuleRemoved({
    id: "constitution:removed:prompt-1",
    ruleID: "P-TEST-001",
    removedAt: "2026-09-16T00:00:00.000Z",
  });
  expect(removed).toEqual({
    type: "constitution.rule_removed",
    id: "constitution:removed:prompt-1",
    ruleID: "P-TEST-001",
    removedAt: "2026-09-16T00:00:00.000Z",
    removedBy: "user",
  });
});
