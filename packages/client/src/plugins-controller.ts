import type { PluginPackageConfig, RuntimeEvent } from "@natalia/contracts";
import type { CapabilityRegistryHost } from "@natalia/capability";
import { createPluginRegistry, type PluginManifest } from "@natalia/plugin";
import type { ToolRegistry } from "@natalia/tools";
import {
  discoverDesiredPluginEntries,
  type DesiredPluginEntry,
} from "./plugin-discovery";
import {
  resolveDesiredPluginCatalog,
  type DesiredPluginCatalog,
} from "./plugin-desired-catalog";
import { registerPluginOwner } from "./plugin-owner";
import {
  hasLivePluginDependencies,
  pluginSettingsFingerprint,
} from "./plugin-live-dependencies";

type DesiredState = {
  entry: DesiredPluginEntry;
  fingerprint: string;
  settingsFingerprint: string;
  settings: unknown;
  activatable: boolean;
};

export type PluginConfigSnapshot = {
  paths?: string[];
  packages?: Record<string, PluginPackageConfig>;
  enabled?: Record<string, boolean>;
  settings?: Record<string, unknown>;
};

export function createPluginsController(input: {
  workspaceRoot: string;
  tools: ToolRegistry;
  capabilityRegistry: CapabilityRegistryHost;
  discoverDesiredEntries?: typeof discoverDesiredPluginEntries;
  publish(event: RuntimeEvent): void;
  syncGlobalCommands(): void;
}) {
  let registry: ReturnType<typeof createPluginRegistry> | undefined;
  let desired = new Map<string, DesiredState>();
  let reconcileQueue = Promise.resolve();
  let reloadSequence = 0;

  function init() {
    registry = createPluginRegistry({
      tools: input.tools,
      onAudit: (entry) =>
        input.publish({
          type: "plugin.update",
          id: entry.pluginID,
          status: entry.action,
          detail: entry.detail,
        }),
      onChange: input.syncGlobalCommands,
      registerOwner: (manifest) =>
        registerPluginOwner(manifest, input.capabilityRegistry),
      runtimeConfig: () => input.capabilityRegistry.service("runtime.config"),
      service: <T>(name: string) => input.capabilityRegistry.service<T>(name),
      serviceProvider: (name) =>
        input.capabilityRegistry.ownerOf("services", name),
      onServiceUpdate: (listener) =>
        input.capabilityRegistry.onServiceUpdate(listener),
    });
    input.syncGlobalCommands();
  }

  async function desiredEntries(
    defaults: DesiredPluginEntry[],
    config: PluginConfigSnapshot,
  ): Promise<DesiredPluginCatalog> {
    const users = await (
      input.discoverDesiredEntries ?? discoverDesiredPluginEntries
    )({
      workspaceRoot: input.workspaceRoot,
      paths: config.paths ?? [],
      packages: config.packages ?? {},
      enabled: config.enabled,
      declaredIDs: defaults.map((entry) => entry.id),
      onError: publishLoadError,
    });
    return await resolveDesiredPluginCatalog({
      entries: [...defaults, ...users],
      previous: (id) => {
        const state = desired.get(id);
        return state
          ? { fingerprint: state.fingerprint, manifest: state.entry.manifest }
          : undefined;
      },
      onError: publishLoadError,
    });
  }

  async function reconcileDesired(
    defaults: DesiredPluginEntry[],
    config: PluginConfigSnapshot,
  ) {
    const snapshot = structuredClone(config);
    const reconciliation = reconcileQueue.then(
      async () =>
        applyDesired(
          await desiredEntries(defaults, snapshot),
          snapshot.settings,
        ),
      async () =>
        applyDesired(
          await desiredEntries(defaults, snapshot),
          snapshot.settings,
        ),
    );
    reconcileQueue = reconciliation.then(
      () => undefined,
      () => undefined,
    );
    await reconciliation;
  }

  async function enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const lifecycle = reconcileQueue.then(operation, operation);
    reconcileQueue = lifecycle.then(
      () => undefined,
      () => undefined,
    );
    return await lifecycle;
  }

  async function applyDesired(
    catalog: DesiredPluginCatalog,
    settings: Record<string, unknown> | undefined,
  ) {
    const { entries, blocked } = catalog;
    const current = get();
    const byID = new Map(entries.map((entry) => [entry.id, entry]));
    if (
      byID.size !== entries.length ||
      entries.some((entry) => entry.manifest && entry.id !== entry.manifest.id)
    )
      throw new Error(
        "desired catalog contains duplicate or mismatched plugin ids",
      );
    for (const id of desired.keys()) {
      const mounted = current.list().some((manifest) => manifest.id === id);
      if (!mounted && input.capabilityRegistry.has(id))
        throw new Error(
          `plugin ${id} has a capability owner but is not mounted`,
        );
    }
    const previousDesired = desired;
    const next = new Map(
      entries.map((entry) => [
        entry.id,
        {
          entry,
          fingerprint: entry.fingerprint,
          settingsFingerprint: pluginSettingsFingerprint(settings?.[entry.id]),
          settings: settings?.[entry.id],
          activatable: !blocked.has(entry.id),
        },
      ]),
    );
    desired = next;
    for (const manifest of current.list().reverse()) {
      if (!current.list().some((entry) => entry.id === manifest.id)) continue;
      const previous = previousDesired.get(manifest.id);
      const wanted = next.get(manifest.id);
      if (
        wanted?.entry.enabled &&
        wanted.activatable &&
        previous?.fingerprint === wanted.fingerprint &&
        previous.settingsFingerprint === wanted.settingsFingerprint &&
        current.status(manifest.id)?.status !== "failed"
      )
        continue;
      await current.unload(manifest.id);
      if (input.capabilityRegistry.has(manifest.id))
        throw new Error(
          `plugin ${manifest.id} unloaded without releasing its capability owner`,
        );
    }
    let firstError: unknown;
    for (const state of next.values())
      if (
        state.entry.enabled &&
        state.activatable &&
        !current.list().some((manifest) => manifest.id === state.entry.id)
      )
        try {
          if (!hasLivePluginDependencies(current, state.entry.manifest))
            continue;
          const result = await loadOne(state.entry, state.settings);
          if (!result.loaded && firstError === undefined)
            firstError =
              result.error ??
              new Error(`plugin failed to load: ${state.entry.id}`);
        } catch (error) {
          firstError ??= error;
        }
    input.syncGlobalCommands();
    if (firstError !== undefined) throw firstError;
  }

  async function loadOne(entry: DesiredPluginEntry, settings?: unknown) {
    try {
      const plugin = await entry.load();
      if (!plugin) return { loaded: false };
      if (plugin.manifest.id !== entry.id)
        throw new Error(
          `plugin loader returned id ${plugin.manifest.id} for ${entry.id}`,
        );
      await get().load(plugin, settings);
    } catch (error) {
      if (!entry.onError) throw error;
      entry.onError(error);
      return { loaded: false, error };
    }
    input.syncGlobalCommands();
    return { loaded: true };
  }

  async function load(entry: DesiredPluginEntry, settings?: unknown) {
    return await enqueueLifecycle(async () => {
      const state = {
        entry,
        fingerprint: entry.fingerprint,
        settingsFingerprint: pluginSettingsFingerprint(settings),
        settings,
        activatable: true,
      };
      desired.set(entry.id, state);
      if (
        get()
          .list()
          .some((manifest) => manifest.id === entry.id)
      )
        await unloadOne(entry.id);
      return await loadOne(entry, settings);
    });
  }

  async function unloadOne(id: string) {
    const current = registry;
    if (current?.list().some((manifest) => manifest.id === id))
      await current.unload(id);
    input.syncGlobalCommands();
    return { unloaded: true };
  }

  async function unload(id: string) {
    return await enqueueLifecycle(() => unloadOne(id));
  }

  async function reloadOne(id: string) {
    const state = desired.get(id);
    if (!state?.entry.enabled || !state.activatable)
      throw new Error(`plugin not found: ${id}`);
    await unloadOne(id);
    let reloadError: unknown;
    let rollbackError: unknown;
    let restorationError: unknown;
    try {
      await loadReloadCandidate(
        state,
        `${Date.now()}-${reloadSequence++}`,
        "reload",
      );
    } catch (error) {
      reloadError = error;
      await unloadOne(id);
      try {
        await loadReloadCandidate(state, undefined, "rollback");
      } catch (rollbackFailure) {
        rollbackError = rollbackFailure;
        try {
          await unloadOne(id);
        } catch (unloadFailure) {
          rollbackError = new AggregateError(
            [rollbackFailure, unloadFailure],
            `plugin ${id} rollback cleanup failed`,
          );
        }
      }
    }
    for (const candidate of desired.values()) {
      if (
        candidate.entry.id === id ||
        !candidate.entry.enabled ||
        !candidate.activatable ||
        (get()
          .list()
          .some((manifest) => manifest.id === candidate.entry.id) &&
          get().status(candidate.entry.id)?.status !== "failed")
      )
        continue;
      try {
        if (get().status(candidate.entry.id)?.status === "failed")
          await unloadOne(candidate.entry.id);
        if (!hasLivePluginDependencies(get(), candidate.entry.manifest))
          continue;
        await loadReloadCandidate(candidate, undefined, "restore");
      } catch (error) {
        if (candidate.entry.id === id) rollbackError ??= error;
        else restorationError ??= error;
      }
    }
    input.syncGlobalCommands();
    if (reloadError !== undefined) throw reloadError;
    if (rollbackError !== undefined) throw rollbackError;
    if (restorationError !== undefined) throw restorationError;
    return { reloaded: true };
  }

  async function loadReloadCandidate(
    state: DesiredState,
    cacheBust: string | undefined,
    action: "reload" | "rollback" | "restore",
  ) {
    try {
      const plugin = await state.entry.load(cacheBust);
      if (!plugin)
        throw new Error(`plugin failed to ${action}: ${state.entry.id}`);
      if (plugin.manifest.id !== state.entry.id)
        throw new Error(
          `plugin loader returned id ${plugin.manifest.id} for ${state.entry.id}`,
        );
      await get().load(plugin, state.settings);
    } catch (error) {
      if (state.entry.onError) state.entry.onError(error);
      else publishPluginError(state.entry.id, action, error);
      throw error;
    }
  }

  async function reload(id: string) {
    return await enqueueLifecycle(() => reloadOne(id));
  }

  function publishLoadError(id: string, error: unknown) {
    publishPluginError(id, "load", error);
  }

  function publishPluginError(id: string, action: string, error: unknown) {
    input.publish({
      type: "diagnostic",
      level: "warning",
      owner: id,
      message: `plugin ${id} ${action} failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  function get() {
    if (!registry) throw new Error("plugins are not enabled in this runtime");
    return registry;
  }
  function list(): PluginManifest[] {
    return registry?.list() ?? [];
  }
  function status(id: string) {
    return registry?.status(id);
  }
  function active(id: string) {
    return registry?.active(id) ?? false;
  }
  function dispatch(event: RuntimeEvent) {
    registry?.dispatch(event);
  }

  async function closeOne() {
    const current = registry;
    if (!current) return;
    try {
      await current.close();
    } catch (error) {
      publishPluginError("plugins", "cleanup/close", error);
    }
    registry = undefined;
    desired.clear();
  }

  async function close() {
    await enqueueLifecycle(closeOne);
  }

  return {
    init,
    reconcileDesired,
    get,
    list,
    status,
    active,
    load,
    unload,
    reload,
    close,
    dispatch,
  };
}
