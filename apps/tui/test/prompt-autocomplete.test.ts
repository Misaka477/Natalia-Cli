import { expect, test } from "bun:test";
import {
  mentionAutocompleteQuery,
  slashAutocompleteOptions,
  slashAutocompleteQuery,
  workflowAutocompleteQuery,
  workflowCommandKinds,
  workflowDocumentUnavailableReason,
  workflowRunRequest,
} from "../src/component/PromptAutocomplete";

test("slash autocomplete only activates for a single leading command token", () => {
  expect(slashAutocompleteQuery("/mod")).toBe("mod");
  expect(slashAutocompleteQuery(" /mod")).toBeUndefined();
  expect(slashAutocompleteQuery("/mod alpha")).toBeUndefined();
});

test("workflow autocomplete recognizes task and flow arguments", () => {
  expect(workflowAutocompleteQuery("/task ")).toEqual({
    kind: "task",
    query: "",
  });
  expect(workflowAutocompleteQuery("/flow Code")).toEqual({
    kind: "flow",
    query: "code",
  });
  expect(workflowAutocompleteQuery("/task")).toBeUndefined();
  expect(workflowAutocompleteQuery(" /flow review")).toBeUndefined();
  expect(workflowRunRequest("/task nightly.yaml")).toEqual({
    kind: "task",
    path: "nightly.yaml",
  });
  expect(workflowRunRequest("/flow ")).toBeUndefined();
  expect(
    workflowCommandKinds(
      [
        {
          kind: "task",
          path: "nightly.yaml",
          id: "task_nightly",
          displayName: "Nightly",
          source: { kind: "workspace" },
          launch: { ready: true },
        },
      ],
      "",
    ),
  ).toEqual(["task"]);
  expect(workflowCommandKinds([], "")).toEqual([]);
});

test("workflow launch readiness carries the host reason into autocomplete", () => {
  expect(
    workflowDocumentUnavailableReason({
      kind: "flow",
      path: "cap:review/flow_review.yaml",
      id: "flow_review",
      displayName: "Review",
      source: { kind: "capability", capabilityID: "review" },
      launch: { ready: false, reason: "direct run is not configured" },
    }),
  ).toBe("direct run is not configured");
});

test("file mention autocomplete only activates at an @ token boundary", () => {
  expect(mentionAutocompleteQuery("@src/mod")).toBe("src/mod");
  expect(mentionAutocompleteQuery("review @src/mod")).toBe("src/mod");
  expect(mentionAutocompleteQuery("mail@example.com")).toBeUndefined();
  expect(mentionAutocompleteQuery("@src/mod more")).toBeUndefined();
});

test("slash autocomplete filters the shared runtime command vocabulary", () => {
  expect(
    slashAutocompleteOptions("/mod").map((command) => command.name),
  ).toEqual(expect.arrayContaining(["model", "models"]));
  expect(slashAutocompleteOptions("/does-not-exist")).toEqual([]);
  expect(
    slashAutocompleteOptions("/skill-r").map((command) => command.name),
  ).toContain("skill-resource");
  expect(
    slashAutocompleteOptions("/edi").map((command) => command.name),
  ).toContain("editor");
});
