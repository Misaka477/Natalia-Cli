import { resolve } from "node:path";

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

export class WorkflowExecutionRefusal extends Error {
  readonly code: "global_queue_full" | "workspace_queue_full";

  constructor(
    code: "global_queue_full" | "workspace_queue_full",
    message: string,
  ) {
    super(message);
    this.name = "WorkflowExecutionRefusal";
    this.code = code;
  }
}

type ScheduledExecution<T> = {
  executionID: string;
  workspaceRoot: string;
  abort: AbortController;
  stream: ExecutionEventStream;
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
  resolve(value: T): void;
  reject(error: unknown): void;
  started: boolean;
  settled: boolean;
};

/**
 * Process-local admission for workflow executions. The global gate bounds host
 * resources while the workspace gate serializes mutations to one working tree.
 * Queued work is not preflighted here: callers revalidate inside `run`, after
 * both gates are held.
 */
export class WorkflowExecutionScheduler {
  private readonly globalConcurrency: number;
  private readonly workspaceConcurrency: number;
  private readonly globalQueueLimit: number;
  private readonly workspaceQueueLimit: number;
  private globalActive = 0;
  private readonly workspaceActive = new Map<string, number>();
  private readonly waiting: ScheduledExecution<unknown>[] = [];

  constructor(
    options: {
      globalConcurrency?: number;
      workspaceConcurrency?: number;
      globalQueueLimit?: number;
      workspaceQueueLimit?: number;
    } = {},
  ) {
    this.globalConcurrency = positiveInteger(
      options.globalConcurrency ?? 1,
      "globalConcurrency",
    );
    this.workspaceConcurrency = positiveInteger(
      options.workspaceConcurrency ?? 1,
      "workspaceConcurrency",
    );
    this.globalQueueLimit = nonNegativeInteger(
      options.globalQueueLimit ?? 100,
      "globalQueueLimit",
    );
    this.workspaceQueueLimit = nonNegativeInteger(
      options.workspaceQueueLimit ?? 20,
      "workspaceQueueLimit",
    );
  }

  schedule<T>(input: {
    workspaceRoot: string;
    executionID?: string;
    run: ScheduledExecution<T>["run"];
  }): WorkflowExecutionHandle<T> {
    const workspaceRoot = resolve(input.workspaceRoot);
    const executionID =
      input.executionID ?? `exe_${crypto.randomUUID().replace(/-/gu, "")}`;
    if (!/^exe_[a-zA-Z0-9]+$/u.test(executionID))
      throw new Error("workflow execution ID is invalid");
    const stream = new ExecutionEventStream();
    const abort = new AbortController();
    let resolveResult!: (value: T) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<T>((resolvePromise, rejectPromise) => {
      resolveResult = resolvePromise;
      rejectResult = rejectPromise;
    });
    const execution: ScheduledExecution<T> = {
      executionID,
      workspaceRoot,
      abort,
      stream,
      run: input.run,
      resolve: resolveResult,
      reject: rejectResult,
      started: false,
      settled: false,
    };

    if (!this.canStart(workspaceRoot)) this.assertQueueCapacity(workspaceRoot);
    this.waiting.push(execution as ScheduledExecution<unknown>);
    this.publish(execution, { status: "queued" });
    this.drain();

    return {
      executionID,
      events: stream,
      result,
      cancel: (reason = "workflow execution cancelled") => {
        if (execution.settled || abort.signal.aborted) return;
        abort.abort(new Error(reason));
        if (!execution.started) {
          const index = this.waiting.indexOf(
            execution as ScheduledExecution<unknown>,
          );
          if (index >= 0) this.waiting.splice(index, 1);
          execution.settled = true;
          this.publish(execution, { status: "cancelled", reason });
          stream.close();
          rejectResult(abort.signal.reason);
          this.drain();
          return;
        }
        this.publish(execution, { status: "cancelling", reason });
      },
    };
  }

  private assertQueueCapacity(workspaceRoot: string) {
    if (this.waiting.length >= this.globalQueueLimit)
      throw new WorkflowExecutionRefusal(
        "global_queue_full",
        `workflow execution queue is full: ${this.globalQueueLimit}`,
      );
    const workspaceQueued = this.waiting.filter(
      (execution) => execution.workspaceRoot === workspaceRoot,
    ).length;
    if (workspaceQueued >= this.workspaceQueueLimit)
      throw new WorkflowExecutionRefusal(
        "workspace_queue_full",
        `workflow execution queue is full for workspace: ${workspaceRoot}`,
      );
  }

  private canStart(workspaceRoot: string) {
    return (
      this.globalActive < this.globalConcurrency &&
      (this.workspaceActive.get(workspaceRoot) ?? 0) < this.workspaceConcurrency
    );
  }

  private drain() {
    let progressed = true;
    while (progressed && this.globalActive < this.globalConcurrency) {
      progressed = false;
      const index = this.waiting.findIndex((execution) =>
        this.canStart(execution.workspaceRoot),
      );
      if (index < 0) return;
      const [execution] = this.waiting.splice(index, 1);
      if (!execution) return;
      progressed = true;
      this.start(execution);
    }
  }

  private start(execution: ScheduledExecution<unknown>) {
    execution.started = true;
    this.globalActive += 1;
    this.workspaceActive.set(
      execution.workspaceRoot,
      (this.workspaceActive.get(execution.workspaceRoot) ?? 0) + 1,
    );
    this.publish(execution, { status: "starting" });
    queueMicrotask(async () => {
      try {
        execution.abort.signal.throwIfAborted();
        this.publish(execution, { status: "running" });
        const value = await execution.run({
          signal: execution.abort.signal,
          publishOutput: (line) => this.publishOutput(execution, line),
          publishResolved: (resolved) =>
            this.publishResolved(execution, resolved),
        });
        execution.abort.signal.throwIfAborted();
        execution.settled = true;
        this.publish(execution, { status: "completed" });
        execution.resolve(value);
      } catch (error) {
        execution.settled = true;
        const cancelled = execution.abort.signal.aborted;
        this.publish(execution, {
          status: cancelled ? "cancelled" : "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
        execution.reject(error);
      } finally {
        execution.stream.close();
        this.globalActive -= 1;
        const active =
          (this.workspaceActive.get(execution.workspaceRoot) ?? 1) - 1;
        if (active) this.workspaceActive.set(execution.workspaceRoot, active);
        else this.workspaceActive.delete(execution.workspaceRoot);
        this.drain();
      }
    });
  }

  private publish(
    execution: Pick<
      ScheduledExecution<unknown>,
      "executionID" | "workspaceRoot" | "stream"
    >,
    event: { status: WorkflowExecutionStatus; reason?: string },
  ) {
    execution.stream.publish({
      type: "workflow.execution",
      executionID: execution.executionID,
      workspaceRoot: execution.workspaceRoot,
      at: new Date().toISOString(),
      ...event,
    });
  }

  private publishOutput(
    execution: Pick<
      ScheduledExecution<unknown>,
      "executionID" | "workspaceRoot" | "stream"
    >,
    line: string,
  ) {
    execution.stream.publish({
      type: "workflow.execution.output",
      executionID: execution.executionID,
      workspaceRoot: execution.workspaceRoot,
      at: new Date().toISOString(),
      line,
    });
  }

  private publishResolved(
    execution: Pick<
      ScheduledExecution<unknown>,
      "executionID" | "workspaceRoot" | "stream"
    >,
    input: {
      taskID: string;
      flowID: string;
      source: WorkflowExecutionResolvedEvent["source"];
      requestedBy?: WorkflowExecutionResolvedEvent["requestedBy"];
    },
  ) {
    execution.stream.publish({
      type: "workflow.execution.resolved",
      executionID: execution.executionID,
      workspaceRoot: execution.workspaceRoot,
      at: new Date().toISOString(),
      ...input,
    });
  }
}

type WorkflowExecutionResolvedEvent = Extract<
  WorkflowExecutionEvent,
  { type: "workflow.execution.resolved" }
>;

class ExecutionEventStream implements AsyncIterable<WorkflowExecutionEvent> {
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

function positiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
}

function nonNegativeInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${name} must be a non-negative integer`);
  return value;
}
