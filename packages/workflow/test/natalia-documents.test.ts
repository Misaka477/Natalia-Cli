import { expect, test } from "bun:test";
import {
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
