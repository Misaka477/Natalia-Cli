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
 * `@natalia/view-store` and the TUI reducer still project the conversation core
 * independently: the TUI owns its own transcript, streams and tool display, and
 * adopting the shared one changes what a user sees (footer wording, inline
 * narration), so it is a separate slice.
 *
 * Two reducers that are allowed to drift are worse than one, so this test pins
 * the overlap. It compares only what both layers claim to project and
 * deliberately ignores what view-store must never project (dialog and modal
 * state, which are UI-only).
 *
 * Resource facts are no longer projected twice: since E3 step 1 the TUI holds
 * `state.facts`, the view-store projection, and reads terminals, sandboxes,
 * subagents and MCP from it. The resource assertions below therefore changed
 * meaning — they now prove the TUI routes those events into the projection at
 * all, rather than proving two implementations agree. That is weaker, and it is
 * stated here rather than left to look like equivalence.
 *
 * If the transcript comparison fails, the two projections have diverged and the
 * convergence slice has to reconcile them before the TUI can adopt view-store.
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
  /** Resource identities and current status, not their rendered presentation. */
  terminals: Array<{ id: string; status: string }>;
  sandboxes: Array<{ id: string; status: string }>;
  subagents: Array<{ id: string; status: string }>;
  mcp: Array<{ server: string; status: string }>;
  todos: Array<{ content: string; status: string }>;
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
 * The TUI narrates some things inline in the transcript that view-store exposes
 * structurally instead: approval and question prompts, and a per-resource
 * summary line for sandboxes and subagents. Both are correct — narrating a
 * resource is a presentation choice, and view-store deliberately leaves it to
 * the consumer — so those rows are excluded here and the structured slices are
 * compared instead (`terminals`, `sandboxes`, `subagents`, `mcp`, `todos`).
 *
 * System blocks for turn-level facts (cancellation, compaction outcome, retry
 * exhaustion) are *not* excluded: both layers must agree on those.
 */
const inlineInteractiveRoles = new Set(["approval", "question", "subagent"]);
const inlineResourcePrefixes = ["sandbox:", "subagent:", "terminal:"];

function isInlineResourceRow(block: { id: string; role: string }): boolean {
  return (
    inlineInteractiveRoles.has(block.role) ||
    inlineResourcePrefixes.some((prefix) => block.id.startsWith(prefix))
  );
}

function fromView(state: ViewAppState): Comparable {
  return {
    messages: state.messages
      .filter((block) => !isInlineResourceRow(block))
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
    terminals: resourceRows(state.terminals),
    sandboxes: resourceRows(state.sandboxes),
    subagents: resourceRows(state.subagents),
    mcp: Object.values(state.mcp)
      .map((item) => ({ server: item.server, status: item.status }))
      .sort((a, b) => a.server.localeCompare(b.server)),
    todos: state.todos.map((todo) => ({
      content: todo.content,
      status: todo.status,
    })),
  };
}

function resourceRows(
  record: Record<string, { id: string; status: string }>,
): Array<{ id: string; status: string }> {
  return Object.values(record)
    .map((item) => ({ id: item.id, status: item.status }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function fromTui(state: TuiAppState): Comparable {
  return {
    messages: state.messages
      .filter((block) => !isInlineResourceRow(block))
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
    // Resource slices now come from view-store itself (`state.facts`), so these
    // four are no longer two reducers agreeing — they assert the wiring: every
    // resource event the TUI receives is actually routed into the projection.
    // A missed `case` in the TUI reducer turns them red, which is the only way
    // this can now break.
    terminals: resourceRows(state.facts.terminals),
    sandboxes: resourceRows(state.facts.sandboxes),
    subagents: resourceRows(state.facts.subagents),
    mcp: Object.values(state.facts.mcp)
      .map((item) => ({ server: item.server, status: item.status }))
      .sort((a, b) => a.server.localeCompare(b.server)),
    todos: state.todos.map((todo) => ({
      content: todo.content,
      status: todo.status,
    })),
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
    name: "a terminal, a sandbox and a subagent appearing",
    events: [
      submitted("t1", "set things up"),
      {
        type: "terminal.update",
        id: "term_a",
        command: "bash",
        cwd: "/work",
        status: "running",
        attached: true,
        rows: 24,
        cols: 80,
        activity: "running",
        tail: "",
        transcript: "",
        target: { kind: "host", cwd: "/work" },
      },
      {
        type: "sandbox.update",
        id: "box",
        status: "created",
        root: "/work/.natalia/sandboxes/box",
        isolationLevel: "workspace",
        changedFiles: 0,
        runningResources: 0,
        target: {
          kind: "sandbox",
          sandboxID: "box",
          root: "/work/.natalia/sandboxes/box",
          isolationLevel: "workspace",
        },
        resourcePolicy: "sandbox_manifest",
      },
      {
        type: "subagent.update",
        id: "child",
        status: "running",
        attached: false,
        event: "created",
        continuation: 0,
      },
      { type: "mcp.status", server: "docs", status: "connected", tools: 3 },
      { type: "content.delta", id: "t1", text: "ready" },
      { type: "content.done", id: "t1", text: "ready" },
      { type: "turn.finished", id: "t1", stopReason: "done" },
    ],
  },
  {
    name: "a todo list written by the todo tool",
    events: [
      submitted("t1", "plan the work"),
      {
        type: "tool.update",
        id: "t1",
        name: "todowrite",
        callID: "c1",
        status: "succeeded",
        summary: "2 todos",
        argumentsDelta: JSON.stringify({
          todos: [
            { content: "first", status: "completed" },
            { content: "second", status: "in_progress" },
          ],
        }),
      },
      { type: "content.delta", id: "t1", text: "planned" },
      { type: "content.done", id: "t1", text: "planned" },
      { type: "turn.finished", id: "t1", stopReason: "done" },
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
    expect(view.terminals).toEqual(tui.terminals);
    expect(view.sandboxes).toEqual(tui.sandboxes);
    expect(view.subagents).toEqual(tui.subagents);
    expect(view.mcp).toEqual(tui.mcp);
    expect(view.todos).toEqual(tui.todos);
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
