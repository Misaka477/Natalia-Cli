import { join, resolve } from "node:path";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  createPluginRegistry,
  discoverPluginManifests,
  loadLocalPlugins,
  validatePluginPath,
  type Plugin,
  type PluginManifest,
} from "@natalia/plugin";
import type { ToolRegistry } from "@natalia/tools";

/**
 * The plugins resource controller — cut of the resource controllers split
 * (mainline plan §15). It owns the plugin registry and its lifecycle: loading
 * the configured plugins at startup, unloading and reloading individual
 * plugins (reload re-imports with a cache-busting query), and unloading every
 * plugin at dispose. The command palette bridge is synced through
 * `syncGlobalCommands`, an accessor over the runtime's command catalog.
 */
export function createPluginsController(input: {
  workspaceRoot: string;
  tools: ToolRegistry;
  pluginPaths(): string[];
  pluginEnabled(): Record<string, boolean> | undefined;
  pluginCapabilities(): Record<string, string[]> | undefined;
  pluginReadOnly(): Record<string, boolean> | undefined;
  publish(event: RuntimeEvent): void;
  syncGlobalCommands(): void;
}) {
  let registry: ReturnType<typeof createPluginRegistry> | undefined;

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
    });
    await loadLocalPlugins({
      roots: roots(),
      registry,
      enabled: input.pluginEnabled(),
      capabilities: input.pluginCapabilities(),
      onError: (id, error) =>
        input.publish({
          type: "diagnostic",
          level: "warning",
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
        const module = (await import(
          `${new URL(entry, import.meta.url).href}?reload=${Date.now()}`
        )) as { default?: unknown };
        const candidate = module.default as Partial<Plugin>;
        if (!candidate.setup || typeof candidate.setup !== "function")
          throw new Error(`plugin module has no setup function: ${id}`);
        await registry.load(
          { ...candidate, manifest } as Plugin,
          input.pluginCapabilities()?.[id],
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
