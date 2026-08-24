import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  CHECKPOINT_FACTORY_SERVICE,
  type CheckpointFactory,
} from "@natalia/runtime-services";
import { CHECKPOINT_PLUGIN_ID, createCheckpointControllerPlugin } from "../src";

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
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createCheckpointControllerPlugin({
    workspaceRoot: "/tmp/ws",
    commands: {
      controller: async () =>
        ({
          get: () => ({ list: async () => [] }),
          isEnabled: () => true,
          rollbackOptions: () => ({}),
        }) as never,
      context: () => ({}) as never,
      referencedObjectIDs: async () => new Set(),
    },
  });

  expect(plugin.manifest).toMatchObject({
    id: CHECKPOINT_PLUGIN_ID,
    provides: [CHECKPOINT_FACTORY_SERVICE],
    requires: [],
  });
  expect(services.has(CHECKPOINT_FACTORY_SERVICE)).toBe(false);

  await registry.load(plugin);
  expect(
    services.get(CHECKPOINT_FACTORY_SERVICE) as CheckpointFactory,
  ).toBeFunction();
  expect(registry.commands().map((command) => command.name)).toEqual([
    "checkpoint",
    "checkpoints",
    "rollback",
  ]);
  expect(
    await registry
      .commands()
      .find((command) => command.name === "checkpoints")
      ?.run({
        raw: "/checkpoints",
        args: [],
        workspaceRoot: "/tmp/ws",
        sessionID: "ses_test",
      }),
  ).toBe("");

  await registry.unload(CHECKPOINT_PLUGIN_ID);
  expect(services.has(CHECKPOINT_FACTORY_SERVICE)).toBe(false);
  expect(registry.commands()).toHaveLength(0);
});
