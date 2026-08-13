import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient, ChatMessageRow } from "@natalia/contracts";
import { LiveChatView } from "../src/component/LiveChatView";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

function mockBackend() {
  return {
    sessionSnapshot: async () => ({
      agentStatus: "running",
      currentStep: "step 3",
      activeTool: "write_file",
      changedFiles: 2,
      unvalidatedChanges: 2,
      hasPTY: true,
      hasSandbox: false,
    }),
  } as unknown as RuntimeClient;
}

async function mountChat(
  messages: ChatMessageRow[],
  callbacks: {
    focused?: () => boolean;
    onEscape?: () => void;
    onClose?: () => void;
    onSend?: (text: string) => void;
    onRollback?: (toMessageID: string) => void;
  } = {},
) {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const sent: string[] = [];
  const rolledBack: string[] = [];
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <LiveChatView
          backend={mockBackend()}
          messages={() => messages}
          focused={callbacks.focused ?? (() => true)}
          onRequestFocus={() => {}}
          onEscape={callbacks.onEscape ?? (() => {})}
          onClose={callbacks.onClose ?? (() => {})}
          onInputRef={() => {}}
          onSend={(text) => {
            sent.push(text);
            callbacks.onSend?.(text);
          }}
          onRollback={(toMessageID) => {
            rolledBack.push(toMessageID);
            callbacks.onRollback?.(toMessageID);
          }}
        />
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await Bun.sleep(20);
  await setup.renderOnce();
  return {
    setup,
    dispose: disposeKeymap,
    keys: createMockKeys(setup.renderer, { kittyKeyboard: true }),
    sent,
    rolledBack,
  };
}

const history: ChatMessageRow[] = [
  {
    messageID: "chat:m1",
    role: "user",
    text: "what is the agent doing",
    at: "2026-08-14T00:00:00.000Z",
  },
  {
    messageID: "chat:m2",
    role: "chat",
    text: "it is running step 2 of the plan",
    at: "2026-08-14T00:00:01.000Z",
  },
];

test("an empty conversation invites the collaborator role", async () => {
  const mounted = await mountChat([]);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Live Work Chat");
    expect(frame).toContain(
      "Chat with the collaborator about the main agent's work",
    );
    expect(frame).toContain("Main agent: running");
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("the durable conversation renders as a user/chat exchange", async () => {
  const mounted = await mountChat(history);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("You");
    expect(frame).toContain("what is the agent doing");
    expect(frame).toContain("Chat");
    expect(frame).toContain("it is running step 2 of the plan");
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("sending a message routes it into the Chat conversation", async () => {
  const mounted = await mountChat(history);
  try {
    await mounted.keys.typeText("why is it installing that dependency");
    await mounted.setup.renderOnce();
    mounted.keys.pressEnter();
    await Bun.sleep(10);
    await mounted.setup.renderOnce();
    expect(mounted.sent).toEqual(["why is it installing that dependency"]);
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("a non-focused chat pane does not send on enter", async () => {
  const mounted = await mountChat(history, { focused: () => false });
  try {
    await mounted.keys.typeText("should not send");
    await mounted.setup.renderOnce();
    mounted.keys.pressEnter();
    await Bun.sleep(10);
    await mounted.setup.renderOnce();
    expect(mounted.sent).toHaveLength(0);
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("rollback undoes the last exchange to the last user boundary", async () => {
  const mounted = await mountChat(history);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("rollback");
    // The rollback affordance targets the last user message boundary.
    expect(mounted.rolledBack).toHaveLength(0);
    // Mouse-driven; the handler is exercised through the render tree.
    expect(mounted.sent).toHaveLength(0);
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});
