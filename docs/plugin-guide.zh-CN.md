# Natalia 插件开发指南 - v2

> `PLUGIN_API_VERSION` 为 `2`。一个插件就是一个包，包内同时包含 package 元数据、
> `natalia.plugin.json`、入口模块和实现。插件 API 是进程内 host 扩展面，不是 RPC 面。

## 1. 单一插件体系

Natalia 只有一种插件。runtime 默认随附插件和用户安装插件使用同一 registry、声明名、
权限、依赖解析及装载/卸载生命周期。runtime 默认项只是分发配置，不拥有特权 API，
也不走第二套生命周期。

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
  src/index.ts
```

包必须声明源码直接导入的 runtime 包：

```json
{
  "name": "@yourco/natalia-demo",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@natalia/plugin": "<compatible-version>",
    "@natalia/contracts": "<compatible-version>"
  }
}
```

版本应与目标 Natalia 发行版兼容。包管理器会把完整 package closure 安装到
`.natalia/plugins`；不要要求用户另建 SDK 软链接或单独复制入口文件。

## 3. Manifest v2

```json
{
  "apiVersion": 2,
  "id": "yourco.demo",
  "version": "1.0.0",
  "name": "Demo",
  "description": "A demonstration plugin.",
  "entry": "src/index.ts",
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
- `version` 是语义版本；`entry` 必须是包内本地 `.js`、`.mjs` 或 `.ts` 文件。
- `scope` 为 `process`、`workspace` 或 `session`，表示生命周期归属，不是安全边界。
- `provides`、`requires`、`optionalRequires` 描述 service contract。
- `conflicts` 和 `dependencies` 进入确定性依赖解析；dependency 可标记
  `optional` 或 `peer`。
- `hooks` 可声明 `preInstall`、`postInstall`、`preUninstall`、
  `postUninstall` package script。
- `integrationPoints` 必须覆盖 `setup` 使用的每个贡献 API。

manifest、依赖和配置校验在激活前完成。`setup` 失败时，本次激活产生的注册项全部
回滚，插件 audit 状态为 `failed`。

## 4. 实现插件

```ts
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.demo",
    version: "1.0.0",
    name: "Demo",
    description: "A demonstration plugin.",
    entry: "src/index.ts",
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

## 5. 生命周期命令

CLI 是权威维护入口：

```bash
natalia plugin install @yourco/natalia-demo
natalia plugin list
natalia plugin disable yourco.demo
natalia plugin enable yourco.demo
natalia plugin uninstall yourco.demo
```

使用 `--workspace /path/to/project` 可指定其他工作区。

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

runtime RPC 的 `pluginUnload` 和 `pluginReload` 只操作已运行 registry，不能替代 CLI
持久化的 install、uninstall、enable、disable。

## 6. UI adapter

UI 是使用现有 `adapters` integration point 的普通 v2 插件：

```ts
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.ui.web",
    version: "1.0.0",
    name: "Web UI",
    description: "Example UI adapter.",
    entry: "src/index.ts",
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

host 注入三个公共端口：`runtime` 是 `RuntimeClient` 视图，`events.subscribe` 是
runtime 事件流，`commands.list` 是权威 command catalog。注册本身是惰性的，直到
host materialize 对应 adapter 才创建 UI；卸载通过与其他 contribution 相同的 owner
和 lifecycle 路径调用 disposer。

可执行最小包位于 `packages/example-ui-plugin`，端到端 materialization 测试位于
`apps/tui/test/example-ui-plugin.test.ts`。生产 TUI 使用相同 `registerUi` 端口和
materializer，因此新增 UI 不需要 TUI 专用 host 分支。

## 7. 审计与测试

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
