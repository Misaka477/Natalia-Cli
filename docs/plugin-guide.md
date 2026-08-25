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
  src/index.ts
```

The package declares every imported runtime package as a dependency:

```json
{
  "name": "@yourco/natalia-demo",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@natalia/plugin": "<compatible-version>",
    "@natalia/contracts": "<compatible-version>"
  }
}
```

Use versions compatible with the Natalia distribution you target. The package
manager installs the complete package closure under `.natalia/plugins`; do not
ask users to create SDK symlinks or copy an entry file separately.

## 3. Manifest v2

```json
{
  "apiVersion": 2,
  "id": "yourco.demo",
  "version": "1.0.0",
  "name": "Demo",
  "description": "A demonstration plugin.",
  "entry": "src/index.ts",
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
- `version` is a semantic version; `entry` is a local `.js`, `.mjs`, or `.ts`
  file contained by the package.
- `scope` is `process`, `workspace`, or `session`. It is lifecycle attribution,
  not a security boundary.
- `provides`, `requires`, and `optionalRequires` describe service contracts.
- `conflicts` and `dependencies` participate in deterministic dependency
  resolution. A dependency can set `optional` or `peer`.
- `hooks` may name `preInstall`, `postInstall`, `preUninstall`, and
  `postUninstall` package scripts.
- `integrationPoints` must include every contribution API used by `setup`.

Manifest validation, dependency checks, and configuration validation complete
before activation. If `setup` fails, registrations made during that activation
are rolled back and the plugin is audited as `failed`.

## 4. Implement a plugin

```ts
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.demo",
    version: "1.0.0",
    name: "Demo",
    description: "A demonstration plugin.",
    entry: "src/index.ts",
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

## 5. Lifecycle commands

The CLI is the authoritative maintenance entry point:

```bash
natalia plugin install @yourco/natalia-demo
natalia plugin list
natalia plugin disable yourco.demo
natalia plugin enable yourco.demo
natalia plugin uninstall yourco.demo
```

Add `--workspace /path/to/project` to target another workspace.

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

The runtime RPC methods `pluginUnload` and `pluginReload` operate on an already
running registry. They do not replace the CLI's durable install, uninstall,
enable, or disable operations.

## 6. UI adapters

A UI is a normal v2 plugin using the existing `adapters` integration point:

```ts
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 2,
    id: "yourco.ui.web",
    version: "1.0.0",
    name: "Web UI",
    description: "Example UI adapter.",
    entry: "src/index.ts",
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

The host injects three public ports: `runtime` is the `RuntimeClient` view,
`events.subscribe` is the runtime event stream, and `commands.list` is the
authoritative command catalog. Registration is inert until the host
materializes that adapter. Unload calls its disposer through the same ownership
and lifecycle path as every other contribution.

The executable minimal package is
`packages/examples/ui-plugin`; its end-to-end materialization test is
`apps/tui/test/example-ui-plugin.test.ts`. The production TUI uses the same
`registerUi` port and materializer, so a new UI does not require a TUI-specific
host branch.

### Launching an installed UI

A UI package is installed like any other plugin and launched by its adapter
kind — one package, two commands:

```bash
natalia plugin install @yourco/natalia-ui-web
natalia ui ui.web
```

`natalia ui <kind>` runs the UI in-process against a real runtime; `natalia ui`
without a kind lists the available UI kinds from enabled installed and path
plugins. The TUI and every installed UI share one generic host,
`createUiAdapterHost` (`@natalia/client`): it resolves the workspace config,
discovers enabled plugins, loads only adapter-capable process plugins into one
process registry, and materializes the requested kind(s) against one shared
`UiAdapterMountInput`. Closing is idempotent and fail-closed (materializer,
then registry, then runtime).

## 7. Audit and testing

The registry records `loaded`, `unloaded`, `denied`, and `failed` audit entries.
Runtime diagnostics expose activation failures. Test at least these properties:

1. Registration creates no external resource before adapter materialization.
2. Declared tools and commands retain their names and approval declarations.
3. Setup failure leaves no contribution behind.
4. Disable, unload, and uninstall leave no tool, service, command, listener,
   resource, or UI surface owned by the plugin.
5. Disposal is idempotent and releases event subscriptions and processes.

Repository plugins run `npm run typecheck`, `npm run test`, and
`npm run guard:imports`; all `src/**/*.ts` files must stay at or below 400 lines.
