# Natalia Plugin Guide — v1

> Status: `PLUGIN_API_VERSION` = 1 (see `@natalia/plugin`).
> This guide covers how to write, load and test a plugin. It pairs with the
> runtime API reference (`docs/api-reference.md`): plugins run _inside_ the
> runtime process, so the plugin API is a host-side extension surface, not an
> RPC surface.

## 1. What a plugin is

A plugin is a TypeScript/JavaScript module that runs **in-process** inside the
runtime. It can contribute three kinds of things, each gated by its own
capability:

| Capability | What the plugin gets                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `tools`    | `api.tools.register(tool)` — a model-callable tool, named `plugin_<id>_<name>`   |
| `events`   | `api.events.on(listener)` — every runtime event, dispatched to all listeners     |
| `commands` | `api.commands.register(command)` — a palette command, named `plugin_<id>_<name>` |

**Trust model, stated plainly: a plugin is trusted code, not a sandbox.** It is
`import()`ed in-process with path containment and a `.js`/`.mjs`/`.ts`
extension check — no VM, no filesystem restriction, no timeout, no network
policy. Loading a plugin is the same security decision as running its code
yourself. The capability gate and the `readOnly` workspace trust mark are
governance, not isolation: a plugin that declares only `events` cannot register
tools, but nothing stops it from doing whatever JavaScript can do. Load only
plugins you wrote or audited.

## 2. Where plugins live

The runtime loads plugins from `<workspace>/.natalia/plugins/` at startup. Each
plugin is a directory with a manifest:

```
.natalia/plugins/
  demo/
    natalia.plugin.json        # the manifest
    index.ts           # the entry, or any .js/.mjs/.ts the manifest names
```

A plugin entry that escapes the plugins root, or is not a local JS/TS module,
is refused at load. A plugin whose manifest fails validation is refused with an
audit entry; a plugin whose `setup` throws is rolled back (every registration
it made is undone) and recorded as `failed` in the registry audit.

## 3. The manifest

```json
{
  "apiVersion": 1,
  "id": "demo.plugin",
  "version": "1.0.0",
  "name": "Demo",
  "description": "A demonstration plugin",
  "entry": "index.ts",
  "capabilities": ["tools", "events", "commands"]
}
```

| Field          | Rule                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apiVersion`   | must be `1`                                                                                                         |
| `id`           | `[a-z0-9][a-z0-9._-]*`; the registry key, and the prefix of every registered name                                   |
| `version`      | semantic version                                                                                                    |
| `name`         | display name; also the default `category` for commands                                                              |
| `description`  | optional, default `""`                                                                                              |
| `entry`        | optional, default `"index.ts"`; must be a local `.js`/`.mjs`/`.ts`                                                  |
| `capabilities` | which of `tools`/`events`/`commands` the plugin may use; the host may further constrain with an `allowed` whitelist |

## 4. `definePlugin`

```ts
import { definePlugin } from "@natalia/plugin";

export default definePlugin({
  manifest: {
    apiVersion: 1,
    id: "demo.plugin",
    version: "1.0.0",
    name: "Demo",
    capabilities: ["tools", "commands"],
  },
  setup(api) {
    api.tools.register({
      name: "echo",
      description: "Echo the input back.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      },
      async execute(input, context) {
        return (input as { text?: string }).text ?? "";
      },
    });

    api.commands.register({
      name: "hello",
      title: "Say hello",
      run() {
        console.log("hello from the demo plugin");
      },
    });
  },
  dispose() {
    // optional; run before the plugin's registrations are removed
  },
});
```

- **Names are namespaced for you.** A tool registered as `echo` becomes
  `plugin_demo_plugin_echo`; a command named `hello` becomes
  `plugin_demo_plugin_hello`. A plugin cannot shadow a built-in tool or
  command by choosing its name, and unloading a plugin removes exactly the
  names it registered.
- **Dynamic plugin tools require approval unless trusted.** `requiresApproval`
  defaults to `true` for plugin tools; a workspace that explicitly trusts a
  plugin's own read-only declaration can mark it
  (`readOnly: { "demo.plugin": true }` in the host), in which case tools that
  declare `requiresApproval: false` stay approval-free.
- **The `context` passed to `execute(input, context)`** (the
  `ToolExecutionContext` from `@natalia/tools`):
  - `workspaceRoot: string` — the current workspace root.
  - `signal?: AbortSignal` — aborts when the turn is cancelled; long-running
    tools should listen to it.
  - `askQuestion?` — ask the user a question
    (`{ title, questions: [{ id, header, question, options: [{ label,
description? }], multiple?, custom? }] }`, answering `string[][]`,
    outer array in questions order). Absent when the host has no interactive
    channel.
  - `subagents?` / `nativeTerminal?` / `sandboxes?` — the subagent, terminal
    and sandbox registries, present when the host capability exists.
  - `workspaceReadAuthorize?` / `sandboxMergeAuthorize?` — host policy hooks;
    call them **before** touching the workspace or merging, a refusal throws.
  - `settings?` — the runtime's network/browser policy
    (`allowedHosts`/`allowedSchemes`/`allowLocalhost`/`allowPrivate`/
    `deniedHosts`/`envAllowlist`, `webSearchEndpoint`,
    `browserEnabled`/`browserBinary`, …). Read/write tools should respect
    these boundaries — the host enforces the same settings for its own
    network policy.
  - `parentSessionID?` / `parentAgentID?` / `maxSubagentDepth?` — the calling
    session, agent and the subagent depth budget.
- **`setup` may be async.** If it throws, everything it registered is rolled
  back and the load is recorded as `failed`.
- **Every registration returns a disposer** (`const off = api.tools.register(...)`).
  You do not need to call them — unload does — but you may use them to
  unregister mid-flight.

## 5. Configuration

A plugin that needs configuration declares the schema for its own config, and
the host passes the entry it was configured with:

```json
// .natalia/config.json
{
  "plugins": {
    "settings": {
      "demo.plugin": { "endpoint": "https://example.test", "retries": 5 }
    }
  }
}
```

```ts
import { z } from "zod";

export default definePlugin({
  manifest: {
    apiVersion: 1,
    id: "demo.plugin",
    version: "1.0.0",
    name: "Demo",
  },
  configSchema: z.object({
    endpoint: z.string().url(),
    retries: z.number().int().min(0).default(3),
  }),
  setup(api) {
    const config = api.config as { endpoint: string; retries: number };
    // config.retries is 3 when the host omitted it — the schema's default.
  },
});
```

- **The plugin owns the schema, the host owns the value.** The runtime does not
  interpret `plugins.settings`: it keys the record by plugin id and hands each
  plugin its own entry. A plugin's config vocabulary is therefore versioned
  with the plugin, not with the runtime's config schema.
- **`api.config` is the validated value**, i.e. the schema's parsed output, so
  declared defaults are already applied. A plugin without a `configSchema`
  accepts anything and receives the raw value unchanged.
- **Misconfiguration fails the load, loudly.** Validation runs _before_
  `setup`, so an invalid entry never reaches a half-configured plugin: the load
  throws with the failing paths (`- Invalid url (at endpoint)`), the audit
  records `failed`, and nothing the plugin would have registered exists.
- **Any Standard Schema library works** (zod, valibot, arktype) — the plugin
  API duck-types the `~standard` interface rather than requiring this repo's
  zod build, because a plugin is distributed independently. The schema must
  validate synchronously; an async schema is a load error rather than a
  silently unvalidated config.
- **Conformance takes a config too**:
  `runPluginConformance({ plugin, config: { endpoint: "https://example.test" } })`,
  so a plugin's config contract is testable in isolation.

## 6. Events

```ts
setup(api) {
  api.events.on((event) => {
    if ((event as { type?: string }).type === "turn.finished") {
      console.log("a turn finished");
    }
  });
}
```

Listeners see every runtime event (the same `RuntimeEvent` objects the event
stream carries, in-process, without serialization). A listener that throws is
ignored — one bad plugin cannot break the dispatch loop. Events are the
capability a plugin declares to observe; it is how a plugin reacts to the
runtime without polling.

## 7. Commands

```ts
api.commands.register({
  name: "deploy",
  title: "Deploy the demo",
  category: "Demo", // optional; defaults to the plugin's name
  async run() {
    await deploy();
  },
});
```

Commands are the plugin's UI surface: they appear in the palette (TUI and CLI
alike), and the authoritative list is readable over RPC — `command.catalog`
(`sdk.commandCatalog()`) — so a remote UI sees exactly the commands the
registry owns. The palette renders synchronously through a process-wide bridge
that assumes one runtime per process (true for the CLI and the TUI worker).

## 8. Conformance

`runPluginConformance` checks a plugin in isolation, against a throwaway tool
registry:

```ts
import { runPluginConformance } from "@natalia/plugin";

const results = await runPluginConformance({ plugin, allowed: ["tools"] });
// [{ name: "manifest-and-setup", passed: true },
//  { name: "owned-registration-cleanup", passed: true }]
```

Two checks: the manifest parses and `setup` runs; and after `unload`, no tool
the plugin registered is left behind. If your plugin adds a third kind of
contribution, extend the conformance checks in `packages/plugin/test/` the
same way before shipping it — the repo's gate is that a claim in this guide is
either a test or a lie.

## 9. Loading and auditing

The registry records every lifecycle transition as a `PluginAudit`:
`loaded`, `unloaded`, `denied` (a capability the plugin used but was not
granted) or `failed` (manifest or `setup` error). The audit is readable through
the registry (`registry.audit()`) and surfaced by the runtime; a plugin that
fails to load produces a runtime diagnostic naming the plugin, so a broken
plugin is visible in `sdk.diagnostics()` instead of silently missing.

## 10. Dependency resolution (deployment note)

A plugin that imports `@natalia/plugin` (the documented way to `definePlugin`)
must be able to resolve it. Bun resolves bare specifiers by walking up from
the _importing file_ for a `node_modules`/workspace context, and the plugin
lives in the workspace's `.natalia/plugins` — outside the runtime's package
tree. The deployment must therefore provide one of:

- the SDK packages installed into the workspace's `node_modules` (or a
  `node_modules/@natalia` symlink to the runtime's packages), or
- a loader/runtime layout that makes `@natalia/*` resolvable from the plugin
  directory.

This is a deployment contract, not a runtime feature: the runtime does not
intercept module resolution. A plugin whose import fails to resolve reports a
`failed` load with the resolution error in the diagnostic.
