import { expect, test } from "bun:test";
import {
  createMockKeys,
  createMockMouse,
  createTestRenderer,
} from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmitInput,
  SubmittedTurn,
} from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { App } from "../src/app/App";
import { ClipboardProvider } from "../src/context/clipboard";
import { ToastProvider } from "../src/context/toast";
import { RuntimeProvider } from "../src/context/runtime";
import { PromptRefProvider } from "../src/context/prompt";
import { KeybindProvider } from "../src/context/keybind";
import { RouteProvider } from "../src/context/route";
import { ThemeProvider } from "../src/context/theme";
import { LocalProvider } from "../src/context/local";
import { registerNataliaKeymap } from "../src/modal/mode-stack";
import { compactPath } from "../src/routes/session/tool-utils";

function submitted(
  id: string,
  text: string,
  delivery?: "steer" | "queue",
): SubmittedTurn {
  return {
    type: "turn.submitted",
    id,
    text,
    byteLength: Buffer.byteLength(text),
    lineCount: lineCount(text),
    sha256: makeDigest(text),
    delivery,
  };
}

function controlledBackend() {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let releaseFirst!: () => void;
  let cancelled = false;
  const firstDone = new Promise<void>((resolve) => (releaseFirst = resolve));
  const submissions: string[] = [];
  const queued: SubmitInput[] = [];
  let cancellations = 0;

  const backend = {
    start(onEvent: (event: RuntimeEvent) => void) {
      sink = onEvent;
      sink({
        type: "session.created",
        sessionID: "ses_composer" as never,
        title: "Composer controls",
      });
      sink({ type: "session.ready", sessionID: "ses_composer" as never });
    },
    async submit(text: string) {
      submissions.push(text);
      const event = submitted("turn_active", text);
      sink?.(event);
      await firstDone;
      if (!cancelled)
        sink?.({ type: "turn.finished", id: event.id, stopReason: "done" });
      return event;
    },
    async submitInput(input: SubmitInput) {
      queued.push(input);
      const event = submitted(
        `turn_queue_${queued.length}`,
        input.text,
        input.delivery,
      );
      sink?.(event);
      return event;
    },
    cancel() {
      cancellations += 1;
      cancelled = true;
      sink?.({
        type: "turn.cancelled",
        id: "turn_active",
        reason: "composer stop",
      });
      releaseFirst();
    },
    respondQuestion() {
      return { accepted: true };
    },
    respondApproval() {
      return { accepted: true };
    },
    snapshot() {
      return { type: "snapshot.created", id: "snapshot", files: [] } as const;
    },
    diagnostic() {},
    lastSubmission() {
      return undefined;
    },
  } as RuntimeClient;

  return {
    backend,
    submissions,
    queued,
    cancellations: () => cancellations,
    emit(event: RuntimeEvent) {
      sink?.(event);
    },
    finish() {
      releaseFirst();
      for (let index = 1; index <= queued.length; index++)
        sink?.({
          type: "turn.finished",
          id: `turn_queue_${index}`,
          stopReason: "done",
        });
    },
  };
}

async function mountComposer(
  appProps: Partial<Parameters<typeof App>[0]> = {},
  size = { width: 120, height: 30 },
) {
  const setup = await createTestRenderer(size);
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  const controls = controlledBackend();
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ClipboardProvider>
          <ToastProvider>
            <RuntimeProvider>
              <PromptRefProvider>
                <KeybindProvider>
                  <RouteProvider>
                    <ThemeProvider>
                      <LocalProvider>
                        <App backend={controls.backend} {...appProps} />
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
    controls,
    keys: createMockKeys(setup.renderer, { kittyKeyboard: true }),
    mouse: createMockMouse(setup.renderer),
    disposeKeymap,
  };
}

function labelPosition(frame: string, label: string) {
  const lines = frame.split("\n");
  const y = lines.findIndex((line) => line.includes(label));
  if (y < 0) throw new Error(`label not found: ${label}`);
  return { x: lines[y]!.indexOf(label) + 2, y };
}

test("the composer button sends while idle and stops active work", async () => {
  const mounted = await mountComposer();
  try {
    expect(mounted.setup.captureCharFrame()).toContain("↑ Send");
    await mounted.keys.typeText("start from the button");
    await mounted.setup.renderOnce();
    const send = labelPosition(mounted.setup.captureCharFrame(), "↑ Send");
    await mounted.mouse.click(send.x, send.y);
    await Bun.sleep(130);
    await mounted.setup.renderOnce();

    expect(mounted.controls.submissions).toEqual(["start from the button"]);
    expect(mounted.setup.captureCharFrame()).toContain("■ Stop");

    await Bun.sleep(360);
    const stop = labelPosition(mounted.setup.captureCharFrame(), "■ Stop");
    await mounted.mouse.click(stop.x, stop.y);
    await Bun.sleep(20);
    expect(mounted.controls.cancellations()).toBe(1);
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("the composer keeps high-frequency configuration controls beside the prompt", async () => {
  const mounted = await mountComposer();
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Ask ▼");
    expect(frame).toContain("not-connected ▼");
    expect(frame).toContain("Default ▼");
    expect(frame).not.toContain("provider not selected");
    expect(frame).not.toContain("commands ·");
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("the composer keeps model and reasoning controls in its narrow bottom toolbar", async () => {
  const mounted = await mountComposer({}, { width: 32, height: 24 });
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Ask");
    expect(frame).toContain("not-...");
    expect(frame).toContain("D...");
    expect(frame).toContain("↑ Send");
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("an active approval replaces the main composer with the decision dock", async () => {
  const mounted = await mountComposer();
  try {
    mounted.controls.emit({
      type: "approval.request",
      id: "approval-composer",
      title: "Read the workspace",
      preview: "src/app.tsx",
    });
    await Bun.sleep(40);
    await mounted.setup.renderOnce();

    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Allow session");
    expect(frame).toContain("Waiting for approval");
    expect(frame).not.toContain("Ask anything...");
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("resolving an approval restores the draft and composer focus", async () => {
  const mounted = await mountComposer();
  try {
    await mounted.keys.typeText("draft before approval");
    mounted.controls.emit({
      type: "approval.request",
      id: "approval-focus",
      title: "Read the workspace",
      preview: "src/app.tsx",
    });
    await Bun.sleep(40);
    await mounted.keys.pressKey("1");
    mounted.controls.emit({
      type: "approval.response",
      id: "approval-focus",
      decision: "once",
    });
    await Bun.sleep(40);
    await mounted.setup.renderOnce();

    expect(mounted.setup.captureCharFrame()).toContain("draft before approval");
    await mounted.keys.typeText(" continued");
    mounted.keys.pressEnter();
    await Bun.sleep(30);
    expect(mounted.controls.submissions).toEqual([
      "draft before approval continued",
    ]);
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("resolving a question restores the draft and composer focus", async () => {
  const mounted = await mountComposer();
  try {
    await mounted.keys.typeText("draft before question");
    mounted.controls.emit({
      type: "question.request",
      id: "question-focus",
      title: "Which target?",
      questions: [
        {
          id: "target",
          question: "Which target?",
          header: "Target",
          options: [{ label: "Web", description: "Web target" }],
        },
      ],
    });
    await Bun.sleep(40);
    mounted.keys.pressEnter();
    mounted.controls.emit({
      type: "question.response",
      id: "question-focus",
      answers: [["Web"]],
    });
    await Bun.sleep(40);
    await mounted.setup.renderOnce();

    expect(mounted.setup.captureCharFrame()).toContain("draft before question");
    await mounted.keys.typeText(" continued");
    mounted.keys.pressEnter();
    await Bun.sleep(30);
    expect(mounted.controls.submissions).toEqual([
      "draft before question continued",
    ]);
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("clicking the footer path opens the workspace switcher", async () => {
  const root = process.cwd();
  const switched: string[] = [];
  const replacement = controlledBackend();
  const mounted = await mountComposer({
    workspaceRoot: root,
    createBackend: () => replacement.backend,
    onWorkspaceRootChange: (root) => switched.push(root),
  });
  try {
    const path = labelPosition(
      mounted.setup.captureCharFrame(),
      `${compactPath(root)} ▼`,
    );
    await mounted.mouse.click(path.x, path.y);
    await Bun.sleep(20);
    await mounted.setup.renderOnce();

    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Switch Workspace");
    expect(frame.replace(/\s/gu, "")).toContain(root);
    expect(switched).toEqual([]);

    mounted.keys.pressEnter();
    await Bun.sleep(50);
    expect(switched).toEqual([root]);
  } finally {
    mounted.controls.finish();
    replacement.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a double click sends once without cancelling the new turn", async () => {
  const mounted = await mountComposer();
  try {
    await mounted.keys.typeText("send once");
    await mounted.setup.renderOnce();
    const send = labelPosition(mounted.setup.captureCharFrame(), "↑ Send");
    await mounted.mouse.doubleClick(send.x, send.y);
    await Bun.sleep(130);

    expect(mounted.controls.submissions).toEqual(["send once"]);
    expect(mounted.controls.cancellations()).toBe(0);
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a slower second click does not stop the turn it just sent", async () => {
  const mounted = await mountComposer();
  try {
    await mounted.keys.typeText("keep running");
    await mounted.setup.renderOnce();
    const send = labelPosition(mounted.setup.captureCharFrame(), "↑ Send");
    await mounted.mouse.click(send.x, send.y);
    await Bun.sleep(130);
    await mounted.mouse.click(send.x, send.y);
    await Bun.sleep(30);

    expect(mounted.controls.submissions).toEqual(["keep running"]);
    expect(mounted.controls.cancellations()).toBe(0);
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("Enter queues another prompt while the current turn is active", async () => {
  const mounted = await mountComposer();
  try {
    await mounted.keys.typeText("first turn");
    mounted.keys.pressEnter();
    await Bun.sleep(30);
    await mounted.setup.renderOnce();
    expect(mounted.setup.captureCharFrame()).toContain(
      "Type the next message and press Enter to queue...",
    );

    await mounted.keys.typeText("next turn");
    mounted.keys.pressEnter();
    await Bun.sleep(30);

    expect(mounted.controls.queued).toEqual([
      expect.objectContaining({ text: "next turn", delivery: "queue" }),
    ]);
    await mounted.setup.renderOnce();
    expect(mounted.setup.captureCharFrame()).toContain("QUEUED");
    expect(mounted.setup.captureCharFrame()).toContain("■ Stop");
  } finally {
    mounted.controls.finish();
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});
