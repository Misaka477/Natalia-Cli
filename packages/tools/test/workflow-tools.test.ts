import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { createToolRegistry } from "../src";

test("workflow_run executes a valid JSON workflow", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-wf-run-"));
  const tools = createToolRegistry();
  const doc = JSON.stringify({
    version: 1,
    name: "test-json",
    steps: [
      { id: "s1", kind: "set", key: "msg", value: "hello" },
      {
        id: "s2",
        kind: "tool",
        tool: "write_file",
        arguments: { path: "out.txt", content: "{{msg}}" },
      },
    ],
  });
  const result = JSON.parse(
    await tools
      .get("workflow_run")!
      .execute({ workflow: doc }, { workspaceRoot: root }),
  ) as { id: string; status: string; values: Record<string, string> };
  expect(result.status).toBe("completed");
  expect(result.values["msg"]).toBe("hello");
  expect(await readFile(join(root, "out.txt"), "utf8")).toBe("hello");
});

test("workflow_run projects every durable workflow lifecycle event", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workflow-events-"));
  const events: Array<{ event: string; status: string; stepID?: string }> = [];
  const tools = createToolRegistry();
  await tools.get("workflow_run")!.execute(
    {
      workflow: JSON.stringify({
        version: 1,
        name: "events",
        steps: [{ id: "set", kind: "set", key: "a", value: "b" }],
      }),
    },
    {
      workspaceRoot: root,
      onWorkflowEvent(event) {
        events.push({
          event: event.event,
          status: event.status,
          stepID: event.stepID,
        });
      },
    },
  );
  expect(events).toEqual([
    { event: "run_started", status: "running", stepID: undefined },
    { event: "step_started", status: "running", stepID: "set" },
    { event: "step_completed", status: "running", stepID: "set" },
    { event: "run_completed", status: "completed", stepID: undefined },
  ]);
});

test("workflow_run executes a valid YAML workflow", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-wf-yaml-"));
  const tools = createToolRegistry();
  const yaml = `version: 1
name: test-yaml
steps:
  - id: s1
    kind: set
    key: result
    value: yaml-ok
  - id: s2
    kind: tool
    tool: write_file
    arguments:
      path: done.txt
      content: "{{result}}"
`;
  const result = JSON.parse(
    await tools
      .get("workflow_run")!
      .execute({ workflow: yaml }, { workspaceRoot: root }),
  ) as { status: string; values: Record<string, string> };
  expect(result.status).toBe("completed");
  expect(result.values["result"]).toBe("yaml-ok");
  expect(await readFile(join(root, "done.txt"), "utf8")).toBe("yaml-ok");
});

test("workflow_run with custom runID supports resumption", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-wf-resume-"));
  const tools = createToolRegistry();
  const doc = JSON.stringify({
    version: 1,
    name: "resume-test",
    steps: [
      { id: "a", kind: "set", key: "x", value: "1" },
      { id: "b", kind: "set", key: "y", value: "2" },
    ],
  });

  const run1 = JSON.parse(
    await tools
      .get("workflow_run")!
      .execute(
        { workflow: doc, runID: "wf_resume_test" },
        { workspaceRoot: root },
      ),
  ) as { events: Array<{ type: string }> };
  const initialCompleted = run1.events.filter(
    (e) => e.type === "step_completed",
  ).length;

  const run2 = JSON.parse(
    await tools
      .get("workflow_run")!
      .execute(
        { workflow: doc, runID: "wf_resume_test" },
        { workspaceRoot: root },
      ),
  ) as {
    status: string;
    events: Array<{ type: string }>;
    completedStepIDs: string[];
  };
  expect(run2.status).toBe("completed");
  expect(run2.completedStepIDs).toContain("a");
  expect(run2.completedStepIDs).toContain("b");
  const resumedCompleted = run2.events.filter(
    (e) => e.type === "step_completed",
  ).length;
  expect(resumedCompleted).toBe(initialCompleted);
});

test("workflow_status returns run summary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-wf-status-"));
  const tools = createToolRegistry();
  const doc = JSON.stringify({
    version: 1,
    name: "status-test",
    steps: [{ id: "x", kind: "set", key: "a", value: "b" }],
  });

  await tools
    .get("workflow_run")!
    .execute(
      { workflow: doc, runID: "wf_status_test" },
      { workspaceRoot: root },
    );

  const status = JSON.parse(
    await tools
      .get("workflow_status")!
      .execute({ runID: "wf_status_test" }, { workspaceRoot: root }),
  ) as {
    status: string;
    completedStepIDs: string[];
    eventCount: number;
    lastEvent: string;
  };
  expect(status.status).toBe("completed");
  expect(status.completedStepIDs).toEqual(["x"]);
  expect(status.eventCount).toBeGreaterThanOrEqual(3);
  expect(status.lastEvent).toBe("run_completed");
});

test("workflow_status returns unknown for nonexistent run", async () => {
  const tools = createToolRegistry();
  const status = JSON.parse(
    await tools
      .get("workflow_status")!
      .execute({ runID: "wf_nonexistent" }, { workspaceRoot: tmpdir() }),
  ) as { status: string; events: unknown[] };
  expect(status.status).toBe("unknown");
  expect(status.events).toEqual([]);
});

test("workflow_events returns event journal", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-wf-events-"));
  const tools = createToolRegistry();
  const doc = JSON.stringify({
    version: 1,
    name: "events-test",
    steps: [{ id: "e", kind: "set", key: "k", value: "v" }],
  });

  await tools
    .get("workflow_run")!
    .execute(
      { workflow: doc, runID: "wf_events_test" },
      { workspaceRoot: root },
    );

  const events = JSON.parse(
    await tools
      .get("workflow_events")!
      .execute({ runID: "wf_events_test" }, { workspaceRoot: root }),
  ) as Array<{ type: string; runID: string }>;
  expect(Array.isArray(events)).toBe(true);
  expect(events.length).toBeGreaterThanOrEqual(3);
  expect(events[0]!.type).toBe("run_started");
  expect(events[events.length - 1]!.type).toBe("run_completed");
});

test("workflow_events returns empty array for nonexistent run", async () => {
  const tools = createToolRegistry();
  const events = JSON.parse(
    await tools
      .get("workflow_events")!
      .execute({ runID: "wf_events_nope" }, { workspaceRoot: tmpdir() }),
  ) as unknown[];
  expect(events).toEqual([]);
});

test("workflow_run respects abort signal for cancellation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-wf-abort-"));
  const tools = createToolRegistry();
  const controller = new AbortController();
  const doc = JSON.stringify({
    version: 1,
    name: "cancel-test",
    steps: [
      { id: "init", kind: "set", key: "started", value: "yes" },
      {
        id: "long",
        kind: "tool",
        tool: "run_shell",
        arguments: { command: "sleep 30" },
      },
    ],
  });

  setTimeout(() => controller.abort(), 10);
  const result = JSON.parse(
    await tools
      .get("workflow_run")!
      .execute(
        { workflow: doc, runID: "wf_abort_test" },
        { workspaceRoot: root, signal: controller.signal },
      ),
  ) as { status: string; values: Record<string, string> };
  expect(result.status).toBe("cancelled");
  expect(result.values["started"]).toBe("yes");
});

test("workflow_run rejects invalid workflow document", async () => {
  const tools = createToolRegistry();
  await expect(
    tools
      .get("workflow_run")!
      .execute(
        { workflow: '{"version": 2, "name": "bad", "steps": []}' },
        { workspaceRoot: tmpdir() },
      ),
  ).rejects.toThrow("expected version");
  await expect(
    tools
      .get("workflow_run")!
      .execute({ workflow: '{"steps":[]}' }, { workspaceRoot: tmpdir() }),
  ).rejects.toThrow("Minimal JSON example");
});

test("workflow_run rejects non-string workflow input", async () => {
  const tools = createToolRegistry();
  await expect(
    tools
      .get("workflow_run")!
      .execute({ workflow: 42 }, { workspaceRoot: tmpdir() }),
  ).rejects.toThrow("workflow must be a string");
});
