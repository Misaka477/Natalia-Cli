import type { CapabilityHost } from "@natalia/capability";
import type {
  CapabilityTaskExecutionRequest,
  TaskRunResult,
  TaskWorkflowService,
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
      taskWorkflowService: TaskWorkflowService;
    },
  ) {}

  runTask(
    request: CapabilityTaskExecutionRequest,
  ): WorkflowExecutionHandle<TaskRunResult> {
    return this.options.taskWorkflowService.runCapabilityTask({
      capabilities: this.capabilities,
      scheduler: this.options.scheduler,
      request,
    });
  }
}
