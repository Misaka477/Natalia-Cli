import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type { EpisodeID } from "@natalia/contracts";
import type { NataliaTaskInvocationStatus } from "./natalia-task-state-store";

const SCHEMA_VERSION = 1;
const REASON_MAX_LENGTH = 200;
const DEFAULT_MAX_DELIVERY_ATTEMPTS = 5;
const DEFAULT_BASE_BACKOFF_MS = 30_000;
const DEFAULT_MAX_BACKOFF_MS = 3_600_000;
const DEFAULT_PENDING_LIMIT = 10_000;
const DEFAULT_DELIVERED_RETENTION_DAYS = 90;
const DEFAULT_FAILED_RETENTION_DAYS = 180;

// The vocabulary is frozen by the plan; the queue never invents kinds and never
// stores evaluator context, tool output, prompts or credentials.
export const TASK_ALERT_EVENT_KINDS = [
  "task_started",
  "attempt_failed",
  "retry_scheduled",
  "succeeded",
  "ultimately_failed",
  "blocked_by_policy",
  "skipped_due_to_overlap",
] as const;

export type NataliaTaskAlertEventKind = (typeof TASK_ALERT_EVENT_KINDS)[number];

export type NataliaTaskAlertDeliveryState = "pending" | "delivered" | "failed";

export type NataliaTaskAlert = {
  alertID: string;
  taskID: string;
  invocationID: string;
  attempt: number;
  episodeID?: EpisodeID;
  eventKind: NataliaTaskAlertEventKind;
  status: string;
  reason?: string;
  createdAt: string;
};

export type NataliaTaskAlertDelivery = {
  alertID: string;
  channel: string;
  state: NataliaTaskAlertDeliveryState;
  attempts: number;
  nextAttemptAt?: string;
  lastError?: string;
  updatedAt: string;
};

export type EnqueueTaskAlertResult = {
  enqueued: boolean;
  alert: NataliaTaskAlert;
  deliveries: NataliaTaskAlertDelivery[];
};

export type TaskAlertQueuePressure = {
  pending: number;
  delivered: number;
  failed: number;
  limit: number;
  overLimit: boolean;
};

export type TaskAlertPruneResult = {
  alerts: number;
  deliveries: number;
};

/**
 * Only a final terminal invocation status produces an alert. `running` and
 * `retrying` return undefined on purpose: an intermediate retry attempt is not
 * a task outcome, so it must never reach the queue from this mapping.
 */
export function taskAlertEventKindForStatus(
  status: NataliaTaskInvocationStatus,
): NataliaTaskAlertEventKind | undefined {
  if (status === "running" || status === "retrying") return undefined;
  if (status === "succeeded") return "succeeded";
  if (status === "blocked") return "blocked_by_policy";
  if (status === "skipped_due_to_overlap") return "skipped_due_to_overlap";
  // `failed`, `stalled` and `cancelled` share the frozen `ultimately_failed`
  // kind; the exact durable status stays on the alert record.
  return "ultimately_failed";
}

/**
 * The alert identity is derived, not random, so a crash or a replay of the same
 * terminal task state can never enqueue the same notification twice.
 */
export function taskAlertID(input: {
  taskID: string;
  invocationID: string;
  attempt: number;
  eventKind: NataliaTaskAlertEventKind;
}): string {
  const digest = createHash("sha256")
    .update(
      [
        input.taskID,
        input.invocationID,
        String(input.attempt),
        input.eventKind,
      ].join("\n"),
    )
    .digest("hex");
  return `alt_${digest.slice(0, 32)}`;
}

/**
 * Durable delivery queue for terminal task alerts. It is deliberately separate
 * from the task waterline/fingerprint state: a failing or saturated alert queue
 * must never rewrite the task's own terminal truth, and the task store must
 * never depend on delivery bookkeeping.
 *
 * This queue only records state. It performs no network request and owns no
 * sender; transport wiring belongs to a later slice.
 */
export class NataliaTaskAlertQueue {
  readonly path: string;
  #db: Database;

  constructor(workspaceRoot: string) {
    this.path = resolve(workspaceRoot, ".natalia", "task-alerts.db");
    this.#db = new Database(this.path, { create: true });
    this.#db.exec("PRAGMA journal_mode=WAL");
    this.#db.exec("PRAGMA foreign_keys=ON");
    this.#db.exec("PRAGMA busy_timeout=5000");
    this.migrate();
  }

  static async open(workspaceRoot: string) {
    const path = resolve(workspaceRoot, ".natalia", "task-alerts.db");
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    return new NataliaTaskAlertQueue(workspaceRoot);
  }

  close() {
    this.#db.close();
  }

  enqueue(input: {
    taskID: string;
    invocationID: string;
    attempt: number;
    episodeID?: EpisodeID;
    eventKind: NataliaTaskAlertEventKind;
    status: string;
    reason?: string;
    channels?: string[];
    at?: string;
  }): EnqueueTaskAlertResult {
    if (!input.taskID) throw new Error("task alert requires a taskID");
    if (!input.invocationID)
      throw new Error("task alert requires an invocationID");
    if (!Number.isInteger(input.attempt) || input.attempt < 0)
      throw new Error("task alert requires a non-negative integer attempt");
    if (!TASK_ALERT_EVENT_KINDS.includes(input.eventKind))
      throw new Error(`unknown task alert event kind: ${input.eventKind}`);
    if (!input.status) throw new Error("task alert requires a status");
    const at = input.at ?? new Date().toISOString();
    const alertID = taskAlertID(input);
    const reason = boundedReason(input.reason);
    const channels = normalizedChannels(input.channels);
    return this.#db.transaction(() => {
      const existing = this.alert(alertID);
      if (existing)
        return {
          enqueued: false,
          alert: existing,
          deliveries: this.deliveries(alertID),
        };
      const alert: NataliaTaskAlert = {
        alertID,
        taskID: input.taskID,
        invocationID: input.invocationID,
        attempt: input.attempt,
        episodeID: input.episodeID,
        eventKind: input.eventKind,
        status: input.status,
        reason,
        createdAt: at,
      };
      this.#db
        .query("INSERT INTO task_alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          alert.alertID,
          alert.taskID,
          alert.invocationID,
          alert.attempt,
          alert.episodeID ?? null,
          alert.eventKind,
          alert.status,
          alert.reason ?? null,
          alert.createdAt,
        );
      const insertDelivery = this.#db.query(
        "INSERT INTO task_alert_deliveries VALUES (?, ?, 'pending', 0, NULL, NULL, ?)",
      );
      for (const channel of channels) insertDelivery.run(alertID, channel, at);
      return { enqueued: true, alert, deliveries: this.deliveries(alertID) };
    })();
  }

  alert(alertID: string): NataliaTaskAlert | undefined {
    const row = this.#db
      .query<AlertRow, [string]>("SELECT * FROM task_alerts WHERE alert_id = ?")
      .get(alertID);
    return row ? alertFromRow(row) : undefined;
  }

  alerts(taskID?: string): NataliaTaskAlert[] {
    const rows = taskID
      ? this.#db
          .query<
            AlertRow,
            [string]
          >("SELECT * FROM task_alerts WHERE task_id = ? ORDER BY created_at, alert_id")
          .all(taskID)
      : this.#db
          .query<
            AlertRow,
            []
          >("SELECT * FROM task_alerts ORDER BY created_at, alert_id")
          .all();
    return rows.map(alertFromRow);
  }

  deliveries(alertID: string): NataliaTaskAlertDelivery[] {
    return this.#db
      .query<
        DeliveryRow,
        [string]
      >("SELECT * FROM task_alert_deliveries WHERE alert_id = ? ORDER BY channel")
      .all(alertID)
      .map(deliveryFromRow);
  }

  pendingDeliveries(
    input: { now?: string; limit?: number } = {},
  ): NataliaTaskAlertDelivery[] {
    const now = input.now ?? new Date().toISOString();
    return this.#db
      .query<DeliveryRow, [string, number]>(
        `SELECT * FROM task_alert_deliveries
         WHERE state = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
         ORDER BY updated_at, alert_id, channel LIMIT ?`,
      )
      .all(now, input.limit ?? 100)
      .map(deliveryFromRow);
  }

  /**
   * Only transport-shaped failures are retried, and only within a bounded
   * exponential backoff. Configuration and authorization failures are marked
   * permanently failed so they surface instead of burning attempts forever.
   */
  recordDeliveryResult(input: {
    alertID: string;
    channel: string;
    outcome: "delivered" | "transient" | "permanent";
    error?: string;
    at?: string;
    maxAttempts?: number;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
    jitter?: () => number;
  }): NataliaTaskAlertDelivery {
    const at = input.at ?? new Date().toISOString();
    const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_DELIVERY_ATTEMPTS;
    return this.#db.transaction(() => {
      const delivery = this.requireDelivery(input.alertID, input.channel);
      if (delivery.state !== "pending")
        throw new Error(
          `task alert delivery is already terminal: ${input.alertID}/${input.channel}`,
        );
      const attempts = delivery.attempts + 1;
      const permanent =
        input.outcome === "permanent" ||
        (input.outcome === "transient" && attempts >= maxAttempts);
      const state: NataliaTaskAlertDeliveryState =
        input.outcome === "delivered"
          ? "delivered"
          : permanent
            ? "failed"
            : "pending";
      const nextAttemptAt =
        state === "pending"
          ? new Date(
              Date.parse(at) +
                backoffDelayMs({
                  attempts,
                  baseBackoffMs: input.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS,
                  maxBackoffMs: input.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS,
                  jitter: input.jitter ?? Math.random,
                }),
            ).toISOString()
          : undefined;
      this.#db
        .query(
          "UPDATE task_alert_deliveries SET state = ?, attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE alert_id = ? AND channel = ?",
        )
        .run(
          state,
          attempts,
          nextAttemptAt ?? null,
          input.outcome === "delivered"
            ? null
            : (boundedReason(input.error) ?? null),
          at,
          input.alertID,
          input.channel,
        );
      return this.requireDelivery(input.alertID, input.channel);
    })();
  }

  queuePressure(input: { limit?: number } = {}): TaskAlertQueuePressure {
    const limit = input.limit ?? DEFAULT_PENDING_LIMIT;
    const counts = new Map<string, number>(
      this.#db
        .query<{ state: NataliaTaskAlertDeliveryState; count: number }, []>(
          "SELECT state, COUNT(*) AS count FROM task_alert_deliveries GROUP BY state",
        )
        .all()
        .map((row) => [row.state, row.count]),
    );
    const pending = counts.get("pending") ?? 0;
    return {
      pending,
      delivered: counts.get("delivered") ?? 0,
      failed: counts.get("failed") ?? 0,
      limit,
      overLimit: pending > limit,
    };
  }

  /**
   * Retention is bounded but never silently loses a notification that still has
   * work to do: alerts with a pending delivery are always kept, and pruned
   * batches leave a durable per-task summary behind.
   */
  prune(
    input: {
      now?: string;
      deliveredRetentionDays?: number;
      failedRetentionDays?: number;
    } = {},
  ): TaskAlertPruneResult {
    const now = input.now ?? new Date().toISOString();
    const nowMs = Date.parse(now);
    const deliveredCutoff =
      nowMs -
      (input.deliveredRetentionDays ?? DEFAULT_DELIVERED_RETENTION_DAYS) *
        86_400_000;
    const failedCutoff =
      nowMs -
      (input.failedRetentionDays ?? DEFAULT_FAILED_RETENTION_DAYS) * 86_400_000;
    return this.#db.transaction(() => {
      const rows = this.#db
        .query<
          {
            alert_id: string;
            task_id: string;
            event_kind: NataliaTaskAlertEventKind;
            created_at: string;
            pending: number;
            failed: number;
            deliveries: number;
          },
          []
        >(
          `SELECT alert.alert_id, alert.task_id, alert.event_kind, alert.created_at,
                  SUM(CASE WHEN delivery.state = 'pending' THEN 1 ELSE 0 END) AS pending,
                  SUM(CASE WHEN delivery.state = 'failed' THEN 1 ELSE 0 END) AS failed,
                  COUNT(delivery.channel) AS deliveries
           FROM task_alerts alert
           LEFT JOIN task_alert_deliveries delivery ON delivery.alert_id = alert.alert_id
           GROUP BY alert.alert_id`,
        )
        .all();
      const deleteAlert = this.#db.query(
        "DELETE FROM task_alerts WHERE alert_id = ?",
      );
      const deleteDeliveries = this.#db.query(
        "DELETE FROM task_alert_deliveries WHERE alert_id = ?",
      );
      const summarize = this.#db.query(
        `INSERT INTO task_alert_retention(task_id, event_kind, pruned_count, last_pruned_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(task_id, event_kind) DO UPDATE SET
           pruned_count = pruned_count + excluded.pruned_count,
           last_pruned_at = excluded.last_pruned_at`,
      );
      let alerts = 0;
      let deliveries = 0;
      for (const row of rows) {
        if (row.pending) continue;
        const cutoff = row.failed ? failedCutoff : deliveredCutoff;
        if (Date.parse(row.created_at) > cutoff) continue;
        deleteDeliveries.run(row.alert_id);
        deleteAlert.run(row.alert_id);
        summarize.run(row.task_id, row.event_kind, 1, now);
        alerts += 1;
        deliveries += row.deliveries;
      }
      return { alerts, deliveries };
    })();
  }

  retentionSummary(taskID?: string) {
    const rows = taskID
      ? this.#db
          .query<
            RetentionRow,
            [string]
          >("SELECT * FROM task_alert_retention WHERE task_id = ? ORDER BY event_kind")
          .all(taskID)
      : this.#db
          .query<
            RetentionRow,
            []
          >("SELECT * FROM task_alert_retention ORDER BY task_id, event_kind")
          .all();
    return rows.map((row) => ({
      taskID: row.task_id,
      eventKind: row.event_kind,
      prunedCount: row.pruned_count,
      lastPrunedAt: row.last_pruned_at,
    }));
  }

  private migrate() {
    const version =
      this.#db.query<{ user_version: number }, []>("PRAGMA user_version").get()
        ?.user_version ?? 0;
    if (version > SCHEMA_VERSION)
      throw new Error(`unsupported task alert schema version: ${version}`);
    if (version === 0) {
      this.#db.exec(`
        CREATE TABLE task_alerts (
          alert_id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          invocation_id TEXT NOT NULL,
          attempt INTEGER NOT NULL,
          episode_id TEXT,
          event_kind TEXT NOT NULL,
          status TEXT NOT NULL,
          reason TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(task_id, invocation_id, attempt, event_kind)
        );
        CREATE INDEX task_alerts_task_created ON task_alerts(task_id, created_at);
        CREATE TABLE task_alert_deliveries (
          alert_id TEXT NOT NULL REFERENCES task_alerts(alert_id),
          channel TEXT NOT NULL,
          state TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at TEXT,
          last_error TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(alert_id, channel)
        );
        CREATE INDEX task_alert_deliveries_state ON task_alert_deliveries(state, next_attempt_at);
        CREATE TABLE task_alert_retention (
          task_id TEXT NOT NULL,
          event_kind TEXT NOT NULL,
          pruned_count INTEGER NOT NULL,
          last_pruned_at TEXT NOT NULL,
          PRIMARY KEY(task_id, event_kind)
        );
      `);
      this.#db.exec("PRAGMA user_version = 1");
    }
  }

  private requireDelivery(alertID: string, channel: string) {
    const row = this.#db
      .query<
        DeliveryRow,
        [string, string]
      >("SELECT * FROM task_alert_deliveries WHERE alert_id = ? AND channel = ?")
      .get(alertID, channel);
    if (!row)
      throw new Error(`task alert delivery not found: ${alertID}/${channel}`);
    return deliveryFromRow(row);
  }
}

function backoffDelayMs(input: {
  attempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  jitter: () => number;
}) {
  const exponential = Math.min(
    input.maxBackoffMs,
    input.baseBackoffMs * 2 ** (input.attempts - 1),
  );
  const jitter = Math.min(1, Math.max(0, input.jitter()));
  return Math.round(exponential * (0.5 + jitter * 0.5));
}

/**
 * Alert payloads carry a short operator-readable reason, never a transcript.
 * Collapsing whitespace and bounding the length keeps tool output, evaluator
 * context and multi-line model text structurally out of the queue.
 */
function boundedReason(reason?: string): string | undefined {
  if (!reason) return undefined;
  const collapsed = reason.replace(/\s+/gu, " ").trim();
  if (!collapsed) return undefined;
  return collapsed.length > REASON_MAX_LENGTH
    ? `${collapsed.slice(0, REASON_MAX_LENGTH - 1)}\u2026`
    : collapsed;
}

function normalizedChannels(channels?: string[]): string[] {
  return [
    ...new Set(
      (channels ?? []).map((channel) => channel.trim()).filter(Boolean),
    ),
  ].sort();
}

type AlertRow = {
  alert_id: string;
  task_id: string;
  invocation_id: string;
  attempt: number;
  episode_id: string | null;
  event_kind: NataliaTaskAlertEventKind;
  status: string;
  reason: string | null;
  created_at: string;
};

function alertFromRow(row: AlertRow): NataliaTaskAlert {
  return {
    alertID: row.alert_id,
    taskID: row.task_id,
    invocationID: row.invocation_id,
    attempt: row.attempt,
    episodeID: (row.episode_id as EpisodeID | null) ?? undefined,
    eventKind: row.event_kind,
    status: row.status,
    reason: row.reason ?? undefined,
    createdAt: row.created_at,
  };
}

type DeliveryRow = {
  alert_id: string;
  channel: string;
  state: NataliaTaskAlertDeliveryState;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  updated_at: string;
};

function deliveryFromRow(row: DeliveryRow): NataliaTaskAlertDelivery {
  return {
    alertID: row.alert_id,
    channel: row.channel,
    state: row.state,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at ?? undefined,
    lastError: row.last_error ?? undefined,
    updatedAt: row.updated_at,
  };
}

type RetentionRow = {
  task_id: string;
  event_kind: NataliaTaskAlertEventKind;
  pruned_count: number;
  last_pruned_at: string;
};
