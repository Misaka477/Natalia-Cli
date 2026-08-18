import { expect, test } from "bun:test";
import { createMockMouse, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import type { RuntimeEvent } from "@natalia/contracts";
import { terminalTranscriptChars } from "@natalia/view-store";
import {
  StateProvider,
  useAppState,
  type AppState,
} from "../src/context/state";
import { RouteProvider } from "../src/context/route";
import {
  SessionFooter,
  SessionSidebar,
} from "../src/routes/session/SessionRoute";

/**
 * The TUI now keeps resource facts in `state.facts`, projected by
 * `@natalia/view-store`. These tests drive the **production** path — the store's
 * `produce` draft, which is a reactive Proxy — rather than the `structuredClone`
 * path the other reducer tests use.
 *
 * That distinction is the point: cloning and mutating a reactive proxy is what
 * broke the first attempt at this layer (2026-07-30), and the shared projection
 * builds new records by spreading the state it is handed and structurally
 * compares nested values. Both of those meet the proxy here and nowhere else in
 * the test suite.
 */
async function mountState() {
  const setup = await createTestRenderer({ width: 80, height: 24 });
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  let read: (() => AppState) | undefined;
  function Probe() {
    const { state } = useAppState();
    read = () => state;
    return <text>probe</text>;
  }
  await render(
    () => (
      <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
        <Probe />
      </StateProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  if (!dispatch || !read) throw new Error("state provider did not come up");
  const send = async (...events: RuntimeEvent[]) => {
    for (const event of events) dispatch!(event);
    // The provider batches on a 16 ms timer, so wait for the flush rather than
    // reaching past it: the batching is part of the path under test.
    await Bun.sleep(40);
    await setup.renderOnce();
  };
  return { setup, send, state: read };
}

const target = { kind: "host" as const, cwd: "/work" };

const terminalUpdate = (
  id: string,
  overrides: Partial<Extract<RuntimeEvent, { type: "terminal.update" }>> = {},
): RuntimeEvent => ({
  type: "terminal.update",
  id,
  command: "bash",
  cwd: "/work",
  status: "running",
  attached: true,
  rows: 24,
  cols: 80,
  activity: "running",
  tail: "$",
  target,
  ownership: "model",
  inputOwner: { type: "model" },
  geometryOwner: { type: "model" },
  ...overrides,
});

test("resource facts project through the reactive store, not only through a clone", async () => {
  const { setup, send, state } = await mountState();
  const long = "x".repeat(terminalTranscriptChars + 2_000);
  await send(terminalUpdate("t_a", { transcript: long }));

  const stored = state().facts.terminals.t_a;
  expect(stored?.status).toBe("running");
  // The shared transcript bound applies, so the TUI no longer trims its own.
  expect(stored?.transcript).toContain("earlier chars omitted");
  expect(stored?.transcript?.length).toBeLessThan(long.length);

  setup.renderer.destroy();
});

test("an identical terminal republish does not churn the projection under a proxy", async () => {
  const { setup, send, state } = await mountState();
  await send(terminalUpdate("t_a"));
  const before = state().facts.terminals;

  // The dedupe compares nested values (`target`, the owners) that are reactive
  // proxies by the time it sees them. If that comparison misread a proxy, every
  // republish would look like a change and this identity check would fail.
  await send(terminalUpdate("t_a"));
  expect(state().facts.terminals).toBe(before);

  await send(
    terminalUpdate("t_a", { inputOwner: { type: "viewer", viewerID: "v1" } }),
  );
  expect(state().facts.terminals).not.toBe(before);
  expect(state().facts.terminals.t_a?.inputOwner).toEqual({
    type: "viewer",
    viewerID: "v1",
  });

  setup.renderer.destroy();
});

test("activity facts reach the reactive TUI store for active work and user input", async () => {
  const { setup, send, state } = await mountState();
  await send(
    {
      type: "tool.update",
      id: "t1",
      name: "execute",
      callID: "c1",
      status: "running",
      summary: "npm test",
    },
    {
      type: "approval.request",
      id: "a1",
      title: "Approve command",
      preview: "npm test",
    },
  );

  expect(state().facts.activities["t1:tool:c1"]).toMatchObject({
    kind: "command",
    state: "active",
  });
  expect(state().facts.activities["approval:a1"]).toMatchObject({
    kind: "waiting_for_user",
    state: "waiting",
  });

  await send({ type: "approval.response", id: "a1", decision: "once" });
  expect(state().facts.activities["approval:a1"]).toBeUndefined();

  setup.renderer.destroy();
});

test("the footer renders English activity text and prioritizes input requests", async () => {
  const setup = await createTestRenderer({ width: 100, height: 8 });
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  await render(
    () => (
      <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
        <SessionFooter workspaceRoot="/work/natalia" />
      </StateProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  if (!dispatch) throw new Error("state provider did not come up");

  dispatch({
    type: "tool.update",
    id: "t1",
    name: "execute",
    callID: "c1",
    status: "running",
    summary: "npm test",
  });
  await Bun.sleep(40);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("Running command");

  dispatch({
    type: "question.request",
    id: "q1",
    title: "Which target?",
  });
  await Bun.sleep(40);
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  expect(frame).toContain("Waiting for answer");
  expect(frame).not.toContain("Running command");

  setup.renderer.destroy();
});

test("the footer animates active generation instead of showing a static dot", async () => {
  const setup = await createTestRenderer({ width: 100, height: 4 });
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  await render(
    () => (
      <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
        <SessionFooter workspaceRoot="/work/natalia" />
      </StateProvider>
    ),
    setup.renderer,
  );
  if (!dispatch) throw new Error("state provider did not come up");

  dispatch({ type: "content.delta", id: "turn_generating", text: "hello" });
  await setup.renderOnce();
  const first = setup
    .captureCharFrame()
    .split("\n")
    .find((line) => line.includes("Generating"))!;
  const firstDot = first.lastIndexOf(".", first.indexOf("Generating"));

  await Bun.sleep(170);
  await setup.renderOnce();
  const second = setup
    .captureCharFrame()
    .split("\n")
    .find((line) => line.includes("Generating"))!;
  const secondDot = second.lastIndexOf(".", second.indexOf("Generating"));

  expect(first).toContain("Generating");
  expect(secondDot).toBe(firstDot + 1);
  setup.renderer.destroy();
});

test("the footer times an active turn and hides the timer when it finishes", async () => {
  const setup = await createTestRenderer({ width: 100, height: 6 });
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  await render(
    () => (
      <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
        <SessionFooter workspaceRoot="/work/natalia" />
      </StateProvider>
    ),
    setup.renderer,
  );
  if (!dispatch) throw new Error("state provider did not come up");

  dispatch({ type: "turn.started", id: "turn_timed" });
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("0:00 elapsed");

  await Bun.sleep(1_050);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("0:01 elapsed");

  dispatch({
    type: "turn.finished",
    id: "turn_timed",
    stopReason: "done",
  });
  await setup.renderOnce();
  expect(setup.captureCharFrame()).not.toContain("elapsed");
  setup.renderer.destroy();
});

test("turn completion adds one stable footer with model, duration, and usage", async () => {
  const { setup, send, state } = await mountState();
  const finished: RuntimeEvent = {
    type: "turn.finished",
    id: "turn_metadata",
    stopReason: "done",
    profile: "ask",
    model: "gpt-test",
    durationMs: 1_250,
    inputTokens: 1_024,
    outputTokens: 256,
  };

  await send(finished, finished);

  const footers = state().messages.filter(
    (message) => message.id === "turn_metadata:footer",
  );
  expect(footers).toHaveLength(1);
  expect(footers[0]).toMatchObject({
    role: "turn_footer",
    text: "ask · gpt-test · 1.3s · 1,024 in / 256 out",
  });

  setup.renderer.destroy();
});

test("the footer exposes the workspace path as a clickable control", async () => {
  const setup = await createTestRenderer({ width: 100, height: 4 });
  let selected = 0;
  await render(
    () => (
      <StateProvider>
        <SessionFooter
          workspaceRoot="/work/natalia"
          onWorkspaceSelect={() => selected++}
        />
      </StateProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  expect(frame).toContain("/work/natalia ▼");

  const line = frame.split("\n").findIndex((value) => value.includes("/work"));
  const column = frame.split("\n")[line]!.indexOf("/work") + 2;
  const mouse = createMockMouse(setup.renderer);
  await mouse.click(column, line);
  expect(selected).toBe(1);

  setup.renderer.destroy();
});

test("the sidebar prioritizes the plan and keeps agent internals out of view", async () => {
  const setup = await createTestRenderer({ width: 42, height: 24 });
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  await render(
    () => (
      <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
        <RouteProvider>
          <SessionSidebar workspaceRoot="/work/very-private-project" />
        </RouteProvider>
      </StateProvider>
    ),
    setup.renderer,
  );
  if (!dispatch) throw new Error("state provider did not come up");

  dispatch({
    type: "session.created",
    sessionID: "ses_private" as never,
    title: "Quiet sidebar",
  });
  dispatch({
    type: "tool.update",
    id: "todo_1",
    name: "todo_write",
    status: "succeeded",
    summary: "saved 3 todos",
    argumentsDelta: JSON.stringify({
      items: [
        { content: "Inspect the current layout", status: "completed" },
        { content: "Refine sidebar hierarchy", status: "in_progress" },
        { content: "Verify interaction states", status: "pending" },
      ],
    }),
  });
  dispatch({
    type: "subagent.update",
    id: "agent_a",
    status: "running",
    attached: true,
    event: "created",
    task: "This long internal agent task must stay in the detail view",
    continuation: 0,
  });
  await Bun.sleep(40);
  await setup.renderOnce();
  const frame = setup.captureCharFrame();

  expect(frame).toContain("Quiet sidebar");
  expect(frame).toContain("Plan");
  expect(frame).toContain("Refine sidebar hierarchy");
  expect(frame).toContain("Agents");
  expect(frame).toContain("agent_a · running");
  expect(frame).not.toContain("long internal agent task");
  expect(frame).not.toContain("ses_private");
  expect(frame).not.toContain("very-private-project");
  expect(frame).not.toContain("Tools");
  expect(frame).not.toContain("Workspace");

  setup.renderer.destroy();
});

test("a replayed terminal timeline entry is not counted twice", async () => {
  const { setup, send, state } = await mountState();
  const entry: RuntimeEvent = {
    type: "terminal.timeline",
    id: "t_a",
    actor: "model",
    action: "submit",
    status: "requested",
    summary: "install",
    at: "2026-08-09T00:00:00.000Z",
  };
  await send(entry, entry, { ...entry, at: "2026-08-09T00:00:01.000Z" });
  expect(state().facts.terminalTimeline.t_a).toHaveLength(2);
  setup.renderer.destroy();
});

test("the terminal pane still selects a model pane and releases it on exit", async () => {
  const { setup, send, state } = await mountState();
  await send(terminalUpdate("t_a"));
  // Pane selection is presentation, so it stays in the TUI and reads the facts.
  expect(state().terminalPane.selectedID).toBe("t_a");

  await send({ type: "terminal.pane.focus", focus: "terminal" });
  expect(state().terminalPane.focus).toBe("terminal");

  await send(terminalUpdate("t_a", { status: "exited", activity: "waiting" }));
  expect(state().terminalPane.selectedID).toBeUndefined();
  expect(state().terminalPane.focus).toBe("chat");

  setup.renderer.destroy();
});

test("subagent and MCP facts land in the projection while the TUI keeps its narration", async () => {
  const { setup, send, state } = await mountState();
  await send(
    {
      type: "subagent.update",
      id: "agent_a",
      status: "running",
      attached: true,
      event: "created",
      task: "audit",
      continuation: 0,
    },
    { type: "mcp.status", server: "docs", status: "connected", tools: 3 },
    {
      type: "sandbox.audit",
      id: "box",
      action: "skill-script",
      target,
      approvalRequired: true,
      checkpointPolicy: "sandbox_manifest",
      message: "sandbox is not container security",
    },
    { type: "snapshot.created", id: "snap_1", files: ["a.ts"] },
  );

  expect(state().facts.subagents.agent_a?.status).toBe("running");
  expect(state().facts.subagentHistory.agent_a).toHaveLength(1);
  expect(state().facts.mcp.docs?.status).toBe("connected");
  expect(state().footer).toBe("MCP docs: connected");
  // The inline rows the TUI narrates are unchanged by the move.
  expect(
    state().messages.find((block) => block.id === "subagent:agent_a")?.text,
  ).toContain("audit");
  expect(
    state().messages.find((block) => block.id === "sandbox:box:skill-script")
      ?.text,
  ).toContain("approval: required");
  expect(
    state().messages.find((block) => block.id === "snapshot:snap_1")?.text,
  ).toContain("snapshot snap_1");

  // Only the events whose state is read from the projection are routed into it.
  // view-store narrates `sandbox.audit` and `snapshot.created` as transcript
  // rows, and nothing renders `facts.messages`, so routing them here would build
  // a second transcript no one reads while the visible rows stayed the TUI's.
  expect(state().facts.messages).toEqual([]);

  setup.renderer.destroy();
});
