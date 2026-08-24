import type { CapabilityHost } from "@natalia/capability";
import {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type CapabilityTaskExecutionRequest,
  type TaskRunResult,
  type TaskWorkflowService,
} from "@natalia/runtime-services";
import type {
  WorkflowExecutionHandle,
  WorkflowExecutionSchedulerService,
} from "@natalia/workflow";

export type { CapabilityTaskExecutionRequest } from "@natalia/runtime-services";

export class CapabilityExecutionHost {
  constructor(
    private readonly capabilities: CapabilityHost,
    private readonly options: {
      scheduler: WorkflowExecutionSchedulerService;
      resolveService: <T>(serviceID: string) => Promise<T | undefined>;
    },
  ) {}

  async runTask(
    request: CapabilityTaskExecutionRequest,
  ): Promise<WorkflowExecutionHandle<TaskRunResult>> {
    const taskWorkflowService =
      await this.options.resolveService<TaskWorkflowService>(
        TASK_WORKFLOW_CONTROLLER_SERVICE,
      );
    if (!taskWorkflowService)
      throw new Error("task workflow service unavailable");
    return taskWorkflowService.runCapabilityTask({
      capabilities: this.capabilities,
      scheduler: this.options.scheduler,
      request,
    });
  }
}
