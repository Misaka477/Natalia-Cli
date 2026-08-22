/**
 * The runtime's effective config, as a built-in plugin.
 *
 * The plugin provides the resolved config by name, and the host refreshes that
 * contribution on reload so service subscribers observe the replacement.
 */
import type { CapabilityRegistryHost } from "@natalia/capability";
import type { ConfigV3 } from "@natalia/contracts";
import type { Plugin } from "@natalia/plugin";

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

/** Replace the plugin-owned service while preserving its kernel ownership. */
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
