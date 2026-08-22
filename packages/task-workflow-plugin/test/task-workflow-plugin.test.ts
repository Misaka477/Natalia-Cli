import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  TASK_WORKFLOW_PLUGIN_ID,
  type TaskWorkflowController,
} from "../src";

test("task workflow controller exists only while the plugin is loaded", async () => {
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
  const plugin = createTaskWorkflowPlugin({
    workspaceRoot: "/tmp/task-workflow-plugin",
    runtimeConfig: () => undefined,
    capabilityViews: () => [],
    publishDiagnostic() {},
    resolveFlowPermissions: () => ({ blocked: [] }),
  });

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: TASK_WORKFLOW_PLUGIN_ID,
    provides: [TASK_WORKFLOW_CONTROLLER_SERVICE],
    requires: [],
    dependencies: [],
  });
  expect(services.has(TASK_WORKFLOW_CONTROLLER_SERVICE)).toBe(false);

  await registry.loadBuiltin(plugin);
  expect(
    services.get(TASK_WORKFLOW_CONTROLLER_SERVICE) as TaskWorkflowController,
  ).toHaveProperty("documentCatalog");

  await registry.unload(TASK_WORKFLOW_PLUGIN_ID);
  expect(services.has(TASK_WORKFLOW_CONTROLLER_SERVICE)).toBe(false);
});
