import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import { defaultConfigV3 } from "@natalia/config";
import { ContextLedger } from "@natalia/runtime";
import type { ProviderChatTurnInput } from "@natalia/runtime-services";
import type {
  RuntimeContext,
  SessionExecutionState,
} from "../src/runtime/context";
import { createNaviChatTurn } from "../src/runtime/collaboration/chat-turn-navi";
import { createNiaChatTurn } from "../src/runtime/collaboration/chat-turn-nia";
import { createCollaborationWake } from "../src/runtime/collaboration/wake";

test("Nia normal and Navi expert resolve independent adapters, models and thinking on submit and wake", async () => {
  const config = defaultConfigV3();
  for (const [id, driver, model] of [
    ["qifengstep", "anthropic-compatible", "step-3.7-flash"],
    ["grok", "openai-compatible", "grok-4.6"],
    ["expert", "openai-compatible", "expert-model"],
  ] as const) {
    config.providers[id] = {
      name: id,
      driver,
      enabled: true,
      connection: { apiKey: "test-only", baseURL: `https://${id}.invalid/v1` },
      requestDefaults: { stream: true, headers: {}, options: {} },
    };
    config.catalog.providers[id] = {
      models: {
        [model]: {
          name: model,
          status: "stable",
          source: "manual",
          capabilities: {
            toolCall: true,
            reasoning: true,
            thinking: true,
            imageInput: false,
            videoInput: false,
          },
          limits: { contextWindow: 32768, maxOutputTokens: 16384 },
        },
      },
    };
    config.modelOverrides[`${id}/${model}`] = {
      enabled: true,
      name: model,
      requestDefaults: { temperature: null, topP: null, thinkingEnabled: true },
      requestOptions: {},
      headers: {},
    };
  }
  config.defaultModel = { provider: "qifengstep", model: "step-3.7-flash" };
  const events: RuntimeEvent[] = [];
  const exec = {
    session: { id: "ses_model_streams", events },
    naviChatLedger: new ContextLedger(),
    niaChatLedger: new ContextLedger(),
    naviPendingQueue: [],
    niaPendingQueue: [],
    naviChatModelProfile: {
      normal: { modelID: "expert/expert-model", reasoningEffort: "low" },
      expert: {
        modelID: "expert/expert-model",
        variant: "expert-variant",
        reasoningEffort: "xhigh",
      },
    },
    niaChatModelProfile: {
      normal: {
        modelID: "grok/grok-4.6",
        variant: "nia-variant",
        reasoningEffort: "high",
      },
    },
    provider: {
      async *stream() {
        throw new Error("main provider must not serve chat");
      },
    },
  } as unknown as SessionExecutionState;
  let sequence = 0;
  const ctx = {
    ports: {
      getTsRuntimeConfig: () => config,
      getChatDefaultProvider: () => undefined,
      providerFromEnvironment: () => undefined,
      publishForSession: (_: unknown, event: RuntimeEvent) => {
        events.push(event);
      },
      nextChatSequence: () => sequence++,
      naviChatPersona: () => "Navi only",
      naviChatLiveContext: () => "",
      niaChatPersona: () => "Nia only",
      niaChatLiveContext: () => "",
      naviChatTools: () => [],
      niaChatTools: () => [],
      effectiveMaxSteps: () => 1,
      redactToolOutput: (text: string) => text,
      getWorkspaceRoot: () => "/tmp/kilo",
    },
  } as unknown as RuntimeContext;
  const navi = createNaviChatTurn(ctx);
  const nia = createNiaChatTurn(ctx);
  const wakeInputs: ProviderChatTurnInput[] = [];
  ctx.ports.resolveService = (() => ({
    runNaviChatTurn: async (input: ProviderChatTurnInput) => {
      wakeInputs.push(input);
      await navi.runNaviChatTurn(
        { ...input, exec },
        new AbortController().signal,
      );
    },
    runNiaChatTurn: async (input: ProviderChatTurnInput) => {
      wakeInputs.push(input);
      await nia.runNiaChatTurn(
        { ...input, exec },
        new AbortController().signal,
      );
    },
  })) as typeof ctx.ports.resolveService;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async (url: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      requests.push({ url: String(url), body });
      const sse = String(url).endsWith("/messages")
        ? [
            {
              type: "content_block_delta",
              delta: { type: "thinking_delta", thinking: "step thinking" },
            },
            {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "step answer" },
            },
            { type: "message_delta", delta: { stop_reason: "end_turn" } },
          ]
        : [
            { choices: [{ delta: { reasoning_content: "grok thinking" } }] },
            {
              choices: [
                { delta: { content: "grok answer" }, finish_reason: "stop" },
              ],
            },
          ];
      return new Response(
        sse.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      );
    },
    { preconnect: originalFetch.preconnect },
  ) as typeof fetch;
  try {
    await nia.runNiaChatTurn(
      { exec, text: "audit", responseMessageID: "nia-submit" },
      new AbortController().signal,
    );
    expect(requests[0]).toMatchObject({
      url: "https://grok.invalid/v1/chat/completions",
      body: { model: "grok-4.6", reasoning_effort: "high" },
    });
    const wake = createCollaborationWake(ctx);
    await wake.wakeNia(exec);
    expect(requests[1]).toMatchObject({
      url: "https://grok.invalid/v1/chat/completions",
      body: { model: "grok-4.6", reasoning_effort: "high" },
    });
    expect(wakeInputs[0]).toMatchObject({
      model: { modelID: "grok/grok-4.6", variant: "nia-variant" },
      reasoningEffort: "high",
    });
    exec.advisorPending = true;
    await wake.wakeNavi(exec);
    expect(requests[2]).toMatchObject({
      url: "https://expert.invalid/v1/chat/completions",
      body: { model: "expert-model", reasoning_effort: "xhigh" },
    });
    expect(wakeInputs[1]).toMatchObject({
      model: { modelID: "expert/expert-model", variant: "expert-variant" },
      reasoningEffort: "xhigh",
    });
    expect(exec.advisorPending).toBe(false);
    exec.niaChatModelProfile = { normal: { reasoningEffort: "high" } };
    await nia.runNiaChatTurn(
      { exec, text: "default", responseMessageID: "nia-default" },
      new AbortController().signal,
    );
    expect(requests[3]).toMatchObject({
      url: "https://qifengstep.invalid/v1/messages",
      body: {
        model: "step-3.7-flash",
        thinking: { type: "enabled", budget_tokens: 8192 },
      },
    });
    expect(
      events.filter((event) => event.type === "nia.chat.thinking.done"),
    ).toHaveLength(3);
    expect(
      events.filter((event) => event.type === "navi.chat.thinking.done"),
    ).toHaveLength(1);
    expect(events.some((event) => event.type === "thinking.delta")).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
