import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import type { ConfigV3 } from "@natalia/contracts";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createRuntimeConfigPlugin,
  RUNTIME_CONFIG_PLUGIN_ID,
  RUNTIME_CONFIG_SERVICE,
} from "../src";

test("runtime config service follows plugin setup and dispose", async () => {
  const capabilities = new CapabilityRegistry();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    registerOwner: (manifest) =>
      capabilities.registerOwner({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        scope: manifest.scope,
        grants: ["services"],
      }),
    service: <T>(name: string) => capabilities.service<T>(name),
  });
  const config = { version: 3, defaultPermission: "ask" } as ConfigV3;
  await registry.loadBuiltin(createRuntimeConfigPlugin(config));
  expect(capabilities.service<ConfigV3>(RUNTIME_CONFIG_SERVICE)).toBe(config);
  await registry.unload(RUNTIME_CONFIG_PLUGIN_ID);
  expect(capabilities.service(RUNTIME_CONFIG_SERVICE)).toBeUndefined();
});

test("runtime config manifest declares a standalone service plugin", () => {
  expect(createRuntimeConfigPlugin({} as ConfigV3).manifest).toMatchObject({
    apiVersion: 2,
    id: RUNTIME_CONFIG_PLUGIN_ID,
    scope: "workspace",
    provides: [RUNTIME_CONFIG_SERVICE],
    requires: [],
    dependencies: [],
    integrationPoints: ["services"],
  });
});
