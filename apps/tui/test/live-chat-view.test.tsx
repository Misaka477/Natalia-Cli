import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { createSignal } from "solid-js";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient } from "@natalia/contracts";
import type { MessageBlock } from "../src/context/state";
import { LiveChatView } from "../src/component/LiveChatView";
import { DialogProvider } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

function mockBackend(overrides: Record<string, unknown> = {}) {
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
    mailboxList: async () => [],
    planList: async () => [],
    ...overrides,
  } as unknown as RuntimeClient;
}

async function mountChat(
  messages: MessageBlock[],
  callbacks: {
    focused?: () => boolean;
    onEscape?: () => void;
    onClose?: () => void;
    onSend?: (text: string) => void;
    onRollback?: (toMessageID: string) => void;
    onPlanAccept?: (planID: string) => void;
    onPlanReject?: (planID: string) => void;
  } = {},
  backendOverrides: Record<string, unknown> = {},
) {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const sent: string[] = [];
  const rolledBack: string[] = [];
  const accepted: string[] = [];
  const rejected: string[] = [];
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <LiveChatView
            backend={mockBackend(backendOverrides)}
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
            onPlanAccept={(planID) => {
              accepted.push(planID);
              callbacks.onPlanAccept?.(planID);
            }}
            onPlanReject={(planID) => {
              rejected.push(planID);
              callbacks.onPlanReject?.(planID);
            }}
            promptMaxHeight={6}
          />
        </DialogProvider>
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
    accepted,
    rejected,
  };
}

const history: MessageBlock[] = [
  {
    id: "chat:chat:m1:user",
    role: "user",
    text: "what is the agent doing",
    pendingText: "",
    owner: "projection",
  },
  {
    id: "chat:chat:m2:assistant",
    role: "assistant",
    text: "it is running step 2 of the plan",
    pendingText: "",
    owner: "projection",
  },
  {
    id: "chat:chat:a1:tool",
    role: "tool",
    text: "generic:session_snapshot arguments ready · snapshot read",
    pendingText: "",
    owner: "projection",
    tool: {
      id: "chat:chat:a1:tool",
      name: "session_snapshot",
      kind: "generic",
      status: "succeeded",
      summary: "snapshot read",
      argumentsRaw: "{}",
      argumentsComplete: true,
      keyArguments: [],
      redactedArguments: "{}",
      elapsed: "",
      result: undefined,
      metadata: {},
      detailAvailable: true,
    },
  },
];

test("an empty conversation invites the collaborator role", async () => {
  const mounted = await mountChat([]);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Live Work Chat");
    expect(frame).toContain("Start a conversation with the Chat");
    expect(frame).toContain("Main agent: running");
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("the projected conversation renders through the main feed's row renderer", async () => {
  const mounted = await mountChat(history);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("what is the agent doing");
    expect(frame).toContain("it is running step 2 of the plan");
    expect(frame).toContain("session_snapshot");
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

test("a Chat-proposed plan shows a review card with accept and reject", async () => {
  const mounted = await mountChat(
    history,
    {},
    {
      planList: async () => [
        {
          planID: "plan:1",
          version: 1,
          title: "Switch to Bun-native HTTP",
          author: "live_chat",
          objective: "replace the fetch wrapper",
          steps: [],
          constraints: [],
          verification: [],
          riskNotes: [],
          status: "proposed",
          createdAt: "2026-08-14T00:00:00.000Z",
        },
      ],
    },
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Chat drafted a plan for your review");
    expect(frame).toContain("Switch to Bun-native HTTP");
    expect(frame).toContain("accept");
    expect(frame).toContain("reject");
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("a streamed Chat reply appears incrementally as the projection updates", async () => {
  const [messages, setMessages] = createSignal<MessageBlock[]>([
    {
      id: "chat:chat:m1:user",
      role: "user",
      text: "explain the plan",
      pendingText: "",
      owner: "projection",
    },
  ]);
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <LiveChatView
            backend={mockBackend()}
            messages={messages}
            focused={() => true}
            onRequestFocus={() => {}}
            onEscape={() => {}}
            onClose={() => {}}
            onInputRef={() => {}}
            onSend={() => {}}
            onRollback={() => {}}
            onPlanAccept={() => {}}
            onPlanReject={() => {}}
            promptMaxHeight={6}
          />
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await Bun.sleep(20);
  await setup.renderOnce();
  try {
    // First delta creates the assistant block (the final added has not landed).
    setMessages([
      messages()[0]!,
      {
        id: "chat:chat:m2:assistant",
        role: "assistant",
        text: "the plan is",
        pendingText: "",
        owner: "projection",
      },
    ]);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("the plan is");
    // A later delta replaces the text (incremental streaming).
    setMessages([
      messages()[0]!,
      {
        id: "chat:chat:m2:assistant",
        role: "assistant",
        text: "the plan is to replace the wrapper",
        pendingText: "",
        owner: "projection",
      },
    ]);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("replace the wrapper");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
  }
});
