import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { StateProvider } from "../src/context/state";
import { PromptRefProvider } from "../src/context/prompt";
import { RouteProvider } from "../src/context/route";
import { ToastProvider } from "../src/context/toast";
import { DialogProvider } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";
import { SubagentRoute } from "../src/routes/session/SessionRoute";

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
  expect(frame).toContain("Subagent detail · read-only");

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
