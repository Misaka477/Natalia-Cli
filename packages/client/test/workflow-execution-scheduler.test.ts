import { expect, test } from "bun:test";
import {
  WorkflowExecutionRefusal,
  WorkflowExecutionScheduler,
} from "../src/workflow-execution-scheduler";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

async function statuses(handle: {
  events: AsyncIterable<
    | { type: "workflow.execution"; status: string }
    | { type: "workflow.execution.output"; line: string }
    | { type: "workflow.execution.resolved"; taskID: string }
  >;
}) {
  const seen: string[] = [];
  for await (const event of handle.events)
    if (event.type === "workflow.execution") seen.push(event.status);
  return seen;
}

test("workspace gates serialize one tree while another workspace can run", async () => {
  const scheduler = new WorkflowExecutionScheduler({
    globalConcurrency: 2,
    workspaceConcurrency: 1,
  });
  const firstRelease = deferred<void>();
  const order: string[] = [];
  const first = scheduler.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => {
      order.push("a1-start");
      await firstRelease.promise;
      order.push("a1-end");
      return "a1";
    },
  });
  const second = scheduler.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => {
      order.push("a2");
      return "a2";
    },
  });
  const other = scheduler.schedule({
    workspaceRoot: "/workspace/b",
    run: async () => {
      order.push("b1");
      return "b1";
    },
  });

  await Bun.sleep(0);
  expect(order).toEqual(["a1-start", "b1"]);
  await expect(other.result).resolves.toBe("b1");
  firstRelease.resolve();
  await expect(first.result).resolves.toBe("a1");
  await expect(second.result).resolves.toBe("a2");
  expect(order).toEqual(["a1-start", "b1", "a1-end", "a2"]);
});

test("queued cancellation never starts work and closes its event stream", async () => {
  const scheduler = new WorkflowExecutionScheduler();
  const release = deferred<void>();
  const running = scheduler.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => release.promise,
  });
  let started = false;
  const queued = scheduler.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => {
      started = true;
    },
  });
  const seen = statuses(queued);
  queued.cancel("no longer needed");

  await expect(queued.result).rejects.toThrow("no longer needed");
  expect(await seen).toEqual(["queued", "cancelled"]);
  expect(started).toBe(false);
  release.resolve();
  await running.result;
});

test("running cancellation reaches work through AbortSignal", async () => {
  const scheduler = new WorkflowExecutionScheduler();
  const handle = scheduler.schedule({
    workspaceRoot: "/workspace/a",
    run: async ({ signal }) =>
      new Promise<void>((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      ),
  });
  const seen = statuses(handle);
  await Bun.sleep(0);
  handle.cancel("operator cancelled");

  await expect(handle.result).rejects.toThrow("operator cancelled");
  expect(await seen).toEqual([
    "queued",
    "starting",
    "running",
    "cancelling",
    "cancelled",
  ]);
});

test("global and per-workspace queue bounds refuse excess work", async () => {
  const global = new WorkflowExecutionScheduler({
    globalConcurrency: 1,
    globalQueueLimit: 1,
    workspaceQueueLimit: 2,
  });
  const releaseGlobal = deferred<void>();
  const activeGlobal = global.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => releaseGlobal.promise,
  });
  global.schedule({
    workspaceRoot: "/workspace/b",
    run: async () => undefined,
  });
  expect(() =>
    global.schedule({
      workspaceRoot: "/workspace/c",
      run: async () => undefined,
    }),
  ).toThrow(WorkflowExecutionRefusal);
  releaseGlobal.resolve();
  await activeGlobal.result;

  const workspace = new WorkflowExecutionScheduler({
    globalConcurrency: 2,
    workspaceConcurrency: 1,
    globalQueueLimit: 5,
    workspaceQueueLimit: 1,
  });
  const releaseWorkspace = deferred<void>();
  const activeWorkspace = workspace.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => releaseWorkspace.promise,
  });
  workspace.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => undefined,
  });
  expect(() =>
    workspace.schedule({
      workspaceRoot: "/workspace/a",
      run: async () => undefined,
    }),
  ).toThrow(/full for workspace/u);
  releaseWorkspace.resolve();
  await activeWorkspace.result;
});

test("failed work emits a terminal failure and frees the gate", async () => {
  const scheduler = new WorkflowExecutionScheduler();
  const failed = scheduler.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => {
      throw new Error("preflight failed");
    },
  });
  const seen = statuses(failed);
  await expect(failed.result).rejects.toThrow("preflight failed");
  expect(await seen).toEqual(["queued", "starting", "running", "failed"]);
  await expect(
    scheduler.schedule({
      workspaceRoot: "/workspace/a",
      run: async () => "next",
    }).result,
  ).resolves.toBe("next");
});

test("active execution IDs cannot be reused until the first execution settles", async () => {
  const scheduler = new WorkflowExecutionScheduler();
  const release = deferred<void>();
  const first = scheduler.schedule({
    executionID: "exe_duplicate",
    workspaceRoot: "/workspace/a",
    run: async () => release.promise,
  });

  expect(() =>
    scheduler.schedule({
      executionID: "exe_duplicate",
      workspaceRoot: "/workspace/b",
      run: async () => undefined,
    }),
  ).toThrow("already active");

  release.resolve();
  await first.result;
  await expect(
    scheduler.schedule({
      executionID: "exe_duplicate",
      workspaceRoot: "/workspace/b",
      run: async () => "reused",
    }).result,
  ).resolves.toBe("reused");
});

test("failed execution IDs are released after terminal settlement", async () => {
  const scheduler = new WorkflowExecutionScheduler();
  const failed = scheduler.schedule({
    executionID: "exe_failedreuse",
    workspaceRoot: "/workspace/a",
    run: async () => {
      throw new Error("boom");
    },
  });

  await expect(failed.result).rejects.toThrow("boom");
  await expect(
    scheduler.schedule({
      executionID: "exe_failedreuse",
      workspaceRoot: "/workspace/a",
      run: async () => "reused",
    }).result,
  ).resolves.toBe("reused");
});

test("idempotency replays return the active handle and reject changed input", async () => {
  const scheduler = new WorkflowExecutionScheduler({ globalConcurrency: 1 });
  const release = deferred<void>();
  const first = scheduler.schedule({
    executionID: "exe_idempotent",
    idempotencyKey: "request-1",
    idempotencyFingerprint: "task-a",
    workspaceRoot: "/workspace/a",
    run: async () => {
      await release.promise;
      return "done";
    },
  });
  const replay = scheduler.schedule({
    idempotencyKey: "request-1",
    idempotencyFingerprint: "task-a",
    workspaceRoot: "/workspace/a",
    run: async () => "wrong",
  });
  expect(replay.executionID).toBe(first.executionID);
  expect(() =>
    scheduler.schedule({
      idempotencyKey: "request-1",
      idempotencyFingerprint: "task-b",
      workspaceRoot: "/workspace/a",
      run: async () => "wrong",
    }),
  ).toThrow("different input");
  release.resolve();
  await expect(replay.result).resolves.toBe("done");
});

test("queued executions fail closed after the queue timeout", async () => {
  const scheduler = new WorkflowExecutionScheduler({
    globalConcurrency: 1,
    workspaceConcurrency: 1,
    queueTimeoutMs: 10,
  });
  const release = deferred<void>();
  const first = scheduler.schedule({
    workspaceRoot: "/workspace/a",
    run: async () => release.promise,
  });
  const queued = scheduler.schedule({
    executionID: "exe_timeout",
    workspaceRoot: "/workspace/a",
    run: async () => "never",
  });
  await expect(queued.result).rejects.toMatchObject({
    code: "execution_queue_timeout",
  });
  release.resolve();
  await first.result;
});
