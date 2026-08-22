import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import type { ConfigV3 } from "@natalia/contracts";
import {
  createRuntimeConfigPlugin,
  refreshRuntimeConfigService,
  RUNTIME_CONFIG_PLUGIN_ID,
  RUNTIME_CONFIG_SERVICE,
} from "../src";

function loadRuntimeConfig(registry: CapabilityRegistry, config: ConfigV3) {
  const plugin = createRuntimeConfigPlugin(config);
  registry.load(
    {
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      scope: "workspace",
      grants: ["services"],
      provides: [RUNTIME_CONFIG_SERVICE],
    },
    (context) => {
      void plugin.setup({
        services: {
          provide(name: string, value: unknown) {
            context.contribute("services", name, value);
            return () => undefined;
          },
        },
      } as never);
    },
  );
}

test("runtime config service follows plugin load, refresh, and unload", () => {
  const registry = new CapabilityRegistry();
  const initial = { version: 3, defaultPermission: "ask" } as ConfigV3;
  const refreshed = { version: 3, defaultPermission: "auto" } as ConfigV3;
  const updates: Array<{
    name: string;
    provider?: string;
    providerBefore?: string;
  }> = [];
  registry.onServiceUpdate((update) => updates.push(update));

  expect(registry.service<ConfigV3>(RUNTIME_CONFIG_SERVICE)).toBeUndefined();
  loadRuntimeConfig(registry, initial);
  expect(registry.service<ConfigV3>(RUNTIME_CONFIG_SERVICE)).toBe(initial);
  expect(registry.ownerOf("services", RUNTIME_CONFIG_SERVICE)).toBe(
    RUNTIME_CONFIG_PLUGIN_ID,
  );

  refreshRuntimeConfigService(registry, refreshed);
  expect(registry.service<ConfigV3>(RUNTIME_CONFIG_SERVICE)).toBe(refreshed);
  expect(updates).toContainEqual({
    name: RUNTIME_CONFIG_SERVICE,
    provider: RUNTIME_CONFIG_PLUGIN_ID,
    providerBefore: RUNTIME_CONFIG_PLUGIN_ID,
  });

  registry.unload(RUNTIME_CONFIG_PLUGIN_ID);
  expect(registry.service<ConfigV3>(RUNTIME_CONFIG_SERVICE)).toBeUndefined();
  expect(registry.ownerOf("services", RUNTIME_CONFIG_SERVICE)).toBeUndefined();
});

test("runtime config manifest declares a standalone service plugin", () => {
  const manifest = createRuntimeConfigPlugin({} as ConfigV3).manifest;
  expect(manifest).toMatchObject({
    apiVersion: 2,
    id: RUNTIME_CONFIG_PLUGIN_ID,
    scope: "workspace",
    provides: [RUNTIME_CONFIG_SERVICE],
    requires: [],
    dependencies: [],
    integrationPoints: ["services"],
  });
});
