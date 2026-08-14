# Natalia 插件开发指南 — v1

> 状态：`PLUGIN_API_VERSION` = 1（见 `@natalia/plugin`）。
> 本指南讲如何编写、加载与测试插件，与运行时 API 参考（`docs/api-reference.md`）
> 配套：插件**运行在 runtime 进程内**，因此插件 API 是 host 侧扩展面，不是
> RPC 面。

## 1. 插件是什么

插件是运行在 runtime **进程内**的 TypeScript/JavaScript 模块，可贡献三类东西，
每类由独立 capability 门控：

| Capability | 插件得到什么                                                             |
| ---------- | ------------------------------------------------------------------------ |
| `tools`    | `api.tools.register(tool)` — 模型可调用的工具，名为 `plugin_<id>_<name>` |
| `events`   | `api.events.on(listener)` — 全部 runtime 事件，分发给所有监听者          |
| `commands` | `api.commands.register(command)` — 面板命令，名为 `plugin_<id>_<name>`   |

**信任模型，直说：插件是可信代码，不是沙箱。** 它是进程内 `import()` 加载，
仅有路径包含与 `.js`/`.mjs`/`.ts` 扩展名检查——无 VM、无文件系统限制、无超时、
无网络策略。加载插件与你自己运行它的代码是同一安全决定。capability 门控与
workspace 的 `readOnly` 信任标记是治理，不是隔离：声明只有 `events` 的插件
不能注册工具，但没有任何东西阻止它做 JavaScript 能做的任何事。只加载你写过
或审计过的插件。

## 2. 插件放哪里

runtime 启动时从 `<workspace>/.natalia/plugins/` 加载插件。每个插件是一个带
manifest 的目录：

```
.natalia/plugins/
  demo/
    natalia.plugin.json        # manifest
    index.ts           # 入口，或 manifest 指定的任意 .js/.mjs/.ts
```

越出 plugins 根的入口、或非本地 JS/TS 模块，加载时被拒。manifest 校验失败的
插件被拒并记 audit；`setup` 抛错的插件被回滚（它注册的一切都被撤销）并在
registry audit 中记为 `failed`。

## 3. Manifest

```json
{
  "apiVersion": 1,
  "id": "demo.plugin",
  "version": "1.0.0",
  "name": "Demo",
  "description": "A demonstration plugin",
  "entry": "index.ts",
  "capabilities": ["tools", "events", "commands"]
}
```

| 字段           | 规则                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| `apiVersion`   | 必须为 `1`                                                                     |
| `id`           | `[a-z0-9][a-z0-9._-]*`；registry 键，也是所有注册名的前缀                      |
| `version`      | 语义化版本                                                                     |
| `name`         | 显示名；也是命令的默认 `category`                                              |
| `description`  | 可选，默认 `""`                                                                |
| `entry`        | 可选，默认 `"index.ts"`；必须是本地 `.js`/`.mjs`/`.ts`                         |
| `capabilities` | 插件可用的 `tools`/`events`/`commands`；host 还可用 `allowed` 白名单进一步约束 |

## 4. `definePlugin`

```ts
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 1,
    id: "demo.plugin",
    version: "1.0.0",
    name: "Demo",
    capabilities: ["tools", "commands"],
  },
  setup(api) {
    api.tools.register({
      name: "echo",
      description: "Echo the input back.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      },
      async execute(input, context) {
        return (input as { text?: string }).text ?? "";
      },
    });

    api.commands.register({
      name: "hello",
      title: "Say hello",
      run() {
        console.log("hello from the demo plugin");
      },
    });
  },
  dispose() {
    // 可选；在插件注册项被移除前执行
  },
});
```

- **名字自动加命名空间。** 注册为 `echo` 的工具变成 `plugin_demo_plugin_echo`；
  名为 `hello` 的命令变成 `plugin_demo_plugin_hello`。插件不能靠选名字遮蔽内建
  工具或命令；卸载插件移除的恰好是它注册的那些名字。
- **动态插件工具默认要审批，除非被信任。** 插件工具的 `requiresApproval`
  默认为 `true`；显式信任某插件只读声明的 workspace 可标记它
  （host 侧 `readOnly: { "demo.plugin": true }`），此时声明
  `requiresApproval: false` 的工具保持免审批。
- **`execute(input, context)` 的 `context` 形状**（来自
  `@natalia/tools` 的 `ToolExecutionContext`）：
  - `workspaceRoot: string` — 当前工作区根。
  - `signal?: AbortSignal` — 回合取消时中止；长时间工具应监听它。
  - `askQuestion?` — 向用户提问（`{ title, questions: [{ id, header, question,
options: [{ label, description? }], multiple?, custom? }] }`，返回
    `string[][]`，外层按 questions 顺序）。宿主无交互通道时不存在。
  - `subagents?` / `nativeTerminal?` / `sandboxes?` — 子代理、终端与会话注册表
    （各自宿主能力存在时才有）。
  - `workspaceReadAuthorize?` / `sandboxMergeAuthorize?` — 宿主策略钩子；
    工具应**先调用再落盘/合并**，拒绝即抛错。
  - `settings?` — 运行时网络与浏览器策略（`allowedHosts`/`allowedSchemes`/
    `allowLocalhost`/`allowPrivate`/`deniedHosts`/`envAllowlist`、
    `webSearchEndpoint`、`browserEnabled`/`browserBinary`…）。读写类工具应
    遵守这些边界——宿主按同一份 settings 执行网络策略。
  - `parentSessionID?` / `parentAgentID?` / `maxSubagentDepth?` — 调用方会话
    与子代理深度预算。
- **`setup` 可以是 async。** 若抛错，它注册的一切被回滚，加载记为 `failed`。
- **每个注册返回一个 disposer**（`const off = api.tools.register(...)`）。
  不需要你调用——卸载会做——但你可以用它中途注销。

## 5. 配置

需要配置的插件自己声明配置的 schema，宿主把为它配置的那一项传进来：

```json
// .natalia/config.json
{
  "plugins": {
    "settings": {
      "demo.plugin": { "endpoint": "https://example.test", "retries": 5 }
    }
  }
}
```

```ts
import { z } from "zod";

export default definePlugin({
  manifest: {
    apiVersion: 1,
    id: "demo.plugin",
    version: "1.0.0",
    name: "Demo",
  },
  configSchema: z.object({
    endpoint: z.string().url(),
    retries: z.number().int().min(0).default(3),
  }),
  setup(api) {
    const config = api.config as { endpoint: string; retries: number };
    // 宿主没写 retries 时它是 3——schema 声明的默认值。
  },
});
```

- **schema 归插件，值归宿主。** runtime 不解释 `plugins.settings`：它只按插件
  id 索引，把对应的那一项交给该插件。因此插件的配置词汇随插件版本演进，而不
  绑在 runtime 的配置 schema 上。
- **`api.config` 是校验后的值**（schema 的解析结果），声明的默认值已经生效。
  没有 `configSchema` 的插件接受任意值，原样收到。
- **配置错误让加载失败，并且吵。** 校验发生在 `setup` **之前**，无效配置绝不
  会进到一个半配置好的插件里：加载抛错并列出失败路径
  （`- Invalid url (at endpoint)`），审计记为 `failed`，插件本会注册的东西
  一件都不存在。
- **任何 Standard Schema 库都可以**（zod、valibot、arktype）——插件 API 只对
  `~standard` 接口做鸭子类型，不要求本仓库的 zod 构建，因为插件是独立分发的。
  schema 必须同步校验；异步 schema 直接算加载错误，而不是静默地不校验。
- **conformance 也能带配置**：
  `runPluginConformance({ plugin, config: { endpoint: "https://example.test" } })`，
  于是插件的配置契约可以被单独测试。

## 6. 事件

```ts
setup(api) {
  api.events.on((event) => {
    if ((event as { type?: string }).type === "turn.finished") {
      console.log("a turn finished");
    }
  });
}
```

监听者看到全部 runtime 事件（与事件流相同的 `RuntimeEvent` 对象，进程内、
无序列化）。抛错的监听者被忽略——一个坏插件不能搞坏分发循环。events 是插件
声明"观察"所用的 capability；插件靠它响应 runtime 而无须轮询。

## 7. 命令

```ts
api.commands.register({
  name: "deploy",
  title: "Deploy the demo",
  category: "Demo", // 可选；默认取插件名
  async run() {
    await deploy();
  },
});
```

命令是插件的 UI 面：它们出现在面板里（TUI 与 CLI 一致），且权威列表可通过 RPC
读取——`command.catalog`（`sdk.commandCatalog()`）——远程 UI 看到的是 registry
实际拥有的命令。面板经进程级同步桥渲染，该桥假设每进程一个 runtime（CLI 与
TUI worker 成立）。

## 8. Conformance

`runPluginConformance` 在隔离环境里、对着一次性工具 registry 检查插件：

```ts
import { runPluginConformance } from "@natalia/plugin";

const results = await runPluginConformance({ plugin, allowed: ["tools"] });
// [{ name: "manifest-and-setup", passed: true },
//  { name: "owned-registration-cleanup", passed: true }]
```

两项检查：manifest 可解析且 `setup` 能跑；`unload` 后插件注册的工具一个不剩。
若你的插件贡献第三种东西，发布前按同样方式扩展 `packages/plugin/test/` 的
conformance 检查——本仓库的门禁是：本指南里的一句声明，要么是测试，要么是
谎言。

## 9. 加载与审计

registry 把每个生命周期转换记为 `PluginAudit`：`loaded`、`unloaded`、
`denied`（插件用了未授予的 capability）或 `failed`（manifest 或 `setup`
错误）。audit 可通过 registry（`registry.audit()`）读取，runtime 也会把它
暴露出来；加载失败的插件产生一条指名道姓的 runtime diagnostic，因此坏插件
在 `sdk.diagnostics()` 里可见，而不是悄悄消失。

## 10. 依赖解析（部署注意）

import `@natalia/plugin`（文档化的 `definePlugin` 方式）的插件必须能解析它。
bun 解析裸 specifier 的方式是从 *import 文件*向上找 `node_modules`/workspace
上下文，而插件位于 workspace 的 `.natalia/plugins`——在 runtime 包树之外。
因此部署必须提供以下之一：

- 把 SDK 包装进 workspace 的 `node_modules`（或把 `node_modules/@natalia`
  软链到 runtime 的包），或
- 让 `@natalia/*` 从插件目录可解析的加载器/runtime 布局。

这是部署契约，不是 runtime 功能：runtime 不拦截模块解析。解析失败的插件
以 `failed` 记录加载，解析错误在 diagnostic 里可见。
