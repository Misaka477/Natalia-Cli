import { join, resolve } from "node:path";
import type { PluginPackageConfig, RuntimeEvent } from "@natalia/contracts";
import type {
  CapabilityGrant,
  CapabilityRegistryHost,
} from "@natalia/capability";
import {
  createPluginRegistry,
  discoverPluginManifests,
  loadPluginEntries,
  manifestIntegrationPoints,
  resolveInstalledPluginEntries,
  validatePluginPath,
  type Plugin,
  type PluginManifest,
} from "@natalia/plugin";
import type { ToolRegistry } from "@natalia/tools";
import type { BuiltinPluginEntry } from "@natalia/builtin-plugins";

/**
 * The plugins resource controller — cut of the resource controllers split
 * (mainline plan §15). It owns the plugin registry and its lifecycle: loading
 * the configured plugins at startup, unloading and reloading individual
 * plugins (reload re-imports with a cache-busting query), and unloading every
 * plugin at dispose. The command palette bridge is synced through
 * `syncGlobalCommands`, an accessor over the runtime's command catalog.
 *
 * Tool ownership goes through the capability kernel: each loaded plugin is one
 * capability carrying the plugin's declared id and scope, and every
 * tool the plugin registers is contributed under it. `tool.registered` then
 * reports the plugin as the owner with the scope it declared, exactly as it
 * does for a built-in tool family.
 */
export function createPluginsController(input: {
  workspaceRoot: string;
  tools: ToolRegistry;
  capabilityRegistry: CapabilityRegistryHost;
  pluginPaths(): string[];
  externalPluginsEnabled?(): boolean;
  pluginPackages?(): Record<string, PluginPackageConfig> | undefined;
  pluginEnabled(): Record<string, boolean> | undefined;
  /** Per-plugin config, keyed by plugin id; each plugin validates its own entry. */
  pluginSettings(): Record<string, unknown> | undefined;
  publish(event: RuntimeEvent): void;
  syncGlobalCommands(): void;
}) {
  let registry: ReturnType<typeof createPluginRegistry> | undefined;
  let reloadSequence = 0;
  const builtinIDs = new Set<string>();
  let desiredBuiltins = new Map<
    string,
    { fingerprint: string; settingsFingerprint: string }
  >();
  let desiredReconcileQueue = Promise.resolve();

  function roots() {
    return [
      join(input.workspaceRoot, ".natalia", "plugins"),
      ...input.pluginPaths().map((path) => resolve(input.workspaceRoot, path)),
    ];
  }

  async function init(options: { loadLocal?: boolean } = {}) {
    registry = createPluginRegistry({
      tools: input.tools,
      onAudit: (entry) => {
        if (builtinIDs.has(entry.pluginID)) return;
        input.publish({
          type: "plugin.update",
          id: entry.pluginID,
          status: entry.action,
          detail: entry.detail,
        });
      },
      onChange: input.syncGlobalCommands,
      registerOwner: (manifest) => {
        // The plugin's capability owns everything it registers — tools,
        // commands and event listeners all reach the kernel, the single
        // channel a built-in tool family uses. `events` maps to the kernel's
        // `listeners` grant; execution stays in the registry, ownership is the
        // kernel's.
        const grants: CapabilityGrant[] = [];
        const integrationPoints = manifestIntegrationPoints(manifest);
        if (manifest.provides.length) grants.push("services");
        const grantForPoint: Partial<
          Record<(typeof integrationPoints)[number], CapabilityGrant>
        > = {
          tools: "tools",
          commands: "commands",
          events: "listeners",
          services: "services",
          resources: "resources",
          projections: "projections",
          workflows: "workflows",
          settingsSchema: "settingsSchema",
          adapters: "adapters",
          schedulerJobs: "schedulerJobs",
        };
        for (const point of integrationPoints) {
          const grant = grantForPoint[point];
          if (grant && !grants.includes(grant)) grants.push(grant);
        }
        const owner = input.capabilityRegistry.registerOwner({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          scope: manifest.scope,
          grants,
        });
        return {
          contribute: owner.contribute,
          release: owner.release,
        };
      },
      // The runtime's resolved config as a service: plugins read it by name,
      // refreshed in place on config reload (the D2 change notify).
      runtimeConfig: () => input.capabilityRegistry.service("runtime.config"),
      service: <T>(name: string) => input.capabilityRegistry.service<T>(name),
      serviceProvider: (name) =>
        input.capabilityRegistry.ownerOf("services", name),
      onServiceUpdate: (listener) =>
        input.capabilityRegistry.onServiceUpdate(listener),
    });
    input.syncGlobalCommands();
    if (options.loadLocal !== false) await loadLocal();
  }

  async function loadLocal() {
    const current = get();
    await loadPluginEntries({
      entries: await externalEntries(),
      registry: current,
      settings: input.pluginSettings(),
      onError: (id, error) =>
        input.publish({
          type: "diagnostic",
          level: "warning",
          owner: id,
          message: `plugin ${id} failed to load: ${error instanceof Error ? error.message : String(error)}`,
        }),
    });
    input.syncGlobalCommands();
  }

  async function reconcile() {
    const current = get();
    const external = current
      .list()
      .filter((manifest) => !builtinIDs.has(manifest.id))
      .reverse();
    for (const manifest of external)
      try {
        await current.unload(manifest.id);
      } catch (error) {
        publishLoadError(manifest.id, error);
      }
    await loadLocal();
  }

  async function reconcileDesiredBuiltins(
    entries: BuiltinPluginEntry[],
    settings: Record<string, unknown> | undefined,
  ) {
    const reconciliation = desiredReconcileQueue.then(
      () => applyDesiredBuiltins(entries, settings),
      () => applyDesiredBuiltins(entries, settings),
    );
    desiredReconcileQueue = reconciliation.then(
      () => undefined,
      () => undefined,
    );
    await reconciliation;
  }

  async function applyDesiredBuiltins(
    entries: BuiltinPluginEntry[],
    settings: Record<string, unknown> | undefined,
  ) {
    const current = get();
    const entriesByID = new Map(entries.map((entry) => [entry.id, entry]));
    if (entriesByID.size !== entries.length)
      throw new Error("builtin desired catalog contains duplicate plugin ids");
    for (const id of desiredBuiltins.keys()) {
      const mounted = current.list().some((manifest) => manifest.id === id);
      if (!mounted && input.capabilityRegistry.has(id))
        throw new Error(
          `builtin plugin ${id} has a capability owner but is not mounted`,
        );
    }

    const nextDesired = new Map(
      entries.map((entry) => [
        entry.id,
        {
          fingerprint: entry.fingerprint,
          settingsFingerprint: settingsFingerprint(settings?.[entry.id]),
        },
      ]),
    );

    for (const manifest of current.list().reverse()) {
      if (!builtinIDs.has(manifest.id)) continue;
      const entry = entriesByID.get(manifest.id);
      const previous = desiredBuiltins.get(manifest.id);
      const next = nextDesired.get(manifest.id);
      if (
        entry?.enabled &&
        previous &&
        next &&
        previous?.fingerprint === next?.fingerprint &&
        previous.settingsFingerprint === next.settingsFingerprint
      )
        continue;
      if (current.list().some((loaded) => loaded.id === manifest.id)) {
        await current.unload(manifest.id);
        if (input.capabilityRegistry.has(manifest.id))
          throw new Error(
            `plugin ${manifest.id} unloaded without releasing its capability owner`,
          );
      }
    }

    for (const entry of entries)
      if (
        entry.enabled &&
        !current.list().some((manifest) => manifest.id === entry.id)
      )
        await loadBuiltin(entry.create(), settings?.[entry.id]);
    builtinIDs.clear();
    for (const entry of entries) builtinIDs.add(entry.id);
    desiredBuiltins = nextDesired;
    input.syncGlobalCommands();
  }

  async function externalEntries() {
    if (input.externalPluginsEnabled?.() === false) return [];
    const installed = await resolveInstalledPluginEntries({
      workspaceRoot: input.workspaceRoot,
      packages: input.pluginPackages?.() ?? {},
      enabled: input.pluginEnabled(),
    });
    for (const failure of installed.errors)
      publishLoadError(failure.id, failure.error);
    const entries = [...installed.entries];
    const known = new Set(Object.keys(input.pluginPackages?.() ?? {}));
    for (const root of roots())
      for (const entry of await discoverPluginManifests(root, {
        nodeModules: false,
      })) {
        if (input.pluginEnabled()?.[entry.manifest.id] === false) continue;
        if (known.has(entry.manifest.id)) {
          publishLoadError(
            entry.manifest.id,
            new Error(
              `plugin ${entry.manifest.id} is declared by more than one source`,
            ),
          );
          continue;
        }
        known.add(entry.manifest.id);
        entries.push(entry);
      }
    return entries;
  }

  function publishLoadError(id: string, error: unknown) {
    input.publish({
      type: "diagnostic",
      level: "warning",
      owner: id,
      message: `plugin ${id} failed to load: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  function get(): ReturnType<typeof createPluginRegistry> {
    if (!registry) throw new Error("plugins are not enabled in this runtime");
    return registry;
  }

  /** The mounted external plugins, including pending and failed plugins. */
  function list(): PluginManifest[] {
    return (registry?.list() ?? []).filter(
      (manifest) => !builtinIDs.has(manifest.id),
    );
  }

  function status(id: string) {
    return registry?.status(id);
  }

  function active(id: string) {
    return registry?.active(id) ?? false;
  }

  async function loadBuiltin(plugin: Plugin, config?: unknown) {
    const current = get();
    builtinIDs.add(plugin.manifest.id);
    try {
      await current.load(plugin, config);
    } catch (error) {
      if (!current.status(plugin.manifest.id))
        builtinIDs.delete(plugin.manifest.id);
      throw error;
    }
    input.syncGlobalCommands();
  }

  async function unload(id: string) {
    if (builtinIDs.has(id)) throw new Error(`plugin not found: ${id}`);
    const current = registry;
    if (current && current.list().some((manifest) => manifest.id === id))
      await current.unload(id);
    input.syncGlobalCommands();
    return { unloaded: true };
  }

  async function unloadBuiltin(id: string) {
    const current = registry;
    if (current?.list().some((manifest) => manifest.id === id))
      await current.unload(id);
    for (const builtinID of [...builtinIDs])
      if (!current?.list().some((manifest) => manifest.id === builtinID))
        builtinIDs.delete(builtinID);
    input.syncGlobalCommands();
  }

  async function reload(id: string) {
    if (!registry) throw new Error("plugins are not enabled in this runtime");
    for (const { manifest, path } of await externalEntries()) {
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
        input.pluginSettings()?.[id],
      );
      input.syncGlobalCommands();
      return { reloaded: true };
    }
    throw new Error(`plugin not found: ${id}`);
  }

  async function close() {
    const current = registry;
    if (!current) return;
    for (const plugin of current.list().reverse())
      try {
        await current.unload(plugin.id);
      } catch (error) {
        input.publish({
          type: "diagnostic",
          level: "warning",
          owner: plugin.id,
          message: `plugin ${plugin.id} cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    await current.close();
    registry = undefined;
    builtinIDs.clear();
    desiredBuiltins.clear();
  }

  function dispatch(event: RuntimeEvent) {
    registry?.dispatch(event);
  }

  return {
    init,
    get,
    list,
    status,
    active,
    loadBuiltin,
    loadLocal,
    reconcile,
    reconcileDesiredBuiltins,
    unload,
    unloadBuiltin,
    reload,
    close,
    dispatch,
  };
}

function settingsFingerprint(value: unknown): string {
  return JSON.stringify(normalizeSettings(value));
}

function normalizeSettings(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalizeSettings);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeSettings(child)]),
    );
  return value;
}
