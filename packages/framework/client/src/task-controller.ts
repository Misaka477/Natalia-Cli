import type {
  TaskRunInput,
  TaskRunFromDocumentInput,
  TaskWorkflowService,
} from "@natalia/runtime-services";
import {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type RuntimeServiceClient,
} from "@natalia/runtime-services";
import { createRealRuntimeClient } from "./runtime/main";

async function withService<T>(
  input: { workspaceRoot: string; pluginStoreRoot?: string },
  operation: (service: TaskWorkflowService) => Promise<T>,
) {
  const client: RuntimeServiceClient = createRealRuntimeClient({
    workspaceRoot: input.workspaceRoot,
    pluginStoreRoot: input.pluginStoreRoot,
  });
  try {
    const service = await client.service<TaskWorkflowService>(
      TASK_WORKFLOW_CONTROLLER_SERVICE,
    );
    if (!service) throw new Error("task workflow service unavailable");
    return await operation(service);
  } finally {
    await client.dispose?.();
  }
}

export function runTaskFromDocument(
  input: TaskRunFromDocumentInput & { pluginStoreRoot?: string },
) {
  return withService(input, (service) => service.runTaskFromDocument(input));
}

export function runTask(input: TaskRunInput & { pluginStoreRoot?: string }) {
  return withService(input, (service) => service.runTask(input));
}

export const taskPermissionPreviewForDocument = (
  input: Parameters<
    TaskWorkflowService["taskPermissionPreviewForDocument"]
  >[0] & {
    pluginStoreRoot?: string;
  },
) =>
  withService(input, (service) =>
    service.taskPermissionPreviewForDocument(input),
  );

export type {
  HeadlessExecution,
  TaskRunResult,
} from "@natalia/runtime-services";
