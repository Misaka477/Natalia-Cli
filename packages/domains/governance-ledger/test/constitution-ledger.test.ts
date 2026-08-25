import { expect, test } from "bun:test";
import {
  SELF_PROTECTION_RULES,
  recordDecision,
  seedConstitutionRules,
} from "../src/constitution-ledger";
import type { RuntimeEvent } from "@natalia/contracts";

test("the self-protection rules are the runtime's real rule metadata", () => {
  expect(SELF_PROTECTION_RULES.map((rule) => rule.ruleID)).toEqual([
    "C-TERM-001",
    "C-TERM-002",
    "C-TERM-003",
  ]);
});

test("seeding a fresh journal publishes all three rules as durable facts", () => {
  const seeded = seedConstitutionRules([]);
  expect(seeded).toHaveLength(3);
  for (const rule of seeded) {
    expect(rule.type).toBe("constitution.rule_added");
    expect(rule.scope).toBe("release");
    expect(rule.priority).toBe("critical");
    expect(rule.source).toBe("policy");
    expect(rule.enforcement).toBe("deny");
    expect(rule.overridePolicy).toBe("forbidden");
  }
  expect(seeded.map((rule) => rule.ruleID)).toEqual([
    "C-TERM-001",
    "C-TERM-002",
    "C-TERM-003",
  ]);
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
  ]);
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
