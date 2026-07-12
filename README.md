# Natalia CLI

Natalia CLI is a local-first AI agent runtime for coding, tools, browser automation, process management, and interactive CLI workflows.

It is designed to run as a Go single-binary backend that can serve terminal clients, external frontends, and future Natalia UI processes through a Wire-style runtime protocol.

## Status

Natalia CLI is under active development. Core agent execution, tool loading, Wire JSON-RPC, mode-aware runtime profiles, browser tools, process management, and tool hardening are already in progress, but some roadmap items are intentionally still experimental.

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

## Tooling

Natalia CLI ships with built-in tools for:

- Files: `read_file`, `write_file`, `edit_file`, `glob`, `grep`
- Shell: `run_shell`
- Process manager: `process_start`, `process_list`, `process_status`, `process_output`, `process_stop`
- Web: `web_fetch`, `web_search`, `read_media_file`
- Browser: `browser_visit`, `browser_screenshot`
- Todo: `todo_set`, `todo_add`, `todo_done`, `todo_list`
- User interaction: `ask_user`

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
- Future PTY sessions will redact secret input from transcript, Wire recorder, and model context.

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

Natalia CLI 仍在快速开发中。当前已经有核心 Agent 执行、工具加载、Wire JSON-RPC、mode-aware runtime profile、浏览器工具、进程管理和工具安全加固等能力，但部分路线仍处于实验阶段。

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
- 进程管理：`process_start`、`process_list`、`process_status`、`process_output`、`process_stop`
- Web：`web_fetch`、`web_search`、`read_media_file`
- Browser：`browser_visit`、`browser_screenshot`
- Todo：`todo_set`、`todo_add`、`todo_done`、`todo_list`
- 用户交互：`ask_user`

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
- 未来 PTY session 会对 secret 输入做 redaction，不进入 transcript、Wire recorder 或模型上下文。

## 开发

运行测试：

```bash
go test ./...
```

运行 vet 和测试：

```bash
go vet ./... && go test ./...
```

## 许可

本项目使用 Apache License 2.0，详见 [LICENSE](LICENSE)。

## 联系方式

- rapidsound@163.com
- mikotomisaka477@gmail.com
