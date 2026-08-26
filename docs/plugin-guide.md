# Natalia Plugin Guide - v2

> `PLUGIN_API_VERSION` is `2`. A plugin is one package containing its package
> metadata, `natalia.plugin.json`, entry module, and implementation. The plugin
> API is an in-process host extension surface, not an RPC surface.

## 1. One plugin system

Natalia has one plugin type. Runtime defaults and packages installed by users
use the same registry, declared names, permissions, dependency resolution, and
load/unload lifecycle. A runtime default is only distribution configuration; it
does not receive a privileged API or a separate lifecycle.

Plugins do not wrap Natalia's own framework. Agent turn/step execution,
providers and model selection, sessions and configuration, transport/SDK/daemon,
CLI/TUI hosts, permissions and approval, sandbox, checkpoint, engineering
intelligence, workspace, runtime status, and diagnostics are constructed and
owned directly by the runtime or host. They have no plugin manifest, unloadable
plugin ID, `plugins.enabled` gate, or plugin-catalog entry. A package is a plugin
only when removing it leaves the runtime's core semantics complete. Independent
model tools and UI adapters can therefore be plugins, but they do not own the
corresponding framework controller lifecycle.

Plugins are trusted code. They are imported into the runtime process without a
VM, filesystem sandbox, network sandbox, or execution timeout. Manifest
`integrationPoints` govern contribution ownership and validation, not process
isolation. Install only packages you wrote or audited.

The v2 integration points are `tools`, `commands`, `events`, `services`,
`resources`, `projections`, `workflows`, `settingsSchema`, `adapters`, and
`schedulerJobs`. Declaring an integration point authorizes its API. Tools and
commands keep the names they declare; Natalia does not add a plugin prefix.
Tool approval follows each tool's `requiresApproval` declaration and the normal
runtime policy path. There is no plugin-class-based forced approval.

## 2. Package layout

A publishable plugin package has this shape:

```text
my-natalia-plugin/
  package.json
  natalia.plugin.json
  src/index.js
```

Create this package with the CLI. The installed release command is currently
`natalia-ts`; repository examples use `npm run ts:cli --`:

```bash
natalia-ts plugin create ./my-natalia-plugin \
  --id yourco.demo \
  --package @yourco/natalia-demo
```

`--package` is optional and defaults to the directory basename. The directory
is resolved from the process working directory; `--workspace` does not relocate
scaffold output. Creation fails if the target directory already exists. The
generated package uses plain ESM JavaScript so the installed entry does not
depend on Bun or a TypeScript source loader.

The package declares every Natalia package it imports as a dependency:

```json
{
  "name": "@yourco/natalia-demo",
  "version": "1.0.0",
  "type": "module",
  "files": ["src", "natalia.plugin.json"],
  "exports": { ".": "./src/index.js" },
  "dependencies": {
    "@natalia/plugin": "<compatible-version>"
  }
}
```

Use versions compatible with the Natalia distribution you target. The package
manager installs the complete package closure once in the Natalia instance's
`plugin-store`; every workspace uses that same installation. Do not ask users
to create SDK symlinks or copy an entry file separately.
Add `@natalia/contracts`, `@natalia/tools`, or another Natalia package only when
the implementation imports it. `@natalia/sdk` is the RPC client SDK and is not
the plugin authoring API.

## 3. Manifest v2

```json
{
  "apiVersion": 2,
  "id": "yourco.demo",
  "version": "1.0.0",
  "name": "Demo",
  "description": "A demonstration plugin.",
  "entry": "src/index.js",
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

- `id` matches `[a-z0-9][a-z0-9._-]*` and is the registry owner id.
- `version` is a semantic version and must match `package.json`; `entry` is a
  local `.js`, `.mjs`, or `.ts` file contained by the published package. Use a
  JavaScript entry for packages intended to run outside the Natalia source
  workspace.
- `scope` is `process`, `workspace`, or `session`. It is lifecycle attribution,
  not a security boundary.
- `provides`, `requires`, and `optionalRequires` describe service contracts.
- `conflicts` and `dependencies` participate in deterministic dependency
  resolution. A dependency can set `optional` or `peer`.
- `hooks` is reserved and must currently be `{}`. Natalia installs and removes
  packages with npm lifecycle scripts disabled, and does not execute plugin
  hook commands implicitly.
- `integrationPoints` must include every contribution API used by `setup`.

Manifest validation, dependency checks, and configuration validation complete
before activation. If `setup` fails, registrations made during that activation
are rolled back and the plugin is audited as `failed`.

## 4. Implement a plugin

```js
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.demo",
    version: "1.0.0",
    name: "Demo",
    description: "A demonstration plugin.",
    entry: "src/index.js",
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

`echo` and `demo.hello` are the registered names. Duplicate names are rejected;
choose globally meaningful names. Every registration returns a disposer, and
registry unload also disposes all owned contributions. `setup` and plugin
`dispose` may be asynchronous.

Plugins can declare a Standard Schema `configSchema`. The validated value is
available as `api.config`, sourced from `plugins.settings[pluginID]`. Invalid
configuration prevents activation rather than creating a partial plugin.

### Plugin API reference

Every contribution method checks the corresponding `integrationPoints` entry.
Using an undeclared API fails activation with `plugin capability denied`.
Registration methods return an idempotent disposer and the registry also calls
all remaining disposers in reverse registration order during unload.

| Manifest point   | API                                                    | Contract                                                                                                          |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `tools`          | `api.tools.register(tool)`                             | Registers a globally named `RuntimeTool`; duplicate names fail.                                                   |
| `tools`          | `api.tools.registerAlias(alias, target)`               | Registers a tool alias and returns its disposer.                                                                  |
| `commands`       | `api.commands.register(command)`                       | Registers a globally named command; duplicate names fail.                                                         |
| `events`         | `api.events.on(listener)`                              | Receives every event dispatched through the plugin registry.                                                      |
| `events`         | `api.events.on(type, listener)`                        | Receives events whose object `type` equals the supplied string.                                                   |
| `services`       | `api.services.provide(name, value)`                    | Provides a service listed in manifest `provides`; every declared service must be provided before setup completes. |
| none             | `api.services.get<T>(name)`                            | Reads a currently available host service.                                                                         |
| none             | `api.services.on<T>(name, listener)`                   | Watches a service provider change; the listener is called on changes, not immediately at registration.            |
| `resources`      | `api.resources.register({ name, ... })`                | Registers a host-defined named resource contribution.                                                             |
| `projections`    | `api.projections.register({ name, ... })`              | Registers a host-defined named projection contribution.                                                           |
| `workflows`      | `api.workflows.register({ name, ... })`                | Registers a host-defined named workflow contribution.                                                             |
| `settingsSchema` | `api.settingsSchema.register({ name, ... })`           | Registers a host-defined named settings-schema contribution.                                                      |
| `adapters`       | `api.adapters.register({ name, adapterType, create })` | Registers a lazy adapter factory whose instance has `dispose()`.                                                  |
| `adapters`       | `api.adapters.registerUi({ kind, mount, dispose })`    | Convenience API for a UI adapter; the contribution name is `kind`.                                                |
| `schedulerJobs`  | `api.scheduler.add({ name, ... })`                     | Registers a host-defined named scheduler job.                                                                     |

`resources`, `projections`, `workflows`, `settingsSchema`, and scheduler jobs
share only the stable `{ name: string }` ownership contract. Their additional
payload is defined by the host that consumes that contribution; do not assume a
universal payload shape that is not exported by that host.

The APIs below do not require an `integrationPoints` declaration:

- `api.config` is the synchronously validated value from
  `plugins.settings[pluginID]`, or the raw value when no `configSchema` exists.
- `api.runtimeConfig?.()` returns the current host runtime configuration when
  that host exposes it. Treat it as optional and prefer plugin-specific config.
- `api.effects.signal` is aborted when the plugin unloads.
- `api.effects.run(effect)` tracks asynchronous work. Unload aborts its signal
  and waits for all tracked promises to settle. Pass the signal through to I/O.

`RuntimeTool` requires `name`, `description`, `requiresApproval`, an object JSON
schema in `parameters`, and an async `execute(input, context)` returning a
string. `context` includes `workspaceRoot`, optional `sessionID` and
`AbortSignal`, plus host services appropriate to the current runtime. A command
requires `name`, `title`, and `run(invocation?)`; invocation contains `raw`,
`args`, `workspaceRoot`, optional `sessionID`, and optional `signal`.

### Configuration

Zod schemas implement Standard Schema and can be used directly. Validation must
be synchronous:

```js
import { z } from "zod";
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest,
  configSchema: z.object({
    endpoint: z.string().url(),
    retries: z.number().int().min(0).default(3),
  }),
  setup(api) {
    const config = api.config;
    // config is the parsed { endpoint, retries } value.
  },
});
```

Add `zod` to the plugin package dependencies when using it. Configure the
plugin in `<workspace>/.natalia/config.json`:

```json
{
  "version": 3,
  "plugins": {
    "settings": {
      "yourco.demo": {
        "endpoint": "https://example.test",
        "retries": 5
      }
    }
  }
}
```

An invalid value fails before `setup` and reports the failing property path.
Async Standard Schema validation is deliberately rejected.

### Services and plugin dependencies

`requires` contains mandatory service names. A plugin remains `pending` until
all are available; if a required provider disappears or changes, the registry
deactivates and then reactivates the consumer against the new provider.
`optionalRequires` documents optional service contracts but does not gate
activation. `provides` must exactly cover services supplied through
`api.services.provide`: undeclared services fail immediately and omitted
declared services fail when `setup` finishes.

Manifest `dependencies` describe relationships between plugins:

```json
{
  "dependencies": [
    { "id": "yourco.base", "spec": "^1.2.0", "optional": false, "peer": false }
  ]
}
```

Required dependencies control activation order. Missing or incompatible
dependencies leave a plugin pending; conflicts and duplicate IDs are denied;
cycles remain unresolved. Supported version specs are exact versions, `*`,
`latest`, `workspace:*`, `^`, `~`, `>`, `>=`, `<`, and `<=`. An optional
dependency participates in ordering only when a compatible plugin is present.
The `peer` flag is recorded in installation metadata but currently does not
change runtime resolution.

Manifest dependencies do not install another plugin. Put JavaScript package
dependencies in `package.json`; install each required Natalia plugin separately
and declare its plugin relationship in the manifest.

## 5. Lifecycle commands

The CLI is the authoritative maintenance entry point. The examples below use
the installed release command:

```bash
natalia-ts plugin install @yourco/natalia-demo
natalia-ts plugin list
natalia-ts plugin disable yourco.demo
natalia-ts plugin enable yourco.demo
natalia-ts plugin doctor
natalia-ts plugin reconcile
natalia-ts plugin uninstall yourco.demo
```

Add `--workspace /path/to/project` to any maintenance command above to target
another workspace. `plugin create` writes to its explicit directory relative to
the current process working directory and does not use workspace state.

- `install <spec>` stages and validates one package, installs its dependency
  closure, writes `.natalia/natalia.lock`, records the package configuration,
  and enables the plugin in one transaction. A failed operation restores the
  previous closure, lock, and configuration.
- `list` returns one catalog for runtime defaults and installed packages with
  `id`, `name`, `version`, `scope`, `enabled`, `installed`, `source`, and
  `packageName`.
- `disable <id>` and `enable <id>` only change desired activation state.
- `uninstall <id>` removes an installed package's configuration, closure, and
  lock entry. For a runtime-distributed default, uninstall durably disables it
  because its files belong to the runtime distribution.
- `doctor` audits installed state; `reconcile` repairs the desired package
  closure. They are recovery commands, not extra installation steps.

`install` accepts npm package specs, including registry versions, local
directories, packed tarballs, Git specs, and remote tarballs:

```bash
natalia-ts plugin install @yourco/natalia-demo@1.0.0
natalia-ts plugin install ./my-natalia-plugin
npm pack ./my-natalia-plugin
natalia-ts plugin install ./yourco-natalia-demo-1.0.0.tgz
```

For local development, rerun `install` after changing the package. For
publication, run `npm pack --dry-run` to verify that `src/index.js` and exactly
one `natalia.plugin.json` are included before `npm publish`.

All maintenance commands, including `create`, print indented JSON. Important
result shapes are:

```json
{ "created": true, "directory": "/absolute/path/my-natalia-plugin", "pluginID": "yourco.demo", "packageName": "@yourco/natalia-demo" }
{ "installed": true, "pluginID": "yourco.demo", "packageName": "@yourco/natalia-demo", "metadata": {} }
{ "pluginID": "yourco.demo", "enabled": false }
{ "uninstalled": true, "pluginID": "yourco.demo", "disposition": "removed for next reconcile" }
```

`plugin list` returns a sorted JSON array. Runtime defaults have
`source.type: "runtime"` and `packageName: null`; installed packages report
their recorded registry, path, Git, or tarball source. `enabled` is false only
when configuration explicitly disables that ID.

These CLI commands persist desired state; they do not directly mutate a plugin
registry already running in another process. A long-running client must reload
its configuration/reconcile its desired catalog, or be restarted. A newly
started CLI, TUI, UI host, or daemon reads the new state. Runtime RPC
`pluginUnload` and `pluginReload` are process-local operations and do not replace
the durable CLI commands.

Installing the same package name and plugin ID again is the upgrade/reinstall
path. The new package must pass staging validation before replacing the live
closure. Changing an installed package's plugin ID or moving an existing plugin
ID to a different package is rejected; uninstall the old identity first when
that change is intentional.

### What installation validates

Installation uses npm with `--ignore-scripts`, stages the package first, then
validates all of the following before committing state:

1. The requested package resolves to a package-lock record with a version.
2. Its package closure contains exactly one `natalia.plugin.json` outside nested
   dependencies.
3. The manifest and entry resolve inside the package directory.
4. `package.json.version`, lock resolution, and manifest `version` agree.
5. The entry imports successfully and default-exports an object with `manifest`
   and `setup()`.
6. The exported manifest equals the file manifest after schema defaults are
   applied.
7. The plugin ID is not reserved by a runtime default and ownership does not
   conflict with the existing lock.

The live closure and `natalia.lock` are owned by the Natalia instance's single
`plugin-store`. Installation and uninstallation never create a workspace-local
package closure. Workspace config only records runtime overrides such as
enablement and settings.

### Doctor and reconcile

An empty array from `plugin doctor` means the installed state is consistent.
Findings use these codes:

| Code                | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| `package_missing`   | The locked package is absent from the instance plugin store. |
| `manifest_mismatch` | Installed manifest ID/version differs from the lock.         |

`plugin reconcile` reinstalls packages reported as `package_missing` using their
locked source. Its result contains `reconciled: true`, the original `findings`,
and a second `remaining` audit. It
does not invent a missing lock entry or silently accept a manifest mismatch;
repair those by reinstalling the intended package.

### Common failures

| Error                                                   | Action                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `plugin directory already exists`                       | Choose an empty path; creation never overwrites files.                                    |
| `must contain exactly one natalia.plugin.json`          | Fix the npm `files` list and remove manifests from bundled fixture/source directories.    |
| `plugin entry manifest does not match`                  | Keep the entry export and file manifest identical, including arrays and defaults.         |
| `manifest version ... does not match installed package` | Set the same version in `package.json` and both manifests.                                |
| `plugin capability denied`                              | Add every used contribution API to `integrationPoints`.                                   |
| `plugin config invalid`                                 | Correct `plugins.settings[pluginID]`; the error includes its property path.               |
| `plugin dependency unresolved`                          | Install/enable the required plugin, correct its version spec, or remove a conflict/cycle. |
| `did not provide declared services`                     | Call `api.services.provide` once for every name in `provides`.                            |
| `unknown plugin`                                        | Use the manifest ID shown by `plugin list`, not the npm package name.                     |

The runtime RPC methods `pluginUnload` and `pluginReload` operate on an already
running registry. They do not replace the CLI's durable install, uninstall,
enable, or disable operations.

## 6. UI adapters

A UI is a normal v2 plugin using the existing `adapters` integration point. The
repository example demonstrates the host contract, but an external UI package
must use the same publishable ESM JavaScript layout as every other external
plugin. This section is the complete authoring path for that package.

### Create an external UI package

Start with the ordinary scaffold, then change its manifest scope and integration
point:

```bash
natalia-ts plugin create ./my-ui --id yourco.ui.web --package @yourco/natalia-ui-web
```

Use `scope: "process"`, `integrationPoints: ["adapters"]`, and a unique adapter
`kind`. The published package needs `@natalia/plugin` to register the adapter
and `@natalia/contracts` only when it imports `RuntimeClient`, `RuntimeEvent`,
or other public types:

```json
{
  "name": "@yourco/natalia-ui-web",
  "version": "1.0.0",
  "type": "module",
  "files": ["src", "natalia.plugin.json"],
  "exports": { ".": "./src/index.js" },
  "dependencies": {
    "@natalia/plugin": "<compatible-version>",
    "@natalia/contracts": "<compatible-version>"
  }
}
```

Do not copy the `workspace:*` dependency versions or `.ts` entry from
`packages/examples/ui-plugin`; that package is a repository fixture. External
packages must publish an importable `.js` or `.mjs` entry and declare real
release-compatible dependency versions.

### Mount and dispose

The UI plugin itself is small. Registration is inert: `mount` runs only after a
UI host selects the adapter kind, and `dispose` must release every listener,
timer, renderer, socket, or other resource created by `mount`.

```js
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.ui.web",
    version: "1.0.0",
    name: "Web UI",
    description: "Example UI adapter.",
    entry: "src/index.js",
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

The host injects three public ports:

| Port                                  | Use                                                                                                                                                                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input.runtime`                       | The complete typed `RuntimeClient`: submit turns, query sessions and resources, call checkpoint methods, and invoke other documented runtime operations. Feature methods are optional, so show an unavailable state when a method is absent. |
| `input.events.subscribe(listener)`    | Subscribes to the shared `RuntimeEvent` stream and returns an unsubscribe function. Keep projected UI state in the adapter; do not create a second runtime or mutate framework state.                                                        |
| `input.commands.list()` / `execute()` | Lists and executes the host's authoritative command catalog. Resolve by command `name`, and pass the raw command plus parsed arguments to `execute`.                                                                                         |

The UI package does not import an internal TUI host, checkpoint controller,
registry, or transport implementation. It only uses these public ports and
public `@natalia/contracts` types. This lets an OpenTUI, web, desktop, or custom
renderer use the same runtime without sharing current TUI state or components.

### Checkpoints and message-level restore

Build restore UI around preview, never around a direct workspace mutation:

```js
async function openRestore(input, checkpointID) {
  if (!input.runtime.checkpointPreview || !input.runtime.checkpointRollback)
    return showUnavailable("Checkpoint management is unavailable.");

  const preview = await input.runtime.checkpointPreview(checkpointID);
  renderRollbackPreview(
    preview.changes,
    preview.context,
    preview.resources,
    preview.warnings,
  );

  // An optional dry run returns the same preview without changing the workspace.
  await input.runtime.checkpointRollback({ id: checkpointID, dryRun: true });

  if (!(await confirmRestore(preview))) return;
  const result = await input.runtime.checkpointRollback({
    id: checkpointID,
    dryRun: false,
  });
  showRestored({ safetyCheckpointID: result.safetyCheckpointID });
}
```

`checkpointList()` returns `RuntimeCheckpoint` items with `turnID`. Transcript
message IDs follow `${turnID}:user`, `${turnID}:assistant`, and related segment
forms, so a UI can derive the turn ID and filter checkpoints with
`checkpoint.turnID === turnID`. This supports a `Restore...` action on either a
user message or an assistant reply without coupling to the OpenTUI renderer.

Show every `CheckpointPreview.changes` item with its `add`, `modify`, `delete`,
`rename`, `mode`, or `symlink` kind, plus context truncation, resource policies,
warnings, and whether `complete` is true. Do not offer a restore for an
incomplete checkpoint. A confirmed rollback creates `safetyCheckpointID` before
workspace mutation; surface it explicitly as "Restore is reversible" and allow
the user to restore that safety checkpoint later.

For a light-weight action, a small preview may use one confirmation. For broad
or destructive previews, require the user to review the changed-file list and
warnings before enabling confirmation. The runtime remains authoritative: it
refuses incomplete targets and safety checkpoints even if a UI makes a mistake.

### Test the package

Keep renderer code behind an adapter-local function and test `mount` with a
fake `RuntimeClient`. Assert that registration performs no I/O before
materialization, events update only local UI state, command execution uses the
catalog, and `dispose` stops all event listeners and renderer resources. See
`packages/examples/ui-plugin` and
`apps/tui/test/example-ui-plugin.test.ts` for an end-to-end materialization
test.

### Launch an installed UI

A UI package is installed like any other plugin and launched by its adapter
kind — one package, two commands:

```bash
natalia-ts plugin install @yourco/natalia-ui-web
natalia-ts ui ui.web
```

`natalia-ts ui <kind>` runs the UI in-process against a real runtime;
`natalia-ts ui` without a kind lists the available UI kinds from enabled
installed and path plugins. The TUI and every installed UI share one generic host,
`createUiAdapterHost` (`@natalia/client`): it resolves the workspace config,
discovers enabled plugins, loads only adapter-capable process plugins into one
process registry, and materializes the requested kind(s) against one shared
`UiAdapterMountInput`. Closing is idempotent and fail-closed (materializer,
then registry, then runtime).

## 7. End-to-end tutorial

This sequence exercises the complete external-plugin lifecycle from a source
checkout. Replace `npm run ts:cli --` with `natalia-ts` in an installed release:

```bash
# 1. Create a JavaScript package.
npm run ts:cli -- plugin create ./demo-plugin \
  --id yourco.demo \
  --package @yourco/natalia-demo

# 2. Edit demo-plugin/src/index.js and keep both manifests identical.

# 3. Install from the local directory and inspect durable state.
npm run ts:cli -- plugin install ./demo-plugin
npm run ts:cli -- plugin list
npm run ts:cli -- plugin doctor

# 4. Exercise desired activation state.
npm run ts:cli -- plugin disable yourco.demo
npm run ts:cli -- plugin enable yourco.demo

# 5. Verify the publication payload and install the packed artifact.
npm pack --dry-run ./demo-plugin
npm pack ./demo-plugin
npm run ts:cli -- plugin install ./yourco-natalia-demo-1.0.0.tgz

# 6. Remove the installed package and audit the result.
npm run ts:cli -- plugin uninstall yourco.demo
npm run ts:cli -- plugin doctor
```

After source changes, reinstall the directory or tarball. Restart or reload a
long-running Natalia process before testing the new desired state.

## 8. Runtime-distributed plugin catalog

These IDs are reserved by the Natalia distribution and therefore cannot be
claimed by an installed package. They appear in `plugin list`; unless explicitly
disabled in configuration, catalog state reports them enabled. Some are only
materialized when the current host supplies their required construction input.

| ID                      | Name                       | API | Scope     | Integration points        |
| ----------------------- | -------------------------- | --- | --------- | ------------------------- |
| `natalia-local-tools`   | Local Tools                | v2  | workspace | tools, services           |
| `natalia-mcp`           | MCP Server                 | v2  | session   | tools, services           |
| `natalia-skills`        | Skills                     | v1  | workspace | tools, commands, services |
| `natalia-task-module`   | Task Module                | v2  | session   | tools                     |
| `natalia-task-workflow` | Task Workflow              | v2  | workspace | services, commands        |
| `natalia-team`          | Team                       | v2  | workspace | tools, services           |
| `natalia-tool-ask`      | Interactive Question Tools | v2  | session   | tools                     |
| `natalia-tool-fs-read`  | Filesystem Read Tools      | v2  | workspace | tools                     |
| `natalia-tool-fs-write` | Filesystem Write Tools     | v2  | workspace | tools                     |
| `natalia-tool-process`  | Managed Process Tools      | v2  | session   | tools, services           |
| `natalia-tool-search`   | Search Tools               | v2  | workspace | tools                     |
| `natalia-tool-shell`    | Shell Tools                | v2  | session   | tools                     |
| `natalia-tool-terminal` | Terminal Tools             | v2  | session   | tools, services           |
| `natalia-tool-todo`     | Todo Tools                 | v2  | session   | tools                     |
| `natalia-tool-web`      | Web Tools                  | v2  | session   | tools                     |

Framework packages such as runtime, transport, session, sandbox, checkpoint,
provider/model, and SDK are deliberately absent: they are not plugins and do not
have a plugin lifecycle switch.

## 9. Publishing checklist

1. Use an ESM `.js` or `.mjs` entry for an external package; Natalia does not
   install a TypeScript source loader for third-party plugins.
2. Keep `package.json.version`, `natalia.plugin.json`, and the exported manifest
   version and content aligned.
3. Declare `@natalia/plugin` and every directly imported Natalia package in
   `dependencies`. Do not use `@natalia/sdk` for authoring an in-process plugin.
4. Pin versions compatible with the target Natalia release. The generated
   scaffold uses the CLI distribution's current `@natalia/plugin` version.
5. Include only runtime files and exactly one manifest. Bundling is allowed if
   the resulting ESM entry and all runtime dependencies remain importable.
6. Do not depend on `preinstall`, `postinstall`, uninstall scripts, or manifest
   hooks; npm scripts are disabled and manifest `hooks` must be `{}`.
7. Run `npm pack --dry-run`, inspect the file list, install the resulting
   tarball into a clean workspace, then run `plugin doctor`.
8. Publish a scoped public package with `npm publish --access public` when the
   npm scope is not configured as public. A package lock is optional source
   metadata; npm constructs and Natalia records the installed closure itself.

## 10. Audit and testing

The registry records `loaded`, `unloaded`, `denied`, and `failed` audit entries.
Runtime diagnostics expose activation failures. Test at least these properties:

1. Registration creates no external resource before adapter materialization.
2. Declared tools and commands retain their names and approval declarations.
3. Setup failure leaves no contribution behind.
4. Disable, unload, and uninstall leave no tool, service, command, listener,
   resource, or UI surface owned by the plugin.
5. Disposal is idempotent and releases event subscriptions and processes.

Repository plugins run `npm run typecheck`, `npm run test`, and
`npm run guard:imports`. File length is a review signal; split code according to
cohesion, ownership, and dependency direction rather than a mechanical limit.
