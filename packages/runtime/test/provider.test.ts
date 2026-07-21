import { expect, test } from "bun:test";
import {
  AnthropicProvider,
  contextEntriesToProviderMessages,
  GeminiProvider,
  OpenAICompatibleProvider,
} from "../src/provider";

test("OpenAI-compatible provider accepts both base and complete chat endpoint URLs", async () => {
  const requested: string[] = [];
  const fetchImpl = Object.assign(
    async (input: URL | RequestInfo) => {
      requested.push(String(input));
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  for (const baseURL of [
    "https://gateway.example/v1",
    "https://gateway.example/v1/chat/completions",
  ]) {
    const provider = new OpenAICompatibleProvider({
      apiKey: "test-key",
      model: "test-model",
      baseURL,
      fetch: fetchImpl,
    });
    for await (const _chunk of provider.stream({ messages: [] })) {
      // Drain the stream to force the request.
    }
  }
  expect(requested).toEqual([
    "https://gateway.example/v1/chat/completions",
    "https://gateway.example/v1/chat/completions",
  ]);
});

test("OpenAI-compatible provider preserves content and usage from the same SSE frame", async () => {
  const fetchImpl = Object.assign(
    async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"content":"hello","reasoning_content":"think"}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        { headers: { "content-type": "text/event-stream" } },
      ),
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  const provider = new OpenAICompatibleProvider({
    apiKey: "test-key",
    model: "test-model",
    fetch: fetchImpl,
  });
  const chunks = [];
  for await (const chunk of provider.stream({ messages: [] }))
    chunks.push(chunk);
  expect(chunks).toEqual(
    expect.arrayContaining([
      { type: "usage", inputTokens: 3, outputTokens: 2 },
      { type: "thinking", text: "think" },
      { type: "content", text: "hello" },
    ]),
  );
});

test("OpenAI-compatible provider sends active profile request parameters safely", async () => {
  let headers: Headers | undefined;
  let body: Record<string, unknown> | undefined;
  const fetchImpl = Object.assign(
    async (_input: URL | RequestInfo, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  const provider = new OpenAICompatibleProvider({
    apiKey: "test-key",
    model: "test-model",
    authHeader: "x-provider-key",
    customHeaders: { "x-request-source": "natalia" },
    temperature: 0.2,
    maxTokens: 4096,
    topP: 0.9,
    reasoningEffort: "high",
    thinkingEnabled: true,
    fetch: fetchImpl,
  });
  for await (const _chunk of provider.stream({ messages: [] })) {
    // Drain the stream to force the request.
  }
  expect(headers?.get("x-provider-key")).toBe("Bearer test-key");
  expect(headers?.get("x-request-source")).toBe("natalia");
  expect(body).toMatchObject({
    temperature: 0.2,
    max_tokens: 4096,
    top_p: 0.9,
    reasoning_effort: "high",
    thinking_enabled: true,
  });
});

test("durable tool result context preserves its tool_call_id for the next turn", () => {
  const messages = contextEntriesToProviderMessages([
    {
      id: "call_1",
      role: "tool_call",
      content: 'read_file {"path":"hello.txt"}',
      pairID: "provider_call_1",
    },
    {
      id: "result_1",
      role: "tool_result",
      content: "hello",
      pairID: "provider_call_1",
    },
  ]);
  expect(messages).toEqual([
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "provider_call_1",
          name: "read_file",
          arguments: '{"path":"hello.txt"}',
        },
      ],
    },
    { role: "tool", toolCallID: "provider_call_1", content: "hello" },
  ]);
});

test("Anthropic provider streams text usage and tool calls", async () => {
  let body: Record<string, unknown> | undefined;
  const fetchImpl = Object.assign(
    async (_input: URL | RequestInfo, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        [
          'data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"tool_1","name":"read_file"}}',
          "",
          'data: {"type":"input_json_delta","delta":{"partial_json":"{\\\"path\\\":\\\"a.txt\\\"}"}}',
          "",
          'data: {"type":"content_block_delta","delta":{"text":"hello"}}',
          "",
          'data: {"type":"message_delta","usage":{"input_tokens":5,"output_tokens":7}}',
          "",
        ].join("\n"),
        { headers: { "content-type": "text/event-stream" } },
      );
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  const provider = new AnthropicProvider({
    apiKey: "test-key",
    model: "claude-test",
    fetch: fetchImpl,
  });
  const chunks = [];
  for await (const chunk of provider.stream({
    messages: [{ role: "user", content: "hi" }],
    tools: [{ name: "read_file", description: "read", parameters: {} }],
  }))
    chunks.push(chunk);
  expect(body?.["tools"]).toEqual([
    { name: "read_file", description: "read", input_schema: {} },
  ]);
  expect(chunks).toEqual(
    expect.arrayContaining([
      { type: "content", text: "hello" },
      { type: "usage", inputTokens: 5, outputTokens: 7 },
      {
        type: "tool_call",
        calls: [
          { id: "tool_1", name: "read_file", arguments: '{"path":"a.txt"}' },
        ],
      },
    ]),
  );
});

test("Gemini provider maps SSE content function calls and usage without placing its key in the URL", async () => {
  let requested: string | undefined;
  let headers: Headers | undefined;
  const fetchImpl = Object.assign(
    async (input: URL | RequestInfo, init?: RequestInit) => {
      requested = String(input);
      headers = new Headers(init?.headers);
      return new Response(
        [
          'data: {"candidates":[{"content":{"parts":[{"text":"hi"},{"functionCall":{"name":"glob","args":{"pattern":"**/*.ts"}}}]}}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":3}}',
          "",
        ].join("\n"),
        { headers: { "content-type": "text/event-stream" } },
      );
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  const provider = new GeminiProvider({
    apiKey: "test-key",
    model: "gemini-test",
    fetch: fetchImpl,
  });
  const chunks = [];
  for await (const chunk of provider.stream({
    messages: [{ role: "user", content: "hi" }],
  }))
    chunks.push(chunk);
  expect(requested).toBe(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse",
  );
  expect(headers?.get("x-goog-api-key")).toBe("test-key");
  expect(chunks).toEqual(
    expect.arrayContaining([
      { type: "content", text: "hi" },
      {
        type: "tool_call",
        calls: [
          { id: "gemini_0", name: "glob", arguments: '{"pattern":"**/*.ts"}' },
        ],
      },
      { type: "usage", inputTokens: 2, outputTokens: 3 },
    ]),
  );
});
