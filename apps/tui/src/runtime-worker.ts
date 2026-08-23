import { workerData } from "node:worker_threads";
import {
  assertConfigApplied,
  attachRuntimeClientWorker,
  CapabilityExecutionHost,
  createRealRuntimeClient,
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type TaskWorkflowService,
} from "@natalia/client";
import { createWorkflowSchedulerPluginHost } from "@natalia/workflow-scheduler-plugin";
import { CapabilityHost } from "@natalia/capability";
import { resolveConfig } from "@natalia/config";

const input = workerData as {
  port: import("@natalia/client").RuntimeWorkerPort;
  workspaceRoot: string;
  sessionID: string;
};

const capabilityHost = new CapabilityHost({
  workspaceRoot: input.workspaceRoot,
});
const workflowScheduler = await createWorkflowSchedulerPluginHost();
const runtime = createRealRuntimeClient({
  workspaceRoot: input.workspaceRoot,
  sessionID: input.sessionID as never,
  useSqliteStore: true,
  capabilityHost,
});
const taskWorkflowService = await runtime.service<TaskWorkflowService>(
  TASK_WORKFLOW_CONTROLLER_SERVICE,
);
if (!taskWorkflowService) throw new Error("task workflow service unavailable");
const workflowExecution = new CapabilityExecutionHost(capabilityHost, {
  scheduler: workflowScheduler.scheduler,
  taskWorkflowService,
});
const createRuntime = () =>
  createRealRuntimeClient({
    workspaceRoot: input.workspaceRoot,
    sessionID: input.sessionID as never,
    useSqliteStore: true,
    capabilityHost,
  });

try {
  attachRuntimeClientWorker(input.port, runtime, {
    reload: createRuntime,
    workflowExecution,
    workflowConfig: async () =>
      assertConfigApplied(
        await resolveConfig({ workspaceRoot: input.workspaceRoot }),
      ),
    disposeHost: async () => {
      await workflowScheduler.close();
      capabilityHost.dispose();
    },
  });
} catch (error) {
  await workflowScheduler.close();
  capabilityHost.dispose();
  throw error;
}
