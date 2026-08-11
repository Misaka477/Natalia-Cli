# Natalia 运行时 API 参考 — v1

> 状态：**apiVersion 1**（见 `@natalia/contracts` 的 `API_VERSION`）。
> 本文档为 `docs/api-reference.md` 的中文版；文末"机器派生"标题下的表格由源码表
> 生成（`npm run docs:api-reference`），**与英文版逐字节一致**，防漂移守卫
> （`packages/transport/test/api-reference.test.ts`）在二者不一致时使门禁变红。
> 本文档所有内容均由 `packages/sdk/test/consumer-conformance.test.ts` 验证——它用
> 消费面三包驱动真实 runtime、走真实传输；若该测试做不到，本文档不会声称你可以。

本文档面向在 Natalia runtime 之上通过 HTTP 构建 UI 或集成的开发者。它覆盖稳定协议
面：连接与鉴权、调用如何失败、如何发现所连 runtime 的实际能力、事件流，以及写面的
幂等与拒绝语义。刻意不描述内部包、TUI，或仅存在于声明类型中的功能。所有结果类型的
完整字段形状（嵌套对象已展开，无需回源码查）见 `docs/types-reference.md`。

---

## 1. 范围与部署形态

一个 server 恰好承载**一个** runtime。`createRuntimeHttpServer` 接收单个
`RuntimeClient`，RPC 面无 session 路由：每次调用都作用于这唯一一个 runtime。这是
"你托管的 runtime"，不是"连很多用户的服务"。多租户意味着多 runtime，路由与配额在
你自己的编排层——安全边界不该放进 runtime 的组合根。

本文档全部内容都围绕这一"单托管 runtime"形态。`session` 作用域的 API 成员管理的是
这一个 runtime 内部的 *session 记录*，不是多个 runtime 的连接。

## 2. 包与导入规则

外部集成可以依赖、且只能依赖：

| 包 | 用途 |
| --- | --- |
| `@natalia/contracts` | 全部事件、请求与客户端类型；失败分类；版本与能力常量 |
| `@natalia/sdk` | 通过 HTTP 与 runtime 通信（`createNataliaSDK({ baseURL, token })`） |
| `@natalia/view-store` | 把 `RuntimeEvent` 流折叠成可渲染状态 |
| `@natalia/transport` | RPC 协议（`callRuntimeRPC`）与 fetch 录制器 |
| `@natalia/client` **仅公共导出** | 进程内托管 runtime，以及 task/flow 辅助函数 |

**禁止**导入任何包内部（`@natalia/x/...`）、`@natalia/runtime`、
`@natalia/session`、`@natalia/tools` 或 `apps/` 下任何内容。
`npm run guard:imports` 机械强制这些边界，包括消费契约包永不触及内核。
`@natalia/transport/host`（serving runtime、daemon 生命周期）仅限 host 侧：会说协议
绝不能等于能托管 runtime。

## 3. 连接与鉴权

```ts
import { createNataliaSDK } from "@natalia/sdk";

const sdk = createNataliaSDK({ baseURL: "http://127.0.0.1:4700", token });
```

- `baseURL` — runtime 的 HTTP 端点。`/healthz`、`/events`、`/ws` 与 JSON-RPC
  端点都在其下。
- `token` — 部署签发的 bearer token。SDK 以 `Authorization: Bearer …` 传递。
- `fetch` — 可选注入的 fetch，用于测试与录制回放。

**鉴权按部署配置；默认是全开放，不是拒绝。** 既不传 `token` 也不传
`authorization` 的 server 对任何请求放行（CLI `serve` 无 token 时打印
`auth: disabled`）。"默认拒绝"只在配置了凭据后成立：此时无 token（或错
token）的请求一律回 `401`（两者响应相同，token 不可探测），只有 `open: true`
重新放行无凭据请求（启动时打 warning）。没有内置身份流程；需要身份验证的
部署在 runtime 之外自建。

凭据有两种形式：

- `token` — 单个全权凭据的简写（daemon 签发这类 token；CLI 流程不变）。等价于
  `authorization: { credentials: [{ token, write: true }] }` 且 `open: false`。
- 作用域凭据（scoped credentials）— 携带三个维度：
  - **能力组**：调用方可到达哪些能力组（缺省 = 全部组）；
  - **`write`**：调用方是否可使用写面（见 §9）；
  - **sessions**：调用方可订阅哪些 session 的事件流。

host 在 HTTP server 选项上配置它们：

```ts
createRuntimeHttpServer({
  client,
  authorization: {
    // 默认拒绝：无凭据即无访问（除非下面 open: true）
    open: false,
    credentials: [
      { token: "readonly-1", write: false, groups: ["transcript", "workspace"] },
      { token: "write-1", write: true },
      { token: "events-only", write: false, sessions: ["ses_abc123"] },
    ],
  },
});
```

`open: true` 允许无凭据访问，并在启动时打一条 warning 级 diagnostic；它只用于本地
开发，不用于生产。

---

## 4. 最小运行示例（Hello World）

最快的上手方式是两个文件。host 侧——构造 runtime 并 serve：

```ts
import { createRealRuntimeClient } from "@natalia/client";
import { createRuntimeHttpServer } from "@natalia/transport/host";

const runtime = createRealRuntimeClient({
  workspaceRoot: "/home/me/project",
  sessionID: "ses_demo",
  permissionMode: "auto",            // 自动批准工具；要策略就换
  provider: {                        // 在这里接入真实 provider
    provider: "scripted",
    model: "scripted",
    async *stream() {
      yield { type: "content" as const, text: "Hello from your runtime. " };
      yield { type: "done" as const };
    },
  },
});
runtime.start(() => {});             // 进程内事件 sink
const server = createRuntimeHttpServer({
  client: runtime,
  token: "demo-token",               // 每个部署自己的 bearer token
});
console.log(`runtime listening at ${server.url}`);
```

消费者侧——任意进程、任意机器：

```ts
import { createNataliaSDK } from "@natalia/sdk";
import { projectEvents, displayText } from "@natalia/view-store";

const sdk = createNataliaSDK({
  baseURL: "http://127.0.0.1:4700",
  token: "demo-token",
});

const submitted = await sdk.prompt("explain this repository");
console.log(submitted.type, submitted.id); // turn.submitted turn_…

// 重放 journal 并折叠成可渲染块。
const { events } = await sdk.history({ limit: 200 });
const state = projectEvents(events.map((entry) => entry.event));
for (const block of state.messages) console.log(displayText(block));
```

这就是集成的完整形状：一个进程托管（runtime + HTTP server），任意数量的其他进程
消费（SDK + view-store）。conformance 套件（§10）以同样的形状验证 runtime 实现的
每一个成员。

只读凭据在任意写操作上被拒绝为 `-32001 refused` 并带原因，无论该方法是否存在——
授权错误永远不会兼作存在性探测器。

**事件订阅由服务端过滤。** 订阅时带 `?session=…`；凭据的 session 集合在订阅时校验
（越界为 `403`），携带其他 session id 的事件永不推送——连类型与计数都不可见。不要
在客户端自行过滤共享流；服务端才是边界。

## 5. 调用如何失败，以及"拒绝是值"

失败的调用抛出 `RuntimeRPCError`（来自 `@natalia/sdk` 与 `@natalia/transport`）。
`failureKind(error)`（来自 `@natalia/contracts`）返回五类之一，各自对应不同的反应：

| 类型 | 码 | 含义 | 该做什么 |
| --- | --- | --- | --- |
| `methodNotFound` | `-32601` | 该 runtime 没有这条路 | 你与它在协议上不一致：上报 bug，或降级 |
| `notSupported` | `-32000` | 路由存在，但该 runtime 未实现这个成员。`data` 携带 `member` 与 `capability` | 整个能力组隐藏；重试永远没用 |
| `invalidParams` | `-32602` | 参数错了 | 修调用 |
| `refused` | `-32001` | 策略或当前状态说不。`data.reason` 说明是哪条 | 告诉用户；稍后可能成功 |
| `internal` | `-32603` | 出问题了。`data.errorID` 关联持久化 diagnostic | 重试或上报 |

`internal` 失败**故意不携带消息细节**：未分类错误的文本可能包含绝对路径、命令行或
密钥。需要细节时读 `diagnostics.list` 并按 `data.errorID` 匹配。任何情况下都不要按
消息文本分支——文本是给人看的，code 与 `data` 才是给你用的。所有失败一律 HTTP
`400`（刻意为之），因此 HTTP 状态不可能变成与分类相矛盾的第二套分类。

**拒绝常常是"值"而不是异常。** 有些操作在结果里回答"我没做，原因如下"，因为拒绝
是普通结局，调用方不能靠 catch 来区分"没做成"与"连接断了"。今天：
`reloadConfig` / `canReloadConfig`（`applied` / `allowed`）、`updateConfig`
（`applied`）、`pause` / `resume`（`paused` / `resumed`）、`selectAgent`
（`outcome` 为 `applied`、`pending` 或 `rejected`）、`respondApproval` /
`respondQuestion`（`accepted`）。最后一对对外部 UI 最重要：回答一个已超时的请求会
返回 `accepted: false`，而模型已被告知该调用没有执行——把它渲染成"已批准"就错了。
哪些成员必须这样回答，逐成员记录在 `packages/contracts/src/refusals.ts`（每条带注
释）；向 `RuntimeClient` 新增成员时，typecheck 强制必须对此做出决定。

SDK 还会做**版本检查**：首次调用前读 `/healthz`，若 runtime 说出的 `apiVersion` 比
SDK 认识的更新，所有调用面都会以 `RuntimeVersionMismatchError` 大声失败（错误上带
两个版本号），而不是静默误读协议。

## 6. 发现这条连接能做什么

`sdk.availability()`（`runtime.availability`）是回答"这里我能调什么"的唯一受支持
方式。它由 runtime 与传输路由表推导而来——不是声明的——因此不会与代码漂移，并携带
`apiVersion`。

按通道（不带通道参数是进程内视图；RPC 通道即 HTTP），每个成员处于三态之一：

- `implemented_reachable` — runtime 实现了它，且这条连接路由它；
- `implemented_unreachable` — 带原因：要么 **intentionally local**（见下），要么
  "this transport does not route it"；
- `not_implemented` — runtime 本身没实现它（该路由回 `-32000`）。

组级结论：只有组内成员在本通道全部可达，组才 `reachable`；混合组标记 `partial`。
报告还携带 `requiredMembers`——本通道上的稳定必需集——以及成员有弃用信息时的
`deprecated` 字段。

**有意不远程**的成员被刻意路由掉并在报告中带原因：`dispose`（远程调用方不得处置
他人的 runtime）、`start`（远程消费者订阅 `/events` 而不是调 start）、
`lastSubmission`（本地读）、`diagnostic`（本地单向发布）。

**因无写入方而恒空**的查询由 contracts 的 `UNIMPLEMENTED_QUERIES` 列出并在报告中
标记：`constitutionRules`、`decisionRecords`、`evidenceRecords`、`driftFindings`、
`registeredTools`。空数组自己说不出"还没实现"；报告能。在它们的写入方出现之前，不要
基于它们构建功能。

`capabilities`（RPC 路由）与 availability 是两件不同的事实：前者列出*加载进这个
runtime 的能力记录*，后者列出*实现了哪些 API 成员且可达*。名字相近，事实不同。

worker 通道（TUI 使用）有自己的路由表与自己的如实报告。它的缺口——
`workgraph.*` 与 intelligence 查询未在其上路由——以 `implemented_unreachable`
呈现，而不是沉默。

## 7. 事件流与投影

`GET /events`（或 `/ws`）以 server-sent events 推送 `RuntimeEvent` 对象。

- 订阅带 `?session=…`；服务端强制凭据的 session 集合（见 §3）。
- `since` — 序列标记。`sdk.events({ since })` 从该标记重放；`since: 0` 从头重放
  （这是已记录的修复：`0` 是真实标记，不是"无"）。
- **静默流长寿。** server 的 HTTP idle 超时为 255s，因此安静的事件流不会在静默
  终端存活期间被杀掉。把它当推送通道，不是轮询。
- **delta 不持久。** `content.delta` 与 `thinking.delta` 仅实时存在，从不入 journal。
  重放 `session.history` 每个 provider 步只有一个 `content.done`，没有任何 delta。

用 `@natalia/view-store` 把流折叠成可渲染状态——这正是该包存在的理由。它投影大部分
runtime 事件类型，刻意跳过其余（dialog 与 terminal-pane-focus 事件仅 UI 用；§6 中
的事实事件没有写入方，投影它们等于宣传一个 runtime 没有的功能）。投影正确处理重试
不重复文本、隐藏 provider 禁止展示的推理、区分 `text`（已确认）与 `pendingText`
（在途）、并给每个可增长切片设界——只有 `messages` 无界（刻意为之）。

工具事件的 `id` 不是回合 id：runtime 以 `${turnID}:${callID}` 发布工具事件。
`view-store` 将其归一化并导出 `turnIDForTool`，让自行按键的状态与它一致。

**不带 `sessionID` 的事件是 runtime 级事件，任何被授权的 session 订阅者可见。**
今天多数事件类型不带 `sessionID`；规则是"无 session id = runtime 级"。这是当前单
runtime 形态的事实，多会话落地时复查。

### 回合生命周期

一次提交在实时流与 journal（`history` 重放）中按顺序产生：

1. `turn.submitted` — 请求被接受；`id` 是回合 id。
2. `thinking.delta` / `thinking.done` — 模型推理。可能缺席（provider 可禁止，
   此时 `view-store` 隐藏它）。delta 仅实时；重放只见 `thinking.done`。
3. `content.delta` / `content.done` — 可见回答。delta 仅实时、永不入 journal；
   重放每个 provider 步恰好一个 `content.done`。
4. `tool.update` — 每次工具调用一条；`id` 是 `` `${turnID}:${callID}` ``（见 §8）。
5. `turn.finished` — `stopReason`：`"done"`、`"cancelled"` 或 `"error"`；
   `reason: "missing_final_response"` 表示 provider 未给出响应就结束。回合等你
   回答时是 `turn.paused`；等待事件 `approval.request` / `question.request`
   携带你必须回答的请求。`turn.retry` 标记重试尝试。

### 审批与提问

- **审批是请求，不是你可以一直开着的门。** 等待事件（`approval.request`、
  `question.request`）携带 `id`、`title`、`preview`、可选 `detail` /
  `keyArguments`、`sensitive`（细节被对模型隐瞒）、`risk`
  （终端作用域为 `terminal_low` / `terminal_high`）、`scope`、`expiresAt`
  与 `revocable`。
- **审批会超时，超时不是取消。** 一旦有人回答，runtime 把模型选定的裁决交给
  审批；若无人回答，请求过期（`expiresAt`），之后再回答返回 `accepted: false`
  ——模型已被告知该调用没有执行。"没人回答"与"回合被取消"是两个不同事实，外部
  UI 必须区分渲染。
- **`scope` 是授权键，不是标签。** 批准一个审批即授予其 `scope` 给会话，同一
  作用域的后续请求（例如同一个工具）不再询问，直到作用域过期（`expiresAt`）
  或被撤销（`revocable`）。`respondApproval` 传 `accept: true` 即授予；授权是
  会话级的，从不入 journal。

## 8. 读会话

transcript 与 session 记录可按游标、按序列读取：

- `sdk.history({ after, limit })` — 按序列读 journal 事件，游标友好。
- `sdk.messages({ limit, order, cursor })` — 投影后的消息页。
- `sdk.sessionSnapshot()` / `sdk.snapshot()` — 当前状态快照。
- `sdk.pendingInteractive()` — 正在等待回答的审批与提问（支撑"外部 UI 接管审批"
  模式）。
- `sdk.workGraphNodes()` / `sdk.workGraphEdges()` — 持久因果记录：agent 动作、
  工具调用（含被拒的）、审批与工作区变更，以 `epi_*` id 关联。刻意不携带提示词、
  工具参数、输出或推理。

动工前值得知道的三件事：

- **`checkpoint()`、`checkpoints()`、`rollback()` 是 slash-command 别名，不是
  独立 API。** 它们提交真实回合（`/checkpoint`、`/checkpoints`、`/rollback`）：
  必须要有 provider 在场、回合真实运行、命令处理其余部分。专用成员是
  `checkpointList`、`checkpointPreview`、`checkpointRollback`（见生成路由表）；
  别名是为 TUI 便利存在。集成方请用专用成员。
- **会话记录可经 RPC 创建、归档与导出。** `newSession({ id?, title? })`
  （`session.new`）创建记录——按 id 幂等（已存在答 `created: false`，否则
  铸造 `ses_…` id）。`archiveSession`（`session.archive`）标记
  `archived: true`（仍可列出与导出）；`exportSession`（`session.export`）
  以 `{ seq, event }` 对导出 journal。RPC 仍不能做的是*激活*运行中 runtime
  的另一个会话——runtime 构造时绑定一个 session id；切换属于多会话设计，
  不是配置开关。
- **分页有两种游标风格。** `messages({ limit, order, cursor })` 返回
  `{ data, cursor: { previous?, next? } }`——传 `cursor.next` 向前翻、
  `cursor.previous` 向后翻。`history({ after, limit })` 返回
  `{ events, hasMore }`——`hasMore` 为 true 时把最后一条事件的序列当 `after`
  继续翻。

## 9. 写面

写是一等公民、独立授权面。不带 `write` 维度的凭据在写表（机器派生，见生成区块）中
的每个方法上被拒绝为 `-32001 refused`。写面覆盖：提交与回合控制、审批与提问、
agent/model 选择、config 重载与更新、checkpoint 回滚、sandbox merge/delete 与
resource stop、session 管理（touch/rename/pin/duplicate/fork/delete）、native
terminal 控制（含 secure-input begin/end——远程结束人类的安全输入是最强的写）、
以及 flow 文档 save/delete。

任务执行是独立端点：`POST /tasks/run`。它不是 JSON-RPC 路由，也不在写表内：只有
host 显式安装了 `runTask` handler 才存在，否则一律 `404`。启用的部署自行决定谁能
访问。

**终端写面由 host 门控，默认关闭。** `nativeTerminal` 组的 `start`、`write`、
`resize` 是下方写表中的写，且 host 还必须额外启用（http server 选项
`terminalWrite: true`）之后才能被调用——未启用时它们回 `-32001 refused`
（"terminal write is not enabled by this host"），与 `/tasks/run` 同形态。
只读凭据在门控之前就已被授权层拒绝（"no write scope"）。远程调用者视同模型侧
参与者：人类持有时或安全输入进行中拒绝 `write`；`idempotencyKey` 重放答
`delivery: "duplicate"` 而不是写两次；`resize` 与模型侧工具走同一个安全输入
互锁。

**按路径幂等。** `flow.save`（`sdk.saveFlowDocument({ path?, document })`）以路径
为幂等键：重放同一保存第一次答 `created: true`，之后答 `updated: true`。
`flow.delete` 对已删除的路径答 `alreadyDeleted: true`。越界工作区的路径、或被 task
引用的 flow，是类型化拒绝（`refused`），绝不是异常。

**校验是值，不是异常。** `task.preview`（`sdk.taskPermissionPreview({ path })`）
返回 `{ valid, problems, blocked, conditionlessModules }`，编排器可在投递前检查
task 文档。

**config 写与 reload 同一拒绝语义。** `config.update`
（`sdk.updateConfig({ patch, scope })`）写入 patch、合并并应用；回合进行中拒绝应用
是值（`applied: false` 带原因），与 `reloadConfig` 同形状。TUI 设置菜单与远程消费
者走同一条路。

### 附件（图片、视频、PDF 与文本）

`prompt(text, { attachments })` 与 `submitInput` 接受 workspace 相对路径；
runtime 嗅探**字节**（魔数，不是扩展名），存入 `.natalia/attachments` 并降级为
provider 请求：

| 媒体 | 接受类型 | 如何到达模型 |
| --- | --- | --- |
| 图片 | `image/png`、`image/jpeg`、`image/webp`、`image/gif` | provider 原生图片内容 |
| 视频 | `video/mp4`、`video/webm` | inline 视频——目前仅 Gemini（§11） |
| PDF | `application/pdf` | provider 原生文档内容 |
| 文本 | `text/plain`、`text/markdown`、`application/json`、`text/csv` | 读入并拼进用户消息 |

- **框架无大小上限。** 模型/provider 才是"装不装得下"的权威；由 provider 自身
  限制驱动的上下文长度检查是后续功能，不是硬编码常数。
- **两道门都查。** 所选模型的声明能力（`imageInput`、`pdfInput`、
  `videoInput`）与 provider 适配器的 lowering 支持必须都接受该附件；不匹配时
  回合被拒，消息点名缺的是哪一侧。
- 字节不匹配任何已知类型被拒；越出 workspace 的路径被拒。文件名像图片但字节
  不是图片的附件被嗅探拒绝，而不是被信任。
- **TUI 有三种入队方式**：`Alt+A`（输入 workspace 相对路径）、`Alt+Y`
  （从系统剪贴板粘贴图片——Linux 需 `wl-paste`/`xclip`，macOS 需
  `osascript`，Windows 需 PowerShell）、以及把文件拖进终端：多数终端把拖入
  的文件以路径文本粘贴，TUI 识别"每行都是已存在 workspace 文件"的粘贴文本并
  自动入队为附件。`Alt+X` 直接在输入框删除最近加入的附件（例如刚粘贴的
  单张图片）；`Alt+O` 打开完整列表，其中 `Alt+X` 删除选中项。用 Alt 组合
  是为了避开终端与输入法抢占的 Ctrl+Shift 组合键。

### 管理面（配置面）

部署要配置的一切都能经 RPC 配置——用与配置文件相同的 schema 校验、写入同一
文件、走同一条 reload 路径。除两个读操作外全部在写表内：

- **权限 profile** — `permissionList`（读）、`permissionSave`（创建或替换；
  运行中的回合可能阻塞 reload 并答 `applied: false`）、`permissionDelete`
  （幂等；当前默认 profile 拒绝删除）。
- **MCP 服务器** — `mcpServerAdd`（创建或替换；runtime 写配置并重连，连接
  失败以诊断呈现）、`mcpServerRemove`（幂等）。服务器配置用 MCP 官方字段集
  （`type`、`command`、`args`、`url`、`headers`、`environment`…）。
- **Agent** — `agentCreate`（已存在答 `created: false`）、`agentUpdate`、
  `agentDelete`（幂等；默认 agent 拒绝）。
- **Provider** — `providerDiscover`（对 `{type, baseURL, apiKey}` 探测
  provider 的 models 端点，只读）、`providerAdd`（创建或替换，立即生效）、
  `providerRemove`（幂等；被模型引用的 provider 拒绝）。apiKey 只在这些调用
  的请求体里过线——接触它们的凭据请用带 `management` 组的作用域凭据。
- **插件** — `pluginUnload`（幂等）、`pluginReload`（卸载并按 manifest 路径
  重新 import，破除 import 缓存）。

`management` 组（`permissionList`/`permissionSave`/`permissionDelete`）让部署
可以签发一把"只配策略、不碰其余面"的凭据。

## 10. 示例（可执行，不是散文）

conformance 套件 `packages/sdk/test/consumer-conformance.test.ts` 是本文档的契约
可执行形态——18 条测试、8 个场景族，只用消费面包，对着真实 runtime 走真实传输：

1. **回合渲染闭环** — 提交提示词、消费事件、重放 history、用 `view-store` 折叠
   （guide 里的最小循环）。
2. **五类失败区分** — 每个失败类型可程序化区分；值型拒绝被断言。
3. **对 stub runtime 的能力协商** — 最小必需集 runtime 如实答 `-32000`，报告如此
   陈述。
4. **外部 UI 接管审批** — 渲染 `approval.request`，经 `respondApproval` 回答，
   观察回合继续；被拒的审批以 policy decision 到达，而不是谎言。
5. **外部编排器** — 提交、消费事件流、沿 Work Graph 因果走查、读 task 概览。
6. **只读集成方** — 一个 server 两把凭据：只读方渲染会话、在每个写上被拒且报告
   如实、永远看不到其他 session 的事件。
7. **路由面** — 每条 P0-C 路由至少调用一次，包括恒空查询与 `capabilities`。
8. **管理面** — 外部集成方经 RPC 创建/归档会话、编辑权限 profile/agent/
   provider、驱动插件生命周期，全部幂等。

如果你需要本文档承诺的某件事而 conformance 测试没覆盖，先扩测试——缺口因此变成
被追踪的事实，而不是意外。

## 11. 已知限制与路线图

以下内容刻意不在 v1 面内，提前说明以便规划而不是撞见：

- **一个 server 一个 runtime。** 无 session 路由，无多租户。多会话是规划中的协议
  演进，不是配置开关。
- **无 out-of-tree capability 加载。** 能力仅在仓库内注册。plugin 可贡献 tools、
  commands 与事件监听，但 plugin 是进程内 `import()` 加载，仅路径包含与扩展名
  白名单，无 VM、无文件系统限制、无超时——**plugin 是可信代码，不是沙箱**。
  `settings`、`workflows`、`projection` 三个 grant 已声明但 host 无代码读取；
  贡献它们目前是惰性的。
- **五个事实查询恒空**，直到其生产写入方出现（§6）。不要基于它们构建功能。
- **终端写面由 host 门控，默认关闭。** `nativeTerminal` 组经 RPC 暴露完整的
  交互式终端面：`list`、`read`、`start`、`write`、`resize`、`stop`、`openHub`、
  `revokeApprovalScope`、`releaseHumanControl`、`beginSecureInput`、
  `endSecureInput`。其中 `start`、`write`、`resize` 是终端写面（P0-H）：host
  必须显式启用（http server 选项 `terminalWrite: true`），否则这三个路由一律回
  `-32001 refused`（"terminal write is not enabled by this host"）——远程终端
  写等于远程 shell，因此启用是部署决定，与 `/tasks/run` 完全一致。远程调用者
  在所有权与安全输入仲裁中视同模型侧参与者：人类持有时或安全输入进行中拒绝
  写入；重放 `idempotencyKey` 答 `delivery: "duplicate"` 而不是写两次。
- **worker 通道**（TUI 进程内代理）路由 API 子集并如实报告其余；它不是第二个公开
  集成目标。
- **多数事件今天不带 `sessionID`**；"runtime 级、任何被授权订阅者可见"的规则在
  多会话落地时复查。
- **视频附件目前仅 Gemini。** Gemini 适配器把 `video/mp4` 与 `video/webm`
  降级为 inline 视频；Anthropic 与 OpenAI 兼容适配器答 `videoInput: false`，
  视频附件会被拒绝，消息点名适配器。

---

## 12. 线级协议

以下是 SDK 已经在说的内容；本节让你可以不依赖 SDK 实现客户端，或审计抓包。不想
手写 fetch 的类型化替代是 `@natalia/transport` 的 `callRuntimeRPC`。

### JSON-RPC

`POST {baseURL}/rpc`，`Content-Type: application/json`：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompt",
  "params": { "text": "explain this repository" }
}
```

成功：

```json
{ "jsonrpc": "2.0", "id": 1, "result": { "type": "turn.submitted", "id": "turn_1", "text": "…" } }
```

失败——被分类的失败 HTTP 状态**一律 400**，error 携带 code 与结构化 data：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "authorization refused: this credential has no write scope",
    "data": { "kind": "refused", "reason": "authorization refused: this credential has no write scope" }
  }
}
```

`data.kind` 是 §5 五类之一。`notSupported` 的 `data` 携带 `member` / `capability`，
`refused` 携带 `reason`，`internal` 携带 `errorID`。鉴权失败是 `401` 且返回
`{ "error": "unauthorized" }`，缺 token 与错 token 刻意不可区分。

### 健康检查

`GET /healthz` — 无需鉴权、无参数：

```json
{ "ok": true, "apiVersion": 1 }
```

SDK 在首次调用前读它一次，遇到比它认识的更新的版本时拒绝猜测（§5）。

### 事件

`GET /events?session=ses_…&since=…` — SSE 流，server 启用鉴权时需要
`Authorization: Bearer …`。每个事件是一行 `data:` 的 JSON `RuntimeEvent`；事件间以
空行分隔：

```
data: {"type":"turn.submitted","id":"turn_1","text":"hi"}

data: {"type":"thinking.delta","id":"turn_1","text":"Let me","episodeID":"epi_…"}
```

- `session` — 凭据的 session 集合在订阅时校验；越界为 `403`。
- `since` — 从该序列标记重放；`0` 从头重放。
- 同一流可通过 WebSocket 的 `/ws` 获取。

### 运行任务

`POST /tasks/run` — 独立端点，不是 JSON-RPC 路由。仅当 host 安装了 `runTask`
handler 时存在；否则回 `404 { "error": "task delivery is not enabled" }`。非 POST
为 `405`，无 `taskPath` 的请求体为 `400`：

```json
{ "taskPath": "flows/check.yaml", "workspaceRoot": "/home/me/proj", "json": true }
```

响应为投递结果：`{ invocationID, status, waterlineAdvanced, exitCode, output }`。
`json: true` 把任务自身输出切换为 JSON。此端点不在写表内——启用的部署自行决定谁
能访问。

---

## 13. 部署

### Daemon

CLI 把 runtime 作为后台 daemon 运行：

```sh
natalia daemon --port 4700
```

- daemon 首次启动时自己签发 bearer token：32 字节随机数、base64url，写入 daemon
  目录的 `token` 文件（权限 `0o600`），之后复用。CLI 优先读环境变量
  `NATALIA_TRANSPORT_TOKEN`，否则读 token 文件。
- `natalia daemon-status` 报告已注册的 daemon；`natalia daemon-stop` 停止它。
  `--daemon-dir` 覆盖 daemon 状态目录；`--max-concurrent-tasks` 限制并行任务
  投递。
- daemon 是常驻 server，不是 REPL 包装：它提供本文档描述的完整面（RPC、
  `/events`、配置了任务控制器时的 `/tasks/run`、只有 `terminalWrite: true`
  时的终端写）。

### 不用 daemon 的托管

`createRuntimeHttpServer`（来自 `@natalia/transport/host`）serve 任意
`RuntimeClient`：

```ts
createRuntimeHttpServer({
  client: runtime,
  hostname: "127.0.0.1",
  port: 4700,
  token: "a-secret-you-generate",
  // 或
  authorization: { credentials: [{ token: "ro", write: false }, { token: "op" }] },
  unix: "/tmp/natalia.sock",        // 用 unix socket 代替 TCP
  tls: { cert: "…", key: "…" },     // 进程内 TLS 终结
  events: true,                     // SSE/WS 事件流（默认开）
  runTask: async (request) => …,    // 启用 POST /tasks/run
  terminalWrite: true,              // 启用终端写面
});
```

部署注意：

- **token 文件与 `token` 是 bearer 凭据——当密码对待。** daemon 以 `0o600`
  写入；自定义 host 也应如此。轮换 = 替换文件（或选项）后重启。
- **`open: true` 只用于本地开发。** 它打一条启动 warning 并放行任何调用者；
  没有凭据的部署是没有攻击者模型的部署。
- **把 runtime 放在你自己的网络边界后面。** 一个 server 是一个 runtime，不是
  多租户服务；runtime 的凭据门控 API，不实现限流、配额或身份联邦。
- **TLS 与 unix socket 是传输层选择。** 两者都是 `createRuntimeHttpServer` 的
  普通选项；都不设置时，server 监听 `hostname:port`（默认 `127.0.0.1`）。

---


<!-- api-reference:generated -->
## Machine-derived reference

> All numbers and tables below are derived from the source tables the transport and the contracts use. Regenerate with `npm run docs:api-reference`. A hand edit inside this block, or any disagreement with the code, turns `packages/transport/test/api-reference.test.ts` red.

### Protocol version

- `apiVersion` = `1` (`API_VERSION`).
- Stable required surface (`API_STABLE_SURFACE.requiredMembers`, 8 members):
  `start`, `submit`, `cancel`, `snapshot`, `diagnostic`, `lastSubmission`, `respondApproval`, `respondQuestion`.
- Deprecated members (`DEPRECATED_RUNTIME_MEMBERS`): none (mechanism in place, table empty).

### Capability groups (16 groups · 87 optional members)

| Group          | Members (RuntimeClient names)                                                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| transcript     | `history` · `messages` · `pendingInteractive` · `submitInput`                                                                                                                                                                                                                                                         |
| turnControl    | `pause` · `resume`                                                                                                                                                                                                                                                                                                    |
| lifecycle      | `dispose` · `canReloadConfig` · `reloadConfig` · `updateConfig`                                                                                                                                                                                                                                                       |
| selection      | `agents` · `selectAgent` · `modelCatalog` · `modelSelection` · `selectModel` · `skills` · `agentCreate` · `agentUpdate` · `agentDelete` · `providerDiscover` · `providerAdd` · `providerRemove`                                                                                                                       |
| workspace      | `workspaceFiles` · `workspaceSearch` · `workspaceList` · `workspaceRead` · `workspaceGlob`                                                                                                                                                                                                                            |
| nativeTerminal | `nativeTerminalList` · `nativeTerminalRead` · `nativeTerminalOpenHub` · `nativeTerminalRevokeApprovalScope` · `nativeTerminalReleaseHumanControl` · `nativeTerminalBeginSecureInput` · `nativeTerminalEndSecureInput` · `nativeTerminalStop` · `nativeTerminalStart` · `nativeTerminalWrite` · `nativeTerminalResize` |
| checkpoint     | `checkpointList` · `checkpointPreview` · `checkpointRollback`                                                                                                                                                                                                                                                         |
| sandbox        | `sandboxList` · `sandboxDiff` · `sandboxResources` · `sandboxResourceOutput` · `sandboxMerge` · `sandboxDelete` · `sandboxResourceStop`                                                                                                                                                                               |
| sessions       | `sessionList` · `sessionTouch` · `sessionRename` · `sessionPin` · `sessionDuplicate` · `sessionFork` · `sessionDelete` · `sessionNew` · `sessionArchive` · `sessionExport`                                                                                                                                            |
| mcp            | `mcpCatalog` · `getMcpPrompt` · `readMcpResource` · `mcpServerAdd` · `mcpServerRemove`                                                                                                                                                                                                                                |
| extensions     | `plugins` · `commandCatalog` · `capabilities` · `pluginUnload` · `pluginReload`                                                                                                                                                                                                                                       |
| management     | `permissionList` · `permissionSave` · `permissionDelete`                                                                                                                                                                                                                                                              |
| automation     | `taskOverview` · `flowOverview` · `documentCatalog` · `saveFlowDocument` · `deleteFlowDocument` · `taskPermissionPreview`                                                                                                                                                                                             |
| observability  | `runtimeStatus` · `diagnostics` · `sessionSnapshot`                                                                                                                                                                                                                                                                   |
| workGraph      | `workGraphNodes` · `workGraphEdges`                                                                                                                                                                                                                                                                                   |
| intelligence   | `constitutionRules` · `decisionRecords` · `evidenceRecords` · `driftFindings` · `registeredTools`                                                                                                                                                                                                                     |

### RPC route table (92 methods → members)

| RPC method                           | RuntimeClient member                | Capability group | Write |
| ------------------------------------ | ----------------------------------- | ---------------- | ----- |
| `prompt`                             | `submit`                            | required         | write |
| `cancel`                             | `cancel`                            | required         | write |
| `snapshot`                           | `snapshot`                          | required         | read  |
| `approval.respond`                   | `respondApproval`                   | required         | write |
| `question.respond`                   | `respondQuestion`                   | required         | write |
| `interactive.pending`                | `pendingInteractive`                | transcript       | read  |
| `session.history`                    | `history`                           | transcript       | read  |
| `session.messages`                   | `messages`                          | transcript       | read  |
| `pause`                              | `pause`                             | turnControl      | write |
| `resume`                             | `resume`                            | turnControl      | write |
| `config.canReload`                   | `canReloadConfig`                   | lifecycle        | read  |
| `config.reload`                      | `reloadConfig`                      | lifecycle        | write |
| `config.update`                      | `updateConfig`                      | lifecycle        | write |
| `agent.list`                         | `agents`                            | selection        | read  |
| `agent.select`                       | `selectAgent`                       | selection        | write |
| `model.catalog`                      | `modelCatalog`                      | selection        | read  |
| `model.selection`                    | `modelSelection`                    | selection        | read  |
| `model.select`                       | `selectModel`                       | selection        | write |
| `skills.list`                        | `skills`                            | selection        | read  |
| `workspace.files`                    | `workspaceFiles`                    | workspace        | read  |
| `workspace.search`                   | `workspaceSearch`                   | workspace        | read  |
| `workspace.list`                     | `workspaceList`                     | workspace        | read  |
| `workspace.read`                     | `workspaceRead`                     | workspace        | read  |
| `workspace.glob`                     | `workspaceGlob`                     | workspace        | read  |
| `checkpoint.list`                    | `checkpointList`                    | checkpoint       | read  |
| `checkpoint.preview`                 | `checkpointPreview`                 | checkpoint       | read  |
| `checkpoint.rollback`                | `checkpointRollback`                | checkpoint       | write |
| `sandbox.list`                       | `sandboxList`                       | sandbox          | read  |
| `sandbox.diff`                       | `sandboxDiff`                       | sandbox          | read  |
| `sandbox.resources`                  | `sandboxResources`                  | sandbox          | read  |
| `sandbox.resource.output`            | `sandboxResourceOutput`             | sandbox          | read  |
| `sandbox.merge`                      | `sandboxMerge`                      | sandbox          | write |
| `sandbox.delete`                     | `sandboxDelete`                     | sandbox          | write |
| `sandbox.resource.stop`              | `sandboxResourceStop`               | sandbox          | write |
| `session.list`                       | `sessionList`                       | sessions         | read  |
| `session.touch`                      | `sessionTouch`                      | sessions         | write |
| `session.rename`                     | `sessionRename`                     | sessions         | write |
| `session.pin`                        | `sessionPin`                        | sessions         | write |
| `session.duplicate`                  | `sessionDuplicate`                  | sessions         | write |
| `session.fork`                       | `sessionFork`                       | sessions         | write |
| `session.delete`                     | `sessionDelete`                     | sessions         | write |
| `session.new`                        | `sessionNew`                        | sessions         | write |
| `session.archive`                    | `sessionArchive`                    | sessions         | write |
| `session.export`                     | `sessionExport`                     | sessions         | read  |
| `mcp.catalog`                        | `mcpCatalog`                        | mcp              | read  |
| `mcp.prompt`                         | `getMcpPrompt`                      | mcp              | read  |
| `mcp.resource`                       | `readMcpResource`                   | mcp              | read  |
| `mcp.server.add`                     | `mcpServerAdd`                      | mcp              | write |
| `mcp.server.remove`                  | `mcpServerRemove`                   | mcp              | write |
| `permission.list`                    | `permissionList`                    | management       | read  |
| `permission.save`                    | `permissionSave`                    | management       | write |
| `permission.delete`                  | `permissionDelete`                  | management       | write |
| `agent.create`                       | `agentCreate`                       | selection        | write |
| `agent.update`                       | `agentUpdate`                       | selection        | write |
| `agent.delete`                       | `agentDelete`                       | selection        | write |
| `provider.discover`                  | `providerDiscover`                  | selection        | read  |
| `provider.add`                       | `providerAdd`                       | selection        | write |
| `provider.remove`                    | `providerRemove`                    | selection        | write |
| `plugin.unload`                      | `pluginUnload`                      | extensions       | write |
| `plugin.reload`                      | `pluginReload`                      | extensions       | write |
| `plugin.list`                        | `plugins`                           | extensions       | read  |
| `command.catalog`                    | `commandCatalog`                    | extensions       | read  |
| `task.overview`                      | `taskOverview`                      | automation       | read  |
| `flow.overview`                      | `flowOverview`                      | automation       | read  |
| `document.catalog`                   | `documentCatalog`                   | automation       | read  |
| `runtime.availability`               | (availability route, no member)     | —                | read  |
| `runtime.status`                     | `runtimeStatus`                     | observability    | read  |
| `diagnostics.list`                   | `diagnostics`                       | observability    | read  |
| `workgraph.nodes`                    | `workGraphNodes`                    | workGraph        | read  |
| `workgraph.edges`                    | `workGraphEdges`                    | workGraph        | read  |
| `nativeTerminal.list`                | `nativeTerminalList`                | nativeTerminal   | read  |
| `nativeTerminal.read`                | `nativeTerminalRead`                | nativeTerminal   | read  |
| `nativeTerminal.stop`                | `nativeTerminalStop`                | nativeTerminal   | write |
| `nativeTerminal.openHub`             | `nativeTerminalOpenHub`             | nativeTerminal   | write |
| `nativeTerminal.revokeApprovalScope` | `nativeTerminalRevokeApprovalScope` | nativeTerminal   | write |
| `nativeTerminal.releaseHumanControl` | `nativeTerminalReleaseHumanControl` | nativeTerminal   | write |
| `nativeTerminal.beginSecureInput`    | `nativeTerminalBeginSecureInput`    | nativeTerminal   | write |
| `nativeTerminal.endSecureInput`      | `nativeTerminalEndSecureInput`      | nativeTerminal   | write |
| `nativeTerminal.start`               | `nativeTerminalStart`               | nativeTerminal   | write |
| `nativeTerminal.write`               | `nativeTerminalWrite`               | nativeTerminal   | write |
| `nativeTerminal.resize`              | `nativeTerminalResize`              | nativeTerminal   | write |
| `constitution.rules`                 | `constitutionRules`                 | intelligence     | read  |
| `decision.records`                   | `decisionRecords`                   | intelligence     | read  |
| `evidence.records`                   | `evidenceRecords`                   | intelligence     | read  |
| `drift.findings`                     | `driftFindings`                     | intelligence     | read  |
| `tools.registered`                   | `registeredTools`                   | intelligence     | read  |
| `capabilities`                       | `capabilities`                      | extensions       | read  |
| `session.snapshot`                   | `sessionSnapshot`                   | observability    | read  |
| `submit.input`                       | `submitInput`                       | transcript       | write |
| `flow.save`                          | `saveFlowDocument`                  | automation       | write |
| `flow.delete`                        | `deleteFlowDocument`                | automation       | write |
| `task.preview`                       | `taskPermissionPreview`             | automation       | read  |

### Write surface (`RPC_WRITE_METHODS`, 45 methods; read-only credentials get `-32001 refused`)

- `prompt`
- `cancel`
- `submit.input`
- `approval.respond`
- `question.respond`
- `pause`
- `resume`
- `agent.select`
- `model.select`
- `config.reload`
- `config.update`
- `checkpoint.rollback`
- `sandbox.merge`
- `sandbox.delete`
- `sandbox.resource.stop`
- `session.touch`
- `session.rename`
- `session.pin`
- `session.duplicate`
- `session.fork`
- `session.delete`
- `session.new`
- `session.archive`
- `mcp.server.add`
- `mcp.server.remove`
- `permission.save`
- `permission.delete`
- `agent.create`
- `agent.update`
- `agent.delete`
- `provider.add`
- `provider.remove`
- `plugin.unload`
- `plugin.reload`
- `nativeTerminal.stop`
- `nativeTerminal.revokeApprovalScope`
- `nativeTerminal.releaseHumanControl`
- `nativeTerminal.beginSecureInput`
- `nativeTerminal.endSecureInput`
- `nativeTerminal.openHub`
- `nativeTerminal.start`
- `nativeTerminal.write`
- `nativeTerminal.resize`
- `flow.save`
- `flow.delete`

### Intentionally local members (`RPC_INTENTIONALLY_LOCAL`; reported as `intentionally local`)

| Member           | Reason                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| `dispose`        | intentionally local: a remote caller must not dispose another party's runtime       |
| `start`          | intentionally local: remote consumers subscribe to /events instead of calling start |
| `lastSubmission` | intentionally local: a local read of the most recent submission                     |
| `diagnostic`     | intentionally local: one-way publishing from a local caller, not a query            |

### Empty-until-writers queries (`UNIMPLEMENTED_QUERIES`: reachable, implemented, no production writer yet)

| Member              | Why it answers empty                               |
| ------------------- | -------------------------------------------------- |
| `constitutionRules` | no production code records constitution rules yet  |
| `decisionRecords`   | no production code records decisions yet           |
| `evidenceRecords`   | no production code records validation evidence yet |
| `driftFindings`     | no production code opens drift findings yet        |
| `registeredTools`   | tool registration metadata is not published yet    |

### Failure codes (`RUNTIME_RPC_ERROR_CODES`)

| Kind             | Code   | Meaning                                                                 |
| ---------------- | ------ | ----------------------------------------------------------------------- |
| `invalidRequest` | -32600 | The envelope is not a request.                                          |
| `methodNotFound` | -32601 | No route by that name.                                                  |
| `invalidParams`  | -32602 | The route exists and the arguments are wrong. Only that.                |
| `notSupported`   | -32000 | The route exists; this runtime does not implement the member behind it. |
| `refused`        | -32001 | Policy or current state says no. Carries a reason.                      |
| `internal`       | -32603 | Anything else. Carries no detail — see `RuntimeFailureData`.            |

### Events and projection (source scan)

- Runtime event types (`RuntimeEventData` union): 69.
- view-store projections (`case` labels in `packages/view-store/src`): 57.

### SDK methods → RPC routes (source scan of `packages/sdk/src/index.ts`)

| SDK method                          | RPC method                           | Params                                                                     | Return type                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cancel`                            | `cancel`                             | `reason?`: string                                                          | void                                                                                                                                                                                                                                                                                                                |
| `pause`                             | `pause`                              | `reason?`: string                                                          | PauseOutcome                                                                                                                                                                                                                                                                                                        |
| `resume`                            | `resume`                             | —                                                                          | ResumeOutcome                                                                                                                                                                                                                                                                                                       |
| `selectAgent`                       | `agent.select`                       | `name?`: string                                                            | AgentSelectionOutcome                                                                                                                                                                                                                                                                                               |
| `agents`                            | `agent.list`                         | —                                                                          | RuntimeAgentCatalogEntry[]                                                                                                                                                                                                                                                                                          |
| `modelCatalog`                      | `model.catalog`                      | —                                                                          | RuntimeModelCatalogEntry[]                                                                                                                                                                                                                                                                                          |
| `modelSelection`                    | `model.selection`                    | —                                                                          | RuntimeModelSelection                                                                                                                                                                                                                                                                                               |
| `selectModel`                       | `model.select`                       | `modelID?`: string, `variant?`: string                                     | void                                                                                                                                                                                                                                                                                                                |
| `skills`                            | `skills.list`                        | —                                                                          | RuntimeSkillCatalogEntry[]                                                                                                                                                                                                                                                                                          |
| `workspaceFiles`                    | `workspace.files`                    | `input?`: { query?: string; type?: "file" | "directory"; limit?: number; } | RuntimeWorkspaceFileEntry[]                                                                                                                                                                                                                                                                                         |
| `workspaceSearch`                   | `workspace.search`                   | `input`: { query: string; include?: string; limit?: number; }              | RuntimeWorkspaceMatch[]                                                                                                                                                                                                                                                                                             |
| `workspaceList`                     | `workspace.list`                     | `input?`: { path?: string; offset?: number; limit?: number; }              | RuntimeWorkspaceListPage                                                                                                                                                                                                                                                                                            |
| `workspaceRead`                     | `workspace.read`                     | `input`: { path: string; offset?: number; limit?: number; }                | RuntimeWorkspaceContent                                                                                                                                                                                                                                                                                             |
| `workspaceGlob`                     | `workspace.glob`                     | `input`: { pattern: string; path?: string; limit?: number; }               | RuntimeWorkspaceFileEntry[]                                                                                                                                                                                                                                                                                         |
| `sessions`                          | `session.list`                       | —                                                                          | RuntimeSessionSummary[]                                                                                                                                                                                                                                                                                             |
| `touchSession`                      | `session.touch`                      | `id`: string                                                               | void                                                                                                                                                                                                                                                                                                                |
| `renameSession`                     | `session.rename`                     | `id`: string, `title`: string                                              | RuntimeSessionSummary                                                                                                                                                                                                                                                                                               |
| `pinSession`                        | `session.pin`                        | `id`: string, `pinned`: boolean                                            | RuntimeSessionSummary                                                                                                                                                                                                                                                                                               |
| `duplicateSession`                  | `session.duplicate`                  | `id`: string, `title?`: string                                             | RuntimeSessionSummary                                                                                                                                                                                                                                                                                               |
| `forkSession`                       | `session.fork`                       | `id`: string, `turnID`: string, `title?`: string                           | RuntimeSessionSummary                                                                                                                                                                                                                                                                                               |
| `deleteSession`                     | `session.delete`                     | `id`: string                                                               | { id: string; removedAttachments: number }                                                                                                                                                                                                                                                                          |
| `newSession`                        | `session.new`                        | `input?`: { id?: string; title?: string; }                                 | { sessionID: string; created: boolean }                                                                                                                                                                                                                                                                             |
| `archiveSession`                    | `session.archive`                    | `id`: string                                                               | { id: string; archived: boolean }                                                                                                                                                                                                                                                                                   |
| `exportSession`                     | `session.export`                     | `id`: string                                                               | { sessionID: string; title: string; createdAt: string; archived: boolean; events: Array<{ seq: number; event: RuntimeEvent }>; }                                                                                                                                                                                    |
| `permissionList`                    | `permission.list`                    | —                                                                          | { default: string; profiles: Array<{ name: string } & PermissionProfile>; }                                                                                                                                                                                                                                         |
| `permissionSave`                    | `permission.save`                    | `input`: { name: string; profile: PermissionProfile; }                     | { saved: boolean; applied: boolean; reason?: string }                                                                                                                                                                                                                                                               |
| `permissionDelete`                  | `permission.delete`                  | `name`: string                                                             | { deleted: boolean; reason?: string; }                                                                                                                                                                                                                                                                              |
| `mcpServerAdd`                      | `mcp.server.add`                     | `input`: { name: string; config: MCPServerConfig; }                        | { saved: boolean }                                                                                                                                                                                                                                                                                                  |
| `mcpServerRemove`                   | `mcp.server.remove`                  | `name`: string                                                             | { removed: boolean }                                                                                                                                                                                                                                                                                                |
| `createAgent`                       | `agent.create`                       | `input`: { name: string; config: AgentConfig; }                            | { created: boolean; reason?: string }                                                                                                                                                                                                                                                                               |
| `updateAgent`                       | `agent.update`                       | `input`: { name: string; config: AgentConfig; }                            | { updated: boolean }                                                                                                                                                                                                                                                                                                |
| `deleteAgent`                       | `agent.delete`                       | `name`: string                                                             | { deleted: boolean; reason?: string; }                                                                                                                                                                                                                                                                              |
| `discoverProvider`                  | `provider.discover`                  | `input`: { type: string; baseURL: string; apiKey: string; }                | { models: string[] }                                                                                                                                                                                                                                                                                                |
| `addProvider`                       | `provider.add`                       | `input`: { name: string; type: string; baseURL?: string; apiKey: string; } | { saved: boolean }                                                                                                                                                                                                                                                                                                  |
| `removeProvider`                    | `provider.remove`                    | `name`: string                                                             | { removed: boolean; reason?: string; }                                                                                                                                                                                                                                                                              |
| `unloadPlugin`                      | `plugin.unload`                      | `id`: string                                                               | { unloaded: boolean }                                                                                                                                                                                                                                                                                               |
| `reloadPlugin`                      | `plugin.reload`                      | `id`: string                                                               | { reloaded: boolean }                                                                                                                                                                                                                                                                                               |
| `respondApproval`                   | `approval.respond`                   | `response`: ApprovalResponse                                               | InteractiveResponseOutcome                                                                                                                                                                                                                                                                                          |
| `respondQuestion`                   | `question.respond`                   | `response`: QuestionResponse                                               | InteractiveResponseOutcome                                                                                                                                                                                                                                                                                          |
| `pendingInteractive`                | `interactive.pending`                | —                                                                          | { approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>; questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>; }                                                                                                                                                                   |
| `checkpoint`                        | `prompt`                             | —                                                                          | SubmittedTurn                                                                                                                                                                                                                                                                                                       |
| `checkpoints`                       | `prompt`                             | `limit?`: number                                                           | SubmittedTurn                                                                                                                                                                                                                                                                                                       |
| `rollback`                          | `prompt`                             | `checkpointID`: string, `options?`: { dryRun?: boolean }                   | SubmittedTurn                                                                                                                                                                                                                                                                                                       |
| `checkpointList`                    | `checkpoint.list`                    | —                                                                          | RuntimeCheckpoint[]                                                                                                                                                                                                                                                                                                 |
| `checkpointPreview`                 | `checkpoint.preview`                 | `id`: string                                                               | CheckpointPreview                                                                                                                                                                                                                                                                                                   |
| `checkpointRollback`                | `checkpoint.rollback`                | `input`: { id: string; dryRun?: boolean; }                                 | CheckpointPreview                                                                                                                                                                                                                                                                                                   |
| `sandboxList`                       | `sandbox.list`                       | —                                                                          | RuntimeSandbox[]                                                                                                                                                                                                                                                                                                    |
| `sandboxDiff`                       | `sandbox.diff`                       | `id`: string                                                               | RuntimeSandboxChange[]                                                                                                                                                                                                                                                                                              |
| `sandboxResources`                  | `sandbox.resources`                  | `id`: string                                                               | RuntimeSandboxResource[]                                                                                                                                                                                                                                                                                            |
| `sandboxResourceOutput`             | `sandbox.resource.output`            | `input`: { id: string; resourceID: string; maxBytes?: number; }            | string                                                                                                                                                                                                                                                                                                              |
| `sandboxMerge`                      | `sandbox.merge`                      | `id`: string                                                               | RuntimeSandboxChange[]                                                                                                                                                                                                                                                                                              |
| `sandboxDelete`                     | `sandbox.delete`                     | `id`: string                                                               | { pendingChanges: RuntimeSandboxChange[]; runningResources: string[]; }                                                                                                                                                                                                                                             |
| `sandboxResourceStop`               | `sandbox.resource.stop`              | `input`: { id: string; resourceID: string; }                               | RuntimeSandboxResource                                                                                                                                                                                                                                                                                              |
| `snapshot`                          | `snapshot`                           | —                                                                          | RuntimeEvent                                                                                                                                                                                                                                                                                                        |
| `history`                           | `session.history`                    | `options?`: { after?: number; limit?: number }                             | { events: Array<{ seq: number; event: RuntimeEvent }>; hasMore: boolean; }                                                                                                                                                                                                                                          |
| `messages`                          | `session.messages`                   | `options?`: { limit?: number; order?: "asc" | "desc"; cursor?: string; }   | RuntimeMessagePage                                                                                                                                                                                                                                                                                                  |
| `mcpCatalog`                        | `mcp.catalog`                        | —                                                                          | MCPCatalogSnapshot                                                                                                                                                                                                                                                                                                  |
| `mcpPrompt`                         | `mcp.prompt`                         | `server`: string, `name`: string                                           | unknown                                                                                                                                                                                                                                                                                                             |
| `mcpResource`                       | `mcp.resource`                       | `server`: string, `uri`: string                                            | unknown                                                                                                                                                                                                                                                                                                             |
| `plugins`                           | `plugin.list`                        | —                                                                          | PluginStatus[]                                                                                                                                                                                                                                                                                                      |
| `commandCatalog`                    | `command.catalog`                    | —                                                                          | ContributedCommand[]                                                                                                                                                                                                                                                                                                |
| `workGraphNodes`                    | `workgraph.nodes`                    | —                                                                          | WorkGraphNodeView[]                                                                                                                                                                                                                                                                                                 |
| `workGraphEdges`                    | `workgraph.edges`                    | —                                                                          | WorkGraphEdgeView[]                                                                                                                                                                                                                                                                                                 |
| `nativeTerminalList`                | `nativeTerminal.list`                | —                                                                          | RuntimeNativeTerminalSession[]                                                                                                                                                                                                                                                                                      |
| `nativeTerminalRead`                | `nativeTerminal.read`                | `id`: string                                                               | { id: string; text: string }                                                                                                                                                                                                                                                                                        |
| `nativeTerminalStop`                | `nativeTerminal.stop`                | `id`: string                                                               | RuntimeNativeTerminalSession                                                                                                                                                                                                                                                                                        |
| `nativeTerminalOpenHub`             | `nativeTerminal.openHub`             | —                                                                          | { muxWindowID: number }                                                                                                                                                                                                                                                                                             |
| `nativeTerminalRevokeApprovalScope` | `nativeTerminal.revokeApprovalScope` | `id`: string                                                               | Awaited< ReturnType< NonNullable<RuntimeClient["nativeTerminalRevokeApprovalScope"]> > >                                                                                                                                                                                                                            |
| `nativeTerminalReleaseHumanControl` | `nativeTerminal.releaseHumanControl` | `id`: string                                                               | Awaited< ReturnType< NonNullable<RuntimeClient["nativeTerminalReleaseHumanControl"]> > >                                                                                                                                                                                                                            |
| `nativeTerminalBeginSecureInput`    | `nativeTerminal.beginSecureInput`    | `id`: string                                                               | Awaited< ReturnType<NonNullable<RuntimeClient["nativeTerminalBeginSecureInput"]>> >                                                                                                                                                                                                                                 |
| `nativeTerminalEndSecureInput`      | `nativeTerminal.endSecureInput`      | `id`: string                                                               | Awaited< ReturnType<NonNullable<RuntimeClient["nativeTerminalEndSecureInput"]>> >                                                                                                                                                                                                                                   |
| `nativeTerminalStart`               | `nativeTerminal.start`               | `input`: { command: string; cwd?: string; id?: string; }                   | RuntimeNativeTerminalSession                                                                                                                                                                                                                                                                                        |
| `nativeTerminalWrite`               | `nativeTerminal.write`               | `input`: { id: string; input: string; idempotencyKey?: string; }           | { id: string; writtenBytes: number; delivery: "accepted" | "duplicate" | "cancelled"; }                                                                                                                                                                                                                             |
| `nativeTerminalResize`              | `nativeTerminal.resize`              | `input`: { id: string; rows: number; cols: number; }                       | RuntimeNativeTerminalSession                                                                                                                                                                                                                                                                                        |
| `constitutionRules`                 | `constitution.rules`                 | —                                                                          | Array<{ ruleID: string; statement: string; scope: "project" | "package" | "sandbox" | "task" | "release"; priority: "critical" | "high" | "medium" | "low"; source: "user" | "master_plan" | "policy"; enforcement: "deny" | "approval" | "warn"; overridePolicy: "forbidden" | "user_scoped" | "user_explicit"; }> |
| `decisionRecords`                   | `decision.records`                   | —                                                                          | Array<{ decision: string; rationale: string[]; status: "proposed" | "accepted" | "superseded"; linkedPlans: string[]; linkedConstraints: string[]; }>                                                                                                                                                               |
| `evidenceRecords`                   | `evidence.records`                   | —                                                                          | Array<{ taskID: string; objective: string; status: string; knownGaps: string[]; }>                                                                                                                                                                                                                                  |
| `driftFindings`                     | `drift.findings`                     | —                                                                          | Array<{ findingID: string; severity: "advisory" | "warning" | "high"; confidence: number; originalObjective: string; currentActivity: string; evidence: string[]; status: string; }>                                                                                                                                |
| `registeredTools`                   | `tools.registered`                   | —                                                                          | Array<{ name: string; owner: string; scope: string; recovery: string; precedence: number; requiresApproval: boolean; }>                                                                                                                                                                                             |
| `capabilities`                      | `capabilities`                       | —                                                                          | Array<{ id: string; name: string; version: string; scope: string; grants: string[]; }>                                                                                                                                                                                                                              |
| `sessionSnapshot`                   | `session.snapshot`                   | —                                                                          | | { agentStatus: string; currentStep?: string; activeTool?: string; changedFiles: number; unvalidatedChanges: number; hasPTY: boolean; hasSandbox: boolean; } | undefined                                                                                                                                           |
| `deleteFlowDocument`                | `flow.delete`                        | `input`: { path: string }                                                  | { path: string; deleted: boolean; alreadyDeleted: boolean; }                                                                                                                                                                                                                                                        |
| `updateConfig`                      | `config.update`                      | `input`: { patch: Record<string, unknown>; scope?: "project" | "global"; } | { applied: boolean; reason?: string }                                                                                                                                                                                                                                                                               |
| `taskPermissionPreview`             | `task.preview`                       | `input`: { path: string }                                                  | { taskID: string; displayName: string; permissionProfile: string; flowID: string; flowDisplayName: string; enabledModules: number; blocked: Array<{ moduleID: string; reason: string }>; conditionlessModules: string[]; problems: string[]; valid: boolean; }                                                      |
| `taskOverview`                      | `task.overview`                      | —                                                                          | ScheduledTaskOverview                                                                                                                                                                                                                                                                                               |
| `flowOverview`                      | `flow.overview`                      | —                                                                          | FlowOverview                                                                                                                                                                                                                                                                                                        |
| `documentCatalog`                   | `document.catalog`                   | —                                                                          | WorkflowDocumentChoice[]                                                                                                                                                                                                                                                                                            |
| `reloadConfig`                      | `config.reload`                      | —                                                                          | { applied: boolean; reason?: string }                                                                                                                                                                                                                                                                               |
| `canReloadConfig`                   | `config.canReload`                   | —                                                                          | { allowed: boolean; reason?: string }                                                                                                                                                                                                                                                                               |
| `availability`                      | `runtime.availability`               | —                                                                          | RuntimeCapabilityReport                                                                                                                                                                                                                                                                                             |
| `runtimeStatus`                     | `runtime.status`                     | —                                                                          | RuntimeStatusSnapshot                                                                                                                                                                                                                                                                                               |
| `diagnostics`                       | `diagnostics.list`                   | `limit?`: number                                                           | RuntimeDiagnostic[]                                                                                                                                                                                                                                                                                                 |
| `health`                            | `—`                                  | —                                                                          | { ok: boolean; apiVersion: number }                                                                                                                                                                                                                                                                                 |

### Runtime event dictionary (source scan of `packages/contracts/src/events.ts`)

| Event type                  | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.created`           | `sessionID`: SessionID, `title`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `session.ready`             | `sessionID`: SessionID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `turn.submitted`            | `id`: string, `text`: string, `byteLength`: number, `lineCount`: number, `sha256`: string, `attachments?`: LocalAttachment[], `resources?`: PromptResourceMention[], `agents?`: PromptAgentMention[]                                                                                                                                                                                                                                                                                                                       |
| `turn.cancelled`            | `id`: string, `reason`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `turn.paused`               | `id`: string, `reason`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `turn.resumed`              | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `thinking.delta`            | `id`: string, `text`: string, `visible?`: boolean, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `thinking.done`             | `id`: string, `text?`: string, `visible?`: boolean, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `content.delta`             | `id`: string, `text`: string, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `content.done`              | `id`: string, `text?`: string, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `turn.retry`                | `id`: string, `attempt`: number, `maxAttempts`: number, `reason`: string, `retryAfterMs`: number                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `step.retry`                | `id`: string, `operation`: StepRetryOperation, `step`: number, `attempt`: number, `maxAttempts`: number, `waitMs`: number, `reason`: ErrorKind, `statusCode?`: number                                                                                                                                                                                                                                                                                                                                                      |
| `step.retry.cleared`        | `id`: string, `operation`: StepRetryOperation, `step`: number, `attempts`: number                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `step.retry.exhausted`      | `id`: string, `operation`: StepRetryOperation, `step`: number, `attempts`: number, `maxAttempts`: number, `reason`: ErrorKind, `statusCode?`: number, `message`: string, `retryable?`: boolean                                                                                                                                                                                                                                                                                                                             |
| `tool.update`               | `id`: string, `name`: string, `callID?`: string, `status`: ToolStatus, `summary`: string, `argumentsDelta?`: string, `result?`: string, `metadata?`: Record<string, unknown>, `startedAt?`: number, `endedAt?`: number                                                                                                                                                                                                                                                                                                     |
| `policy.decision`           | `turnID`: string, `toolName`: string, `toolCallID?`: string, `decision`: "allow" | "deny" | "approval_required" | "rejected", `reason?`: string                                                                                                                                                                                                                                                                                                                                                                            |
| `subagent.update`           | `id`: string, `attached`: boolean, `task?`: string, `text?`: string, `parentSessionID?`: string, `parentAgentID?`: string, `continuation?`: number                                                                                                                                                                                                                                                                                                                                                                         |
| `mcp.status`                | `server`: string, `status`: "disabled" | "connected" | "failed" | "unsupported_auth_flow", `tools`: number, `message?`: string                                                                                                                                                                                                                                                                                                                                                                                             |
| `agent.selection`           | `name?`: string, `pending`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `model.selection`           | `modelID?`: string, `variant?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `plugin.update`             | `id`: string, `status`: "loaded" | "unloaded" | "denied" | "failed", `detail?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `session.snapshot`          | `id`: string, `agentStatus`: string, `currentStep?`: string, `activeTool?`: string, `changedFiles`: number, `unvalidatedChanges`: number, `recentOutput?`: string, `hasPTY`: boolean, `hasSandbox`: boolean                                                                                                                                                                                                                                                                                                                |
| `drift.finding_opened`      | `id`: string, `findingID`: string, `severity`: "advisory" | "warning" | "high", `confidence`: number, `originalObjective`: string, `currentActivity`: string, `evidence`: string[], `applicableConstraints`: string[]                                                                                                                                                                                                                                                                                                      |
| `drift.finding_updated`     | `id`: string, `findingID`: string, `status`: "open" | "explained" | "dismissed" | "corrected", `rationale?`: string                                                                                                                                                                                                                                                                                                                                                                                                        |
| `tool.registered`           | `id`: string, `name`: string, `owner`: string, `scope`: "process" | "workspace" | "session", `recovery`: "none" | "retry" | "restart" | "fail_closed", `precedence`: number, `requiresApproval`: boolean                                                                                                                                                                                                                                                                                                                   |
| `tool.unregistered`         | `id`: string, `name`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `capability.loaded`         | `id`: string, `apiVersion`: number, `name`: string, `version`: string, `scope`: "process" | "workspace" | "session", `grants`: string[]                                                                                                                                                                                                                                                                                                                                                                                    |
| `capability.unloaded`       | `id`: string, `name`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `capability.failed`         | `id`: string, `name`: string, `reason`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `workgraph.node_added`      | `id`: string, `nodeID`: string, `kind`: import("./schemas").WorkGraphNodeKind, `summary`: string, `actor?`: string, `target?`: string, `sessionID?`: string, `turnID?`: string                                                                                                                                                                                                                                                                                                                                             |
| `workgraph.edge_added`      | `id`: string, `sourceID`: string, `targetID`: string, `kind`: import("./schemas").WorkGraphEdgeKind, `reason?`: string                                                                                                                                                                                                                                                                                                                                                                                                     |
| `evidence.recorded`         | `id`: string, `taskID`: string, `objective`: string, `knownGaps?`: string[]                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `constitution.check`        | `id`: string, `ruleID`: string, `statement`: string, `priority`: "critical" | "high" | "medium" | "low", `enforcement`: "deny" | "approval" | "warn", `action`: string, `resource`: string, `conflict`: boolean                                                                                                                                                                                                                                                                                                            |
| `constitution.rule_added`   | `id`: string, `ruleID`: string, `statement`: string, `scope`: "project" | "package" | "sandbox" | "task" | "release", `priority`: "critical" | "high" | "medium" | "low", `source`: "user" | "master_plan" | "policy", `enforcement`: "deny" | "approval" | "warn", `overridePolicy`: "forbidden" | "user_scoped" | "user_explicit", `evidenceRefs?`: string[]                                                                                                                                                             |
| `constitution.rule_updated` | `id`: string, `ruleID`: string, `statement?`: string, `priority?`: "critical" | "high" | "medium" | "low"                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `decision.recorded`         | `id`: string, `decision`: string, `rationale?`: string[], `consequences?`: string[], `status`: "proposed" | "accepted" | "superseded", `linkedPlans?`: string[], `linkedConstraints?`: string[]                                                                                                                                                                                                                                                                                                                            |
| `status.update`             | `status`: string, `detail?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `status.snapshot`           | `model`: string, `provider`: string, `context`: string, `step`: string, `permissions`: string, `cwd`: string, `background`: string                                                                                                                                                                                                                                                                                                                                                                                         |
| `context.status`            | `used`: number, `max`: number, `source`: ContextStatusSource, `thresholdPercent`: number, `reserved`: number, `trigger?`: CompactionTrigger                                                                                                                                                                                                                                                                                                                                                                                |
| `compaction.begin`          | `id`: string, `trigger`: CompactionTrigger, `beforeTokens`: number, `maxTokens`: number, `thresholdPercent`: number, `reservedTokens`: number, `instruction?`: string, `attempt`: number, `startedAt`: string                                                                                                                                                                                                                                                                                                              |
| `compaction.end`            | `id`: string, `trigger`: CompactionTrigger, `success`: boolean, `beforeTokens`: number, `afterTokens?`: number, `durationMs`: number, `attempts`: number, `error?`: string                                                                                                                                                                                                                                                                                                                                                 |
| `context.limit.recovery`    | `id`: string, `step`: number, `attempted`: boolean, `compacted`: boolean, `reason`: "context_limit"                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `context.checkpoint`        | `id`: string, `snapshot`: DurableContextCheckpointRecord                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `terminal.update`           | `id`: string, `command`: string, `cwd`: string, `status`: TerminalStatus, `attached`: boolean, `rows`: number, `cols`: number, `prompt?`: string, `activity`: "waiting" | "running", `tail`: string, `transcript?`: string, `lastAction?`: TerminalAction, `target`: ExecutionTarget, `ownership?`: TerminalOwnership, `approvalID?`: string, `screen?`: TerminalScreenSnapshot, `revision?`: number, `lastOutputAt?`: string, `viewers?`: TerminalViewer[], `inputOwner?`: TerminalOwner, `geometryOwner?`: TerminalOwner |
| `terminal.action`           | `id`: string, `action`: TerminalAction, `redacted?`: boolean, `target`: ExecutionTarget                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `terminal.timeline`         | `id`: string, `actor`: "model" | "user" | "system", `action`: TerminalAction | "created" | "approval", `summary`: string, `at`: string                                                                                                                                                                                                                                                                                                                                                                                     |
| `terminal.approval`         | `id`: string, `approvalID`: string, `state`: "awaiting" | "approved" | "rejected", `action`: TerminalAction, `reason`: string, `target`: ExecutionTarget                                                                                                                                                                                                                                                                                                                                                                   |
| `terminal.viewer`           | `id`: string, `viewerID`: string, `viewerKind?`: "external" | "embedded", `inputOwner`: TerminalOwner, `geometryOwner`: TerminalOwner, `at`: string                                                                                                                                                                                                                                                                                                                                                                        |
| `terminal.pane.select`      | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `terminal.pane.focus`       | `focus`: "chat" | "terminal"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `sandbox.update`            | `id`: string, `status`: SandboxStatus, `root`: string, `isolationLevel`: "workspace" | "container" | "vm", `changedFiles`: number, `runningResources`: number, `target`: ExecutionTarget, `resourcePolicy`: string                                                                                                                                                                                                                                                                                                         |
| `sandbox.diff`              | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `sandbox.audit`             | `id`: string, `action`: string, `target`: ExecutionTarget, `approvalRequired`: boolean, `message`: string                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `checkpoint.created`        | `id`: string, `reason`: string, `sequence`: number, `complete`: boolean, `files`: number, `changes`: number, `contextJournalOffset`: number, `step`: number, `tokenEstimate`: number, `diskUsageBytes`: number                                                                                                                                                                                                                                                                                                             |
| `checkpoint.failed`         | `reason`: string, `message`: string, `incomplete?`: boolean, `errors?`: string[]                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `checkpoint.unavailable`    | `reason`: string, `suggestion`: string, `disabledByConfig?`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `rollback.previewed`        | `preview`: CheckpointPreview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `rollback.begin`            | `checkpointID`: string, `safetyCheckpointID`: string, `dryRun?`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `rollback.end`              | `checkpointID`: string, `safetyCheckpointID`: string, `restoredFiles`: number, `deletedFiles`: number, `contextJournalOffset`: number, `step`: number                                                                                                                                                                                                                                                                                                                                                                      |
| `rollback.failed`           | `checkpointID`: string, `safetyCheckpointID?`: string, `message`: string, `recovered`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `diagnostic`                | `level`: "info" | "warning" | "error", `message`: string, `at?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `dialog.open`               | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `dialog.close`              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `approval.request`          | `id`: string, `title`: string, `preview`: string, `detail?`: string, `keyArguments?`: string[], `sensitive?`: boolean, `risk?`: "terminal_low" | "terminal_high", `scope?`: string, `expiresAt?`: string, `revocable?`: boolean                                                                                                                                                                                                                                                                                            |
| `approval.response`         | `id`: string, `decision`: ApprovalResponse["decision"], `feedback?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `question.request`          | `id`: string, `title`: string, `options?`: string[], `questions?`: QuestionItem[]                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `question.response`         | `id`: string, `answers`: string[][], `rejected?`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `snapshot.created`          | `id`: string, `files`: string[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `turn.finished`             | `id`: string, `stopReason`: "done" | "cancelled" | "error", `reason?`: "missing_final_response"                                                                                                                                                                                                                                                                                                                                                                                                                            |
<!-- /api-reference:generated -->
