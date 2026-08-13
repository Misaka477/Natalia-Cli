import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient } from "@natalia/contracts";
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
    planList: async () => [
      {
        planID: "plan:1",
        version: 5,
        title: "Switch to Bun-native HTTP",
        author: "live_chat",
        objective: "replace the fetch wrapper",
        steps: [{ id: "s1", title: "introduce the server" }],
        constraints: ["keep loopback default"],
        verification: ["typecheck"],
        riskNotes: [],
        status: "active",
      },
    ],
    mailboxList: async () => [
      {
        messageID: "mailbox:1",
        source: "user_via_live_chat",
        priority: "high",
        intent: "constraint",
        text: "never commit the lockfile",
        safeSummary: "a constraint",
        deliveryPolicy: "next_safe_boundary",
        createdAt: "now",
        status: "queued",
      },
    ],
    driftFindings: async () => [
      {
        findingID: "drift:1",
        severity: "high",
        confidence: 0.8,
        originalObjective: "implement user authentication",
        currentActivity: "refactoring the css theme",
        evidence: [],
        status: "open",
      },
    ],
    completions: async () => [
      {
        completionID: "completion:1",
        taskID: "task_1",
        objective: "verify",
        changeSummary: "added the build check",
        validations: [{ command: "npm run typecheck", result: "passed" }],
        knownGaps: [],
      },
    ],
    mailboxSend: async () => ({ queued: true, messageID: "mailbox:2" }),
    ...overrides,
  } as unknown as RuntimeClient;
}

async function mountChat(
  backend: RuntimeClient,
  callbacks: {
    focused?: () => boolean;
    onEscape?: () => void;
    onClose?: () => void;
  } = {},
) {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const onEscape = callbacks.onEscape ?? (() => {});
  const onClose = callbacks.onClose ?? (() => {});
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <LiveChatView
            backend={backend}
            focused={callbacks.focused ?? (() => true)}
            onRequestFocus={() => {}}
            onEscape={onEscape}
            onClose={onClose}
            onInputRef={() => {}}
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
  };
}

test("the live work chat view renders the snapshot, plan, drift and completion card", async () => {
  const mounted = await mountChat(mockBackend());
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Live Work Chat");
    expect(frame).toContain("writes routed through the main-agent mailbox");
    expect(frame).toContain("Main agent: running");
    expect(frame).toContain("replace the fetch wrapper");
    expect(frame).toContain("implement user authentication");
    expect(frame).toContain("added the build check");
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("the mailbox read surface renders queued intents for the main agent", async () => {
  const backend = mockBackend({
    sessionSnapshot: async () => undefined,
    planList: async () => [],
    driftFindings: async () => [],
    completions: async () => [],
  });
  const mounted = await mountChat(backend);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Pending intents");
    expect(frame).toContain("never commit the lockfile");
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("sending a message routes a durable mailbox intent to the main agent", async () => {
  const sends: Array<Record<string, unknown>> = [];
  const backend = mockBackend({
    mailboxSend: async (input: Record<string, unknown>) => {
      sends.push(input);
      return { queued: true, messageID: "mailbox:2" };
    },
  });
  const mounted = await mountChat(backend);
  try {
    await mounted.keys.typeText("please focus on the docs task first");
    await mounted.setup.renderOnce();
    mounted.keys.pressEnter();
    await Bun.sleep(20);
    await mounted.setup.renderOnce();
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({
      intent: "clarification",
      text: "please focus on the docs task first",
      safeSummary: "please focus on the docs task first",
      deliveryPolicy: "next_safe_boundary",
      priority: "normal",
    });
    // The sent message appears in the view's own history.
    expect(mounted.setup.captureCharFrame()).toContain(
      "please focus on the docs task first",
    );
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("escape in the chat pane returns focus to the main feed", async () => {
  let escaped = false;
  const mounted = await mountChat(mockBackend(), {
    onEscape: () => {
      escaped = true;
    },
  });
  try {
    await mounted.keys.pressEscape();
    await mounted.setup.renderOnce();
    expect(escaped).toBe(true);
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});

test("a non-focused chat pane does not send on enter", async () => {
  const sends: Array<Record<string, unknown>> = [];
  const backend = mockBackend({
    mailboxSend: async (input: Record<string, unknown>) => {
      sends.push(input);
      return { queued: true, messageID: "mailbox:2" };
    },
  });
  const mounted = await mountChat(backend, { focused: () => false });
  try {
    await mounted.keys.typeText("should not send");
    await mounted.setup.renderOnce();
    mounted.keys.pressEnter();
    await Bun.sleep(20);
    await mounted.setup.renderOnce();
    expect(sends).toHaveLength(0);
  } finally {
    mounted.dispose();
    mounted.setup.renderer.destroy();
  }
});
