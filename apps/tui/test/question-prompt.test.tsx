import { expect, test } from "bun:test";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { MessageChannel } from "node:worker_threads";
import { QuestionPrompt } from "../src/routes/session/question";
import { PromptRefProvider } from "../src/context/prompt";
import { ToastProvider, ToastRegion } from "../src/context/toast";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

const multiRequest = {
  kind: "question",
  id: "req_q",
  priority: 10,
  sequence: 1,
  title: "Choose options",
  questions: [
    {
      id: "first",
      header: "First",
      question: "Pick one",
      options: [{ label: "A" }, { label: "B" }],
      custom: false,
    },
    {
      id: "second",
      header: "Second",
      question: "Pick all",
      options: [{ label: "A" }, { label: "B" }],
      multiple: true,
      custom: false,
    },
  ],
} as unknown as Extract<ModalRequest, { kind: "question" }>;

const singleRequest = {
  kind: "question",
  id: "req_single",
  priority: 10,
  sequence: 1,
  title: "One question",
  questions: [
    {
      id: "q",
      header: "Single",
      question: "Pick",
      options: [{ label: "A" }, { label: "B" }],
      custom: true,
    },
  ],
} as unknown as Extract<ModalRequest, { kind: "question" }>;

async function mountQuestion(
  request: Extract<ModalRequest, { kind: "question" }>,
) {
  const setup = await createTestRenderer({ width: 100, height: 30 });
  const responses: unknown[] = [];
  const backend = {
    respondQuestion(response: unknown) {
      responses.push(response);
    },
  } as unknown as RuntimeClient;
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <ToastRegion />
          <PromptRefProvider>
            <QuestionPrompt
              request={request}
              backend={backend}
              onExit={() => {}}
            />
          </PromptRefProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
  return { setup, responses, keys, disposeKeymap };
}

async function mountQuestionWithBackend(
  request: Extract<ModalRequest, { kind: "question" }>,
  respond: (response: unknown) => Promise<unknown>,
) {
  const setup = await createTestRenderer({ width: 100, height: 30 });
  const backend = {
    respondQuestion: respond,
  } as unknown as RuntimeClient;
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <ToastRegion />
          <PromptRefProvider>
            <QuestionPrompt
              request={request}
              backend={backend}
              onExit={() => {}}
            />
          </PromptRefProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
  return { setup, keys, disposeKeymap };
}

test("a multi-question prompt renders tabs, the question and contextual hints", async () => {
  const mounted = await mountQuestion(multiRequest);
  try {
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("Pick one");
    expect(frame).toContain("First");
    expect(frame).toContain("Second");
    expect(frame).toContain("Confirm");
    expect(frame).toContain("1. A");
    expect(frame).toContain("2. B");
    expect(frame).toContain("esc dismiss");
    expect(mounted.responses).toEqual([]);
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("number keys answer single-select and confirm submits multi-select", async () => {
  const mounted = await mountQuestion(multiRequest);
  try {
    await mounted.keys.pressKey("2"); // first question: B
    await mounted.keys.pressKey("1"); // second question: toggle A
    await mounted.keys.pressArrow("down");
    await mounted.keys.pressEnter(); // second question: toggle B
    await mounted.keys.pressArrow("right"); // confirm tab
    await mounted.keys.pressEnter(); // submit
    await mounted.setup.renderOnce();
    expect(mounted.responses).toHaveLength(1);
    const response = mounted.responses[0] as { answers: string[][] };
    expect(response.answers).toEqual([["B"], ["A", "B"]]);
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a single-question prompt submits immediately on select", async () => {
  const mounted = await mountQuestion(singleRequest);
  try {
    await mounted.keys.pressEnter(); // pick A
    await mounted.setup.renderOnce();
    expect(mounted.responses).toHaveLength(1);
    const response = mounted.responses[0] as { answers: string[][] };
    expect(response.answers).toEqual([["A"]]);
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a custom answer is edited inline and submitted", async () => {
  const mounted = await mountQuestion(singleRequest);
  try {
    await mounted.keys.pressKey("3"); // Type your own answer
    await mounted.keys.typeText("my custom answer");
    await mounted.keys.pressEnter();
    await mounted.setup.renderOnce();
    expect(mounted.responses).toHaveLength(1);
    const response = mounted.responses[0] as { answers: string[][] };
    expect(response.answers).toEqual([["my custom answer"]]);
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("a single-question answer survives structured clone to the backend", async () => {
  // The rewrite reads answers out of a Solid store; its deep proxies cannot be
  // structured-cloned by postMessage (DataCloneError: The object can not be
  // cloned). The answer must reach the backend as plain data.
  const channel = new MessageChannel();
  let resolveReceived: (value: unknown) => void;
  const receivedPromise = new Promise<unknown>((resolve) => {
    resolveReceived = resolve;
  });
  channel.port2.onmessage = (event) => {
    resolveReceived(event.data);
  };
  channel.port1.start();
  channel.port2.start();
  const setup = await createTestRenderer({ width: 100, height: 30 });
  const backend = {
    respondQuestion: async (response: unknown) => {
      channel.port1.postMessage(response);
      return { accepted: true };
    },
  } as unknown as RuntimeClient;
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <ToastProvider>
          <ToastRegion />
          <PromptRefProvider>
            <QuestionPrompt
              request={singleRequest}
              backend={backend}
              onExit={() => {}}
            />
          </PromptRefProvider>
        </ToastProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
  try {
    await keys.pressEnter();
    const received = await receivedPromise;
    const answers = (received as { answers: string[][] }).answers;
    expect(answers).toEqual([["A"]]);
    expect(setup.captureCharFrame()).not.toContain("could not be delivered");
  } finally {
    disposeKeymap();
    setup.renderer.destroy();
    channel.port1.close();
    channel.port2.close();
  }
});

test("a rejected delivery surfaces as a toast instead of crashing", async () => {
  const mounted = await mountQuestionWithBackend(singleRequest, () =>
    Promise.reject(new Error("worker exited")),
  );
  try {
    await mounted.keys.pressEnter();
    await mounted.setup.renderOnce();
    const frame = mounted.setup.captureCharFrame();
    expect(frame).toContain("could not be delivered");
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});

test("escape dismisses the question without answering it", async () => {
  const mounted = await mountQuestion(singleRequest);
  try {
    await mounted.keys.pressEscape();
    await mounted.setup.renderOnce();
    expect(mounted.responses).toHaveLength(1);
    const response = mounted.responses[0] as {
      answers: string[][];
      rejected?: boolean;
    };
    expect(response.rejected).toBe(true);
    expect(response.answers).toEqual([]);
  } finally {
    mounted.disposeKeymap();
    mounted.setup.renderer.destroy();
  }
});
