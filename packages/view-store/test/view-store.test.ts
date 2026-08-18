import { expect, test } from "bun:test";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import {
  applyEvent,
  displayText,
  initialState,
  projectEvents,
  reduceState,
  selectPrimaryActivity,
  segmentID,
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

const submitted = (
  id: string,
  body: string,
): Extract<RuntimeEvent, { type: "turn.submitted" }> => ({
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

test("a generated session title updates the active conversation", () => {
  const state = projectEvents([
    {
      type: "session.created",
      sessionID: "ses_1" as SessionID,
      title: "New session",
    },
    {
      type: "session.title.updated",
      sessionID: "ses_1" as SessionID,
      title: "Readable topic",
    },
  ]);
  expect(state.title).toBe("Readable topic");
});

test("a queued turn stays visibly queued without replacing active work", () => {
  const state = projectEvents([
    submitted("t1", "first"),
    { type: "thinking.delta", id: "t1", text: "working" },
    { ...submitted("t2", "next"), delivery: "queue" },
  ]);

  expect(state.messages.find((block) => block.id === "t2:user")?.status).toBe(
    "queued",
  );
  expect(state.activeTurn).toBe("t1");
  expect(selectPrimaryActivity(state)).toMatchObject({
    turnID: "t1",
    kind: "thinking",
  });

  applyEvent(state, { type: "turn.started", id: "t2" });
  expect(
    state.messages.find((block) => block.id === "t2:user")?.status,
  ).toBeUndefined();
  expect(state.activeTurn).toBe("t2");
});

test("cancelling a queued turn clears its queued marker", () => {
  const state = projectEvents([
    { ...submitted("t1", "next"), delivery: "queue" },
    { type: "turn.cancelled", id: "t1", reason: "removed" },
  ]);
  expect(state.messages.find((block) => block.id === "t1:user")?.status).toBe(
    "cancelled",
  );
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

test("activity facts follow a turn and prioritize user input", () => {
  let state = projectEvents([
    submitted("t1", "update the config"),
    { type: "thinking.delta", id: "t1", text: "checking" },
    {
      type: "tool.update",
      id: "t1",
      name: "execute",
      callID: "c1",
      status: "running",
      summary: "npm test",
    },
  ]);

  expect(selectPrimaryActivity(state)).toMatchObject({
    id: "t1:tool:c1",
    kind: "command",
    state: "active",
    label: "execute",
    detail: "npm test",
  });

  state = reduceState(state, {
    type: "approval.request",
    id: "a1",
    title: "Approve command",
    preview: "npm test",
  });
  expect(selectPrimaryActivity(state)).toMatchObject({
    id: "approval:a1",
    kind: "waiting_for_user",
    state: "waiting",
  });

  state = reduceState(state, {
    type: "approval.response",
    id: "a1",
    decision: "once",
  });
  expect(selectPrimaryActivity(state)?.kind).toBe("command");

  state = reduceState(state, {
    type: "tool.update",
    id: "t1",
    name: "execute",
    callID: "c1",
    status: "succeeded",
    summary: "tests passed",
  });
  expect(selectPrimaryActivity(state)?.kind).toBe("thinking");

  state = reduceState(state, {
    type: "turn.finished",
    id: "t1",
    stopReason: "done",
  });
  expect(selectPrimaryActivity(state)).toBeUndefined();
});

test("retry and compaction activities clear after their terminal events", () => {
  let state = projectEvents([
    submitted("t1", "continue"),
    {
      type: "turn.retry",
      id: "t1",
      attempt: 1,
      maxAttempts: 3,
      reason: "rate_limited",
      retryAfterMs: 1000,
    },
    {
      type: "compaction.begin",
      id: "c1",
      trigger: "ratio",
      beforeTokens: 100,
      maxTokens: 120,
      reservedTokens: 10,
      thresholdPercent: 80,
      attempt: 1,
      startedAt: "now",
    } as RuntimeEvent,
  ]);
  expect(selectPrimaryActivity(state)).toMatchObject({
    id: "retry:t1",
    kind: "retrying",
  });

  state = reduceState(state, {
    type: "thinking.delta",
    id: "t1",
    text: "retry recovered",
  });
  expect(state.activities["retry:t1"]).toBeUndefined();

  state = reduceState(state, {
    type: "compaction.end",
    id: "c1",
    trigger: "ratio",
    success: true,
    beforeTokens: 100,
    afterTokens: 50,
    durationMs: 12,
    attempts: 1,
  });
  expect(state.activities["compaction:c1"]).toBeUndefined();

  state = reduceState(state, {
    type: "step.retry.cleared",
    id: "t1",
    operation: "llm_step",
    step: 1,
    attempts: 1,
  });
  expect(state.activities["retry:t1"]).toBeUndefined();
});

test("streamed text is confirmed as markdown completes it, not only at the end", () => {
  // `text` is documented as the confirmed record and `pendingText` as the part
  // not confirmed yet. A consumer renders the first as markdown and the second as
  // provisional, so the boundary has to move while the answer streams.
  const state = projectEvents([
    submitted("t1", "explain"),
    { type: "content.delta", id: "t1", text: "First paragraph.\n\n" },
    { type: "content.delta", id: "t1", text: "second, still unfinished" },
  ]);
  const assistant = state.messages.find((block) => block.role === "assistant");
  expect(assistant?.text).toBe("First paragraph.\n\n");
  expect(assistant?.pendingText).toBe("second, still unfinished");
  // Nothing is duplicated by confirming early.
  expect(displayText(assistant!)).toBe(
    "First paragraph.\n\nsecond, still unfinished",
  );
});

test("cancelling a turn keeps the answer already read and drops only the unfinished tail", () => {
  // Cancelling discards unconfirmed output, which is right — but with nothing
  // confirmed until the turn ended, the unconfirmed part was the entire response,
  // so a user who cancelled a long answer watched all of it disappear from the
  // transcript.
  const state = projectEvents([
    submitted("t1", "long job"),
    { type: "content.delta", id: "t1", text: "Para one.\n\nPara two.\n\n" },
    { type: "content.delta", id: "t1", text: "half a sen" },
    { type: "turn.cancelled", id: "t1", reason: "user cancelled" },
    { type: "turn.finished", id: "t1", stopReason: "cancelled" },
  ]);
  const assistant = state.messages.find((block) => block.role === "assistant");
  expect(assistant?.text).toBe("Para one.\n\nPara two.\n\n");
  // The half sentence is not kept as though the model had said it.
  expect(assistant?.pendingText).toBe("");
  expect(displayText(assistant!)).not.toContain("half a sen");
});

test("closing a segment confirms only what markdown had completed", () => {
  // A segment closes at the boundary already confirmed, so the block left behind
  // holds exactly the confirmed record and the unfinished remainder moves on to
  // the next segment. Cutting the remainder instead would sweep unconfirmed text
  // into a block a consumer is told is safe to keep, and split it mid-word.
  const paragraph = `${"word ".repeat(1180)}\n\n`;
  const unfinished = "x".repeat(200);
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: paragraph },
    { type: "content.delta", id: "t1", text: unfinished },
  ]);
  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant).toHaveLength(2);
  expect(assistant[0]?.text).toBe(paragraph);
  expect(assistant[0]?.pendingText).toBe("");
  expect(assistant[1]?.text).toBe("");
  expect(assistant[1]?.pendingText).toBe(unfinished);
  expect(assistant.map(displayText).join("")).toBe(paragraph + unfinished);
});

test("an announced retry whose resend is attempt-stamped keeps the whole answer", () => {
  // This is the shape the shipped fixture runtime emits, and what a provider is
  // allowed to emit: the retry is announced *and* the resent deltas carry the new
  // attempt number. Two supersede mechanisms then fired at once — the stamp
  // discarded the confirmed text while the overlap skip assumed it was still
  // there — so everything up to the point where the resend diverged was lost and
  // the reader saw the answer start mid-sentence.
  const state = projectEvents([
    submitted("t1", "q"),
    {
      type: "content.delta",
      id: "t1",
      attempt: 1,
      text: "# Retry demo\n\npartial duplicate",
    },
    {
      type: "step.retry",
      id: "t1",
      operation: "llm_step",
      step: 1,
      attempt: 2,
      maxAttempts: 3,
      waitMs: 10,
      reason: "timeout",
    },
    {
      type: "content.delta",
      id: "t1",
      attempt: 2,
      text: "# Retry demo\n\npartial duplicate",
    },
    {
      type: "content.delta",
      id: "t1",
      attempt: 2,
      text: " content committed once.\n",
    },
    { type: "content.done", id: "t1", attempt: 2 },
  ]);
  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant).toHaveLength(1);
  expect(displayText(assistant[0]!)).toBe(
    "# Retry demo\n\npartial duplicate content committed once.\n",
  );
});

test("an attempt stamp still supersedes a retry nobody announced", () => {
  // With no retry event, the stamp is the only signal that this attempt replaces
  // the last one, so it has to keep working.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: "first try", attempt: 1 },
    { type: "content.delta", id: "t1", text: "second try", attempt: 2 },
  ]);
  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant).toHaveLength(1);
  expect(displayText(assistant[0]!)).toBe("second try");
});

test("an announced retry that continues with a stamped delta keeps the earlier text", () => {
  // The provider carries on instead of restarting, and stamps the continuation.
  // Discarding the confirmed text on the stamp would lose the beginning.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", attempt: 1, text: "Hello.\n\n" },
    {
      type: "turn.retry",
      id: "t1",
      attempt: 2,
      maxAttempts: 3,
      reason: "timeout",
      retryAfterMs: 10,
    },
    { type: "content.delta", id: "t1", attempt: 2, text: "World." },
  ]);
  expect(
    displayText(state.messages.find((block) => block.role === "assistant")!),
  ).toBe("Hello.\n\nWorld.");
});

test("alternating reasoning and answering keeps the order the model produced", () => {
  // A model may think, answer, think again and answer again within one turn, with
  // no tool call in between to separate the blocks. Each phase used to keep
  // growing its single block, so the second thought merged into the first and the
  // first answer was rendered *above* the thought that came before the second
  // one — a transcript in an order the model never produced.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "thinking.delta", id: "t1", text: "first thought" },
    { type: "content.delta", id: "t1", text: "first answer" },
    { type: "thinking.delta", id: "t1", text: "second thought" },
    { type: "content.delta", id: "t1", text: "final answer" },
  ]);
  expect(
    state.messages.map((block) => [block.role, displayText(block)]),
  ).toEqual([
    ["user", "q"],
    ["thinking", "first thought"],
    ["assistant", "first answer"],
    ["thinking", "second thought"],
    ["assistant", "final answer"],
  ]);
});

test("a tool event carrying the runtime's own id shape still belongs to its turn", () => {
  // The runtime publishes tool events as `${turnID}:${callID}`, with the call id
  // repeated in `callID`. Read literally, the card was filed under a turn that
  // does not exist: the text above the call was never committed, no new segment
  // opened, so the card sank below text that arrived after it and the text from
  // before and after the call merged into one block. Every real tool call took
  // this path — only fixtures that pass a bare turn id did not.
  const state = projectEvents([
    submitted("t1", "read it"),
    { type: "content.delta", id: "t1", text: "Reading now." },
    {
      type: "tool.update",
      id: "t1:call_1",
      name: "read_file",
      callID: "call_1",
      status: "succeeded",
      summary: "read 42 lines",
      result: "contents",
    },
    { type: "content.delta", id: "t1", text: "It configures the server." },
  ]);
  expect(state.messages.map((block) => block.id)).toEqual([
    "t1:user",
    streamID("t1", "assistant"),
    "t1:tool:call_1",
    segmentID(streamID("t1", "assistant"), 1),
  ]);
  expect(Object.keys(state.tools)).toEqual(["t1:tool:call_1"]);
  expect(text(state, streamID("t1", "assistant"))).toBe("Reading now.");
  expect(text(state, segmentID(streamID("t1", "assistant"), 1))).toBe(
    "It configures the server.",
  );
});

test("a tool event whose id is already the turn id is left alone", () => {
  // Not every producer repeats the call id in the event id, so normalising must
  // only strip a suffix that is actually there.
  const state = projectEvents([
    submitted("t1", "read it"),
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "call_1",
      status: "succeeded",
      summary: "read 42 lines",
    },
  ]);
  expect(Object.keys(state.tools)).toEqual(["t1:tool:call_1"]);
});

test("a settled turn releases its streaming buffers", () => {
  // A stream holds its turn's confirmed text, which the transcript already has.
  // Keeping it after the turn ends leaves a second copy of every response in the
  // projection, two entries per turn, that transcript eviction never reaches.
  const answered = projectEvents([
    submitted("t1", "hi"),
    { type: "thinking.delta", id: "t1", text: "considering" },
    { type: "content.delta", id: "t1", text: "the answer" },
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ]);
  expect(answered.streams).toEqual({});
  expect(answered.streamPhases).toEqual({});
  // The text itself is kept where it belongs.
  expect(text(answered, streamID("t1", "assistant"))).toBe("the answer");

  // A turn still running keeps its buffers, and a second turn does not disturb
  // the first one's release.
  const running = projectEvents([
    submitted("t1", "hi"),
    { type: "content.delta", id: "t1", text: "one" },
    { type: "turn.finished", id: "t1", stopReason: "done" },
    submitted("t2", "again"),
    { type: "content.delta", id: "t2", text: "two" },
  ]);
  expect(Object.keys(running.streams).sort()).toEqual([
    streamID("t2", "assistant"),
    streamID("t2", "thinking"),
  ]);
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

test("provider-hidden reasoning is never retained anywhere in the projection", () => {
  // The consumer guide tells a UI to render `displayText(block)`. If the raw
  // reasoning were stored, following that advice would display exactly what the
  // provider forbade showing — so it must not be stored at all, in the block or
  // the stream.
  const secret = "SECRET-CHAIN-OF-THOUGHT";
  const events: RuntimeEvent[] = [
    submitted("t1", "q"),
    { type: "thinking.delta", id: "t1", text: secret, visible: false },
    {
      type: "thinking.delta",
      id: "t1",
      text: `${secret}-more`,
      visible: false,
    },
    { type: "thinking.done", id: "t1" },
    { type: "content.delta", id: "t1", text: "answer" },
    { type: "content.done", id: "t1", text: "answer" },
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ];
  const state = projectEvents(events);

  expect(JSON.stringify(state)).not.toContain(secret);

  const thinking = state.messages.find((block) => block.role === "thinking");
  // A consumer can still tell that thinking happened, and can hide the row.
  expect(thinking?.reasoningVisible).toBe(false);
  expect(displayText(thinking!)).toContain("hidden by provider policy");

  // Visible content is unaffected.
  expect(state.messages.find((block) => block.role === "assistant")?.text).toBe(
    "answer",
  );
});

test("visible reasoning is still projected in full", () => {
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "thinking.delta", id: "t1", text: "step one, " },
    { type: "thinking.delta", id: "t1", text: "step two" },
  ]);
  const thinking = state.messages.find((block) => block.role === "thinking");
  expect(displayText(thinking!)).toBe("step one, step two");
  expect(thinking?.reasoningVisible).toBe(true);
});

test("a turn that mixes hidden and visible reasoning keeps them apart", () => {
  // Providers can change policy mid-turn. The hidden part must not leak because a
  // later chunk was allowed.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "thinking.delta", id: "t1", text: "HIDDEN-PART", visible: false },
    { type: "thinking.delta", id: "t1", text: "shown part" },
  ]);
  expect(JSON.stringify(state)).not.toContain("HIDDEN-PART");
  // The allowed chunk still renders; it simply replaces the placeholder, because
  // there is no hidden text to interleave it with.
  const thinking = state.messages.find((block) => block.role === "thinking");
  expect(displayText(thinking!)).toBe("shown part");
});

test("a retry that resends everything does not duplicate the response", () => {
  // A retrying provider restarts its stream. Without skipping the overlap the
  // user sees the answer twice.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: "Hello" },
    {
      type: "turn.retry",
      id: "t1",
      attempt: 2,
      maxAttempts: 3,
      reason: "timeout",
      retryAfterMs: 10,
    },
    { type: "content.delta", id: "t1", text: "Hello world" },
    { type: "content.done", id: "t1", text: "Hello world" },
  ]);
  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant).toHaveLength(1);
  expect(displayText(assistant[0]!)).toBe("Hello world");
});

test("a retry that resends in different chunk boundaries still reads once", () => {
  // The resend is not guaranteed to arrive in the same chunks, so the overlap has
  // to be tracked across chunks rather than compared per chunk.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: "Hello" },
    {
      type: "step.retry",
      id: "t1",
      operation: "llm_step",
      step: 1,
      attempt: 2,
      maxAttempts: 3,
      waitMs: 10,
      reason: "timeout",
    },
    { type: "content.delta", id: "t1", text: "Hel" },
    { type: "content.delta", id: "t1", text: "lo wor" },
    { type: "content.delta", id: "t1", text: "ld" },
    { type: "content.done", id: "t1", text: "Hello world" },
  ]);
  expect(
    displayText(state.messages.find((block) => block.role === "assistant")!),
  ).toBe("Hello world");
});

test("a retry keeps confirmed text and continues from it", () => {
  // Dropping confirmed text on retry would lose it whenever the provider carries
  // on from where it stopped instead of starting over.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: "Hello.\n\n" },
    {
      type: "turn.retry",
      id: "t1",
      attempt: 2,
      maxAttempts: 3,
      reason: "timeout",
      retryAfterMs: 10,
    },
    { type: "content.delta", id: "t1", text: "World." },
    { type: "content.done", id: "t1", text: "Hello.\n\nWorld." },
  ]);
  expect(
    displayText(state.messages.find((block) => block.role === "assistant")!),
  ).toBe("Hello.\n\nWorld.");
});

test("a retry does not glue the failed attempt's unfinished fragment onto the answer", () => {
  // The attempt that failed left half a sentence in flight. The retry is a new
  // completion and generally words things differently, so that fragment belongs
  // to nothing: keeping it prefixes the new answer with the tail of the old one.
  // This is why the fragment is dropped while confirmed text is kept — the two
  // halves of a stream mean different things once an attempt has failed.
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: "failed transient tail" },
    {
      type: "step.retry",
      id: "t1",
      operation: "llm_step",
      step: 1,
      attempt: 2,
      maxAttempts: 3,
      waitMs: 10,
      reason: "timeout",
    },
    { type: "content.delta", id: "t1", text: "clean final" },
    { type: "content.done", id: "t1" },
  ]);
  expect(
    displayText(state.messages.find((block) => block.role === "assistant")!),
  ).toBe("clean final");
});

test("a retry also clears unconfirmed text so it cannot be shown twice", () => {
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: "Hello" },
    { type: "content.delta", id: "t1", text: " partial" },
    {
      type: "turn.retry",
      id: "t1",
      attempt: 2,
      maxAttempts: 3,
      reason: "timeout",
      retryAfterMs: 10,
    },
  ]);
  const assistant = state.messages.find((block) => block.role === "assistant");
  // The banner is up and the unconfirmed tail is gone.
  expect(assistant?.pendingText).toBe("");
  expect(state.retryBanner?.kind).toBe("turn_retry");
});

test("a long response does not split a fenced code block across segments", () => {
  // Segmentation triggers exactly on long responses, which is when code blocks
  // appear. Cutting inside a fence leaves both segments with an unpaired fence and
  // a markdown renderer then swallows everything after it.
  const filler = "word ".repeat(1200);
  const body = `${filler}\n\`\`\`ts\nconst a = 1;\n`;
  const rest = "const b = 2;\n```\ndone\n";
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: body },
    { type: "content.delta", id: "t1", text: rest },
  ]);

  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant.length).toBeGreaterThan(1);
  for (const block of assistant) {
    const fences = (displayText(block).match(/```/gu) ?? []).length;
    expect(fences % 2).toBe(0);
  }
  // No text is lost or duplicated by moving the split.
  expect(assistant.map(displayText).join("")).toBe(body + rest);
});

test("a fence still open at the threshold is not split", () => {
  // The dangerous case: the size threshold is crossed while a fenced block has not
  // closed yet. There is no safe boundary inside a fence, and a hard split here
  // would leave one segment with an unpaired fence.
  const open = `\`\`\`ts\n${"const x = 1;\n".repeat(700)}`;
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: open },
  ]);
  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  // Kept whole: a readable block beats an exactly sized one.
  expect(assistant).toHaveLength(1);
  expect(displayText(assistant[0]!)).toBe(open);

  // Once the fence closes, later output can segment normally again.
  const closed = projectEvents(
    [
      { type: "content.delta", id: "t1", text: "```\n" },
      { type: "content.delta", id: "t1", text: "after. ".repeat(1200) },
    ],
    state,
  );
  const blocks = closed.messages.filter((block) => block.role === "assistant");
  expect(blocks.length).toBeGreaterThan(1);
  for (const block of blocks) {
    const fences = (displayText(block).match(/```/gu) ?? []).length;
    expect(fences % 2).toBe(0);
  }
});

test("plain long prose still segments", () => {
  // The bound must still do its job when there is no markdown to protect.
  const prose = "sentence. ".repeat(2000);
  const state = projectEvents([
    submitted("t1", "q"),
    { type: "content.delta", id: "t1", text: prose },
  ]);
  const assistant = state.messages.filter(
    (block) => block.role === "assistant",
  );
  expect(assistant.length).toBeGreaterThan(1);
  expect(assistant.map(displayText).join("")).toBe(prose);
});

test("chat tool calls render in event order with post-tool text below the card", () => {
  const state = initialState();
  applyEvent(state, {
    type: "chat.message.added",
    id: "chat:1",
    messageID: "chat:m1",
    role: "user",
    text: "check the status",
    at: "now",
  });
  applyEvent(state, {
    type: "chat.message.delta",
    id: "chat:2",
    messageID: "chat:m2",
    text: "I will look.",
  });
  applyEvent(state, {
    type: "chat.tool.used",
    id: "chat:m2:tool:1",
    messageID: "chat:m2",
    toolName: "session_snapshot",
    status: "succeeded",
    summary: "snapshot read",
    result: '{"agentStatus":"idle"}',
    argumentsRaw: "{}",
    at: "now",
  });
  applyEvent(state, {
    type: "chat.message.delta",
    id: "chat:3",
    messageID: "chat:m2",
    text: " the main agent is idle.",
  });
  applyEvent(state, {
    type: "chat.message.added",
    id: "chat:4",
    messageID: "chat:m2",
    role: "chat",
    text: "I will look. the main agent is idle.",
    at: "now",
  });
  const blocks = state.chatMessages;
  const order = blocks.map((block) => block.id);
  // user -> pre-tool text -> tool card -> post-tool segment below the card.
  expect(order).toEqual([
    "chat:chat:m1:user",
    "chat:chat:m2:assistant",
    "chat:chat:m2:tool:1:tool",
    "chat:chat:m2:assistant:segment:1",
  ]);
  const tool = blocks.find((block) => block.id === "chat:chat:m2:tool:1:tool");
  expect(tool?.role).toBe("tool");
  expect(tool?.tool?.name).toBe("session_snapshot");
  const post = blocks.find(
    (block) => block.id === "chat:chat:m2:assistant:segment:1",
  );
  expect(displayText(post!)).toBe(" the main agent is idle.");
});

test("chat activity follows its own lifecycle without replacing main activity", () => {
  const state = projectEvents([
    submitted("t1", "main work"),
    { type: "turn.started", id: "t1" },
    {
      type: "chat.turn.started",
      id: "chat:m1:started",
      messageID: "chat:m1",
      startedAt: 100,
    },
    {
      type: "chat.turn.phase",
      id: "chat:m1:thinking",
      messageID: "chat:m1",
      phase: "thinking",
    },
  ]);
  expect(state.chatActivity).toEqual({
    messageID: "chat:m1",
    phase: "thinking",
    startedAt: 100,
    toolName: undefined,
  });
  expect(selectPrimaryActivity(state)?.turnID).toBe("t1");
  applyEvent(state, {
    type: "chat.turn.finished",
    id: "chat:m1:finished",
    messageID: "chat:m1",
    stopReason: "done",
    startedAt: 100,
    endedAt: 200,
  });
  expect(state.chatActivity).toBeUndefined();
});
