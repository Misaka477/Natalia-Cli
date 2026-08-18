import { expect, test } from "bun:test";
import { For } from "solid-js";
import { createMockMouse, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { MessageBlock } from "../src/context/state";
import { MessageBlockView } from "../src/routes/session/message-rows";
import { DialogProvider } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";
import { RouteProvider } from "../src/context/route";

async function mountBlock(
  block: MessageBlock,
  toolDetails: "collapsed" | "expanded" = "collapsed",
  reasoning: "step" | "hidden" = "step",
  actions: {
    onCopy?: (text: string) => void;
    onFork?: (turnID: string, prompt: string) => void;
  } = {},
) {
  const setup = await createTestRenderer({ width: 120, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <RouteProvider>
          <DialogProvider>
            <MessageBlockView
              block={block}
              density="comfortable"
              toolDetails={toolDetails}
              reasoning={reasoning}
              diffStyle="auto"
              terminalWidth={120}
              toolPreviewLines={10}
              onCopy={actions.onCopy ?? (() => {})}
              onFork={actions.onFork ?? (() => {})}
            />
          </DialogProvider>
        </RouteProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  return {
    setup,
    disposeKeymap,
    mouse: createMockMouse(setup.renderer),
  };
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

test("a user message reveals its actions on click instead of hover", async () => {
  const copied: string[] = [];
  const forked: Array<[string, string]> = [];
  const mounted = await mountBlock(userBlock, "collapsed", "step", {
    onCopy: (text) => copied.push(text),
    onFork: (turnID, prompt) => forked.push([turnID, prompt]),
  });
  try {
    let frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("please switch the server to Bun-native HTTP");
    expect(frame).not.toContain("▎You");
    expect(frame).not.toContain("copy");

    await mounted.mouse.moveTo(4, 2);
    await mounted.setup.renderOnce();
    expect(mounted.setup.captureCharFrame()).not.toContain("copy");

    await mounted.mouse.click(4, 2);
    await mounted.setup.renderOnce();
    frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("copy");
    expect(frame).toContain("fork");

    const lines = frame.split("\n");
    const actionLine = lines.findIndex(
      (line) => line.includes("copy") && line.includes("fork"),
    );
    expect(actionLine).toBeGreaterThanOrEqual(0);
    await mounted.mouse.click(lines[actionLine]!.indexOf("copy"), actionLine);
    await mounted.setup.renderOnce();
    expect(copied).toEqual([userBlock.text]);
    expect(mounted.setup.captureCharFrame()).toContain("copy");

    await mounted.mouse.click(lines[actionLine]!.indexOf("fork"), actionLine);
    await mounted.setup.renderOnce();
    expect(forked).toEqual([[userBlock.id, userBlock.text]]);

    await mounted.mouse.click(4, 2);
    await mounted.setup.renderOnce();
    expect(mounted.setup.captureCharFrame()).not.toContain("copy");
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

test("a thinking row shows its reasoning until collapsed", async () => {
  const mounted = await mountBlock(thinkingBlock);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Thought");
    expect(frame).toContain("transport swap");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a thinking row collapses to one line when reasoning is hidden", async () => {
  const mounted = await mountBlock(thinkingBlock, "collapsed", "hidden");
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

const shellBlock = (
  status: "succeeded" | "failed",
  detail: string,
): MessageBlock => ({
  id: "tool:shell:call_1",
  role: "tool",
  text: "shell:run_shell command=npm test · shell exited",
  owner: "projection",
  tool: {
    id: "tool:shell:call_1",
    name: "run_shell",
    kind: "shell",
    status,
    summary:
      status === "succeeded" ? "shell exited with code 0" : "command failed",
    argumentsRaw: '{"command":"npm test"}',
    argumentsComplete: true,
    keyArguments: ["command=npm test"],
    redactedArguments: '{"command":"npm test"}',
    elapsed: "2.1s",
    result: {
      summary: status === "succeeded" ? "shell exited with code 0" : "failed",
      preview: detail.slice(0, 80),
      detail,
      truncated: false,
      totalChars: detail.length,
      totalLines: detail.split("\n").length,
    },
    metadata: {},
    detailAvailable: true,
  },
});

async function mountColumn(blocks: MessageBlock[]) {
  const setup = await createTestRenderer({ width: 120, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <box flexDirection="column">
            <For each={blocks}>
              {(block) => (
                <MessageBlockView
                  block={block}
                  density="comfortable"
                  toolDetails="collapsed"
                  reasoning="step"
                  diffStyle="auto"
                  terminalWidth={120}
                  toolPreviewLines={10}
                  onCopy={() => {}}
                  onFork={() => {}}
                />
              )}
            </For>
          </box>
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  return { setup, disposeKeymap };
}

function lineIndex(frame: string, needle: string) {
  return frame.split("\n").findIndex((line) => line.includes(needle));
}

function expectClosedCard(frame: string, needle: string) {
  const lines = frame.split("\n");
  const contentLine = lineIndex(frame, needle);
  expect(contentLine).toBeGreaterThan(0);
  expect(lines[contentLine]?.indexOf("│")).toBe(3);
  expect(
    lines
      .slice(0, contentLine)
      .some((line) => line.includes("┌") && line.includes("┐")),
  ).toBe(true);
  expect(
    lines
      .slice(contentLine + 1)
      .some((line) => line.includes("└") && line.includes("┘")),
  ).toBe(true);
}

test("a completed shell separates its command from its output", async () => {
  const mounted = await mountBlock(
    shellBlock("succeeded", "1 passing\n2 passing"),
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("npm test");
    expect(frame).toContain("1 passing");
    expect(lineIndex(frame, "1 passing")).toBeGreaterThan(
      lineIndex(frame, "$ npm test"),
    );
    expectClosedCard(frame, "$ npm test");
    expect(frame).not.toContain("ShellSpinner");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a completed shell shows its output block when details are expanded", async () => {
  const mounted = await mountBlock(
    shellBlock("succeeded", "1 passing\n2 passing"),
    "expanded",
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("npm test");
    expect(frame).toContain("1 passing");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("an overflowing shell preview exposes expansion without opening by default", async () => {
  const mounted = await mountBlock(
    shellBlock(
      "succeeded",
      Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n"),
    ),
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("$ npm test");
    expect(frame).toContain("line 1");
    expect(frame).not.toContain("line 12");
    expect(frame).toContain("Click to expand");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a compact grep row keeps its query, result count, and elapsed metadata", async () => {
  const mounted = await mountBlock(
    toolBlock({
      name: "grep",
      kind: "grep",
      keyArguments: ["pattern=TODO"],
      redactedArguments: '{"pattern":"TODO","include":"*.ts"}',
      result: {
        summary: "2 matches",
        preview: "src/a.ts:1\nsrc/b.ts:2",
        detail: "src/a.ts:1\nsrc/b.ts:2",
        truncated: false,
        totalChars: 22,
        totalLines: 2,
      },
    }),
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain('Grep "TODO" in *.ts');
    expect(frame).toContain("2 matches");
    expect(frame).toContain("1.2s");
    expectClosedCard(frame, 'Grep "TODO" in *.ts');
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a failed shell keeps its block even when details are collapsed", async () => {
  const mounted = await mountBlock(
    shellBlock("failed", "SyntaxError: unexpected token"),
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("SyntaxError");
    expect(frame).not.toContain("✓");
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

test("an execute tool renders child calls inside its text row", async () => {
  const mounted = await mountBlock(
    toolBlock({
      name: "execute",
      kind: "execute",
      metadata: {
        toolCalls: [
          {
            tool: "grep",
            status: "completed",
            input: { pattern: "sessionID" },
          },
          {
            tool: "read_file",
            status: "error",
            input: { path: "src/runtime.ts" },
          },
        ],
      },
    }),
  );
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("execute");
    expect(frame).toContain("↳ grep [pattern=sessionID]");
    expect(frame).toContain("↳ read_file [path=src/runtime.ts] (failed)");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("consecutive tools render as separate closed cards", async () => {
  const mounted = await mountColumn([
    toolBlock({ keyArguments: ["objective=alpha"] }),
    toolBlock({ keyArguments: ["objective=beta"] }),
  ]);
  try {
    const frame = mounted.setup.captureCharFrame();
    const firstLine = lineIndex(frame, "objective=alpha");
    const secondLine = lineIndex(frame, "objective=beta");
    expect(firstLine).toBeGreaterThanOrEqual(0);
    expect(secondLine).toBeGreaterThan(firstLine + 1);
    expectClosedCard(frame, "objective=alpha");
    expectClosedCard(frame, "objective=beta");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});
