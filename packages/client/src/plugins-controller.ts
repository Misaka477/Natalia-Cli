import type { PluginPackageConfig, RuntimeEvent } from "@natalia/contracts";
import type { CapabilityRegistryHost } from "@natalia/capability";
import {
  createDesiredPluginController,
  createPluginRegistry,
  resolveDesiredPluginCatalog,
  type DesiredPluginEntry,
  type PluginManifest,
} from "@natalia/plugin";
import type { ToolRegistry } from "@natalia/tools";
import { discoverDesiredPluginEntries } from "./plugin-discovery";
import { registerPluginOwner } from "./plugin-owner";

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
}) {
  let registry: ReturnType<typeof createPluginRegistry> | undefined;
  let controller: ReturnType<typeof createDesiredPluginController> | undefined;
  let closed = false;

  function init() {
    closed = false;
    registry = createPluginRegistry({
      tools: input.tools,
      onAudit: (entry) =>
        input.publish({
          type: "plugin.update",
          id: entry.pluginID,
          status: entry.action,
          detail: entry.detail,
        }),
      registerOwner: (manifest) =>
        registerPluginOwner(manifest, input.capabilityRegistry),
      runtimeConfig: () => input.capabilityRegistry.service("runtime.config"),
      service: <T>(name: string) => input.capabilityRegistry.service<T>(name),
      serviceProvider: (name) =>
        input.capabilityRegistry.ownerOf("services", name),
      onServiceUpdate: (listener) =>
        input.capabilityRegistry.onServiceUpdate(listener),
    });
    controller = createDesiredPluginController({
      registry,
      assertOwnerReleased(id) {
        if (input.capabilityRegistry.has(id))
          throw new Error(
            `plugin ${id} unloaded without releasing its capability owner`,
          );
      },
      onError: publishPluginError,
    });
  }

  async function reconcileDesired(
    defaults: DesiredPluginEntry[],
    config: PluginConfigSnapshot,
  ) {
    const snapshot = structuredClone(config);
    const current = getController();
    await current.reconcileDesired(async () => {
      const users = await (
        input.discoverDesiredEntries ?? discoverDesiredPluginEntries
      )({
        workspaceRoot: input.workspaceRoot,
        paths: snapshot.paths ?? [],
        packages: snapshot.packages ?? {},
        enabled: snapshot.enabled,
        declaredIDs: defaults.map((entry) => entry.id),
        onError: publishLoadError,
      });
      return await resolveDesiredPluginCatalog({
        entries: [...defaults, ...users],
        previous: current.previous,
        onError: publishLoadError,
      });
    }, snapshot.settings);
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

  function getController() {
    if (!controller) throw new Error("plugins are not enabled in this runtime");
    return controller;
  }

  function get() {
    if (!registry) throw new Error("plugins are not enabled in this runtime");
    return registry;
  }

  function list(): PluginManifest[] {
    return registry?.list() ?? [];
  }

  async function close() {
    if (closed) return;
    const current = controller;
    if (!current) return;
    closed = true;
    try {
      await current.close();
    } catch (error) {
      publishPluginError("plugins", "cleanup/close", error);
    } finally {
      registry = undefined;
    }
  }

  return {
    init,
    reconcileDesired,
    get,
    list,
    status: (id: string) => registry?.status(id),
    active: (id: string) => registry?.active(id) ?? false,
    load: (entry: DesiredPluginEntry, settings?: unknown) =>
      getController().load(entry, settings),
    unload: (id: string) =>
      controller
        ? controller.unload(id)
        : Promise.resolve({ unloaded: true as const }),
    reload: (id: string) => getController().reload(id),
    close,
    dispatch: (event: RuntimeEvent) => registry?.dispatch(event),
  };
}
