import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configV3Schema } from "@natalia/contracts";
import { CapabilityRegistry } from "@natalia/capability";
import { createRealRuntimeClient } from "../src/real-runtime";
import { runTaskFromDocument } from "../src/task-controller";
import { flowOverview, scheduledTaskOverview } from "../src/task-overview";
import { workflowContributionsProjection } from "../src/workflow-contributions";
import { workflowDocumentCatalog } from "../src/workflow-document-catalog";

const flow = {
  kind: "natalia-flow" as const,
  version: 1,
  flowID: "flow_capability",
  displayName: "Capability flow",
  modules: [{ id: "read", type: "read_search" as const, displayName: "Read" }],
};

const task = {
  kind: "natalia-task" as const,
  version: 1,
  taskID: "task_capability",
  displayName: "Capability task",
  schedule: "manual",
  prompt: "Inspect.",
  permissionProfile: "auto",
  flow: { flowID: "flow_capability" },
};

function registryWithDocuments() {
  const registry = new CapabilityRegistry();
  registry.load(
    {
      id: "review",
      name: "Review",
      version: "1",
      scope: "workspace",
      grants: ["workflows"],
    },
    (capability) => {
      capability.contribute("workflows", "review-flow", flow);
      capability.contribute("workflows", "review-task", task);
    },
  );
  return registry;
}

test("workflow contributions appear in catalog and both management overviews", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workflow-contributions-"));
  const registry = registryWithDocuments();
  const projection = workflowContributionsProjection(registry);
  const config = configV3Schema.parse({ version: 3 });

  await expect(
    workflowDocumentCatalog(root, config, projection.documents),
  ).resolves.toEqual([
    {
      kind: "task",
      path: "cap:review/task_capability.yaml",
      id: "task_capability",
      displayName: "Capability task",
      source: { kind: "capability", capabilityID: "review" },
      launch: {
        ready: false,
        reason: "stage has no minimum completion condition: read",
      },
    },
    {
      kind: "flow",
      path: "cap:review/flow_capability.yaml",
      id: "flow_capability",
      displayName: "Capability flow",
      source: { kind: "capability", capabilityID: "review" },
      launch: {
        ready: false,
        reason: "flow manual run profile is not configured: flow_capability",
      },
    },
  ]);
  await expect(
    scheduledTaskOverview({
      workspaceRoot: root,
      config,
      contributedDocuments: projection.documents,
    }),
  ).resolves.toMatchObject({
    tasks: [
      {
        taskID: "task_capability",
        path: "cap:review/task_capability.yaml",
        flowID: "flow_capability",
      },
    ],
  });
  await expect(
    flowOverview({
      workspaceRoot: root,
      contributedDocuments: projection.documents,
    }),
  ).resolves.toMatchObject({
    flows: [
      {
        flowID: "flow_capability",
        path: "cap:review/flow_capability.yaml",
        usedBy: ["task_capability"],
      },
    ],
  });
});

test("flow overview associates a contributed task that references a virtual path", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-workflow-contributions-path-"),
  );
  const registry = new CapabilityRegistry();
  registry.load(
    {
      id: "review",
      name: "Review",
      version: "1",
      scope: "workspace",
      grants: ["workflows"],
    },
    (capability) => {
      capability.contribute("workflows", "review-flow", flow);
      capability.contribute("workflows", "review-task", {
        ...task,
        flow: { path: "cap:review/flow_capability.yaml" },
      });
    },
  );

  await expect(
    flowOverview({
      workspaceRoot: root,
      contributedDocuments: workflowContributionsProjection(registry).documents,
    }),
  ).resolves.toMatchObject({
    flows: [{ flowID: "flow_capability", usedBy: ["task_capability"] }],
  });
});

test("invalid contributions diagnose, scope unload removes documents", async () => {
  const registry = registryWithDocuments();
  registry.load(
    {
      id: "broken",
      name: "Broken",
      version: "1",
      scope: "session",
      grants: ["workflows"],
    },
    (capability) => capability.contribute("workflows", "bad", { kind: "nope" }),
  );

  const projected = workflowContributionsProjection(registry);
  expect(Object.keys(projected.documents)).toEqual([
    "cap:review/flow_capability.yaml",
    "cap:review/task_capability.yaml",
  ]);
  expect(projected.diagnostics).toEqual([
    expect.stringContaining(
      'capability broken contributed invalid workflow "bad"',
    ),
  ]);

  registry.unloadScope("workspace");
  expect(workflowContributionsProjection(registry).documents).toEqual({});
});

test("the public flow write surface refuses contributed virtual paths", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-workflow-contributions-write-"),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_workflow_contributions_write",
  });
  try {
    await expect(
      client.saveFlowDocument?.({
        path: "cap:review/flow_capability.yaml",
        document: flow,
      }),
    ).rejects.toThrow("read-only");
    await expect(
      client.deleteFlowDocument?.({
        path: "cap:review/flow_capability.yaml",
      }),
    ).rejects.toThrow("read-only");
  } finally {
    await client.dispose?.();
  }
});

test("the runtime previews a contributed task through its virtual path", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-workflow-contributions-preview-"),
  );
  const registry = registryWithDocuments();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_workflow_contributions_preview",
    capabilityRegistry: registry,
  });
  try {
    await expect(
      client.taskPermissionPreview?.({
        path: "cap:review/task_capability.yaml",
      }),
    ).resolves.toMatchObject({
      taskID: "task_capability",
      flowID: "flow_capability",
      enabledModules: 1,
      conditionlessModules: ["read"],
      valid: false,
    });
  } finally {
    await client.dispose?.();
  }
});

test("task execution resolves current contributions and stops after scope unload", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-workflow-contributions-run-"),
  );
  const registry = new CapabilityRegistry();
  registry.load(
    {
      id: "doctor",
      name: "Doctor",
      version: "1",
      scope: "workspace",
      grants: ["workflows"],
    },
    (capability) => {
      capability.contribute("workflows", "doctor-flow", {
        ...flow,
        flowID: "flow_doctor",
        modules: [
          {
            ...flow.modules[0]!,
            minimumConditions: [{ id: "checked", text: "Run doctor" }],
          },
        ],
      });
      capability.contribute("workflows", "doctor-task", {
        ...task,
        taskID: "task_doctor",
        prompt: "/doctor",
        flow: { flowID: "flow_doctor" },
      });
    },
  );
  const output: string[] = [];
  const config = configV3Schema.parse({ version: 3 });

  const result = await runTaskFromDocument({
    workspaceRoot: root,
    taskID: "task_doctor",
    capabilityRegistry: registry,
    config,
    json: true,
    emit: (line) => output.push(line),
  });
  expect(result.status).toBe("stalled");
  expect(output.some((line) => line.includes('"taskID":"task_doctor"'))).toBe(
    true,
  );

  registry.unloadScope("workspace");
  await expect(
    runTaskFromDocument({
      workspaceRoot: root,
      taskID: "task_doctor",
      capabilityRegistry: registry,
      config,
      json: true,
      emit: () => undefined,
    }),
  ).rejects.toThrow("natalia task not found: task_doctor");
});
