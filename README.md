# Natalia CLI

[中文](#中文) | [English](#english)

<a id="english"></a>

## English

Natalia is a local-first coding-agent runtime built with TypeScript and Bun.
Its OpenTUI application, automation CLI, typed SDK, and local transports all
use the same `RuntimeClient` contract and event model.

### Highlights

- Durable local sessions backed by JSON or SQLite, with message history,
  context compaction, recovery, and session forks.
- Streaming provider adapters for OpenAI-compatible APIs, Anthropic, and Gemini.
- Typed tool execution through schema validation, policy, conditional approval,
  audit, and secret-redaction boundaries.
- Checkpoint creation and preview, dry-run rollback, and confirmed rollback with
  an automatic safety checkpoint.
- Managed processes and PTYs, directory-copy or Git-worktree sandboxes, MCP
  servers, skills, workflows, and trusted in-process plugins.
- One plugin registry and lifecycle for runtime-provided and user-installed
  tools, commands, events, services, resources, projections, workflows,
  settings, adapters, and scheduler jobs.
- Authenticated local HTTP/RPC, SSE, WebSocket, Unix-socket, and TLS transports,
  plus the typed SDK and daemon controls.
- A keyboard-first OpenTUI client with session history, approval and question
  overlays, resource dialogs, and the same runtime command catalog exposed to
  other UI adapters.

Natalia is local-first. It does not provide cloud accounts, organization management, billing, browser login, OAuth login, or hosted synchronization.

### Architecture

Natalia has three layers: **kernel + runtime + plugin**. The kernel provides
generic registry, lifecycle, ownership, event, and storage mechanisms. The
runtime composes the product surface, including sessions, providers, policy,
transport, and the CLI. Product features use one trusted, in-process plugin
system; runtime defaults and user-installed packages have the same permissions
and lifecycle. The CLI is the authoritative maintenance entry point. The TUI
is a UI adapter plugin over the same `RuntimeClient`, event stream, and command
catalog available to any other UI package.

### Requirements

- Bun and Node-compatible npm tooling.
- A configured provider credential for live model turns.
- An optional Chromium/Chrome binary for `browser_screenshot`.
- On Windows, Git for Windows and the Windows build of the managed WezTerm fork.
  See [docs/getting-started.md](docs/getting-started.md).

### Quick Start

New here? [docs/getting-started.md](docs/getting-started.md) walks through
install, provider setup, launching the TUI, and installing skills end to end.

Configure a provider through environment variables or `.natalia/config.json`:

```bash
export NATALIA_API_KEY="..."
export NATALIA_MODEL="gpt-4o-mini"
npm run ts:tui
```

`NATALIA_OPENAI_API_KEY` / `OPENAI_API_KEY` are accepted as fallbacks. Anthropic
and Gemini use the same runtime boundary — any model id the provider supports
works:

```bash
NATALIA_PROVIDER=anthropic NATALIA_API_KEY="..." NATALIA_MODEL="claude-3-7-sonnet-latest" npm run ts:tui
NATALIA_PROVIDER=gemini NATALIA_API_KEY="..." NATALIA_MODEL="gemini-2.5-pro" npm run ts:tui
```

Never commit API keys or place them in prompts, diagnostic fixtures, screenshots, or session files.

### Documentation

- [Getting started](docs/getting-started.md) — install, provider setup, TUI, skills.
- [API reference](docs/api-reference.md) — the stable HTTP/RPC protocol: auth, failure kinds, events, the write surface. Bilingual.
- [Types reference](docs/types-reference.md) — complete field shapes of every result type, nested objects expanded.
- [Config reference](docs/config-reference.md) — the full `.natalia/config.json` shape (types, optionality, defaults).
- [Plugin guide](docs/plugin-guide.md) — creating, authoring, packaging,
  installing, diagnosing, and publishing trusted in-process plugins.
- [Provider guide](docs/provider-guide.md) — writing a provider adapter.
- [CLI commands](docs/commands.md) — runtime, session, filesystem, plugin, UI,
  daemon, diagnostics, and recording commands.

### CLI And Local Transport

```bash
npm run ts:cli -- run "Reply exactly: pong"
npm run ts:cli -- run --json "Reply exactly: pong"
printf '%s\n' '{"prompt":"Reply exactly: pong"}' | npm run ts:cli -- eval

NATALIA_TRANSPORT_TOKEN="local-token" npm run ts:cli -- serve 8787
npm run ts:cli -- daemon 8787
npm run ts:cli -- daemon-status
npm run ts:cli -- daemon-stop

npm run ts:cli -- plugin create ./my-plugin --id yourco.plugin --package @yourco/natalia-plugin
npm run ts:cli -- plugin install ./my-plugin
npm run ts:cli -- plugin list
npm run ts:cli -- plugin disable yourco.plugin
npm run ts:cli -- plugin enable yourco.plugin
npm run ts:cli -- plugin doctor
npm run ts:cli -- plugin reconcile
npm run ts:cli -- plugin uninstall yourco.plugin
```

The local transport supports authenticated HTTP/RPC/SSE, WebSocket, Unix sockets, and TLS. Keep transport tokens and certificates outside the repository.

### Sessions And Recovery

Sessions persist under `.natalia/sessions/`. Context checkpoints, settled tool results, approvals/questions, checkpoints, and workspace state allow a user to reopen a session and continue with a new prompt such as “continue the previous task”.

If a process stops during an unknown provider or tool side effect, Natalia safely settles the interrupted turn instead of blindly replaying it. This prevents duplicate writes, shell commands, or external mutations.

### TUI Controls

| Control                         | Action                                  |
| ------------------------------- | --------------------------------------- |
| `Ctrl+N`                        | Create a session                        |
| `Ctrl+L`                        | Open session history                    |
| `Ctrl+P`                        | Open command palette                    |
| `Alt+P`                         | Cycle responsive panes                  |
| `Ctrl+C`                        | Cancel the active turn                  |
| `Ctrl+I` / `Ctrl+H`             | Show runtime status / help              |
| `Ctrl+Shift+K`                  | Open checkpoint management              |
| `Ctrl+Shift+B`                  | Open sandbox management                 |
| `Ctrl+S`                        | Create a snapshot                       |
| `Ctrl+Shift+G`                  | Fork session at the last message        |
| `Ctrl+Shift+T` / `Ctrl+Shift+E` | Edit scheduled tasks / flows            |
| `Ctrl+Shift+C`                  | Copy the last assistant or tool message |

Useful slash commands include `/doctor`, `/help`, `/status`, `/skills`, `/checkpoint`, `/checkpoints`, `/rollback <id> --dry-run`, `/pause`, and `/resume`.

### Configuration

Runtime configuration is typed ConfigV3. Project settings are stored in:

```text
.natalia/config.json
```

The Settings Center, available from the command palette, covers provider/model, runtime (max steps, retry,
checkpoints), browser/network, MCP, extensions (skills/plugins), workspace,
agent modes, permission profiles, and TUI preferences. Settings are saved as
minimal scope overlays and validated before writing.

### Safety Notes

- Workspace sandboxing is workspace isolation, not container or VM isolation.
- Tool calls pass schema, policy, and audit boundaries; approval is requested
  when required by the tool declaration and active policy.
- Sensitive PTY input is redacted from model context, transcript, checkpoint, and audit output.
- Browser/network access follows configured host, scheme, localhost, and private-network policy.
- Plugins are trusted in-process code. Tool approval follows each tool's
  `requiresApproval` declaration and the runtime's normal policy path.

### Development

```bash
npm run format
npm run typecheck
npm run test
npm run guard:imports
npm run licenses:check
npm run ts:build
npm run ts:release-check
npm run native-terminal:build-wezterm
```

TUI smoke tests are available through:

```bash
npm --workspace @natalia/tui run smoke:<name>
```

See the complete [CLI command reference](docs/commands.md) for runtime, session,
filesystem, plugin, UI, daemon, diagnostics, and recording commands.

To add skills, see section 6 of
[docs/getting-started.md](docs/getting-started.md) for the project, user, and
remote install paths and the `SKILL.md` format.

---

<a id="中文"></a>

## 中文

Natalia 是一个使用 TypeScript 和 Bun 构建的本地优先编码 Agent 运行时。
OpenTUI 应用、自动化 CLI、类型化 SDK 与本地 transport 统一使用同一套
`RuntimeClient` 契约和事件模型。

### 主要能力

- 使用 JSON 或 SQLite 持久化本地会话，支持消息历史、上下文压缩、恢复与
  session fork。
- 支持 OpenAI-compatible API、Anthropic 与 Gemini 的流式 provider adapter。
- 类型化工具执行统一经过 schema validation、policy、按需 approval、audit 与
  secret redaction 边界。
- 支持 checkpoint 创建和预览、dry-run rollback，以及自动创建 safety checkpoint
  的确认 rollback。
- 提供托管 process 与 PTY、目录副本或 Git worktree sandbox、MCP server、
  skill、workflow，以及可信的进程内插件。
- runtime 默认能力与用户安装插件共用同一套 registry 和 lifecycle，可贡献 tool、
  command、event、service、resource、projection、workflow、setting、adapter 与
  scheduler job。
- 提供带鉴权的本地 HTTP/RPC、SSE、WebSocket、Unix socket 与 TLS transport，
  以及类型化 SDK 和 daemon control surface。
- keyboard-first OpenTUI client 提供 session history、approval/question overlay、
  resource dialog，并与其他 UI adapter 共用 runtime command catalog。

Natalia 是 local-first runtime，不提供云账号、组织管理、账单、browser login、OAuth login 或 hosted sync。

### 架构

Natalia 只有三层：**kernel + runtime + plugin**。kernel 提供通用 registry、
lifecycle、ownership、事件与存储机制；runtime 装配 session、provider、policy、
transport 和 CLI 等产品面；产品功能统一使用一种可信的进程内插件体系。runtime
默认随附插件与用户安装包具有相同权限和生命周期。CLI 是权威维护入口；TUI 是基于
同一 `RuntimeClient`、事件流和 command catalog 的 UI adapter 插件，其他 UI 包与其
使用相同通道。

### 环境要求

- Bun 与兼容 Node 的 npm 工具链。
- live model turn 需要配置 provider credential。
- `browser_screenshot` 可选使用 Chromium/Chrome binary。
- Windows 上需要 Git for Windows 与 Windows 版的 managed WezTerm fork，
  参见 [docs/getting-started.zh-CN.md](docs/getting-started.zh-CN.md)。

### 快速开始

第一次使用请看
[docs/getting-started.zh-CN.md](docs/getting-started.zh-CN.md)，它完整覆盖了
安装、provider 配置、启动 TUI 和安装 skill 的全过程。

通过环境变量或 `.natalia/config.json` 配置 provider：

```bash
export NATALIA_API_KEY="..."
export NATALIA_MODEL="gpt-4o-mini"
npm run ts:tui
```

`NATALIA_OPENAI_API_KEY` / `OPENAI_API_KEY` 作为 fallback 同样被接受。Anthropic
与 Gemini 通过同一 runtime boundary 使用——模型 id 填你的 provider 支持的任何值：

```bash
NATALIA_PROVIDER=anthropic NATALIA_API_KEY="..." NATALIA_MODEL="claude-3-7-sonnet-latest" npm run ts:tui
NATALIA_PROVIDER=gemini NATALIA_API_KEY="..." NATALIA_MODEL="gemini-2.5-pro" npm run ts:tui
```

不要将 API key 写入仓库、prompt、diagnostic fixture、截图或 session 文件。

### 文档

- [快速开始](docs/getting-started.zh-CN.md) — 安装、provider 配置、TUI、skill。
- [API 参考](docs/api-reference.zh-CN.md) — 稳定 HTTP/RPC 协议：鉴权、失败分类、
  事件流、写面。中英双语。
- [类型参考](docs/types-reference.zh-CN.md) — 每个结果类型的完整字段形状，
  嵌套对象已展开。
- [配置参考](docs/config-reference.zh-CN.md) — `.natalia/config.json` 的完整
  形状（类型、可选性、默认值）。
- [插件指南](docs/plugin-guide.zh-CN.md) — 可信进程内插件的创建、开发、打包、
  安装、诊断与发布。
- [Provider 指南](docs/provider-guide.zh-CN.md) — 编写 provider adapter。
- [CLI 命令参考](docs/commands.md) — runtime、session、filesystem、plugin、UI、
  daemon、diagnostics 与 recording 命令。

### CLI 与本地 Transport

```bash
npm run ts:cli -- run "Reply exactly: pong"
npm run ts:cli -- run --json "Reply exactly: pong"
printf '%s\n' '{"prompt":"Reply exactly: pong"}' | npm run ts:cli -- eval

NATALIA_TRANSPORT_TOKEN="local-token" npm run ts:cli -- serve 8787
npm run ts:cli -- daemon 8787
npm run ts:cli -- daemon-status
npm run ts:cli -- daemon-stop

npm run ts:cli -- plugin create ./my-plugin --id yourco.plugin --package @yourco/natalia-plugin
npm run ts:cli -- plugin install ./my-plugin
npm run ts:cli -- plugin list
npm run ts:cli -- plugin disable yourco.plugin
npm run ts:cli -- plugin enable yourco.plugin
npm run ts:cli -- plugin doctor
npm run ts:cli -- plugin reconcile
npm run ts:cli -- plugin uninstall yourco.plugin
```

本地 transport 支持带认证的 HTTP/RPC/SSE、WebSocket、Unix socket 与 TLS。transport token 和证书应保存在仓库之外。

### 会话与恢复

会话保存在 `.natalia/sessions/`。context checkpoint、已结算 tool result、approval/question、checkpoint 与 workspace state 让用户可以重新打开 session 后发送“继续刚才的任务”来接续开发。

如果进程在未知的 provider 或 tool side effect 中停止，Natalia 会安全结算中断 turn，而不是盲目 replay，避免重复写文件、重复 shell command 或重复外部 mutation。

### TUI 快捷键

| 快捷键                          | 操作                                |
| ------------------------------- | ----------------------------------- |
| `Ctrl+N`                        | 新建 session                        |
| `Ctrl+L`                        | 打开 session history                |
| `Ctrl+P`                        | 打开 command palette                |
| `Alt+P`                         | 按响应式布局循环切换 pane           |
| `Ctrl+C`                        | 取消当前 turn                       |
| `Ctrl+I` / `Ctrl+H`             | 查看 runtime status / 帮助          |
| `Ctrl+Shift+K`                  | 打开 checkpoint 管理                |
| `Ctrl+Shift+B`                  | 打开 sandbox 管理                   |
| `Ctrl+S`                        | 创建 snapshot                       |
| `Ctrl+Shift+G`                  | 在最后一条消息处 fork session       |
| `Ctrl+Shift+T` / `Ctrl+Shift+E` | 编辑定时任务 / flow                 |
| `Ctrl+Shift+C`                  | 复制最后一条 assistant 或 tool 消息 |

常用 slash command：`/doctor`、`/help`、`/status`、`/skills`、`/checkpoint`、`/checkpoints`、`/rollback <id> --dry-run`、`/pause`、`/resume`。

### 配置

runtime 使用类型化 ConfigV3。项目配置文件：

```text
.natalia/config.json
```

Settings Center 可从命令面板打开，覆盖 provider/model、runtime（max steps、retry、
checkpoints）、browser/network、MCP、extensions（skills/plugins）、workspace、
agent modes、permission profiles 与 TUI preferences。设置以最小 scope overlay
保存，并在写入前经过 schema validation。

### 安全说明

- Workspace sandbox 是 workspace isolation，不是 container 或 VM isolation。
- 所有 tool call 都经过 schema、policy 与 audit 边界；仅在工具声明和当前 policy
  要求时请求 approval。
- 敏感 PTY 输入不会进入模型上下文、transcript、checkpoint 或 audit output。
- Browser/network 访问遵循配置的 host、scheme、localhost 与 private-network policy。
- 插件是可信的进程内代码。工具审批尊重各工具的 `requiresApproval` 声明，并继续
  经过 runtime 的常规 policy 路径。

### 开发

```bash
npm run format
npm run typecheck
npm run test
npm run guard:imports
npm run licenses:check
npm run ts:build
npm run ts:release-check
npm run native-terminal:build-wezterm
```

TUI smoke test：

```bash
npm --workspace @natalia/tui run smoke:<name>
```

完整的 runtime、session、filesystem、plugin、UI、daemon、diagnostics 与 recording 命令见
[CLI 命令参考](docs/commands.md)。

安装 skill 的项目级、用户级与远程三种方式，以及 `SKILL.md` 格式，见
[docs/getting-started.zh-CN.md](docs/getting-started.zh-CN.md) 第 6 节。

## License / 许可

Natalia CLI is licensed under the Apache License, Version 2.0. See
[LICENSE](LICENSE) and [NOTICE](NOTICE).

Third-party dependency attribution and bundled license texts are provided in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

Natalia CLI 使用 Apache License 2.0，详见 [LICENSE](LICENSE) 与
[NOTICE](NOTICE)。第三方依赖归属及随包分发的许可文本见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt)。

## Contact / 联系方式

- rapidsound@163.com
- mikotomisaka477@gmail.com
