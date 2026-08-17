import { join, resolve } from "node:path";
import type { RuntimeEvent } from "@natalia/contracts";
import type {
  CapabilityGrant,
  CapabilityRegistryHost,
} from "@natalia/capability";
import {
  createPluginRegistry,
  discoverPluginManifests,
  loadLocalPlugins,
  validatePluginPath,
  type Plugin,
  type PluginManifest,
} from "@natalia/plugin";
import type { ToolRegistry } from "@natalia/tools";

/** The capability id a plugin is loaded as. */
export function pluginCapabilityID(pluginID: string) {
  return `plugin:${pluginID}`;
}

/**
 * The plugins resource controller — cut of the resource controllers split
 * (mainline plan §15). It owns the plugin registry and its lifecycle: loading
 * the configured plugins at startup, unloading and reloading individual
 * plugins (reload re-imports with a cache-busting query), and unloading every
 * plugin at dispose. The command palette bridge is synced through
 * `syncGlobalCommands`, an accessor over the runtime's command catalog.
 *
 * Tool ownership goes through the capability kernel: each loaded plugin is one
 * capability (`plugin:<id>`) carrying the plugin's declared scope, and every
 * tool the plugin registers is contributed under it. `tool.registered` then
 * reports the plugin as the owner with the scope it declared, exactly as it
 * does for a built-in tool family.
 */
export function createPluginsController(input: {
  workspaceRoot: string;
  tools: ToolRegistry;
  capabilityRegistry: CapabilityRegistryHost;
  pluginPaths(): string[];
  pluginEnabled(): Record<string, boolean> | undefined;
  pluginCapabilities(): Record<string, string[]> | undefined;
  pluginReadOnly(): Record<string, boolean> | undefined;
  /** Per-plugin config, keyed by plugin id; each plugin validates its own entry. */
  pluginSettings(): Record<string, unknown> | undefined;
  publish(event: RuntimeEvent): void;
  syncGlobalCommands(): void;
}) {
  let registry: ReturnType<typeof createPluginRegistry> | undefined;
  let reloadSequence = 0;

  function roots() {
    return [
      join(input.workspaceRoot, ".natalia", "plugins"),
      ...input.pluginPaths().map((path) => resolve(input.workspaceRoot, path)),
    ];
  }

  async function init() {
    registry = createPluginRegistry({
      tools: input.tools,
      readOnly: input.pluginReadOnly(),
      onAudit: (entry) =>
        input.publish({
          type: "plugin.update",
          id: entry.pluginID,
          status: entry.action,
          detail: entry.detail,
        }),
      contribute: async (manifest) => {
        const capabilityID = pluginCapabilityID(manifest.id);
        // The plugin's capability owns everything it registers — tools,
        // commands and event listeners all reach the kernel, the single
        // channel a built-in tool family uses. `events` maps to the kernel's
        // `listeners` grant; execution stays in the registry, ownership is the
        // kernel's.
        const grants: CapabilityGrant[] = [];
        if (manifest.capabilities.includes("tools")) grants.push("tools");
        if (manifest.capabilities.includes("commands")) grants.push("commands");
        if (manifest.capabilities.includes("events")) grants.push("listeners");
        if (manifest.provides.length) grants.push("services");
        const result = input.capabilityRegistry.tryLoad(
          {
            id: capabilityID,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            scope: manifest.scope,
            grants,
            // `requires` gates activation on the plugin's capability: its setup
            // waits for the required services. `provides` is not declared on
            // the registration — a plugin's services arrive during setup (post
            // activation), and the declaration contract is enforced by
            // `api.services.provide` (a declared name only).
            ...(manifest.requires.length
              ? { requires: manifest.requires }
              : {}),
          },
          () => {},
        );
        if (!result.ok)
          throw new Error(`plugin capability failed to load: ${result.reason}`);
        // A plugin that requires services stays pending until they are
        // provided; setup waits for the capability to activate — the same
        // dependency-ordered activation a built-in capability gets.
        if (manifest.requires.length) {
          for (
            let elapsed = 0;
            elapsed < 10_000 &&
            input.capabilityRegistry.isPending(capabilityID);
            elapsed += 10
          )
            await Bun.sleep(10);
          if (input.capabilityRegistry.isPending(capabilityID))
            throw new Error(
              `plugin capability ${capabilityID} still pending: required services were not provided`,
            );
        }
        return (kind, name, payload) => {
          input.capabilityRegistry.contribute(
            capabilityID,
            kind,
            name,
            payload,
          );
          // Kernel ownership is released when the plugin unloads (the whole
          // capability goes), not per registration.
          return () => {};
        };
      },
      onUnload: (pluginID) => {
        input.capabilityRegistry.unload(pluginCapabilityID(pluginID));
      },
      // The runtime's resolved config as a service: plugins read it by name,
      // refreshed in place on config reload (the D2 change notify).
      runtimeConfig: () => input.capabilityRegistry.service("runtime.config"),
    });
    await loadLocalPlugins({
      roots: roots(),
      registry,
      enabled: input.pluginEnabled(),
      capabilities: input.pluginCapabilities(),
      settings: input.pluginSettings(),
      onError: (id, error) =>
        input.publish({
          type: "diagnostic",
          level: "warning",
          owner: pluginCapabilityID(id),
          message: `plugin ${id} failed to load: ${error instanceof Error ? error.message : String(error)}`,
        }),
    });
    input.syncGlobalCommands();
  }

  function get(): ReturnType<typeof createPluginRegistry> {
    if (!registry) throw new Error("plugins are not enabled in this runtime");
    return registry;
  }

  /** The loaded plugins, or an empty list when plugins are not enabled. */
  function list(): PluginManifest[] {
    return registry?.list() ?? [];
  }

  async function unload(id: string) {
    const current = registry;
    if (current && current.list().some((manifest) => manifest.id === id))
      await current.unload(id);
    input.syncGlobalCommands();
    return { unloaded: true };
  }

  async function reload(id: string) {
    if (!registry) throw new Error("plugins are not enabled in this runtime");
    for (const root of roots()) {
      for (const { manifest, path } of await discoverPluginManifests(root)) {
        if (manifest.id !== id) continue;
        if (input.pluginEnabled()?.[id] === false)
          throw new Error(`plugin is disabled in config: ${id}`);
        if (registry.list().some((loaded) => loaded.id === id))
          await registry.unload(id);
        const entry = validatePluginPath(resolve(path, ".."), manifest.entry);
        // Bun ignores query strings on file:// URLs, but a plain path with a
        // query is a fresh cache key — the reload must re-read the entry.
        const module = (await import(
          `${entry}?reload=${Date.now()}-${reloadSequence++}`
        )) as {
          default?: unknown;
        };
        const candidate = module.default as Partial<Plugin>;
        if (!candidate.setup || typeof candidate.setup !== "function")
          throw new Error(`plugin module has no setup function: ${id}`);
        await registry.load(
          { ...candidate, manifest } as Plugin,
          input.pluginCapabilities()?.[id],
          input.pluginSettings()?.[id],
        );
        input.syncGlobalCommands();
        return { reloaded: true };
      }
    }
    throw new Error(`plugin not found: ${id}`);
  }

  async function close() {
    const current = registry;
    if (!current) return;
    for (const plugin of current.list()) await current.unload(plugin.id);
    registry = undefined;
  }

  function dispatch(event: RuntimeEvent) {
    registry?.dispatch(event);
  }

  return { init, get, list, unload, reload, close, dispatch };
}
