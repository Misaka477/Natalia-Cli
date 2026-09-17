import { expect, test } from "bun:test";
import {
  applySessionWorkContractFact,
  emptySessionWorkContractFactState,
  sessionWorkContractsFrom,
} from "@natalia/session";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  buildWorkContractAccepted,
  buildWorkContractDrafted,
  classifyTaskKind,
  evaluateCompletionCard,
  isPlaceholderContractValue,
  isUnverifiableContract,
  validateWorkContractFields,
} from "../src/work-contract";

const now = "2026-09-16T00:00:00.000Z";

test("a drafted contract carries its plan version and source", () => {
  const event = buildWorkContractDrafted({
    id: "wc:plan:1:1",
    planID: "plan:1",
    planVersion: 3,
    scope: ["packages/framework/runtime/src"],
    verification: ["bun test packages/framework/runtime"],
    draftedAt: now,
  });
  expect(event).toMatchObject({
    type: "work_contract.drafted",
    planID: "plan:1",
    planVersion: 3,
    scope: ["packages/framework/runtime/src"],
    verification: ["bun test packages/framework/runtime"],
    source: "model",
  });
  // Empty field arrays are omitted, not emitted as [].
  expect(event.constraints).toBeUndefined();
});

test("an accepted contract is always user-approved", () => {
  const event = buildWorkContractAccepted({
    id: "wc:plan:1:accepted",
    planID: "plan:1",
    planVersion: 3,
    scope: ["packages/framework/runtime/src"],
    acceptedAt: now,
  });
  expect(event).toMatchObject({
    type: "work_contract.accepted",
    acceptedBy: "user",
  });
  expect(event.acceptedBy).toBe("user");
  expect(event.unverifiable).toBeUndefined();
});

test("an all-empty draft is unverifiable, not invalid", () => {
  expect(isUnverifiableContract({})).toBe(true);
  expect(
    isUnverifiableContract({ scope: [], verification: [], constraints: [] }),
  ).toBe(true);
  expect(isUnverifiableContract({ scope: ["src"] })).toBe(false);
  // An unverifiable acceptance keeps the flow working (advisory-only).
  const event = buildWorkContractAccepted({
    id: "wc:plan:2:accepted",
    planID: "plan:2",
    planVersion: 1,
    acceptedAt: now,
    unverifiable: true,
  });
  expect(event.unverifiable).toBe(true);
});

test("placeholders are rejected with a reason", () => {
  expect(validateWorkContractFields({})).toEqual([]);
  expect(
    validateWorkContractFields({
      scope: ["packages/framework/runtime/src"],
    }),
  ).toEqual([]);
  const problems = validateWorkContractFields({
    scope: ["all"],
    verification: ["相关"],
    constraints: ["x"],
  });
  expect(problems).toHaveLength(3);
  expect(problems[0]).toContain('scope entry "all" is a placeholder');
  expect(problems[1]).toContain("placeholder");
  expect(problems[2]).toContain("placeholder");
  expect(isPlaceholderContractValue("all")).toBe(true);
  expect(isPlaceholderContractValue("EVERYTHING")).toBe(true);
  expect(isPlaceholderContractValue("相关")).toBe(true);
  expect(isPlaceholderContractValue("a")).toBe(true);
  expect(isPlaceholderContractValue("src/parser.ts")).toBe(false);
  expect(isPlaceholderContractValue("改代码后跑 typecheck")).toBe(false);
});

test("a provided but empty field is rejected", () => {
  const problems = validateWorkContractFields({ scope: [] });
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("scope was provided but is empty");
});

function contractEvents(): RuntimeEvent[] {
  return [
    buildWorkContractDrafted({
      id: "wc:plan:1:1",
      planID: "plan:1",
      planVersion: 1,
      scope: ["packages/a"],
      draftedAt: now,
    }),
  ];
}

test("replay yields the draft / current / none three-state contract view", () => {
  const state = emptySessionWorkContractFactState();
  // none: no contract for this plan yet.
  expect(sessionWorkContractsFrom(state)).toEqual([]);

  for (const event of contractEvents())
    applySessionWorkContractFact(state, event);
  expect(sessionWorkContractsFrom(state)).toEqual([
    {
      planID: "plan:1",
      version: 1,
      scope: ["packages/a"],
      status: "draft",
    },
  ]);

  applySessionWorkContractFact(
    state,
    buildWorkContractAccepted({
      id: "wc:plan:1:accepted",
      planID: "plan:1",
      planVersion: 1,
      scope: ["packages/a"],
      acceptedAt: now,
    }),
  );
  expect(sessionWorkContractsFrom(state)).toEqual([
    {
      planID: "plan:1",
      version: 1,
      scope: ["packages/a"],
      status: "current",
      acceptedBy: "user",
      acceptedAt: now,
    },
  ]);
});

test("repeated drafts keep the latest one", () => {
  const state = emptySessionWorkContractFactState();
  applySessionWorkContractFact(
    state,
    buildWorkContractDrafted({
      id: "wc:plan:1:1",
      planID: "plan:1",
      planVersion: 1,
      scope: ["packages/a"],
      draftedAt: now,
    }),
  );
  applySessionWorkContractFact(
    state,
    buildWorkContractDrafted({
      id: "wc:plan:1:2",
      planID: "plan:1",
      planVersion: 1,
      scope: ["packages/b"],
      constraints: ["no new dependency"],
      draftedAt: now,
    }),
  );
  expect(sessionWorkContractsFrom(state)).toEqual([
    {
      planID: "plan:1",
      version: 1,
      scope: ["packages/b"],
      constraints: ["no new dependency"],
      status: "draft",
    },
  ]);
});

test("a plan document edit past the draft's version marks it stale; a re-proposed draft clears it", () => {
  const state = emptySessionWorkContractFactState();
  for (const event of contractEvents())
    applySessionWorkContractFact(state, event);
  // The document moved to revision 2; the draft was extracted from revision 1.
  applySessionWorkContractFact(state, {
    type: "plan.doc.updated",
    id: "plan:1:updated:2",
    planID: "plan:1",
    revision: 2,
    updatedAt: now,
  });
  expect(sessionWorkContractsFrom(state)).toEqual([
    {
      planID: "plan:1",
      version: 1,
      scope: ["packages/a"],
      status: "draft",
      stale: true,
    },
  ]);
  // Re-proposing against the new plan version clears the staleness.
  applySessionWorkContractFact(
    state,
    buildWorkContractDrafted({
      id: "wc:plan:1:2",
      planID: "plan:1",
      planVersion: 2,
      scope: ["packages/b"],
      draftedAt: now,
    }),
  );
  expect(sessionWorkContractsFrom(state)).toEqual([
    {
      planID: "plan:1",
      version: 2,
      scope: ["packages/b"],
      status: "draft",
    },
  ]);
});
test("a plan document edit at or below the draft's version does not mark it stale", () => {
  const state = emptySessionWorkContractFactState();
  for (const event of contractEvents())
    applySessionWorkContractFact(state, event);
  // An update that does not move past the extracted revision (a touch or
  // re-mark at the same version) must not invalidate a draft bound to it.
  applySessionWorkContractFact(state, {
    type: "plan.doc.updated",
    id: "plan:1:updated:1",
    planID: "plan:1",
    revision: 1,
    updatedAt: now,
  });
  expect(sessionWorkContractsFrom(state)).toEqual([
    {
      planID: "plan:1",
      version: 1,
      scope: ["packages/a"],
      status: "draft",
    },
  ]);
});

test("a plan document edit never invalidates an accepted contract", () => {
  const state = emptySessionWorkContractFactState();
  applySessionWorkContractFact(
    state,
    buildWorkContractAccepted({
      id: "wc:plan:1:accepted",
      planID: "plan:1",
      planVersion: 1,
      scope: ["packages/a"],
      acceptedAt: now,
    }),
  );
  applySessionWorkContractFact(state, {
    type: "plan.doc.updated",
    id: "plan:1:updated:2",
    planID: "plan:1",
    revision: 2,
    updatedAt: now,
  });
  expect(sessionWorkContractsFrom(state)).toEqual([
    {
      planID: "plan:1",
      version: 1,
      scope: ["packages/a"],
      status: "current",
      acceptedBy: "user",
      acceptedAt: now,
    },
  ]);
});

test("contracts for different plans stay independent", () => {
  const state = emptySessionWorkContractFactState();
  applySessionWorkContractFact(
    state,
    buildWorkContractDrafted({
      id: "wc:plan:1:1",
      planID: "plan:1",
      planVersion: 1,
      scope: ["packages/a"],
      draftedAt: now,
    }),
  );
  applySessionWorkContractFact(
    state,
    buildWorkContractAccepted({
      id: "wc:plan:2:accepted",
      planID: "plan:2",
      planVersion: 7,
      verification: ["bun test"],
      acceptedAt: now,
    }),
  );
  const contracts = sessionWorkContractsFrom(state);
  expect(contracts).toHaveLength(2);
  expect(
    contracts.find((contract) => contract.planID === "plan:1")?.status,
  ).toBe("draft");
  expect(
    contracts.find((contract) => contract.planID === "plan:2")?.status,
  ).toBe("current");
});

test("task-type heuristics classify objectives into kinds (EI §8.8)", () => {
  expect(classifyTaskKind("bump the runtime dependencies")).toBe("dependency");
  expect(classifyTaskKind("rewrite the bash command parser")).toBe("parser");
  expect(classifyTaskKind("add unit tests for the parser")).toBe("parser");
  expect(classifyTaskKind("update the README")).toBe("docs");
  expect(classifyTaskKind("add a typed HTTP client")).toBe("code");
  // The committed scope participates in the classification.
  expect(classifyTaskKind("ship it", ["packages/x/package.json"])).toBe(
    "dependency",
  );
});

test("the minimum-evidence matrix judges completion claims (EI §8.8)", () => {
  // A dependency change with no install/typecheck evidence is not judge-able.
  const depGap = evaluateCompletionCard({
    objective: "bump the runtime dependencies",
    evidenceRefs: [],
  });
  expect(depGap.kind).toBe("dependency");
  expect(depGap.judgeable).toBe(false);
  expect(depGap.missing).toContain("validation:install");

  // The right evidence closes the gaps.
  const depDone = evaluateCompletionCard({
    objective: "bump the runtime dependencies",
    evidenceRefs: [],
    validations: [
      { command: "bun install", result: "passed" },
      { command: "bun run typecheck", result: "passed" },
    ],
  });
  expect(depDone.judgeable).toBe(true);
  expect(depDone.missing).toEqual([]);

  // A failed validation never counts.
  const depFailed = evaluateCompletionCard({
    objective: "bump the runtime dependencies",
    evidenceRefs: [],
    validations: [{ command: "bun install", result: "failed" }],
  });
  expect(depFailed.judgeable).toBe(false);

  // A docs-only change needs no runtime validation.
  const docs = evaluateCompletionCard({
    objective: "update the README",
    evidenceRefs: [],
  });
  expect(docs.kind).toBe("docs");
  expect(docs.judgeable).toBe(true);

  // A parser change needs parser evidence specifically.
  const parser = evaluateCompletionCard({
    objective: "rewrite the bash command parser",
    evidenceRefs: [],
    validations: [
      { command: "bun test packages/framework/runtime", result: "passed" },
    ],
  });
  expect(parser.kind).toBe("parser");
  expect(parser.missing).toContain("validation:parser");
});
