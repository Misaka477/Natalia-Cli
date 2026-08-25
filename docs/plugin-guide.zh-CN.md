# Natalia 插件开发指南 - v2

> `PLUGIN_API_VERSION` 为 `2`。一个插件就是一个包，包内同时包含 package 元数据、
> `natalia.plugin.json`、入口模块和实现。插件 API 是进程内 host 扩展面，不是 RPC 面。

## 1. 单一插件体系

Natalia 只有一种插件。runtime 默认随附插件和用户安装插件使用同一 registry、声明名、
权限、依赖解析及装载/卸载生命周期。runtime 默认项只是分发配置，不拥有特权 API，
也不走第二套生命周期。

插件不用于包装 Natalia 框架自身。Agent turn/step、Provider 与模型选择、会话与配置、
传输/SDK/daemon、CLI/TUI host、权限与审批、sandbox、checkpoint、工程智能、workspace、
runtime status 和 diagnostics 都由 runtime/host 直接构造并管理。这些能力没有插件
manifest、可卸载 plugin ID 或 `plugins.enabled` 开关，也不会出现在插件 catalog 中。
只有移除后仍能保持 runtime 核心语义完整的扩展包才是插件；例如独立模型工具和 UI
adapter 可以是插件，但它们不能拥有对应框架 controller 的生命周期。

插件是可信代码。它会被直接导入 runtime 进程，没有 VM、文件系统沙箱、网络沙箱或
执行超时。manifest 的 `integrationPoints` 用于贡献物归属和校验，不提供进程隔离。
只安装你编写过或审计过的包。

v2 integration point 包括 `tools`、`commands`、`events`、`services`、
`resources`、`projections`、`workflows`、`settingsSchema`、`adapters` 和
`schedulerJobs`。声明 integration point 就获得对应 API。工具和命令保留声明名，
Natalia 不添加插件前缀。工具审批尊重每个工具的 `requiresApproval` 声明，并继续经过
runtime 的常规策略路径；不存在按插件类别强制审批。

## 2. 单包布局

可发布插件包的最小结构：

```text
my-natalia-plugin/
  package.json
  natalia.plugin.json
  src/index.js
```

使用 CLI 创建该包。当前已安装发行版命令为 `natalia-ts`；仓库内示例使用
`npm run ts:cli --`：

```bash
natalia-ts plugin create ./my-natalia-plugin \
  --id yourco.demo \
  --package @yourco/natalia-demo
```

`--package` 可省略，默认使用目录 basename。目录相对当前进程工作目录解析；
`--workspace` 不会改变脚手架输出位置。目标目录已存在时创建会失败。生成物使用普通
ESM JavaScript，因此安装后的入口不依赖 Bun 或 TypeScript 源码 loader。

包必须把实现直接导入的每个 Natalia 包声明为依赖：

```json
{
  "name": "@yourco/natalia-demo",
  "version": "1.0.0",
  "type": "module",
  "files": ["src", "natalia.plugin.json"],
  "exports": { ".": "./src/index.js" },
  "dependencies": {
    "@natalia/plugin": "<compatible-version>"
  }
}
```

版本应与目标 Natalia 发行版兼容。包管理器会把完整 package closure 安装到
`.natalia/plugins`；不要要求用户另建 SDK 软链接或单独复制入口文件。
只有实现确实导入时才添加 `@natalia/contracts`、`@natalia/tools` 或其他 Natalia 包。
`@natalia/sdk` 是 RPC client SDK，不是插件 authoring API。

## 3. Manifest v2

```json
{
  "apiVersion": 2,
  "id": "yourco.demo",
  "version": "1.0.0",
  "name": "Demo",
  "description": "A demonstration plugin.",
  "entry": "src/index.js",
  "scope": "workspace",
  "provides": [],
  "requires": [],
  "optionalRequires": [],
  "conflicts": [],
  "dependencies": [],
  "hooks": {},
  "integrationPoints": ["tools", "commands"]
}
```

- `id` 匹配 `[a-z0-9][a-z0-9._-]*`，同时是 registry owner id。
- `version` 是语义版本且必须与 `package.json` 一致；`entry` 必须是发布包内本地
  `.js`、`.mjs` 或 `.ts` 文件。面向 Natalia 源码 workspace 之外运行的包应使用
  JavaScript 入口。
- `scope` 为 `process`、`workspace` 或 `session`，表示生命周期归属，不是安全边界。
- `provides`、`requires`、`optionalRequires` 描述 service contract。
- `conflicts` 和 `dependencies` 进入确定性依赖解析；dependency 可标记
  `optional` 或 `peer`。
- `hooks` 是保留字段，当前必须为 `{}`。Natalia 安装和删除包时会禁用 npm lifecycle
  scripts，也不会隐式执行插件 hook 命令。
- `integrationPoints` 必须覆盖 `setup` 使用的每个贡献 API。

manifest、依赖和配置校验在激活前完成。`setup` 失败时，本次激活产生的注册项全部
回滚，插件 audit 状态为 `failed`。

## 4. 实现插件

```js
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.demo",
    version: "1.0.0",
    name: "Demo",
    description: "A demonstration plugin.",
    entry: "src/index.js",
    scope: "workspace",
    provides: [],
    requires: [],
    optionalRequires: [],
    conflicts: [],
    dependencies: [],
    hooks: {},
    integrationPoints: ["tools", "commands"],
  },
  setup(api) {
    api.tools.register({
      name: "echo",
      description: "Echo the input.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      },
      async execute(input) {
        return (input as { text: string }).text;
      },
    });
    api.commands.register({
      name: "demo.hello",
      title: "Say hello",
      run() {
        console.log("hello from yourco.demo");
      },
    });
  },
});
```

实际注册名就是 `echo` 和 `demo.hello`。重复名字会被拒绝，因此应选全局语义清晰的
名字。每次注册都返回 disposer，registry unload 也会清理 owner 的全部贡献物。
`setup` 和插件 `dispose` 都可以异步执行。

插件可通过 Standard Schema 声明 `configSchema`。校验结果从 `api.config` 读取，
原始值来自 `plugins.settings[pluginID]`。无效配置会阻止激活，不会留下半配置插件。

### Plugin API 参考

每个贡献方法都会检查对应的 `integrationPoints` 声明。使用未声明的 API 会导致激活
失败并报告 `plugin capability denied`。所有注册方法都返回幂等 disposer；卸载时，
registry 还会按注册顺序的逆序调用尚未执行的 disposer。

| Manifest point   | API                                                    | 契约                                                                          |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `tools`          | `api.tools.register(tool)`                             | 注册全局命名的 `RuntimeTool`；重复名称会失败。                                |
| `tools`          | `api.tools.registerAlias(alias, target)`               | 注册工具别名并返回 disposer。                                                 |
| `commands`       | `api.commands.register(command)`                       | 注册全局命名命令；重复名称会失败。                                            |
| `events`         | `api.events.on(listener)`                              | 接收经插件 registry 分发的所有事件。                                          |
| `events`         | `api.events.on(type, listener)`                        | 只接收对象 `type` 等于指定字符串的事件。                                      |
| `services`       | `api.services.provide(name, value)`                    | 提供 manifest `provides` 中声明的服务；`setup` 结束前必须提供所有已声明服务。 |
| 无               | `api.services.get<T>(name)`                            | 读取当前可用的 host service。                                                 |
| 无               | `api.services.on<T>(name, listener)`                   | 监听 service provider 变化；注册时不会立即调用 listener。                     |
| `resources`      | `api.resources.register({ name, ... })`                | 注册由 host 定义的具名 resource contribution。                                |
| `projections`    | `api.projections.register({ name, ... })`              | 注册由 host 定义的具名 projection contribution。                              |
| `workflows`      | `api.workflows.register({ name, ... })`                | 注册由 host 定义的具名 workflow contribution。                                |
| `settingsSchema` | `api.settingsSchema.register({ name, ... })`           | 注册由 host 定义的具名设置 schema contribution。                              |
| `adapters`       | `api.adapters.register({ name, adapterType, create })` | 注册惰性 adapter factory，创建的实例必须有 `dispose()`。                      |
| `adapters`       | `api.adapters.registerUi({ kind, mount, dispose })`    | UI adapter 便捷 API；贡献名就是 `kind`。                                      |
| `schedulerJobs`  | `api.scheduler.add({ name, ... })`                     | 注册由 host 定义的具名 scheduler job。                                        |

`resources`、`projections`、`workflows`、`settingsSchema` 和 scheduler job 的
稳定通用契约只有 `{ name: string }` 及生命周期归属。其他 payload 由消费该贡献的 host
定义；如果 host 没有导出通用格式，不应自行假定字段结构。

以下 API 不要求 `integrationPoints` 声明：

- `api.config` 是来自 `plugins.settings[pluginID]` 的同步校验结果；没有
  `configSchema` 时就是原始值。
- host 提供时，`api.runtimeConfig?.()` 返回当前 runtime 配置。它是可选 API，优先使用
  插件自己的配置。
- 插件卸载时会 abort `api.effects.signal`。
- `api.effects.run(effect)` 跟踪异步任务；卸载会 abort signal 并等待全部任务 settle。
  插件应把该 signal 继续传给 I/O 操作。

`RuntimeTool` 必须包含 `name`、`description`、`requiresApproval`、对象 JSON schema
`parameters`，以及返回字符串的异步 `execute(input, context)`。`context` 包含
`workspaceRoot`、可选 `sessionID`、`AbortSignal`，以及当前 runtime 可用的 host service。
命令必须包含 `name`、`title` 和 `run(invocation?)`；invocation 包含 `raw`、`args`、
`workspaceRoot`、可选 `sessionID` 和可选 `signal`。

### 配置

Zod schema 实现了 Standard Schema，可直接使用。配置校验必须同步：

```js
import { z } from "zod";
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest,
  configSchema: z.object({
    endpoint: z.string().url(),
    retries: z.number().int().min(0).default(3),
  }),
  setup(api) {
    const config = api.config;
    // config 是校验后的 { endpoint, retries }。
  },
});
```

使用 Zod 时要把 `zod` 加入插件包依赖。在 `<workspace>/.natalia/config.json` 中配置：

```json
{
  "version": 3,
  "plugins": {
    "settings": {
      "yourco.demo": {
        "endpoint": "https://example.test",
        "retries": 5
      }
    }
  }
}
```

无效值会在 `setup` 之前失败，并报告具体属性路径。异步 Standard Schema 校验会被明确
拒绝。

### Service 与插件依赖

`requires` 包含必需 service 名。所有 service 可用之前，插件保持 `pending`；必需的
provider 消失或变更时，registry 会停用 consumer，再针对新 provider 重新激活。
`optionalRequires` 记录可选 service contract，但不阻止激活。`provides` 必须准确覆盖
通过 `api.services.provide` 提供的服务：提供未声明服务会立即失败，`setup` 结束时遗漏
已声明服务也会失败。

Manifest `dependencies` 描述插件之间的关系：

```json
{
  "dependencies": [
    { "id": "yourco.base", "spec": "^1.2.0", "optional": false, "peer": false }
  ]
}
```

必需 dependency 控制激活顺序。缺少或版本不兼容会使插件 pending；冲突和重复 ID 会被
拒绝；依赖环保持 unresolved。支持精确版本、`*`、`latest`、`workspace:*`、`^`、`~`、
`>`、`>=`、`<`、`<=`。可选 dependency 只有在兼容插件存在时才参与排序。`peer` 当前
会记录到安装元数据，但不会改变 runtime 解析行为。

Manifest dependency 不会自动安装另一个插件。JavaScript package dependency 应放在
`package.json`；每个必需 Natalia 插件需要单独安装，并在 manifest 中声明插件关系。

## 5. 生命周期命令

CLI 是权威维护入口。以下示例使用已安装发行版命令：

```bash
natalia-ts plugin install @yourco/natalia-demo
natalia-ts plugin list
natalia-ts plugin disable yourco.demo
natalia-ts plugin enable yourco.demo
natalia-ts plugin doctor
natalia-ts plugin reconcile
natalia-ts plugin uninstall yourco.demo
```

上述维护命令都可使用 `--workspace /path/to/project` 指定其他工作区。`plugin create`
相对当前进程工作目录写入显式目录，不使用 workspace 状态。

- `install <spec>` 在一个事务中完成 package staging 与校验、安装依赖闭包、写入
  `.natalia/natalia.lock`、记录 package 配置并启用插件。失败时恢复原 closure、
  lock 和配置。
- `list` 用一张 catalog 同时列出 runtime 默认项和用户安装包，字段包括 `id`、
  `name`、`version`、`scope`、`enabled`、`installed`、`source`、`packageName`。
- `disable <id>` 和 `enable <id>` 只改变 desired activation state。
- `uninstall <id>` 删除用户安装包的配置、closure 和 lock entry。runtime 分发的
  默认插件文件属于 runtime 本身，因此对它执行 uninstall 会持久化为禁用。
- `doctor` 审计安装状态，`reconcile` 修复 desired package closure；二者是恢复命令，
  不是安装的额外步骤。

`install` 接受 npm package spec，包括 registry 版本、本地目录、打包 tarball、Git spec
和远程 tarball：

```bash
natalia-ts plugin install @yourco/natalia-demo@1.0.0
natalia-ts plugin install ./my-natalia-plugin
npm pack ./my-natalia-plugin
natalia-ts plugin install ./yourco-natalia-demo-1.0.0.tgz
```

本地开发修改包后需重新执行 `install`。发布前运行 `npm pack --dry-run`，确认包中包含
`src/index.js` 和恰好一个 `natalia.plugin.json`，再执行 `npm publish`。

包括 `create` 在内的所有维护命令都输出缩进 JSON。主要结果形状如下：

```json
{ "created": true, "directory": "/absolute/path/my-natalia-plugin", "pluginID": "yourco.demo", "packageName": "@yourco/natalia-demo" }
{ "installed": true, "pluginID": "yourco.demo", "packageName": "@yourco/natalia-demo", "metadata": {} }
{ "pluginID": "yourco.demo", "enabled": false }
{ "uninstalled": true, "pluginID": "yourco.demo", "disposition": "removed for next reconcile" }
```

`plugin list` 返回按 ID 排序的 JSON 数组。runtime 默认项的 `source.type` 为
`"runtime"`、`packageName` 为 `null`；安装包会返回已记录的 registry、path、Git 或
tarball 来源。只有配置显式禁用某个 ID 时，其 `enabled` 才为 false。

这些 CLI 命令持久化 desired state，不会直接修改另一个进程中已经运行的 plugin
registry。长时间运行的 client 必须重新加载配置/协调 desired catalog，或者重启进程。
新启动的 CLI、TUI、UI host 或 daemon 会读取新状态。runtime RPC 的 `pluginUnload` 和
`pluginReload` 是进程局部操作，不能替代持久化 CLI 命令。

使用相同 package name 和 plugin ID 再次安装就是升级/重装路径。新包必须通过 staging
校验，才会替换 live closure。不能直接修改已安装 package 的 plugin ID，也不能把已有
plugin ID 转给另一个 package；确实需要改变身份时，应先卸载旧项。

### 安装校验内容

安装时 npm 使用 `--ignore-scripts`，并先暂存包，再在提交状态前校验：

1. 请求包可解析为带版本的 package-lock record。
2. package closure 在嵌套依赖之外恰好包含一个 `natalia.plugin.json`。
3. manifest 和 entry 都解析在 package 目录内部。
4. `package.json.version`、lock 解析版本和 manifest `version` 一致。
5. entry 可成功导入，default export 是包含 `manifest` 和 `setup()` 的对象。
6. 应用 schema 默认值后，导出 manifest 与文件 manifest 完全一致。
7. plugin ID 不被 runtime 默认项保留，并且与现有 lock 没有所有权冲突。

live closure、`<workspace>/.natalia/natalia.lock` 和项目配置作为一个事务更新。失败会
恢复三者的旧快照。操作已经成功但清理临时文件失败时，会返回 `cleanupWarning`，不会
改变成功结果。

### Doctor 与 reconcile

`plugin doctor` 返回空数组表示安装状态一致。Finding code 含义如下：

| Code                | 含义                                            |
| ------------------- | ----------------------------------------------- |
| `config_missing`    | lock 有该插件，但 package 配置缺失。            |
| `lock_missing`      | 配置有该 package，但 lock 中缺失。              |
| `package_missing`   | `.natalia/plugins` 中缺少 lock 记录的 package。 |
| `manifest_mismatch` | 已安装 manifest 的 ID/版本与 lock 不同。        |

`plugin reconcile` 会根据 lock 来源重装报告为 `package_missing` 的 package，为 lock
中存在但配置缺失的项补上 package 配置，并删除没有 lock owner 的 package 配置。
返回值包含 `reconciled: true`、原始 `findings` 和再次审计后的 `remaining`。它不会凭空
补造缺失 lock entry，也不会静默接受 manifest mismatch；这两类问题应通过重装预期包
来修复。

### 常见失败

| 错误                                                    | 处理方式                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `plugin directory already exists`                       | 换一个空路径；create 永远不会覆盖文件。                           |
| `must contain exactly one natalia.plugin.json`          | 修正 npm `files`，并移除 fixture/source 子目录中的额外 manifest。 |
| `plugin entry manifest does not match`                  | 保持入口导出和文件 manifest 完全相同，包括数组和默认值。          |
| `manifest version ... does not match installed package` | 让 `package.json` 和两份 manifest 使用相同版本。                  |
| `plugin capability denied`                              | 把使用的每个 contribution API 加入 `integrationPoints`。          |
| `plugin config invalid`                                 | 修正 `plugins.settings[pluginID]`；错误会包含属性路径。           |
| `plugin dependency unresolved`                          | 安装/启用依赖插件、修正版本范围，或移除冲突/依赖环。              |
| `did not provide declared services`                     | 为 `provides` 中每个名称调用 `api.services.provide`。             |
| `unknown plugin`                                        | 使用 `plugin list` 显示的 manifest ID，而不是 npm package name。  |

框架能力不会出现在上述维护命令中。例如禁用名为 `natalia-transport`、
`natalia-sandbox` 或 `natalia-checkpoint` 的配置项不会关闭对应框架子系统；这些名称不再
是可维护的 plugin ID。

runtime RPC 的 `pluginUnload` 和 `pluginReload` 只操作已运行 registry，不能替代 CLI
持久化的 install、uninstall、enable、disable。

## 6. UI adapter

UI 是使用现有 `adapters` integration point 的普通 v2 插件。仓库内示例演示 host
contract，但外部 UI 包必须和其他外部插件一样使用可发布的 ESM JavaScript 布局。本节给出
该包从零开始的完整开发路径。

### 创建外部 UI package

先用普通脚手架创建包，再调整 manifest 的 scope 和 integration point：

```bash
natalia-ts plugin create ./my-ui --id yourco.ui.web --package @yourco/natalia-ui-web
```

使用 `scope: "process"`、`integrationPoints: ["adapters"]` 和唯一的 adapter
`kind`。发布包需要 `@natalia/plugin` 注册 adapter；只有在导入 `RuntimeClient`、
`RuntimeEvent` 或其他公共类型时，才添加 `@natalia/contracts`：

```json
{
  "name": "@yourco/natalia-ui-web",
  "version": "1.0.0",
  "type": "module",
  "files": ["src", "natalia.plugin.json"],
  "exports": { ".": "./src/index.js" },
  "dependencies": {
    "@natalia/plugin": "<compatible-version>",
    "@natalia/contracts": "<compatible-version>"
  }
}
```

不要把 `packages/examples/ui-plugin` 的 `workspace:*` 依赖版本或 `.ts` 入口照搬到
发行包；它是仓库 fixture。外部 package 必须发布可导入的 `.js` 或 `.mjs` entry，并声明
与发行版兼容的实际依赖版本。

### Mount 与 dispose

UI 插件本身很小。注册是惰性的：只有 UI host 选择对应 adapter kind 后才调用 `mount`；
`dispose` 必须释放 `mount` 创建的所有 listener、timer、renderer、socket 或其他资源。

```js
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.ui.web",
    version: "1.0.0",
    name: "Web UI",
    description: "Example UI adapter.",
    entry: "src/index.js",
    scope: "process",
    provides: [],
    requires: [],
    optionalRequires: [],
    conflicts: [],
    dependencies: [],
    hooks: {},
    integrationPoints: ["adapters"],
  },
  setup(api) {
    let unsubscribe: (() => void) | undefined;
    api.adapters.registerUi({
      kind: "ui.web",
      async mount(input) {
        const commands = await input.commands.list();
        render({ runtime: input.runtime, commands });
        unsubscribe = input.events.subscribe((event) => update(event));
      },
      dispose() {
        unsubscribe?.();
        unmount();
      },
    });
  },
});
```

host 注入三个公共端口：

| Port                                  | 用途                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input.runtime`                       | 完整的类型化 `RuntimeClient`：提交 turn、查询 session/resource、调用 checkpoint 方法和其他已文档化的 runtime 操作。Feature 方法是可选的，方法不存在时应展示不可用状态。 |
| `input.events.subscribe(listener)`    | 订阅共享 `RuntimeEvent` 流，并返回 unsubscribe。UI projection state 保持在 adapter 内部；不要另建 runtime 或修改 framework state。                                      |
| `input.commands.list()` / `execute()` | 列出并执行 host 的权威 command catalog。通过 command `name` 定位，向 `execute` 传入原始命令与已解析参数。                                                               |

UI package 不应导入内部 TUI host、checkpoint controller、registry 或 transport 实现，只能
使用这些公共 port 与公开的 `@natalia/contracts` type。因此 OpenTUI、web、desktop 或自定义
renderer 都可使用同一 runtime，而不依赖当前 TUI 的 state 或组件。

### Checkpoint 与消息级 restore

restore UI 必须围绕 preview 构建，不能直接修改 workspace：

```js
async function openRestore(input, checkpointID) {
  if (!input.runtime.checkpointPreview || !input.runtime.checkpointRollback)
    return showUnavailable("Checkpoint management is unavailable.");

  const preview = await input.runtime.checkpointPreview(checkpointID);
  renderRollbackPreview(
    preview.changes,
    preview.context,
    preview.resources,
    preview.warnings,
  );

  // 可选 dry run 返回相同 preview，不会改变 workspace。
  await input.runtime.checkpointRollback({ id: checkpointID, dryRun: true });

  if (!(await confirmRestore(preview))) return;
  const result = await input.runtime.checkpointRollback({
    id: checkpointID,
    dryRun: false,
  });
  showRestored({ safetyCheckpointID: result.safetyCheckpointID });
}
```

`checkpointList()` 返回带 `turnID` 的 `RuntimeCheckpoint`。transcript message ID 采用
`${turnID}:user`、`${turnID}:assistant` 及相关 segment 形式，因此 UI 可以解析 turn ID，
再用 `checkpoint.turnID === turnID` 过滤 checkpoint。这样能在 user message 或 assistant
reply 上提供 `Restore...`，而不耦合 OpenTUI renderer。

展示每个 `CheckpointPreview.changes` 的 `add`、`modify`、`delete`、`rename`、`mode` 或
`symlink` 类型，并展示 context truncation、resource policy、warning 和 `complete` 状态。
不完整 checkpoint 不能提供 restore。确认 rollback 会在修改 workspace 前创建
`safetyCheckpointID`；应明确显示“Restore is reversible”，并允许用户之后恢复到该 safety
checkpoint。

小型 preview 可以只用一次确认。范围大或包含 destructive change 的 preview，应要求用户
查看 changed-file list 和 warning 后才启用确认。runtime 始终是权威边界：即使 UI 出错，它也
会拒绝不完整 target 和 safety checkpoint。

### 测试 package

将 renderer 代码放在 adapter-local function 后，并使用 fake `RuntimeClient` 测试 `mount`。
验证 registration 在 materialize 前不产生 I/O，event 只更新 UI 本地 state，command 通过
catalog 执行，`dispose` 停止所有 event listener 和 renderer resource。端到端
materialization 测试可参考 `packages/examples/ui-plugin` 与
`apps/tui/test/example-ui-plugin.test.ts`。

### 启动已安装的 UI

UI 包与普通插件一样安装，并按 adapter kind 启动——一个包、两条命令：

```bash
natalia-ts plugin install @yourco/natalia-ui-web
natalia-ts ui ui.web
```

`natalia-ts ui <kind>` 在进程内对真实 runtime 挂载该 UI；`natalia-ts ui`（不带 kind）
列出已启用已安装/path 插件贡献的可用 UI kind。TUI 与所有已安装 UI 共用同一个通用 host
`createUiAdapterHost`（`@natalia/client`）：解析 workspace 配置、发现已启用插件、只把
adapter-capable 的 process 插件装入一个进程 registry，并对同一个共享
`UiAdapterMountInput` materialize 请求的 kind(s)。关闭幂等且 fail-closed（先
materializer，再 registry，最后 runtime）。

## 7. 端到端教程

以下步骤从源码 checkout 完整运行外部插件生命周期。发行版中用 `natalia-ts` 替换
`npm run ts:cli --`：

```bash
# 1. 创建 JavaScript package。
npm run ts:cli -- plugin create ./demo-plugin \
  --id yourco.demo \
  --package @yourco/natalia-demo

# 2. 编辑 demo-plugin/src/index.js，并保持两份 manifest 一致。

# 3. 从本地目录安装并检查持久化状态。
npm run ts:cli -- plugin install ./demo-plugin
npm run ts:cli -- plugin list
npm run ts:cli -- plugin doctor

# 4. 验证 desired activation state。
npm run ts:cli -- plugin disable yourco.demo
npm run ts:cli -- plugin enable yourco.demo

# 5. 检查发布内容并安装打包产物。
npm pack --dry-run ./demo-plugin
npm pack ./demo-plugin
npm run ts:cli -- plugin install ./yourco-natalia-demo-1.0.0.tgz

# 6. 删除安装包并审计结果。
npm run ts:cli -- plugin uninstall yourco.demo
npm run ts:cli -- plugin doctor
```

源码变更后需要重新安装目录或 tarball。测试新 desired state 前，应重启或 reload 长时间
运行的 Natalia 进程。

## 8. Runtime 分发插件目录

以下 ID 由 Natalia 发行版保留，安装包不能使用。它们会出现在 `plugin list`；只要配置
没有显式禁用，catalog 就报告为 enabled。部分插件只有在当前 host 提供构造输入时才会
真正 materialize。

| ID                      | 名称                       | API | Scope     | Integration points        |
| ----------------------- | -------------------------- | --- | --------- | ------------------------- |
| `natalia-local-tools`   | Local Tools                | v2  | workspace | tools, services           |
| `natalia-mcp`           | MCP Server                 | v2  | session   | tools, services           |
| `natalia-skills`        | Skills                     | v1  | workspace | tools, commands, services |
| `natalia-task-module`   | Task Module                | v2  | session   | tools                     |
| `natalia-task-workflow` | Task Workflow              | v2  | workspace | services, commands        |
| `natalia-team`          | Team                       | v2  | workspace | tools, services           |
| `natalia-tool-ask`      | Interactive Question Tools | v2  | session   | tools                     |
| `natalia-tool-fs-read`  | Filesystem Read Tools      | v2  | workspace | tools                     |
| `natalia-tool-fs-write` | Filesystem Write Tools     | v2  | workspace | tools                     |
| `natalia-tool-pdf`      | PDF Tools                  | v1  | workspace | tools                     |
| `natalia-tool-process`  | Managed Process Tools      | v2  | session   | tools, services           |
| `natalia-tool-search`   | Search Tools               | v2  | workspace | tools                     |
| `natalia-tool-shell`    | Shell Tools                | v2  | session   | tools                     |
| `natalia-tool-terminal` | Terminal Tools             | v2  | session   | tools, services           |
| `natalia-tool-todo`     | Todo Tools                 | v2  | session   | tools                     |
| `natalia-tool-web`      | Web Tools                  | v2  | session   | tools                     |

runtime、transport、session、sandbox、checkpoint、provider/model、SDK 等框架 package
明确不在表中：它们不是插件，也没有 plugin lifecycle switch。

## 9. 发布检查清单

1. 外部 package 使用 ESM `.js` 或 `.mjs` 入口；Natalia 不会为第三方插件安装
   TypeScript source loader。
2. 保持 `package.json.version`、`natalia.plugin.json`、入口导出 manifest 的版本和
   内容一致。
3. 在 `dependencies` 中声明 `@natalia/plugin` 和所有直接导入的 Natalia package。
   进程内插件开发不要使用 `@natalia/sdk`。
4. 固定与目标 Natalia 发行版兼容的版本。脚手架会使用当前 CLI 发行版的
   `@natalia/plugin` 版本。
5. 只包含 runtime 文件和恰好一个 manifest。允许 bundle，但生成的 ESM 入口和所有
   runtime dependency 必须仍可导入。
6. 不依赖 `preinstall`、`postinstall`、uninstall script 或 manifest hook；npm script
   被禁用，manifest `hooks` 必须为 `{}`。
7. 运行 `npm pack --dry-run` 并检查文件列表，再把 tarball 安装到干净 workspace，最后
   运行 `plugin doctor`。
8. npm scope 未配置为 public 时，用 `npm publish --access public` 发布 scoped public
   package。package lock 可作为源码元数据选择性提交；npm 会自行构建 closure，Natalia
   也会记录实际安装结果。

## 10. 审计与测试

registry 记录 `loaded`、`unloaded`、`denied`、`failed` audit，runtime diagnostic
暴露激活错误。插件至少应验证：

1. adapter materialize 前，注册不会创建外部资源。
2. 工具和命令保留声明名与审批声明。
3. setup 失败后没有 contribution 残留。
4. disable、unload、uninstall 后没有该 owner 的 tool、service、command、listener、
   resource 或 UI surface。
5. dispose 幂等，并释放事件订阅和进程。

仓库内插件运行 `npm run typecheck`、`npm run test`、`npm run guard:imports`。文件行数
只作为评审提示；是否拆分以职责内聚、所有权边界和依赖方向为准，不为满足固定行数机械拆分。
