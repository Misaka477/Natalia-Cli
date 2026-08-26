export { createTaskWorkflowController } from "./task-workflow-controller";
export {
  type TaskRuntimeClientFactory,
  type TaskRuntimeClientOptions,
} from "./task-execution-service";
export {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_PLUGIN_ID,
  TASK_WORKFLOW_PLUGIN_MANIFEST,
} from "./task-workflow-plugin";
export {
  createWorkflowExecutionStoreService,
  createWorkflowStoreService,
  type TaskAlertQueueService,
  type TaskStateService,
  type WorkflowExecutionStoreService,
  type WorkflowStoreService,
} from "@natalia/workflow";
import type { Plugin, PluginAPI } from "@natalia/plugin";
import {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_PLUGIN_MANIFEST,
} from "./task-workflow-plugin";
import { createTaskWorkflowController } from "./task-workflow-controller";

export const TASK_WORKFLOW_INPUT_SERVICE = "task-workflow.input";
export type TaskWorkflowRuntimeInput = Parameters<
  typeof createTaskWorkflowController
>[0];

export default function taskWorkflowPlugin(): Plugin {
  let instance: Plugin | undefined;
  return {
    manifest: {
      ...TASK_WORKFLOW_PLUGIN_MANIFEST,
      entry: "index.js",
      requires: [TASK_WORKFLOW_INPUT_SERVICE],
    },
    async setup(api: PluginAPI) {
      const input = api.services.get<TaskWorkflowRuntimeInput>(
        TASK_WORKFLOW_INPUT_SERVICE,
      );
      if (!input)
        throw new Error(
          `missing runtime service: ${TASK_WORKFLOW_INPUT_SERVICE}`,
        );
      instance = createTaskWorkflowPlugin(input);
      await instance.setup(api);
    },
    async dispose() {
      await instance?.dispose?.();
      instance = undefined;
    },
  };
}
