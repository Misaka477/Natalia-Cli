import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  initialState as tuiInitialState,
  reduceState as tuiReduceState,
  type AppState as TuiAppState,
} from "../src/context/state";
import {
  projectEvents,
  type AppState as ViewAppState,
} from "@natalia/view-store";

/**
 * `@natalia/view-store` and the TUI reducer currently project the same event
 * stream independently: the TUI has not been switched over yet, because that
 * means editing `context/state.tsx`, which is under a standing change
 * restriction.
 *
 * Two reducers that are allowed to drift are worse than one, so this test pins
 * the overlap. It compares only what both layers claim to project — the
 * conversation core — and deliberately ignores what view-store states it does
 * not project (terminals, sandboxes, checkpoints, subagents, banners, todos)
 * and what it must never project (dialog and modal state, which are UI-only).
 *
 * If this test fails, the two projections have diverged and the convergence
 * slice has to reconcile them before the TUI can adopt view-store.
 */

/**
 * Tool rows are compared by role, status and position, not by text: the rendered
 * tool line is presentation and belongs to `@natalia/ui-model`, which the TUI
 * uses and view-store deliberately does not duplicate. view-store carries the
 * structured tool data so any consumer can render it however it likes.
 */
type Comparable = {
  messages: Array<{ role: string; text: string; status?: string }>;
  activeTurn?: string;
  status: string;
  statusSegments: string[];
  pendingApprovalIDs: string[];
  pendingQuestionIDs: string[];
};

/**
 * Both layers split confirmed text from the streaming tail, so compare what a UI
 * would actually show. Tool rows compare as a placeholder because their line is
 * rendered by `@natalia/ui-model`, not by either projection.
 */
function comparableText(block: {
  role: string;
  text: string;
  pendingText?: string;
}): string {
  return block.role === "tool"
    ? "<tool>"
    : block.text + (block.pendingText ?? "");
}

/**
 * The TUI renders approval and question prompts as inline rows in the transcript;
 * view-store reports them structurally in `pendingApprovals`/`pendingQuestions`
 * and lets a consumer decide where to show them. Both are correct, so the rows
 * are excluded here and the identities are compared instead.
 */
const inlineInteractiveRoles = new Set(["approval", "question"]);

function fromView(state: ViewAppState): Comparable {
  return {
    messages: state.messages
      .filter((block) => !inlineInteractiveRoles.has(block.role))
      .map((block) => ({
        role: block.role,
        text: comparableText(block),
        status: block.status,
      })),
    activeTurn: state.activeTurn,
    status: state.status,
    statusSegments: state.statusSegments,
    pendingApprovalIDs: state.pendingApprovals.map((item) => item.id),
    pendingQuestionIDs: state.pendingQuestions.map((item) => item.id),
  };
}

function fromTui(state: TuiAppState): Comparable {
  return {
    messages: state.messages
      .filter((block) => !inlineInteractiveRoles.has(block.role))
      .map((block) => ({
        role: block.role,
        text: comparableText(block),
        status: block.status,
      })),
    activeTurn: state.activeTurn,
    status: state.status,
    statusSegments: state.statusSegments,
    // The TUI keeps interactive requests in one prioritized modal queue, while
    // view-store reports them as two runtime-fact lists. Compare the identities.
    pendingApprovalIDs: state.modal.queue
      .filter((item) => item.kind === "approval")
      .map((item) => item.id),
    pendingQuestionIDs: state.modal.queue
      .filter((item) => item.kind === "question")
      .map((item) => item.id),
  };
}

function tuiProject(events: RuntimeEvent[]): TuiAppState {
  let state = tuiInitialState;
  for (const event of events) state = tuiReduceState(state, event);
  return state;
}

const submitted = (id: string, body: string): RuntimeEvent => ({
  type: "turn.submitted",
  id,
  text: body,
  byteLength: body.length,
  lineCount: 1,
  sha256: "x",
});

const streams: Array<{ name: string; events: RuntimeEvent[] }> = [
  {
    name: "a plain answered turn",
    events: [
      submitted("t1", "explain this"),
      { type: "content.delta", id: "t1", text: "Because " },
      { type: "content.delta", id: "t1", text: "of the cache." },
      { type: "content.done", id: "t1", text: "Because of the cache." },
      { type: "turn.finished", id: "t1", stopReason: "done" },
    ],
  },
  {
    name: "thinking followed by an answer",
    events: [
      submitted("t1", "think first"),
      { type: "thinking.delta", id: "t1", text: "considering" },
      { type: "thinking.done", id: "t1" },
      { type: "content.delta", id: "t1", text: "answer" },
      { type: "content.done", id: "t1", text: "answer" },
      { type: "turn.finished", id: "t1", stopReason: "done" },
    ],
  },
  {
    name: "a tool call between two pieces of model text",
    events: [
      submitted("t1", "read it"),
      { type: "content.delta", id: "t1", text: "Reading now." },
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
      { type: "content.delta", id: "t1", text: "It configures the server." },
      { type: "content.done", id: "t1", text: "It configures the server." },
      { type: "turn.finished", id: "t1", stopReason: "done" },
    ],
  },
  {
    name: "an approval resolved mid-turn",
    events: [
      submitted("t1", "write it"),
      {
        type: "approval.request",
        id: "a1",
        title: "Approve write_file",
        preview: "write config.json",
      },
      { type: "approval.response", id: "a1", decision: "once" },
      { type: "content.delta", id: "t1", text: "written" },
      { type: "content.done", id: "t1", text: "written" },
      { type: "turn.finished", id: "t1", stopReason: "done" },
    ],
  },
  {
    name: "an unstreamed answer delivered only by content.done",
    events: [
      submitted("t1", "hi"),
      { type: "content.done", id: "t1", text: "hello" },
      { type: "turn.finished", id: "t1", stopReason: "done" },
    ],
  },
  {
    name: "a cancelled turn",
    events: [
      submitted("t1", "long job"),
      { type: "content.delta", id: "t1", text: "starting" },
      // The runtime always follows a cancellation with the terminal
      // `turn.finished`, so the stream has to include it to be realistic.
      { type: "turn.cancelled", id: "t1", reason: "user cancelled" },
      { type: "turn.finished", id: "t1", stopReason: "cancelled" },
    ],
  },
  {
    name: "two consecutive turns",
    events: [
      submitted("t1", "first"),
      { type: "content.delta", id: "t1", text: "one" },
      { type: "content.done", id: "t1", text: "one" },
      { type: "turn.finished", id: "t1", stopReason: "done" },
      submitted("t2", "second"),
      { type: "content.delta", id: "t2", text: "two" },
      { type: "content.done", id: "t2", text: "two" },
      { type: "turn.finished", id: "t2", stopReason: "done" },
    ],
  },
];

for (const stream of streams) {
  test(`view-store matches the TUI reducer for ${stream.name}`, () => {
    const view = fromView(projectEvents(stream.events));
    const tui = fromTui(tuiProject(stream.events));
    expect(view.messages).toEqual(tui.messages);
    expect(view.activeTurn).toEqual(tui.activeTurn);
    expect(view.pendingApprovalIDs).toEqual(tui.pendingApprovalIDs);
    expect(view.pendingQuestionIDs).toEqual(tui.pendingQuestionIDs);
  });
}

test("both layers agree on session identity and status segments", () => {
  const events: RuntimeEvent[] = [
    { type: "session.ready", sessionID: "ses_1" },
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
  ];
  const view = fromView(projectEvents(events));
  const tui = fromTui(tuiProject(events));
  expect(view.status).toBe(tui.status);
  expect(view.statusSegments).toEqual(tui.statusSegments);
});
