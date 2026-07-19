# Natalia CLI

## TypeScript/Bun Runtime Preview

The TypeScript/Bun runtime is the active TS7 replacement path. The legacy Go CLI remains available as a fallback until M13 and must not be deleted yet.

Run the real TypeScript/OpenTUI client with an OpenAI-compatible provider:

```bash
export NATALIA_OPENAI_API_KEY="..."
export NATALIA_MODEL="gpt-4o-mini"
npm run ts:tui
```

Anthropic and Gemini adapters are also available through the same TS runtime boundary:

```bash
NATALIA_PROVIDER=anthropic NATALIA_API_KEY="..." NATALIA_MODEL="claude-3-5-sonnet-latest" npm run ts:tui
NATALIA_PROVIDER=gemini NATALIA_API_KEY="..." NATALIA_MODEL="gemini-1.5-pro" npm run ts:tui
```

The TUI is an operational TS7 agent shell, not a fixture demo. Before using a provider, run the provider-independent doctor screen:

```bash
npm --workspace @natalia/tui run doctor
# or start normally, then enter /doctor and /help in the composer
```

The interactive TUI path is `npm run ts:tui`. It uses `createRealRuntimeClient` through `@natalia/client`; it does not launch or proxy the Go runtime. Useful in-TUI controls: `/doctor`, `/help`, `/status`, `/skills`, `/checkpoint`, `/checkpoints`, `/rollback <id> --dry-run`, `/pause`, `/resume`, `Ctrl-C` cancel, and `Ctrl-D` on an empty composer to exit.

The TUI is a Bun source process, not a hot-reloading dev server. After updating the workspace, exit every existing Natalia TS7 TUI instance and start a fresh `npm run ts:tui`; the header must show `TS7 UI r20260718.7`. This revision marker confirms the current stream batching/card-boundary renderer is running.

### TUI Conversations And Settings

The TS7 TUI persists conversations under `.natalia/sessions/` and preferences under `.natalia/tui-preferences.json` in the active workspace.

- `Ctrl+N`: start a new conversation in the same workspace.
- `Ctrl+L`: open Session History; use Up/Down and Enter to reopen a saved conversation, or `N` to create one.
- `Ctrl+,`: open TUI Settings; toggle tool-detail default, comfortable/compact density, and follow-newest-output behavior.
- `Ctrl+P`: show the command and interaction palette.

Session switching restarts only the TypeScript/Bun TUI process with the selected `--session` ID. It does not invoke the Go launcher or modify legacy session files.

Settings Center sections are `Provider & Model`, `Runtime`, `Context`, `Checkpoint`, `TUI`, and `Legacy`. Use Left/Right to change section and Enter to change a high-frequency value. Press `E` to open the full schema-validated TS `ConfigV2` editor; `Ctrl+S` atomically saves `.natalia/config.json`. A new TS session loads this file before legacy Go config discovery. API key values are never rendered in the summary and must be reviewed carefully in the full editor.

The `Legacy` section deliberately diagnoses unsupported Go-only settings such as hooks, browser/network policy, and MCP OAuth rather than pretending they are native TS runtime settings.

By default, the TUI resolves the nearest parent Git project as its workspace, so starting it inside `apps/tui` targets the repository root rather than the TUI source directory. To target another workspace, use `NATALIA_WORKSPACE=/absolute/path npm run dev` or `npm run dev -- --workspace /absolute/path`.

If no TS provider environment variable is set, the TS runtime also performs a **read-only, in-memory** lookup of the active Go profile at `~/.config/natalia-cli/config.yaml`: `default_profile -> profiles.<name> -> providers.<name>`. Its API key is never written to TS config, session events, diagnostics, or the TUI. Environment variables remain higher priority. Set `NATALIA_LEGACY_CONFIG_PATH=/absolute/path/config.yaml` to test a different legacy config file.

Run one non-TTY prompt, structured JSON events, stdio JSONL automation, or the local HTTP/SSE transport:

```bash
npm run ts:cli -- --once "Reply exactly: pong"
npm run ts:cli -- --once --json "Reply exactly: pong"
printf '%s\n' '{"prompt":"Reply exactly: pong"}' | npm run ts:cli -- --stdio
printf '%s\n' '{"pause":"operator hold"}' '{"resume":true}' | npm run ts:cli -- --stdio
NATALIA_TRANSPORT_TOKEN="local-token" npm run ts:cli -- --serve 8787
```

Run an opt-in TS daemon with a private registration/token under the state directory:

```bash
npm run ts:cli -- --daemon-serve 8787
npm run ts:cli -- --daemon-status
npm run ts:cli -- --daemon-stop
```

Use `--daemon-dir /absolute/state/dir` to isolate test or multi-user registrations. The daemon lifecycle is TypeScript/Bun only and does not launch the Go runtime. Unix socket and TLS server options are available from `@natalia/transport`; production certificate/socket lifecycle still requires the TS7.5 manual smoke gate.

The TS TUI uses real provider streaming and real native file/shell/process/background/checkpoint tools. HTTP RPC and the SDK expose `prompt`, `cancel`, `pause`, `resume`, `snapshot`, and replayable runtime events through the `packages/contracts`/`packages/client` boundary. It requires an API key for a live LLM turn; without one, `/doctor` and local durable commands remain available and a submitted prompt emits a visible diagnostic rather than silently falling back to fixture behavior.

Until M13, fallback remains the legacy Go launcher and install path shown below. Do not delete the Go CLI/runtime/TUI until the TS7 feature parity matrix, migration proof, rollback guide, and real smoke evidence are complete and the user explicitly approves M13. The TS7 feature parity matrix and known gaps are tracked in `.kilo/plans/execution/ts07-parity-cutover.zh-CN.md`.

TS7 installer/launcher evidence is intentionally non-destructive:

```bash
npm run ts:cli -- --diagnostics
npm run ts:cli -- --once "Reply exactly: pong"
go build ./cmd/natalia
./natalia --wire
```

The TS launcher is currently opt-in via `npm run ts:cli` and `npm run ts:tui`; the Go launcher remains the fallback and default legacy install path until M13. If TS diagnostics, migration, or provider setup fails, keep using the Go commands below while preserving TS `.natalia/` state for inspection.

TS release preflight and build artifacts are intentionally non-destructive until M13:

```bash
npm run ts:release-check
npm run ts:build
```

They validate and build the TS/Bun launcher only. They do not publish, replace the default launcher, or remove the Go fallback.

The TS workspace also provides contracts-only worker transport and a redacted HTTP cassette recorder/replay utility for deterministic transport testing. Real provider recordings require an explicit credential and redaction review; no API credential is stored by default.

### Web Search Setup

`web_search` uses DuckDuckGo's public HTML endpoint by default and does not require a bundled credential. Configure a compatible internal/provider endpoint when a controlled search backend is required:

```bash
export NATALIA_WEB_SEARCH_URL="https://search.example.internal/search"
```

Natalia sends the user query as the `q` query parameter. A configured endpoint overrides the default; a failed endpoint returns an explicit HTTP diagnostic and never falls back to Go.

### Workflow Example

`workflow_run` accepts one JSON or YAML workflow document. Every workflow needs `version: 1`, a non-empty `name`, and `steps`; each step needs an `id` and one supported `kind` (`set`, `tool`, `wait`, `script`, `branch`, `retry`, `timeout`, `parallel`, or `each`).

```json
{
  "version": 1,
  "name": "write-note",
  "steps": [
    {
      "id": "write",
      "kind": "tool",
      "tool": "write_file",
      "arguments": {
        "path": "note.txt",
        "content": "hello"
      }
    }
  ]
}
```

The TUI presents successful structured tool results as concise human-readable summaries. Click a tool result only when the raw diagnostic JSON detail is needed.

`edit_file` replaces one exact `oldText` occurrence and fails with `oldText not found` when the source text is absent. This prevents silent no-op edits; use `read_file` or `grep` first when the expected source is uncertain.

### Interactive PTY Notes

`interactive_read` supports bounded incremental transcript reads: pass `offset` and `maxChars`, then continue from the returned `nextOffset`. This avoids repeatedly returning the complete terminal history to an agent context.

Natalia strips terminal control traffic such as OSC shell-integration metadata from the displayed transcript. Interactive bash commands run in their own PTY session; job control depends on the host terminal and remains unsuitable for nested job-control workflows such as `fg`/`bg` orchestration.

Non-destructive legacy workspace audit bundle commands:

```bash
npm run ts:cli -- --export-legacy ~/.config/natalia-cli --out /tmp/natalia-legacy-bundle.json
npm run ts:cli -- --import-legacy-bundle /tmp/natalia-legacy-bundle.json --target /absolute/ts-workspace
npm run ts:cli -- --rollback-legacy-bundle /absolute/ts-workspace
```

The bundle records config/session/checkpoint/skill/workflow artifacts and diagnostics for TS migration review. Import records an idempotent private TS migration receipt; rollback removes only that receipt. Neither operation deletes, rewrites, or silently replays Go state.

Natalia CLI is a local-first AI agent runtime for coding, tools, browser automation, process management, and interactive CLI workflows.

It is designed to run as a Go single-binary backend that can serve terminal clients, external frontends, and future Natalia UI processes through a Wire-style runtime protocol.

## Status

Natalia CLI is under active development. Core agent execution, tool loading, Wire JSON-RPC, mode-aware runtime profiles, browser tools, process management, interactive PTY sessions, and tool hardening are complete. The R8 hardening milestone (command policy, runtime concurrency, AppRuntime state convergence, LLM streaming compatibility, test reliability, and model feedback enhancements) is fully delivered. R9 long-term differentiation work is starting.

Use it as a fast-moving local agent runtime, not as a stable public API yet.

## Highlights

- Local-first AI agent runtime written in Go.
- Wire JSON-RPC mode for frontend/runtime separation.
- Agent Spec YAML for default tools, modes, and runtime behavior.
- Mode-aware model and permission routing.
- File tools for reading, writing, editing, grep, and glob.
- Shell execution with approval, cwd, max output, safe env handling, and dangerous command confirmation.
- Process manager foundation for long-running managed processes.
- Web search and fetch tools with Bing-first fallback search and response size protection.
- Browser automation through a real browser backend.
- Structured tool display blocks for shell, todo, diff, and future UI rendering.

## Installation

Build from source:

```bash
go build ./cmd/natalia
```

Run once with a prompt:

```bash
./natalia "Reply exactly: pong"
```

Start the interactive CLI:

```bash
./natalia
```

Run Wire JSON-RPC mode over stdin/stdout:

```bash
./natalia --wire
```

Serve Wire over HTTP/SSE/WebSocket:

```bash
./natalia --wire-http 127.0.0.1:8787 --wire-auth-token "$NATALIA_WIRE_TOKEN"
```

Production deployments should terminate TLS either directly with `--wire-tls-cert` and `--wire-tls-key`, or at a reverse proxy that forwards only trusted clients to the loopback listener. Keep `--wire-auth-token` enabled for `/rpc`, `/events`, and `/ws`; `/healthz` intentionally remains unauthenticated for local process supervision. Use `--wire-allow-methods initialize,prompt,cancel` to narrow the transport-level JSON-RPC method boundary for limited frontends.

Serve Wire over a Unix socket:

```bash
./natalia --wire-unix /tmp/natalia-wire.sock --wire-auth-token "$NATALIA_WIRE_TOKEN"
```

Unix socket startup removes stale socket files only when the path is a dead socket, and refuses to remove regular files or live sockets.

Replay a recorded Wire JSONL file:

```bash
./natalia --wire-replay /path/to/wire.jsonl
```

## Configuration

Natalia CLI uses local configuration under:

```text
~/.config/natalia-cli/
```

The runtime supports profiles, model profiles, permission profiles, and modes such as:

- `code`
- `plan`
- `debug`
- `ask`
- `chat`

Common runtime commands inside the interactive CLI include:

```text
/mode <name>
/model <profile>
/permission <just_do_it|ask|read_only>
/status
/auto [status|on|off]
/execute-plan <plan.md>
/plan [status|done|clear]
```

See `docs/commands.md` for the complete command, slash command, Wire method, and tool reference.

## Tooling

Natalia CLI ships with built-in tools for:

- Files: `read_file`, `write_file`, `edit_file`, `glob`, `grep`
- Shell: `run_shell`
- Process manager: `process_start`, `process_list`, `process_status`, `process_output`, `process_stop`, `process_restart`, `process_attach`, `process_detach`, `process_cleanup`, `process_audit`
- Background tasks: `background_start`, `background_list`, `background_output`, `background_stop`, `background_restart`, `background_cleanup`, `background_audit`
- Web: `web_fetch`, `web_search`, `read_media_file`
- Browser: `browser_visit`, `browser_screenshot`
- Todo: `todo_set`, `todo_add`, `todo_done`, `todo_update`, `todo_list`
- User interaction: `ask_user`
- Interactive PTY: `interactive_start`, `interactive_write`, `interactive_read`, `interactive_keys`, `interactive_stop`, `interactive_attach`, `interactive_detach`, `interactive_resize`, `interactive_transcript`, `interactive_cleanup`, `interactive_list`
- Agent management: `agent_spawn`, `agent_list`, `agent_output`, `agent_attach`, `agent_detach`, `agent_stop`, `agent_resume`, `agent_restart`, `agent_status`, `agent_cleanup`, `agent_audit`
- Background tasks: `background_start`, `background_list`, `background_output`, `background_stop`, `background_restart`, `background_cleanup`, `background_audit`
- Interactive PTY: `interactive_start`, `interactive_write`, `interactive_read`, `interactive_keys`, `interactive_stop`, `interactive_attach`, `interactive_detach`, `interactive_resize`, `interactive_transcript`, `interactive_cleanup`, `interactive_list`
- Agent management: `agent_spawn`, `agent_list`, `agent_output`, `agent_attach`, `agent_detach`, `agent_stop`, `agent_resume`, `agent_restart`, `agent_status`, `agent_cleanup`, `agent_audit`

The roadmap also includes interactive PTY sessions so the model can safely operate package managers, REPLs, Claude Code, llama.cpp, installers, and other interactive CLIs without blocking on prompts.

## Wire Runtime

Natalia CLI is moving toward a Wire-native architecture:

- The runtime owns engine state, tools, process sessions, browser sessions, mode/profile routing, approval, and session storage.
- Frontends communicate through structured Wire events and requests.
- Tool output can be split into model text and display blocks for richer UI rendering.

This keeps terminal UI, desktop UI, web UI, and editor integrations from duplicating agent runtime logic.

## Safety

Natalia CLI is designed around explicit runtime safety boundaries:

- Write tools and shell/process tools go through permission checks.
- Dangerous shell commands require explicit confirmation.
- Sensitive environment variable names are rejected by default.
- Large outputs are truncated before entering model context.
- Binary responses are represented as metadata instead of raw content.
- Interactive PTY sessions redact secret input from transcript, Wire recorder, and model context.
- Process and background tool output support JSON mode for structured downstream processing.

## Development

Run tests:

```bash
go test ./...
```

Run vet and tests:

```bash
go vet ./... && go test ./...
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

## Contact

- rapidsound@163.com
- mikotomisaka477@gmail.com

---

# Natalia CLI

Natalia CLI 是一个本地优先的 AI Agent 运行时，用于编码、工具调用、浏览器自动化、进程管理和交互式 CLI 工作流。

它的目标不是只做一个聊天命令行，而是作为一个 Go 单二进制运行时后端，为终端客户端、外部前端以及未来的 Natalia UI 提供统一的 Agent Runtime。前端通过 Wire 风格协议和 runtime 通信，runtime 负责模型、工具、会话、审批、进程、浏览器等核心状态。

## 当前状态

Natalia CLI 仍在快速开发中。当前核心 Agent 执行、工具加载、Wire JSON-RPC、mode-aware runtime profile、浏览器工具、进程管理、交互式 PTY 会话和工具安全加固均已完成。R8  hardening 里程碑（command policy、runtime 并发、AppRuntime 状态收敛、LLM streaming 兼容性、测试可靠性和模型反馈增强）已全部交付。R9 长期差异化能力正在启动。

现阶段更适合作为快速演进的本地 Agent Runtime 使用，还不是稳定的公开 API。

## 主要特性

- 使用 Go 编写的本地优先 AI Agent Runtime。
- 支持 Wire JSON-RPC 模式，用于前端和 runtime 解耦。
- 使用 Agent Spec YAML 描述默认工具、模式和运行行为。
- 支持按 mode 切换模型、权限和工具策略。
- 文件工具：读取、写入、编辑、grep、glob。
- Shell 执行：支持审批、cwd、输出上限、安全 env、危险命令二次确认。
- 进程管理器：为长期运行进程、后台任务、交互式终端和后续 MCP 子进程打基础。
- Web 工具：Bing 优先的搜索 fallback、网页抓取、响应大小保护。
- 浏览器自动化：通过真实浏览器访问网页和截图。
- 结构化工具展示：支持 shell、todo、diff 等 display block，方便未来 UI 渲染。

## 安装与运行

从源码构建：

```bash
go build ./cmd/natalia
```

一次性运行一个 prompt：

```bash
./natalia "Reply exactly: pong"
```

启动交互式 CLI：

```bash
./natalia
```

通过 stdin/stdout 启动 Wire JSON-RPC 模式：

```bash
./natalia --wire
```

通过 HTTP/SSE/WebSocket 提供 Wire 服务：

```bash
./natalia --wire-http 127.0.0.1:8787 --wire-auth-token "$NATALIA_WIRE_TOKEN"
```

生产部署可以用 `--wire-tls-cert` 和 `--wire-tls-key` 直接启用 TLS，也可以在反向代理终止 TLS，并只把可信客户端转发到 loopback listener。`/rpc`、`/events`、`/ws` 应保持 `--wire-auth-token` 鉴权；`/healthz` 保持无鉴权，供本地进程监管使用。受限前端可以用 `--wire-allow-methods initialize,prompt,cancel` 缩小 transport 层 JSON-RPC method 边界。

通过 Unix socket 提供 Wire HTTP 服务：

```bash
./natalia --wire-unix /tmp/natalia-wire.sock --wire-auth-token "$NATALIA_WIRE_TOKEN"
```

Unix socket 启动只会清理已经死亡的 socket 文件；普通文件和仍在监听的 live socket 都不会被删除。

重放 Wire JSONL 记录：

```bash
./natalia --wire-replay /path/to/wire.jsonl
```

## 配置

Natalia CLI 的本地配置目录是：

```text
~/.config/natalia-cli/
```

runtime 支持 profile、model profile、permission profile，以及以下常用 mode：

- `code`
- `plan`
- `debug`
- `ask`
- `chat`

交互式 CLI 中常用命令包括：

```text
/mode <name>
/model <profile>
/permission <just_do_it|ask|read_only>
/status
/auto [status|on|off]
/execute-plan <plan.md>
/plan [status|done|clear]
```

## 工具能力

Natalia CLI 内置工具包括：

- 文件：`read_file`、`write_file`、`edit_file`、`glob`、`grep`
- Shell：`run_shell`
- 进程管理：`process_start`、`process_list`、`process_status`、`process_output`、`process_stop`、`process_restart`、`process_attach`、`process_detach`、`process_cleanup`、`process_audit`
- 后台任务：`background_start`、`background_list`、`background_output`、`background_stop`、`background_restart`、`background_cleanup`、`background_audit`
- Web：`web_fetch`、`web_search`、`read_media_file`
- Browser：`browser_visit`、`browser_screenshot`
- Todo：`todo_set`、`todo_add`、`todo_done`、`todo_update`、`todo_list`
- 用户交互：`ask_user`
- 交互式 PTY：`interactive_start`、`interactive_write`、`interactive_read`、`interactive_keys`、`interactive_stop`、`interactive_attach`、`interactive_detach`、`interactive_resize`、`interactive_transcript`、`interactive_cleanup`、`interactive_list`
- Agent 管理：`agent_spawn`、`agent_list`、`agent_output`、`agent_attach`、`agent_detach`、`agent_stop`、`agent_resume`、`agent_restart`、`agent_status`、`agent_cleanup`、`agent_audit`

路线图中还包含交互式 PTY session，让模型能够安全操作包管理器、REPL、Claude Code、llama.cpp、安装器和其他需要多轮输入的 CLI，避免普通 shell 命令卡在 prompt 上。

## Wire Runtime

Natalia CLI 正在向 Wire-native 架构演进：

- runtime 负责 engine 状态、工具、进程 session、浏览器 session、mode/profile 路由、审批和会话存储。
- 前端通过结构化 Wire event/request 与 runtime 通信。
- 工具输出可以拆成给模型看的 `ModelText` 和给 UI 渲染的 display block。

这样终端 UI、桌面 UI、Web UI、编辑器插件不需要重复实现 Agent Runtime 逻辑。

## 安全设计

Natalia CLI 会尽量把模型能力放进明确的安全边界里：

- 写文件、shell、process 工具走权限检查。
- 危险 shell 命令需要用户二次确认。
- 默认拒绝敏感环境变量名。
- 大输出进入模型上下文前会截断。
- 二进制响应只返回 metadata，不直接塞原始内容。
- 交互式 PTY session 会对 secret 输入做 redaction，不进入 transcript、Wire recorder 或模型上下文。
- Process 和 background 工具输出支持 JSON 模式，方便下游结构化处理。

## 开发

运行测试：

```bash
go test ./...
```

运行 vet 和测试：

```bash
go vet ./... && go test ./...
```

运行 race baseline（核心 runtime 包）：

```bash
go test -race ./internal/wire ./internal/soul ./internal/worker ./internal/processmgr ./internal/interactivemgr ./cmd/natalia
```

## 许可

本项目使用 Apache License 2.0，详见 [LICENSE](LICENSE)。

## 联系方式

- rapidsound@163.com
- mikotomisaka477@gmail.com
