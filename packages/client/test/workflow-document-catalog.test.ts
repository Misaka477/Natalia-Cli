import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configV2Schema, nataliaFlowDocumentSchema } from "@natalia/contracts";
import { NataliaDocumentStore } from "@natalia/workflow";
import { manualFlowTask, workflowDocumentCatalog } from "../src";

test("workflow catalog exposes tasks and only directly runnable flows", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-workflows-"));
  const documents = new NataliaDocumentStore(workspaceRoot);
  await documents.saveFlow({
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_hidden",
    displayName: "Hidden flow",
    modules: [{ id: "read", type: "read_search", displayName: "Read" }],
  });
  await documents.saveFlow({
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_manual",
    displayName: "Manual flow",
    directRun: { permissionProfile: "unattended" },
    modules: [{ id: "read", type: "read_search", displayName: "Read" }],
  });
  await documents.saveTask({
    kind: "natalia-task",
    version: 1,
    taskID: "task_manual",
    displayName: "Manual task",
    schedule: "manual",
    prompt: "Run",
    permissionProfile: "unattended",
    flow: { flowID: "flow_manual" },
  });
  const config = configV2Schema.parse({
    version: 2,
    defaultModel: "worker",
    providers: { local: { type: "openai-compatible", apiKey: "key" } },
    models: { worker: { provider: "local", model: "worker-model" } },
    permissionProfiles: { unattended: { approval: "auto" } },
  });
  expect(await workflowDocumentCatalog(workspaceRoot, config)).toEqual([
    expect.objectContaining({ kind: "task", id: "task_manual" }),
    expect.objectContaining({ kind: "flow", id: "flow_manual" }),
  ]);
  expect(
    await workflowDocumentCatalog(
      workspaceRoot,
      configV2Schema.parse({
        version: 2,
        defaultModel: "worker",
        providers: { local: { type: "openai-compatible", apiKey: "key" } },
        models: { worker: { provider: "local", model: "worker-model" } },
        permissionProfiles: { unattended: { approval: "ask" } },
      }),
    ),
  ).toEqual([expect.objectContaining({ kind: "task", id: "task_manual" })]);
});

test("manual flow task uses the flow profile and default execution model", () => {
  const flow = nataliaFlowDocumentSchema.parse({
    kind: "natalia-flow",
    version: 1,
    flowID: "flow_manual",
    displayName: "Manual flow",
    directRun: { permissionProfile: "unattended" },
    modules: [{ id: "read", type: "read_search", displayName: "Read" }],
  });
  const config = configV2Schema.parse({
    version: 2,
    defaultModel: "worker",
    providers: { local: { type: "openai-compatible", apiKey: "key" } },
    models: { worker: { provider: "local", model: "worker-model" } },
    permissionProfiles: { unattended: { approval: "auto" } },
  });
  expect(manualFlowTask(flow, config)).toMatchObject({
    taskID: "manual_flow_flow_manual",
    schedule: "manual",
    permissionProfile: "unattended",
    evaluator: { provider: "local", model: "worker" },
  });
  expect(() =>
    manualFlowTask(
      { ...flow, directRun: { permissionProfile: "missing" } },
      config,
    ),
  ).toThrow("profile not found");
});
