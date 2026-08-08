import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import { projectEvents } from "@natalia/view-store";
import {
  initialState as tuiInitialState,
  reduceState as tuiReduceState,
  type AppState as TuiAppState,
} from "../src/context/state";
import {
  messageBlocksFromProjection,
  toolBlockFromProjection,
} from "../src/context/view-store-adapter";

/**
 * The last unknown before the TUI can adopt `@natalia/view-store`: can the TUI's
 * richer display shape be derived from what view-store projects?
 *
 * `view-store` carries runtime facts (name, status, raw arguments, metadata,
 * timings) and leaves presentation to `@natalia/ui-model`. The TUI renders a
 * classified kind, an elapsed label, redacted arguments and a collapsed result.
 * If the adapter reproduces those from the projection, the reducer swap is
 * mechanical. If it cannot, the swap would silently change what users see.
 *
 * These tests compare the adapter's output against the TUI reducer's own, so the
 * answer is measured rather than assumed.
 */

const submitted = (id: string, body: string): RuntimeEvent => ({
  type: "turn.submitted",
  id,
  text: body,
  byteLength: body.length,
  lineCount: 1,
  sha256: "x",
});

function tuiProject(events: RuntimeEvent[]): TuiAppState {
  let state = tuiInitialState;
  for (const event of events) state = tuiReduceState(state, event);
  return state;
}

/** Fields that are pure functions of projected facts, so they must agree. */
function comparableTool(tool: {
  name: string;
  kind: string;
  status: string;
  summary: string;
  argumentsRaw: string;
  argumentsComplete: boolean;
  keyArguments: string[];
  redactedArguments?: string;
  detailAvailable: boolean;
  result?: { text?: string; detail?: string };
}) {
  return {
    name: tool.name,
    kind: tool.kind,
    status: tool.status,
    summary: tool.summary,
    argumentsRaw: tool.argumentsRaw,
    argumentsComplete: tool.argumentsComplete,
    keyArguments: tool.keyArguments,
    redactedArguments: tool.redactedArguments,
    detailAvailable: tool.detailAvailable,
    resultText: tool.result?.text,
    resultDetail: tool.result?.detail,
  };
}

const toolStreams: Array<{ name: string; events: RuntimeEvent[] }> = [
  {
    name: "a file read that succeeds",
    events: [
      submitted("t1", "read it"),
      {
        type: "tool.update",
        id: "t1",
        name: "read_file",
        callID: "c1",
        status: "running",
        summary: "read_file src/index.ts",
        argumentsDelta: JSON.stringify({ path: "src/index.ts" }),
        startedAt: 1_000,
      },
      {
        type: "tool.update",
        id: "t1",
        name: "read_file",
        callID: "c1",
        status: "succeeded",
        summary: "read 42 lines",
        result: "line one\nline two\nline three",
        endedAt: 2_500,
      },
    ],
  },
  {
    name: "a shell command that fails with long output",
    events: [
      submitted("t1", "build"),
      {
        type: "tool.update",
        id: "t1",
        name: "run_shell",
        callID: "c1",
        status: "running",
        summary: "npm run build",
        argumentsDelta: JSON.stringify({ command: "npm run build" }),
        startedAt: 1_000,
      },
      {
        type: "tool.update",
        id: "t1",
        name: "run_shell",
        callID: "c1",
        status: "failed",
        summary: "exit 1",
        result: Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n"),
        endedAt: 5_000,
      },
    ],
  },
  {
    name: "a tool whose arguments arrive in fragments",
    events: [
      submitted("t1", "write"),
      {
        type: "tool.update",
        id: "t1",
        name: "write_file",
        callID: "c1",
        status: "running",
        summary: "write_file",
        argumentsDelta: '{"path":"a.txt","con',
      },
      {
        type: "tool.update",
        id: "t1",
        name: "write_file",
        callID: "c1",
        status: "succeeded",
        summary: "wrote a.txt",
        argumentsDelta: 'tent":"hello"}',
        result: "ok",
      },
    ],
  },
  {
    name: "a tool carrying a secret in its arguments",
    events: [
      submitted("t1", "call it"),
      {
        type: "tool.update",
        id: "t1",
        name: "web_fetch",
        callID: "c1",
        status: "succeeded",
        summary: "fetched",
        argumentsDelta: JSON.stringify({
          url: "https://example.com",
          api_key: "super-secret-value",
        }),
        result: "body",
      },
    ],
  },
  {
    name: "a todo write",
    events: [
      submitted("t1", "plan"),
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
            { content: "second", status: "pending" },
          ],
        }),
      },
    ],
  },
];

for (const stream of toolStreams) {
  test(`the adapter reproduces the TUI tool block for ${stream.name}`, () => {
    const projected = projectEvents(stream.events);
    const tui = tuiProject(stream.events);

    const adapted = messageBlocksFromProjection(projected)
      .filter((block) => block.tool)
      .map((block) => comparableTool(block.tool!));
    const expected = tui.messages
      .filter((block) => block.tool)
      .map((block) => comparableTool(block.tool!));

    expect(adapted).toEqual(expected);
    expect(adapted.length).toBeGreaterThan(0);
  });
}

test("a redacted secret never reaches the adapted arguments", () => {
  // The adapter must not become a way around redaction on the way to the screen.
  const events = toolStreams.find((stream) =>
    stream.name.includes("secret"),
  )!.events;
  const adapted = messageBlocksFromProjection(projectEvents(events)).find(
    (block) => block.tool,
  );
  expect(adapted?.tool?.redactedArguments).toBeDefined();
  expect(adapted?.tool?.redactedArguments).not.toContain("super-secret-value");
  expect(adapted?.tool?.keyArguments.join(" ")).not.toContain(
    "super-secret-value",
  );
});

test("the adapted elapsed label survives a completion event that omits startedAt", () => {
  // The runtime publishes `startedAt` on the first update and only `endedAt` on
  // the last, so a projection that keeps the start time can label the duration
  // while a per-event read cannot. This is the one place the adapter is better
  // than what it replaces, and it is stated rather than hidden.
  const events: RuntimeEvent[] = [
    submitted("t1", "read it"),
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "running",
      summary: "reading",
      startedAt: 1_000,
    },
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "succeeded",
      summary: "done",
      endedAt: 2_500,
    },
  ];
  const projected = projectEvents(events);
  const tool = Object.values(projected.tools)[0]!;
  expect(toolBlockFromProjection("x", tool).elapsed).toBe("1.5s");

  const tui = tuiProject(events);
  const tuiTool = tui.messages.find((block) => block.tool)?.tool;
  expect(tuiTool?.elapsed).toBe("");
});

/**
 * A known divergence, found here.
 *
 * `thinking.done` should mark the thinking block completed. The TUI marks the
 * stream's *current segment*, so when a tool call follows the thinking block the
 * segment index has moved on and the mark lands nowhere — the block ends with no
 * status. view-store marks it when thinking finishes, which is stable.
 *
 * view-store is the more correct of the two, so this is not copied backwards. The
 * divergence is pinned in both directions: it fails if view-store regresses, and
 * it fails once the TUI is fixed, which is the signal to delete this test.
 */
test("known divergence: the TUI loses the thinking status when a tool follows", () => {
  const events: RuntimeEvent[] = [
    submitted("t1", "explain"),
    { type: "thinking.delta", id: "t1", text: "considering" },
    { type: "thinking.done", id: "t1" },
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "succeeded",
      summary: "read 3 lines",
      result: "ok",
    },
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ];
  const adapted = messageBlocksFromProjection(projectEvents(events)).find(
    (block) => block.role === "thinking",
  );
  const tui = tuiProject(events).messages.find(
    (block) => block.role === "thinking",
  );
  expect(adapted?.status).toBe("completed");
  expect(tui?.status).toBeUndefined();
});

test("the adapted transcript matches the TUI's on roles, text and status", () => {
  const events: RuntimeEvent[] = [
    submitted("t1", "explain"),
    { type: "thinking.delta", id: "t1", text: "considering" },
    { type: "thinking.done", id: "t1" },
    { type: "content.delta", id: "t1", text: "Because " },
    {
      type: "tool.update",
      id: "t1",
      name: "read_file",
      callID: "c1",
      status: "succeeded",
      summary: "read 3 lines",
      result: "ok",
    },
    { type: "content.delta", id: "t1", text: "of the cache." },
    { type: "content.done", id: "t1", text: "of the cache." },
    { type: "turn.finished", id: "t1", stopReason: "done" },
  ];
  // Thinking status is excluded: it is the divergence pinned by the test above,
  // where view-store is the more correct of the two.
  const comparable = (block: {
    role: string;
    text: string;
    pendingText?: string;
    status?: string;
  }) => ({
    role: block.role,
    text: block.text + (block.pendingText ?? ""),
    status: block.role === "thinking" ? undefined : block.status,
  });
  const adapted = messageBlocksFromProjection(projectEvents(events)).map(
    comparable,
  );
  const expected = tuiProject(events).messages.map(comparable);
  expect(adapted).toEqual(expected);
});
