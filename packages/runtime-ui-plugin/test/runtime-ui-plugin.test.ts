import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  type StatusSnapshotController,
} from "@natalia/runtime-services";
import { createRuntimeUiPlugin, RUNTIME_UI_PLUGIN_ID } from "../src";

test("runtime UI service follows plugin load and unload", async () => {
  const events: unknown[] = [];
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
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createRuntimeUiPlugin({
    provider: () => undefined,
    context: () => ({
      journalStatus: () => ({ tokenEstimate: 0, messageCount: 0 }),
    }),
    workspaceRoot: "/tmp/ws",
    permissionMode: () => "read_only",
    runningCount: async () => 0,
    publish: (event) => events.push(event),
  });

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: RUNTIME_UI_PLUGIN_ID,
    scope: "workspace",
    provides: [STATUS_SNAPSHOT_CONTROLLER_SERVICE],
    requires: [],
    dependencies: [],
    integrationPoints: ["services"],
  });
  expect(services.has(STATUS_SNAPSHOT_CONTROLLER_SERVICE)).toBe(false);

  await registry.loadBuiltin(plugin);
  const controller = services.get(
    STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  ) as StatusSnapshotController;
  expect(controller).toBeDefined();
  controller.schedule();

  await registry.unload(RUNTIME_UI_PLUGIN_ID);
  expect(services.has(STATUS_SNAPSHOT_CONTROLLER_SERVICE)).toBe(false);
  await Bun.sleep(10);
  expect(events).toEqual([]);
});
