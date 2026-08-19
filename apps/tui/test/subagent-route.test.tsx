import { expect, test } from "bun:test";
import {
  createMockKeys,
  createMockMouse,
  createTestRenderer,
} from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { StateProvider } from "../src/context/state";
import { PromptRefProvider } from "../src/context/prompt";
import { RouteProvider, useRouteController } from "../src/context/route";
import { ToastProvider } from "../src/context/toast";
import { DialogProvider } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";
import {
  SessionFooter,
  SubagentRoute,
} from "../src/routes/session/SessionRoute";

test("subagent detail renders the shared thinking, tool, and streaming rows", async () => {
  const setup = await createTestRenderer({ width: 120, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
            <RouteProvider>
              <SubagentRoute
                agentID="a1"
                onBack={() => {}}
                followBottom
                density="comfortable"
                toolDetails="collapsed"
                reasoning="step"
                diffStyle="auto"
                terminalWidth={120}
                toolPreviewLines={10}
              />
            </RouteProvider>
          </StateProvider>
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  const send = (...events: RuntimeEvent[]) => {
    for (const event of events) dispatch!(event);
  };
  send(
    {
      type: "subagent.update",
      id: "a1",
      status: "running",
      attached: true,
      event: "created",
      task: "Inspect the shared renderer",
    },
    {
      type: "turn.submitted",
      id: "subagent:a1",
      text: "Inspect the shared renderer",
      byteLength: 27,
      lineCount: 1,
      sha256: "test",
      agentID: "a1",
    },
    {
      type: "thinking.delta",
      id: "subagent:a1",
      text: "Tracing the main timeline",
      agentID: "a1",
    },
    {
      type: "tool.update",
      id: "subagent:a1:call_read",
      name: "read_file",
      callID: "call_read",
      status: "succeeded",
      summary: "source loaded",
      argumentsDelta: '{"path":"src/view.tsx"}',
      result: "source loaded",
      agentID: "a1",
    },
    {
      type: "content.delta",
      id: "subagent:a1",
      text: "Shared renderer confirmed",
      agentID: "a1",
    },
  );
  await Bun.sleep(80);
  await setup.renderOnce();

  const frame = setup.captureCharFrame();
  expect(frame).toContain("Inspect the shared renderer");
  expect(frame).toContain("Thought");
  expect(frame).toContain("Tracing the main timeline");
  expect(frame).toContain("Read src/view.tsx");
  expect(frame).toContain("Shared renderer confirmed");
  expect(frame).toContain("a1 · running · Esc back");
  expect(frame).not.toContain("Subagent detail · read-only");

  disposeKeymap();
  setup.renderer.destroy();
});

test("subagent detail renders its own approval instead of the parent modal", async () => {
  const setup = await createTestRenderer({ width: 100, height: 28 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const backend = { respondApproval() {} } as unknown as RuntimeClient;
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <PromptRefProvider>
            <DialogProvider>
              <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
                <RouteProvider>
                  <SubagentRoute
                    agentID="a1"
                    onBack={() => {}}
                    backend={backend}
                    terminalWidth={100}
                  />
                </RouteProvider>
              </StateProvider>
            </DialogProvider>
          </PromptRefProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  dispatch!({
    type: "approval.request",
    id: "child-approval",
    title: "Approve child write",
    preview: "child.txt",
    agentID: "a1",
  });
  await Bun.sleep(40);
  await setup.renderOnce();

  const frame = setup.captureCharFrame();
  expect(frame).toContain("Permission required");
  expect(frame).toContain("Approve child write");
  expect(frame).toContain("child.txt");

  disposeKeymap();
  setup.renderer.destroy();
});

test("nested subagent navigation returns through each parent route", async () => {
  const setup = await createTestRenderer({ width: 120, height: 30 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  let dispatch: ((event: RuntimeEvent) => void) | undefined;

  function RoutedSubagent() {
    const route = useRouteController();
    if (route.route().kind === "none")
      route.push({ kind: "subagent", id: "a1" });
    const current = () => route.route();
    return current().kind === "subagent" ? (
      <SubagentRoute
        agentID={(current() as { kind: "subagent"; id: string }).id}
        onBack={() => route.back()}
        terminalWidth={120}
      />
    ) : (
      <text>Main session</text>
    );
  }

  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <PromptRefProvider>
            <DialogProvider>
              <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
                <RouteProvider>
                  <RoutedSubagent />
                </RouteProvider>
              </StateProvider>
            </DialogProvider>
          </PromptRefProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  const send = (...events: RuntimeEvent[]) => {
    for (const event of events) dispatch!(event);
  };
  send(
    {
      type: "subagent.update",
      id: "a1",
      status: "running",
      attached: true,
      event: "created",
      task: "Parent",
    },
    {
      type: "subagent.update",
      id: "a2",
      parentAgentID: "a1",
      status: "running",
      attached: true,
      event: "created",
      task: "Child",
    },
    {
      type: "subagent.update",
      id: "a3",
      parentAgentID: "a2",
      status: "completed",
      attached: true,
      event: "done",
      task: "Grandchild",
    },
  );
  await Bun.sleep(50);
  await setup.renderOnce();
  const mouse = createMockMouse(setup.renderer);
  const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });

  async function clickLabel(label: string) {
    const lines = setup.captureCharFrame().split("\n");
    const y = lines.findIndex((line) => line.includes(label));
    const x = lines[y]!.indexOf(label) + Math.floor(label.length / 2);
    await mouse.click(x, y);
    await Bun.sleep(20);
    await setup.renderOnce();
  }

  expect(setup.captureCharFrame()).toContain("a1 · running · Esc back");
  await clickLabel("a2");
  expect(setup.captureCharFrame()).toContain("a2 · running · Esc back");
  await clickLabel("a3");
  expect(setup.captureCharFrame()).toContain("a3 · completed · Esc back");

  keys.pressEscape();
  await Bun.sleep(20);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("a2 · running · Esc back");
  keys.pressEscape();
  await Bun.sleep(20);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("a1 · running · Esc back");

  disposeKeymap();
  setup.renderer.destroy();
});

test("the parent turn timer keeps running while a subagent route is open", async () => {
  const setup = await createTestRenderer({ width: 100, height: 12 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  let dispatch: ((event: RuntimeEvent) => void) | undefined;
  let openSubagent: (() => void) | undefined;
  let returnToParent: (() => void) | undefined;

  function RoutedSession() {
    const route = useRouteController();
    openSubagent = () => route.push({ kind: "subagent", id: "a1" });
    returnToParent = () => route.back();
    const current = () => route.route();
    return current().kind === "subagent" ? (
      <SubagentRoute
        agentID={(current() as { kind: "subagent"; id: string }).id}
        onBack={() => route.back()}
        terminalWidth={100}
      />
    ) : (
      <SessionFooter workspaceRoot="/work/natalia" />
    );
  }

  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <PromptRefProvider>
            <DialogProvider>
              <StateProvider onReady={(bridge) => (dispatch = bridge.dispatch)}>
                <RouteProvider>
                  <RoutedSession />
                </RouteProvider>
              </StateProvider>
            </DialogProvider>
          </PromptRefProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  if (!dispatch || !openSubagent || !returnToParent)
    throw new Error("routed session did not come up");

  dispatch({ type: "turn.started", id: "turn_parent" });
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("0:00 elapsed");

  await Bun.sleep(1_050);
  openSubagent();
  await setup.renderOnce();
  await Bun.sleep(1_050);
  returnToParent();
  await setup.renderOnce();

  const elapsed = setup.captureCharFrame().match(/(\d+):(\d{2}) elapsed/);
  expect(elapsed).not.toBeNull();
  expect(Number(elapsed![1]) * 60 + Number(elapsed![2])).toBeGreaterThanOrEqual(
    2,
  );

  disposeKeymap();
  setup.renderer.destroy();
});
