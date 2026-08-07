import { expect, test } from "bun:test";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import {
  applyEvent,
  displayText,
  initialState,
  projectEvents,
  reduceState,
  streamID,
  toolStateID,
  type AppState,
} from "../src";

// The whole point of this layer is that it projects an event stream with no
// runtime, no framework and no I/O. If any test here needed a client, the
// layer would not be consumable by an external UI.

/** What a UI would show: confirmed text plus the streaming tail. */
function text(state: AppState, id: string) {
  const block = state.messages.find((item) => item.id === id);
  return block ? displayText(block) : undefined;
}

function roles(state: AppState) {
  return state.messages.map((block) => block.role);
}

const submitted = (id: string, body: string): RuntimeEvent => ({
  type: "turn.submitted",
  id,
  text: body,
  byteLength: body.length,
  lineCount: 1,
  sha256: "x",
});

test("a whole turn projects to user text, assistant text and a stop reason", () => {
  const events: RuntimeEvent[] = [
    { type: "session.created", sessionID: "ses_1" as SessionID, title: "Work" },
    { type: "session.ready", sessionID: "ses_1" as SessionID },
    submitted("t1", "explain this"),
    { type: "content.delta", id: "t1", text: "Because " },
    { type: "content.delta", id: "t1", text: "of the cache." },
    { type: "content.done", id: "t1", text: "Because of the cache." },
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ];
  const state = projectEvents(events);

  expect(state.sessionID).toBe("ses_1");
  expect(state.title).toBe("Work");
  expect(state.status).toBe("ready");
  expect(text(state, "t1:user")).toBe("explain this");
  expect(text(state, streamID("t1", "assistant"))).toBe(
    "Because of the cache.",
  );
  expect(roles(state)).toEqual(["user", "assistant"]);
  expect(state.activeTurn).toBeUndefined();
  expect(state.lastStopReason).toBe("done");
});

test("content.done does not duplicate a response that already streamed", () => {
  const streamed = projectEvents([
    submitted("t1", "hi"),
    { type: "content.delta", id: "t1", text: "hello" },
    { type: "content.done", id: "t1", text: "hello" },
  ]);
  expect(streamed.messages.filter((b) => b.role === "assistant")).toHaveLength(
    1,
  );

  // A provider that never streams still has to produce a visible block.
  const unstreamed = projectEvents([
    submitted("t2", "hi"),
    { type: "content.done", id: "t2", text: "hello" },
  ]);
  expect(text(unstreamed, streamID("t2", "assistant"))).toBe("hello");
});

test("a retried attempt replaces the superseded text instead of appending", () => {
  const state = projectEvents([
    submitted("t1", "hi"),
    { type: "content.delta", id: "t1", text: "first try", attempt: 1 },
    { type: "content.delta", id: "t1", text: "second try", attempt: 2 },
    { type: "content.done", id: "t1", text: "second try" },
  ]);
  const assistant = state.messages.filter((b) => b.role === "assistant");
  expect(assistant).toHaveLength(1);
  expect(displayText(assistant[0]!)).toBe("second try");
});

test("thinking and assistant phases do not interleave", () => {
  const state = projectEvents([
    submitted("t1", "hi"),
    { type: "thinking.delta", id: "t1", text: "considering" },
    { type: "content.delta", id: "t1", text: "answer" },
  ]);
  expect(roles(state)).toEqual(["user", "thinking", "assistant"]);
  expect(text(state, streamID("t1", "thinking"))).toBe("considering");
  expect(text(state, streamID("t1", "assistant"))).toBe("answer");
});

test("hidden reasoning is marked so a consumer can refuse to render it", () => {
  const state = projectEvents([
    submitted("t1", "hi"),
    { type: "thinking.delta", id: "t1", text: "private", visible: false },
  ]);
  expect(
    state.messages.find((b) => b.role === "thinking")?.reasoningVisible,
  ).toBe(false);
});

test("model text after a tool call renders below the tool card", () => {
  const state = projectEvents([
    submitted("t1", "read it"),
    { type: "content.delta", id: "t1", text: "Reading now." },
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "running",
      summary: "read_file src/index.ts",
    },
    { type: "content.delta", id: "t1", text: "It configures the server." },
  ]);
  expect(roles(state)).toEqual(["user", "assistant", "tool", "assistant"]);
  expect(displayText(state.messages.at(-1)!)).toBe("It configures the server.");
});

test("a tool card is updated in place across its lifecycle", () => {
  const events: RuntimeEvent[] = [
    submitted("t1", "read it"),
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "running",
      summary: "read_file src/index.ts",
      startedAt: 10,
    },
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "succeeded",
      summary: "read 42 lines",
      result: "contents",
      endedAt: 20,
    },
  ];
  const state = projectEvents(events);
  expect(state.messages.filter((b) => b.role === "tool")).toHaveLength(1);
  const stateID = toolStateID({ id: "t1", name: "read_file", callID: "c1" });
  expect(state.tools[stateID]).toMatchObject({
    status: "succeeded",
    summary: "read 42 lines",
    result: "contents",
    // The start time from the earlier event must survive the update.
    startedAt: 10,
    endedAt: 20,
  });
  expect(state.messages.find((b) => b.id === stateID)?.status).toBe(
    "succeeded",
  );
});

test("two calls to the same tool are separate cards", () => {
  const state = projectEvents([
    submitted("t1", "read both"),
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "succeeded",
      summary: "a",
    },
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c2",
      status: "succeeded",
      summary: "b",
    },
  ]);
  expect(state.messages.filter((b) => b.role === "tool")).toHaveLength(2);
});

test("pending approvals and questions appear and clear on response", () => {
  let state = projectEvents([
    submitted("t1", "write it"),
    {
      type: "approval.request",
      id: "a1",
      title: "Approve write_file",
      preview: "write config.json",
    },
    { type: "question.request", id: "q1", title: "Which target?" },
  ]);
  expect(state.pendingApprovals.map((item) => item.id)).toEqual(["a1"]);
  expect(state.pendingQuestions.map((item) => item.id)).toEqual(["q1"]);

  state = reduceState(state, {
    type: "approval.response",
    id: "a1",
    decision: "once",
  });
  state = reduceState(state, {
    type: "question.response",
    id: "q1",
    answers: [["staging"]],
  });
  expect(state.pendingApprovals).toEqual([]);
  expect(state.pendingQuestions).toEqual([]);
});

test("a cancelled or failed turn leaves no request nobody will answer", () => {
  const pending: RuntimeEvent[] = [
    submitted("t1", "write it"),
    {
      type: "approval.request",
      id: "a1",
      title: "Approve write_file",
      preview: "write config.json",
    },
  ];
  const cancelled = projectEvents([
    ...pending,
    { type: "turn.cancelled", id: "t1", reason: "user cancelled" },
  ]);
  expect(cancelled.pendingApprovals).toEqual([]);
  expect(cancelled.lastStopReason).toBe("cancelled");

  const failed = projectEvents([
    ...pending,
    { type: "turn.finished", id: "t1", stopReason: "error" },
  ]);
  expect(failed.pendingApprovals).toEqual([]);

  // A normal completion is the case where an approval could still be live, so
  // clearing must be tied to the abnormal stop reasons only.
  const done = projectEvents([
    ...pending,
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ]);
  expect(done.pendingApprovals.map((item) => item.id)).toEqual(["a1"]);
});

test("reduceState does not mutate the state it was given", () => {
  const before = projectEvents([submitted("t1", "hi")]);
  const snapshot = JSON.stringify(before);
  const after = reduceState(before, {
    type: "content.delta",
    id: "t1",
    text: "hello",
  });
  expect(JSON.stringify(before)).toBe(snapshot);
  expect(after).not.toBe(before);
  expect(after.messages).not.toBe(before.messages);
});

test("reduceState survives a state held behind a proxy", () => {
  // Cloning a reactive proxy with structuredClone is what broke the first
  // attempt at this layer, so the copy must not depend on it.
  const plain = projectEvents([submitted("t1", "hi")]);
  const proxied = new Proxy(plain, {
    get: (target, key) => target[key as keyof AppState],
  });
  const next = reduceState(proxied, {
    type: "content.delta",
    id: "t1",
    text: "hello",
  });
  expect(text(next, streamID("t1", "assistant"))).toBe("hello");
});

test("an unknown event is ignored rather than fatal", () => {
  const state = initialState();
  expect(() =>
    applyEvent(state, { type: "not.a.real.event" } as unknown as RuntimeEvent),
  ).not.toThrow();
  expect(state).toEqual(initialState());
});

test("status snapshot and diagnostics project to the status surfaces", () => {
  const events: RuntimeEvent[] = [
    {
      type: "status.snapshot",
      model: "m",
      provider: "p",
      context: "1/2",
      step: "3",
      permissions: "auto",
      cwd: "/work",
      background: "0",
    },
    { type: "diagnostic", level: "warning", message: "slow provider" },
  ];
  const state = projectEvents(events);
  expect(state.statusSegments).toEqual([
    "mode:runtime",
    "model:m",
    "provider:p",
    "ctx:1/2",
    "step:3",
    "auto",
    "bg:0",
  ]);
  expect(state.footer).toBe("warning: slow provider");
});

test("a long response segments instead of growing one unbounded block", () => {
  const chunk = "x".repeat(2500);
  const state = projectEvents([
    submitted("t1", "long"),
    { type: "content.delta", id: "t1", text: chunk },
    { type: "content.delta", id: "t1", text: chunk },
    { type: "content.delta", id: "t1", text: chunk },
    { type: "content.delta", id: "t1", text: chunk },
  ]);
  const assistant = state.messages.filter((b) => b.role === "assistant");
  expect(assistant.length).toBeGreaterThan(1);
  // No text is lost across the segment boundary.
  expect(assistant.map(displayText).join("")).toBe(chunk.repeat(4));
});
