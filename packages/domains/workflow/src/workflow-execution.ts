export type WorkflowExecutionStatus =
  | "queued"
  | "starting"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowExecutionEvent =
  | {
      type: "workflow.execution";
      executionID: string;
      workspaceRoot: string;
      status: WorkflowExecutionStatus;
      at: string;
      reason?: string;
    }
  | {
      type: "workflow.execution.output";
      executionID: string;
      workspaceRoot: string;
      line: string;
      at: string;
    }
  | {
      type: "workflow.execution.resolved";
      executionID: string;
      workspaceRoot: string;
      taskID: string;
      flowID: string;
      source:
        | { kind: "workspace" }
        | { kind: "capability"; capabilityIDs: string[] };
      requestedBy?: {
        transport: "local" | "worker" | "http";
        sessionID?: string;
        credentialID?: string;
      };
      at: string;
    };

export type WorkflowExecutionHandle<T> = {
  executionID: string;
  events: AsyncIterable<WorkflowExecutionEvent>;
  result: Promise<T>;
  cancel(reason?: string): void;
};

export interface WorkflowExecutionSchedulerService {
  schedule<T>(input: {
    workspaceRoot: string;
    executionID?: string;
    idempotencyKey?: string;
    idempotencyFingerprint?: string;
    run: (input: {
      signal: AbortSignal;
      publishOutput(line: string): void;
      publishResolved(input: {
        taskID: string;
        flowID: string;
        source: WorkflowExecutionResolvedEvent["source"];
        requestedBy?: WorkflowExecutionResolvedEvent["requestedBy"];
      }): void;
    }) => Promise<T>;
  }): WorkflowExecutionHandle<T>;
  dispose(reason?: string): Promise<void>;
}

export type WorkflowExecutionResolvedEvent = Extract<
  WorkflowExecutionEvent,
  { type: "workflow.execution.resolved" }
>;

/** Small transport-neutral async stream used by scheduler and worker channels. */
export class WorkflowExecutionEventStream
  implements AsyncIterable<WorkflowExecutionEvent>
{
  private readonly buffered: WorkflowExecutionEvent[] = [];
  private readonly waiting: Array<
    (value: IteratorResult<WorkflowExecutionEvent>) => void
  > = [];
  private closed = false;

  publish(event: WorkflowExecutionEvent) {
    if (this.closed) return;
    const next = this.waiting.shift();
    if (next) next({ done: false, value: event });
    else this.buffered.push(event);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const next of this.waiting.splice(0))
      next({ done: true, value: undefined });
  }

  [Symbol.asyncIterator](): AsyncIterator<WorkflowExecutionEvent> {
    return {
      next: () => {
        const event = this.buffered.shift();
        if (event) return Promise.resolve({ done: false, value: event });
        if (this.closed)
          return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolveNext) => this.waiting.push(resolveNext));
      },
    };
  }
}
