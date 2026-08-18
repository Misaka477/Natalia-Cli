import { expect, test } from "bun:test";
import {
  createTestRenderer,
  createMockKeys,
  createMockMouse,
} from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import type { RuntimeEvent, RuntimeSessionSummary } from "@natalia/contracts";
import { DialogProvider } from "../src/dialog/provider";
import { DialogSessionList } from "../src/dialog/DialogLayer";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

test("the open session list applies title events without losing its search", async () => {
  const setup = await createTestRenderer({ width: 100, height: 24 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const sessions: RuntimeSessionSummary[] = [
    {
      id: "ses_alpha",
      title: "New session",
      createdAt: new Date().toISOString(),
      pinned: false,
      events: 2,
      pendingInputs: 0,
      cancelled: false,
      resumable: true,
    },
    {
      id: "ses_beta",
      title: "Other work",
      createdAt: new Date().toISOString(),
      pinned: false,
      events: 1,
      pendingInputs: 0,
      cancelled: false,
      resumable: true,
    },
  ];
  let listener: ((event: RuntimeEvent) => void) | undefined;
  let unsubscribed = false;
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <DialogSessionList
            backend={{
              async list() {
                return sessions;
              },
              async touch() {},
              async rename() {
                return sessions[0]!;
              },
              async pin() {
                return sessions[0]!;
              },
              async duplicate() {
                return sessions[0]!;
              },
              async delete(id) {
                return { id, removedAttachments: 0 };
              },
            }}
            subscribeRuntimeEvents={(handler) => {
              listener = handler;
              return () => {
                unsubscribed = true;
              };
            }}
          />
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
  const mouse = createMockMouse(setup.renderer);
  await Bun.sleep(30);
  await setup.renderOnce();
  const searchLine = setup
    .captureCharFrame()
    .split("\n")
    .findIndex((line) => line.includes("Search sessions"));
  await mouse.click(4, searchLine);
  await keys.typeText("ses_alpha");
  await setup.renderOnce();

  listener?.({
    type: "session.title.updated",
    sessionID: "ses_alpha" as never,
    title: "Generated topic",
  });
  await setup.renderOnce();

  const frame = setup.captureCharFrame();
  expect(frame).toContain("ses_alpha");
  expect(frame).toContain("Generated topic");
  expect(frame).not.toContain("Other work");

  setup.renderer.destroy();
  expect(unsubscribed).toBe(true);
  disposeKeymap();
});
