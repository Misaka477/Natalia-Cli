# Natalia Provider Guide — v1

> This guide covers how to write a streaming model provider adapter — the
> piece that lets a Natalia runtime talk to your own model backend, gateway
> or vendor API. It pairs with the runtime API reference
> (`docs/api-reference.md`): providers are host-side, in-process adapters,
> not an RPC surface.

## 1. What a provider is

A provider adapter is an object implementing `StreamingProvider`
(`@natalia/runtime`):

```ts
export type StreamingProvider = {
  provider: string;        // stable identity, e.g. "openai", "my-gateway"
  model: string;           // the model id this instance talks to
  imageInput?: boolean;    // can lower image attachments (default false)
  pdfInput?: boolean;      // can lower PDF attachments
  videoInput?: boolean;    // can lower video attachments
  stream(request: ProviderStreamRequest): AsyncIterable<ProviderStreamChunk>;
};
```

The runtime calls `stream` once per provider step, with the accumulated
messages, the tool catalog and an `AbortSignal`, and consumes an async
iterable of chunks. That is the whole contract: **produce chunks in the right
order, respect the signal, declare your attachment capabilities honestly.**

## 2. The stream protocol

Yield these chunks in this order per request:

| Chunk | Meaning |
| --- | --- |
| `{ type: "thinking", text }` | reasoning text; the runtime hides it when the model forbids it |
| `{ type: "content", text }` | visible text — may be yielded many times, accumulated into one assistant message |
| `{ type: "tool_call", calls: [{ id, name, arguments }] }` | the model wants tools called; after the runtime executes them it calls `stream` again with tool results in the messages |
| `{ type: "usage", inputTokens, outputTokens }` | token counts, recorded into the journal |
| `{ type: "done" }` | the step is over |

A step ends with `done`; a step that yields `tool_call` must be followed by
the runtime calling `stream` again with the tool results appended to
`request.messages`. A stream that stops without `done` is treated as a
failure. The runtime enforces an idle timeout on the stream; honor
`request.signal` and stop yielding when it aborts.

## 3. The request

```ts
export type ProviderStreamRequest = {
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  signal?: AbortSignal;
};
```

`ProviderMessage` is the adapter's input shape, independent of any vendor
format:

- `role`: `"system" | "user" | "assistant" | "tool"` — tool results arrive as
  `role: "tool"` messages carrying `toolCallID` / `toolName`.
- `content`: plain text.
- `images`: `{ mediaType, dataURL }` — `image/png`, `image/jpeg`,
  `image/webp`, `image/gif`.
- `pdfs`: `{ mediaType: "application/pdf", dataURL }`.
- `videos`: `{ mediaType, dataURL }` — `video/mp4`, `video/webm`.
- `toolCalls`: the assistant's calls, when this message is an assistant turn.

Translate this into your vendor request format; the built-in adapters are the
reference implementations for OpenAI-compatible, Anthropic and Gemini shapes
(`packages/runtime/src/provider.ts`).

## 4. Attachment lowering and the double gate

Attachments are gated twice before they ever reach you: the **selected
model's declared capabilities** (`imageInput`, `pdfInput`, `videoInput` in
the model catalog) and **your adapter's declarations** must both accept the
attachment, or the turn is refused with a message naming the missing side.
Declare exactly what you can lower:

- `imageInput: true` — you turn `images` into your native image content block
  (Anthropic `image`/`base64`, Gemini `inlineData`, OpenAI-compatible
  `image_url`).
- `pdfInput: true` — you turn `pdfs` into your native document block
  (Anthropic `document`, Gemini `inlineData`, OpenAI-compatible `file`).
- `videoInput: true` — you turn `videos` into inline video (Gemini
  `inlineData` is the only built-in today):

```ts
// Gemini lowering, from the built-in adapter:
...(message.videos?.map((video) => ({
  inlineData: { mimeType: video.mediaType, data: dataURLPayload(video.dataURL) },
})) ?? []),
```

`dataURLPayload` strips the `data:<type>;base64,` prefix. There is no
framework size ceiling on attachments — the provider (and ultimately the
model) is the authority on what fits.

## 5. Errors

Throw `providerError(message)` for a stream-level failure, or
`providerErrorFromHttp(response)` when the upstream HTTP call failed — the
runtime turns these into a `turn.finished { stopReason: "error" }` plus a
diagnostic. Do not throw a plain string; the runtime classifies provider
errors so the consumer gets a machine-readable failure, not an unclassified
`internal`.

## 6. Registering your adapter

Two ways:

1. **A new built-in kind** — add a branch in `providerFromKind`
   (`packages/runtime/src/provider.ts`); the config's `providers[].type`
   string is matched case-insensitively by substring (`"anthropic"` /
   `"claude"` → `AnthropicProvider`, `"gemini"` / `"google"` →
   `GeminiProvider`, anything else falls back to the OpenAI-compatible
   adapter). Then `providerForModel(config, modelID)` constructs your
   adapter from the model's `provider` reference.
2. **Injected for a process** — construct your `StreamingProvider` yourself
   and pass it in `createRealRuntimeClient({ provider })`; it overrides the
   config-derived adapter.

Model discovery (`discoverProviderModels`) hits `{baseURL}/v1/models` for
OpenAI-compatible kinds, `/models` with an `x-api-key` for Anthropic and an
`x-goog-api-key` for Gemini — implement a compatible endpoint if you want the
TUI's "add provider" flow to list your models.

## 7. Checklist for a new adapter

- Yields `thinking`/`content` in order, ends with `done`, respects `signal`.
- Returns tool results as `role: "tool"` messages and accepts the follow-up
  `stream` call.
- Declares `imageInput`/`pdfInput`/`videoInput` exactly as implemented.
- Throws `providerError`/`providerErrorFromHttp`, never a raw string.
- Reports `usage` so the journal records tokens.
- Tests mirror `packages/runtime/test/provider.test.ts`: stream parsing,
  attachment lowering to the native format, error mapping, `videoInput`
  declarations.
