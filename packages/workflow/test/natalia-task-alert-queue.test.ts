import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EpisodeID, SessionID } from "@natalia/contracts";
import {
  channelsForTaskAlertEvent,
  taskAlertSubscriptions,
  NataliaTaskAlertQueue,
  NataliaTaskStateStore,
  taskAlertEventKindForStatus,
  taskAlertID,
} from "../src";

async function openQueue(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  return { root, queue: await NataliaTaskAlertQueue.open(root) };
}

test("task alert queue enqueues one durable entry per final terminal state", async () => {
  const { queue } = await openQueue("natalia-task-alert-final-");
  const enqueued = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 2,
    episodeID: "epi_final" as EpisodeID,
    eventKind: "succeeded",
    status: "succeeded",
    reason: "all enabled modules completed under evaluator control",
    channels: ["journal", "webhook:ops"],
    at: "2026-08-05T01:00:00.000Z",
  });
  expect(enqueued.enqueued).toBe(true);
  expect(enqueued.alert).toMatchObject({
    alertID: taskAlertID({
      taskID: "task_nightly",
      invocationID: "inv_1",
      attempt: 2,
      eventKind: "succeeded",
    }),
    taskID: "task_nightly",
    attempt: 2,
    eventKind: "succeeded",
    status: "succeeded",
  });
  expect(enqueued.deliveries.map((delivery) => delivery.channel)).toEqual([
    "journal",
    "webhook:ops",
  ]);
  expect(
    enqueued.deliveries.every((delivery) => delivery.state === "pending"),
  ).toBe(true);
  expect(queue.alerts("task_nightly")).toHaveLength(1);
  queue.close();
});

test("task alert queue is idempotent across a replayed finalize", async () => {
  const { queue } = await openQueue("natalia-task-alert-replay-");
  const input = {
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "blocked_by_policy" as const,
    status: "blocked",
    channels: ["journal"],
    at: "2026-08-05T01:00:00.000Z",
  };
  const first = queue.enqueue(input);
  queue.recordDeliveryResult({
    alertID: first.alert.alertID,
    channel: "journal",
    outcome: "delivered",
    at: "2026-08-05T01:00:01.000Z",
  });
  const replay = queue.enqueue({ ...input, at: "2026-08-05T02:00:00.000Z" });
  expect(replay.enqueued).toBe(false);
  expect(replay.alert.createdAt).toBe("2026-08-05T01:00:00.000Z");
  expect(queue.alerts("task_nightly")).toHaveLength(1);
  // A replay must not resurrect an already delivered notification.
  expect(replay.deliveries).toEqual([
    {
      alertID: first.alert.alertID,
      channel: "journal",
      state: "delivered",
      attempts: 1,
      nextAttemptAt: undefined,
      lastError: undefined,
      updatedAt: "2026-08-05T01:00:01.000Z",
    },
  ]);
  queue.close();
});

test("task alert queue separates each terminal status of the same task", async () => {
  const { queue } = await openQueue("natalia-task-alert-distinct-");
  queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "ultimately_failed",
    status: "stalled",
    at: "2026-08-05T01:00:00.000Z",
  });
  queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_2",
    attempt: 1,
    eventKind: "succeeded",
    status: "succeeded",
    at: "2026-08-06T01:00:00.000Z",
  });
  expect(
    queue
      .alerts("task_nightly")
      .map((alert) => [alert.invocationID, alert.eventKind, alert.status]),
  ).toEqual([
    ["inv_1", "ultimately_failed", "stalled"],
    ["inv_2", "succeeded", "succeeded"],
  ]);
  queue.close();
});

test("intermediate retry states never map to an alert event kind", () => {
  expect(taskAlertEventKindForStatus("running")).toBeUndefined();
  expect(taskAlertEventKindForStatus("retrying")).toBeUndefined();
  expect(taskAlertEventKindForStatus("succeeded")).toBe("succeeded");
  expect(taskAlertEventKindForStatus("failed")).toBe("ultimately_failed");
  expect(taskAlertEventKindForStatus("stalled")).toBe("ultimately_failed");
  expect(taskAlertEventKindForStatus("cancelled")).toBe("ultimately_failed");
  expect(taskAlertEventKindForStatus("blocked")).toBe("blocked_by_policy");
  expect(taskAlertEventKindForStatus("skipped_due_to_overlap")).toBe(
    "skipped_due_to_overlap",
  );
});

test("a retrying task attempt produces no alert while the invocation is not terminal", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-alert-retry-"));
  const state = await NataliaTaskStateStore.open(root);
  const queue = await NataliaTaskAlertQueue.open(root);
  state.startInvocation({
    invocationID: "inv_retry",
    taskID: "task_nightly",
    episodeID: "epi_1" as EpisodeID,
    sessionID: "ses_1" as SessionID,
  });
  state.completeAttempt({
    invocationID: "inv_retry",
    attempt: 1,
    status: "blocked",
    retry: true,
    reason: "module blocked",
  });
  const retrying = state.getInvocation("inv_retry")!;
  expect(retrying.status).toBe("retrying");
  expect(taskAlertEventKindForStatus(retrying.status)).toBeUndefined();
  expect(queue.alerts("task_nightly")).toEqual([]);
  state.recordAttempt({
    invocationID: "inv_retry",
    attempt: 2,
    episodeID: "epi_2" as EpisodeID,
    sessionID: "ses_2" as SessionID,
  });
  state.completeAttempt({
    invocationID: "inv_retry",
    attempt: 2,
    status: "succeeded",
    retry: false,
  });
  const final = state.getInvocation("inv_retry")!;
  queue.enqueue({
    taskID: final.taskID,
    invocationID: final.invocationID,
    attempt: 2,
    eventKind: taskAlertEventKindForStatus(final.status)!,
    status: final.status,
  });
  expect(
    queue
      .alerts("task_nightly")
      .map((alert) => [alert.attempt, alert.eventKind]),
  ).toEqual([[2, "succeeded"]]);
  state.close();
  queue.close();
});

test("task alert payloads stay bounded and single line", async () => {
  const { queue } = await openQueue("natalia-task-alert-payload-");
  const secretish = `tool output:\n  export TOKEN=ghp_${"a".repeat(300)}\n  done`;
  const result = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "ultimately_failed",
    status: "failed",
    reason: secretish,
  });
  const reason = result.alert.reason!;
  expect(reason.length).toBeLessThanOrEqual(200);
  expect(reason).not.toContain("\n");
  expect(reason.endsWith("\u2026")).toBe(true);
  expect(reason).not.toContain(`ghp_${"a".repeat(300)}`);
  queue.close();
});

test("task alert queue rejects unknown kinds and malformed identity", async () => {
  const { queue } = await openQueue("natalia-task-alert-invalid-");
  expect(() =>
    queue.enqueue({
      taskID: "task_nightly",
      invocationID: "inv_1",
      attempt: 1,
      eventKind: "delivered" as never,
      status: "failed",
    }),
  ).toThrow("unknown task alert event kind");
  expect(() =>
    queue.enqueue({
      taskID: "",
      invocationID: "inv_1",
      attempt: 1,
      eventKind: "succeeded",
      status: "succeeded",
    }),
  ).toThrow("requires a taskID");
  expect(() =>
    queue.enqueue({
      taskID: "task_nightly",
      invocationID: "inv_1",
      attempt: -1,
      eventKind: "succeeded",
      status: "succeeded",
    }),
  ).toThrow("non-negative integer attempt");
  expect(queue.alerts()).toEqual([]);
  queue.close();
});

test("transient delivery failures back off within a bounded attempt budget", async () => {
  const { queue } = await openQueue("natalia-task-alert-backoff-");
  const { alert } = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "succeeded",
    status: "succeeded",
    channels: ["webhook:ops"],
    at: "2026-08-05T01:00:00.000Z",
  });
  const first = queue.recordDeliveryResult({
    alertID: alert.alertID,
    channel: "webhook:ops",
    outcome: "transient",
    error: "502 from webhook host",
    at: "2026-08-05T01:00:00.000Z",
    baseBackoffMs: 1000,
    jitter: () => 1,
  });
  expect(first).toMatchObject({
    state: "pending",
    attempts: 1,
    lastError: "502 from webhook host",
    nextAttemptAt: "2026-08-05T01:00:01.000Z",
  });
  const second = queue.recordDeliveryResult({
    alertID: alert.alertID,
    channel: "webhook:ops",
    outcome: "transient",
    at: "2026-08-05T01:00:01.000Z",
    baseBackoffMs: 1000,
    jitter: () => 1,
  });
  expect(second.nextAttemptAt).toBe("2026-08-05T01:00:03.000Z");
  const exhausted = queue.recordDeliveryResult({
    alertID: alert.alertID,
    channel: "webhook:ops",
    outcome: "transient",
    at: "2026-08-05T01:00:03.000Z",
    maxAttempts: 3,
  });
  expect(exhausted).toMatchObject({ state: "failed", attempts: 3 });
  expect(() =>
    queue.recordDeliveryResult({
      alertID: alert.alertID,
      channel: "webhook:ops",
      outcome: "transient",
    }),
  ).toThrow("already terminal");
  queue.close();
});

test("permanent delivery failures are not retried and stay visible", async () => {
  const { queue } = await openQueue("natalia-task-alert-permanent-");
  const { alert } = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "blocked_by_policy",
    status: "blocked",
    channels: ["webhook:ops"],
  });
  const delivery = queue.recordDeliveryResult({
    alertID: alert.alertID,
    channel: "webhook:ops",
    outcome: "permanent",
    error: "401 unauthorized webhook token",
  });
  expect(delivery).toMatchObject({ state: "failed", attempts: 1 });
  expect(queue.pendingDeliveries()).toEqual([]);
  expect(queue.queuePressure()).toMatchObject({ pending: 0, failed: 1 });
  queue.close();
});

test("pending deliveries respect the scheduled next attempt", async () => {
  const { queue } = await openQueue("natalia-task-alert-pending-");
  const { alert } = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "succeeded",
    status: "succeeded",
    channels: ["webhook:ops"],
    at: "2026-08-05T01:00:00.000Z",
  });
  expect(
    queue.pendingDeliveries({ now: "2026-08-05T01:00:00.000Z" }),
  ).toHaveLength(1);
  queue.recordDeliveryResult({
    alertID: alert.alertID,
    channel: "webhook:ops",
    outcome: "transient",
    at: "2026-08-05T01:00:00.000Z",
    baseBackoffMs: 60_000,
    jitter: () => 1,
  });
  expect(queue.pendingDeliveries({ now: "2026-08-05T01:00:30.000Z" })).toEqual(
    [],
  );
  expect(
    queue.pendingDeliveries({ now: "2026-08-05T01:01:30.000Z" }),
  ).toHaveLength(1);
  queue.close();
});

test("queue pressure reports the pending backlog against its limit", async () => {
  const { queue } = await openQueue("natalia-task-alert-pressure-");
  for (const invocationID of ["inv_1", "inv_2", "inv_3"])
    queue.enqueue({
      taskID: "task_nightly",
      invocationID,
      attempt: 1,
      eventKind: "succeeded",
      status: "succeeded",
      channels: ["webhook:ops"],
    });
  expect(queue.queuePressure({ limit: 2 })).toMatchObject({
    pending: 3,
    limit: 2,
    overLimit: true,
  });
  expect(queue.queuePressure({ limit: 5 }).overLimit).toBe(false);
  queue.close();
});

test("retention prunes settled alerts by class and keeps pending work", async () => {
  const { queue } = await openQueue("natalia-task-alert-retention-");
  const delivered = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_delivered",
    attempt: 1,
    eventKind: "succeeded",
    status: "succeeded",
    channels: ["webhook:ops"],
    at: "2026-01-01T00:00:00.000Z",
  });
  queue.recordDeliveryResult({
    alertID: delivered.alert.alertID,
    channel: "webhook:ops",
    outcome: "delivered",
    at: "2026-01-01T00:00:01.000Z",
  });
  const failed = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_failed",
    attempt: 1,
    eventKind: "ultimately_failed",
    status: "failed",
    channels: ["webhook:ops"],
    at: "2026-01-01T00:00:02.000Z",
  });
  queue.recordDeliveryResult({
    alertID: failed.alert.alertID,
    channel: "webhook:ops",
    outcome: "permanent",
    error: "401 unauthorized",
    at: "2026-01-01T00:00:01.000Z",
  });
  queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_pending",
    attempt: 1,
    eventKind: "blocked_by_policy",
    status: "blocked",
    channels: ["webhook:ops"],
    at: "2026-01-01T00:00:03.000Z",
  });
  // 120 days later: the delivered alert is past 90 days, the permanently failed
  // one is still inside 180 days, and the pending one is never prunable.
  const pruned = queue.prune({ now: "2026-05-01T00:00:00.000Z" });
  expect(pruned).toMatchObject({ alerts: 1, deliveries: 1 });
  expect(
    queue.alerts("task_nightly").map((alert) => alert.invocationID),
  ).toEqual(["inv_failed", "inv_pending"]);
  expect(queue.retentionSummary("task_nightly")).toEqual([
    {
      taskID: "task_nightly",
      eventKind: "succeeded",
      prunedCount: 1,
      lastPrunedAt: "2026-05-01T00:00:00.000Z",
    },
  ]);
  // 200 days later the permanently failed alert also ages out; the pending one
  // survives regardless of age.
  const later = queue.prune({ now: "2026-07-20T00:00:00.000Z" });
  expect(later).toMatchObject({ alerts: 1 });
  expect(
    queue.alerts("task_nightly").map((alert) => alert.invocationID),
  ).toEqual(["inv_pending"]);
  queue.close();
});

test("task alert queue reopens the same durable workspace database", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-alert-reopen-"));
  const first = await NataliaTaskAlertQueue.open(root);
  first.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "succeeded",
    status: "succeeded",
    channels: ["journal"],
  });
  expect(first.path).toBe(join(root, ".natalia", "task-alerts.db"));
  first.close();
  const reopened = await NataliaTaskAlertQueue.open(root);
  expect(reopened.alerts("task_nightly")).toHaveLength(1);
  // The queue database is separate from the task waterline database, so alert
  // growth or corruption can never rewrite the task's terminal truth.
  const state = await NataliaTaskStateStore.open(root);
  expect(state.path).not.toBe(reopened.path);
  state.close();
  reopened.close();
});

test("a bare channel name subscribes to the outcomes a person must know about", () => {
  expect(taskAlertSubscriptions(["journal"])).toEqual([
    {
      channel: "journal",
      on: ["ultimately_failed", "blocked_by_policy", "skipped_due_to_overlap"],
    },
  ]);
  // Success is silent by default, and a retried attempt does not page anyone:
  // otherwise one retry produces two messages for a task that then succeeded.
  const [subscription] = taskAlertSubscriptions(["journal"]);
  expect(subscription!.on).not.toContain("succeeded");
  expect(subscription!.on).not.toContain("attempt_failed");
  expect(subscription!.on).not.toContain("retry_scheduled");
  expect(subscription!.on).not.toContain("task_started");
});

test("an explicit policy replaces the default for that channel only", () => {
  expect(
    taskAlertSubscriptions([
      "journal",
      { channel: "pager", on: ["ultimately_failed"] },
      { channel: "chat", on: ["succeeded", "task_started"] },
    ]),
  ).toEqual([
    {
      channel: "journal",
      on: ["ultimately_failed", "blocked_by_policy", "skipped_due_to_overlap"],
    },
    { channel: "pager", on: ["ultimately_failed"] },
    { channel: "chat", on: ["task_started", "succeeded"] },
  ]);
});

test("repeating a channel merges its events in the frozen order", () => {
  expect(
    taskAlertSubscriptions([
      { channel: "chat", on: ["succeeded"] },
      { channel: "chat", on: ["task_started", "succeeded"] },
    ]),
  ).toEqual([{ channel: "chat", on: ["task_started", "succeeded"] }]);
});

test("only the channels that asked for an event hear it", () => {
  const subscriptions = taskAlertSubscriptions([
    "journal",
    { channel: "chat", on: ["succeeded"] },
  ]);
  expect(channelsForTaskAlertEvent(subscriptions, "succeeded")).toEqual([
    "chat",
  ]);
  expect(channelsForTaskAlertEvent(subscriptions, "ultimately_failed")).toEqual(
    ["journal"],
  );
  expect(channelsForTaskAlertEvent(subscriptions, "task_started")).toEqual([]);
});
