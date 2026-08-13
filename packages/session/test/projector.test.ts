import { expect, test } from "bun:test";
import {
  admitInput,
  appendSessionEvent,
  createSessionRecord,
  latestSessionSnapshot,
  modelVisibleEvents,
  projectedCanonicalTools,
  projectedCapabilities,
  projectedDriftFindings,
  projectedConstitutionRules,
  projectedChatMessages,
  projectedDecisionRecords,
  projectedEvidenceRecords,
  projectedMailboxMessages,
  projectedPlans,
  projectedWorkGraphNodes,
  projectedWorkGraphEdges,
  projectSessionMessages,
  projectSession,
  settleInterruptedTurns,
  selectedAgentFromEvents,
  selectedModelFromEvents,
} from "../src";
import { JsonSessionStore } from "../src";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("session projector separates completed, active, and unpromoted durable input", () => {
  const session = createSessionRecord("ses_projector", "Projector");
  admitInput(session, { id: "turn_done", text: "done", delivery: "steer" });
  admitInput(session, { id: "turn_queue", text: "queue", delivery: "queue" });
  appendSessionEvent(session, {
    type: "turn.submitted",
    id: "turn_done",
    text: "done",
    byteLength: 4,
    lineCount: 1,
    sha256: "test",
  });
  appendSessionEvent(session, {
    type: "tool.update",
    id: "turn_interrupted:call_1",
    name: "read_file",
    callID: "call_1",
    status: "succeeded",
    summary: "read",
    result: "orphaned output",
  });
  appendSessionEvent(session, {
    type: "turn.finished",
    id: "turn_done",
    stopReason: "done",
  });
  appendSessionEvent(session, {
    type: "turn.submitted",
    id: "turn_interrupted",
    text: "interrupted",
    byteLength: 11,
    lineCount: 1,
    sha256: "test",
  });

  const projection = projectSession(session);
  expect(projection.completedTurnIDs).toEqual(["turn_done"]);
  expect(projection.activeTurnIDs).toEqual(["turn_interrupted"]);
  expect(projection.pendingInputs.map((input) => input.id)).toEqual([
    "turn_done",
    "turn_queue",
  ]);
  expect(projection.replayableEvents).toHaveLength(2);
  expect(
    projection.replayableEvents.some(
      (event) =>
        event.type === "turn.submitted" && event.id === "turn_interrupted",
    ),
  ).toBe(false);
  expect(
    projection.replayableEvents.some(
      (event) =>
        event.type === "tool.update" && event.id === "turn_interrupted:call_1",
    ),
  ).toBe(false);
});

test("projects the last durable model and variant selection", () => {
  const events = [
    { type: "model.selection", modelID: "alpha", variant: "fast" },
    { type: "model.selection", modelID: "beta", variant: "careful" },
  ] as const;
  expect(selectedModelFromEvents([...events])).toEqual({
    modelID: "beta",
    variant: "careful",
  });
});

test("session projector replays only committed agent selection", () => {
  const events = [
    { type: "agent.selection" as const, name: "first", pending: false },
    { type: "agent.selection" as const, name: "second", pending: true },
    { type: "agent.selection" as const, name: "third", pending: false },
  ];
  expect(selectedAgentFromEvents(events)).toBe("third");
});

test("interrupted turns reject only their unresolved interactive requests", () => {
  const session = createSessionRecord("ses_interrupted", "Interrupted");
  appendSessionEvent(session, {
    type: "turn.submitted",
    id: "turn_crashed",
    text: "write",
    byteLength: 5,
    lineCount: 1,
    sha256: "test",
  });
  appendSessionEvent(session, {
    type: "approval.request",
    id: "turn_crashed:write",
    title: "Write",
    preview: "file",
  });
  appendSessionEvent(session, {
    type: "question.request",
    id: "turn_crashed:write:question",
    title: "Confirm",
  });
  appendSessionEvent(session, {
    type: "approval.request",
    id: "independent_approval",
    title: "Independent",
    preview: "safe",
  });

  expect(settleInterruptedTurns(session)).toEqual([
    {
      type: "approval.response",
      id: "turn_crashed:write",
      decision: "reject",
      feedback: "interrupted turn cannot continue after runtime restart",
    },
    {
      type: "question.response",
      id: "turn_crashed:write:question",
      answers: [],
      rejected: true,
    },
    { type: "turn.finished", id: "turn_crashed", stopReason: "error" },
  ]);
  expect(projectSession(session).activeTurnIDs).toEqual([]);
});

test("model-visible selection starts after the latest durable context epoch", () => {
  const events = [
    {
      type: "turn.submitted" as const,
      id: "old",
      text: "old",
      byteLength: 3,
      lineCount: 1,
      sha256: "x",
    },
    {
      type: "context.checkpoint" as const,
      id: "epoch",
      snapshot: {
        entries: [],
        resources: [],
        journalOffset: 1,
        step: 1,
        tokenEstimate: 1,
        compactionGeneration: 0,
      },
    },
    {
      type: "turn.submitted" as const,
      id: "new",
      text: "new",
      byteLength: 3,
      lineCount: 1,
      sha256: "x",
    },
  ];
  expect(
    modelVisibleEvents(events).map((event) =>
      event.type === "turn.submitted" ? event.id : event.type,
    ),
  ).toEqual(["new"]);
});

test("session fork truncates at a durable submitted-turn boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-fork-"));
  try {
    const store = new JsonSessionStore(root);
    const session = createSessionRecord("ses_parent", "Parent");
    for (const id of ["turn_one", "turn_two"])
      appendSessionEvent(session, {
        type: "turn.submitted",
        id,
        text: id,
        byteLength: id.length,
        lineCount: 1,
        sha256: "test",
      });
    appendSessionEvent(session, {
      type: "content.done",
      id: "turn_one",
      text: "first result",
    });
    await store.save(session);

    const fork = await store.fork("ses_parent", "turn_two", "ses_fork");
    expect(fork.id).toBe("ses_fork");
    expect(fork.title).toBe("Parent (fork)");
    expect(
      fork.events.map((event) =>
        event.type === "turn.submitted" ? event.id : event.type,
      ),
    ).toEqual(["turn_one"]);
    expect(
      fork.events.some((event) => "id" in event && event.id === "turn_two"),
    ).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("projects ordered turn messages without splitting durable rows", () => {
  const session = createSessionRecord("ses_messages", "Messages");
  for (const id of ["turn_one", "turn_two", "turn_three"]) {
    appendSessionEvent(session, {
      type: "turn.submitted",
      id,
      text: id,
      byteLength: id.length,
      lineCount: 1,
      sha256: "test",
    });
    appendSessionEvent(session, {
      type: "content.done",
      id,
      text: `${id} response`,
    });
    appendSessionEvent(session, {
      type: "tool.update",
      id: `${id}:tool:read`,
      name: "read_file",
      status: "succeeded",
      summary: "read",
      result: "content",
    });
    appendSessionEvent(session, {
      type: "turn.finished",
      id,
      stopReason: "done",
    });
  }

  const first = projectSessionMessages(session, { order: "asc", limit: 2 });
  expect(first.data.map((message) => message.id)).toEqual([
    "turn_one",
    "turn_two",
  ]);
  expect(first.data[0]?.rows.map((row) => row.kind)).toEqual([
    "user",
    "assistant",
    "tool",
    "system",
  ]);
  expect(first.data[0]?.stopReason).toBe("done");
  expect(first.cursor.next).toEqual(expect.any(String));

  const next = projectSessionMessages(session, {
    cursor: first.cursor.next,
  });
  expect(next.data.map((message) => message.id)).toEqual(["turn_three"]);
  expect(next.cursor.previous).toEqual(expect.any(String));

  const previous = projectSessionMessages(session, {
    cursor: next.cursor.previous,
    limit: 2,
  });
  expect(previous.data.map((message) => message.id)).toEqual([
    "turn_one",
    "turn_two",
  ]);
});

test("message projection rejects malformed or stale opaque cursors", () => {
  const session = createSessionRecord("ses_message_cursor", "Messages");
  appendSessionEvent(session, {
    type: "turn.submitted",
    id: "turn_one",
    text: "one",
    byteLength: 3,
    lineCount: 1,
    sha256: "test",
  });
  expect(() => projectSessionMessages(session, { cursor: "invalid" })).toThrow(
    "invalid message cursor",
  );
  expect(() =>
    projectSessionMessages(session, {
      cursor: Buffer.from(
        JSON.stringify({
          version: 1,
          order: "asc",
          direction: "next",
          anchor: "missing",
        }),
      ).toString("base64url"),
    }),
  ).toThrow("message cursor anchor is no longer available");
});

test("message projection keeps large histories within a bounded local budget", () => {
  const session = createSessionRecord(
    "ses_large_projection",
    "Large projection",
  );
  for (let index = 0; index < 1_000; index++) {
    const id = `turn_${index}`;
    appendSessionEvent(session, {
      type: "turn.submitted",
      id,
      text: `prompt ${index}`,
      byteLength: 8,
      lineCount: 1,
      sha256: "fixture",
    });
    appendSessionEvent(session, {
      type: "content.done",
      id,
      text: `response ${index}`,
    });
    appendSessionEvent(session, {
      type: "turn.finished",
      id,
      stopReason: "done",
    });
  }
  const start = performance.now();
  const page = projectSessionMessages(session, { limit: 100 });
  expect(page.data).toHaveLength(100);
  expect(performance.now() - start).toBeLessThan(100);
});

test("projectedConstitutionRules collects rules and applies updates", () => {
  const session = createSessionRecord("ses_constitution", "Constitution");
  appendSessionEvent(session, {
    type: "constitution.rule_added",
    id: "evt_1",
    ruleID: "C-001",
    statement: "Never commit without approval",
    scope: "project",
    priority: "critical",
    source: "user",
    enforcement: "approval",
    overridePolicy: "forbidden",
  });
  appendSessionEvent(session, {
    type: "constitution.rule_added",
    id: "evt_2",
    ruleID: "C-002",
    statement: "Use TypeScript only",
    scope: "project",
    priority: "high",
    source: "master_plan",
    enforcement: "deny",
    overridePolicy: "forbidden",
  });
  const rules = projectedConstitutionRules(session.events);
  expect(rules).toHaveLength(2);
  expect(rules[0]?.ruleID).toBe("C-001");
  expect(rules[0]?.priority).toBe("critical");
  expect(rules[1]?.ruleID).toBe("C-002");
});

test("projectedDecisionRecords collects decision records", () => {
  const session = createSessionRecord("ses_decisions", "Decisions");
  appendSessionEvent(session, {
    type: "decision.recorded",
    id: "evt_1",
    decision: "Use TypeScript/Bun runtime only",
    rationale: ["Go fallback was removed", "TypeScript provides better DX"],
    status: "accepted",
    linkedPlans: ["natalia-engineering-intelligence-mainline"],
    linkedConstraints: ["C-002"],
  });
  const records = projectedDecisionRecords(session.events);
  expect(records).toHaveLength(1);
  expect(records[0]?.decision).toContain("TypeScript/Bun");
  expect(records[0]?.status).toBe("accepted");
});

test("projectedMailboxMessages tracks the full mailbox lifecycle", () => {
  const session = createSessionRecord("ses_mailbox", "Mailbox");
  appendSessionEvent(session, {
    type: "mailbox.queued",
    id: "mailbox:1:queued",
    messageID: "mailbox:1",
    source: "user_via_live_chat",
    priority: "high",
    intent: "reprioritize",
    text: "focus on docs",
    safeSummary: "reprioritize to docs",
    deliveryPolicy: "next_safe_boundary",
    createdAt: "t0",
  });
  expect(projectedMailboxMessages(session.events)[0]?.status).toBe("queued");

  appendSessionEvent(session, {
    type: "mailbox.deferred",
    id: "mailbox:1:deferred",
    messageID: "mailbox:1",
    reason: "unsafe boundary",
    deferredAt: "t1",
  });
  expect(projectedMailboxMessages(session.events)[0]?.status).toBe("deferred");
  expect(projectedMailboxMessages(session.events)[0]?.reason).toBe(
    "unsafe boundary",
  );

  appendSessionEvent(session, {
    type: "mailbox.superseded",
    id: "mailbox:1:superseded",
    messageID: "mailbox:1",
    reason: "newer instruction",
    supersededAt: "t2",
  });
  expect(projectedMailboxMessages(session.events)[0]?.status).toBe(
    "superseded",
  );

  // A transition for an unknown message is ignored.
  appendSessionEvent(session, {
    type: "mailbox.acknowledged",
    id: "mailbox:2:ack",
    messageID: "mailbox:2",
    acknowledgedAt: "t3",
  });
  expect(projectedMailboxMessages(session.events)).toHaveLength(1);
});

test("projectedMailboxMessages replays to the same status from replay", () => {
  const session = createSessionRecord("ses_mailbox_replay", "Mailbox");
  appendSessionEvent(session, {
    type: "mailbox.queued",
    id: "mailbox:3:queued",
    messageID: "mailbox:3",
    source: "system",
    priority: "normal",
    intent: "constraint",
    text: "never commit",
    safeSummary: "a constraint",
    deliveryPolicy: "before_next_tool",
    createdAt: "t0",
  });
  appendSessionEvent(session, {
    type: "mailbox.delivered",
    id: "mailbox:3:delivered",
    messageID: "mailbox:3",
    deliveredAt: "t1",
  });
  appendSessionEvent(session, {
    type: "mailbox.acknowledged",
    id: "mailbox:3:ack",
    messageID: "mailbox:3",
    acknowledgedAt: "t2",
  });
  // Replaying the same journal produces the same projected state.
  const projected = projectedMailboxMessages(session.events);
  expect(projected[0]).toMatchObject({
    messageID: "mailbox:3",
    intent: "constraint",
    status: "acknowledged",
  });
});

test("projectedPlans tracks the full plan lifecycle with version bumps", () => {
  const session = createSessionRecord("ses_plans", "Plans");
  appendSessionEvent(session, {
    type: "plan.draft.created",
    id: "plan:1:draft:0",
    planID: "plan:1",
    version: 1,
    title: "Switch to Bun-native HTTP",
    author: "live_chat",
    objective: "replace the fetch wrapper",
    steps: [{ id: "s1", title: "introduce the server" }],
    constraints: ["keep loopback default"],
    createdAt: "t0",
  });
  expect(projectedPlans(session.events)[0]?.status).toBe("draft");

  appendSessionEvent(session, {
    type: "plan.draft.updated",
    id: "plan:1:draft:1",
    planID: "plan:1",
    version: 2,
    updatedAt: "t1",
    reason: "add verification",
  });
  appendSessionEvent(session, {
    type: "plan.proposed",
    id: "plan:1:proposed:3",
    planID: "plan:1",
    version: 3,
    proposedAt: "t2",
  });
  expect(projectedPlans(session.events)[0]?.status).toBe("proposed");

  appendSessionEvent(session, {
    type: "plan.accepted",
    id: "plan:1:accepted:4",
    planID: "plan:1",
    version: 4,
    acceptedBy: "user",
    acceptedAt: "t3",
  });
  appendSessionEvent(session, {
    type: "plan.queued",
    id: "plan:1:queued:5",
    planID: "plan:1",
    version: 5,
    queuedAt: "t4",
  });
  expect(projectedPlans(session.events)[0]?.status).toBe("queued_next_plan");

  appendSessionEvent(session, {
    type: "plan.activated",
    id: "plan:1:activated:6",
    planID: "plan:1",
    version: 6,
    activatedAt: "t5",
  });
  const active = projectedPlans(session.events)[0];
  expect(active?.status).toBe("active");
  expect(active?.version).toBe(6);
  expect(active?.constraints).toEqual(["keep loopback default"]);
  expect(active?.objective).toContain("fetch wrapper");
});

test("projectedPlans ignores transitions for a plan that was never created", () => {
  const session = createSessionRecord("ses_plans_unknown", "Plans");
  appendSessionEvent(session, {
    type: "plan.superseded",
    id: "plan:9:superseded:2",
    planID: "plan:9",
    version: 2,
    reason: "never existed",
    supersededAt: "t0",
  });
  expect(projectedPlans(session.events)).toEqual([]);
});

test("projectedPlans supersedes a plan and keeps the reason", () => {
  const session = createSessionRecord("ses_plans_superseded", "Plans");
  appendSessionEvent(session, {
    type: "plan.draft.created",
    id: "plan:2:draft:0",
    planID: "plan:2",
    version: 1,
    title: "Old plan",
    author: "live_chat",
    objective: "do it the old way",
    steps: [{ id: "s1", title: "first" }],
    createdAt: "t0",
  });
  appendSessionEvent(session, {
    type: "plan.superseded",
    id: "plan:2:superseded:2",
    planID: "plan:2",
    version: 2,
    reason: "a newer plan arrived",
    supersededAt: "t1",
  });
  const projected = projectedPlans(session.events)[0];
  expect(projected?.status).toBe("superseded");
  expect(projected?.reason).toBe("a newer plan arrived");
});

test("projectedEvidenceRecords collects evidence records", () => {
  const session = createSessionRecord("ses_evidence", "Evidence");
  appendSessionEvent(session, {
    type: "evidence.recorded",
    id: "evt_1",
    taskID: "T-001",
    objective: "Add completion evidence schema",
    status: "validated",
    knownGaps: ["Needs full integration test"],
  });
  const records = projectedEvidenceRecords(session.events);
  expect(records).toHaveLength(1);
  expect(records[0]?.taskID).toBe("T-001");
  expect(records[0]?.status).toBe("validated");
});

test("projectedWorkGraphNodes and Edges collect graph nodes", () => {
  const session = createSessionRecord("ses_wg", "WorkGraph");
  appendSessionEvent(session, {
    type: "workgraph.node_added",
    id: "evt_1",
    nodeID: "G-001",
    kind: "goal",
    summary: "Fix empty provider response",
    sessionID: "ses_wg",
  });
  appendSessionEvent(session, {
    type: "workgraph.node_added",
    id: "evt_2",
    nodeID: "A-001",
    kind: "agent_action",
    summary: "edit-parser-fallback",
  });
  appendSessionEvent(session, {
    type: "workgraph.edge_added",
    id: "evt_3",
    sourceID: "A-001",
    targetID: "G-001",
    kind: "requested_by",
  });
  const nodes = projectedWorkGraphNodes(session.events);
  const edges = projectedWorkGraphEdges(session.events);
  expect(nodes).toHaveLength(2);
  expect(edges).toHaveLength(1);
  expect(nodes[0]?.kind).toBe("goal");
  expect(edges[0]?.kind).toBe("requested_by");
});

test("projectedCapabilities tracks loaded/unloaded capabilities", () => {
  const session = createSessionRecord("ses_cap", "Capabilities");
  appendSessionEvent(session, {
    type: "capability.loaded",
    id: "evt_1",
    apiVersion: 1,
    name: "Test Capability",
    version: "1.0.0",
    scope: "session",
    grants: ["tools"],
  });
  const caps = projectedCapabilities(session.events);
  expect(caps).toHaveLength(1);
  expect(caps[0]?.name).toBe("Test Capability");
  expect(caps[0]?.manifest.scope).toBe("session");
  expect(caps[0]?.manifest.apiVersion).toBe(1);
  expect(caps[0]?.manifest.version).toBe("1.0.0");
  expect(caps[0]?.manifest.grants).toEqual(["tools"]);

  appendSessionEvent(session, {
    type: "capability.unloaded",
    id: "evt_1",
    name: "Test Capability",
  });
  expect(projectedCapabilities(session.events)).toEqual([]);
});

test("projectedCapabilities keeps a failed load out of the projection", () => {
  const session = createSessionRecord("ses_cap_failed", "Capabilities");
  appendSessionEvent(session, {
    type: "capability.failed",
    id: "evt_1",
    name: "Broken Capability",
    reason: "dependency missing",
  });
  expect(projectedCapabilities(session.events)).toEqual([]);
});

test("projectedCanonicalTools registers and unregisters tools", () => {
  const session = createSessionRecord("ses_treg", "ToolReg");
  appendSessionEvent(session, {
    type: "tool.registered",
    id: "evt_1",
    name: "read_file",
    owner: "natalia",
    scope: "session",
    recovery: "retry",
    precedence: 0,
    requiresApproval: false,
  });
  const tools = projectedCanonicalTools(session.events);
  expect(tools).toHaveLength(1);
  expect(tools[0]?.name).toBe("read_file");
  expect(tools[0]?.owner).toBe("natalia");
});

test("projectedDriftFindings tracks findings and status updates", () => {
  const session = createSessionRecord("ses_drift", "Drift");
  appendSessionEvent(session, {
    type: "drift.finding_opened",
    id: "evt_1",
    findingID: "DF-001",
    severity: "warning",
    confidence: 0.75,
    originalObjective: "Fix parser",
    currentActivity: "Auth config",
    evidence: ["12 actions without parser files"],
    applicableConstraints: [],
  });
  const opened = projectedDriftFindings(session.events);
  expect(opened).toHaveLength(1);
  expect(opened[0]?.severity).toBe("warning");
  expect(opened[0]?.originalObjective).toBe("Fix parser");
  // A finding starts open, and the status is owned by the projection rather
  // than by the opening event.
  expect(opened[0]?.status).toBe("open");
  expect(opened[0]?.rationale).toBeUndefined();

  appendSessionEvent(session, {
    type: "drift.finding_updated",
    id: "evt_2",
    findingID: "DF-001",
    status: "explained",
    rationale: "Auth config is a prerequisite of the parser fix",
  });
  const explained = projectedDriftFindings(session.events);
  expect(explained).toHaveLength(1);
  expect(explained[0]?.status).toBe("explained");
  expect(explained[0]?.rationale).toBe(
    "Auth config is a prerequisite of the parser fix",
  );
  // The opening facts survive the update.
  expect(explained[0]?.originalObjective).toBe("Fix parser");
  expect(explained[0]?.evidence).toEqual(["12 actions without parser files"]);

  appendSessionEvent(session, {
    type: "drift.finding_updated",
    id: "evt_3",
    findingID: "DF-001",
    status: "corrected",
  });
  const corrected = projectedDriftFindings(session.events);
  expect(corrected[0]?.status).toBe("corrected");
  // The latest update wins, and it does not clear an earlier rationale.
  expect(corrected[0]?.rationale).toBe(
    "Auth config is a prerequisite of the parser fix",
  );
});

test("projectedDriftFindings ignores an update for a finding that was never opened", () => {
  const session = createSessionRecord("ses_drift_orphan", "Drift");
  appendSessionEvent(session, {
    type: "drift.finding_updated",
    id: "evt_1",
    findingID: "DF-404",
    status: "dismissed",
  });
  // An update carries no objective or evidence, so no finding can be
  // reconstructed from it.
  expect(projectedDriftFindings(session.events)).toEqual([]);
});

test("latestSessionSnapshot returns the most recent snapshot", () => {
  const session = createSessionRecord("ses_snap", "Snapshot");
  appendSessionEvent(session, {
    type: "session.snapshot",
    id: "evt_1",
    agentStatus: "running",
    currentStep: "fix parser",
    changedFiles: 3,
    unvalidatedChanges: 1,
    hasPTY: true,
    hasSandbox: false,
  });
  const snap = latestSessionSnapshot(session.events);
  expect(snap?.agentStatus).toBe("running");
  expect(snap?.currentStep).toBe("fix parser");
  expect(snap?.hasPTY).toBe(true);
});

test("the live work chat conversation projects messages and honours rollback boundaries", () => {
  const session = createSessionRecord("ses_chat", "Chat");
  appendSessionEvent(session, {
    type: "chat.message.added",
    id: "chat:1",
    messageID: "chat:m1",
    role: "user",
    text: "what is the agent doing",
    at: "2026-08-14T00:00:00.000Z",
  });
  appendSessionEvent(session, {
    type: "chat.message.added",
    id: "chat:2",
    messageID: "chat:m2",
    role: "chat",
    text: "it is running step 2 of the plan",
    at: "2026-08-14T00:00:01.000Z",
  });
  appendSessionEvent(session, {
    type: "chat.message.added",
    id: "chat:3",
    messageID: "chat:m3",
    role: "user",
    text: "stop and re-plan",
    at: "2026-08-14T00:00:02.000Z",
  });
  const history = projectedChatMessages(session.events);
  expect(history.map((message) => message.messageID)).toEqual([
    "chat:m1",
    "chat:m2",
    "chat:m3",
  ]);
  expect(history[1]).toMatchObject({
    role: "chat",
    text: "it is running step 2 of the plan",
  });

  appendSessionEvent(session, {
    type: "chat.rollback",
    id: "chat:r1",
    toMessageID: "chat:m2",
    removed: 1,
    at: "2026-08-14T00:00:03.000Z",
  });
  const after = projectedChatMessages(session.events);
  expect(after.map((message) => message.messageID)).toEqual([
    "chat:m1",
    "chat:m2",
  ]);
});
