import { expect, test } from "bun:test";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import { projectedWorkContracts } from "@natalia/session";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";
import { createScriptedProvider } from "./e2e-harness";

const SESSION = "ses_e2e_detour" as SessionID;

test("Phase 2 E2E: an approved detour absorbs its deltas into a new accepted contract (v+1)", async () => {
  const root = await officialPluginWorkspace("detour-e2e-approve");
  const events: RuntimeEvent[] = [];
  let planID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: SESSION,
    permissionMode: "ask",
    provider: createScriptedProvider({
      main: [
        {
          tool: () => ({
            name: "plan_propose",
            arguments: {
              planID,
              scope: ["packages/a"],
              verification: ["bun test packages/a"],
            },
          }),
        },
        {
          tool: () => ({
            name: "detour_declare",
            arguments: {
              planID,
              currentVersion: 1,
              reason: "the fix also needs the shared util package",
              scopeDelta: ["packages/b"],
            },
          }),
        },
        { text: "detour declared" },
      ],
      navi: [{ text: "s" }],
      nia: [{ text: "s" }],
    }),
  });
  client.start((event) => {
    events.push(event);
    if (
      event.type === "approval.request" &&
      (event.scope === "work_contract" || event.scope === "detour")
    )
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.sessionAttach!(SESSION);
  await client.planDocWrite!({
    path: "plans/e2e-detour.md",
    content: "# E2E detour\n\n- one concrete step\n",
    title: "E2E detour",
  });
  const marked = await client.planDocMark!({ path: "plans/e2e-detour.md", title: "E2E detour" });
  planID = marked.planID;
  await client.planDocActivate!(planID);
  await client.submitAndWait!("propose the contract then declare a detour");

  const requested = events.find(
    (event): event is Extract<RuntimeEvent, { type: "detour.requested" }> =>
      event.type === "detour.requested",
  )!;
  expect(requested).toMatchObject({
    planID,
    currentVersion: 1,
    reason: "the fix also needs the shared util package",
    scopeDelta: ["packages/b"],
    requestedBy: "model",
  });

  const accepted = projectedWorkContracts(events).find(
    (contract) => contract.planID === planID,
  )!;
  expect(accepted).toMatchObject({
    status: "current",
    version: 2,
    scope: ["packages/a", "packages/b"],
    verification: ["bun test packages/a"],
  });
  await client.dispose?.();
}, 30_000);

test("Phase 2 E2E: a stale detour and an overlapping scopeDelta are rejected before the gate", async () => {
  const root = await officialPluginWorkspace("detour-e2e-reject");
  const events: RuntimeEvent[] = [];
  let planID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: SESSION,
    permissionMode: "ask",
    provider: createScriptedProvider({
      main: [
        {
          // Establish v1 with scope packages/a.
          tool: () => ({
            name: "plan_propose",
            arguments: { planID, scope: ["packages/a"], verification: ["bun test packages/a"] },
          }),
        },
        {
          // Stale currentVersion (contract is v1, declare against v9).
          tool: () => ({
            name: "detour_declare",
            arguments: {
              planID,
              currentVersion: 9,
              reason: "stale lock",
              scopeDelta: ["packages/b"],
            },
          }),
        },
        {
          // Overlapping scopeDelta (packages/a is already committed).
          tool: () => ({
            name: "detour_declare",
            arguments: {
              planID,
              currentVersion: 1,
              reason: "overlap",
              scopeDelta: ["packages/a"],
            },
          }),
        },
        { text: "done" },
      ],
      navi: [{ text: "s" }],
      nia: [{ text: "s" }],
    }),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request" && event.scope === "work_contract")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.sessionAttach!(SESSION);
  await client.planDocWrite!({
    path: "plans/e2e-detour.md",
    content: "# E2E detour\n",
    title: "E2E detour",
  });
  const marked = await client.planDocMark!({ path: "plans/e2e-detour.md", title: "E2E detour" });
  planID = marked.planID;
  await client.planDocActivate!(planID);
  await client.submitAndWait!("propose then attempt invalid detours");

  // The contract is v1; neither a stale lock nor an overlapping scopeDelta
  // reaches the journal or the gate.
  const accepted = events.filter(
    (event) => event.type === "work_contract.accepted",
  );
  expect(accepted).toHaveLength(1);
  expect(accepted[0]).toMatchObject({ planVersion: 1 });
  expect(events.some((event) => event.type === "detour.requested")).toBe(false);
  expect(
    events.some(
      (event) => event.type === "approval.request" && event.scope === "detour",
    ),
  ).toBe(false);
  await client.dispose?.();
}, 30_000);
