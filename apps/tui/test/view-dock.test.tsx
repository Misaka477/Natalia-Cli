import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { App } from "../src/app/App";
import { ClipboardProvider } from "../src/context/clipboard";
import { ToastProvider, ToastRegion } from "../src/context/toast";
import { RuntimeProvider } from "../src/context/runtime";
import { PromptRefProvider } from "../src/context/prompt";
import { KeybindProvider } from "../src/context/keybind";
import { RouteProvider } from "../src/context/route";
import { ThemeProvider } from "../src/context/theme";
import { LocalProvider } from "../src/context/local";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

function fakeBackend(): RuntimeClient {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  return {
    start(onEvent) {
      sink = onEvent;
      sink({
        type: "session.created",
        sessionID: "ses_v" as never,
        title: "V",
      });
      sink({ type: "session.ready", sessionID: "ses_v" as never });
    },
    async submit(text) {
      const event = {
        type: "turn.submitted" as const,
        id: "turn_v",
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(event);
      return event;
    },
    respondQuestion() {
      return { accepted: true };
    },
    respondApproval() {
      return { accepted: true };
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "snapshot", files: [] };
    },
    diagnostic() {},
    lastSubmission() {
      return undefined;
    },
    sessionSnapshot: async () => ({
      agentStatus: "running",
      currentStep: "step 1",
      activeTool: "read_file",
      changedFiles: 1,
      unvalidatedChanges: 1,
      hasPTY: false,
      hasSandbox: false,
    }),
    planList: async () => [],
    mailboxList: async () => [],
    driftFindings: async () => [],
    completions: async () => [],
    mailboxSend: async () => ({ queued: true, messageID: "mailbox:v" }),
    chatSubmit: async ({ text }: { text: string }) => {
      const user = {
        messageID: "chat:v1",
        role: "user" as const,
        text,
        at: "now",
      };
      sink?.({
        type: "chat.message.added",
        id: "chat:v1:user",
        messageID: user.messageID,
        role: "user",
        text,
        at: "now",
      });
      sink?.({
        type: "chat.message.added",
        id: "chat:v2:chat",
        messageID: "chat:v2",
        role: "chat",
        text: "the main agent is running step 2",
        at: "now",
      });
      return { messageID: "chat:v2" };
    },
    chatMessages: async () => [],
    chatRollback: async () => ({ rolledBackTo: "chat:v1", removed: 1 }),
  };
}

async function mountApp() {
  const setup = await createTestRenderer({ width: 150, height: 34 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ClipboardProvider>
          <ToastProvider>
            <ToastRegion />
            <RuntimeProvider>
              <PromptRefProvider>
                <KeybindProvider>
                  <RouteProvider>
                    <ThemeProvider>
                      <LocalProvider>
                        <App backend={fakeBackend()} />
                      </LocalProvider>
                    </ThemeProvider>
                  </RouteProvider>
                </KeybindProvider>
              </PromptRefProvider>
            </RuntimeProvider>
          </ToastProvider>
        </ClipboardProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await Bun.sleep(30);
  await setup.renderOnce();
  return {
    setup,
    disposeKeymap,
    keys: createMockKeys(setup.renderer, { kittyKeyboard: true }),
  };
}

test("chat.open docks the Live Work Chat beside the feed and focuses the chat pane", async () => {
  const mounted = await mountApp();
  try {
    // Open the palette, filter by the view's display name, apply it.
    await mounted.keys.pressKey("p", { ctrl: true });
    await Bun.sleep(30);
    await mounted.keys.typeText("Live Work");
    await Bun.sleep(30);
    await mounted.setup.renderOnce();
    mounted.keys.pressEnter();
    await Bun.sleep(60);
    await mounted.setup.renderOnce();
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Live Work Chat");
    expect(frame).toContain("Main agent: running");
    expect(frame).toContain("Ask the Chat");
    // The feed stays visible beside the docked view.
    expect(frame).toContain("Ask anything...");
    expect(frame).toContain("Chat · read-only");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("closing the docked view restores the feed and returns focus", async () => {
  const mounted = await mountApp();
  try {
    await mounted.keys.pressKey("p", { ctrl: true });
    await Bun.sleep(30);
    await mounted.keys.typeText("Live Work");
    await Bun.sleep(30);
    mounted.keys.pressEnter();
    await Bun.sleep(60);
    // Open the palette again and close the view.
    await mounted.keys.pressKey("p", { ctrl: true });
    await Bun.sleep(30);
    await mounted.keys.typeText("Close the docked view");
    await Bun.sleep(30);
    mounted.keys.pressEnter();
    await Bun.sleep(60);
    await mounted.setup.renderOnce();
    const frame = mounted.setup.captureCharFrame();
    expect(frame).not.toContain("Live Work Chat");
    expect(frame).toContain("Ask anything...");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});
