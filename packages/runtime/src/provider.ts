import type { ContextEntry } from "./context";
import { modelSelectionStatus, resolveEffectiveModel } from "@natalia/config";
import {
  parseModelRef,
  type ConfigV3,
  type ModelRef,
} from "@natalia/contracts";
import { providerError, providerErrorFromHttp } from "./errors";
import {
  CONSERVATIVE_MODEL_LIMIT_FALLBACK,
  knownModelOutputLimit,
  modelsDevModelLimits,
  type ModelMetadataProvider,
} from "./modelmeta";

export type ProviderMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: Array<{
    mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    dataURL: string;
  }>;
  pdfs?: Array<{ mediaType: "application/pdf"; dataURL: string }>;
  videos?: Array<{ mediaType: "video/mp4" | "video/webm"; dataURL: string }>;
  toolCallID?: string;
  toolName?: string;
  toolCalls?: ProviderToolCall[];
};

export type ProviderTool = {
  name: string;
  description: string;
  parameters: unknown;
};

export type ProviderToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ProviderFinishReason =
  | "stop"
  | "tool_calls"
  | "length"
  | "content_filter"
  | "error"
  | "unknown";

export type ProviderStreamChunk =
  | { type: "content"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; calls: ProviderToolCall[] }
  | { type: "tool_protocol_violation"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "done"; finishReason?: ProviderFinishReason };

/**
 * Keeps textual tool-call markup out of the assistant transcript. Plain text is
 * never promoted to an executable call; only the provider's structured
 * `tool_call` chunks are authorized to reach the runtime.
 */
export async function* requireNativeToolCallProtocol(
  source: AsyncIterable<ProviderStreamChunk>,
): AsyncIterable<ProviderStreamChunk> {
  let content = "";
  let violation = "";
  let structuredCalls = false;
  let done: Extract<ProviderStreamChunk, { type: "done" }> | undefined;

  const flushContent = function* (
    final: boolean,
  ): Iterable<ProviderStreamChunk> {
    while (content) {
      const start = textualToolCallMarkerIndex(content);
      if (start < 0) {
        const retained = final
          ? ""
          : textualToolCallMarkerPrefixSuffix(content);
        const text = content.slice(0, content.length - retained.length);
        content = retained;
        if (text) yield { type: "content", text };
        return;
      }
      if (start > 0) {
        yield { type: "content", text: content.slice(0, start) };
        content = content.slice(start);
      }
      // Once model-authored tool syntax begins, retain the remainder as one
      // violation. This also catches malformed or bare <function=...> output.
      violation += content;
      content = "";
      return;
    }
  };

  for await (const chunk of source) {
    if (chunk.type === "content") {
      content += chunk.text;
      yield* flushContent(false);
      continue;
    }
    if (chunk.type === "tool_call") {
      yield* flushContent(true);
      structuredCalls ||= chunk.calls.length > 0;
      yield chunk;
      continue;
    }
    if (chunk.type === "done") {
      done = chunk;
      continue;
    }
    yield* flushContent(true);
    yield chunk;
  }
  yield* flushContent(true);
  if (violation && !structuredCalls)
    yield { type: "tool_protocol_violation", text: violation };
  if (done) yield done;
}

export function nativeToolCallCorrection(attempt: number) {
  return [
    `Tool-call protocol correction ${attempt}: your previous response wrote a tool call as assistant text.`,
    "Use the provider's native structured function/tool-calling channel now.",
    "Choose the intended function from the tool definitions supplied with this request and submit its arguments through that function call's structured arguments object.",
    "Do not print <tool_call> XML, JSON that describes a call, Markdown, or an explanation of the call in assistant content.",
    "Repeat the intended call through the native tool-calling interface. If no tool is needed, answer the user normally instead.",
  ].join(" ");
}

/**
 * Converts complete XML-like tool protocol blocks leaked into content by
 * compatible model gateways into ordinary provider tool calls. The parser is
 * intentionally strict: anything it cannot recognize remains assistant text.
 */
export async function* normalizeRawToolCallProtocol(
  source: AsyncIterable<ProviderStreamChunk>,
): AsyncIterable<ProviderStreamChunk> {
  let content = "";
  let generatedCallCount = 0;
  const orderedCalls: ProviderToolCall[] = [];
  const rawCallIndices = new Map<string, number[]>();
  const structuredSignatures = new Set<string>();
  let done = false;

  const flushContent = function* (
    final: boolean,
  ): Iterable<ProviderStreamChunk> {
    while (content) {
      const start = content.indexOf("<tool_call>");
      if (start < 0) {
        const retained = final ? "" : toolCallPrefixSuffix(content);
        const text = content.slice(0, content.length - retained.length);
        content = retained;
        if (text) yield { type: "content", text };
        return;
      }
      if (start > 0) {
        yield { type: "content", text: content.slice(0, start) };
        content = content.slice(start);
      }
      const end = content.indexOf("</tool_call>");
      if (end < 0) {
        if (final) {
          yield { type: "content", text: content };
          content = "";
        }
        return;
      }
      const blockEnd = end + "</tool_call>".length;
      const block = content.slice(0, blockEnd);
      content = content.slice(blockEnd);
      const call = parseRawToolCall(
        block,
        `raw_xml_tool_${generatedCallCount}`,
      );
      if (call) {
        generatedCallCount += 1;
        const signature = toolCallSignature(call);
        if (!structuredSignatures.has(signature)) {
          const indices = rawCallIndices.get(signature) ?? [];
          indices.push(orderedCalls.length);
          rawCallIndices.set(signature, indices);
          orderedCalls.push(call);
        }
      } else yield { type: "content", text: block };
    }
  };

  for await (const chunk of source) {
    if (chunk.type === "content") {
      content += chunk.text;
      yield* flushContent(false);
      continue;
    }
    if (chunk.type === "tool_call") {
      yield* flushContent(true);
      for (const call of chunk.calls) {
        const signature = toolCallSignature(call);
        structuredSignatures.add(signature);
        const indices = rawCallIndices.get(signature);
        const index = indices?.shift();
        if (!indices?.length) rawCallIndices.delete(signature);
        if (index === undefined) orderedCalls.push(call);
        else orderedCalls[index] = call;
      }
      continue;
    }
    if (chunk.type === "done") {
      done = true;
      continue;
    }
    yield* flushContent(true);
    yield chunk;
  }
  yield* flushContent(true);
  if (orderedCalls.length) yield { type: "tool_call", calls: orderedCalls };
  if (done) yield { type: "done" };
}

function parseRawToolCall(
  block: string,
  id: string,
): ProviderToolCall | undefined {
  const match =
    /^<tool_call>\s*<function=([A-Za-z_][\w.:-]*)>([\s\S]*?)<\/function>\s*<\/tool_call>$/u.exec(
      block,
    );
  if (!match) return undefined;
  const name = decodeXMLEntities(match[1]!);
  const body = match[2]!;
  const parameters: Record<string, unknown> = {};
  let cursor = 0;
  const parameter =
    /\s*<parameter=([A-Za-z_][\w.:-]*)>([\s\S]*?)<\/parameter>/guy;
  while (cursor < body.length) {
    parameter.lastIndex = cursor;
    const item = parameter.exec(body);
    if (!item) return undefined;
    cursor = parameter.lastIndex;
    const key = decodeXMLEntities(item[1]!);
    if (Object.hasOwn(parameters, key)) return undefined;
    parameters[key] = parseRawToolParameter(decodeXMLEntities(item[2]!));
  }
  return { id, name, arguments: JSON.stringify(parameters) };
}

function parseRawToolParameter(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function decodeXMLEntities(value: string) {
  return value.replace(
    /&(amp|lt|gt|quot|apos);/gu,
    (_entity, name: string) =>
      ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name]!,
  );
}

function toolCallPrefixSuffix(value: string) {
  const marker = "<tool_call>";
  for (
    let length = Math.min(value.length, marker.length - 1);
    length > 0;
    length--
  )
    if (value.endsWith(marker.slice(0, length))) return value.slice(-length);
  return "";
}

const textualToolCallMarkers = ["<tool_call", "<function=", "<parameter="];

function textualToolCallMarkerIndex(value: string) {
  let earliest = -1;
  for (const marker of textualToolCallMarkers) {
    const index = value.indexOf(marker);
    if (index >= 0 && (earliest < 0 || index < earliest)) earliest = index;
  }
  return earliest;
}

function textualToolCallMarkerPrefixSuffix(value: string) {
  for (const marker of textualToolCallMarkers)
    for (
      let length = Math.min(value.length, marker.length - 1);
      length > 0;
      length--
    )
      if (value.endsWith(marker.slice(0, length))) return value.slice(-length);
  return "";
}

function toolCallSignature(call: ProviderToolCall) {
  return `${call.name}\u0000${canonicalJSON(call.arguments)}`;
}

function canonicalJSON(value: string) {
  try {
    return JSON.stringify(sortJSON(JSON.parse(value) as unknown));
  } catch {
    return value;
  }
}

function sortJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJSON);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJSON(item)]),
    );
  return value;
}

export type ProviderStreamRequest = {
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  signal?: AbortSignal;
};

export type StreamingProvider = {
  provider: string;
  model: string;
  imageInput?: boolean;
  pdfInput?: boolean;
  videoInput?: boolean;
  listModels?: ModelMetadataProvider["listModels"];
  modelDetail?: ModelMetadataProvider["modelDetail"];
  stream(request: ProviderStreamRequest): AsyncIterable<ProviderStreamChunk>;
};

export type OpenAICompatibleProviderOptions = {
  apiKey: string;
  model: string;
  baseURL?: string;
  provider?: string;
  fetch?: typeof fetch;
  authHeader?: string;
  customHeaders?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoningEffort?: string;
  thinkingEnabled?: boolean;
  timeoutMs?: number;
  streamIdleTimeoutMs?: number;
};

export type AnthropicProviderOptions = {
  apiKey: string;
  model: string;
  baseURL?: string;
  provider?: string;
  fetch?: typeof fetch;
  version?: string;
  timeoutMs?: number;
  streamIdleTimeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
};

export type GeminiProviderOptions = {
  apiKey: string;
  model: string;
  baseURL?: string;
  provider?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  streamIdleTimeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
};

export class OpenAICompatibleProvider implements StreamingProvider {
  readonly provider: string;
  readonly model: string;
  readonly imageInput = true;
  readonly pdfInput = false;
  readonly videoInput = false;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;
  private readonly authHeader: string;
  private readonly customHeaders: Record<string, string>;
  private readonly temperature?: number;
  private readonly maxTokens?: number;
  private readonly topP?: number;
  private readonly reasoningEffort?: string;
  private readonly thinkingEnabled?: boolean;
  private readonly timeoutMs?: number;
  private readonly streamIdleTimeoutMs?: number;
  private modelMetadata?: ReturnType<
    OpenAICompatibleProvider["fetchModelMetadata"]
  >;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.provider = options.provider ?? "openai-compatible";
    this.baseURL = (options.baseURL ?? "https://api.openai.com/v1").replace(
      /\/+$/u,
      "",
    );
    this.fetchImpl = options.fetch ?? fetch;
    this.authHeader = options.authHeader ?? "authorization";
    this.customHeaders = options.customHeaders ?? {};
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens;
    this.topP = options.topP;
    this.reasoningEffort = options.reasoningEffort;
    this.thinkingEnabled = options.thinkingEnabled;
    this.timeoutMs = options.timeoutMs;
    this.streamIdleTimeoutMs = options.streamIdleTimeoutMs;
  }

  async *stream(
    request: ProviderStreamRequest,
  ): AsyncIterable<ProviderStreamChunk> {
    const timeout = this.timeoutMs
      ? AbortSignal.timeout(this.timeoutMs)
      : undefined;
    const signal = timeout
      ? request.signal
        ? AbortSignal.any([request.signal, timeout])
        : timeout
      : request.signal;
    const response = await this.fetchImpl(chatCompletionsURL(this.baseURL), {
      method: "POST",
      headers: {
        [this.authHeader]: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        ...this.customHeaders,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages.map(toOpenAIMessage),
        tools: request.tools?.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        stream: true,
        stream_options: { include_usage: true },
        ...(this.temperature === undefined
          ? {}
          : { temperature: this.temperature }),
        ...(this.maxTokens === undefined ? {} : { max_tokens: this.maxTokens }),
        ...(this.topP === undefined ? {} : { top_p: this.topP }),
        ...(this.reasoningEffort
          ? { reasoning_effort: this.reasoningEffort }
          : {}),
        ...(this.thinkingEnabled === undefined
          ? {}
          : { thinking_enabled: this.thinkingEnabled }),
      }),
      signal,
    });
    if (!response.ok)
      throw providerErrorFromHttp({
        statusCode: response.status,
        statusText: response.statusText,
        retryAfter: response.headers.get("retry-after"),
        retryAfterMs: response.headers.get("retry-after-ms"),
        message: await safeResponseText(response),
      });
    if (!response.body) {
      const data = (await response.json()) as OpenAIChatCompletion;
      const text = data.choices?.[0]?.message?.content;
      if (text) yield { type: "content", text };
      const toolCalls = data.choices?.[0]?.message?.tool_calls?.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      }));
      if (toolCalls?.length) yield { type: "tool_call", calls: toolCalls };
      if (data.usage)
        yield {
          type: "usage",
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        };
      yield {
        type: "done",
        finishReason: normalizeOpenAIFinishReason(
          data.choices?.[0]?.finish_reason,
          Boolean(toolCalls?.length),
        ),
      };
      return;
    }
    yield* streamOpenAISSE(response.body, this.streamIdleTimeoutMs);
  }

  async listModels(): Promise<
    Array<{
      id: string;
      contextWindow?: number;
      inputTokenLimit?: number;
      maxOutputTokens?: number;
    }>
  > {
    if (!this.modelMetadata) this.modelMetadata = this.fetchModelMetadata();
    return await this.modelMetadata;
  }

  private async fetchModelMetadata(): Promise<
    Array<{
      id: string;
      contextWindow?: number;
      inputTokenLimit?: number;
      maxOutputTokens?: number;
    }>
  > {
    const response = await this.fetchImpl(modelsURL(this.baseURL), {
      headers: {
        [this.authHeader]: `Bearer ${this.apiKey}`,
        ...this.customHeaders,
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok)
      throw providerErrorFromHttp({
        statusCode: response.status,
        statusText: response.statusText,
        retryAfter: response.headers.get("retry-after"),
        retryAfterMs: response.headers.get("retry-after-ms"),
        message: await safeResponseText(response),
      });
    const data = (await response.json()) as {
      data?: Array<{
        id?: unknown;
        context_window?: unknown;
        contextWindow?: unknown;
        input_token_limit?: unknown;
        max_input_tokens?: unknown;
        max_output_tokens?: unknown;
        output_token_limit?: unknown;
        max_tokens?: unknown;
      }>;
    };
    return (data.data ?? []).flatMap((model) =>
      typeof model.id === "string"
        ? [
            {
              id: model.id,
              contextWindow:
                typeof model.context_window === "number"
                  ? model.context_window
                  : typeof model.contextWindow === "number"
                    ? model.contextWindow
                    : undefined,
              inputTokenLimit:
                typeof model.input_token_limit === "number"
                  ? model.input_token_limit
                  : typeof model.max_input_tokens === "number"
                    ? model.max_input_tokens
                    : undefined,
              maxOutputTokens:
                typeof model.max_output_tokens === "number"
                  ? model.max_output_tokens
                  : typeof model.output_token_limit === "number"
                    ? model.output_token_limit
                    : typeof model.max_tokens === "number"
                      ? model.max_tokens
                      : undefined,
            },
          ]
        : [],
    );
  }
}

export class AnthropicProvider implements StreamingProvider {
  readonly provider: string;
  readonly model: string;
  readonly imageInput = true;
  readonly pdfInput = true;
  readonly videoInput = false;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;
  private readonly version: string;
  private readonly timeoutMs?: number;
  private readonly maxTokens?: number;
  private readonly temperature?: number;
  private readonly streamIdleTimeoutMs?: number;
  private modelMetadata?: Promise<
    Array<{
      id: string;
      contextWindow?: number;
      inputTokenLimit?: number;
      maxOutputTokens?: number;
    }>
  >;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.provider = options.provider ?? "anthropic";
    this.baseURL = (options.baseURL ?? "https://api.anthropic.com/v1").replace(
      /\/+$/u,
      "",
    );
    this.fetchImpl = options.fetch ?? fetch;
    this.version = options.version ?? "2023-06-01";
    this.timeoutMs = options.timeoutMs;
    this.maxTokens = options.maxTokens;
    this.temperature = options.temperature;
    this.streamIdleTimeoutMs = options.streamIdleTimeoutMs;
  }

  async *stream(
    request: ProviderStreamRequest,
  ): AsyncIterable<ProviderStreamChunk> {
    const timeout = this.timeoutMs
      ? AbortSignal.timeout(this.timeoutMs)
      : undefined;
    const signal = timeout
      ? request.signal
        ? AbortSignal.any([request.signal, timeout])
        : timeout
      : request.signal;
    const maxTokens =
      this.maxTokens ??
      (await this.outputTokenLimit().catch(
        () => CONSERVATIVE_MODEL_LIMIT_FALLBACK,
      ));
    const response = await this.fetchImpl(messagesURL(this.baseURL), {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": this.version,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages
          .filter((message) => message.role !== "system")
          .map(toAnthropicMessage),
        system: request.messages
          .filter((message) => message.role === "system")
          .map((message) => message.content)
          .join("\n\n"),
        tools: request.tools?.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
        max_tokens: maxTokens,
        stream: true,
        ...(this.temperature === undefined
          ? {}
          : { temperature: this.temperature }),
      }),
      signal,
    });
    if (!response.ok)
      throw providerErrorFromHttp({
        statusCode: response.status,
        statusText: response.statusText,
        retryAfter: response.headers.get("retry-after"),
        retryAfterMs: response.headers.get("retry-after-ms"),
        message: await safeResponseText(response),
      });
    if (!response.body) throw new Error("Anthropic response body unavailable");
    yield* streamAnthropicSSE(response.body, this.streamIdleTimeoutMs);
  }

  async listModels() {
    if (!this.modelMetadata) this.modelMetadata = this.fetchModelMetadata();
    return await this.modelMetadata;
  }

  private async outputTokenLimit() {
    const model = isLocalProviderURL(this.baseURL)
      ? undefined
      : (await this.listModels().catch(() => [])).find(
          (candidate) => candidate.id === this.model,
        );
    if (model?.maxOutputTokens) return model.maxOutputTokens;
    const catalog = await modelsDevModelLimits(this.provider, this.model);
    return (
      catalog?.maxOutputTokens ??
      knownModelOutputLimit(this.model) ??
      CONSERVATIVE_MODEL_LIMIT_FALLBACK
    );
  }

  private async fetchModelMetadata() {
    const response = await this.fetchImpl(modelsURL(this.baseURL), {
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": this.version,
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok)
      throw providerErrorFromHttp({
        statusCode: response.status,
        statusText: response.statusText,
        retryAfter: response.headers.get("retry-after"),
        retryAfterMs: response.headers.get("retry-after-ms"),
        message: await safeResponseText(response),
      });
    const payload = (await response.json()) as {
      data?: Array<{
        id?: unknown;
        max_input_tokens?: unknown;
        max_tokens?: unknown;
        context_window?: unknown;
        max_output_tokens?: unknown;
      }>;
    };
    return (payload.data ?? []).flatMap((model) =>
      typeof model.id === "string"
        ? [
            {
              id: model.id,
              contextWindow:
                typeof model.max_input_tokens === "number"
                  ? model.max_input_tokens
                  : typeof model.context_window === "number"
                    ? model.context_window
                    : undefined,
              inputTokenLimit: undefined,
              maxOutputTokens:
                typeof model.max_tokens === "number"
                  ? model.max_tokens
                  : typeof model.max_output_tokens === "number"
                    ? model.max_output_tokens
                    : undefined,
            },
          ]
        : [],
    );
  }
}

export class GeminiProvider implements StreamingProvider {
  readonly provider: string;
  readonly model: string;
  readonly imageInput = true;
  readonly pdfInput = true;
  readonly videoInput = true;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs?: number;
  private readonly temperature?: number;
  private readonly maxTokens?: number;
  private readonly streamIdleTimeoutMs?: number;

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.provider = options.provider ?? "gemini";
    this.baseURL = (
      options.baseURL ?? "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/+$/u, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs;
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens;
    this.streamIdleTimeoutMs = options.streamIdleTimeoutMs;
  }

  async *stream(
    request: ProviderStreamRequest,
  ): AsyncIterable<ProviderStreamChunk> {
    const timeout = this.timeoutMs
      ? AbortSignal.timeout(this.timeoutMs)
      : undefined;
    const signal = timeout
      ? request.signal
        ? AbortSignal.any([request.signal, timeout])
        : timeout
      : request.signal;
    const response = await this.fetchImpl(
      `${this.baseURL}/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        // Keep credentials out of request URLs so they cannot leak through
        // proxy, server, or diagnostic URL logging.
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: request.messages.map(toGeminiContent),
          tools: request.tools?.length
            ? [
                {
                  functionDeclarations: request.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  })),
                },
              ]
            : undefined,
          generationConfig: {
            ...(this.temperature === undefined
              ? {}
              : { temperature: this.temperature }),
            ...(this.maxTokens === undefined
              ? {}
              : { maxOutputTokens: this.maxTokens }),
          },
        }),
        signal,
      },
    );
    if (!response.ok)
      throw providerErrorFromHttp({
        statusCode: response.status,
        statusText: response.statusText,
        retryAfter: response.headers.get("retry-after"),
        retryAfterMs: response.headers.get("retry-after-ms"),
        message: await safeResponseText(response),
      });
    if (!response.body) throw new Error("Gemini response body unavailable");
    yield* streamGeminiSSE(response.body, this.streamIdleTimeoutMs);
  }
}

export function contextEntriesToProviderMessages(
  entries: ContextEntry[],
): ProviderMessage[] {
  const messages: ProviderMessage[] = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    if (entry.role === "tool_call") {
      const transaction: ContextEntry[] = [];
      while (
        index < entries.length &&
        (entries[index]!.role === "tool_call" ||
          entries[index]!.role === "tool_result")
      ) {
        transaction.push(entries[index]!);
        index += 1;
      }
      index -= 1;

      const results = new Map(
        transaction
          .filter(
            (item): item is ContextEntry & { pairID: string } =>
              item.role === "tool_result" && Boolean(item.pairID),
          )
          .map((item) => [item.pairID, item]),
      );
      const calls = transaction
        .filter((item) => item.role === "tool_call")
        .map(parseDurableToolCall)
        .filter(
          (call): call is ProviderToolCall =>
            call !== undefined && results.has(call.id),
        );
      if (!calls.length) continue;
      const preceding = entries[index - transaction.length];
      const previousMessage = messages.at(-1);
      if (
        preceding?.role === "assistant" &&
        previousMessage?.role === "assistant" &&
        previousMessage.toolCalls === undefined
      )
        previousMessage.toolCalls = calls;
      else messages.push({ role: "assistant", content: "", toolCalls: calls });
      for (const call of calls) {
        messages.push({
          role: "tool",
          toolCallID: call.id,
          content: results.get(call.id)!.content,
        });
      }
      continue;
    }
    if (entry.role === "tool_result") continue;
    const message = contextEntryToProviderMessage(entry);
    if (message) messages.push(message);
  }
  return messages;
}

function contextEntryToProviderMessage(
  entry: ContextEntry,
): ProviderMessage | undefined {
  if (
    entry.role === "system" ||
    entry.role === "user" ||
    entry.role === "assistant"
  )
    return { role: entry.role, content: entry.content };
  if (entry.role === "summary")
    return { role: "system", content: entry.content };
  return undefined;
}

function parseDurableToolCall(
  entry: ContextEntry,
): ProviderToolCall | undefined {
  const separator = entry.content.indexOf(" ");
  if (separator < 1 || !entry.pairID) return undefined;
  return {
    id: entry.pairID,
    name: entry.content.slice(0, separator),
    arguments: entry.content.slice(separator + 1),
  };
}

export function providerFromEnvironment(env = process.env) {
  const apiKey =
    env.NATALIA_API_KEY ??
    env.NATALIA_OPENAI_API_KEY ??
    env.OPENAI_API_KEY ??
    env.ANTHROPIC_API_KEY ??
    env.GEMINI_API_KEY;
  const model =
    env.NATALIA_MODEL ??
    env.OPENAI_MODEL ??
    env.ANTHROPIC_MODEL ??
    env.GEMINI_MODEL ??
    "gpt-4o-mini";
  if (!apiKey) return undefined;
  return providerFromKind({
    apiKey,
    model,
    baseURL:
      env.NATALIA_BASE_URL ??
      env.NATALIA_OPENAI_BASE_URL ??
      env.OPENAI_BASE_URL,
    provider: env.NATALIA_PROVIDER ?? "openai-compatible",
  });
}

export function providerFromKind(
  input: OpenAICompatibleProviderOptions & {
    providerName?: string;
  },
) {
  const kind = (input.providerName ?? input.provider ?? "").toLowerCase();
  if (kind.includes("anthropic") || kind.includes("claude"))
    return new AnthropicProvider({
      apiKey: input.apiKey,
      model: input.model,
      baseURL: input.baseURL,
      provider: input.providerName ?? input.provider,
      fetch: input.fetch,
      timeoutMs: input.timeoutMs,
      streamIdleTimeoutMs: input.streamIdleTimeoutMs,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });
  if (kind.includes("gemini") || kind.includes("google"))
    return new GeminiProvider({
      apiKey: input.apiKey,
      model: input.model,
      baseURL: input.baseURL,
      provider: input.providerName ?? input.provider,
      fetch: input.fetch,
      timeoutMs: input.timeoutMs,
      streamIdleTimeoutMs: input.streamIdleTimeoutMs,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });
  return new OpenAICompatibleProvider({
    ...input,
    provider: input.providerName,
  });
}

/**
 * Resolves a configured model reference into the same provider adapter used by
 * the runtime. The reference may be a canonical `"provider/model"` string or a
 * `{provider, model}` ref; unparsable refs, disabled providers and missing
 * credentials resolve to `undefined`. V3 dropped model variants, so a variant
 * name is accepted for call compatibility but never applied.
 */
export function providerForModel(
  config: ConfigV3,
  ref: ModelRef | string | null | undefined,
  _variantName?: string,
  requestOverride?: { reasoningEffort?: string },
): StreamingProvider | undefined {
  if (!ref) return undefined;
  let modelRef: ModelRef;
  try {
    modelRef = typeof ref === "string" ? parseModelRef(ref) : ref;
  } catch {
    return undefined;
  }
  const status = modelSelectionStatus(config, modelRef);
  if (!status.selected) return undefined;
  const effective = resolveEffectiveModel(config, modelRef);
  const providerConfig = effective && config.providers[effective.providerID];
  if (!effective || !providerConfig?.connection?.apiKey) return undefined;
  return providerFromKind({
    // Keep the runtime provider identity stable: it is the adapter kind used
    // by runtime status, model metadata, and existing evaluator contracts.
    providerName: providerConfig.driver,
    provider: providerConfig.driver,
    apiKey: providerConfig.connection.apiKey,
    model: effective.ref.model,
    baseURL: providerConfig.connection.baseURL,
    maxTokens: effective.limits.maxOutputTokens ?? undefined,
    temperature: effective.requestDefaults.temperature ?? undefined,
    topP: effective.requestDefaults.topP ?? undefined,
    reasoningEffort:
      requestOverride?.reasoningEffort ??
      (typeof effective.requestDefaults.options.reasoningEffort === "string"
        ? effective.requestDefaults.options.reasoningEffort
        : undefined),
    thinkingEnabled: effective.capabilities.thinking
      ? effective.requestDefaults.thinkingEnabled
      : undefined,
    timeoutMs: config.runtime.timeouts.requestSec * 1000,
    streamIdleTimeoutMs: config.runtime.timeouts.streamIdleSec * 1000,
  });
}

function chatCompletionsURL(baseURL: string) {
  return baseURL.endsWith("/chat/completions")
    ? baseURL
    : `${baseURL}/chat/completions`;
}

function messagesURL(baseURL: string) {
  return baseURL.endsWith("/messages") ? baseURL : `${baseURL}/messages`;
}

function modelsURL(baseURL: string) {
  const url = new URL(baseURL);
  url.pathname =
    url.pathname
      .replace(/\/(?:chat\/completions|messages)$/u, "")
      .replace(/\/$/u, "") + "/models";
  return url.toString();
}

function isLocalProviderURL(baseURL: string) {
  try {
    const hostname = new URL(baseURL).hostname;
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

type AnthropicStreamChunk = {
  type?: string;
  delta?: { text?: string; partial_json?: string; stop_reason?: string | null };
  content_block?: { id?: string; name?: string; type?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
};

type GeminiStreamChunk = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }>;
    };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

type OpenAIChatCompletion = {
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
};

type OpenAIStreamChunk = {
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  } | null;
  choices?: Array<{
    recipient?: string;
    function_call?: { name?: string; arguments?: string };
    message?: {
      recipient?: string;
      function_call?: { name?: string; arguments?: string };
    };
    delta?: {
      content?: string;
      reasoning_content?: string;
      // Some OpenAI-compatible gateways use the older single-function shape
      // or the ChatGPT recipient field instead of tool_calls[].function.
      recipient?: string;
      function_call?: { name?: string; arguments?: string };
      tool_calls?: Array<{
        index: number;
        id?: string;
        name?: string;
        recipient?: string;
        tool_name?: string;
        function_name?: string;
        function?: { name?: string; arguments?: string } | string;
        function_call?: { name?: string; arguments?: string };
        tool?: { name?: string };
        arguments?: string;
        input?: string;
      }>;
    };
    finish_reason?: string | null;
  }>;
};

async function* streamOpenAISSE(
  body: ReadableStream<Uint8Array>,
  streamIdleTimeoutMs?: number,
): AsyncIterable<ProviderStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const toolCalls = new Map<number, ProviderToolCall>();
  const completion: { finishReason?: ProviderFinishReason } = {};
  let buffer = "";
  while (true) {
    const next = await readWithIdleTimeout(reader, streamIdleTimeoutMs);
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      yield* parseSSEChunks(part, toolCalls, completion);
    }
  }
  if (buffer) {
    yield* parseSSEChunks(buffer, toolCalls, completion);
  }
  if (toolCalls.size)
    yield { type: "tool_call", calls: [...toolCalls.values()] };
  yield { type: "done", finishReason: completion.finishReason };
}

async function* streamAnthropicSSE(
  body: ReadableStream<Uint8Array>,
  streamIdleTimeoutMs?: number,
): AsyncIterable<ProviderStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const toolCalls = new Map<number, ProviderToolCall>();
  let currentToolIndex = -1;
  let finishReason: ProviderFinishReason | undefined;
  let buffer = "";
  while (true) {
    const next = await readWithIdleTimeout(reader, streamIdleTimeoutMs);
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice("data:".length).trim();
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as AnthropicStreamChunk;
        if (parsed.delta?.stop_reason)
          finishReason = normalizeAnthropicFinishReason(
            parsed.delta.stop_reason,
            toolCalls.size > 0,
          );
        if (parsed.type === "content_block_start") {
          currentToolIndex += 1;
          if (parsed.content_block?.type === "tool_use")
            toolCalls.set(currentToolIndex, {
              id: parsed.content_block.id ?? `tool_${currentToolIndex}`,
              name: parsed.content_block.name ?? "",
              arguments: "",
            });
        }
        if (parsed.delta?.text)
          yield { type: "content", text: parsed.delta.text };
        if (parsed.delta?.partial_json && toolCalls.has(currentToolIndex)) {
          const current = toolCalls.get(currentToolIndex)!;
          toolCalls.set(currentToolIndex, {
            ...current,
            arguments: `${current.arguments}${parsed.delta.partial_json}`,
          });
        }
        const usage = parsed.usage ?? parsed.message?.usage;
        if (
          usage?.input_tokens !== undefined ||
          usage?.output_tokens !== undefined
        )
          yield {
            type: "usage",
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
          };
      }
    }
  }
  if (buffer) {
    for (const line of buffer.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice("data:".length).trim();
      if (!data || data === "[DONE]") continue;
      const parsed = JSON.parse(data) as AnthropicStreamChunk;
      if (parsed.delta?.stop_reason)
        finishReason = normalizeAnthropicFinishReason(
          parsed.delta.stop_reason,
          toolCalls.size > 0,
        );
      if (parsed.delta?.text)
        yield { type: "content", text: parsed.delta.text };
      const usage = parsed.usage ?? parsed.message?.usage;
      if (
        usage?.input_tokens !== undefined ||
        usage?.output_tokens !== undefined
      )
        yield {
          type: "usage",
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        };
    }
  }
  if (toolCalls.size)
    yield { type: "tool_call", calls: [...toolCalls.values()] };
  yield { type: "done", finishReason };
}

async function* streamGeminiSSE(
  body: ReadableStream<Uint8Array>,
  streamIdleTimeoutMs?: number,
): AsyncIterable<ProviderStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finishReason: ProviderFinishReason | undefined;
  while (true) {
    const next = await readWithIdleTimeout(reader, streamIdleTimeoutMs);
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice("data:".length).trim();
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as GeminiStreamChunk;
        if (parsed.candidates?.[0]?.finishReason)
          finishReason = normalizeGeminiFinishReason(
            parsed.candidates[0].finishReason,
          );
        const calls: ProviderToolCall[] = [];
        for (const part of parsed.candidates?.[0]?.content?.parts ?? []) {
          if (part.text) yield { type: "content", text: part.text };
          if (part.functionCall?.name)
            calls.push({
              id: `gemini_${calls.length}`,
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args ?? {}),
            });
        }
        if (calls.length) yield { type: "tool_call", calls };
        if (parsed.usageMetadata)
          yield {
            type: "usage",
            inputTokens: parsed.usageMetadata.promptTokenCount ?? 0,
            outputTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
          };
      }
    }
  }
  if (buffer) {
    const parsed = parseGeminiSSEPart(buffer);
    for (const chunk of parsed.chunks) yield chunk;
    finishReason = parsed.finishReason ?? finishReason;
  }
  yield { type: "done", finishReason };
}

function parseGeminiSSEPart(part: string): {
  chunks: ProviderStreamChunk[];
  finishReason?: ProviderFinishReason;
} {
  const chunks: ProviderStreamChunk[] = [];
  let finishReason: ProviderFinishReason | undefined;
  for (const line of part.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") continue;
    const parsed = JSON.parse(data) as GeminiStreamChunk;
    if (parsed.candidates?.[0]?.finishReason)
      finishReason = normalizeGeminiFinishReason(
        parsed.candidates[0].finishReason,
      );
    const calls: ProviderToolCall[] = [];
    for (const part of parsed.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) chunks.push({ type: "content", text: part.text });
      if (part.functionCall?.name)
        calls.push({
          id: `gemini_${calls.length}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        });
    }
    if (calls.length) chunks.push({ type: "tool_call", calls });
    if (parsed.usageMetadata)
      chunks.push({
        type: "usage",
        inputTokens: parsed.usageMetadata.promptTokenCount ?? 0,
        outputTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
      });
  }
  return { chunks, finishReason };
}

function parseSSEChunks(
  part: string,
  toolCalls: Map<number, ProviderToolCall>,
  completion: { finishReason?: ProviderFinishReason },
): ProviderStreamChunk[] {
  const chunks: ProviderStreamChunk[] = [];
  for (const line of part.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") continue;
    const parsed = JSON.parse(data) as OpenAIStreamChunk;
    if (parsed.usage)
      chunks.push({
        type: "usage",
        inputTokens: parsed.usage.prompt_tokens,
        outputTokens: parsed.usage.completion_tokens,
      });
    const choice = parsed.choices?.[0];
    if (choice?.finish_reason)
      completion.finishReason = normalizeOpenAIFinishReason(
        choice.finish_reason,
        toolCalls.size > 0,
      );
    const delta = choice?.delta;
    const legacyRecipient =
      delta?.recipient ?? choice?.recipient ?? choice?.message?.recipient;
    const legacyFunction =
      delta?.function_call ??
      choice?.function_call ??
      choice?.message?.function_call;
    if (
      legacyRecipient ||
      legacyFunction ||
      (toolCalls.size > 0 && delta?.content)
    ) {
      const current = toolCalls.get(0) ?? {
        id: `tool_0`,
        name: "",
        arguments: "",
      };
      const recipient = normalizeToolRecipient(legacyRecipient);
      toolCalls.set(0, {
        id: current.id,
        name:
          normalizeToolRecipient(legacyFunction?.name) ??
          recipient ??
          current.name,
        arguments: `${current.arguments}${legacyFunction?.arguments ?? delta?.content ?? ""}`,
      });
      if (
        (choice?.finish_reason === "tool_calls" ||
          choice?.finish_reason === "function_call") &&
        toolCalls.size
      ) {
        const calls = [...toolCalls.values()];
        toolCalls.clear();
        chunks.push({ type: "tool_call", calls });
      }
      continue;
    }
    if (delta?.tool_calls) {
      for (const call of delta.tool_calls) {
        const current = toolCalls.get(call.index) ?? {
          id: call.id ?? `tool_${call.index}`,
          name: "",
          arguments: "",
        };
        const name = toolNameFromGatewayCall(call);
        toolCalls.set(call.index, {
          id: call.id ?? current.id,
          name: name ?? current.name,
          arguments: `${current.arguments}${toolArgumentsFromGatewayCall(call)}`,
        });
      }
      if (choice?.finish_reason === "tool_calls" && toolCalls.size) {
        const calls = [...toolCalls.values()];
        toolCalls.clear();
        chunks.push({ type: "tool_call", calls });
      }
      continue;
    }
    if (delta?.reasoning_content)
      chunks.push({ type: "thinking", text: delta.reasoning_content });
    if (delta?.content) chunks.push({ type: "content", text: delta.content });
  }
  return chunks;
}

function normalizeOpenAIFinishReason(
  reason: string | null | undefined,
  hasToolCalls: boolean,
): ProviderFinishReason | undefined {
  if (hasToolCalls || reason === "tool_calls" || reason === "function_call")
    return "tool_calls";
  if (reason === "stop") return "stop";
  if (reason === "length") return "length";
  if (reason === "content_filter") return "content_filter";
  return reason ? "unknown" : undefined;
}

function normalizeAnthropicFinishReason(
  reason: string,
  hasToolCalls: boolean,
): ProviderFinishReason {
  if (hasToolCalls || reason === "tool_use") return "tool_calls";
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  if (reason === "max_tokens") return "length";
  if (reason === "refusal") return "content_filter";
  return "unknown";
}

function normalizeGeminiFinishReason(reason: string): ProviderFinishReason {
  if (reason === "STOP") return "stop";
  if (reason === "MAX_TOKENS") return "length";
  if (reason === "SAFETY" || reason === "RECITATION") return "content_filter";
  if (reason === "MALFORMED_FUNCTION_CALL" || reason === "OTHER")
    return "error";
  return "unknown";
}

function normalizeToolRecipient(recipient: string | undefined) {
  if (!recipient) return undefined;
  for (const prefix of ["functions.", "function.", "tools."])
    if (recipient.startsWith(prefix)) return recipient.slice(prefix.length);
  return recipient;
}

function toolNameFromGatewayCall(call: {
  name?: string;
  recipient?: string;
  tool_name?: string;
  function_name?: string;
  function?: { name?: string; arguments?: string } | string;
  function_call?: { name?: string; arguments?: string };
  tool?: { name?: string };
}) {
  return (
    normalizeToolRecipient(
      typeof call.function === "object" ? call.function.name : call.function,
    ) ??
    normalizeToolRecipient(call.function_call?.name) ??
    normalizeToolRecipient(call.name) ??
    normalizeToolRecipient(call.recipient) ??
    normalizeToolRecipient(call.tool_name) ??
    normalizeToolRecipient(call.function_name) ??
    normalizeToolRecipient(call.tool?.name)
  );
}

function toolArgumentsFromGatewayCall(call: {
  function?: { arguments?: string } | string;
  function_call?: { arguments?: string };
  arguments?: string;
  input?: string;
}) {
  if (typeof call.function === "object" && call.function.arguments)
    return call.function.arguments;
  return call.function_call?.arguments ?? call.arguments ?? call.input ?? "";
}

function toOpenAIMessage(message: ProviderMessage) {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallID,
      content: message.content,
    };
  }
  if (message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  if (message.images?.length || message.pdfs?.length)
    return {
      role: message.role,
      content: [
        ...(message.content ? [{ type: "text", text: message.content }] : []),
        ...(message.images ?? []).map((image) => ({
          type: "image_url",
          image_url: { url: image.dataURL },
        })),
        ...(message.pdfs ?? []).map((pdf) => ({
          type: "file",
          file: { file_data: pdf.dataURL },
        })),
      ],
    };
  return { role: message.role, content: message.content };
}

function toAnthropicMessage(message: ProviderMessage) {
  if (message.role === "tool")
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: message.toolCallID,
          content: message.content,
        },
      ],
    };
  if (message.toolCalls?.length)
    return {
      role: "assistant",
      content: [
        ...(message.content ? [{ type: "text", text: message.content }] : []),
        ...message.toolCalls.map((call) => ({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: safeJSON(call.arguments),
        })),
      ],
    };
  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content:
      message.images?.length || message.pdfs?.length
        ? [
            ...(message.content
              ? [{ type: "text", text: message.content }]
              : []),
            ...(message.images ?? []).map((image) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: dataURLPayload(image.dataURL),
              },
            })),
            ...(message.pdfs ?? []).map((pdf) => ({
              type: "document",
              source: {
                type: "base64",
                media_type: pdf.mediaType,
                data: dataURLPayload(pdf.dataURL),
              },
            })),
          ]
        : message.content,
  };
}

function toGeminiContent(message: ProviderMessage) {
  const role = message.role === "assistant" ? "model" : "user";
  if (message.toolCalls?.length)
    return {
      role: "model",
      parts: message.toolCalls.map((call) => ({
        functionCall: { name: call.name, args: safeJSON(call.arguments) },
      })),
    };
  if (message.role === "tool")
    return {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: message.toolName ?? message.toolCallID,
            response: { content: message.content },
          },
        },
      ],
    };
  return {
    role,
    parts: [
      ...(message.content ? [{ text: message.content }] : []),
      ...(message.images?.map((image) => ({
        inlineData: {
          mimeType: image.mediaType,
          data: dataURLPayload(image.dataURL),
        },
      })) ?? []),
      ...(message.pdfs?.map((pdf) => ({
        inlineData: {
          mimeType: pdf.mediaType,
          data: dataURLPayload(pdf.dataURL),
        },
      })) ?? []),
      ...(message.videos?.map((video) => ({
        inlineData: {
          mimeType: video.mediaType,
          data: dataURLPayload(video.dataURL),
        },
      })) ?? []),
    ],
  };
}

function dataURLPayload(value: string) {
  const marker = ";base64,";
  const index = value.indexOf(marker);
  if (index < 0) throw new Error("attachment data URL is not base64 encoded");
  return value.slice(index + marker.length);
}

function safeJSON(input: string) {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return { value: input };
  }
}

export async function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs?: number,
) {
  if (!timeoutMs) return await reader.read();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void reader.cancel().catch(() => undefined);
          reject(
            providerError({
              kind: "timeout",
              message: `provider stream idle timeout after ${timeoutMs}ms`,
            }),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function safeResponseText(response: Response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "<unavailable>";
  }
}
