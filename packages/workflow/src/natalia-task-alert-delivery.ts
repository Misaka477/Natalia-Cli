import type {
  NataliaTaskAlert,
  NataliaTaskAlertDelivery,
  NataliaTaskAlertQueue,
} from "./natalia-task-alert-queue";

export type NataliaAlertChannel = {
  kind: "journal" | "webhook";
  url?: string;
  token?: string;
  timeoutMs?: number;
  enabled?: boolean;
};

export type TaskAlertDeliveryOutcome = {
  alertID: string;
  channel: string;
  result: "delivered" | "retrying" | "failed";
  attempts: number;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Drains the durable alert queue.
 *
 * Delivery is deliberately separate from the task result: a task that already
 * reached a terminal state is never rerun or rewritten because a webhook was
 * unreachable. Only transport-shaped failures are retried; a configuration or
 * authorization failure is permanent so it surfaces instead of retrying forever.
 */
export async function deliverPendingTaskAlerts(input: {
  queue: NataliaTaskAlertQueue;
  channels: Record<string, NataliaAlertChannel>;
  fetch?: typeof fetch;
  now?: string;
  limit?: number;
  jitter?: () => number;
}): Promise<TaskAlertDeliveryOutcome[]> {
  const fetchImpl = input.fetch ?? fetch;
  const pending = input.queue.pendingDeliveries({
    now: input.now,
    limit: input.limit ?? 25,
  });
  const outcomes: TaskAlertDeliveryOutcome[] = [];
  for (const delivery of pending) {
    const alert = input.queue.alert(delivery.alertID);
    if (!alert) continue;
    const attempt = await attemptDelivery({
      alert,
      delivery,
      channel: input.channels[delivery.channel],
      fetch: fetchImpl,
    });
    const recorded = input.queue.recordDeliveryResult({
      alertID: delivery.alertID,
      channel: delivery.channel,
      outcome: attempt.outcome,
      error: attempt.error,
      at: input.now,
      jitter: input.jitter,
    });
    outcomes.push({
      alertID: delivery.alertID,
      channel: delivery.channel,
      result:
        recorded.state === "delivered"
          ? "delivered"
          : recorded.state === "failed"
            ? "failed"
            : "retrying",
      attempts: recorded.attempts,
      error: recorded.lastError,
    });
  }
  return outcomes;
}

async function attemptDelivery(input: {
  alert: NataliaTaskAlert;
  delivery: NataliaTaskAlertDelivery;
  channel: NataliaAlertChannel | undefined;
  fetch: typeof fetch;
}): Promise<{
  outcome: "delivered" | "transient" | "permanent";
  error?: string;
}> {
  const { channel } = input;
  if (!channel)
    return {
      outcome: "permanent",
      error: `alert channel is not configured: ${input.delivery.channel}`,
    };
  if (channel.enabled === false)
    return {
      outcome: "permanent",
      error: `alert channel is disabled: ${input.delivery.channel}`,
    };
  // The queue entry and the process output are the journal, so recording the
  // alert is the delivery.
  if (channel.kind === "journal") return { outcome: "delivered" };
  if (!channel.url)
    return {
      outcome: "permanent",
      error: `webhook channel has no url: ${input.delivery.channel}`,
    };
  try {
    const response = await input.fetch(channel.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // The credential is only ever a header.
        ...(channel.token ? { authorization: `Bearer ${channel.token}` } : {}),
      },
      signal: AbortSignal.timeout(channel.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      body: JSON.stringify(alertPayload(input.alert)),
    });
    if (response.ok) return { outcome: "delivered" };
    return {
      outcome: retryableStatus(response.status) ? "transient" : "permanent",
      error: `webhook responded ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      outcome: "transient",
      error: redactChannelSecret(message, channel),
    };
  }
}

/**
 * The delivered payload is the alert record only: no evaluator context, no tool
 * output, no prompt and no credential.
 */
function alertPayload(alert: NataliaTaskAlert) {
  return {
    alertID: alert.alertID,
    taskID: alert.taskID,
    invocationID: alert.invocationID,
    attempt: alert.attempt,
    eventKind: alert.eventKind,
    status: alert.status,
    reason: alert.reason,
    createdAt: alert.createdAt,
  };
}

function retryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function redactChannelSecret(message: string, channel: NataliaAlertChannel) {
  return channel.token
    ? message.split(channel.token).join("[redacted]")
    : message;
}
