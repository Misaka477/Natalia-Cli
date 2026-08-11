# Natalia CLI

[中文](#中文) | [English](#english)

<a id="english"></a>

## English

Natalia CLI is a local-first TypeScript/Bun coding agent runtime. It provides a terminal UI, CLI automation, typed SDK and local transport over one durable runtime contract.

### Highlights

- Local sessions with JSON/SQLite persistence, context compaction, message history, and session fork.
- Provider adapters for OpenAI-compatible APIs, Anthropic, and Gemini.
- Typed tool execution with policy, schema validation, approval, audit, and secret redaction boundaries.
- Checkpoint creation, preview, dry-run rollback, and confirmed rollback with safety checkpoints.
- Managed PTY, process, sandbox workspace isolation, MCP, skills, plugins, and workflows.
- Local HTTP/RPC/SSE/WebSocket, Unix socket, TLS, SDK, and daemon control surfaces.
- Keyboard-first OpenTUI interface with session history, approval/question overlays, and resource dialogs.

Natalia is local-first. It does not provide cloud accounts, organization management, billing, browser login, OAuth login, or hosted synchronization.

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
- [Plugin guide](docs/plugin-guide.md) — in-process plugins (tools, events, commands) and the trust model.
- [Provider guide](docs/provider-guide.md) — writing a provider adapter.
- [CLI commands](docs/commands.md) — session, filesystem, daemon, diagnostics, recording.

### CLI And Local Transport

```bash
npm run ts:cli -- run "Reply exactly: pong"
npm run ts:cli -- run --json "Reply exactly: pong"
printf '%s\n' '{"prompt":"Reply exactly: pong"}' | npm run ts:cli -- eval

NATALIA_TRANSPORT_TOKEN="local-token" npm run ts:cli -- serve 8787
npm run ts:cli -- daemon 8787
npm run ts:cli -- daemon-status
npm run ts:cli -- daemon-stop
```

The local transport supports authenticated HTTP/RPC/SSE, WebSocket, Unix sockets, and TLS. Keep transport tokens and certificates outside the repository.

### Sessions And Recovery

Sessions persist under `.natalia/sessions/`. Context checkpoints, settled tool results, approvals/questions, checkpoints, and workspace state allow a user to reopen a session and continue with a new prompt such as “continue the previous task”.

If a process stops during an unknown provider or tool side effect, Natalia safely settles the interrupted turn instead of blindly replaying it. This prevents duplicate writes, shell commands, or external mutations.

### TUI Controls

| Control          | Action                       |
| ---------------- | ---------------------------- |
| `Ctrl+N`         | Create a session             |
| `Ctrl+L`         | Open session history         |
| `Ctrl+,`         | Open settings                |
| `Ctrl+P`         | Open command palette         |
| `Ctrl+C`         | Cancel the active turn       |
| `Ctrl+I` / `Ctrl+H` | Show runtime status / help |
| `Ctrl+Shift+K`   | Open checkpoint management   |
| `F8`             | Open terminal management     |
| `Ctrl+Shift+B`   | Open sandbox management      |
| `Ctrl+T`         | Toggle terminal/chat focus   |
| `Ctrl+S`         | Create a snapshot            |
| `Ctrl+Shift+G`   | Fork session at the last message |
| `Ctrl+Shift+T` / `Ctrl+Shift+E` | Edit scheduled tasks / flows |
| `Ctrl+Shift+C`   | Copy the last assistant or tool message |

Useful slash commands include `/doctor`, `/help`, `/status`, `/skills`, `/checkpoint`, `/checkpoints`, `/rollback <id> --dry-run`, `/pause`, and `/resume`.

### Configuration

Runtime configuration is typed ConfigV2. Project settings are stored in:

```text
.natalia/config.json
```

The Settings Center (Ctrl+,) covers provider/model, runtime (max steps, retry,
checkpoints), browser/network, MCP, extensions (skills/plugins), workspace,
agent modes, permission profiles, and TUI preferences. Settings are saved as
minimal scope overlays and validated before writing.

### Safety Notes

- Workspace sandboxing is workspace isolation, not container or VM isolation.
- Tool calls pass policy, schema, approval, and audit boundaries.
- Sensitive PTY input is redacted from model context, transcript, checkpoint, and audit output.
- Browser/network access follows configured host, scheme, localhost, and private-network policy.
- Dynamic plugin tools fail closed and require runtime-controlled approval unless explicitly trusted as read-only.

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

See the complete [CLI command reference](docs/commands.md) for session,
filesystem, daemon, diagnostics, and recording commands.

To add skills, see section 6 of
[docs/getting-started.md](docs/getting-started.md) for the project, user, and
remote install paths and the `SKILL.md` format.

---

<a id="中文"></a>

## 中文

Natalia CLI 是一个本地优先的 TypeScript/Bun 编码 Agent 运行时。它通过同一套 durable runtime contract 提供终端 UI、CLI 自动化、类型化 SDK 与本地 transport。

### 主要能力

- 本地 JSON/SQLite 会话持久化、上下文压缩、消息历史与 session fork。
- OpenAI-compatible、Anthropic、Gemini provider adapter。
- 类型化工具执行，统一经过 policy、schema validation、approval、audit 与 secret redaction 边界。
- Checkpoint 创建、预览、dry-run rollback，以及带 safety checkpoint 的确认 rollback。
- 托管 PTY、process、workspace sandbox isolation、MCP、skills、plugins、workflows。
- 本地 HTTP/RPC/SSE/WebSocket、Unix socket、TLS、SDK 与 daemon control surface。
- keyboard-first OpenTUI，包含 session history、approval/question overlay 与 resource dialogs。

Natalia 是 local-first runtime，不提供云账号、组织管理、账单、browser login、OAuth login 或 hosted sync。

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
- [插件指南](docs/plugin-guide.zh-CN.md) — 进程内插件（tools、events、commands）
  与信任模型。
- [Provider 指南](docs/provider-guide.zh-CN.md) — 编写 provider adapter。
- [CLI 命令参考](docs/commands.md) — session、filesystem、daemon、diagnostics、
  recording 命令。

### CLI 与本地 Transport

```bash
npm run ts:cli -- run "Reply exactly: pong"
npm run ts:cli -- run --json "Reply exactly: pong"
printf '%s\n' '{"prompt":"Reply exactly: pong"}' | npm run ts:cli -- eval

NATALIA_TRANSPORT_TOKEN="local-token" npm run ts:cli -- serve 8787
npm run ts:cli -- daemon 8787
npm run ts:cli -- daemon-status
npm run ts:cli -- daemon-stop
```

本地 transport 支持带认证的 HTTP/RPC/SSE、WebSocket、Unix socket 与 TLS。transport token 和证书应保存在仓库之外。

### 会话与恢复

会话保存在 `.natalia/sessions/`。context checkpoint、已结算 tool result、approval/question、checkpoint 与 workspace state 让用户可以重新打开 session 后发送“继续刚才的任务”来接续开发。

如果进程在未知的 provider 或 tool side effect 中停止，Natalia 会安全结算中断 turn，而不是盲目 replay，避免重复写文件、重复 shell command 或重复外部 mutation。

### TUI 快捷键

| 快捷键           | 操作                             |
| ---------------- | -------------------------------- |
| `Ctrl+N`         | 新建 session                     |
| `Ctrl+L`         | 打开 session history             |
| `Ctrl+,`         | 打开 settings                    |
| `Ctrl+P`         | 打开 command palette             |
| `Ctrl+C`         | 取消当前 turn                    |
| `Ctrl+I` / `Ctrl+H` | 查看 runtime status / 帮助     |
| `Ctrl+Shift+K`   | 打开 checkpoint 管理             |
| `F8`             | 打开终端管理                     |
| `Ctrl+Shift+B`   | 打开 sandbox 管理                |
| `Ctrl+T`         | 切换终端/对话焦点                |
| `Ctrl+S`         | 创建 snapshot                    |
| `Ctrl+Shift+G`   | 在最后一条消息处 fork session    |
| `Ctrl+Shift+T` / `Ctrl+Shift+E` | 编辑定时任务 / flow |
| `Ctrl+Shift+C`   | 复制最后一条 assistant 或 tool 消息 |

常用 slash command：`/doctor`、`/help`、`/status`、`/skills`、`/checkpoint`、`/checkpoints`、`/rollback <id> --dry-run`、`/pause`、`/resume`。

### 配置

runtime 使用类型化 ConfigV2。项目配置文件：

```text
.natalia/config.json
```

Settings Center（Ctrl+,）覆盖 provider/model、runtime（max steps、retry、
checkpoints）、browser/network、MCP、extensions（skills/plugins）、workspace、
agent modes、permission profiles 与 TUI preferences。设置以最小 scope overlay
保存，并在写入前经过 schema validation。

### 安全说明

- Workspace sandbox 是 workspace isolation，不是 container 或 VM isolation。
- 所有 tool call 都经过 policy、schema、approval 与 audit 边界。
- 敏感 PTY 输入不会进入模型上下文、transcript、checkpoint 或 audit output。
- Browser/network 访问遵循配置的 host、scheme、localhost 与 private-network policy。
- Dynamic plugin tool 默认 fail-closed；除非显式信任为 read-only，否则必须经过 runtime-controlled approval。

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

完整的 session、filesystem、daemon、diagnostics 与 recording 命令见
[CLI 命令参考](docs/commands.md)。

安装 skill 的项目级、用户级与远程三种方式，以及 `SKILL.md` 格式，见
[docs/getting-started.zh-CN.md](docs/getting-started.zh-CN.md) 第 6 节。

## License / 许可

Natalia CLI is licensed under the Apache License, Version 2.0. See
[LICENSE](LICENSE) and [NOTICE](NOTICE).

Third-party dependency attribution and bundled license texts are provided in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). Redistributors that bundle
system components such as Bun, Python, Bash, or Git must also comply with those
components' licenses.

Natalia CLI 使用 Apache License 2.0，详见 [LICENSE](LICENSE) 与
[NOTICE](NOTICE)。第三方依赖归属及随包分发的许可文本见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt)。如果发行包同时捆绑
Bun、Python、Bash 或 Git 等系统组件，还需要分别履行对应组件的许可义务。

## Contact / 联系方式

- rapidsound@163.com
- mikotomisaka477@gmail.com
