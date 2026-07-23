# Natalia CLI

Natalia is a local-first TypeScript/Bun coding agent runtime. The repository is TS-only: CLI, OpenTUI shell, runtime, tools, session persistence, transport, SDK, MCP, skills, plugins, PTY, sandbox, and checkpoint management share typed contracts.

## Run

Configure a provider through environment variables or `.natalia/config.json`:

```bash
export NATALIA_OPENAI_API_KEY="..."
export NATALIA_MODEL="gpt-4o-mini"
npm run ts:tui
```

Supported provider adapters include OpenAI-compatible, Anthropic, and Gemini. API keys remain in process memory and must not be written to repository files, session events, diagnostics, or screenshots.

Useful TUI controls include `/doctor`, `/help`, `/status`, `/skills`, `/checkpoint`, `/checkpoints`, `/rollback <id> --dry-run`, `/pause`, and `/resume`.

## CLI And Transport

```bash
npm run ts:cli -- run "Reply exactly: pong"
npm run ts:cli -- run --json "Reply exactly: pong"
printf '%s\n' '{"prompt":"Reply exactly: pong"}' | npm run ts:cli -- eval
NATALIA_TRANSPORT_TOKEN="local-token" npm run ts:cli -- serve 8787
npm run ts:cli -- daemon 8787
npm run ts:cli -- daemon-status
npm run ts:cli -- daemon-stop
```

The native transport supports authenticated HTTP/RPC/SSE, Unix sockets, and TLS. The daemon and TUI are TypeScript/Bun processes.

## Sessions And Long Tasks

Sessions persist under `.natalia/sessions/`; SQLite persistence is available for runtime stores. Context checkpoints, tool results, approvals, questions, checkpoints, and workspace state support a user returning to the same session and saying “continue the previous task”.

If a process crashes during an active provider or tool operation, Natalia safely settles the unknown operation rather than replaying an unknown side effect. A future autonomous continuation plan is tracked in `.kilo/plans/natalia-durable-active-turn-continuation.zh-CN.md`.

## Settings

Runtime configuration is typed ConfigV2 and is written as scoped minimal overlays:

```text
.natalia/config.json
```

The TUI Settings Center supports provider/model, runtime, context, checkpoint, browser/network, MCP, skills/plugins, workspace, agent modes, and permission profiles. A new runtime/session applies external provider/MCP/plugin connection changes.

## Development

```bash
npm run format
npm run typecheck
npm run test
npm run guard:imports
npm run ts:build
npm run ts:release-check
```

The relevant TUI smoke tests are available through `npm --workspace @natalia/tui run smoke:<name>`.
