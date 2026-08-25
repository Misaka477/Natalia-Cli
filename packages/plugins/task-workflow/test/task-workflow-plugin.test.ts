import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type TaskWorkflowController,
} from "@natalia/runtime-services";
import {
  createTaskWorkflowPlugin,
  createWorkflowExecutionStoreService,
  createWorkflowStoreService,
  TASK_WORKFLOW_PLUGIN_ID,
} from "../src";

test("workflow store services own document and execution store construction", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workflow-store-service-"));
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "tasks", "daily.yaml"),
    [
      "kind: natalia-task",
      "version: 1",
      "taskID: daily",
      "displayName: Daily",
      "prompt: inspect",
      "schedule: daily 01:00",
      "permissionProfile: default",
      "flow:",
      "  flowID: flow_daily",
      "retry: none",
      "alerts: []",
      "",
    ].join("\n"),
  );

  const documents = createWorkflowStoreService({ workspaceRoot: root });
  expect(await documents.taskDocuments()).toMatchObject([
    { path: "daily.yaml", task: { taskID: "daily" } },
  ]);

  const execution = createWorkflowExecutionStoreService(root);
  const state = await execution.openTaskState();
  expect(state.invocations("daily")).toEqual([]);
  state.close();
});

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
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createTaskWorkflowPlugin({
    workspaceRoot: "/tmp/task-workflow-plugin",
    runtimeConfig: () => undefined,
    capabilityViews: () => [],
    publishDiagnostic() {},
    resolveFlowPermissions: () => ({ blocked: [] }),
    createRuntimeClient: () => ({}) as never,
  });

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: TASK_WORKFLOW_PLUGIN_ID,
    provides: [TASK_WORKFLOW_CONTROLLER_SERVICE],
    requires: [],
    dependencies: [],
    integrationPoints: ["services", "commands"],
  });
  expect(services.has(TASK_WORKFLOW_CONTROLLER_SERVICE)).toBe(false);

  await registry.load(plugin);
  expect(
    services.get(TASK_WORKFLOW_CONTROLLER_SERVICE) as TaskWorkflowController,
  ).toHaveProperty("documentCatalog");
  expect(registry.commands().map((command) => command.name)).toEqual([
    "task",
    "flow",
  ]);

  await registry.unload(TASK_WORKFLOW_PLUGIN_ID);
  expect(services.has(TASK_WORKFLOW_CONTROLLER_SERVICE)).toBe(false);
  expect(registry.commands()).toEqual([]);
});
