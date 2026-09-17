import { expect, test } from "bun:test";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";
import { createScriptedProvider, waitFor } from "./e2e-harness";

const SESSION = "ses_e2e_drift_reopen" as SessionID;

async function attachClient(root: string) {
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: SESSION,
    permissionMode: "auto",
    provider: createScriptedProvider({
      main: [{ text: "standby" }],
      navi: [{ text: "standby" }],
      nia: [{ text: "standby" }],
    }),
  });
  client.start(() => undefined);
  await client.sessionAttach!(SESSION);
  return client;
}

test("Phase 2 E2E: a dismissed drift finding can be reopened by the user and counts reopens", async () => {
  const root = await officialPluginWorkspace("drift-e2e-reopen");
  const client = await attachClient(root);

  // Open an advisory finding: the objective and the current activity share no
  // tokens, so objective_activity_mismatch fires.
  const opened = await client.evaluateDrift!(
    {
      objective: "refactor the parser tokenizer",
      currentActivity: "writing cooking recipes documentation",
    },
    SESSION,
  );
  expect(opened.opened).toBeGreaterThan(0);
  // evaluateDrift publishes the finding synchronously, so it is readable at once.
  const before = await client.driftFindings!({ sessionID: SESSION });
  const finding = before.find((f) => f.status === "open")!;
  expect(finding.reopenedCount).toBe(0);

  // Dismiss it, then reopen it (user-only 翻案).
  const dismissed = await client.acknowledgeDriftFinding!(
    { findingID: finding.findingID, status: "dismissed" },
    SESSION,
  );
  expect(dismissed.acknowledged).toBe(true);

  const reopened = await client.reopenDriftFinding!(
    { findingID: finding.findingID },
    SESSION,
  );
  expect(reopened.reopened).toBe(true);

  const afterReopen = await client.driftFindings!({ sessionID: SESSION });
  const reopenedFinding = afterReopen.find(
    (f) => f.findingID === finding.findingID,
  )!;
  expect(reopenedFinding.status).toBe("open");
  expect(reopenedFinding.reopenedCount).toBe(1);

  // A second reopen is refused: only a dismissed/explained finding reopens,
  // and this one is open again.
  const secondReopen = await client.reopenDriftFinding!(
    { findingID: finding.findingID },
    SESSION,
  );
  expect(secondReopen.reopened).toBe(false);
  expect(secondReopen.reason).toContain("open");

  await client.dispose?.();
}, 30_000);

test("Phase 2 E2E: a corrected drift finding cannot be reopened (its premise is gone)", async () => {
  const root = await officialPluginWorkspace("drift-e2e-reopen-corrected");
  const client = await attachClient(root);

  await client.evaluateDrift!(
    {
      objective: "refactor the parser tokenizer",
      currentActivity: "writing cooking recipes documentation",
    },
    SESSION,
  );
  const finding = (await client.driftFindings!({ sessionID: SESSION })).find(
    (f) => f.status === "open",
  )!;

  // Corrected means the contract was revised to absorb the finding; reopening
  // it is meaningless, so the reopen is refused.
  await client.acknowledgeDriftFinding!(
    { findingID: finding.findingID, status: "corrected" },
    SESSION,
  );
  const reopened = await client.reopenDriftFinding!(
    { findingID: finding.findingID },
    SESSION,
  );
  expect(reopened.reopened).toBe(false);
  expect(reopened.reason).toContain("corrected");

  await client.dispose?.();
}, 30_000);


test("Phase 2 E2E: a warning/high finding is auto-injected into the main agent's next step; advisory is not", async () => {
  const root = await officialPluginWorkspace("drift-e2e-inject");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: SESSION,
    permissionMode: "auto",
    provider: createScriptedProvider({
      main: [{ text: "standby" }],
      navi: [{ text: "standby" }],
      nia: [{ text: "standby" }],
    }),
  });
  client.start((event) => events.push(event));
  await client.sessionAttach!(SESSION);

  // A high finding: the applicable constraint forbids "delete" and the current
  // activity does it — constraint_violation_signal fires at high severity.
  const high = await client.evaluateDrift!(
    {
      objective: "clean up the workspace",
      currentActivity: "delete the old build artifacts",
      applicableConstraints: ["never delete files without approval"],
    },
    SESSION,
  );
  expect(high.opened).toBeGreaterThan(0);
  // Events flow through the async sink, so poll for the finding + injection.
  await waitFor(
    () =>
      events.some(
        (event) =>
          event.type === "drift.finding_opened" && event.severity === "high",
      ) &&
      events.some(
        (event) =>
          event.type === "input.admitted" &&
          event.internal === true &&
          event.delivery === "next-step",
      ),
    { timeoutMs: 10_000 },
  );
  const highFinding = events.find(
    (event): event is Extract<RuntimeEvent, { type: "drift.finding_opened" }> =>
      event.type === "drift.finding_opened" && event.severity === "high",
  );
  expect(highFinding).toBeDefined();

  // The finding is auto-injected as an internal next-step input carrying the
  // findingID + rule summary (no chain-of-thought).
  const injected = events.find(
    (event): event is Extract<RuntimeEvent, { type: "input.admitted" }> =>
      event.type === "input.admitted" &&
      event.internal === true &&
      event.delivery === "next-step" &&
      event.text.includes(highFinding!.findingID),
  );
  expect(injected).toBeDefined();
  expect(injected!.text).toContain("drift_acknowledge");

  // An advisory finding (objective/activity mismatch, no contract) is NOT
  // auto-injected — it is noise-level.
  const beforeAdvisory = events.filter((event) => event.type === "input.admitted").length;
  await client.evaluateDrift!(
    {
      objective: "refactor the parser tokenizer",
      currentActivity: "writing cooking recipes documentation",
    },
    SESSION,
  );
  const advisoryFinding = events.find(
    (event): event is Extract<RuntimeEvent, { type: "drift.finding_opened" }> =>
      event.type === "drift.finding_opened" && event.severity === "advisory",
  );
  expect(advisoryFinding).toBeDefined();
  const afterAdvisory = events.filter((event) => event.type === "input.admitted").length;
  // No new input.admitted for the advisory finding.
  expect(afterAdvisory).toBe(beforeAdvisory);
  expect(
    events.some(
      (event) =>
        event.type === "input.admitted" &&
        event.text.includes(advisoryFinding!.findingID),
    ),
  ).toBe(false);

  await client.dispose?.();
}, 30_000);
