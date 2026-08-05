import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type { EpisodeID, SessionID } from "@natalia/contracts";
import type { NataliaFlowModuleType } from "./natalia-module-policy";

const SCHEMA_VERSION = 3;
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

export type NataliaFlowModuleStatus =
  | "activated"
  | "claimed"
  | "completed"
  | "blocked"
  | "stalled";

export type NataliaFlowModuleEventKind =
  | "flow.module_activated"
  | "flow.module_claimed"
  | "flow.module_evaluated"
  | "flow.module_continued"
  | "flow.module_completed"
  | "flow.module_blocked"
  | "flow.module_stalled";

export type NataliaFlowModuleEvent = {
  invocationID: string;
  attempt: number;
  flowID: string;
  moduleID: string;
  kind: NataliaFlowModuleEventKind;
  at: string;
  data: Record<string, unknown>;
};

export type NataliaFlowModuleClaim = {
  flowID: string;
  moduleID: string;
  conditionStatuses: Array<{
    id: string;
    status: "missing" | "partial" | "satisfied";
  }>;
  evidenceRefs: string[];
  gaps: string[];
  recommendedAction: string;
};

export type NataliaPlannedFlowModule = {
  flowID: string;
  moduleID: string;
  moduleType: NataliaFlowModuleType;
  conditionIDs: string[];
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

  /** Read-only history for auditing and for the scheduled task surfaces. */
  invocations(taskID: string, limit = 20): NataliaTaskInvocation[] {
    return this.#db
      .query<
        InvocationRow,
        [string, number]
      >("SELECT * FROM task_invocations WHERE task_id = ? ORDER BY started_at DESC, invocation_id DESC LIMIT ?")
      .all(taskID, limit)
      .map(invocationFromRow);
  }

  attempts(invocationID: string): NataliaTaskAttempt[] {
    return this.#db
      .query<
        AttemptRow,
        [string]
      >("SELECT * FROM task_attempts WHERE invocation_id = ? ORDER BY attempt")
      .all(invocationID)
      .map(attemptFromRow);
  }

  initializeModulePlan(input: {
    invocationID: string;
    attempt: number;
    modules: NataliaPlannedFlowModule[];
  }) {
    if (!input.modules.length) throw new Error("module plan must not be empty");
    const ids = new Set<string>();
    for (const module of input.modules) {
      if (!module.flowID || !module.moduleID || !module.moduleType)
        throw new Error(
          "module plan requires flowID, moduleID, and moduleType",
        );
      if (ids.has(module.moduleID))
        throw new Error(`duplicate module in plan: ${module.moduleID}`);
      ids.add(module.moduleID);
    }
    this.#db.transaction(() => {
      this.requireRunningAttempt(input.invocationID, input.attempt);
      const existing = this.#db
        .query<
          { count: number },
          [string, number]
        >("SELECT COUNT(*) AS count FROM task_flow_module_plan WHERE invocation_id = ? AND attempt = ?")
        .get(input.invocationID, input.attempt);
      if (existing?.count)
        throw new Error("module plan is already initialized");
      const insert = this.#db.query(
        "INSERT INTO task_flow_module_plan VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      input.modules.forEach((module, ordinal) =>
        insert.run(
          input.invocationID,
          input.attempt,
          ordinal,
          module.flowID,
          module.moduleID,
          module.moduleType,
          JSON.stringify([...new Set(module.conditionIDs)]),
        ),
      );
    })();
  }

  activateNextModule(input: {
    invocationID: string;
    attempt: number;
    episodeID?: EpisodeID;
    sessionID?: SessionID;
    at?: string;
  }): NataliaPlannedFlowModule | undefined {
    const at = input.at ?? new Date().toISOString();
    return this.#db.transaction(() => {
      this.requireRunningAttempt(input.invocationID, input.attempt);
      const active = this.#db
        .query<
          ModuleRow,
          [string, number]
        >("SELECT * FROM task_flow_modules WHERE invocation_id = ? AND attempt = ? AND status IN ('activated', 'claimed')")
        .get(input.invocationID, input.attempt);
      if (active)
        throw new Error(
          `another flow module is active: ${active.flow_id}/${active.module_id}`,
        );
      const plan = this.#db
        .query<PlannedModuleRow, [string, number]>(
          `SELECT plan.* FROM task_flow_module_plan plan
           LEFT JOIN task_flow_modules module ON module.invocation_id = plan.invocation_id
             AND module.attempt = plan.attempt AND module.flow_id = plan.flow_id
             AND module.module_id = plan.module_id
           WHERE plan.invocation_id = ? AND plan.attempt = ? AND module.module_id IS NULL
           ORDER BY plan.ordinal LIMIT 1`,
        )
        .get(input.invocationID, input.attempt);
      if (!plan) return undefined;
      const incompletePrior = this.#db
        .query<{ count: number }, [string, number, number]>(
          `SELECT COUNT(*) AS count FROM task_flow_module_plan plan
           LEFT JOIN task_flow_modules module ON module.invocation_id = plan.invocation_id
             AND module.attempt = plan.attempt AND module.flow_id = plan.flow_id
             AND module.module_id = plan.module_id
           WHERE plan.invocation_id = ? AND plan.attempt = ? AND plan.ordinal < ?
             AND (module.status IS NULL OR module.status != 'completed')`,
        )
        .get(input.invocationID, input.attempt, plan.ordinal);
      if (incompletePrior?.count)
        throw new Error(
          "cannot activate the next module before prior modules complete",
        );
      const module = plannedModuleFromRow(plan);
      this.insertActivatedModule(
        input.invocationID,
        input.attempt,
        module,
        at,
        {
          episodeID: input.episodeID,
          sessionID: input.sessionID,
        },
      );
      return module;
    })();
  }

  activateModule(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
    conditionIDs: string[];
    at?: string;
  }) {
    const at = input.at ?? new Date().toISOString();
    this.#db.transaction(() => {
      this.requireRunningAttempt(input.invocationID, input.attempt);
      const active = this.#db
        .query<
          ModuleRow,
          [string, number]
        >("SELECT * FROM task_flow_modules WHERE invocation_id = ? AND attempt = ? AND status IN ('activated', 'claimed')")
        .get(input.invocationID, input.attempt);
      if (active)
        throw new Error(
          `another flow module is active: ${active.flow_id}/${active.module_id}`,
        );
      const existing = this.#db
        .query<
          ModuleRow,
          [string, number, string, string]
        >("SELECT * FROM task_flow_modules WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?")
        .get(input.invocationID, input.attempt, input.flowID, input.moduleID);
      if (existing)
        throw new Error(`flow module was already activated: ${input.moduleID}`);
      this.#db
        .query(
          "INSERT INTO task_flow_modules VALUES (?, ?, ?, ?, 'activated', ?, ?)",
        )
        .run(
          input.invocationID,
          input.attempt,
          input.flowID,
          input.moduleID,
          JSON.stringify([...new Set(input.conditionIDs)]),
          at,
        );
      this.appendModuleEvent({
        ...input,
        kind: "flow.module_activated",
        at,
        data: {},
      });
    })();
  }

  recordModuleEvidence(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
    ref: string;
    at?: string;
  }) {
    const at = input.at ?? new Date().toISOString();
    this.#db.transaction(() => {
      this.requireActiveModule(input);
      this.#db
        .query(
          "INSERT OR IGNORE INTO task_flow_evidence VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          input.invocationID,
          input.attempt,
          input.flowID,
          input.moduleID,
          input.ref,
          at,
        );
    })();
  }

  validateModuleEvidenceRefs(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
    refs: string[];
  }) {
    this.requireRunningAttempt(input.invocationID, input.attempt);
    const module = this.requireModule(input);
    if (module.status !== "claimed")
      throw new Error(`flow module is not claimed: ${input.moduleID}`);
    const owned = new Set(
      this.#db
        .query<{ ref: string }, [string, number, string, string]>(
          "SELECT ref FROM task_flow_evidence WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?",
        )
        .all(input.invocationID, input.attempt, input.flowID, input.moduleID)
        .map((row) => row.ref),
    );
    for (const ref of input.refs)
      if (!owned.has(ref))
        throw new Error(
          `evaluator references unknown attempt evidence: ${ref}`,
        );
  }

  moduleEvidenceRefs(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
  }) {
    this.requireRunningAttempt(input.invocationID, input.attempt);
    this.requireModule(input);
    return this.#db
      .query<{ ref: string }, [string, number, string, string]>(
        "SELECT ref FROM task_flow_evidence WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ? ORDER BY recorded_at, ref",
      )
      .all(input.invocationID, input.attempt, input.flowID, input.moduleID)
      .map((row) => row.ref);
  }

  claimModule(input: {
    invocationID: string;
    attempt: number;
    claim: NataliaFlowModuleClaim;
    at?: string;
  }) {
    const at = input.at ?? new Date().toISOString();
    this.#db.transaction(() => {
      const module = this.requireActiveModule({ ...input, ...input.claim });
      const expected = JSON.parse(module.condition_ids) as string[];
      const claimed = input.claim.conditionStatuses.map(
        (condition) => condition.id,
      );
      if (
        claimed.length !== expected.length ||
        new Set(claimed).size !== claimed.length ||
        expected.some((id) => !claimed.includes(id))
      )
        throw new Error(
          "module claim must include each declared condition exactly once",
        );
      const evidence = new Set(
        this.#db
          .query<{ ref: string }, [string, number, string, string]>(
            "SELECT ref FROM task_flow_evidence WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?",
          )
          .all(
            input.invocationID,
            input.attempt,
            input.claim.flowID,
            input.claim.moduleID,
          )
          .map((row) => row.ref),
      );
      for (const ref of input.claim.evidenceRefs)
        if (!evidence.has(ref))
          throw new Error(
            `module claim references unknown attempt evidence: ${ref}`,
          );
      this.#db
        .query(
          "UPDATE task_flow_modules SET status = 'claimed' WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?",
        )
        .run(
          input.invocationID,
          input.attempt,
          input.claim.flowID,
          input.claim.moduleID,
        );
      this.appendModuleEvent({
        invocationID: input.invocationID,
        attempt: input.attempt,
        flowID: input.claim.flowID,
        moduleID: input.claim.moduleID,
        kind: "flow.module_claimed",
        at,
        data: input.claim as unknown as Record<string, unknown>,
      });
    })();
  }

  evaluateModule(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
    outcome: "complete" | "incomplete" | "blocked";
    data?: Record<string, unknown>;
    at?: string;
  }) {
    const at = input.at ?? new Date().toISOString();
    this.#db.transaction(() => {
      const module = this.requireModule(input);
      if (module.status !== "claimed")
        throw new Error(
          `flow module must be claimed before evaluation: ${input.moduleID}`,
        );
      this.appendModuleEvent({
        ...input,
        kind: "flow.module_evaluated",
        at,
        data: { outcome: input.outcome, ...input.data },
      });
      const kind: NataliaFlowModuleEventKind =
        input.outcome === "complete"
          ? "flow.module_completed"
          : input.outcome === "blocked"
            ? "flow.module_blocked"
            : "flow.module_continued";
      const status: NataliaFlowModuleStatus =
        input.outcome === "complete"
          ? "completed"
          : input.outcome === "blocked"
            ? "blocked"
            : "activated";
      this.#db
        .query(
          "UPDATE task_flow_modules SET status = ? WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?",
        )
        .run(
          status,
          input.invocationID,
          input.attempt,
          input.flowID,
          input.moduleID,
        );
      this.appendModuleEvent({ ...input, kind, at, data: input.data ?? {} });
    })();
  }

  stallModule(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
    reason: string;
    at?: string;
  }) {
    const at = input.at ?? new Date().toISOString();
    this.#db.transaction(() => {
      this.requireRunningAttempt(input.invocationID, input.attempt);
      const module = this.requireModule(input);
      if (module.status !== "activated" && module.status !== "claimed")
        throw new Error(`flow module cannot stall from ${module.status}`);
      this.#db
        .query(
          "UPDATE task_flow_modules SET status = 'stalled' WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?",
        )
        .run(input.invocationID, input.attempt, input.flowID, input.moduleID);
      this.appendModuleEvent({
        ...input,
        kind: "flow.module_stalled",
        at,
        data: { reason: input.reason },
      });
    })();
  }

  moduleEvents(
    invocationID: string,
    attempt: number,
  ): NataliaFlowModuleEvent[] {
    return this.#db
      .query<
        ModuleEventRow,
        [string, number]
      >("SELECT * FROM task_flow_module_events WHERE invocation_id = ? AND attempt = ? ORDER BY seq")
      .all(invocationID, attempt)
      .map(moduleEventFromRow);
  }

  allModulesCompleted(invocationID: string, attempt: number): boolean {
    const rows = this.#db
      .query<{ status: NataliaFlowModuleStatus | null }, [string, number]>(
        `SELECT module.status AS status
         FROM task_flow_module_plan plan
         LEFT JOIN task_flow_modules module ON module.invocation_id = plan.invocation_id
           AND module.attempt = plan.attempt AND module.flow_id = plan.flow_id
           AND module.module_id = plan.module_id
         WHERE plan.invocation_id = ? AND plan.attempt = ?
         ORDER BY plan.ordinal`,
      )
      .all(invocationID, attempt);
    return rows.length > 0 && rows.every((row) => row.status === "completed");
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
      `);
      this.#db.exec("PRAGMA user_version = 1");
    }
    if (version <= 1) {
      this.#db.exec(`
        CREATE TABLE task_flow_modules (
          invocation_id TEXT NOT NULL REFERENCES task_invocations(invocation_id),
          attempt INTEGER NOT NULL,
          flow_id TEXT NOT NULL,
          module_id TEXT NOT NULL,
          status TEXT NOT NULL,
          condition_ids TEXT NOT NULL,
          activated_at TEXT NOT NULL,
          PRIMARY KEY(invocation_id, attempt, flow_id, module_id),
          FOREIGN KEY(invocation_id, attempt) REFERENCES task_attempts(invocation_id, attempt)
        );
        CREATE TABLE task_flow_evidence (
          invocation_id TEXT NOT NULL,
          attempt INTEGER NOT NULL,
          flow_id TEXT NOT NULL,
          module_id TEXT NOT NULL,
          ref TEXT NOT NULL,
          recorded_at TEXT NOT NULL,
          PRIMARY KEY(invocation_id, attempt, flow_id, module_id, ref)
        );
        CREATE TABLE task_flow_module_events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          invocation_id TEXT NOT NULL,
          attempt INTEGER NOT NULL,
          flow_id TEXT NOT NULL,
          module_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          at TEXT NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX task_flow_module_events_attempt ON task_flow_module_events(invocation_id, attempt, seq);
      `);
      this.#db.exec("PRAGMA user_version = 2");
    }
    if (version <= 2) {
      this.#db.exec(`
        CREATE TABLE task_flow_module_plan (
          invocation_id TEXT NOT NULL REFERENCES task_invocations(invocation_id),
          attempt INTEGER NOT NULL,
          ordinal INTEGER NOT NULL,
          flow_id TEXT NOT NULL,
          module_id TEXT NOT NULL,
          module_type TEXT NOT NULL,
          condition_ids TEXT NOT NULL,
          PRIMARY KEY(invocation_id, attempt, ordinal),
          UNIQUE(invocation_id, attempt, flow_id, module_id),
          FOREIGN KEY(invocation_id, attempt) REFERENCES task_attempts(invocation_id, attempt)
        );
      `);
      this.#db.exec("PRAGMA user_version = 3");
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

  private requireRunningAttempt(invocationID: string, attempt: number) {
    const result = this.requireAttempt(invocationID, attempt);
    if (result.status !== "running")
      throw new Error(
        `task attempt is not running: ${invocationID}/${attempt}`,
      );
  }

  private insertActivatedModule(
    invocationID: string,
    attempt: number,
    module: NataliaPlannedFlowModule,
    at: string,
    execution: { episodeID?: EpisodeID; sessionID?: SessionID } = {},
  ) {
    this.#db
      .query(
        "INSERT INTO task_flow_modules VALUES (?, ?, ?, ?, 'activated', ?, ?)",
      )
      .run(
        invocationID,
        attempt,
        module.flowID,
        module.moduleID,
        JSON.stringify(module.conditionIDs),
        at,
      );
    this.appendModuleEvent({
      invocationID,
      attempt,
      flowID: module.flowID,
      moduleID: module.moduleID,
      kind: "flow.module_activated",
      at,
      data: {
        moduleType: module.moduleType,
        ordinal: this.moduleOrdinal(invocationID, attempt, module),
        ...(execution.episodeID ? { episodeID: execution.episodeID } : {}),
        ...(execution.sessionID ? { sessionID: execution.sessionID } : {}),
      },
    });
  }

  private moduleOrdinal(
    invocationID: string,
    attempt: number,
    module: NataliaPlannedFlowModule,
  ) {
    return this.#db
      .query<
        { ordinal: number },
        [string, number, string, string]
      >("SELECT ordinal FROM task_flow_module_plan WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?")
      .get(invocationID, attempt, module.flowID, module.moduleID)?.ordinal;
  }

  private requireModule(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
  }) {
    const module = this.#db
      .query<
        ModuleRow,
        [string, number, string, string]
      >("SELECT * FROM task_flow_modules WHERE invocation_id = ? AND attempt = ? AND flow_id = ? AND module_id = ?")
      .get(input.invocationID, input.attempt, input.flowID, input.moduleID);
    if (!module)
      throw new Error(`flow module is not active: ${input.moduleID}`);
    return module;
  }

  private requireActiveModule(input: {
    invocationID: string;
    attempt: number;
    flowID: string;
    moduleID: string;
  }) {
    this.requireRunningAttempt(input.invocationID, input.attempt);
    const module = this.requireModule(input);
    if (module.status !== "activated")
      throw new Error(`flow module is not active: ${input.moduleID}`);
    return module;
  }

  private appendModuleEvent(event: NataliaFlowModuleEvent) {
    this.#db
      .query(
        "INSERT INTO task_flow_module_events(invocation_id, attempt, flow_id, module_id, kind, at, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        event.invocationID,
        event.attempt,
        event.flowID,
        event.moduleID,
        event.kind,
        event.at,
        JSON.stringify(event.data),
      );
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

type AttemptRow = {
  invocation_id: string;
  attempt: number;
  episode_id: string;
  session_id: string;
  status: NataliaTaskAttemptStatus;
  started_at: string;
  ended_at: string | null;
  reason: string | null;
};

function attemptFromRow(row: AttemptRow): NataliaTaskAttempt {
  return {
    invocationID: row.invocation_id,
    attempt: row.attempt,
    episodeID: row.episode_id as EpisodeID,
    sessionID: row.session_id as SessionID,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    reason: row.reason ?? undefined,
  };
}

type ModuleRow = {
  invocation_id: string;
  attempt: number;
  flow_id: string;
  module_id: string;
  status: NataliaFlowModuleStatus;
  condition_ids: string;
  activated_at: string;
};

type ModuleEventRow = {
  invocation_id: string;
  attempt: number;
  flow_id: string;
  module_id: string;
  kind: NataliaFlowModuleEventKind;
  at: string;
  data: string;
};

type PlannedModuleRow = {
  invocation_id: string;
  attempt: number;
  ordinal: number;
  flow_id: string;
  module_id: string;
  module_type: string;
  condition_ids: string;
};

function plannedModuleFromRow(row: PlannedModuleRow): NataliaPlannedFlowModule {
  return {
    flowID: row.flow_id,
    moduleID: row.module_id,
    moduleType: row.module_type as NataliaFlowModuleType,
    conditionIDs: JSON.parse(row.condition_ids) as string[],
  };
}

function moduleEventFromRow(row: ModuleEventRow): NataliaFlowModuleEvent {
  return {
    invocationID: row.invocation_id,
    attempt: row.attempt,
    flowID: row.flow_id,
    moduleID: row.module_id,
    kind: row.kind,
    at: row.at,
    data: JSON.parse(row.data) as Record<string, unknown>,
  };
}
