import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CapabilityHost } from "@natalia/capability";
import { configV2Schema } from "@natalia/contracts";
import { NataliaTaskStateStore } from "@natalia/workflow";
import { CapabilityExecutionHost } from "../src/capability-execution-host";
import { WorkflowExecutionScheduler } from "../src/workflow-execution-scheduler";

function loadTask(host: CapabilityHost, cleanup: string[] = []) {
  host.load(
    {
      id: "doctor",
      name: "Doctor",
      version: "1",
      scope: "workspace",
      grants: ["workflows"],
    },
    (capability) => {
      capability.contribute("workflows", "doctor-flow", {
        kind: "natalia-flow",
        version: 1,
        flowID: "flow_doctor",
        displayName: "Doctor flow",
        modules: [
          {
            id: "read",
            type: "read_search",
            displayName: "Read",
            minimumConditions: [{ id: "checked", text: "Run doctor" }],
          },
        ],
      });
      capability.contribute("workflows", "doctor-task", {
        kind: "natalia-task",
        version: 1,
        taskID: "task_doctor",
        displayName: "Doctor task",
        schedule: "manual",
        prompt: "/doctor",
        permissionProfile: "auto",
        flow: { flowID: "flow_doctor" },
      });
      capability.onUnload(() => cleanup.push("doctor"));
    },
  );
}

test("queued capability work revalidates after the scheduler gates", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cap-execution-queued-"));
  const capabilities = new CapabilityHost({ workspaceRoot: root });
  loadTask(capabilities);
  const scheduler = new WorkflowExecutionScheduler({ globalConcurrency: 1 });
  let release!: () => void;
  const blocker = scheduler.schedule({
    workspaceRoot: root,
    run: async () => new Promise<void>((done) => (release = done)),
  });
  const executions = new CapabilityExecutionHost(capabilities, { scheduler });
  const queued = executions.runTask({
    workspaceRoot: root,
    taskID: "task_doctor",
    config: configV2Schema.parse({ version: 2 }),
  });

  await Bun.sleep(0);
  capabilities.unloadScope("workspace");
  release();
  await blocker.result;
  await expect(queued.result).rejects.toThrow(
    "natalia task not found: task_doctor",
  );
  const state = await NataliaTaskStateStore.open(root);
  expect(state.invocations("task_doctor")).toEqual([]);
  state.close();
});

test("started execution leases capability cleanup and streams controller output", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cap-execution-lease-"));
  const cleanup: string[] = [];
  const capabilities = new CapabilityHost({ workspaceRoot: root });
  loadTask(capabilities, cleanup);
  const executions = new CapabilityExecutionHost(capabilities);
  const handle = executions.runTask({
    workspaceRoot: root,
    taskID: "task_doctor",
    config: configV2Schema.parse({ version: 2 }),
  });
  const output: string[] = [];
  const resolved: string[] = [];
  let hiddenDuringRun = false;
  const consume = (async () => {
    for await (const event of handle.events) {
      if (event.type === "workflow.execution.resolved") {
        resolved.push(
          `${event.taskID}/${event.flowID}/${event.source.kind}/${event.executionID}`,
        );
        continue;
      }
      if (event.type !== "workflow.execution.output") continue;
      output.push(event.line);
      if (!event.line.includes('"kind":"flow.module_activated"')) continue;
      capabilities.unload("doctor");
      hiddenDuringRun = !capabilities.has("doctor");
      expect(cleanup).toEqual([]);
    }
  })();

  const result = await handle.result;
  await consume;
  expect(result.status).toBe("stalled");
  expect(resolved).toEqual([
    `task_doctor/flow_doctor/capability/${handle.executionID}`,
  ]);
  expect(hiddenDuringRun).toBe(true);
  expect(output.some((line) => line.includes('"taskID":"task_doctor"'))).toBe(
    true,
  );
  expect(cleanup).toEqual(["doctor"]);
});

test("execution host refuses a workspace owned by another capability host", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cap-execution-root-"));
  const capabilities = new CapabilityHost({ workspaceRoot: root });
  const executions = new CapabilityExecutionHost(capabilities);
  expect(() =>
    executions.runTask({
      workspaceRoot: join(root, "other"),
      taskID: "task_missing",
      config: configV2Schema.parse({ version: 2 }),
    }),
  ).toThrow("belongs to another workspace");
});
