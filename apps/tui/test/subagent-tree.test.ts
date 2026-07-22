import { expect, test } from "bun:test";
import { initialState, reduceState } from "../src/context/state";

test("subagent state preserves parent-agent tree provenance", () => {
  const state = reduceState(initialState, {
    type: "subagent.update",
    id: "child",
    status: "running",
    attached: true,
    event: "created",
    task: "child task",
    parentSessionID: "ses_parent",
    parentAgentID: "root",
    continuation: 0,
  });
  expect(state.subagents.child?.parentAgentID).toBe("root");
  expect(state.subagents.child?.parentSessionID).toBe("ses_parent");
});

test("workflow lifecycle projects to one stable TUI block per run", () => {
  let state = reduceState(initialState, {
    type: "workflow.update",
    runID: "wf_tui",
    workflow: "build",
    status: "running",
    event: "step_started",
    stepID: "compile",
  });
  state = reduceState(state, {
    type: "workflow.update",
    runID: "wf_tui",
    workflow: "build",
    status: "completed",
    event: "run_completed",
  });
  const block = state.messages.find((item) => item.id === "workflow:wf_tui");
  expect(block?.text).toContain("Workflow build · completed");
  expect(block?.text).toContain("run_completed");
});

test("submitted turns render safe attachment metadata without private paths", () => {
  const state = reduceState(initialState, {
    type: "turn.submitted",
    id: "turn_attachment",
    text: "inspect",
    byteLength: 7,
    lineCount: 1,
    sha256: "hash",
    attachments: [
      {
        id: "att_test",
        path: ".natalia/attachments/att_test-image.png",
        filename: "image.png",
        mediaType: "image/png",
        byteLength: 8,
        sha256: "attachment-hash",
      },
    ],
  });
  const message = state.messages.find(
    (item) => item.id === "turn_attachment:user",
  );
  expect(message?.text).toContain(
    "Attachments: image.png (image/png, 8 bytes)",
  );
  expect(message?.text).not.toContain(".natalia/attachments");
});

test("diagnostic events render their safe level and message", () => {
  const state = reduceState(initialState, {
    type: "diagnostic",
    level: "warning",
    message: "safe diagnostic",
    at: "2026-07-22T00:00:00.000Z",
  });
  expect(state.messages.at(-1)?.text).toBe("warning: safe diagnostic");
});
