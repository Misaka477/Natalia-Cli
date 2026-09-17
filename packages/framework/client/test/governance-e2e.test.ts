import { expect, test } from "bun:test";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import {
  projectedCompletions,
  projectedDecisionRecords,
  projectedEvidenceRecords,
  projectedWorkContracts,
  projectedWorkGraphEdges,
  projectedWorkGraphNodes,
} from "@natalia/session";
import { createRealRuntimeClient } from "../src";
import { officialPluginWorkspace } from "./plugin-test-helpers";
import {
  createScriptedProvider,
  reduceRuntimeEvents,
  waitFor,
} from "./e2e-harness";

const MAIN_SESSION = "ses_e2e_governance_write" as SessionID;

test("Phase 0 E2E: record tools land journal facts that agree across projections, runtime reads and view-store", async () => {
  const root = await officialPluginWorkspace("governance-e2e-write");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: MAIN_SESSION,
    permissionMode: "auto",
    provider: createScriptedProvider({
      main: [
        {
          tool: {
            name: "record_decision",
            arguments: {
              decision: "append runtime context instead of mutating the system prompt",
              rationale: ["keeps the cacheable prefix stable"],
              alternatives: [
                {
                  option: "rewrite the system prompt per turn",
                  rejectedReason: "breaks prompt-cache prefix stability",
                },
              ],
              consequences: ["a context block is appended per turn"],
            },
          },
        },
        {
          tool: {
            name: "record_validation",
            arguments: {
              taskID: "plan:e2e:s1",
              objective: "the e2e workspace validation runner is wired",
              command: "true",
            },
          },
        },
        {
          tool: {
            name: "record_completion",
            arguments: {
              taskID: "plan:e2e:s1",
              objective: "record a completion card for the zero-window write path",
              changeSummary: "wired record_decision/validation/completion",
              validations: [
                {
                  command: "true",
                  result: "passed",
                  safeSummary: "the validation runner returned success",
                },
              ],
              knownGaps: [],
              rollbackState: "clean",
              changePaths: ["packages/framework/client/src/runtime/record-tools.ts"],
            },
          },
        },
        { text: "governance facts recorded" },
      ],
      nia: [{ text: "audit wake observed" }],
    }),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.sessionAttach!(MAIN_SESSION);
  await client.submitAndWait!("record the governance facts");
  await waitFor(
    () =>
      events.some((event) => event.type === "completion.recorded") &&
      events.some((event) => event.type === "decision.recorded") &&
      events.some((event) => event.type === "evidence.recorded"),
    { timeoutMs: 10_000 },
  );

  // 1. Journal: each production write is one durable fact.
  const decisionEvents = events.filter(
    (event) => event.type === "decision.recorded",
  );
  const evidenceEvents = events.filter(
    (event) => event.type === "evidence.recorded",
  );
  const completionEvents = events.filter(
    (event) => event.type === "completion.recorded",
  );
  expect(decisionEvents).toHaveLength(1);
  expect(evidenceEvents).toHaveLength(1);
  expect(completionEvents).toHaveLength(1);
  expect(decisionEvents[0]).toMatchObject({
    decision: "append runtime context instead of mutating the system prompt",
    rationale: ["keeps the cacheable prefix stable"],
  });
  expect(evidenceEvents[0]).toMatchObject({
    taskID: "plan:e2e:s1",
    status: "validated",
  });
  expect(completionEvents[0]).toMatchObject({
    taskID: "plan:e2e:s1",
  });

  // 2. Projection reaches the same facts from the journal.
  expect(projectedDecisionRecords(events)).toHaveLength(1);
  expect(projectedEvidenceRecords(events)).toHaveLength(1);
  expect(projectedCompletions(events)).toHaveLength(1);

  // 3. Runtime read surfaces answer with the same records (not raw event rows).
  const decisions = await client.decisionRecords!(MAIN_SESSION);
  const evidence = await client.evidenceRecords!({ sessionID: MAIN_SESSION });
  const completions = await client.completions!({ sessionID: MAIN_SESSION });
  expect(decisions).toHaveLength(1);
  expect(decisions[0]).toMatchObject({
    decision: "append runtime context instead of mutating the system prompt",
  });
  expect(decisions[0]!.id).toStartWith("decision:");
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({
    taskID: "plan:e2e:s1",
    status: "validated",
  });
  expect(completions).toHaveLength(1);
  expect(completions[0]).toMatchObject({
    taskID: "plan:e2e:s1",
    changeSummary: "wired record_decision/validation/completion",
  });

  // 4. The host view-store projection (the third-party UI contract) converges
  // on the same records and work-graph facts.
  const state = reduceRuntimeEvents(events);
  expect(state.decisions.map((record) => record.id)).toEqual(
    decisions.map((record) => record.id),
  );
  expect(state.evidence.map((record) => record.taskID)).toEqual(
    evidence.map((record) => record.taskID),
  );
  expect(state.completions.map((record) => record.taskID)).toEqual(
    completions.map((record) => record.taskID),
  );
  const nodes = Object.values(state.workGraphNodes);
  expect(nodes.some((node) => node.kind === "decision")).toBe(true);
  expect(nodes.some((node) => node.kind === "validation")).toBe(true);
  expect(
    Object.values(state.workGraphEdges).some(
      (edge) => edge.kind === "validated_by",
    ),
  ).toBe(true);
  expect(projectedWorkGraphNodes(events).some((node) => node.kind === "decision"))
    .toBe(true);
  expect(
    projectedWorkGraphEdges(events).some(
      (edge) => edge.kind === "validated_by",
    ),
  ).toBe(true);
  await client.dispose?.();
}, 30_000);

test("Phase -1 E2E: Navi plan_propose lands a user accepted WorkContract read by projection and view-store", async () => {
  const root = await officialPluginWorkspace("governance-e2e-contract");
  const events: RuntimeEvent[] = [];
  let planID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_e2e_contract" as SessionID,
    permissionMode: "ask",
    provider: createScriptedProvider({
      navi: [
        {
          tool: (context) => ({
            name: "plan_propose",
            arguments: {
              planID,
              scope: ["packages/framework/client/src/runtime"],
              verification: ["bun test packages/framework/client"],
              constraints: ["no new runtime dependency"],
            },
          }),
        },
        { text: "contract proposed" },
      ],
      main: [{ text: "standby" }],
      nia: [{ text: "standby" }],
    }),
  });
  client.start((event) => {
    events.push(event);
    if (
      event.type === "approval.request" &&
      event.scope === "work_contract"
    )
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.sessionAttach!("ses_e2e_contract" as SessionID);
  await client.planDocWrite!({
    path: "plans/e2e-contract.md",
    content: "# E2E contract\n\n- one concrete step\n",
    title: "E2E contract",
  });
  const marked = await client.planDocMark!({
    path: "plans/e2e-contract.md",
    title: "E2E contract",
  });
  planID = marked.planID;
  await client.planDocActivate!(planID);
  await client.chatSubmit!({ channel: "navi", text: "propose the contract" });
  await waitFor(
    () => events.some((event) => event.type === "work_contract.accepted"),
    { timeoutMs: 10_000 },
  );

  expect(events.filter((event) => event.type === "work_contract.drafted")).toHaveLength(1);
  expect(events.filter((event) => event.type === "work_contract.accepted")).toHaveLength(1);
  const contracts = projectedWorkContracts(events);
  expect(contracts).toHaveLength(1);
  expect(contracts[0]).toMatchObject({
    planID,
    status: "current",
    acceptedBy: "user",
    scope: ["packages/framework/client/src/runtime"],
    verification: ["bun test packages/framework/client"],
    constraints: ["no new runtime dependency"],
  });
  const state = reduceRuntimeEvents(events);
  expect(state.workContracts[planID]).toMatchObject({
    status: "current",
    acceptedBy: "user",
    scope: ["packages/framework/client/src/runtime"],
  });
  await client.dispose?.();
}, 30_000);

test("Phase 0 E2E: Nia audit_report writes evidence visible to projection and runtime reads", async () => {
  const root = await officialPluginWorkspace("governance-e2e-audit");
  const events: RuntimeEvent[] = [];
  let planID = "";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_e2e_audit" as SessionID,
    permissionMode: "auto",
    provider: createScriptedProvider({
      nia: [
        {
          tool: (context) => ({
            name: "audit_report",
            arguments: { planID, verdict: "passed" },
          }),
        },
        { text: "audit submitted" },
      ],
      main: [{ text: "standby" }],
      navi: [{ text: "standby" }],
    }),
  });
  client.start((event) => events.push(event));
  await client.sessionAttach!("ses_e2e_audit" as SessionID);
  await client.planDocWrite!({
    path: "plans/e2e-audit.md",
    content: "# E2E audit\n",
    title: "E2E audit",
  });
  const marked = await client.planDocMark!({
    path: "plans/e2e-audit.md",
    title: "E2E audit",
  });
  planID = marked.planID;
  await client.planDocActivate!(planID);
  await client.chatSubmit!({ channel: "nia", text: "audit the plan" });
  await waitFor(
    () => events.some((event) => event.type === "evidence.recorded"),
    { timeoutMs: 10_000 },
  );

  const projected = projectedEvidenceRecords(events);
  expect(projected).toHaveLength(1);
  expect(projected[0]).toMatchObject({
    taskID: planID,
    status: "validated",
  });
  const evidence = await client.evidenceRecords!({ sessionID: "ses_e2e_audit" });
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({
    taskID: planID,
    status: "validated",
  });
  const state = reduceRuntimeEvents(events);
  expect(state.evidence).toHaveLength(1);
  expect(state.evidence[0]).toMatchObject({ taskID: planID });
  await client.dispose?.();
}, 30_000);

test("decisions are session-scoped unless explicitly promoted to workspace scope", async () => {
  const root = await officialPluginWorkspace("governance-e2e-decision-scope");
  const pluginStoreRoot = join(root, "plugin-store");
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    pluginStoreRoot,
    sessionID: "ses_scope_a" as SessionID,
    permissionMode: "auto",
    provider: createScriptedProvider({
      main: [{ text: "ready a" }],
      navi: [{ text: "standby" }],
      nia: [{ text: "standby" }],
    }),
  });
  first.start(() => undefined);
  await first.sessionAttach!("ses_scope_a" as SessionID);
  await first.recordDecision!({ decision: "session A private choice" });
  const firstSession = await first.decisionRecords!({ scope: "session" });
  expect(firstSession).toContainEqual(
    expect.objectContaining({
      decision: "session A private choice",
      scope: "session",
    }),
  );

  const second = createRealRuntimeClient({
    workspaceRoot: root,
    pluginStoreRoot,
    sessionID: "ses_scope_b" as SessionID,
    permissionMode: "auto",
    provider: createScriptedProvider({
      main: [{ text: "ready b" }],
      navi: [{ text: "standby" }],
      nia: [{ text: "standby" }],
    }),
  });
  second.start(() => undefined);
  await second.sessionAttach!("ses_scope_b" as SessionID);
  // A default session read must not leak session A's decision.
  const secondSession = await second.decisionRecords!({ scope: "session" });
  expect(secondSession).not.toContainEqual(
    expect.objectContaining({ decision: "session A private choice" }),
  );

  // Only an explicit workspace promotion crosses the session boundary.
  await first.recordDecision!({
    decision: "workspace shared choice",
    scope: "workspace",
  });
  const shared = await second.decisionRecords!({ scope: "workspace" });
  expect(shared).toContainEqual(
    expect.objectContaining({
      decision: "workspace shared choice",
      scope: "workspace",
    }),
  );
  // The explicit workspace record does not silently appear in the session
  // default view either.
  const secondSessionAfter = await second.decisionRecords!({ scope: "session" });
  expect(secondSessionAfter).not.toContainEqual(
    expect.objectContaining({ decision: "workspace shared choice" }),
  );
  await first.dispose?.();
  await second.dispose?.();
}, 30_000);


test("Phase -1 E2E: constitution doc rules are read and promoted into journal rules", async () => {
  const root = await officialPluginWorkspace("governance-e2e-constitution");
  const sessionID = "ses_e2e_constitution" as SessionID;
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "constitution.md"),
    [
      "# Project constitution",
      "",
      "## Never force-push",
      "",
      "Force-pushing rewrites shared history.",
      "",
      "<!-- enforcement: deny -->",
      '<!-- appliesTo: { commandPattern: "git push --force" } -->',
      "",
      "## Small pull requests",
      "",
      "Prefer small, reviewable pull requests.",
      "",
      "## Block rm -rf",
      "",
      "<!-- enforcement: deny -->",
    ].join("\n"),
    "utf8",
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    permissionMode: "auto",
    provider: createScriptedProvider({
      main: [{ text: "standby" }],
      navi: [{ text: "standby" }],
      nia: [{ text: "standby" }],
    }),
  });
  client.start(() => undefined);
  await client.sessionAttach!(sessionID);

  // 1. The read surface parses the document into enforcement-tagged rules.
  const docRules = await client.constitutionDocRules!(sessionID);
  const forcePush = docRules.find((rule) => rule.section === "Never force-push");
  expect(forcePush).toMatchObject({
    enforcement: "deny",
    annotated: true,
    appliesTo: { commandPattern: "git push --force" },
  });
  const smallPRs = docRules.find((rule) => rule.section === "Small pull requests");
  expect(smallPRs).toMatchObject({ enforcement: "warn", annotated: false });
  const blockRm = docRules.find((rule) => rule.section === "Block rm -rf");
  expect(blockRm).toMatchObject({ enforcement: "deny", annotated: true });
  expect(blockRm!.appliesTo).toBeUndefined();

  // 2. A deny rule without an appliesTo anchor is refused (unenforceable hard rule).
  const refused = await client.promoteConstitutionDocRule!(
    { id: blockRm!.id },
    sessionID,
  );
  expect(refused.promoted).toBe(false);
  expect(refused.reason).toContain("appliesTo");

  // 3. A deny rule with an anchor promotes into a journal rule (source user).
  const promoted = await client.promoteConstitutionDocRule!(
    { id: forcePush!.id },
    sessionID,
  );
  expect(promoted.promoted).toBe(true);
  expect(promoted.ruleID).toStartWith("P-DOC-");

  // 4. The promoted rule is now a journal constitution rule the runtime reads.
  // (Publishing the rule_added event is synchronous on the session event sink,
  // so the read surface sees it immediately.)
  const rules = await client.constitutionRules!(sessionID);
  const promotedRule = rules.find((rule) => rule.ruleID === promoted.ruleID);
  expect(promotedRule).toMatchObject({
    source: "user",
    enforcement: "deny",
    scope: "project",
    appliesTo: { commandPattern: "git push --force" },
  });
  await client.dispose?.();
}, 30_000);
