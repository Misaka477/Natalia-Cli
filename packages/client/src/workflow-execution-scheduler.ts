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
  readonly code:
    | "global_queue_full"
    | "workspace_queue_full"
    | "execution_id_conflict"
    | "execution_idempotency_conflict"
    | "execution_queue_timeout";

  constructor(
    code:
      | "global_queue_full"
      | "workspace_queue_full"
      | "execution_id_conflict"
      | "execution_idempotency_conflict"
      | "execution_queue_timeout",
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
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
  queueTimer?: ReturnType<typeof setTimeout>;
  handle?: WorkflowExecutionHandle<unknown>;
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
  private readonly executionIDs = new Set<string>();
  private readonly idempotency = new Map<string, ScheduledExecution<unknown>>();
  private readonly queueTimeoutMs: number;
  private readonly executions = new Set<ScheduledExecution<unknown>>();
  private disposed = false;

  constructor(
    options: {
      globalConcurrency?: number;
      workspaceConcurrency?: number;
      globalQueueLimit?: number;
      workspaceQueueLimit?: number;
      queueTimeoutMs?: number;
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
    this.queueTimeoutMs = nonNegativeInteger(
      options.queueTimeoutMs ?? 5 * 60_000,
      "queueTimeoutMs",
    );
  }

  schedule<T>(input: {
    workspaceRoot: string;
    executionID?: string;
    idempotencyKey?: string;
    idempotencyFingerprint?: string;
    run: ScheduledExecution<T>["run"];
  }): WorkflowExecutionHandle<T> {
    if (this.disposed) throw new Error("workflow execution scheduler disposed");
    const workspaceRoot = resolve(input.workspaceRoot);
    const executionID =
      input.executionID ?? `exe_${crypto.randomUUID().replace(/-/gu, "")}`;
    if (!/^exe_[a-zA-Z0-9]+$/u.test(executionID))
      throw new Error("workflow execution ID is invalid");
    if (this.executionIDs.has(executionID))
      throw new WorkflowExecutionRefusal(
        "execution_id_conflict",
        `workflow execution ID is already active: ${executionID}`,
      );
    if (input.idempotencyKey) {
      const existing = this.idempotency.get(input.idempotencyKey);
      if (existing) {
        if (existing.idempotencyFingerprint !== input.idempotencyFingerprint)
          throw new WorkflowExecutionRefusal(
            "execution_idempotency_conflict",
            `workflow idempotency key was reused with different input: ${input.idempotencyKey}`,
          );
        return existing.handle as WorkflowExecutionHandle<T>;
      }
    }
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
      idempotencyKey: input.idempotencyKey,
      idempotencyFingerprint: input.idempotencyFingerprint,
    };
    if (!this.canStart(workspaceRoot)) this.assertQueueCapacity(workspaceRoot);
    this.executionIDs.add(executionID);
    if (input.idempotencyKey)
      this.idempotency.set(
        input.idempotencyKey,
        execution as ScheduledExecution<unknown>,
      );
    this.waiting.push(execution as ScheduledExecution<unknown>);
    this.executions.add(execution as ScheduledExecution<unknown>);
    if (this.queueTimeoutMs > 0)
      execution.queueTimer = setTimeout(
        () => this.expireQueued(execution),
        this.queueTimeoutMs,
      );
    this.publish(execution, { status: "queued" });
    this.drain();

    const handle: WorkflowExecutionHandle<T> = {
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
          this.executions.delete(execution as ScheduledExecution<unknown>);
          this.executionIDs.delete(execution.executionID);
          if (execution.queueTimer) clearTimeout(execution.queueTimer);
          if (
            execution.idempotencyKey &&
            this.idempotency.get(execution.idempotencyKey) === execution
          )
            this.idempotency.delete(execution.idempotencyKey);
          this.publish(execution, { status: "cancelled", reason });
          stream.close();
          rejectResult(abort.signal.reason);
          this.drain();
          return;
        }
        this.publish(execution, { status: "cancelling", reason });
      },
    };
    execution.handle = handle as WorkflowExecutionHandle<unknown>;
    return handle;
  }

  private expireQueued(execution: ScheduledExecution<unknown>) {
    if (execution.started || execution.settled) return;
    const index = this.waiting.indexOf(execution);
    if (index < 0) return;
    this.waiting.splice(index, 1);
    execution.settled = true;
    this.executions.delete(execution);
    this.executionIDs.delete(execution.executionID);
    if (
      execution.idempotencyKey &&
      this.idempotency.get(execution.idempotencyKey) === execution
    )
      this.idempotency.delete(execution.idempotencyKey);
    const error = new WorkflowExecutionRefusal(
      "execution_queue_timeout",
      `workflow execution remained queued for ${this.queueTimeoutMs}ms`,
    );
    this.publish(execution, { status: "failed", reason: error.message });
    execution.stream.close();
    execution.reject(error);
    this.drain();
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
    if (execution.queueTimer) clearTimeout(execution.queueTimer);
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
        this.executions.delete(execution);
        this.executionIDs.delete(execution.executionID);
        if (
          execution.idempotencyKey &&
          this.idempotency.get(execution.idempotencyKey) === execution
        )
          this.idempotency.delete(execution.idempotencyKey);
        this.publish(execution, { status: "completed" });
        execution.resolve(value);
      } catch (error) {
        execution.settled = true;
        this.executions.delete(execution);
        this.executionIDs.delete(execution.executionID);
        if (
          execution.idempotencyKey &&
          this.idempotency.get(execution.idempotencyKey) === execution
        )
          this.idempotency.delete(execution.idempotencyKey);
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

  async dispose(reason = "workflow execution scheduler disposed") {
    if (this.disposed) return;
    this.disposed = true;
    const executions = [...this.executions];
    for (const execution of executions) execution.handle?.cancel(reason);
    await Promise.allSettled(
      executions.map((execution) => execution.handle?.result),
    );
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
