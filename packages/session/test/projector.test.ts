import { expect, test } from "bun:test";
import {
  admitInput,
  appendSessionEvent,
  createSessionRecord,
  modelVisibleEvents,
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
