import { WorkflowExecutionScheduler } from "./workflow-execution-scheduler";

export type WorkflowSchedulerOptions = ConstructorParameters<
  typeof WorkflowExecutionScheduler
>[0];

/** Constructs the process-scoped framework scheduler directly. */
export function createWorkflowSchedulerHost(
  options: WorkflowSchedulerOptions = {},
) {
  const scheduler = new WorkflowExecutionScheduler(options);
  let closed = false;
  return {
    scheduler,
    close: async () => {
      if (closed) return;
      closed = true;
      await scheduler.dispose();
    },
  };
}
