import { expect, test } from "bun:test";
import { ContextLedger, providerError } from "@natalia/runtime";
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
import { createRetryService } from "../src/retry-service";
import { createAttachmentService } from "../src/attachment-service";
import { createCompactionService } from "../src/compaction-service";

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
    mailboxMessages?: Array<{
      messageID: string;
      intent: string;
      text: string;
      priority: string;
      source: "user_via_live_chat" | "system";
    }>;
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
    modelCapabilities: () => ({
      toolCall: true,
      reasoning: true,
      thinking: true,
      imageInput: false,
      pdfInput: false,
      videoInput: false,
    }),
    setActiveModelCapabilities: () => undefined,
    permissionMode: () => "auto",
    workspaceRoot: () => "/tmp/ws",
    tsRuntimeConfig: () => undefined,
    runtimeContextConfig: () =>
      options?.runtimeContextConfig ?? {
        max: 200000,
        thresholdPercent: 85,
        reserved: 8192,
      },
    activeSkill: () => undefined,
    skillsList: () => [],
    mailboxMessages: () => options?.mailboxMessages ?? [],
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
  const { runner, ledger } = makeHarness({
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
  });
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
  const pdf = estimateProviderMessages([
    {
      role: "user",
      content: "read it",
      pdfs: [
        {
          mediaType: "application/pdf",
          dataURL: `data:application/pdf;base64,${encoded}`,
        },
      ],
    },
  ]);

  expect(image).toBe(base + 256);
  expect(pdf).toBe(base + 256);
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

test("delivered mailbox intents render into the system prompt", async () => {
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
        yield content("acknowledged");
      },
    },
    {
      mailboxMessages: [
        {
          messageID: "mailbox:1",
          intent: "reprioritize",
          text: "focus on the docs task first",
          priority: "high",
          source: "user_via_live_chat",
        },
      ],
    },
  );
  await runner.runTurn(turn);
  expect(systemPrompt).toContain("<pending_user_intents>");
  expect(systemPrompt).toContain("[high] reprioritize");
  expect(systemPrompt).toContain("focus on the docs task first");
  expect(systemPrompt).toContain("</pending_user_intents>");
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
  expect(systemPrompt).toContain("[Navi → you]");
  expect(systemPrompt).toContain("must receive one direct collab_chat reply");
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
