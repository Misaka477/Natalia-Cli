import { expect, test } from "bun:test";
import type { SessionID } from "@natalia/contracts";
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
  await waitFor(
    async () => (await client.driftFindings!(SESSION)).length > 0,
    { timeoutMs: 10_000 },
  );

  const before = await client.driftFindings!(SESSION);
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

  const afterReopen = await client.driftFindings!(SESSION);
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
  await waitFor(
    async () => (await client.driftFindings!(SESSION)).length > 0,
    { timeoutMs: 10_000 },
  );
  const finding = (await client.driftFindings!(SESSION)).find(
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
