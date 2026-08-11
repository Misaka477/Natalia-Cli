import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import type { RuntimeEvent } from "@natalia/contracts";
import { terminalTranscriptChars } from "@natalia/view-store";
import {
  StateProvider,
  useAppState,
  type AppState,
} from "../src/context/state";

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
