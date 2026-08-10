# Natalia Provider 开发指南 — v1

> 本指南讲如何编写流式模型 provider 适配器——让 Natalia runtime 对接你自己的
> 模型后端、网关或厂商 API 的那块。与运行时 API 参考（`docs/api-reference.md`）
> 配套：provider 是 host 侧、进程内的适配器，不是 RPC 面。

## 1. Provider 是什么

Provider 适配器是实现 `StreamingProvider` 的对象（`@natalia/runtime`）：

```ts
export type StreamingProvider = {
  provider: string;        // 稳定标识，如 "openai"、"my-gateway"
  model: string;           // 本实例对话的模型 id
  imageInput?: boolean;    // 能否降级图片附件（默认 false）
  pdfInput?: boolean;      // 能否降级 PDF 附件
  videoInput?: boolean;    // 能否降级视频附件
  stream(request: ProviderStreamRequest): AsyncIterable<ProviderStreamChunk>;
};
```

runtime 每个 provider 步调用一次 `stream`，传入累积消息、工具目录与
`AbortSignal`，消费一个 async iterable 的块。这就是全部契约：**按正确顺序产出
块、尊重 signal、如实声明附件能力。**

## 2. 流协议

每个请求按此顺序产出块：

| 块 | 含义 |
| --- | --- |
| `{ type: "thinking", text }` | 推理文本；模型禁止时 runtime 隐藏它 |
| `{ type: "content", text }` | 可见文本——可产出多次，累积成一条 assistant 消息 |
| `{ type: "tool_call", calls: [{ id, name, arguments }] }` | 模型要调工具；runtime 执行后带工具结果再次调用 `stream` |
| `{ type: "usage", inputTokens, outputTokens }` | token 计数，记入 journal |
| `{ type: "done" }` | 本步结束 |

一步以 `done` 结束；产出 `tool_call` 的步之后，runtime 会把工具结果追加到
`request.messages` 再次调用 `stream`。没到 `done` 就停止的流视为失败。runtime
对流有 idle 超时；尊重 `request.signal`，中止时停止产出。

## 3. 请求

```ts
export type ProviderStreamRequest = {
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  signal?: AbortSignal;
};
```

`ProviderMessage` 是与厂商格式无关的适配器输入：

- `role`：`"system" | "user" | "assistant" | "tool"`——工具结果以
  `role: "tool"` 消息到达，携带 `toolCallID` / `toolName`。
- `content`：纯文本。
- `images`：`{ mediaType, dataURL }`——`image/png`、`image/jpeg`、
  `image/webp`、`image/gif`。
- `pdfs`：`{ mediaType: "application/pdf", dataURL }`。
- `videos`：`{ mediaType, dataURL }`——`video/mp4`、`video/webm`。
- `toolCalls`：assistant 回合时的工具调用。

把它翻译成你的厂商请求格式；三个内建适配器（OpenAI 兼容、Anthropic、
Gemini 形状，`packages/runtime/src/provider.ts`）是参考实现。

## 4. 附件降级与双层门控

附件在到达你之前被门控两次：**所选模型的声明能力**（模型 catalog 的
`imageInput`、`pdfInput`、`videoInput`）与**你的适配器声明**必须都接受该附件，
否则回合被拒并点名缺失侧。只声明你能降级的：

- `imageInput: true` — 你把 `images` 转成原生图片内容块（Anthropic
  `image`/`base64`、Gemini `inlineData`、OpenAI 兼容 `image_url`）。
- `pdfInput: true` — 你把 `pdfs` 转成原生文档块（Anthropic `document`、
  Gemini `inlineData`、OpenAI 兼容 `file`）。
- `videoInput: true` — 你把 `videos` 转成 inline 视频（今天只有 Gemini
  内建）：

```ts
// 内建适配器的 Gemini 降级：
...(message.videos?.map((video) => ({
  inlineData: { mimeType: video.mediaType, data: dataURLPayload(video.dataURL) },
})) ?? []),
```

`dataURLPayload` 去掉 `data:<type>;base64,` 前缀。框架对附件无大小上限——
provider（最终是模型）才是"装不装得下"的权威。

## 5. 错误

流级失败抛 `providerError(message)`；上游 HTTP 失败用
`providerErrorFromHttp(response)`——runtime 把它们变成
`turn.finished { stopReason: "error" }` + diagnostic。不要抛裸字符串；
runtime 对 provider 错误分类，让消费者拿到机器可读的失败而不是未分类的
`internal`。

## 6. 注册你的适配器

两条路：

1. **新的内建 kind**——在 `providerFromKind`
   （`packages/runtime/src/provider.ts`）加分支；config 的 `providers[].type`
   字符串按子串不区分大小写匹配（`"anthropic"`/`"claude"` →
   `AnthropicProvider`，`"gemini"`/`"google"` → `GeminiProvider`，其他全部
   回退到 OpenAI 兼容适配器）。然后 `providerForModel(config, modelID)`
   按模型的 `provider` 引用构造你的适配器。
2. **进程内注入**——自己构造 `StreamingProvider`，传给
   `createRealRuntimeClient({ provider })`；它覆盖 config 派生的适配器。

模型发现（`discoverProviderModels`）：OpenAI 兼容 kind 打
`{baseURL}/v1/models`，Anthropic 带 `x-api-key`、Gemini 带 `x-goog-api-key`
打 `/models`——想要 TUI 的"添加 provider"流程列出你的模型，就实现兼容端点。

## 7. 新适配器检查单

- 按序产出 `thinking`/`content`，以 `done` 结束，尊重 `signal`。
- 工具结果以 `role: "tool"` 消息返回，并接受后续 `stream` 调用。
- `imageInput`/`pdfInput`/`videoInput` 与实现完全一致。
- 抛 `providerError`/`providerErrorFromHttp`，绝不抛裸字符串。
- 报 `usage` 让 journal 记录 token。
- 测试对照 `packages/runtime/test/provider.test.ts`：流解析、附件降级到原生
  格式、错误映射、`videoInput` 声明。
