import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  NataliaDocumentStore,
  parseNataliaDocumentJSON,
  parseNataliaDocumentYAML,
  parseWorkflowYAML,
} from "../src";

test("parses a versioned natalia flow YAML document", () => {
  const document = parseNataliaDocumentYAML(`
kind: natalia-flow
version: 1
flowID: flow_review
displayName: Review changes
modules:
  - id: read
    type: read_search
    displayName: Read & Search
    minimumConditions:
      - id: c1
        text: Inspect the changed files
  - id: report
    type: report_output
    displayName: Report
`);
  expect(document).toMatchObject({
    kind: "natalia-flow",
    flowID: "flow_review",
  });
  if (document.kind === "natalia-flow")
    expect(document.modules).toHaveLength(2);
});

test("workspace document store saves task and flow YAML then resolves the reference", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-documents-"));
  const store = new NataliaDocumentStore(root);
  const flow = {
    kind: "natalia-flow" as const,
    version: 1,
    flowID: "flow_review",
    displayName: "Review",
    modules: [
      { id: "read", type: "read_search" as const, displayName: "Read" },
    ],
  };
  await store.saveFlow(flow, "review.yaml");
  const task = {
    kind: "natalia-task" as const,
    version: 1,
    taskID: "task_review",
    displayName: "Task",
    schedule: "daily 01:00",
    prompt: "Review.",
    permissionProfile: "unattended",
    flow: { path: ".natalia/flows/review.yaml", flowID: "flow_review" },
    retry: "none" as const,
    alerts: [],
  };
  const taskPath = await store.saveTask(task);
  expect(await store.loadTask(taskPath)).toMatchObject({
    taskID: "task_review",
  });
  expect(await store.resolveTaskFlow(task)).toMatchObject({
    flowID: "flow_review",
  });
  expect(await readFile(taskPath, "utf8")).toContain("kind: natalia-task");
});

test("workspace document store fails closed for missing, escaped, and mismatched flow references", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-documents-invalid-"));
  const store = new NataliaDocumentStore(root);
  const task = {
    kind: "natalia-task" as const,
    version: 1,
    taskID: "task_missing",
    displayName: "Missing",
    schedule: "daily 01:00",
    prompt: "Review.",
    permissionProfile: "unattended",
    flow: { path: ".natalia/flows/missing.yaml", flowID: "flow_expected" },
    retry: "none" as const,
    alerts: [],
  };
  await expect(store.resolveTaskFlow(task)).rejects.toThrow(
    "natalia document not found",
  );
  await expect(store.loadFlow("../outside.yaml")).rejects.toThrow(
    "must stay under",
  );
  await store.saveFlow(
    {
      kind: "natalia-flow",
      version: 1,
      flowID: "different",
      displayName: "Different",
      modules: [{ id: "read", type: "read_search", displayName: "Read" }],
    },
    "different.yaml",
  );
  await expect(
    store.resolveTaskFlow({
      ...task,
      flow: { path: ".natalia/flows/different.yaml", flowID: "flow_expected" },
    }),
  ).rejects.toThrow("flow reference mismatch");
});

test("an editor can load a task with a broken flow, while execution reads fail closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-documents-edit-broken-"));
  const store = new NataliaDocumentStore(root);
  await store.saveTask({
    kind: "natalia-task",
    version: 1,
    taskID: "task_broken",
    displayName: "Broken draft",
    schedule: "daily 01:00",
    prompt: "Repair this task.",
    permissionProfile: "unattended",
    flow: { path: ".natalia/flows/missing.yaml", flowID: "flow_missing" },
    retry: "none",
    alerts: [],
  });
  await expect(store.loadTask("task_broken.yaml")).rejects.toThrow(
    "natalia document not found",
  );
  // The editor needs the document's own fields to repair this reference; it
  // cannot do that if the read path eagerly applies execution validation.
  await expect(
    store.loadTaskDocument("task_broken.yaml"),
  ).resolves.toMatchObject({
    taskID: "task_broken",
    flow: { flowID: "flow_missing" },
  });
});

test("parses a versioned natalia task document", () => {
  expect(
    parseNataliaDocumentJSON(
      JSON.stringify({
        kind: "natalia-task",
        version: 1,
        taskID: "task_nightly",
        displayName: "Nightly review",
        schedule: "daily 01:00",
        prompt: "Review changes.",
        permissionProfile: "unattended",
        flow: { path: ".natalia/flows/review.yaml", flowID: "flow_review" },
      }),
    ),
  ).toMatchObject({ kind: "natalia-task", retry: "none", alerts: [] });
});

test("rejects unknown major versions, kinds, and duplicate flow module IDs", () => {
  expect(() =>
    parseNataliaDocumentYAML("kind: natalia-flow\nversion: 2\n"),
  ).toThrow("unsupported natalia-flow major version");
  expect(() =>
    parseNataliaDocumentYAML("kind: workflow\nversion: 1\n"),
  ).toThrow("unsupported natalia document kind");
  expect(() =>
    parseNataliaDocumentYAML(`
kind: natalia-flow
version: 1
flowID: flow
displayName: Flow
modules:
  - id: read
    type: read_search
    displayName: Read
  - id: read
    type: report_output
    displayName: Report
`),
  ).toThrow("duplicate flow module id");
});

test("new document parsing does not alter legacy WorkflowDocument YAML", () => {
  expect(
    parseWorkflowYAML(
      "version: 1\nname: legacy\nsteps:\n  - id: result\n    kind: set\n    key: done\n    value: yes\n",
    ),
  ).toEqual({
    version: 1,
    name: "legacy",
    description: undefined,
    steps: [{ id: "result", kind: "set", key: "done", value: "yes" }],
  });
});
