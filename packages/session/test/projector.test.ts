import { expect, test } from "bun:test";
import {
  admitInput,
  appendSessionEvent,
  createSessionRecord,
  modelVisibleEvents,
  projectSession,
  selectedAgentFromEvents,
  selectedModelFromEvents,
} from "../src";

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
