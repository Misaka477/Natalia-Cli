import { expect, test } from "bun:test";
import { buildPlanDraftCreated, buildPlanTransition } from "../src/plan-ledger";

test("buildPlanDraftCreated carries the plan content and first version", () => {
  const event = buildPlanDraftCreated({
    id: "plan:1:draft:0",
    planID: "plan:1",
    version: 1,
    title: "Switch to Bun-native HTTP",
    author: "live_chat",
    objective: "replace the fetch wrapper with Bun.serve",
    steps: [
      { id: "s1", title: "introduce the server", verification: "typecheck" },
    ],
    constraints: ["keep 127.0.0.1 default"],
    verification: ["typecheck", "unit tests"],
    riskNotes: ["port conflicts"],
    relatedMailboxMessageID: "mailbox:1",
    supersedesPlanID: "plan:0",
    createdAt: "now",
  });
  expect(event).toMatchObject({
    type: "plan.draft.created",
    planID: "plan:1",
    version: 1,
    title: "Switch to Bun-native HTTP",
    author: "live_chat",
    objective: "replace the fetch wrapper with Bun.serve",
    steps: [{ id: "s1", title: "introduce the server" }],
    constraints: ["keep 127.0.0.1 default"],
    relatedMailboxMessageID: "mailbox:1",
    supersedesPlanID: "plan:0",
  });
});

test("plan lifecycle transitions build the right event types and bump versions", () => {
  const proposed = buildPlanTransition({
    id: "plan:1:proposed:2",
    planID: "plan:1",
    version: 2,
    transition: "proposed",
    at: "t1",
  });
  expect(proposed.type).toBe("plan.proposed");
  if (proposed.type === "plan.proposed") expect(proposed.proposedAt).toBe("t1");

  const accepted = buildPlanTransition({
    id: "plan:1:accepted:3",
    planID: "plan:1",
    version: 3,
    transition: "accepted",
    at: "t2",
  });
  expect(accepted.type).toBe("plan.accepted");
  if (accepted.type === "plan.accepted")
    expect(accepted.acceptedBy).toBe("user");

  const queued = buildPlanTransition({
    id: "plan:1:queued:4",
    planID: "plan:1",
    version: 4,
    transition: "queued",
    at: "t3",
  });
  expect(queued.type).toBe("plan.queued");

  const activated = buildPlanTransition({
    id: "plan:1:activated:5",
    planID: "plan:1",
    version: 5,
    transition: "activated",
    at: "t4",
  });
  expect(activated.type).toBe("plan.activated");

  const superseded = buildPlanTransition({
    id: "plan:1:superseded:6",
    planID: "plan:1",
    version: 6,
    transition: "superseded",
    at: "t5",
    reason: "a newer plan arrived",
  });
  expect(superseded.type).toBe("plan.superseded");
  if (superseded.type === "plan.superseded")
    expect(superseded.reason).toBe("a newer plan arrived");
});

test("plan facts carry only safe prose, never raw state", () => {
  const draft = buildPlanDraftCreated({
    id: "plan:2:draft:0",
    planID: "plan:2",
    version: 1,
    title: "A safe plan",
    author: "live_chat",
    objective: "do the work",
    steps: [{ id: "s1", title: "first" }],
    createdAt: "now",
  });
  expect(JSON.stringify(draft)).not.toContain("supersecret");
  expect(JSON.stringify(draft)).not.toContain("stdout");
});
