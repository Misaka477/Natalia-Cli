import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deleteFlowDocument, loadFlowDocument, saveFlowDocument } from "../src";
import { NataliaDocumentStore } from "@natalia/workflow";

test("flow document editor APIs atomically save and reload a stable definition", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-flow-editor-"));
  const flow = {
    kind: "natalia-flow" as const,
    version: 1,
    flowID: "flow_stable",
    displayName: "Nightly review",
    directRun: { permissionProfile: "unattended" },
    modules: [
      {
        id: "module_read",
        type: "read_search" as const,
        displayName: "Read changes",
        minimumConditions: [
          { id: "condition_reviewed", text: "Review every changed file" },
        ],
      },
    ],
  };

  await saveFlowDocument({
    workspaceRoot,
    path: "nightly-review.yaml",
    document: flow,
  });
  const loaded = await loadFlowDocument({
    workspaceRoot,
    path: "nightly-review.yaml",
  });
  expect(loaded).toMatchObject({
    flowID: "flow_stable",
    displayName: "Nightly review",
    directRun: { permissionProfile: "unattended" },
    modules: [
      {
        id: "module_read",
        minimumConditions: [
          { id: "condition_reviewed", text: "Review every changed file" },
        ],
      },
    ],
  });

  await saveFlowDocument({
    workspaceRoot,
    path: "nightly-review.yaml",
    document: { ...loaded, displayName: "Renamed review" },
  });
  await expect(
    loadFlowDocument({ workspaceRoot, path: "nightly-review.yaml" }),
  ).resolves.toMatchObject({
    flowID: "flow_stable",
    displayName: "Renamed review",
  });
});

test("flow document editor APIs refuse paths outside the workspace flows directory", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-flow-editor-"));
  await expect(
    saveFlowDocument({
      workspaceRoot,
      path: "../outside.yaml",
      document: {
        kind: "natalia-flow",
        version: 1,
        flowID: "flow_escape",
        displayName: "Escape",
        modules: [
          { id: "module_read", type: "read_search", displayName: "Read" },
        ],
      },
    }),
  ).rejects.toThrow("relative file name");
  await expect(
    saveFlowDocument({
      workspaceRoot,
      path: ".natalia/flows/inside-looking.yaml",
      document: {
        kind: "natalia-flow",
        version: 1,
        flowID: "flow_prefixed",
        displayName: "Prefixed",
        modules: [
          { id: "module_read", type: "read_search", displayName: "Read" },
        ],
      },
    }),
  ).rejects.toThrow("relative file name");
  await expect(
    saveFlowDocument({
      workspaceRoot,
      path: "nested/inside.yaml",
      document: {
        kind: "natalia-flow",
        version: 1,
        flowID: "flow_nested",
        displayName: "Nested",
        modules: [
          { id: "module_read", type: "read_search", displayName: "Read" },
        ],
      },
    }),
  ).rejects.toThrow("relative file name");
});

test("flow deletion refuses task references and removes only an unreferenced definition", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-flow-delete-"));
  const documents = new NataliaDocumentStore(workspaceRoot);
  const flow = {
    kind: "natalia-flow" as const,
    version: 1,
    flowID: "flow_stable",
    displayName: "Stable flow",
    modules: [
      { id: "read", type: "read_search" as const, displayName: "Read" },
    ],
  };
  await saveFlowDocument({
    workspaceRoot,
    path: "stable.yaml",
    document: flow,
  });
  await documents.saveTask(
    {
      kind: "natalia-task",
      version: 1,
      taskID: "task_by_id",
      displayName: "By ID",
      schedule: "daily",
      prompt: "Run",
      permissionProfile: "unattended",
      flow: { flowID: flow.flowID },
    },
    "by-id.yaml",
  );
  await documents.saveTask(
    {
      kind: "natalia-task",
      version: 1,
      taskID: "task_by_path",
      displayName: "By path",
      schedule: "daily",
      prompt: "Run",
      permissionProfile: "unattended",
      flow: { path: ".natalia/flows/stable.yaml" },
    },
    "by-path.yaml",
  );

  await expect(
    deleteFlowDocument({ workspaceRoot, path: "stable.yaml" }),
  ).rejects.toThrow("task_by_id, task_by_path");
  await documents.deleteTask("by-id.yaml");
  await documents.deleteTask("by-path.yaml");
  await deleteFlowDocument({ workspaceRoot, path: "stable.yaml" });
  await expect(
    loadFlowDocument({ workspaceRoot, path: "stable.yaml" }),
  ).rejects.toThrow("not found");
  await expect(
    deleteFlowDocument({ workspaceRoot, path: "../outside.yaml" }),
  ).rejects.toThrow("relative file name");
});

test("flow deletion fails closed when task references cannot be inspected", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-flow-delete-"));
  await saveFlowDocument({
    workspaceRoot,
    path: "stable.yaml",
    document: {
      kind: "natalia-flow",
      version: 1,
      flowID: "flow_stable",
      displayName: "Stable flow",
      modules: [{ id: "read", type: "read_search", displayName: "Read" }],
    },
  });
  const documents = new NataliaDocumentStore(workspaceRoot);
  await mkdir(documents.tasksDir, { recursive: true });
  await writeFile(join(documents.tasksDir, "broken.yaml"), "kind: [broken\n");

  await expect(
    deleteFlowDocument({ workspaceRoot, path: "stable.yaml" }),
  ).rejects.toThrow(
    "cannot verify flow references because task broken.yaml is unreadable",
  );
  await expect(
    loadFlowDocument({ workspaceRoot, path: "stable.yaml" }),
  ).resolves.toMatchObject({ flowID: "flow_stable" });
});
