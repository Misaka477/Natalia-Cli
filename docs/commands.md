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

## Plugins

```bash
npm run ts:cli -- plugin create ./my-plugin --id yourco.demo
npm run ts:cli -- plugin create ./my-plugin --id yourco.demo --package @yourco/demo
npm run ts:cli -- plugin list
npm run ts:cli -- plugin install <spec>
npm run ts:cli -- plugin uninstall <id>
npm run ts:cli -- plugin enable <id>
npm run ts:cli -- plugin disable <id>
npm run ts:cli -- plugin doctor
npm run ts:cli -- plugin reconcile
```

`plugin create` writes a publishable JavaScript starter package and refuses to
overwrite an existing directory. It requires exactly one directory and
`--id <plugin-id>`; `--package <npm-name>` is optional and defaults to the
directory basename. The directory is resolved from the current process working
directory. Although the shared parser accepts `--workspace`, that option does
not relocate or otherwise affect scaffold output.

`plugin list` reports runtime defaults and user-installed plugins through one
catalogue. Install, uninstall, enable, and disable each perform the complete
lifecycle operation in one command. `doctor` audits the installed state and
`reconcile` repairs the desired package closure. All plugins use the same
registry, permissions, naming, and cleanup path.
Natalia has exactly one plugin installation store. `install`, `uninstall`,
`doctor`, `reconcile`, and `reinstall` always operate on that store and have no
installation scope. `--workspace <path>` only selects the project configuration
used by `enable`, `disable`, and the enablement state shown by `list`.

`install <spec>` accepts npm registry specs, local directories, Git specs, and
local or remote tarballs. It installs the package into the Natalia instance's
single `plugin-store` and updates that store's `natalia.lock`. No package is
installed beneath a workspace. The durable enable/disable state is read when a runtime starts or
reconciles configuration; these commands do not mutate another process's live
registry. See the [plugin guide](plugin-guide.md) for API contracts, output
shapes, diagnostics, built-in plugin IDs, and the complete authoring tutorial.

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

TUI controls and slash commands are documented in the main [README](../README.md#tui-controls). The slash-command vocabulary is derived from the runtime command catalog, which is populated by plugin command contributions at runtime.

## UI

```bash
npm run ts:cli -- ui
npm run ts:cli -- ui <kind>
```

- `ui` lists the UI adapter kinds contributed by enabled installed and path plugins.
- `ui <kind>` mounts that UI adapter in-process against a real runtime and waits for `SIGINT`/`SIGTERM`, then closes the adapter, the plugin registry, and the runtime.

The TUI is one such UI (`ui.tui`). Every UI — the TUI or a freshly installed package — is launched through the same generic UI host (`createUiAdapterHost` in `@natalia/client`); see the [plugin guide](plugin-guide.md#6-ui-adapters).

## Current Help Behavior

The current CLI does not yet implement a generated `--help` command. Until that is added, this file is the canonical command-line reference. Running the CLI without a command prints plain status; unknown commands fail explicitly.
