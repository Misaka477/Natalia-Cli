import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configV3Schema,
  nataliaFlowDocumentSchema,
  nataliaTaskDocumentSchema,
} from "@natalia/contracts";
import { NataliaTaskStateStore } from "@natalia/workflow";
import { runTask } from "../src/task-controller";

test("task cancellation reaches a durable terminal invocation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-cancel-"));
  const abort = new AbortController();
  const lines: string[] = [];
  const task = nataliaTaskDocumentSchema.parse({
    kind: "natalia-task" as const,
    version: 1,
    taskID: "task_cancel",
    displayName: "Cancel task",
    schedule: "manual",
    prompt: "/doctor",
    permissionProfile: "auto",
    flow: { flowID: "flow_cancel" },
  });
  const flow = nataliaFlowDocumentSchema.parse({
    kind: "natalia-flow" as const,
    version: 1,
    flowID: "flow_cancel",
    displayName: "Cancel flow",
    modules: [
      {
        id: "read",
        type: "read_search" as const,
        displayName: "Read",
        minimumConditions: [{ id: "checked", text: "Run doctor" }],
      },
    ],
  });

  const result = await runTask({
    workspaceRoot: root,
    task,
    flow,
    config: configV3Schema.parse({ version: 3 }),
    json: true,
    signal: abort.signal,
    emit: (line) => {
      lines.push(line);
      if (line.includes('"kind":"flow.module_activated"'))
        abort.abort(new Error("operator cancelled"));
    },
  });

  expect(result).toMatchObject({ status: "cancelled", exitCode: 1 });
  expect(lines.some((line) => line.includes('"status":"cancelled"'))).toBe(
    true,
  );
  const state = await NataliaTaskStateStore.open(root);
  expect(state.getInvocation(result.invocationID)).toMatchObject({
    status: "cancelled",
    waterlineAdvanced: false,
  });
  expect(state.attempts(result.invocationID)).toMatchObject([
    { status: "cancelled", reason: "operator cancelled" },
  ]);
  state.close();
});

test("a task cancelled before admission creates no durable invocation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-cancel-before-"));
  const abort = new AbortController();
  abort.abort(new Error("cancelled in queue"));
  await expect(
    runTask({
      workspaceRoot: root,
      task: nataliaTaskDocumentSchema.parse({
        kind: "natalia-task",
        version: 1,
        taskID: "task_never_started",
        displayName: "Never started",
        schedule: "manual",
        prompt: "/doctor",
        permissionProfile: "auto",
        flow: { flowID: "flow_never_started" },
      }),
      flow: nataliaFlowDocumentSchema.parse({
        kind: "natalia-flow",
        version: 1,
        flowID: "flow_never_started",
        displayName: "Never started",
        modules: [{ id: "read", type: "read_search", displayName: "Read" }],
      }),
      config: configV3Schema.parse({ version: 3 }),
      json: true,
      signal: abort.signal,
      emit: () => undefined,
    }),
  ).rejects.toThrow("cancelled in queue");
});
