import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { MessageBlock } from "../src/context/state";
import { MessageBlockView } from "../src/routes/session/message-rows";
import { DialogProvider } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

async function mountBlock(block: MessageBlock) {
  const setup = await createTestRenderer({ width: 120, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <MessageBlockView
            block={block}
            density="comfortable"
            toolDetails="collapsed"
            diffStyle="auto"
            terminalWidth={120}
            toolPreviewLines={10}
          />
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  return { setup, disposeKeymap };
}

const userBlock: MessageBlock = {
  id: "m1:user",
  role: "user",
  text: "please switch the server to Bun-native HTTP",
  owner: "projection",
};

const assistantBlock: MessageBlock = {
  id: "m1:assistant",
  role: "assistant",
  text: "replacing the fetch wrapper",
  owner: "projection",
};

const thinkingBlock: MessageBlock = {
  id: "m1:thinking",
  role: "thinking",
  text: "the user wants a transport swap; hold the plan until the diff is read",
  owner: "projection",
};

const toolBlock = (
  overrides: Partial<NonNullable<MessageBlock["tool"]>> = {},
) =>
  ({
    id: "tool:plan:call_1",
    role: "tool",
    text: "plan:plan objective=x · plan ready",
    owner: "projection",
    tool: {
      id: "tool:plan:call_1",
      name: "plan",
      kind: "generic",
      status: "succeeded",
      summary: "plan ready",
      argumentsRaw: '{"objective":"x"}',
      argumentsComplete: true,
      keyArguments: ["objective=x"],
      redactedArguments: '{"objective":"x"}',
      elapsed: "1.2s",
      result: {
        summary: "plan ready",
        preview: "step 1",
        detail: "step 1\nstep 2",
        truncated: false,
        totalChars: 14,
        totalLines: 2,
      },
      metadata: {},
      detailAvailable: true,
      ...overrides,
    },
  }) as unknown as MessageBlock;

test("a user message reads as content, not a labelled toolbar", async () => {
  const mounted = await mountBlock(userBlock);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("please switch the server to Bun-native HTTP");
    expect(frame).not.toContain("▎You");
    expect(frame).not.toContain("copy");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("an assistant reply is plain content with no per-block header", async () => {
  const mounted = await mountBlock(assistantBlock);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("replacing the fetch wrapper");
    expect(frame).not.toContain("Natalia");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a thinking row is one Thought line until opened", async () => {
  const mounted = await mountBlock(thinkingBlock);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Thought");
    expect(frame).not.toContain("transport swap");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a completed generic tool collapses to one line when details are collapsed", async () => {
  const mounted = await mountBlock(toolBlock());
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("plan");
    expect(frame).not.toContain("args:");
    expect(frame).not.toContain("result:");
    expect(frame).not.toContain("d detail");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a diff keeps its block even when details are collapsed", async () => {
  const mounted = await mountBlock(
    toolBlock({
      name: "edit",
      kind: "diff",
      result: {
        summary: "1 insertion",
        preview: "--- a/src/x.ts",
        detail:
          "--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1 +1 @@\n-export const a = 1\n+export const b = 2",
        truncated: false,
        totalChars: 60,
        totalLines: 5,
      },
      detailAvailable: true,
    }),
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Edit");
    expect(frame).toContain("export const b = 2");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});
