import { expect, test } from "bun:test";
import {
  AnthropicProvider,
  ContextLedger,
  estimateTokens,
  providerError,
} from "@natalia/runtime";
import type {
  ProviderStreamChunk,
  ProviderStreamRequest,
  ProviderToolCall,
  StreamingProvider,
} from "@natalia/runtime";
import type { RuntimeEvent } from "@natalia/contracts";
import { ToolRegistry } from "@natalia/tools";
import {
  createProviderRunner,
  estimateProviderMessages,
} from "../src/provider-runner";
import { createRetryService } from "@natalia/retry";
import { createAttachmentService } from "@natalia/attachments";
import { createCompactionService } from "@natalia/compaction";

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

function makeHarness(
  provider: StreamingProvider | undefined,
  options?: {
    takeLiveUserMessages?: () => Array<{
      source: "user" | "navi";
      text: string;
    }>;
    takeStepInputs?: (step: number) => Array<{ id: string; text: string }>;
    hasPendingStepInputs?: () => boolean;
    isTurnAnnounced?: (id: string) => boolean;
    markTurnAnnounced?: (id: string) => void;
    naviSuggestions?: Array<{
      id: string;
      suggestion: string;
      priority: string;
      rationale?: string;
    }>;
    naviIntro?: boolean;
    naviAnswers?: Array<{ questionID: string; answer: string }>;
    naviChats?: Array<{
      id: string;
      threadID: string;
      from: "live_chat" | "main_agent";
      to: "live_chat" | "main_agent";
      text: string;
      round: number;
      expectsReply: boolean;
      status: string;
    }>;
    activePlan?: {
      planID: string;
      version: number;
      title: string;
      objective: string;
      steps: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints: string[];
      verification: string[];
      riskNotes: string[];
    };
    retryPolicy?: {
      maxAttemptsPerStep: number | null;
      initialBackoffMs: number;
      maxBackoffMs: number;
      jitterMs: number;
      maxRetryAfterMs: number;
    };
    maxSteps?: number;
    runtimeContextConfig?: {
      max: number;
      thresholdPercent: number;
      reserved: number;
    };
    preservedRecentMessages?: number;
  },
) {
  const events: RuntimeEvent[] = [];
  const ledger = new ContextLedger();
  const checkpoints: Array<{ reason: string; step: number }> = [];
  const executedCalls: Array<{ call: ProviderToolCall }> = [];
  let activeAbort: AbortController | undefined;
  let activeTurnID: string | undefined;
  let lastUsage: { inputTokens: number; outputTokens: number } | undefined;
  const retry = createRetryService({
    policy: () =>
      options?.retryPolicy ?? {
        maxAttemptsPerStep: 1,
        initialBackoffMs: 1,
        maxBackoffMs: 1,
        jitterMs: 0,
        maxRetryAfterMs: 1,
      },
  });
  const runner = createProviderRunner({
    provider: () => provider,
    session: () => undefined,
    context: () => ledger,
    tools: () => new ToolRegistry(),
    attachmentReferences: () => new Map(),
    attachments: createAttachmentService("/tmp/ws"),
    compaction: createCompactionService({ retry }),
    mcp: () => undefined,
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
    modelCapabilities: () => ({
      toolCall: true,
      reasoning: true,
      thinking: true,
      imageInput: false,
      videoInput: false,
    }),
    setActiveModelCapabilities: () => undefined,
    permissionMode: () => "auto",
    workspaceRoot: () => "/tmp/ws",
    tsRuntimeConfig: () =>
      options?.preservedRecentMessages === undefined
        ? undefined
        : ({
            version: 3,
            instructions: { enabled: true },
            defaultAgentMode: "",
            agentModes: {},
            context: {
              preservedRecentMessages: options.preservedRecentMessages,
            },
          } as unknown as import("@natalia/contracts").ConfigV3),
    runtimeContextConfig: () =>
      options?.runtimeContextConfig ?? {
        max: 200000,
        thresholdPercent: 85,
        reserved: 8192,
      },
    activeSkill: () => undefined,
    skillsList: () => [],
    takeLiveUserMessages: () => options?.takeLiveUserMessages?.() ?? [],
    takeStepInputs: (step) => options?.takeStepInputs?.(step) ?? [],
    hasPendingStepInputs: () => options?.hasPendingStepInputs?.() ?? false,
    isTurnAnnounced: (id) => options?.isTurnAnnounced?.(id) ?? false,
    markTurnAnnounced: (id) => options?.markTurnAnnounced?.(id),
    naviSuggestions: () => options?.naviSuggestions ?? [],
    naviIntro: () => options?.naviIntro ?? false,
    naviAnswers: () => options?.naviAnswers ?? [],
    naviChats: () => options?.naviChats ?? [],
    activePlan: () => options?.activePlan,
    retry,
    lastProviderUsage: () => lastUsage,
    setLastProviderUsage: (usage) => {
      lastUsage = usage;
    },
    publish: (event) => events.push(event),
    applyAgentPolicy: () => undefined,
    applyAgentProvider: () => undefined,
    persistInboxPromotion: async () => undefined,
    createTurnCheckpoint: async (input) => {
      checkpoints.push({ reason: input.reason, step: input.step });
    },
    isToolAllowed: () => true,
    setInFlightOperation: async () => undefined,
    executeToolCalls: async (
      turnID,
      calls,
      assistant,
      _materialized,
      reasoning,
    ) => {
      for (const call of calls) executedCalls.push({ call });
      return [
        {
          role: "assistant",
          content: assistant,
          ...(reasoning?.content !== undefined
            ? { reasoningContent: reasoning.content }
            : {}),
          ...(reasoning?.field ? { reasoningField: reasoning.field } : {}),
          ...(reasoning?.signature
            ? { reasoningSignature: reasoning.signature }
            : {}),
          ...(reasoning?.redacted ? { reasoningRedacted: true } : {}),
          toolCalls: calls,
        },
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
    effectiveMaxSteps: () => options?.maxSteps ?? 10,
    waitIfPaused: async () => undefined,
    waitingHuman: () => undefined,
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

test("Natalia main transcript receives Anthropic thinking without chat events", async () => {
  const provider = new AnthropicProvider({
    apiKey: "test-only",
    model: "step-3.7-flash",
    maxTokens: 4096,
    fetch: (async () =>
      new Response(
        [
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "thinking", thinking: "main " },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "reasoning" },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "content_block_start",
            index: 1,
            content_block: { type: "text", text: "" },
          },
          {
            type: "content_block_delta",
            index: 1,
            delta: { type: "text_delta", text: "main answer" },
          },
          { type: "message_delta", delta: { stop_reason: "end_turn" } },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      )) as unknown as typeof fetch,
  });
  const { runner, events } = makeHarness(provider);
  await runner.runTurn(turn);
  expect(
    events
      .filter((event) => event.type === "thinking.delta")
      .map((event) => event.text)
      .join(""),
  ).toBe("main reasoning");
  expect(events.find((event) => event.type === "content.done")?.text).toBe(
    "main answer",
  );
  expect(
    events.some(
      (event) =>
        event.type.startsWith("navi.chat.") ||
        event.type.startsWith("nia.chat."),
    ),
  ).toBe(false);
});

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

test("tool calls with an empty final answer emit a deterministic fallback", async () => {
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
  expect(streamCalls).toBe(2);
  expect(executedCalls.map((entry) => entry.call.name)).toEqual(["read_file"]);
  const finished = events.find(
    (event): event is Extract<RuntimeEvent, { type: "turn.finished" }> =>
      event.type === "turn.finished",
  );
  expect(finished?.stopReason).toBe("done");
  expect(finished?.reason).toBeUndefined();
  expect(
    events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "content.delta" }> =>
          event.type === "content.delta",
      )
      .map((event) => event.text)
      .join(""),
  ).toContain("Tool execution completed");
});

test("complete textual tool calls are normalized and executed once", async () => {
  let streamCalls = 0;
  const { runner, events, executedCalls } = makeHarness({
    provider: "scripted",
    model: "m1",
    async *stream() {
      streamCalls += 1;
      if (streamCalls === 1) {
        yield content(
          "Inspecting. <tool_call><function=read_file><parameter=path>&quot;a.txt&quot;</parameter></function></tool_call>",
        );
        return;
      }
      yield content("Finished.");
    },
  });
  await runner.runTurn(turn);
  expect(executedCalls).toEqual([
    {
      call: {
        id: "raw_xml_tool_0",
        name: "read_file",
        arguments: '{"path":"a.txt"}',
      },
    },
  ]);
  expect(
    events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "content.delta" }> =>
          event.type === "content.delta",
      )
      .map((event) => event.text),
  ).toEqual(["Inspecting. ", "Finished."]);
  expect(
    events.filter(
      (event) =>
        event.type === "diagnostic" &&
        event.message.includes("native tool calling required"),
    ),
  ).toHaveLength(0);
});

test("assistant reasoning_content is preserved for the tool-call follow-up", async () => {
  const requests: ProviderStreamRequest[] = [];
  let streamCalls = 0;
  const { runner } = makeHarness({
    provider: "scripted",
    model: "m1",
    async *stream(request) {
      streamCalls += 1;
      requests.push(request);
      if (streamCalls === 1) {
        yield thinking("deepseek reasoning");
        yield toolCall([
          {
            id: "call_1",
            name: "read_file",
            arguments: '{"path":"a.txt"}',
          },
        ]);
        return;
      }
      yield content("done");
    },
  });

  await runner.runTurn(turn);

  expect(requests).toHaveLength(2);
  const assistant = requests[1]?.messages.find(
    (message) => message.role === "assistant" && message.toolCalls?.length,
  );
  expect(assistant?.reasoningContent).toBe("deepseek reasoning");
});

test("signed thinking and tool-call thought signatures survive the tool-call follow-up", async () => {
  const requests: ProviderStreamRequest[] = [];
  let streamCalls = 0;
  const { runner } = makeHarness({
    provider: "scripted",
    model: "m1",
    async *stream(request) {
      streamCalls += 1;
      requests.push(request);
      if (streamCalls === 1) {
        yield { type: "thinking", text: "signed plan", signature: "sig-1" };
        yield toolCall([
          {
            id: "call_1",
            name: "read_file",
            arguments: '{"path":"a.txt"}',
            thoughtSignature: "tool-sig",
          },
        ]);
        return;
      }
      yield content("done");
    },
  });

  await runner.runTurn(turn);

  expect(requests).toHaveLength(2);
  const assistant = requests[1]?.messages.find(
    (message) => message.role === "assistant" && message.toolCalls?.length,
  );
  expect(assistant?.reasoningContent).toBe("signed plan");
  expect(assistant?.reasoningSignature).toBe("sig-1");
  expect(assistant?.toolCalls?.[0]?.thoughtSignature).toBe("tool-sig");
});

test("the configured final step preserves XML-like text without another request", async () => {
  let streamCalls = 0;
  const requests: ProviderStreamRequest[] = [];
  const { runner, events, executedCalls } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        streamCalls += 1;
        requests.push(request);
        if (streamCalls === 1) {
          yield toolCall([
            {
              id: "call_1",
              name: "read_file",
              arguments: '{"path":"a"}',
            },
          ]);
          return;
        }
        yield content(
          "<function=run_shell><parameter=command>git status</parameter></function>",
        );
      },
    },
    { maxSteps: 2 },
  );

  await runner.runTurn(turn);

  expect(executedCalls.map((entry) => entry.call.name)).toEqual(["read_file"]);
  expect(streamCalls).toBe(2);
  expect(requests[1]).toMatchObject({ tools: undefined, toolChoice: "none" });
  expect(
    events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "content.delta" }> =>
          event.type === "content.delta",
      )
      .map((event) => event.text),
  ).toEqual([
    "<function=run_shell><parameter=command>git status</parameter></function>",
  ]);
  expect(
    events.find(
      (event): event is Extract<RuntimeEvent, { type: "turn.finished" }> =>
        event.type === "turn.finished",
    )?.reason,
  ).toBeUndefined();
  expect(
    requests[1]?.messages.some((message) =>
      message.content.includes("MAXIMUM STEPS REACHED"),
    ),
  ).toBe(true);
});

test("structured calls on the configured final step are ignored with fallback text", async () => {
  const requests: ProviderStreamRequest[] = [];
  const { runner, events, executedCalls } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        requests.push(request);
        yield toolCall([
          { id: "call_forbidden", name: "read_file", arguments: "{}" },
        ]);
      },
    },
    { maxSteps: 1 },
  );

  await runner.runTurn(turn);

  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ tools: undefined, toolChoice: "none" });
  expect(executedCalls).toEqual([]);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" &&
        event.text.includes("Tool execution completed"),
    ),
  ).toBe(true);
});

test("malformed textual tool calls fail after bounded corrections", async () => {
  let streamCalls = 0;
  const { runner, events, executedCalls } = makeHarness({
    provider: "scripted",
    model: "m1",
    async *stream() {
      streamCalls += 1;
      yield content(
        "<tool_call><function=read_file><parameter=path>a.txt</function></tool_call>",
      );
    },
  });

  await runner.runTurn(turn);

  expect(streamCalls).toBe(3);
  expect(executedCalls).toEqual([]);
  expect(
    events.find(
      (event): event is Extract<RuntimeEvent, { type: "turn.finished" }> =>
        event.type === "turn.finished",
    )?.stopReason,
  ).toBe("error");
});

test("a hard provider finish reason fails instead of completing ready", async () => {
  const { runner, events } = makeHarness({
    provider: "scripted",
    model: "m1",
    async *stream() {
      yield content("partial response");
      yield { type: "done", finishReason: "length" };
    },
  });

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
        event.message.includes("provider stopped before completing"),
    ),
  ).toBe(true);
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

test("a retried partial stream is attempt-stamped and only successful usage commits", async () => {
  let attempts = 0;
  const { runner, events, ledger } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream() {
        attempts++;
        if (attempts === 1) {
          yield content("discarded partial");
          yield usage(90, 9);
          throw providerError({ kind: "server", message: "temporary outage" });
        }
        yield content("clean answer");
        yield usage(10, 2);
      },
    },
    {
      retryPolicy: {
        maxAttemptsPerStep: 2,
        initialBackoffMs: 1,
        maxBackoffMs: 1,
        jitterMs: 0,
        maxRetryAfterMs: 1,
      },
    },
  );
  await runner.runTurn(turn);
  expect(
    events
      .filter(
        (event): event is Extract<RuntimeEvent, { type: "content.delta" }> =>
          event.type === "content.delta",
      )
      .map((event) => ({ text: event.text, attempt: event.attempt })),
  ).toEqual([
    { text: "discarded partial", attempt: 1 },
    { text: "clean answer", attempt: 2 },
  ]);
  expect(ledger.snapshot().checkpoint).toMatchObject({
    inputTokens: 10,
    outputTokens: 2,
  });
});

test("the main agent keeps retrying transient failures until recovery", async () => {
  let attempts = 0;
  const { runner, events } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream() {
        attempts++;
        if (attempts < 6)
          throw providerError({ kind: "server", message: "temporary outage" });
        yield content("recovered after prolonged outage");
      },
    },
    {
      retryPolicy: {
        maxAttemptsPerStep: null,
        initialBackoffMs: 1,
        maxBackoffMs: 1,
        jitterMs: 0,
        maxRetryAfterMs: 1,
      },
    },
  );
  await runner.runTurn(turn);
  expect(attempts).toBe(6);
  expect(events.filter((event) => event.type === "step.retry")).toHaveLength(5);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "step.retry.cleared",
      attempts: 6,
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "turn.finished",
      stopReason: "done",
    }),
  );
});

test("context-limit recovery keeps compacted context and recovered tool results for later steps", async () => {
  let calls = 0;
  const requests: ProviderStreamRequest[] = [];
  const { runner, ledger } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        calls++;
        requests.push(request);
        if (calls === 1)
          throw providerError({ kind: "context_limit", message: "too long" });
        if (calls === 2) {
          yield content("compacted summary");
          return;
        }
        if (calls === 3) {
          yield toolCall([
            { id: "call_recovered", name: "read_file", arguments: "{}" },
          ]);
          return;
        }
        expect(
          request.messages.some(
            (message) =>
              message.role === "system" &&
              message.content.includes("compacted summary"),
          ),
        ).toBe(true);
        expect(
          request.messages.some(
            (message) =>
              message.role === "tool" &&
              message.toolCallID === "call_recovered" &&
              message.content === "ok",
          ),
        ).toBe(true);
        yield content("recovered final");
      },
    },
    { preservedRecentMessages: 0 },
  );
  for (let index = 0; index < 3; index++)
    ledger.add({
      id: `old-${index}`,
      role: index % 2 ? "assistant" : "user",
      content: `old context ${index}`,
    });
  await runner.runTurn(turn);
  expect(calls).toBe(4);
  expect(requests).toHaveLength(4);
});

test("provider steps compact proactively before dispatching an oversized request", async () => {
  const requests: ProviderStreamRequest[] = [];
  const { runner, ledger, events } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        requests.push(request);
        if (requests.length === 1) {
          yield content("preflight summary");
          return;
        }
        expect(
          request.messages.some(
            (message) =>
              message.role === "system" &&
              message.content.includes("preflight summary"),
          ),
        ).toBe(true);
        expect(
          request.messages.some(
            (message) => message.role === "user" && message.content === "hello",
          ),
        ).toBe(true);
        yield content("done");
      },
    },
    {
      runtimeContextConfig: {
        max: 100,
        thresholdPercent: 50,
        reserved: 10,
      },
      preservedRecentMessages: 0,
    },
  );
  ledger.add({
    id: "old-1",
    role: "assistant",
    content: "x".repeat(400),
    tokens: 100,
  });
  ledger.add({
    id: "old-2",
    role: "user",
    content: "older follow-up",
    tokens: 10,
  });

  await runner.runTurn(turn);

  expect(requests).toHaveLength(2);
  expect(
    events.some(
      (event) => event.type === "compaction.begin" && event.trigger === "ratio",
    ),
  ).toBe(true);
  const begin = events.find(
    (event): event is Extract<RuntimeEvent, { type: "compaction.begin" }> =>
      event.type === "compaction.begin",
  );
  expect(begin?.beforeTokens).toBeGreaterThanOrEqual(100);
  expect(events.some((event) => event.type === "context.checkpoint")).toBe(
    true,
  );
});

test("provider steps prune old oversized tool results before dispatch", async () => {
  const requests: ProviderStreamRequest[] = [];
  const { runner, ledger, events } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        requests.push(request);
        yield content("done");
      },
    },
    {
      runtimeContextConfig: {
        max: 200_000,
        thresholdPercent: 85,
        reserved: 8_192,
      },
    },
  );
  ledger.add({
    id: "call",
    role: "tool_call",
    content: "read_big {}",
    pairID: "p1",
    tokens: 10,
  });
  ledger.add({
    id: "old-big",
    role: "tool_result",
    content: "x".repeat(9_000),
    pairID: "p1",
    tokens: 2_250,
  });
  ledger.add({
    id: "recent",
    role: "assistant",
    content: "recent context",
    tokens: 10,
  });

  await runner.runTurn(turn);

  expect(requests).toHaveLength(1);
  const old = requests[0]?.messages.find((message) =>
    message.content.includes("tool result truncated for context"),
  );
  expect(old).toBeDefined();
  expect(old?.content).toContain("originalChars=9000");
  expect(events.some((event) => event.type === "compaction.begin")).toBe(false);
});

test("provider message estimates exclude binary data URLs", () => {
  const base = estimateProviderMessages([{ role: "user", content: "read it" }]);
  const encoded = "A".repeat(2_000_000);
  const image = estimateProviderMessages([
    {
      role: "user",
      content: "read it",
      images: [
        { mediaType: "image/png", dataURL: `data:image/png;base64,${encoded}` },
      ],
    },
  ]);
  expect(image).toBe(base + 256);
});

test("provider estimates price durable attachment refs by metadata, not bytes", () => {
  const base = estimateProviderMessages([{ role: "user", content: "read it" }]);
  const ref = {
    id: "att_1",
    path: ".natalia/attachments/att_1-image.png",
    filename: "image.png",
    mediaType: "image/png" as const,
    byteLength: 5_000_000,
    sha256: "a".repeat(64),
  };
  const estimate = estimateProviderMessages([
    { role: "user", content: "read it", images: [ref] },
  ]);
  expect(estimate).toBe(base + estimateTokens(JSON.stringify(ref)));
  expect(estimate).toBeLessThan(base + 256);
});

test("a turn keeps the context budget snapshotted with its active model", async () => {
  const runtimeContextConfig = {
    max: 100_000,
    thresholdPercent: 50,
    reserved: 1_000,
  };
  let calls = 0;
  const { runner, events } = makeHarness(
    {
      provider: "scripted",
      model: "model-at-turn-start",
      async *stream() {
        calls += 1;
        if (calls === 1) {
          runtimeContextConfig.max = 10;
          yield toolCall([
            { id: "call_1", name: "read_file", arguments: "{}" },
          ]);
          return;
        }
        yield content("done");
      },
    },
    { runtimeContextConfig },
  );

  await runner.runTurn(turn);

  expect(calls).toBe(2);
  expect(events.some((event) => event.type === "compaction.begin")).toBe(false);
});

test("live user messages inject as ordinary tagged user turns", async () => {
  let live = [
    { source: "user" as const, text: "[user] focus on the docs task first" },
  ];
  const seen: string[] = [];
  const { runner } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        seen.push(
          request.messages
            .filter((message) => message.role === "user")
            .map((message) => message.content)
            .join("\n"),
        );
        yield content("acknowledged");
      },
    },
    {
      takeLiveUserMessages: () => {
        const next = live;
        live = [];
        return next;
      },
    },
  );
  await runner.runTurn(turn);
  expect(seen[0]).toContain("hello");
  expect(seen[0]).toContain("[user] focus on the docs task first");
});

test("a next-step that arrives mid-turn keeps the loop alive and lands in the ledger", async () => {
  const requests: Array<Array<{ role: string; content: string }>> = [];
  let arrived = false;
  let injected = false;
  const { runner, ledger } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        requests.push(
          request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        );
        // Simulate a user submitting `next-step` while the model is answering
        // the first step.
        arrived = true;
        yield content(
          requests.length === 1 ? "first answer" : "after injection",
        );
      },
    },
    {
      takeStepInputs: (step) => {
        // Nothing was queued before step 0; the input appears at the next step.
        if (step === 0 || injected) return [];
        injected = true;
        return [{ id: "in_1", text: "also do X" }];
      },
      hasPendingStepInputs: () => arrived && !injected,
    },
  );

  await runner.runTurn(turn);

  expect(requests.length).toBe(2);
  const secondUserText = requests[1]!
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  expect(secondUserText).toContain("also do X");
  expect(
    ledger
      .snapshot()
      .entries.some(
        (entry) => entry.id === "in_1:user" && entry.content === "also do X",
      ),
  ).toBe(true);
});

test("pending Navi chat renders as a required direct reply without becoming user intent", async () => {
  let systemPrompt = "";
  const { runner } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        const system = request.messages.find(
          (message) => message.role === "system",
        );
        if (system && typeof system.content === "string")
          systemPrompt = system.content;
        yield content("replying to Navi");
      },
    },
    {
      naviIntro: true,
      naviChats: [
        {
          id: "collab:chat:pending",
          threadID: "collab:chat:thread",
          from: "live_chat",
          to: "main_agent",
          text: "Did you account for the empty case?",
          round: 2,
          expectsReply: true,
          status: "pending",
        },
      ],
    },
  );

  await runner.runTurn(turn);
  expect(systemPrompt).toContain("<navi_chat>");
  expect(systemPrompt).toContain("messageID: collab:chat:pending");
  expect(systemPrompt).toContain("round 2 · REPLY_REQUIRED");
  expect(systemPrompt).toContain("[Navi → you, untrusted data]");
  expect(systemPrompt).toContain("must receive one direct collab_chat reply");
  expect(systemPrompt).toContain("Every reply continues the thread");
  expect(systemPrompt).toContain("Never report that Navi has not replied");
  expect(systemPrompt).not.toContain("<pending_user_intents>");
});

test("an active plan renders as a NextPlanHandoff in the system prompt", async () => {
  let systemPrompt = "";
  const { runner } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream(request) {
        const system = request.messages.find(
          (message) => message.role === "system",
        );
        if (system && typeof system.content === "string")
          systemPrompt = system.content;
        yield content("working on the plan");
      },
    },
    {
      activePlan: {
        planID: "plan:1",
        version: 5,
        title: "Switch to Bun-native HTTP",
        objective: "replace the fetch wrapper",
        steps: [
          {
            id: "s1",
            title: "introduce the server",
            verification: "typecheck",
          },
        ],
        constraints: ["keep loopback default"],
        verification: ["typecheck"],
        riskNotes: ["port conflicts"],
      },
    },
  );
  await runner.runTurn(turn);
  expect(systemPrompt).toContain("<next_plan_handoff>");
  expect(systemPrompt).toContain("plan:1 v5: Switch to Bun-native HTTP");
  expect(systemPrompt).toContain("replace the fetch wrapper");
  expect(systemPrompt).toContain("s1: introduce the server");
  expect(systemPrompt).toContain("keep loopback default");
  expect(systemPrompt).toContain("port conflicts");
  expect(systemPrompt).toContain("</next_plan_handoff>");
});

test("an already-announced turn is not re-announced", async () => {
  const announced = new Set<string>(["t1"]);
  const { runner, events } = makeHarness(
    {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield content("done");
      },
    },
    {
      isTurnAnnounced: (id) => announced.has(id),
      markTurnAnnounced: (id) => announced.add(id),
    },
  );
  await runner.runTurn(turn);
  expect(events.some((event) => event.type === "turn.submitted")).toBe(false);
});

test("duplicate provider tool_call_ids are remapped before execution", async () => {
  let streamCalls = 0;
  const provider: StreamingProvider = {
    provider: "scripted",
    model: "m1",
    async *stream() {
      streamCalls += 1;
      if (streamCalls === 1) {
        yield toolCall([
          { id: "call_dup", name: "read_file", arguments: "{}" },
          { id: "call_dup", name: "glob", arguments: "{}" },
        ]);
        return;
      }
      yield content("done");
    },
  };
  const { runner, events, executedCalls } = makeHarness(provider, {
    maxSteps: 4,
  });

  await runner.runTurn(turn);

  expect(executedCalls.map(({ call }) => call.id)).toEqual([
    "call_dup",
    "call_dup#1",
  ]);
  expect(
    events.some(
      (event) =>
        event.type === "diagnostic" &&
        event.message.includes("duplicate tool_call_id"),
    ),
  ).toBe(true);
});
