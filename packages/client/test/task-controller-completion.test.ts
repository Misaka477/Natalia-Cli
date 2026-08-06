import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  moduleCompletionOperationProblem,
  newModuleCompletionOperations,
  trackModuleCompletionOperation,
} from "../src/task-controller";

const tool = (
  status: Extract<RuntimeEvent, { type: "tool.update" }>["status"],
): RuntimeEvent => ({
  type: "tool.update",
  id: "turn_1",
  callID: "call_1",
  name: "read_file",
  status,
  summary: status,
});

const terminal = (
  status: Extract<RuntimeEvent, { type: "terminal.update" }>["status"],
): RuntimeEvent => ({
  type: "terminal.update",
  id: "pane_1",
  command: "bash",
  cwd: "/workspace",
  status,
  attached: true,
  rows: 24,
  cols: 80,
  activity: status === "running" ? "running" : "waiting",
  tail: "",
  target: { kind: "host", cwd: "/workspace" },
});

test("module completion waits for tools and terminals to reach stable states", () => {
  const operations = newModuleCompletionOperations();
  for (const status of [
    "receiving_arguments",
    "queued",
    "awaiting_approval",
    "running",
  ] as const) {
    trackModuleCompletionOperation(operations, tool(status));
    expect(moduleCompletionOperationProblem(operations)).toContain(
      `tool read_file (call_1) is ${status}`,
    );
  }
  trackModuleCompletionOperation(operations, tool("succeeded"));
  expect(moduleCompletionOperationProblem(operations)).toBeUndefined();

  trackModuleCompletionOperation(operations, terminal("starting"));
  expect(moduleCompletionOperationProblem(operations)).toContain(
    "terminal pane_1 is starting",
  );
  trackModuleCompletionOperation(operations, terminal("running"));
  expect(moduleCompletionOperationProblem(operations)).toContain(
    "terminal pane_1 is running",
  );
  trackModuleCompletionOperation(operations, terminal("waiting"));
  expect(moduleCompletionOperationProblem(operations)).toBeUndefined();
});

test("module completion waits for generic and terminal approval responses", () => {
  const operations = newModuleCompletionOperations();
  trackModuleCompletionOperation(operations, {
    type: "approval.request",
    id: "approval_tool",
    title: "Read",
    preview: "file",
  });
  trackModuleCompletionOperation(operations, {
    type: "terminal.approval",
    id: "pane_1",
    approvalID: "approval_terminal",
    state: "awaiting",
    action: "submit",
    reason: "high risk",
    target: { kind: "host", cwd: "/workspace" },
  });
  expect(moduleCompletionOperationProblem(operations)).toContain(
    "approval approval_tool is awaiting a response",
  );
  expect(moduleCompletionOperationProblem(operations)).toContain(
    "approval approval_terminal is awaiting a response",
  );
  trackModuleCompletionOperation(operations, {
    type: "approval.response",
    id: "approval_tool",
    decision: "once",
  });
  trackModuleCompletionOperation(operations, {
    type: "terminal.approval",
    id: "pane_1",
    approvalID: "approval_terminal",
    state: "approved",
    action: "submit",
    reason: "confirmed",
    target: { kind: "host", cwd: "/workspace" },
  });
  expect(moduleCompletionOperationProblem(operations)).toBeUndefined();
});
