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

test("a plan document edit marks the draft stale; a re-proposed draft clears it", () => {
  const state = emptySessionWorkContractFactState();
  for (const event of contractEvents())
    applySessionWorkContractFact(state, event);
  applySessionWorkContractFact(state, {
    type: "plan.doc.updated",
    id: "plan:1:updated",
    planID: "plan:1",
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
    id: "plan:1:updated",
    planID: "plan:1",
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
