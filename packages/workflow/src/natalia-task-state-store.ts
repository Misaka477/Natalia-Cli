import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type { EpisodeID, SessionID } from "@natalia/contracts";

const SCHEMA_VERSION = 1;
const ACTIVE_STATUSES = ["running", "blocked", "retrying"] as const;

export type NataliaTaskInvocationStatus =
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled"
  | "stalled"
  | "skipped_due_to_overlap";

export type NataliaTaskAttemptStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled"
  | "stalled";

export type NataliaTaskInvocation = {
  invocationID: string;
  taskID: string;
  status: NataliaTaskInvocationStatus;
  startedAt: string;
  endedAt?: string;
  waterlineAdvanced: boolean;
  skipReason?: string;
};

export type NataliaTaskAttempt = {
  invocationID: string;
  attempt: number;
  episodeID: EpisodeID;
  sessionID: SessionID;
  status: NataliaTaskAttemptStatus;
  startedAt: string;
  endedAt?: string;
  reason?: string;
};

export type StartTaskInvocationResult =
  | {
      started: true;
      invocation: NataliaTaskInvocation;
      attempt: NataliaTaskAttempt;
    }
  | { started: false; invocation: NataliaTaskInvocation };

export class NataliaTaskStateStore {
  readonly path: string;
  #db: Database;

  constructor(workspaceRoot: string) {
    this.path = resolve(workspaceRoot, ".natalia", "tasks.db");
    this.#db = new Database(this.path, { create: true });
    this.#db.exec("PRAGMA journal_mode=WAL");
    this.#db.exec("PRAGMA foreign_keys=ON");
    this.#db.exec("PRAGMA busy_timeout=5000");
    this.migrate();
  }

  static async open(workspaceRoot: string) {
    const path = resolve(workspaceRoot, ".natalia", "tasks.db");
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    return new NataliaTaskStateStore(workspaceRoot);
  }

  close() {
    this.#db.close();
  }

  startInvocation(input: {
    invocationID: string;
    taskID: string;
    episodeID: EpisodeID;
    sessionID: SessionID;
    at?: string;
  }): StartTaskInvocationResult {
    const at = input.at ?? new Date().toISOString();
    const tx = this.#db.transaction(() => {
      const active = this.#db
        .query<{ invocation_id: string; started_at: string }, any>(
          `SELECT invocation_id, started_at FROM task_invocations
           WHERE task_id = ? AND status IN (${ACTIVE_STATUSES.map(() => "?").join(",")})
           ORDER BY started_at DESC LIMIT 1`,
        )
        .get(input.taskID, ...ACTIVE_STATUSES);
      if (active) {
        const invocation: NataliaTaskInvocation = {
          invocationID: input.invocationID,
          taskID: input.taskID,
          status: "skipped_due_to_overlap",
          startedAt: at,
          endedAt: at,
          waterlineAdvanced: false,
          skipReason: `active invocation ${active.invocation_id}`,
        };
        this.insertInvocation(invocation);
        return { started: false as const, invocation };
      }
      const invocation: NataliaTaskInvocation = {
        invocationID: input.invocationID,
        taskID: input.taskID,
        status: "running",
        startedAt: at,
        waterlineAdvanced: false,
      };
      const attempt: NataliaTaskAttempt = {
        invocationID: input.invocationID,
        attempt: 1,
        episodeID: input.episodeID,
        sessionID: input.sessionID,
        status: "running",
        startedAt: at,
      };
      this.insertInvocation(invocation);
      this.insertAttempt(attempt);
      return { started: true as const, invocation, attempt };
    });
    return tx();
  }

  recordAttempt(input: {
    invocationID: string;
    attempt: number;
    episodeID: EpisodeID;
    sessionID: SessionID;
    at?: string;
  }): NataliaTaskAttempt {
    const invocation = this.requireInvocation(input.invocationID);
    if (invocation.status !== "retrying")
      throw new Error(`task invocation is not retrying: ${input.invocationID}`);
    const attempt: NataliaTaskAttempt = {
      invocationID: input.invocationID,
      attempt: input.attempt,
      episodeID: input.episodeID,
      sessionID: input.sessionID,
      status: "running",
      startedAt: input.at ?? new Date().toISOString(),
    };
    this.#db.transaction(() => {
      this.insertAttempt(attempt);
      this.#db
        .query(
          "UPDATE task_invocations SET status = 'running' WHERE invocation_id = ?",
        )
        .run(input.invocationID);
    })();
    return attempt;
  }

  completeAttempt(input: {
    invocationID: string;
    attempt: number;
    status: Exclude<NataliaTaskAttemptStatus, "running">;
    retry: boolean;
    reason?: string;
    at?: string;
  }) {
    const at = input.at ?? new Date().toISOString();
    this.#db.transaction(() => {
      const attempt = this.requireAttempt(input.invocationID, input.attempt);
      if (attempt.status !== "running")
        throw new Error(
          `task attempt is already terminal: ${input.invocationID}/${input.attempt}`,
        );
      this.#db
        .query(
          "UPDATE task_attempts SET status = ?, ended_at = ?, reason = ? WHERE invocation_id = ? AND attempt = ?",
        )
        .run(
          input.status,
          at,
          input.reason ?? null,
          input.invocationID,
          input.attempt,
        );
      const invocationStatus: NataliaTaskInvocationStatus = input.retry
        ? "retrying"
        : input.status;
      this.#db
        .query(
          "UPDATE task_invocations SET status = ?, ended_at = ?, waterline_advanced = ? WHERE invocation_id = ?",
        )
        .run(
          invocationStatus,
          input.retry ? null : at,
          input.status === "succeeded" ? 1 : 0,
          input.invocationID,
        );
      if (input.status === "succeeded" && !input.retry)
        this.#db
          .query(
            "INSERT INTO task_waterlines(task_id, invocation_id, advanced_at) VALUES (?, ?, ?) ON CONFLICT(task_id) DO UPDATE SET invocation_id = excluded.invocation_id, advanced_at = excluded.advanced_at",
          )
          .run(
            this.requireInvocation(input.invocationID).taskID,
            input.invocationID,
            at,
          );
    })();
  }

  getInvocation(invocationID: string): NataliaTaskInvocation | undefined {
    const row = this.#db
      .query<
        InvocationRow,
        [string]
      >("SELECT * FROM task_invocations WHERE invocation_id = ?")
      .get(invocationID);
    return row ? invocationFromRow(row) : undefined;
  }

  getWaterline(taskID: string) {
    const row = this.#db
      .query<
        {
          invocation_id: string;
          advanced_at: string;
        },
        [string]
      >(
        "SELECT invocation_id, advanced_at FROM task_waterlines WHERE task_id = ?",
      )
      .get(taskID);
    return row
      ? { invocationID: row.invocation_id, advancedAt: row.advanced_at }
      : undefined;
  }

  private migrate() {
    const version =
      this.#db.query<{ user_version: number }, []>("PRAGMA user_version").get()
        ?.user_version ?? 0;
    if (version > SCHEMA_VERSION)
      throw new Error(`unsupported task state schema version: ${version}`);
    if (version === 0) {
      this.#db.exec(`
        CREATE TABLE task_invocations (
          invocation_id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          waterline_advanced INTEGER NOT NULL DEFAULT 0,
          skip_reason TEXT
        );
        CREATE INDEX task_invocations_task_status ON task_invocations(task_id, status, started_at);
        CREATE TABLE task_attempts (
          invocation_id TEXT NOT NULL REFERENCES task_invocations(invocation_id),
          attempt INTEGER NOT NULL,
          episode_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          reason TEXT,
          PRIMARY KEY(invocation_id, attempt)
        );
        CREATE TABLE task_waterlines (
          task_id TEXT PRIMARY KEY,
          invocation_id TEXT NOT NULL REFERENCES task_invocations(invocation_id),
          advanced_at TEXT NOT NULL
        );
        PRAGMA user_version = 1;
      `);
    }
  }

  private insertInvocation(invocation: NataliaTaskInvocation) {
    this.#db
      .query("INSERT INTO task_invocations VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        invocation.invocationID,
        invocation.taskID,
        invocation.status,
        invocation.startedAt,
        invocation.endedAt ?? null,
        invocation.waterlineAdvanced ? 1 : 0,
        invocation.skipReason ?? null,
      );
  }

  private insertAttempt(attempt: NataliaTaskAttempt) {
    this.#db
      .query("INSERT INTO task_attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        attempt.invocationID,
        attempt.attempt,
        attempt.episodeID,
        attempt.sessionID,
        attempt.status,
        attempt.startedAt,
        attempt.endedAt ?? null,
        attempt.reason ?? null,
      );
  }

  private requireInvocation(invocationID: string) {
    const invocation = this.getInvocation(invocationID);
    if (!invocation)
      throw new Error(`task invocation not found: ${invocationID}`);
    return invocation;
  }

  private requireAttempt(invocationID: string, attempt: number) {
    const result = this.#db
      .query<
        {
          status: NataliaTaskAttemptStatus;
        },
        [string, number]
      >(
        "SELECT status FROM task_attempts WHERE invocation_id = ? AND attempt = ?",
      )
      .get(invocationID, attempt);
    if (!result)
      throw new Error(`task attempt not found: ${invocationID}/${attempt}`);
    return result;
  }
}

type InvocationRow = {
  invocation_id: string;
  task_id: string;
  status: NataliaTaskInvocationStatus;
  started_at: string;
  ended_at: string | null;
  waterline_advanced: number;
  skip_reason: string | null;
};

function invocationFromRow(row: InvocationRow): NataliaTaskInvocation {
  return {
    invocationID: row.invocation_id,
    taskID: row.task_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    waterlineAdvanced: Boolean(row.waterline_advanced),
    skipReason: row.skip_reason ?? undefined,
  };
}
