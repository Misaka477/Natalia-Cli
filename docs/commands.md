# Natalia CLI Command Reference

Natalia CLI runs on Bun. The examples below use the workspace entrypoint:

```bash
npm run ts:cli -- <command>
```

Installed release builds can replace that prefix with `natalia-ts`.

Runtime configuration defaults to `.natalia/config.json`. Override it with `NATALIA_CONFIG`. Commands that accept `--workspace` otherwise use the current working directory.

## Run And Evaluate

```bash
npm run ts:cli -- run "List the repository files"
npm run ts:cli -- run --json "List the repository files"
npm run ts:cli -- run "Review this file" --attach src/index.ts
printf '%s\n' '{"prompt":"List the repository files"}' | npm run ts:cli -- eval
```

- `run <prompt>` executes one model turn.
- `run --json <prompt>` streams runtime events as JSON Lines.
- `run ... --attach <path>` adds workspace attachments and may be repeated.
- `eval` accepts JSON Lines on stdin. Requests may contain `prompt`, `delivery`, `attachments`, `cancel`, `pause`, or `resume`.

## Status And Diagnostics

```bash
npm run ts:cli -- status
npm run ts:cli -- doctor
npm run ts:cli -- doctor --json
npm run ts:cli -- doctor --workspace /path/to/project
npm run ts:cli -- diagnose
```

- `status` prints the current provider/model and runtime status.
- `doctor` checks configuration, model selection, migration state, and sessions.
- `diagnose` prints startup diagnostics as JSON.

## Runtime Services

```bash
NATALIA_TRANSPORT_TOKEN="local-token" npm run ts:cli -- serve 8787
npm run ts:cli -- daemon 8787
npm run ts:cli -- daemon-status
npm run ts:cli -- daemon-stop
```

- `serve [port]` runs the HTTP/RPC/SSE/WebSocket transport in the foreground.
- `daemon [port]` registers a local authenticated daemon and waits for signals.
- `daemon-status` inspects the registered daemon.
- `daemon-stop` stops the registered daemon.
- `--daemon-dir <path>` overrides daemon state storage.

## Sessions

```bash
npm run ts:cli -- session list
npm run ts:cli -- session list --json
npm run ts:cli -- session show <id>
npm run ts:cli -- session rename <id> "New title"
npm run ts:cli -- session pin <id>
npm run ts:cli -- session unpin <id>
npm run ts:cli -- session duplicate <id> --title "Copy" --id <new-id>
npm run ts:cli -- session export <id>
npm run ts:cli -- session import '<metadata-json>' --id <new-id>
npm run ts:cli -- session delete <id>
```

All session actions accept `--workspace <path>`.

## Workspace Filesystem

```bash
npm run ts:cli -- fs list --path src --limit 100
npm run ts:cli -- fs read src/index.ts --offset 1 --limit 200
npm run ts:cli -- fs glob 'src/**/*.ts' --limit 100
npm run ts:cli -- fs search 'createRuntime' --include '*.ts' --limit 100
```

The `fs` commands stay within the selected workspace and return JSON.

## Transport Recording

```bash
npm run ts:cli -- record /tmp/natalia-cassette.json 8787
npm run ts:cli -- replay /tmp/natalia-cassette.json
```

- `record <cassette> [port]` runs a transport server with recorded fetch traffic.
- `replay <cassette>` replays recorded interactions for diagnostics and tests.

## TUI

```bash
npm run ts:tui
```

TUI controls and slash commands are documented in the main [README](../README.md#tui-controls). The canonical slash-command vocabulary is defined by `runtimeSlashCommands` in `packages/contracts/src/events.ts` and shared by runtime handling and TUI completion.

## Current Help Behavior

The current CLI does not yet implement a generated `--help` command. Until that is added, this file is the canonical command-line reference. Unknown commands currently fall back to the plain status output.
