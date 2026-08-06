import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFlowDocument, saveFlowDocument } from "../src";

test("flow document editor APIs atomically save and reload a stable definition", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-flow-editor-"));
  const flow = {
    kind: "natalia-flow" as const,
    version: 1,
    flowID: "flow_stable",
    displayName: "Nightly review",
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
