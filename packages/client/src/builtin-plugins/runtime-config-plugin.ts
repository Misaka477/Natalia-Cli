/**
 * The runtime's effective config, as a built-in plugin.
 *
 * The service-injection slice (D2): the plugin declares that it provides a
 * service by name, any plugin or tool family can resolve it by name, and the
 * host refreshes it in place on config reload — which notifies subscribers.
 * This is the framework's first real service: consumers read the resolved
 * config without depending on the host, and they learn about reloads by
 * subscribing to service updates instead of polling.
 */
import type { Plugin } from "@natalia/plugin";
import type { CapabilityRegistryHost } from "@natalia/capability";
import type { ConfigV3 } from "@natalia/contracts";

export const RUNTIME_CONFIG_PLUGIN_ID = "natalia-runtime-config";
export const RUNTIME_CONFIG_SERVICE = "runtime.config";

export function createRuntimeConfigPlugin(config: ConfigV3): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: RUNTIME_CONFIG_PLUGIN_ID,
      version: "1.0.0",
      name: "Runtime Config",
      description: "The runtime's effective config, refreshed on reload.",
      entry: "natalia:runtime-config",
      scope: "workspace",
      provides: [RUNTIME_CONFIG_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(RUNTIME_CONFIG_SERVICE, config);
    },
  };
}

/**
 * Replaces the config service after a reload. The replace goes through the
 * kernel's contribution path — the same channel the plugin's own service
 * provision used, under the same capability id — so a prior value is reported
 * to subscribers as the `providerBefore` of a service update.
 */
export function refreshRuntimeConfigService(
  registry: CapabilityRegistryHost,
  config: ConfigV3,
): void {
  registry.contribute(
    RUNTIME_CONFIG_PLUGIN_ID,
    "services",
    RUNTIME_CONFIG_SERVICE,
    config,
  );
}
