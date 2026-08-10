import { expect, test } from "bun:test";
import { ContextLedger } from "@natalia/runtime";
import type {
  ProviderStreamChunk,
  ProviderToolCall,
  StreamingProvider,
} from "@natalia/runtime";
import type { RuntimeEvent } from "@natalia/contracts";
import { ToolRegistry } from "@natalia/tools";
import { createProviderRunner } from "../src/provider-runner";

function content(text: string): ProviderStreamChunk {
  return { type: "content", text };
}

function thinking(text: string): ProviderStreamChunk {
  return { type: "thinking", text };
}

function toolCall(calls: ProviderToolCall[]): ProviderStreamChunk {
  return { type: "tool_call", calls };
}

function usage(inputTokens: number, outputTokens: number): ProviderStreamChunk {
  return { type: "usage", inputTokens, outputTokens };
}

function makeHarness(provider: StreamingProvider | undefined) {
  const events: RuntimeEvent[] = [];
  const ledger = new ContextLedger();
  const checkpoints: Array<{ reason: string; step: number }> = [];
  const executedCalls: Array<{ call: ProviderToolCall }> = [];
  let activeAbort: AbortController | undefined;
  let activeTurnID: string | undefined;
  let lastUsage: { inputTokens: number; outputTokens: number } | undefined;
  const runner = createProviderRunner({
    provider: () => provider,
    session: () => undefined,
    context: () => ledger,
    tools: () => new ToolRegistry(),
    attachmentReferences: () => new Map(),
    mcpAccess: () => [],
    agentRegistry: () => undefined,
    activeAbort: () => activeAbort,
    setActiveAbort: (controller) => {
      activeAbort = controller;
    },
    activeTurnID: () => activeTurnID,
    setActiveTurnID: (id) => {
      activeTurnID = id;
    },
    selectedAgent: () => undefined,
    setSelectedAgent: () => undefined,
    pendingAgent: () => undefined,
    setPendingAgent: () => undefined,
    selectedModel: () => undefined,
    permissionMode: () => "auto",
    workspaceRoot: () => "/tmp/ws",
    tsRuntimeConfig: () => undefined,
    runtimeContextConfig: () => ({
      max: 200000,
      thresholdPercent: 85,
      reserved: 8192,
    }),
    activeSkill: () => undefined,
    skillsList: () => [],
    retryPolicy: () => ({
      maxAttemptsPerStep: 1,
      initialBackoffMs: 1,
      maxBackoffMs: 1,
      jitterMs: 0,
      maxRetryAfterMs: 1,
    }),
    lastProviderUsage: () => lastUsage,
    setLastProviderUsage: (usage) => {
      lastUsage = usage;
    },
    taskModuleContext: () => undefined,
    publish: (event) => events.push(event),
    applyAgentPolicy: () => undefined,
    applyAgentProvider: () => undefined,
    persistInboxPromotion: async () => undefined,
    createTurnCheckpoint: async (input) => {
      checkpoints.push({ reason: input.reason, step: input.step });
    },
    isToolAllowed: () => true,
    setInFlightOperation: async () => undefined,
    executeToolCalls: async (turnID, calls) => {
      for (const call of calls) executedCalls.push({ call });
      return [
        {
          role: "tool",
          toolCallID: calls[0]?.id ?? "call_1",
          toolName: calls[0]?.name ?? "read_file",
          content: "ok",
        },
      ];
    },
    reloadConfig: async () => ({ providerReconfigured: false }),
    runtimeStatusSnapshot: async () =>
      ({
        type: "diagnostic",
        level: "info",
        message: "snapshot",
      }) as RuntimeEvent,
    effectiveMaxSteps: () => 10,
    waitIfPaused: async () => undefined,
  });
  return {
    runner,
    events,
    ledger,
    checkpoints,
    executedCalls,
    abortController: () => activeAbort,
    activeTurnID: () => activeTurnID,
  };
}

const turn = {
  id: "t1",
  text: "hello",
  attachments: [],
  resources: [],
  agents: [],
};

test("a turn streams content and usage, finishes done, and clears turn state", async () => {
  const { runner, events, ledger, checkpoints, abortController, activeTurnID } =
    makeHarness({
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield thinking("reasoning…");
        yield content("hello ");
        yield content("world");
        yield usage(10, 5);
      },
    });
  await runner.runTurn(turn);
  const finished = events.find(
    (event): event is Extract<RuntimeEvent, { type: "turn.finished" }> =>
      event.type === "turn.finished",
  );
  expect(finished?.stopReason).toBe("done");
  expect(finished?.reason).toBeUndefined();
  expect(events.some((event) => event.type === "thinking.delta")).toBe(true);
  const done = events.find(
    (event): event is Extract<RuntimeEvent, { type: "content.done" }> =>
      event.type === "content.done",
  );
  expect(done?.text).toBe("hello world");
  expect(checkpoints).toEqual([{ reason: "turn_begin", step: 1 }]);
  const roles = ledger.snapshot().entries.map((entry) => entry.role);
  expect(roles).toContain("user");
  expect(roles).toContain("assistant");
  expect(events.some((event) => event.type === "context.checkpoint")).toBe(
    true,
  );
  // The finally block must release the turn-shaped state.
  expect(abortController()).toBeUndefined();
  expect(activeTurnID()).toBeUndefined();
});

test("no provider and no reconfigured reload finishes with an error diagnostic", async () => {
  const { runner, events, checkpoints } = makeHarness(undefined);
  await runner.runTurn(turn);
  const finished = events.find(
    (event): event is Extract<RuntimeEvent, { type: "turn.finished" }> =>
      event.type === "turn.finished",
  );
  expect(finished?.stopReason).toBe("error");
  expect(
    events.some(
      (event) =>
        event.type === "diagnostic" &&
        event.level === "error" &&
        event.message.includes("No real provider configured"),
    ),
  ).toBe(true);
  expect(checkpoints).toEqual([]);
});

test("tool calls execute through the callback and an empty final answer marks missing_final_response", async () => {
  let streamCalls = 0;
  const { runner, events, executedCalls } = makeHarness({
    provider: "scripted",
    model: "m1",
    async *stream() {
      streamCalls += 1;
      if (streamCalls === 1) {
        yield toolCall([
          { id: "call_1", name: "read_file", arguments: '{"path":"a"}' },
        ]);
      }
    },
  });
  await runner.runTurn(turn);
  expect(executedCalls.map((entry) => entry.call.name)).toEqual(["read_file"]);
  const finished = events.find(
    (event): event is Extract<RuntimeEvent, { type: "turn.finished" }> =>
      event.type === "turn.finished",
  );
  expect(finished?.stopReason).toBe("done");
  expect(finished?.reason).toBe("missing_final_response");
});

test("aborting the turn mid-stream finishes cancelled with a warning", async () => {
  const { runner, events, abortController } = makeHarness({
    provider: "scripted",
    model: "m1",
    async *stream(request) {
      yield content("half an answer");
      await new Promise<void>((resolve) => {
        request.signal?.addEventListener("abort", () => resolve());
      });
      throw new Error("stream aborted");
    },
  });
  const running = runner.runTurn(turn);
  await new Promise((resolve) => setTimeout(resolve, 10));
  abortController()?.abort();
  await running;
  const finished = events.find(
    (event): event is Extract<RuntimeEvent, { type: "turn.finished" }> =>
      event.type === "turn.finished",
  );
  expect(finished?.stopReason).toBe("cancelled");
  expect(
    events.some(
      (event) => event.type === "diagnostic" && event.level === "warning",
    ),
  ).toBe(true);
});
