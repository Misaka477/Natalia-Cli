import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CapabilityHost } from "@natalia/capability";
import { configV3Schema } from "@natalia/contracts";
import { NataliaTaskStateStore } from "@natalia/workflow";
import { CapabilityExecutionHost } from "../src/capability-execution-host";
import { createWorkflowSchedulerPluginHost } from "@natalia/workflow-scheduler-plugin";
import { createRealRuntimeClient } from "../src/runtime/main";
import {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type TaskWorkflowService,
} from "@natalia/runtime-services";

async function workflowService(workspaceRoot: string) {
  const runtime = createRealRuntimeClient({ workspaceRoot });
  const service = await runtime.service<TaskWorkflowService>(
    TASK_WORKFLOW_CONTROLLER_SERVICE,
  );
  if (!service) throw new Error("task workflow service unavailable");
  return { runtime, service };
}

function loadTask(host: CapabilityHost) {
  const owner = host.registerOwner({
    id: "doctor",
    name: "Doctor",
    version: "1",
    scope: "workspace",
    grants: ["workflows"],
  });
  owner.contribute("workflows", "doctor-flow", {
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
  owner.contribute("workflows", "doctor-task", {
    kind: "natalia-task",
    version: 1,
    taskID: "task_doctor",
    displayName: "Doctor task",
    schedule: "manual",
    prompt: "/doctor",
    permissionProfile: "auto",
    flow: { flowID: "flow_doctor" },
  });
  return owner;
}

test("queued capability work revalidates after the scheduler gates", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cap-execution-queued-"));
  const capabilities = new CapabilityHost({ workspaceRoot: root });
  const owner = loadTask(capabilities);
  const schedulerHost = await createWorkflowSchedulerPluginHost({
    globalConcurrency: 1,
  });
  const workflow = await workflowService(root);
  try {
    const scheduler = schedulerHost.scheduler;
    let release!: () => void;
    const blocker = scheduler.schedule({
      workspaceRoot: root,
      run: async () => new Promise<void>((done) => (release = done)),
    });
    const executions = new CapabilityExecutionHost(capabilities, {
      scheduler,
      taskWorkflowService: workflow.service,
    });
    const queued = executions.runTask({
      workspaceRoot: root,
      taskID: "task_doctor",
      config: configV3Schema.parse({ version: 3 }),
    });

    await Bun.sleep(0);
    owner.release();
    release();
    await blocker.result;
    await expect(queued.result).rejects.toThrow(
      "natalia task not found: task_doctor",
    );
    const state = await NataliaTaskStateStore.open(root);
    expect(state.invocations("task_doctor")).toEqual([]);
    state.close();
  } finally {
    await workflow.runtime.dispose?.();
    await schedulerHost.close();
  }
});

test("started execution keeps its lease while the owner hides contributions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cap-execution-lease-"));
  const capabilities = new CapabilityHost({ workspaceRoot: root });
  const owner = loadTask(capabilities);
  const schedulerHost = await createWorkflowSchedulerPluginHost();
  const workflow = await workflowService(root);
  try {
    const executions = new CapabilityExecutionHost(capabilities, {
      scheduler: schedulerHost.scheduler,
      taskWorkflowService: workflow.service,
    });
    const handle = executions.runTask({
      workspaceRoot: root,
      taskID: "task_doctor",
      config: configV3Schema.parse({ version: 3 }),
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
        owner.release();
        hiddenDuringRun = !capabilities.has("doctor");
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
  } finally {
    await workflow.runtime.dispose?.();
    await schedulerHost.close();
  }
});

test("execution host refuses a workspace owned by another capability host", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cap-execution-root-"));
  const capabilities = new CapabilityHost({ workspaceRoot: root });
  const schedulerHost = await createWorkflowSchedulerPluginHost();
  const workflow = await workflowService(root);
  try {
    const executions = new CapabilityExecutionHost(capabilities, {
      scheduler: schedulerHost.scheduler,
      taskWorkflowService: workflow.service,
    });
    expect(() =>
      executions.runTask({
        workspaceRoot: join(root, "other"),
        taskID: "task_missing",
        config: configV3Schema.parse({ version: 3 }),
      }),
    ).toThrow("belongs to another workspace");
  } finally {
    await workflow.runtime.dispose?.();
    await schedulerHost.close();
  }
});
