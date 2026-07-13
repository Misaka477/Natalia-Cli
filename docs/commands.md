# Natalia CLI Commands

This document is a practical command reference for Natalia CLI. It covers process startup flags, interactive slash commands, Wire JSON-RPC methods, and model-callable tools.

## Binary Usage

```bash
./bin/natalia [flags] [prompt]
```

Common forms:

```bash
./bin/natalia
./bin/natalia "Reply exactly: pong"
./bin/natalia --profile step-ai
./bin/natalia --wire
./bin/natalia --wire-http 127.0.0.1:8787 --wire-auth-token "$NATALIA_WIRE_TOKEN"
./bin/natalia --wire-unix /tmp/natalia-wire.sock --wire-auth-token "$NATALIA_WIRE_TOKEN"
./bin/natalia --wire-replay ~/.config/natalia-cli/sessions/<id>/wire.jsonl
```

## Startup Flags

| Flag | Value | Description |
| --- | --- | --- |
| `--no-setup` | bool | Skip interactive setup prompt when no model is configured. |
| `--debug` | bool | Print debug logs. |
| `--profile` | name | Use a named config profile at startup. |
| `--wire` | bool | Run Wire JSON-RPC over stdin/stdout. |
| `--wire-http` | address | Serve Wire over HTTP RPC, SSE events, and WebSocket. Example: `127.0.0.1:8787`. |
| `--wire-unix` | path | Serve Wire HTTP over a Unix socket. |
| `--wire-auth-token` | token | Bearer token for Wire HTTP/SSE/WebSocket/Unix transports. |
| `--wire-allow-methods` | list | Comma-separated JSON-RPC method allowlist. Empty means all built-in methods. |
| `--wire-tls-cert` | file | TLS certificate for Wire HTTP. Must be paired with `--wire-tls-key`. |
| `--wire-tls-key` | file | TLS private key for Wire HTTP. Must be paired with `--wire-tls-cert`. |
| `--wire-replay` | file | Replay a `wire.jsonl` recording to stdout. |

If any positional text remains after flags, Natalia runs one prompt and exits:

```bash
./bin/natalia "summarize this repo"
```

## Interactive Slash Commands

Slash commands are entered inside the interactive CLI prompt.

### Help And Configuration

| Command | Description |
| --- | --- |
| `/help` | Show built-in help. |
| `/setup` | Configure providers, profiles, and model settings. |
| `/profile` | Pick and switch the active config profile interactively. |
| `/config` | Print active config with secrets masked. |
| `/quit` | Exit the CLI. |
| `/exit` | Exit the CLI. |

### Runtime Profile

| Command | Description |
| --- | --- |
| `/status` | Print current profile, mode, model, permission, context usage, tool policy, and diagnostics. |
| `/mode` | Show current mode and common built-in modes. |
| `/mode <name>` | Switch mode. Built-ins include `code`, `ask`, `plan`, `debug`, `chat`. |
| `/model` | List configured model profiles. |
| `/model <profile>` | Switch model profile for subsequent turns. |
| `/permission` | List permission profiles. |
| `/permission <just_do_it|ask|read_only>` | Switch permission policy for subsequent turns. |
| `/auto` | Show auto-flow state. |
| `/auto status` | Show auto-flow state. |
| `/auto on` | Enable automatic failure escalation/recovery flow. |
| `/auto off` | Disable automatic failure escalation/recovery flow. |

### Plan Workflow

| Command | Description |
| --- | --- |
| `/execute-plan <plan.md|slug>` | Load a plan by file path or slug and switch back to `code` mode. |
| `/plan` | Show plan command usage/current state. |
| `/plan status` | Show current plan status. |
| `/plan show` | Print current plan content/status. |
| `/plan done` | Mark the next/current plan step done. |
| `/plan confirm` | Confirm completion of the current plan step. |
| `/plan clear` | Clear active plan state. |

### Session And Context

| Command | Description |
| --- | --- |
| `/sessions` | List historical sessions. |
| `/sessions restore <id|index>` | Restore a historical session by full session ID or list index. Example: `/sessions restore 2`. |
| `/compact` | Manually compact context using the configured LLM. |
| `/checkpoint` | Create a snapshot checkpoint for rollback. |
| `/rollback <step>` | Roll back to a prior snapshot step. |

Note: restoring a session restores model context and persisted runtime state. It does not reopen an old terminal window. Typos such as `/seesions` are not accepted.

### Workers And Subagents

| Command | Description |
| --- | --- |
| `/workers` | List child agents. |
| `/stop` | Cancel the current running turn. |
| `/stop <id>` | Pause/stop a child agent. |
| `/go <id>` | Resume a paused child agent. |
| `/attach <id>` | Attach child-agent events to the current view. |
| `/detach <id>` | Detach child-agent events from the current view while it continues running. |

### Sandbox

| Command | Description |
| --- | --- |
| `/sandbox` | List sandboxes. |
| `/sandbox create <user|agent> <name>` | Create a sandbox overlay. |
| `/sandbox diff <name>` | Show sandbox diff. |
| `/sandbox merge <name>` | Merge sandbox changes into the workspace. |
| `/sandbox delete <name>` | Delete a sandbox. |

### Workflows

| Command | Description |
| --- | --- |
| `/workflow list` | List discovered workflows. |
| `/workflow run <name> [key=value...]` | Run a workflow with optional variables. |
| `/workflow diagnostics` | Show workflow loading diagnostics. |

## Wire JSON-RPC Methods

Wire mode is used by external clients and future UIs.

### Starting Wire

```bash
./bin/natalia --wire
./bin/natalia --wire-http 127.0.0.1:8787 --wire-auth-token "$NATALIA_WIRE_TOKEN"
./bin/natalia --wire-unix /tmp/natalia-wire.sock --wire-auth-token "$NATALIA_WIRE_TOKEN"
```

HTTP transport exposes:

| Endpoint | Description |
| --- | --- |
| `/rpc` | JSON-RPC request endpoint. |
| `/events` | SSE event stream. |
| `/ws` | WebSocket Wire stream. |
| `/healthz` | Health check. |

### Methods

| Method | Params | Description |
| --- | --- | --- |
| `initialize` | object | Initialize client/server handshake. |
| `prompt` | `{ "user_input": "..." }` | Run a user prompt through the agent. |
| `steer` | `{ "user_input": "..." }` | Send steering input to the active engine. |
| `cancel` | `{}` | Cancel the active turn. |
| `set_plan_mode` | `{ "enabled": true/false }` | Enable or disable plan mode. |
| `set_runtime_profile` | `{ "mode": "code", "model_profile": "...", "permission_profile": "ask" }` | Switch runtime profile. |
| `restore_session` | `{ "session_id": "..." }` | Restore a persisted session. |
| `list_sessions` | `{}` | List persisted sessions. |

### Wire Replay

```bash
./bin/natalia --wire-replay ~/.config/natalia-cli/sessions/<session-id>/wire.jsonl
```

## Model-Callable Tools

These are not typed manually as slash commands. The model calls them through the tool system. Permission policy may require approval for write/process/PTY tools.

### File Tools

| Tool | Purpose |
| --- | --- |
| `read_file` | Read text files with optional offset/limit. |
| `write_file` | Write/create files, with approval and diff display. |
| `edit_file` | Replace exact text in a file, with approval and diff display. |
| `grep` | Search file contents. Supports include/type/multiline/hidden/ignored options. |
| `glob` | Find files by glob patterns. |

### Shell

| Tool | Purpose |
| --- | --- |
| `run_shell` | Run a shell command with cwd/env/timeout controls and approval. Dangerous commands require explicit confirmation. |

### Process Manager

| Tool | Purpose |
| --- | --- |
| `process_start` | Start a managed process. |
| `process_list` | List managed processes. |
| `process_status` | Show process status. |
| `process_output` | Read retained process output. |
| `process_stop` | Stop a process. |
| `process_restart` | Restart a process with original options. |
| `process_attach` | Reattach process events. |
| `process_detach` | Detach process events while process continues. |
| `process_cleanup` | Sweep completed/stale/idle processes. |
| `process_audit` | Show process audit log with redacted env summaries. |

### Background Tasks

| Tool | Purpose |
| --- | --- |
| `background_start` | Start a long-running background task such as a dev server or watcher. |
| `background_list` | List background tasks. |
| `background_output` | Read background output by tail or page. |
| `background_restart` | Restart a background task. |
| `background_stop` | Stop a background task. |
| `background_cleanup` | Sweep completed/stale/idle background tasks. |
| `background_audit` | Show background task audit log. |

### Interactive PTY

| Tool | Purpose |
| --- | --- |
| `interactive_start` | Start an interactive PTY session, such as bash, Python, Node, installers, or REPLs. |
| `interactive_read` | Observe a PTY session until prompt/idle/timeout. |
| `interactive_write` | Write input to a PTY session. Single-line input submits by default; `submit=false` preserves partial input. |
| `interactive_keys` | Send special keys such as `enter`, `ctrl-c`, `ctrl-d`, `tab`, `esc`. |
| `interactive_stop` | Stop a PTY session. |
| `interactive_attach` | Reattach PTY events. |
| `interactive_detach` | Detach PTY events while process continues. |
| `interactive_resize` | Resize PTY rows/cols. |
| `interactive_transcript` | Read transcript by offset/limit. |
| `interactive_list` | List PTY sessions. |

Known current blocker: Python REPL still shows per-character redraw residue in some real smoke tests. This is tracked in the roadmap and should be fixed before treating PTY as production-grade for all REPLs.

### Web, Browser, And Media

| Tool | Purpose |
| --- | --- |
| `web_search` | Search the web through configured provider priority/fallback. |
| `web_fetch` | Fetch URL content with network policy and HTML/text/markdown extraction. |
| `browser_visit` | Visit/render a page through browser backend. |
| `browser_screenshot` | Capture a screenshot through browser backend. |
| `read_media_file` | Read media metadata. Legacy name. |
| `file_info` | Read file/media metadata, including image metadata where supported. |

### Subagents

| Tool | Purpose |
| --- | --- |
| `agent_spawn` | Spawn a child agent for an independent task. Supports `mode`, `foreground`, `timeout_sec`, `model_profile`, `allowed_tools`, `exclude_tools`. |
| `agent_list` | List child agents. |
| `agent_output` | Show child-agent output log. |
| `agent_attach` | Attach child-agent events. |
| `agent_detach` | Detach child-agent events. |
| `agent_stop` | Stop child agent. |
| `agent_resume` | Resume child agent. |

### Plan Mode Tools

| Tool | Purpose |
| --- | --- |
| `plan_mode_enter` | Enter plan mode. |
| `plan_mode_exit` | Exit plan mode. |
| `plan_mode_status` | Read plan mode status. |

### Workflow Tools

| Tool | Purpose |
| --- | --- |
| `workflow_run` | Run a named workflow. |
| `workflow_list` | List workflows. |
| `workflow_read` | Read workflow details. |

### Skill Tools

| Tool | Purpose |
| --- | --- |
| `skill_list` | List discovered skills/instructions. |
| `skill_read` | Read a skill/instruction. |

### Todo Tools

| Tool | Purpose |
| --- | --- |
| `todo_set` | Replace the current todo list. |
| `todo_add` | Add todo items. |
| `todo_done` | Mark a todo item done by 1-based index. |
| `todo_list` | List current todos. |

### User Interaction

| Tool | Purpose |
| --- | --- |
| `ask_user` | Ask the user structured questions through Wire/terminal UI. |

### MCP Tools

MCP tools are registered dynamically from configured MCP servers. Their names and schemas come from the MCP server, not from a fixed built-in list.

## Common Recipes

### Restore The Second Listed Session

```text
/sessions
/sessions restore 2
```

### Switch To Debug Mode

```text
/mode debug
/status
```

### Switch To A Different Model Profile

```text
/model
/model strong
```

### Temporarily Make The Agent Read-Only

```text
/permission read_only
```

### Load A Roadmap Plan

```text
/execute-plan natalia-cli-roadmap
/plan status
/plan show
```

### Start Wire HTTP For A Frontend

```bash
export NATALIA_WIRE_TOKEN="change-me"
./bin/natalia --wire-http 127.0.0.1:8787 --wire-auth-token "$NATALIA_WIRE_TOKEN"
```

### Replay A Wire Recording

```bash
./bin/natalia --wire-replay ~/.config/natalia-cli/sessions/<session-id>/wire.jsonl
```

## Safety Notes

- Write, shell, process, background, PTY, and agent-control tools can require approval depending on permission profile.
- `read_only` rejects mutating tools.
- `ask` asks before mutating tools.
- `just_do_it` auto-approves normal writes, but dangerous shell policies may still block or require explicit confirmation.
- Sensitive environment variables and known credential paths are filtered/redacted by default.
- Network policy blocks localhost/private/link-local/cloud metadata by default unless explicitly allowlisted.
