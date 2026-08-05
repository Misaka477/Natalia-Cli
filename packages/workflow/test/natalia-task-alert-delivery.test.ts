import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deliverPendingTaskAlerts,
  NataliaTaskAlertQueue,
  type NataliaAlertChannel,
} from "../src";

const WEBHOOK_TOKEN = "webhook-token-must-not-leak";

async function queueWithAlert(prefix: string, channels: string[]) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const queue = await NataliaTaskAlertQueue.open(root);
  const { alert } = queue.enqueue({
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "ultimately_failed",
    status: "failed",
    reason: "module plan did not complete",
    channels,
    at: "2026-08-05T01:00:00.000Z",
  });
  return { queue, alert };
}

function recordingFetch(
  responder: (request: {
    url: string;
    body: unknown;
    auth: string;
  }) => Response,
) {
  const seen: Array<{ url: string; body: unknown; auth: string }> = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const entry = {
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init?.headers).get("authorization") ?? "",
    };
    seen.push(entry);
    return responder(entry);
  }) as unknown as typeof fetch;
  return { impl, seen };
}

const WEBHOOK: NataliaAlertChannel = {
  kind: "webhook",
  url: "https://ops.example/hook",
  token: WEBHOOK_TOKEN,
};

test("a journal channel is delivered by the durable record itself", async () => {
  const { queue, alert } = await queueWithAlert("natalia-alert-journal-", [
    "journal",
  ]);
  const outcomes = await deliverPendingTaskAlerts({
    queue,
    channels: { journal: { kind: "journal" } },
    now: "2026-08-05T01:00:01.000Z",
  });
  expect(outcomes).toEqual([
    {
      alertID: alert.alertID,
      channel: "journal",
      result: "delivered",
      attempts: 1,
      error: undefined,
    },
  ]);
  expect(queue.pendingDeliveries()).toEqual([]);
  queue.close();
});

test("a webhook receives the alert record and nothing else", async () => {
  const { queue, alert } = await queueWithAlert("natalia-alert-webhook-", [
    "ops",
  ]);
  const fetcher = recordingFetch(() => new Response("", { status: 204 }));
  const outcomes = await deliverPendingTaskAlerts({
    queue,
    channels: { ops: WEBHOOK },
    fetch: fetcher.impl,
    now: "2026-08-05T01:00:01.000Z",
  });
  expect(outcomes[0]).toMatchObject({ result: "delivered", attempts: 1 });
  expect(fetcher.seen).toHaveLength(1);
  expect(fetcher.seen[0]!.auth).toBe(`Bearer ${WEBHOOK_TOKEN}`);
  expect(fetcher.seen[0]!.body).toEqual({
    alertID: alert.alertID,
    taskID: "task_nightly",
    invocationID: "inv_1",
    attempt: 1,
    eventKind: "ultimately_failed",
    status: "failed",
    reason: "module plan did not complete",
    createdAt: "2026-08-05T01:00:00.000Z",
  });
  queue.close();
});

test("a transport failure retries later while the task result stays untouched", async () => {
  const { queue } = await queueWithAlert("natalia-alert-transient-", ["ops"]);
  const fetcher = recordingFetch(() => new Response("", { status: 503 }));
  const first = await deliverPendingTaskAlerts({
    queue,
    channels: { ops: WEBHOOK },
    fetch: fetcher.impl,
    now: "2026-08-05T01:00:01.000Z",
    jitter: () => 1,
  });
  expect(first[0]).toMatchObject({
    result: "retrying",
    attempts: 1,
    error: "webhook responded 503",
  });
  // The retry is scheduled, so an immediate drain does nothing.
  expect(
    await deliverPendingTaskAlerts({
      queue,
      channels: { ops: WEBHOOK },
      fetch: fetcher.impl,
      now: "2026-08-05T01:00:02.000Z",
    }),
  ).toEqual([]);
  expect(fetcher.seen).toHaveLength(1);
  const later = await deliverPendingTaskAlerts({
    queue,
    channels: { ops: WEBHOOK },
    fetch: fetcher.impl,
    now: "2026-08-05T01:02:00.000Z",
  });
  expect(later[0]).toMatchObject({ result: "retrying", attempts: 2 });
  queue.close();
});

test("network errors are transient and never expose the channel token", async () => {
  const { queue } = await queueWithAlert("natalia-alert-network-", ["ops"]);
  const failing = (async () => {
    throw new Error(`connect ECONNREFUSED using ${WEBHOOK_TOKEN}`);
  }) as unknown as typeof fetch;
  const outcomes = await deliverPendingTaskAlerts({
    queue,
    channels: { ops: WEBHOOK },
    fetch: failing,
    now: "2026-08-05T01:00:01.000Z",
  });
  expect(outcomes[0]).toMatchObject({ result: "retrying" });
  expect(outcomes[0]!.error).toContain("[redacted]");
  expect(JSON.stringify(outcomes)).not.toContain(WEBHOOK_TOKEN);
  queue.close();
});

test("configuration and authorization failures are permanent, not retried", async () => {
  const { queue } = await queueWithAlert("natalia-alert-permanent-", [
    "ops",
    "missing",
    "disabled",
    "urlless",
  ]);
  const fetcher = recordingFetch(() => new Response("", { status: 401 }));
  const outcomes = await deliverPendingTaskAlerts({
    queue,
    channels: {
      ops: WEBHOOK,
      disabled: { ...WEBHOOK, enabled: false },
      urlless: { kind: "webhook", url: "" },
    },
    fetch: fetcher.impl,
    now: "2026-08-05T01:00:01.000Z",
  });
  expect(
    outcomes.map((outcome) => [outcome.channel, outcome.result]).sort(),
  ).toEqual([
    ["disabled", "failed"],
    ["missing", "failed"],
    ["ops", "failed"],
    ["urlless", "failed"],
  ]);
  expect(
    outcomes.find((outcome) => outcome.channel === "missing")?.error,
  ).toContain("not configured");
  expect(
    outcomes.find((outcome) => outcome.channel === "ops")?.error,
  ).toContain("401");
  // A permanent failure is never attempted again.
  expect(
    await deliverPendingTaskAlerts({
      queue,
      channels: { ops: WEBHOOK },
      fetch: fetcher.impl,
      now: "2026-08-05T02:00:00.000Z",
    }),
  ).toEqual([]);
  expect(queue.queuePressure()).toMatchObject({ pending: 0, failed: 4 });
  queue.close();
});

test("a drain is bounded and leaves the rest queued", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-alert-bounded-"));
  const queue = await NataliaTaskAlertQueue.open(root);
  for (const invocationID of ["inv_1", "inv_2", "inv_3"])
    queue.enqueue({
      taskID: "task_nightly",
      invocationID,
      attempt: 1,
      eventKind: "succeeded",
      status: "succeeded",
      channels: ["journal"],
      at: `2026-08-05T01:00:0${invocationID.at(-1)}.000Z`,
    });
  const outcomes = await deliverPendingTaskAlerts({
    queue,
    channels: { journal: { kind: "journal" } },
    now: "2026-08-05T01:00:10.000Z",
    limit: 2,
  });
  expect(outcomes).toHaveLength(2);
  expect(queue.queuePressure()).toMatchObject({ pending: 1, delivered: 2 });
  queue.close();
});
