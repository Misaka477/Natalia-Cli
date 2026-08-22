import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  CHECKPOINT_FACTORY_SERVICE,
  CHECKPOINT_PLUGIN_ID,
  createCheckpointControllerPlugin,
  type CheckpointControllerFactory,
} from "../src";

test("checkpoint factory exists only while the plugin is loaded", async () => {
  const services = new Map<string, unknown>();
  const registry = createPluginRegistry({
    tools: {
      set() {},
      get() {
        return undefined;
      },
      delete() {},
    } as never,
    allowed: ["services"],
    contribute: () => (kind, name, value) => {
      if (kind === "services") services.set(name, value);
      return () => services.delete(name);
    },
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createCheckpointControllerPlugin({ workspaceRoot: "/tmp/ws" });

  expect(plugin.manifest).toMatchObject({
    id: CHECKPOINT_PLUGIN_ID,
    provides: [CHECKPOINT_FACTORY_SERVICE],
    requires: [],
  });
  expect(services.has(CHECKPOINT_FACTORY_SERVICE)).toBe(false);

  await registry.loadBuiltin(plugin);
  expect(
    services.get(CHECKPOINT_FACTORY_SERVICE) as CheckpointControllerFactory,
  ).toBeFunction();

  await registry.unload(CHECKPOINT_PLUGIN_ID);
  expect(services.has(CHECKPOINT_FACTORY_SERVICE)).toBe(false);
});
