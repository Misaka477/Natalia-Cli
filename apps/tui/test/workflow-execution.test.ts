import { expect, test } from "bun:test";
import type { WorkflowExecutionEvent } from "@natalia/client";
import { runCapabilityWorkflowTask } from "../src/app/App";

async function* workflowEvents(): AsyncIterable<WorkflowExecutionEvent> {
  yield {
    type: "workflow.execution",
    executionID: "exe_test",
    workspaceRoot: "/workspace",
    status: "queued",
    at: "2026-08-12T00:00:00.000Z",
  };
  yield {
    type: "workflow.execution.output",
    executionID: "exe_test",
    workspaceRoot: "/workspace",
    line: JSON.stringify({
      type: "content.delta",
      id: "turn_workflow",
      text: "Doctor output",
    }),
    at: "2026-08-12T00:00:01.000Z",
  };
  yield {
    type: "workflow.execution",
    executionID: "exe_test",
    workspaceRoot: "/workspace",
    status: "completed",
    at: "2026-08-12T00:00:02.000Z",
  };
}

test("TUI capability workflow consumes output and exposes cancellation", async () => {
  const dispatched: Record<string, unknown>[] = [];
  let active:
    | { cancel(reason?: string): void; executionID: string }
    | undefined;
  let cancelled: string | undefined;
  const outcome = await runCapabilityWorkflowTask({
    backend: {
      start() {},
      async submit(text) {
        return {
          type: "turn.submitted",
          id: "turn_test",
          text,
          byteLength: text.length,
          lineCount: 1,
          sha256: "test",
        };
      },
      cancel() {},
      snapshot: () => ({ type: "snapshot.created", id: "snap", files: [] }),
      diagnostic() {},
      lastSubmission: () => undefined,
      respondApproval: () => ({ accepted: true }),
      respondQuestion: () => ({ accepted: true }),
      runWorkflowTask() {
        return {
          executionID: "exe_test",
          events: workflowEvents(),
          result: Promise.resolve({
            invocationID: "inv_test",
            status: "stalled",
            waterlineAdvanced: false,
            exitCode: 0,
          }),
          cancel(reason) {
            cancelled = reason;
          },
        };
      },
    },
    path: "cap:doctor/task_doctor.yaml",
    workspaceRoot: "/workspace",
    sessionID: "ses_test",
    setActive(handle) {
      active = handle;
    },
    onEvent(event) {
      dispatched.push(event);
    },
  });

  expect(active?.executionID).toBe("exe_test");
  active?.cancel("operator cancelled");
  expect(cancelled).toBe("operator cancelled");
  expect(dispatched).toEqual([
    expect.objectContaining({ type: "content.delta", text: "Doctor output" }),
  ]);
  expect(outcome).toEqual({
    ok: true,
    status: "stalled",
    message: "task cap:doctor/task_doctor.yaml: stalled",
  });
});
