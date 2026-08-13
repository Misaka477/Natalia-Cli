import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { createSignal } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import { LiveChatView } from "../src/component/LiveChatView";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

type TimelineEntry = Parameters<
  typeof LiveChatView
>[0]["timeline"] extends () => infer T
  ? T
  : never;

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
  timeline: TimelineEntry,
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
        <LiveChatView
          backend={mockBackend(backendOverrides)}
          timeline={() => timeline}
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

const history: TimelineEntry = [
  {
    kind: "message",
    messageID: "chat:m1",
    role: "user",
    text: "what is the agent doing",
    at: "2026-08-14T00:00:00.000Z",
  },
  {
    kind: "message",
    messageID: "chat:m2",
    role: "chat",
    text: "it is running step 2 of the plan",
    at: "2026-08-14T00:00:01.000Z",
  },
  {
    kind: "action",
    id: "chat:a1",
    toolName: "mailbox_send",
    summary: "queued mailbox intent: constraint",
    at: "2026-08-14T00:00:02.000Z",
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

test("the conversation renders messages and Chat's tool actions in order", async () => {
  const mounted = await mountChat(history);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("what is the agent doing");
    expect(frame).toContain("it is running step 2 of the plan");
    expect(frame).toContain("queued mailbox intent: constraint");
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

test("a streaming chat reply appears incrementally as deltas land", async () => {
  const [timeline, setTimeline] = createSignal<TimelineEntry>([
    {
      kind: "message",
      messageID: "chat:m1",
      role: "user",
      text: "explain the plan",
      at: "now",
    },
  ]);
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <LiveChatView
          backend={mockBackend()}
          timeline={timeline}
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
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await Bun.sleep(20);
  await setup.renderOnce();
  try {
    // First delta creates the reply entry (the final added has not arrived).
    setTimeline([
      {
        kind: "message",
        messageID: "chat:m1",
        role: "user",
        text: "explain the plan",
        at: "now",
      },
      {
        kind: "message",
        messageID: "chat:m2",
        role: "chat",
        text: "the plan is",
        at: "now",
      },
    ]);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("the plan is");
    // A later delta replaces the reply text (incremental streaming).
    setTimeline([
      {
        kind: "message",
        messageID: "chat:m1",
        role: "user",
        text: "explain the plan",
        at: "now",
      },
      {
        kind: "message",
        messageID: "chat:m2",
        role: "chat",
        text: "the plan is to replace the wrapper",
        at: "now",
      },
    ]);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("replace the wrapper");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
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
