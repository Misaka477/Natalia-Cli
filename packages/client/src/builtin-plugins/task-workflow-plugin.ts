import type { Plugin } from "@natalia/plugin";
import {
  createTaskWorkflowController,
  type TaskWorkflowController,
} from "../task-workflow-controller";

export const TASK_WORKFLOW_PLUGIN_ID = "natalia-task-workflow";
export const TASK_WORKFLOW_CONTROLLER_SERVICE = "task-workflow.controller";

export function createTaskWorkflowPlugin(
  input: Parameters<typeof createTaskWorkflowController>[0],
): Plugin {
  let controller: TaskWorkflowController | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: TASK_WORKFLOW_PLUGIN_ID,
      version: "1.0.0",
      name: "Task Workflow",
      description: "Task and workflow documents, preflight and scheduling.",
      entry: "natalia:task-workflow",
      scope: "workspace",
      provides: [TASK_WORKFLOW_CONTROLLER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      controller = createTaskWorkflowController(input);
      api.services.provide(TASK_WORKFLOW_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller = undefined;
    },
  };
}
