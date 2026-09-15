import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  applySessionFactEvent,
  emptySessionFactState,
  projectedCollabMessages,
  projectedConstitutionOverrides,
  projectedConstitutionRules,
  projectedDecisionRecords,
  projectedDriftFindings,
  projectedMailboxMessages,
  projectedNaviChatMessages,
  projectedNiaChatMessages,
  sessionFactActiveTurnIDs,
  sessionFactCollabMessages,
  sessionFactConstitutionOverrides,
  sessionFactConstitutionRules,
  sessionFactDecisionRecords,
  sessionFactDriftFindings,
  sessionFactIntelligenceFacts,
  sessionFactLatestSnapshot,
  sessionFactMailboxMessages,
  sessionFactNaviChatMessages,
  sessionFactNiaChatMessages,
  sessionFactStateFromEvents,
  sessionIntelligenceFactsFromEvents,
} from "../src";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

/**
 * A mixed journal that exercises every fact family, including the cases the
 * reducers must survive: duplicate rule/decision ids, a transition for an
 * unknown mailbox, an orphan drift update, expired vs live overrides, and an
 * out-of-order collab answer (answer before question).
 */
function fixture(): RuntimeEvent[] {
  return [
    {
      type: "turn.submitted",
      id: "turn_1",
      text: "do it",
      byteLength: 5,
      lineCount: 1,
      sha256: "turn-1",
    },
    { type: "turn.finished", id: "turn_1", stopReason: "done" },
    {
      type: "turn.submitted",
      id: "turn_2",
      text: "again",
      byteLength: 5,
      lineCount: 1,
      sha256: "turn-2",
    },
    {
      type: "constitution.rule_added",
      id: "rule:1",
      ruleID: "C-001",
      statement: "Never commit without approval",
      scope: "project",
      priority: "critical",
      source: "user",
      enforcement: "approval",
      overridePolicy: "forbidden",
    },
    // A second add for the same ruleID must not replace the first.
    {
      type: "constitution.rule_added",
      id: "rule:1-dup",
      ruleID: "C-001",
      statement: "duplicate must be ignored",
      scope: "project",
      priority: "low",
      source: "policy",
      enforcement: "warn",
      overridePolicy: "user_explicit",
    },
    {
      type: "constitution.rule_updated",
      id: "rule:1-update",
      ruleID: "C-001",
      priority: "high",
    },
    // Updating a rule that was never added is a no-op.
    {
      type: "constitution.rule_updated",
      id: "rule:404-update",
      ruleID: "C-404",
      priority: "low",
    },
    {
      type: "constitution.override_granted",
      id: "override:live",
      ruleID: "C-001",
      reason: "one-off",
      approvedBy: "user",
      expiresAt: "2999-01-01T00:00:00.000Z",
    },
    {
      type: "constitution.override_granted",
      id: "override:expired",
      ruleID: "C-001",
      reason: "stale",
      approvedBy: "user",
      expiresAt: "2000-01-01T00:00:00.000Z",
    },
    {
      type: "drift.finding_opened",
      id: "drift:1",
      findingID: "DF-001",
      severity: "warning",
      confidence: 0.75,
      originalObjective: "Fix parser",
      currentActivity: "Auth config",
      evidence: ["12 actions without parser files"],
      applicableConstraints: [],
    },
    {
      type: "drift.finding_updated",
      id: "drift:1-update",
      findingID: "DF-001",
      status: "explained",
      rationale: "auth is a prerequisite",
    },
    // An orphan update must not create a finding.
    {
      type: "drift.finding_updated",
      id: "drift:404-update",
      findingID: "DF-404",
      status: "dismissed",
    },
    {
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
    },
    {
      type: "mailbox.delivered",
      id: "mailbox:1:delivered",
      messageID: "mailbox:1",
      deliveredAt: "t1",
    },
    {
      type: "mailbox.acknowledged",
      id: "mailbox:1:acked",
      messageID: "mailbox:1",
      acknowledgedAt: "t2",
    },
    {
      type: "mailbox.queued",
      id: "mailbox:2:queued",
      messageID: "mailbox:2",
      source: "system",
      priority: "normal",
      intent: "constraint",
      text: "never commit",
      safeSummary: "a constraint",
      deliveryPolicy: "before_next_tool",
      createdAt: "t3",
    },
    {
      type: "mailbox.deferred",
      id: "mailbox:2:deferred",
      messageID: "mailbox:2",
      reason: "unsafe boundary",
      deferredAt: "t4",
    },
    {
      type: "mailbox.superseded",
      id: "mailbox:2:superseded",
      messageID: "mailbox:2",
      reason: "newer instruction",
      supersededAt: "t5",
    },
    // A transition for an unknown message must be ignored.
    {
      type: "mailbox.acknowledged",
      id: "mailbox:3:acked",
      messageID: "mailbox:3",
      acknowledgedAt: "t6",
    },
    {
      type: "decision.recorded",
      id: "decision:1",
      decision: "Use TypeScript/Bun only",
      status: "accepted",
    },
    // Duplicate decision id must not be recorded twice.
    {
      type: "decision.recorded",
      id: "decision:1",
      decision: "duplicate",
      status: "proposed",
    },
    {
      type: "decision.recorded",
      id: "decision:2",
      decision: "Keep the shared session window",
      status: "accepted",
    },
    {
      type: "session.snapshot",
      id: "snap:1",
      agentStatus: "running",
      currentStep: "step 1",
      changedFiles: 0,
      unvalidatedChanges: 0,
      hasPTY: false,
      hasSandbox: false,
    },
    {
      type: "session.snapshot",
      id: "snap:2",
      agentStatus: "idle",
      changedFiles: 2,
      unvalidatedChanges: 1,
      hasPTY: true,
      hasSandbox: false,
    },
    // Out-of-order collab: the answer lands before the question it replies to.
    {
      type: "collab.answer",
      id: "answer:1",
      questionID: "question:1",
      from: "live_chat",
      to: "main_agent",
      answer: "yes",
      at: "t7",
    },
    {
      type: "collab.question",
      id: "question:1",
      from: "main_agent",
      to: "live_chat",
      question: "safe?",
      at: "t8",
    },
    {
      type: "collab.message",
      message: {
        id: "suggestion:1",
        threadID: "suggestion:1",
        kind: "suggestion",
        from: "live_chat",
        to: "main_agent",
        text: "use echo",
        priority: "normal",
        expectsReply: true,
        at: "t9",
      },
    },
    {
      type: "collab.message",
      message: {
        id: "response:1",
        threadID: "suggestion:1",
        replyToID: "suggestion:1",
        kind: "response",
        from: "main_agent",
        to: "live_chat",
        text: "adopted",
        decision: "adopted",
        expectsReply: false,
        at: "t10",
      },
    },
    // An unrelated event the fact reducers must ignore.
    {
      type: "tool.update",
      id: "turn_1:call_1",
      name: "read_file",
      callID: "call_1",
      status: "succeeded",
      summary: "read",
    },
  ];
}

test("incremental fact state matches the full projections it is built from", () => {
  const events = fixture();
  const state = sessionFactStateFromEvents(events);

  expect(sessionFactConstitutionRules(state)).toEqual(
    projectedConstitutionRules(events),
  );
  expect(sessionFactConstitutionOverrides(state, NOW)).toEqual(
    projectedConstitutionOverrides(events, NOW),
  );
  expect(sessionFactDriftFindings(state)).toEqual(
    projectedDriftFindings(events),
  );
  expect(sessionFactMailboxMessages(state)).toEqual(
    projectedMailboxMessages(events),
  );
  expect(sessionFactDecisionRecords(state)).toEqual(
    projectedDecisionRecords(events),
  );
  expect(sessionFactCollabMessages(state)).toEqual(
    projectedCollabMessages(events),
  );
  expect(sessionFactActiveTurnIDs(state)).toEqual(["turn_2"]);
  expect(sessionFactLatestSnapshot(state)?.id).toBe("snap:2");
});

test("fact semantics survive the fold: dedup, orphan drops, expiry, updates", () => {
  const state = sessionFactStateFromEvents(fixture());

  const rules = sessionFactConstitutionRules(state);
  expect(rules).toHaveLength(1);
  expect(rules[0]?.statement).toBe("Never commit without approval");
  expect(rules[0]?.priority).toBe("high");
  expect(sessionFactConstitutionOverrides(state, NOW).map((e) => e.id)).toEqual(
    ["override:live"],
  );

  const drift = sessionFactDriftFindings(state);
  expect(drift).toHaveLength(1);
  expect(drift[0]?.status).toBe("explained");
  expect(drift[0]?.originalObjective).toBe("Fix parser");

  const mailbox = sessionFactMailboxMessages(state);
  expect(mailbox).toHaveLength(2);
  expect(mailbox.find((m) => m.messageID === "mailbox:1")?.status).toBe(
    "acknowledged",
  );
  expect(mailbox.find((m) => m.messageID === "mailbox:2")?.status).toBe(
    "superseded",
  );

  expect(sessionFactDecisionRecords(state).map((e) => e.id)).toEqual([
    "decision:1",
    "decision:2",
  ]);
});

test("applying events one at a time equals a one-shot fold", () => {
  const events = fixture();
  const incremental = emptySessionFactState();
  for (const event of events) applySessionFactEvent(incremental, event);
  const oneShot = sessionFactStateFromEvents(events);

  expect(sessionFactConstitutionRules(incremental)).toEqual(
    sessionFactConstitutionRules(oneShot),
  );
  expect(sessionFactConstitutionOverrides(incremental, NOW)).toEqual(
    sessionFactConstitutionOverrides(oneShot, NOW),
  );
  expect(sessionFactDriftFindings(incremental)).toEqual(
    sessionFactDriftFindings(oneShot),
  );
  expect(sessionFactMailboxMessages(incremental)).toEqual(
    sessionFactMailboxMessages(oneShot),
  );
  expect(sessionFactDecisionRecords(incremental)).toEqual(
    sessionFactDecisionRecords(oneShot),
  );
  expect(sessionFactCollabMessages(incremental)).toEqual(
    sessionFactCollabMessages(oneShot),
  );
  expect(sessionFactActiveTurnIDs(incremental)).toEqual(
    sessionFactActiveTurnIDs(oneShot),
  );
  expect(sessionFactLatestSnapshot(incremental)).toEqual(
    sessionFactLatestSnapshot(oneShot),
  );
});

test("out-of-order collab replies still resolve in the incremental state", () => {
  const state = sessionFactStateFromEvents(fixture());
  const collab = sessionFactCollabMessages(state);
  expect(collab.find((m) => m.id === "question:1")?.status).toBe("replied");
  expect(collab.find((m) => m.id === "suggestion:1")?.status).toBe("replied");
  // An answer carries no threadID of its own; it inherits the question's.
  expect(collab.find((m) => m.id === "answer:1")?.threadID).toBe("question:1");
});

test("an old open fact survives unrelated later events", () => {
  const state = sessionFactStateFromEvents(fixture());
  for (let index = 0; index < 500; index += 1)
    applySessionFactEvent(state, {
      type: "tool.update",
      id: `noise:${index}`,
      name: "read_file",
      callID: `call_${index}`,
      status: "succeeded",
      summary: "noise",
    });

  const drift = sessionFactDriftFindings(state);
  expect(drift).toHaveLength(1);
  expect(drift[0]?.findingID).toBe("DF-001");
  const mailbox = sessionFactMailboxMessages(state);
  expect(mailbox).toHaveLength(2);
});

test("intelligence facts fold identically in the state and from events", () => {
  const baseTerminal = { target: { kind: "host", cwd: "/w" } } as const;
  const events: RuntimeEvent[] = [
    {
      type: "workgraph.node_added",
      id: "wg:change:1",
      nodeID: "wg:change:1",
      kind: "workspace_change",
      summary: "write_file changed",
      target: "src/a.ts",
      actor: "write_file",
      sessionID: "ses_1",
    },
    {
      type: "workgraph.node_added",
      id: "wg:action:1",
      nodeID: "wg:action:1",
      kind: "agent_action",
      summary: "turn",
      sessionID: "ses_1",
    },
    {
      type: "evidence.recorded",
      id: "evidence:1",
      taskID: "task_1",
      objective: "objective",
      status: "validated",
      changes: [
        { path: "src/a.ts", changeType: "modified", summary: "fixed" },
        { path: "src/b.ts", changeType: "modified", summary: "fixed" },
      ],
    },
    { type: "content.done", id: "turn_1", text: "first" },
    { type: "content.delta", id: "turn_2", text: "unconfirmed" },
    { type: "content.done", id: "turn_2", text: "final" },
    {
      type: "terminal.timeline",
      id: "term_live",
      actor: "model",
      action: "started",
      status: "executed",
      summary: "started",
      at: "now",
      ...baseTerminal,
    },
    {
      type: "terminal.timeline",
      id: "term_dead",
      actor: "model",
      action: "exit",
      status: "executed",
      summary: "exit",
      at: "now",
      ...baseTerminal,
    },
    {
      type: "sandbox.update",
      id: "sb_1",
      status: "created",
      root: "/w/.natalia/sandboxes/sb_1",
      isolationLevel: "workspace",
      changedFiles: 0,
      runningResources: 0,
      target: {
        kind: "sandbox",
        sandboxID: "sb_1",
        root: "/r",
        isolationLevel: "workspace",
      },
      resourcePolicy: "policy",
    },
    {
      type: "sandbox.update",
      id: "sb_1",
      status: "deleted",
      root: "/w/.natalia/sandboxes/sb_1",
      isolationLevel: "workspace",
      changedFiles: 0,
      runningResources: 0,
      target: {
        kind: "sandbox",
        sandboxID: "sb_1",
        root: "/r",
        isolationLevel: "workspace",
      },
      resourcePolicy: "policy",
    },
  ];

  const state = sessionFactStateFromEvents(events);
  expect(sessionFactIntelligenceFacts(state)).toEqual(
    sessionIntelligenceFactsFromEvents(events),
  );
  expect(sessionFactIntelligenceFacts(state)).toEqual({
    changedFiles: 1,
    validatedChanges: 2,
    unvalidatedChanges: 0,
    latestOutput: "final",
    hasPTY: true,
    hasSandbox: false,
  });
});

test("navi/nia chat streams fold identically in the state and from events", () => {
  const events: RuntimeEvent[] = [
    {
      type: "navi.chat.message.added",
      id: "chat:1",
      messageID: "chat:m1",
      role: "user",
      text: "what is the agent doing",
      at: "t1",
    },
    {
      type: "navi.chat.message.added",
      id: "chat:2",
      messageID: "chat:m2",
      role: "chat",
      text: "it is running",
      at: "t2",
    },
    {
      type: "navi.chat.rollback",
      id: "chat:r1",
      toMessageID: "chat:m1",
      removed: 1,
      at: "t3",
    },
    {
      type: "nia.chat.message.new",
      id: "nia:1",
      messageID: "nia:m1",
      role: "user",
      text: "audit this",
      at: "t4",
    },
    {
      type: "nia.chat.thinking.delta",
      id: "nia:t1",
      messageID: "nia:m1",
      text: "weighing evidence. ",
    },
    // Collab rows render on the channel they belong to.
    {
      type: "collab.chat",
      id: "collab:navi",
      threadID: "collab:navi",
      from: "live_chat",
      to: "main_agent",
      text: "sanity check?",
      round: 1,
      expectsReply: false,
      at: "t5",
    },
    {
      type: "collab.chat",
      id: "collab:nia",
      threadID: "collab:nia",
      from: "nia",
      to: "main_agent",
      text: "audit report",
      round: 1,
      expectsReply: false,
      at: "t6",
    },
    // An unrelated event must not enter either stream.
    {
      type: "tool.update",
      id: "turn_1:call_1",
      name: "read_file",
      callID: "call_1",
      status: "succeeded",
      summary: "read",
    },
  ];

  const state = sessionFactStateFromEvents(events);
  expect(sessionFactNaviChatMessages(state)).toEqual(
    projectedNaviChatMessages(events),
  );
  expect(sessionFactNiaChatMessages(state)).toEqual(
    projectedNiaChatMessages(events),
  );
  // Rollback is honoured inside the collected subset too.
  expect(sessionFactNaviChatMessages(state).map((m) => m.messageID)).toEqual([
    "chat:m1",
    "collab:navi",
  ]);
});
