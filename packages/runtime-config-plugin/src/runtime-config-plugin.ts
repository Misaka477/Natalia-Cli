/**
 * The runtime's effective config, as a built-in plugin.
 *
 * The plugin provides the resolved config by name, and the host refreshes that
 * contribution on reload so service subscribers observe the replacement.
 */
import type { ConfigV3 } from "@natalia/contracts";
import type { Plugin, PluginManifest } from "@natalia/plugin";

export const RUNTIME_CONFIG_PLUGIN_ID = "natalia-runtime-config";
export const RUNTIME_CONFIG_SERVICE = "runtime.config";

export const RUNTIME_CONFIG_PLUGIN_MANIFEST: PluginManifest = {
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
};

export function createRuntimeConfigPlugin(config: ConfigV3): Plugin {
  return {
    manifest: RUNTIME_CONFIG_PLUGIN_MANIFEST,
    setup(api) {
      api.services.provide(RUNTIME_CONFIG_SERVICE, config);
    },
  };
}
