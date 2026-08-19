import { expect, test } from "bun:test";
import { CodeRenderable, type Renderable } from "@opentui/core";
import {
  createMockKeys,
  createTestRenderer,
  MockTreeSitterClient,
} from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { createSignal } from "solid-js";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient } from "@natalia/contracts";
import type {
  ChatActivityView,
  SessionIntelligenceView,
} from "@natalia/view-store";
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

function useMockHighlighter(
  node: Renderable,
  treeSitterClient: MockTreeSitterClient,
) {
  if (node instanceof CodeRenderable) node.treeSitterClient = treeSitterClient;
  for (const child of node.getChildren())
    useMockHighlighter(child, treeSitterClient);
}

async function mountChat(
  messages: MessageBlock[],
  callbacks: {
    focused?: () => boolean;
    onEscape?: () => void;
    onSend?: (text: string) => void;
    onRollback?: (toMessageID: string) => void;
    onPlanAccept?: (planID: string) => void;
    onPlanReject?: (planID: string) => void;
    activity?: () => ChatActivityView | undefined;
    intelligence?: () => SessionIntelligenceView | undefined;
  } = {},
  backendOverrides: Record<string, unknown> = {},
) {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const treeSitterClient = new MockTreeSitterClient({ autoResolveTimeout: 0 });
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
            activity={callbacks.activity ?? (() => undefined)}
            intelligence={callbacks.intelligence}
            focused={callbacks.focused ?? (() => true)}
            onRequestFocus={() => {}}
            onEscape={callbacks.onEscape ?? (() => {})}
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
            contentWidth={156}
            density="comfortable"
            toolDetails="collapsed"
            reasoning="step"
            diffStyle="auto"
            toolPreviewLines={10}
          />
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  // OpenTUI creates markdown's internal CodeRenderable before Solid applies
  // the renderer's next frame. Swap in the deterministic test client first so
  // teardown cannot reject a request on the process-wide client.
  useMockHighlighter(setup.renderer.root, treeSitterClient);
  await Bun.sleep(20);
  await setup.renderOnce();
  return {
    setup,
    async dispose() {
      // Let markdown/code highlighters finish before the renderer destroys the
      // shared TreeSitter client and rejects in-flight highlight requests.
      await setup.waitForVisualIdle();
      disposeKeymap();
      setup.renderer.destroy();
      await treeSitterClient.destroy();
    },
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
    expect(frame).toContain("Ask about the work, inspect progress");
    expect(frame).toContain("Main: running");
    expect(frame).not.toContain("Chat Agent");
    expect(frame).not.toContain("limited tools");
  } finally {
    await mounted.dispose();
  }
});

test("the projected conversation renders through the main feed's row renderer", async () => {
  const mounted = await mountChat(history);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("what is the agent doing");
    expect(frame).toContain("it is running step 2 of the plan");
    expect(frame).toContain("session_snapshot");
    expect(frame).not.toContain("tool session_snapshot");
  } finally {
    await mounted.dispose();
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
    await mounted.dispose();
  }
});

test("the Chat footer shows independent activity and elapsed time", async () => {
  const mounted = await mountChat(history, {
    activity: () => ({
      messageID: "chat:m2",
      phase: "using_tool",
      toolName: "session_snapshot",
      startedAt: Date.now() - 1_100,
    }),
  });
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Using session_snapshot");
    expect(frame).toContain("0:01 elapsed");
    expect(frame).not.toContain("• Ready");
  } finally {
    await mounted.dispose();
  }
});

test("the main status follows the live intelligence projection", async () => {
  const [intelligence, setIntelligence] =
    createSignal<SessionIntelligenceView>();
  const mounted = await mountChat([], { intelligence });
  try {
    setIntelligence({
      type: "session.snapshot",
      id: "snapshot:live",
      agentStatus: "running",
      currentStep: "step 4",
      activeTool: "read_file",
      changedFiles: 3,
      unvalidatedChanges: 1,
      hasPTY: false,
      hasSandbox: false,
    });
    await mounted.setup.renderOnce();
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Main: running");
    expect(frame).toContain("step 4");
    expect(frame).toContain("read_file");
  } finally {
    await mounted.dispose();
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
    await mounted.dispose();
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
    await mounted.dispose();
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
  const treeSitterClient = new MockTreeSitterClient({ autoResolveTimeout: 0 });
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <LiveChatView
            backend={mockBackend()}
            messages={messages}
            activity={() => undefined}
            focused={() => true}
            onRequestFocus={() => {}}
            onEscape={() => {}}
            onInputRef={() => {}}
            onSend={() => {}}
            onRollback={() => {}}
            onPlanAccept={() => {}}
            onPlanReject={() => {}}
            promptMaxHeight={6}
            contentWidth={156}
            density="comfortable"
            toolDetails="collapsed"
            reasoning="step"
            diffStyle="auto"
            toolPreviewLines={10}
          />
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  useMockHighlighter(setup.renderer.root, treeSitterClient);
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
    await setup.waitForVisualIdle();
    disposeKeymap();
    setup.renderer.destroy();
    await treeSitterClient.destroy();
  }
});
