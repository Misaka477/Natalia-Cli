# Natalia CLI Commands

Natalia is a TypeScript/Bun runtime. Configuration is read from `.natalia/config.json` and provider credentials may be supplied through environment variables.

## Start

```bash
npm run ts:tui
npm run ts:cli -- run "List the repository files"
npm run ts:cli -- run --json "List the repository files"
printf '%s\n' '{"prompt":"List the repository files"}' | npm run ts:cli -- eval
```

## Runtime Services

```bash
npm run ts:cli -- serve 8787
npm run ts:cli -- daemon 8787
npm run ts:cli -- daemon-status
npm run ts:cli -- daemon-stop
```

`serve` exposes the native HTTP/RPC/SSE transport. Set `NATALIA_TRANSPORT_TOKEN` to require bearer authentication. Unix socket and TLS server options are provided by `@natalia/transport` for embedded or managed deployments.

## Session Commands

```bash
npm run ts:cli -- session list
npm run ts:cli -- session show <id>
npm run ts:cli -- session rename <id> "Title"
npm run ts:cli -- session pin <id>
npm run ts:cli -- session duplicate <id>
```

## TUI Controls

- `Ctrl+N`: new session
- `Ctrl+L`: session history
- `Ctrl+,`: settings
- `Ctrl+P`: command palette
- `Ctrl+C`: cancel active turn
- `Ctrl+Shift+K`: checkpoint dialog
- `Ctrl+Shift+T`: PTY dialog
- `Ctrl+Shift+B`: sandbox dialog

Runtime slash commands include `/doctor`, `/help`, `/status`, `/skills`, `/checkpoint`, `/checkpoints`, `/rollback <id> --dry-run`, `/pause`, and `/resume`.

## Tool Safety

All tool calls pass runtime policy, schema validation, approval, and audit boundaries. Write, process, shell, browser screenshot, sandbox merge, and mutation-capable MCP operations require the configured permission behavior. Do not place credentials in prompts, repository files, diagnostic fixtures, or screenshots.
