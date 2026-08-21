import { workerData } from "node:worker_threads";
import {
  assertConfigApplied,
  attachRuntimeClientWorker,
  CapabilityExecutionHost,
  createWorkflowSchedulerPluginHost,
  createRealRuntimeClient,
} from "@natalia/client";
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
const workflowExecution = new CapabilityExecutionHost(capabilityHost, {
  scheduler: workflowScheduler.scheduler,
});
const createRuntime = () =>
  createRealRuntimeClient({
    workspaceRoot: input.workspaceRoot,
    sessionID: input.sessionID as never,
    useSqliteStore: true,
    capabilityHost,
  });

attachRuntimeClientWorker(input.port, createRuntime(), {
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
