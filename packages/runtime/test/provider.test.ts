import { expect, test } from "bun:test";
import {
  AnthropicProvider,
  contextEntriesToProviderMessages,
  GeminiProvider,
  OpenAICompatibleProvider,
  providerFromKind,
  readWithIdleTimeout,
} from "../src/provider";
import { ContextWindowResolver } from "../src/modelmeta";

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

test("Anthropic-compatible provider names use the Messages API adapter", async () => {
  const requested: string[] = [];
  const fetchImpl = Object.assign(
    async (input: URL | RequestInfo) => {
      requested.push(String(input));
      return new Response("event: message_stop\ndata: {}\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  for (const baseURL of [
    "https://gateway.example/v1",
    "https://gateway.example/v1/messages",
  ]) {
    const provider = providerFromKind({
      provider: "anthropic-compatible",
      apiKey: "test-key",
      model: "claude-compatible-model",
      baseURL,
      fetch: fetchImpl,
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    for await (const _chunk of provider.stream({ messages: [] })) {
      // Drain the stream to force the request.
    }
  }
  expect(requested).toEqual([
    "https://gateway.example/v1/messages",
    "https://gateway.example/v1/messages",
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

test("OpenAI-compatible provider maps legacy function and recipient streaming calls", async () => {
  const fetchImpl = Object.assign(
    async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"recipient":"functions.run_shell","content":"{\\"command\\":\\"pwd"}}]}',
          "",
          'data: {"choices":[{"delta":{"content":"\\"}"},"finish_reason":"tool_calls"}]}',
          "",
          'data: {"choices":[{"delta":{"function_call":{"name":"glob","arguments":"{\\"pattern\\":\\"*.ts\\"}"}},"finish_reason":"function_call"}]}',
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
      {
        type: "tool_call",
        calls: [
          {
            id: "tool_0",
            name: "run_shell",
            arguments: '{"command":"pwd"}',
          },
        ],
      },
      {
        type: "tool_call",
        calls: [
          { id: "tool_0", name: "glob", arguments: '{"pattern":"*.ts"}' },
        ],
      },
    ]),
  );
});

test("OpenAI-compatible provider accepts gateway tool-call name aliases", async () => {
  const fetchImpl = Object.assign(
    async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_top_name","name":"glob","function":{"arguments":"{\\"pattern\\":\\"*.ts\\"}"}}]}}]}',
          "",
          'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_recipient","recipient":"functions.run_shell","function":{"arguments":"{\\"command\\":\\"pwd\\"}"}}]},"finish_reason":"tool_calls"}]}',
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
      {
        type: "tool_call",
        calls: [
          {
            id: "call_top_name",
            name: "glob",
            arguments: '{"pattern":"*.ts"}',
          },
          {
            id: "call_recipient",
            name: "run_shell",
            arguments: '{"command":"pwd"}',
          },
        ],
      },
    ]),
  );
});

test("OpenAI-compatible provider waits for a later function name fragment", async () => {
  const fetchImpl = Object.assign(
    async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"path\\":\\"README"}}]}}]}',
          "",
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"read_file","arguments":".md\\"}"}}]},"finish_reason":"tool_calls"}]}',
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
  expect(chunks).toEqual([
    {
      type: "tool_call",
      calls: [
        {
          id: "tool_0",
          name: "read_file",
          arguments: '{"path":"README.md"}',
        },
      ],
    },
    { type: "done" },
  ]);
});

test("OpenAI-compatible provider normalizes alternate gateway function fields", async () => {
  const fetchImpl = Object.assign(
    async () =>
      new Response(
        [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_function","function":"functions.read_file","input":"{\\"path\\":\\"README.md\\"}"},{"index":1,"id":"call_alias","tool_name":"tools.glob","arguments":"{\\"pattern\\":\\"*.ts\\"}"}]},"finish_reason":"tool_calls"}]}',
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
      {
        type: "tool_call",
        calls: [
          {
            id: "call_function",
            name: "read_file",
            arguments: '{"path":"README.md"}',
          },
          {
            id: "call_alias",
            name: "glob",
            arguments: '{"pattern":"*.ts"}',
          },
        ],
      },
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

test("OpenAI-compatible provider omits unsupported reasoning and thinking request options", async () => {
  let body: Record<string, unknown> | undefined;
  const fetchImpl = Object.assign(
    async (_input: URL | RequestInfo, init?: RequestInit) => {
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
    reasoningEffort: undefined,
    thinkingEnabled: undefined,
    fetch: fetchImpl,
  });
  for await (const _chunk of provider.stream({ messages: [] })) {
    // Drain the stream.
  }
  expect(body).not.toHaveProperty("reasoning_effort");
  expect(body).not.toHaveProperty("thinking_enabled");
});

test("providers lower image parts to their native request formats", async () => {
  const request = {
    messages: [
      {
        role: "user" as const,
        content: "inspect",
        images: [
          {
            mediaType: "image/png" as const,
            dataURL: "data:image/png;base64,cG5n",
          },
        ],
      },
    ],
  };
  const bodies: Record<string, Record<string, unknown>> = {};
  const fetchFor = (name: string) =>
    Object.assign(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        bodies[name] = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        return new Response("data: [DONE]\n\n", {
          headers: { "content-type": "text/event-stream" },
        });
      },
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
  for await (const _chunk of new AnthropicProvider({
    apiKey: "key",
    model: "model",
    fetch: fetchFor("anthropic"),
  }).stream(request)) {
    // Drain.
  }
  for await (const _chunk of new GeminiProvider({
    apiKey: "key",
    model: "model",
    fetch: fetchFor("gemini"),
  }).stream(request)) {
    // Drain.
  }
  const anthropic = bodies.anthropic.messages as Array<{
    content: Array<{ type?: string; source?: { data?: string } }>;
  }>;
  const gemini = bodies.gemini.contents as Array<{
    parts: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
  }>;
  expect(
    anthropic[0]?.content.find((part) => part.type === "image"),
  ).toMatchObject({
    source: { type: "base64", media_type: "image/png", data: "cG5n" },
  });
  expect(gemini[0]?.parts.find((part) => part.inlineData)).toMatchObject({
    inlineData: { mimeType: "image/png", data: "cG5n" },
  });
});

test("Anthropic and Gemini lower PDF documents while OpenAI-compatible declares no PDF support", async () => {
  const request = {
    messages: [
      {
        role: "user" as const,
        content: "read",
        pdfs: [
          {
            mediaType: "application/pdf" as const,
            dataURL: "data:application/pdf;base64,cGRm",
          },
        ],
      },
    ],
  };
  const bodies: Record<string, Record<string, unknown>> = {};
  const fetchFor = (name: string) =>
    Object.assign(
      async (_input: URL | RequestInfo, init?: RequestInit) => {
        bodies[name] = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        return new Response("data: [DONE]\n\n", {
          headers: { "content-type": "text/event-stream" },
        });
      },
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
  const openai = new OpenAICompatibleProvider({
    apiKey: "key",
    model: "model",
  });
  expect(openai.pdfInput).toBe(false);
  for await (const _chunk of new AnthropicProvider({
    apiKey: "key",
    model: "model",
    fetch: fetchFor("anthropic"),
  }).stream(request)) {
    // Drain.
  }
  for await (const _chunk of new GeminiProvider({
    apiKey: "key",
    model: "model",
    fetch: fetchFor("gemini"),
  }).stream(request)) {
    // Drain.
  }
  const anthropic = bodies.anthropic.messages as Array<{
    content: Array<{
      type?: string;
      source?: { data?: string; media_type?: string };
    }>;
  }>;
  const gemini = bodies.gemini.contents as Array<{
    parts: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
  }>;
  expect(
    anthropic[0]?.content.find((part) => part.type === "document"),
  ).toMatchObject({
    source: { type: "base64", media_type: "application/pdf", data: "cGRm" },
  });
  expect(gemini[0]?.parts.find((part) => part.inlineData)).toMatchObject({
    inlineData: { mimeType: "application/pdf", data: "cGRm" },
  });
});

test("Gemini function responses retain the original function name", async () => {
  let body: Record<string, unknown> | undefined;
  const fetchImpl = Object.assign(
    async (_input: URL | RequestInfo, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  const provider = new GeminiProvider({
    apiKey: "key",
    model: "model",
    fetch: fetchImpl,
  });
  for await (const _chunk of provider.stream({
    messages: [
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "workspace_read", arguments: "{}" }],
      },
      {
        role: "tool",
        toolCallID: "call_1",
        toolName: "workspace_read",
        content: "result",
      },
    ],
  })) {
    // Drain.
  }
  const contents = body?.contents as Array<{
    parts: Array<{ functionResponse?: { name?: string } }>;
  }>;
  expect(contents[1]?.parts[0]?.functionResponse?.name).toBe("workspace_read");
});

test("provider stream idle timeout cancels a stalled SSE reader with typed timeout", async () => {
  let cancelled = false;
  const reader = {
    read: async () => await new Promise<never>(() => undefined),
    cancel: async () => {
      cancelled = true;
    },
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
  await expect(readWithIdleTimeout(reader, 5)).rejects.toMatchObject({
    kind: "timeout",
    message: expect.stringContaining("stream idle timeout"),
  });
  expect(cancelled).toBe(true);
});

test("OpenAI-compatible catalog discovery keeps credentials out of URLs and feeds context resolution", async () => {
  let requested = "";
  let authorization = "";
  const fetchImpl = Object.assign(
    async (input: URL | RequestInfo, init?: RequestInit) => {
      requested = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json({
        data: [{ id: "catalog-model", context_window: 123456 }],
      });
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
  const provider = new OpenAICompatibleProvider({
    apiKey: "catalog-secret",
    model: "catalog-model",
    baseURL: "https://gateway.example/v1",
    fetch: fetchImpl,
  });
  expect(await provider.listModels()).toEqual([
    { id: "catalog-model", contextWindow: 123456, inputTokenLimit: undefined },
  ]);
  expect(requested).toBe("https://gateway.example/v1/models");
  expect(requested).not.toContain("catalog-secret");
  expect(authorization).toBe("Bearer catalog-secret");
  expect(
    (
      await new ContextWindowResolver().resolve({
        provider: provider.provider,
        model: provider.model,
        providerAdapter: provider,
      })
    ).tokens,
  ).toBe(123456);
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
