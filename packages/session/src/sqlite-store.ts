import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type {
  DurableContextCheckpointRecord,
  RuntimeEvent,
  RuntimeMessagePage,
  SessionID,
} from "@natalia/contracts";
import type { SessionRecord } from "./index";
import type { AdmittedSessionInput } from "./inbox";
import {
  decodeMessageCursor,
  encodeMessageCursor,
  projectTurnMessage,
} from "./projector";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  cancelled INTEGER NOT NULL DEFAULT 0,
  resumable INTEGER NOT NULL DEFAULT 1,
  pinned INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  event TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, seq);

CREATE TABLE IF NOT EXISTS message_turns (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_id TEXT NOT NULL,
  start_seq INTEGER NOT NULL,
  PRIMARY KEY(session_id, turn_id)
);

CREATE INDEX IF NOT EXISTS idx_message_turns_session_seq
  ON message_turns(session_id, start_seq);

CREATE TABLE IF NOT EXISTS session_inputs (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  id TEXT NOT NULL,
  text TEXT NOT NULL,
  attachments TEXT,
  resources TEXT,
  agents TEXT,
  delivery TEXT NOT NULL,
  admitted_at TEXT NOT NULL,
  admitted_seq INTEGER NOT NULL,
  promoted_at TEXT,
  promoted_seq INTEGER,
  PRIMARY KEY(session_id, id)
);

CREATE INDEX IF NOT EXISTS idx_session_inputs_pending
  ON session_inputs(session_id, promoted_at, admitted_seq);

CREATE TABLE IF NOT EXISTS recovery_turns (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_id TEXT NOT NULL,
  active INTEGER NOT NULL,
  PRIMARY KEY(session_id, turn_id)
);

CREATE INDEX IF NOT EXISTS idx_recovery_turns_active
  ON recovery_turns(session_id, active);

CREATE TABLE IF NOT EXISTS recovery_interactive (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  request_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  event TEXT NOT NULL,
  PRIMARY KEY(session_id, request_id)
);

CREATE TABLE IF NOT EXISTS recovery_selection (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  agent_name TEXT,
  model_id TEXT,
  model_variant TEXT
);

CREATE TABLE IF NOT EXISTS recovery_attachments (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_id TEXT NOT NULL,
  attachments TEXT NOT NULL,
  PRIMARY KEY(session_id, turn_id)
);

CREATE TABLE IF NOT EXISTS recovery_diagnostics (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recovery_diagnostics_session_seq
  ON recovery_diagnostics(session_id, seq);

CREATE TABLE IF NOT EXISTS recovery_state (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  indexed_events INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS context_epochs (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  baseline_seq INTEGER NOT NULL,
  snapshot TEXT NOT NULL
);
`;

function isDurableFlushBarrier(event: RuntimeEvent) {
  return (
    event.type === "approval.response" ||
    event.type === "question.response" ||
    event.type === "turn.finished" ||
    event.type === "turn.cancelled" ||
    event.type === "context.checkpoint" ||
    event.type === "session.created" ||
    event.type === "session.ready"
  );
}

export type SessionRow = {
  id: SessionID;
  title: string;
  createdAt: string;
  cancelled: boolean;
  resumable: boolean;
  pinned: boolean;
  metadata: Record<string, unknown>;
};

export type StoredSessionEvent = { seq: number; event: RuntimeEvent };
export type StoredContextEpoch = {
  baselineSeq: number;
  snapshot: DurableContextCheckpointRecord;
};
export type StoredRecoveryProjection = {
  activeTurnIDs: string[];
  approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>;
  questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>;
  selectedAgent?: string;
  selectedModel?: { modelID?: string; variant?: string };
  attachments: Map<string, import("@natalia/contracts").LocalAttachment[]>;
  diagnostics: Array<Extract<RuntimeEvent, { type: "diagnostic" }>>;
};

export class SqliteSessionStore {
  private db: Database;
  private writeQueue = Promise.resolve();
  private readonly pendingAsyncEvents = new Map<SessionID, RuntimeEvent[]>();
  private readonly pendingFlushes = new Map<SessionID, Promise<void>>();
  private readonly scheduledFlushes = new Set<SessionID>();
  private readonly flushTimers = new Map<
    SessionID,
    ReturnType<typeof setTimeout>
  >();
  private closed = false;
  private insertEventStatement: ReturnType<Database["prepare"]>;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec("PRAGMA foreign_keys=ON");
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA synchronous=NORMAL");
    this.db.exec("PRAGMA busy_timeout=5000");
    this.db.exec(SCHEMA);
    this.insertEventStatement = this.db.prepare(
      `INSERT INTO events(session_id, event) VALUES (?, ?)`,
    );
  }

  close() {
    if (this.closed) return;
    // close() is synchronous by contract, so drain buffered async appends
    // before SQLite closes its WAL handle.
    for (const [sessionID, events] of this.pendingAsyncEvents) {
      if (events.length) this.writeBufferedBatch(sessionID, events.splice(0));
    }
    this.pendingAsyncEvents.clear();
    this.scheduledFlushes.clear();
    for (const timer of this.flushTimers.values()) clearTimeout(timer);
    this.flushTimers.clear();
    this.checkpoint();
    this.closed = true;
    this.db.close();
  }

  /** Runs passive WAL maintenance without forcing active readers to stop. */
  checkpoint() {
    const row = this.db.query(`PRAGMA wal_checkpoint(PASSIVE)`).get() as
      | Record<string, number>
      | undefined;
    return {
      busy: row?.busy ?? 0,
      logPages: row?.log ?? 0,
      checkpointedPages: row?.checkpointed ?? 0,
    };
  }

  create(id: SessionID, title: string, now = new Date()): SessionRow {
    this.run(
      `INSERT OR IGNORE INTO sessions(id, title, created_at) VALUES (?, ?, ?)`,
      [id, title, now.toISOString()],
    );
    return this.get(id)!;
  }

  get(id: SessionID): SessionRow | undefined {
    const row = this.db
      .query(
        `SELECT id, title, created_at, cancelled, resumable, pinned, metadata FROM sessions WHERE id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return rowToSession(row);
  }

  loadOrCreate(id: SessionID, title: string): SessionRow {
    return this.get(id) ?? this.create(id, title);
  }

  list(): SessionRow[] {
    const rows = this.db
      .query(
        `SELECT id, title, created_at, cancelled, resumable, pinned, metadata
         FROM sessions
         ORDER BY pinned DESC, json_extract(metadata, '$.lastAccessedAt') DESC, created_at DESC`,
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToSession);
  }

  rename(id: SessionID, title: string) {
    const trimmed = title.trim();
    if (!trimmed) throw new Error("session title cannot be empty");
    this.run(`UPDATE sessions SET title = ? WHERE id = ?`, [trimmed, id]);
    return this.get(id)!;
  }

  touch(id: SessionID, at = new Date().toISOString()) {
    this.updateMetadata(id, { lastAccessedAt: at });
    return this.get(id)!;
  }

  pin(id: SessionID, pinned: boolean) {
    this.updateMetadata(id, { pinned });
    return this.get(id)!;
  }

  duplicate(id: SessionID, newID?: SessionID, newTitle?: string) {
    const source = this.loadRecord(id);
    if (!source) throw new Error(`session not found: ${id}`);
    const targetID =
      newID ??
      (`ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}` as SessionID);
    const copy: SessionRecord = {
      ...source,
      id: targetID,
      title: newTitle ?? `${source.title} (copy)`,
      metadata: {
        ...source.metadata,
        lastAccessedAt: new Date().toISOString(),
      },
      inbox: source.inbox?.map((input) => ({ ...input, sessionID: targetID })),
    };
    this.replace(copy);
    return copy;
  }

  fork(id: SessionID, turnID: string, newID?: SessionID, newTitle?: string) {
    const source = this.loadRecord(id);
    if (!source) throw new Error(`session not found: ${id}`);
    const boundary = source.events.findIndex(
      (event) => event.type === "turn.submitted" && event.id === turnID,
    );
    if (boundary < 0) throw new Error(`turn not found: ${turnID}`);
    const targetID =
      newID ??
      (`ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}` as SessionID);
    const includedTurns = new Set(
      source.events
        .slice(0, boundary)
        .flatMap((event) =>
          event.type === "turn.submitted" ? [event.id] : [],
        ),
    );
    const fork: SessionRecord = {
      ...source,
      id: targetID,
      title: newTitle ?? `${source.title} (fork)`,
      events: structuredClone(source.events.slice(0, boundary)),
      metadata: {
        ...source.metadata,
        lastAccessedAt: new Date().toISOString(),
      },
      inbox: source.inbox
        ?.filter((input) => includedTurns.has(input.id))
        .map((input) => ({ ...input, sessionID: targetID })),
    };
    this.replace(fork);
    return fork;
  }

  delete(id: SessionID) {
    this.db.transaction(() => {
      this.deleteRecoveryProjection(id);
      this.run(`DELETE FROM context_epochs WHERE session_id = ?`, [id]);
      this.run(`DELETE FROM message_turns WHERE session_id = ?`, [id]);
      this.run(`DELETE FROM session_inputs WHERE session_id = ?`, [id]);
      this.run(`DELETE FROM events WHERE session_id = ?`, [id]);
      this.run(`DELETE FROM sessions WHERE id = ?`, [id]);
    })();
  }

  updateMetadata(id: SessionID, partial: Partial<SessionRow["metadata"]>) {
    const session = this.get(id);
    if (!session) throw new Error(`session not found: ${id}`);
    const next = { ...session.metadata, ...partial };
    this.run(`UPDATE sessions SET metadata = ?, pinned = ? WHERE id = ?`, [
      JSON.stringify(next),
      next.pinned === true ? 1 : 0,
      id,
    ]);
  }

  replace(session: SessionRecord) {
    const write = this.db.transaction(() => {
      this.run(`DELETE FROM context_epochs WHERE session_id = ?`, [session.id]);
      this.run(`DELETE FROM message_turns WHERE session_id = ?`, [session.id]);
      this.run(`DELETE FROM session_inputs WHERE session_id = ?`, [session.id]);
      this.deleteRecoveryProjection(session.id);
      this.run(`DELETE FROM events WHERE session_id = ?`, [session.id]);
      this.run(`DELETE FROM sessions WHERE id = ?`, [session.id]);
      this.run(
        `INSERT INTO sessions(id, title, created_at, cancelled, resumable, pinned, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.title,
          session.createdAt,
          session.cancelled ? 1 : 0,
          session.resumable ? 1 : 0,
          session.metadata?.pinned === true ? 1 : 0,
          JSON.stringify(session.metadata ?? {}),
        ],
      );
      for (const event of session.events) this.appendEvent(session.id, event);
      this.replaceInbox(session.id, session.inbox ?? []);
    });
    write();
  }

  appendEvent(sessionID: SessionID, event: RuntimeEvent) {
    this.db.transaction(() => {
      this.appendEventInTransaction(sessionID, event);
      this.bumpRecoveryState(sessionID);
    })();
  }

  appendEvents(sessionID: SessionID, events: RuntimeEvent[]) {
    const txn = this.db.transaction(() => {
      // This synchronous recovery-settlement helper deliberately retains its
      // established narrow semantics. New streaming batches use the complete
      // writeBufferedBatch path below.
      for (const event of events) {
        this.insertEvent(sessionID, event);
        this.applyRecoveryEvent(sessionID, event);
      }
      this.bumpRecoveryState(sessionID, events.length);
    });
    txn();
  }

  loadEvents(sessionID: SessionID): RuntimeEvent[] {
    const rows = this.db
      .query(`SELECT event FROM events WHERE session_id = ? ORDER BY seq`)
      .all(sessionID) as { event: string }[];
    return rows.map((r) => JSON.parse(r.event) as RuntimeEvent);
  }

  loadRecoveryProjection(sessionID: SessionID): StoredRecoveryProjection {
    this.ensureRecoveryProjection(sessionID);
    const active = this.db
      .query(
        `SELECT turn_id FROM recovery_turns WHERE session_id = ? AND active = 1`,
      )
      .all(sessionID) as Array<{ turn_id: string }>;
    const interactive = this.db
      .query(
        `SELECT kind, event FROM recovery_interactive WHERE session_id = ?`,
      )
      .all(sessionID) as Array<{ kind: string; event: string }>;
    const selection = this.db
      .query(
        `SELECT agent_name, model_id, model_variant FROM recovery_selection WHERE session_id = ?`,
      )
      .get(sessionID) as
      | { agent_name?: string; model_id?: string; model_variant?: string }
      | undefined;
    const attachments = new Map<
      string,
      import("@natalia/contracts").LocalAttachment[]
    >();
    const attachmentRows = this.db
      .query(
        `SELECT turn_id, attachments FROM recovery_attachments WHERE session_id = ?`,
      )
      .all(sessionID) as Array<{ turn_id: string; attachments: string }>;
    for (const row of attachmentRows)
      attachments.set(
        row.turn_id,
        JSON.parse(
          row.attachments,
        ) as import("@natalia/contracts").LocalAttachment[],
      );
    const diagnostics = this.db
      .query(
        `SELECT event FROM recovery_diagnostics WHERE session_id = ? ORDER BY seq`,
      )
      .all(sessionID) as Array<{ event: string }>;
    return {
      activeTurnIDs: active.map((row) => row.turn_id),
      approvals: interactive
        .filter((row) => row.kind === "approval")
        .map(
          (row) =>
            JSON.parse(row.event) as Extract<
              RuntimeEvent,
              { type: "approval.request" }
            >,
        ),
      questions: interactive
        .filter((row) => row.kind === "question")
        .map(
          (row) =>
            JSON.parse(row.event) as Extract<
              RuntimeEvent,
              { type: "question.request" }
            >,
        ),
      selectedAgent: selection?.agent_name,
      selectedModel:
        selection?.model_id || selection?.model_variant
          ? { modelID: selection.model_id, variant: selection.model_variant }
          : undefined,
      attachments,
      diagnostics: diagnostics.map(
        (row) =>
          JSON.parse(row.event) as Extract<
            RuntimeEvent,
            { type: "diagnostic" }
          >,
      ),
    };
  }

  loadRecord(id: SessionID): SessionRecord | undefined {
    const row = this.get(id);
    if (!row) return undefined;
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      cancelled: row.cancelled,
      resumable: row.resumable,
      metadata: row.metadata,
      events: this.loadEvents(id),
      inbox: this.loadInbox(id),
    };
  }

  loadInbox(sessionID: SessionID): AdmittedSessionInput[] {
    const rows = this.db
      .query(
        `SELECT id, text, attachments, resources, agents, delivery, admitted_at, admitted_seq, promoted_at, promoted_seq
         FROM session_inputs WHERE session_id = ? ORDER BY admitted_seq`,
      )
      .all(sessionID) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.id as string,
      sessionID,
      text: row.text as string,
      attachments: parseOptionalJSON(row.attachments),
      resources: parseOptionalJSON(row.resources),
      agents: parseOptionalJSON(row.agents),
      delivery: row.delivery as AdmittedSessionInput["delivery"],
      admittedAt: row.admitted_at as string,
      admittedSeq: row.admitted_seq as number,
      promotedAt: (row.promoted_at as string | null) ?? undefined,
      promotedSeq: (row.promoted_seq as number | null) ?? undefined,
    }));
  }

  replaceInbox(sessionID: SessionID, inputs: AdmittedSessionInput[]) {
    const insert = this.db.prepare(
      `INSERT INTO session_inputs(session_id, id, text, attachments, resources, agents, delivery, admitted_at, admitted_seq, promoted_at, promoted_seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.db.transaction(() => {
      this.run(`DELETE FROM session_inputs WHERE session_id = ?`, [sessionID]);
      for (const input of inputs)
        insert.run(
          sessionID,
          input.id,
          input.text,
          optionalJSON(input.attachments),
          optionalJSON(input.resources),
          optionalJSON(input.agents),
          input.delivery,
          input.admittedAt,
          input.admittedSeq,
          input.promotedAt ?? null,
          input.promotedSeq ?? null,
        );
    })();
  }

  pendingInputCount(sessionID: SessionID) {
    const row = this.db
      .query(
        `SELECT COUNT(*) AS count FROM session_inputs WHERE session_id = ? AND promoted_at IS NULL`,
      )
      .get(sessionID) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  referencedAttachments() {
    const sessions = this.db.query(`SELECT id FROM sessions`).all() as Array<{
      id: SessionID;
    }>;
    for (const session of sessions) this.ensureRecoveryProjection(session.id);
    const attachments: import("@natalia/contracts").LocalAttachment[] = [];
    const eventRows = this.db
      .query(`SELECT attachments FROM recovery_attachments`)
      .all() as Array<{ attachments: string }>;
    for (const row of eventRows)
      attachments.push(
        ...(JSON.parse(
          row.attachments,
        ) as import("@natalia/contracts").LocalAttachment[]),
      );
    const inputRows = this.db
      .query(
        `SELECT attachments FROM session_inputs WHERE attachments IS NOT NULL`,
      )
      .all() as Array<{ attachments: string }>;
    for (const row of inputRows) {
      const input = parseOptionalJSON(row.attachments);
      if (Array.isArray(input))
        attachments.push(
          ...(input as import("@natalia/contracts").LocalAttachment[]),
        );
    }
    return attachments;
  }

  loadEventsAfter(sessionID: SessionID, after: number): RuntimeEvent[] {
    const rows = this.db
      .query(
        `SELECT event FROM events WHERE session_id = ? AND seq > ? ORDER BY seq`,
      )
      .all(sessionID, after) as { event: string }[];
    return rows.map((row) => JSON.parse(row.event) as RuntimeEvent);
  }

  loadEventPage(
    sessionID: SessionID,
    options: { after?: number; limit?: number } = {},
  ) {
    const after = Math.max(0, options.after ?? 0);
    const limit = Math.min(500, Math.max(1, options.limit ?? 100));
    const rows = this.db
      .query(
        `SELECT seq, event FROM events WHERE session_id = ? AND seq > ? ORDER BY seq LIMIT ?`,
      )
      .all(sessionID, after, limit + 1) as Array<{
      seq: number;
      event: string;
    }>;
    const hasMore = rows.length > limit;
    return {
      events: rows.slice(0, limit).map((row) => ({
        seq: row.seq,
        event: JSON.parse(row.event) as RuntimeEvent,
      })),
      hasMore,
    };
  }

  loadMessagePage(
    sessionID: SessionID,
    options: { limit?: number; order?: "asc" | "desc"; cursor?: string } = {},
  ): RuntimeMessagePage {
    const cursor = options.cursor
      ? decodeMessageCursor(options.cursor)
      : undefined;
    if (cursor && options.order)
      throw new Error("message cursor cannot be combined with order");
    const order = cursor?.order ?? options.order ?? "desc";
    const limit = Math.min(200, Math.max(1, options.limit ?? 100));
    this.ensureMessageIndex(sessionID);
    const anchor = cursor
      ? this.messageTurn(sessionID, cursor.anchor)
      : undefined;
    if (cursor && !anchor)
      throw new Error("message cursor anchor is no longer available");
    const direction = cursor?.direction ?? "next";
    const query = messageTurnQuery(order, direction, anchor?.startSeq);
    const turns = this.db
      .query(query.sql)
      .all(sessionID, ...query.params, limit + 1) as Array<{
      turn_id: string;
      start_seq: number;
      event: string;
    }>;
    const pageTurns = turns.slice(0, limit);
    if (query.reverse) pageTurns.reverse();
    const data = this.projectMessageTurns(sessionID, pageTurns);
    const first = pageTurns[0];
    const last = pageTurns.at(-1);
    const hasPrevious = first
      ? this.hasMessageTurn(
          sessionID,
          first.start_seq,
          order === "asc" ? "before" : "after",
        )
      : false;
    const hasNext = last
      ? this.hasMessageTurn(
          sessionID,
          last.start_seq,
          order === "asc" ? "after" : "before",
        )
      : false;
    return {
      data,
      cursor: {
        previous:
          hasPrevious && first
            ? encodeMessageCursor({
                order,
                direction: "previous",
                anchor: first.turn_id,
              })
            : undefined,
        next:
          hasNext && last
            ? encodeMessageCursor({
                order,
                direction: "next",
                anchor: last.turn_id,
              })
            : undefined,
      },
    };
  }

  loadContextEpoch(sessionID: SessionID): StoredContextEpoch | undefined {
    const row = this.db
      .query(
        `SELECT baseline_seq, snapshot FROM context_epochs WHERE session_id = ?`,
      )
      .get(sessionID) as { baseline_seq: number; snapshot: string } | undefined;
    if (!row) return undefined;
    return {
      baselineSeq: row.baseline_seq,
      snapshot: JSON.parse(row.snapshot) as DurableContextCheckpointRecord,
    };
  }

  eventCount(sessionID: SessionID): number {
    const row = this.db
      .query(`SELECT COUNT(*) as cnt FROM events WHERE session_id = ?`)
      .get(sessionID) as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }

  async appendEventAsync(sessionID: SessionID, event: RuntimeEvent) {
    this.enqueueEvent(sessionID, event);
    await this.flushPendingWrites(sessionID);
  }

  /** Queues a non-barrier durable event for the next microtask/count/barrier flush. */
  enqueueEvent(sessionID: SessionID, event: RuntimeEvent) {
    if (this.closed) throw new Error("SQLite session store is closed");
    const events = this.pendingAsyncEvents.get(sessionID) ?? [];
    events.push(event);
    this.pendingAsyncEvents.set(sessionID, events);
    if (events.length >= 100 || isDurableFlushBarrier(event)) {
      void this.flushPendingWrites(sessionID);
      return;
    }
    this.scheduleFlush(sessionID);
  }

  /** Flushes queued non-barrier appends before dispose or an explicit audit boundary. */
  async flushPendingWrites(sessionID?: SessionID) {
    if (sessionID) {
      await this.flushSession(sessionID);
      return;
    }
    await Promise.all(
      [...this.pendingAsyncEvents.keys()].map((id) => this.flushSession(id)),
    );
  }

  private run(sql: string, params: unknown[] = []) {
    this.db.prepare(sql).run(...(params as never[]));
  }

  private insertEvent(sessionID: SessionID, event: RuntimeEvent) {
    const inserted = this.insertEventStatement.run(
      sessionID,
      JSON.stringify(event),
    );
    if (event.type === "turn.submitted")
      this.run(
        `INSERT OR IGNORE INTO message_turns(session_id, turn_id, start_seq) VALUES (?, ?, ?)`,
        [sessionID, event.id, Number(inserted.lastInsertRowid)],
      );
    return inserted;
  }

  private appendEventInTransaction(sessionID: SessionID, event: RuntimeEvent) {
    const inserted = this.insertEvent(sessionID, event);
    this.applyRecoveryEvent(sessionID, event);
    if (event.type === "context.checkpoint")
      this.run(
        `INSERT INTO context_epochs(session_id, baseline_seq, snapshot) VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET baseline_seq = excluded.baseline_seq, snapshot = excluded.snapshot`,
        [
          sessionID,
          Number(inserted.lastInsertRowid),
          JSON.stringify(event.snapshot),
        ],
      );
    if (event.type === "session.created")
      this.run(`UPDATE sessions SET title = ? WHERE id = ?`, [
        event.title,
        sessionID,
      ]);
    if (event.type === "turn.cancelled")
      this.run(`UPDATE sessions SET cancelled = 1 WHERE id = ?`, [sessionID]);
  }

  private scheduleFlush(sessionID: SessionID) {
    if (this.scheduledFlushes.has(sessionID)) return;
    this.scheduledFlushes.add(sessionID);
    this.flushTimers.set(
      sessionID,
      setTimeout(() => {
        this.scheduledFlushes.delete(sessionID);
        this.flushTimers.delete(sessionID);
        if (!this.closed) void this.flushSession(sessionID);
      }, 20),
    );
  }

  private async flushSession(sessionID: SessionID) {
    const timer = this.flushTimers.get(sessionID);
    if (timer) clearTimeout(timer);
    this.flushTimers.delete(sessionID);
    this.scheduledFlushes.delete(sessionID);
    const existing = this.pendingFlushes.get(sessionID);
    if (existing) {
      await existing;
      if (this.pendingAsyncEvents.get(sessionID)?.length)
        await this.flushSession(sessionID);
      return;
    }
    const events = this.pendingAsyncEvents.get(sessionID);
    if (!events?.length) return;
    const batch = events.splice(0);
    const run = () => this.writeBufferedBatch(sessionID, batch);
    const queued = this.writeQueue.then(run, run);
    this.writeQueue = queued.catch(() => undefined);
    const flush = queued.finally(() => this.pendingFlushes.delete(sessionID));
    this.pendingFlushes.set(sessionID, flush);
    await flush;
    if (this.pendingAsyncEvents.get(sessionID)?.length)
      await this.flushSession(sessionID);
  }

  private writeBufferedBatch(sessionID: SessionID, events: RuntimeEvent[]) {
    if (!events.length) return;
    this.db.transaction(() => {
      for (const event of events)
        this.appendEventInTransaction(sessionID, event);
      this.bumpRecoveryState(sessionID, events.length);
    })();
  }

  private ensureRecoveryProjection(sessionID: SessionID) {
    const indexed = this.db
      .query(`SELECT indexed_events FROM recovery_state WHERE session_id = ?`)
      .get(sessionID) as { indexed_events: number } | undefined;
    const total = this.eventCount(sessionID);
    if (indexed?.indexed_events === total) return;
    const events = this.loadEvents(sessionID);
    this.db.transaction(() => {
      this.deleteRecoveryProjection(sessionID);
      for (const event of events) this.applyRecoveryEvent(sessionID, event);
      this.run(
        `INSERT INTO recovery_state(session_id, indexed_events) VALUES (?, ?)
         ON CONFLICT(session_id) DO UPDATE SET indexed_events = excluded.indexed_events`,
        [sessionID, events.length],
      );
    })();
  }

  private applyRecoveryEvent(sessionID: SessionID, event: RuntimeEvent) {
    if (event.type === "turn.submitted") {
      this.run(
        `INSERT INTO recovery_turns(session_id, turn_id, active) VALUES (?, ?, 1)
         ON CONFLICT(session_id, turn_id) DO UPDATE SET active = 1`,
        [sessionID, event.id],
      );
      if (event.attachments?.length)
        this.run(
          `INSERT INTO recovery_attachments(session_id, turn_id, attachments) VALUES (?, ?, ?)
           ON CONFLICT(session_id, turn_id) DO UPDATE SET attachments = excluded.attachments`,
          [sessionID, event.id, JSON.stringify(event.attachments)],
        );
      return;
    }
    if (event.type === "turn.finished" || event.type === "turn.cancelled") {
      this.run(
        `UPDATE recovery_turns SET active = 0 WHERE session_id = ? AND turn_id = ?`,
        [sessionID, event.id],
      );
      return;
    }
    if (
      event.type === "approval.request" ||
      event.type === "question.request"
    ) {
      this.run(
        `INSERT INTO recovery_interactive(session_id, request_id, kind, event) VALUES (?, ?, ?, ?)
         ON CONFLICT(session_id, request_id) DO UPDATE SET kind = excluded.kind, event = excluded.event`,
        [
          sessionID,
          event.id,
          event.type === "approval.request" ? "approval" : "question",
          JSON.stringify(event),
        ],
      );
      return;
    }
    if (
      event.type === "approval.response" ||
      event.type === "question.response"
    ) {
      this.run(
        `DELETE FROM recovery_interactive WHERE session_id = ? AND request_id = ?`,
        [sessionID, event.id],
      );
      return;
    }
    if (event.type === "agent.selection" && !event.pending) {
      this.run(
        `INSERT INTO recovery_selection(session_id, agent_name) VALUES (?, ?)
         ON CONFLICT(session_id) DO UPDATE SET agent_name = excluded.agent_name`,
        [sessionID, event.name],
      );
      return;
    }
    if (event.type === "model.selection")
      this.run(
        `INSERT INTO recovery_selection(session_id, model_id, model_variant) VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET model_id = excluded.model_id, model_variant = excluded.model_variant`,
        [sessionID, event.modelID ?? null, event.variant ?? null],
      );
    if (event.type === "diagnostic") {
      this.run(
        `INSERT INTO recovery_diagnostics(session_id, event) VALUES (?, ?)`,
        [sessionID, JSON.stringify(event)],
      );
      this.run(
        `DELETE FROM recovery_diagnostics
         WHERE session_id = ? AND seq NOT IN (
           SELECT seq FROM recovery_diagnostics
           WHERE session_id = ? ORDER BY seq DESC LIMIT 500
         )`,
        [sessionID, sessionID],
      );
    }
  }

  private bumpRecoveryState(sessionID: SessionID, count = 1) {
    this.run(
      `INSERT INTO recovery_state(session_id, indexed_events) VALUES (?, ?)
       ON CONFLICT(session_id) DO UPDATE SET indexed_events = indexed_events + ?`,
      [sessionID, count, count],
    );
  }

  private deleteRecoveryProjection(sessionID: SessionID) {
    this.run(`DELETE FROM recovery_turns WHERE session_id = ?`, [sessionID]);
    this.run(`DELETE FROM recovery_interactive WHERE session_id = ?`, [
      sessionID,
    ]);
    this.run(`DELETE FROM recovery_selection WHERE session_id = ?`, [
      sessionID,
    ]);
    this.run(`DELETE FROM recovery_attachments WHERE session_id = ?`, [
      sessionID,
    ]);
    this.run(`DELETE FROM recovery_diagnostics WHERE session_id = ?`, [
      sessionID,
    ]);
    this.run(`DELETE FROM recovery_state WHERE session_id = ?`, [sessionID]);
  }

  private ensureMessageIndex(sessionID: SessionID) {
    this.run(
      `INSERT OR IGNORE INTO message_turns(session_id, turn_id, start_seq)
       SELECT session_id, json_extract(event, '$.id'), seq
       FROM events
       WHERE session_id = ? AND json_extract(event, '$.type') = 'turn.submitted'`,
      [sessionID],
    );
  }

  private messageTurn(sessionID: SessionID, turnID: string) {
    const row = this.db
      .query(
        `SELECT turn_id, start_seq FROM message_turns WHERE session_id = ? AND turn_id = ?`,
      )
      .get(sessionID, turnID) as
      | { turn_id: string; start_seq: number }
      | undefined;
    return row ? { turnID: row.turn_id, startSeq: row.start_seq } : undefined;
  }

  private hasMessageTurn(
    sessionID: SessionID,
    sequence: number,
    direction: "before" | "after",
  ) {
    const comparison = direction === "before" ? "<" : ">";
    return Boolean(
      this.db
        .query(
          `SELECT 1 FROM message_turns WHERE session_id = ? AND start_seq ${comparison} ? LIMIT 1`,
        )
        .get(sessionID, sequence),
    );
  }

  private projectMessageTurns(
    sessionID: SessionID,
    turns: Array<{ turn_id: string; start_seq: number; event: string }>,
  ) {
    if (!turns.length) return [];
    const firstSequence = Math.min(...turns.map((turn) => turn.start_seq));
    const lastSequence = Math.max(...turns.map((turn) => turn.start_seq));
    const next = this.db
      .query(
        `SELECT start_seq FROM message_turns WHERE session_id = ? AND start_seq > ? ORDER BY start_seq LIMIT 1`,
      )
      .get(sessionID, lastSequence) as { start_seq: number } | undefined;
    const rows = this.db
      .query(
        `SELECT seq, event FROM events WHERE session_id = ? AND seq >= ? ${next ? "AND seq < ?" : ""} ORDER BY seq`,
      )
      .all(
        ...(next
          ? [sessionID, firstSequence, next.start_seq]
          : [sessionID, firstSequence]),
      ) as Array<{
      seq: number;
      event: string;
    }>;
    const parsed = rows.map((row) => ({
      seq: row.seq,
      event: JSON.parse(row.event) as RuntimeEvent,
    }));
    return turns.map((turn) => {
      const submitted = JSON.parse(turn.event) as Extract<
        RuntimeEvent,
        { type: "turn.submitted" }
      >;
      const nextTurn = turns.find(
        (candidate) => candidate.start_seq > turn.start_seq,
      );
      const end =
        nextTurn?.start_seq ?? next?.start_seq ?? Number.POSITIVE_INFINITY;
      return projectTurnMessage(
        submitted,
        parsed
          .filter(
            (candidate) =>
              candidate.seq >= turn.start_seq && candidate.seq < end,
          )
          .map((candidate) => candidate.event),
      );
    });
  }
}

function messageTurnQuery(
  order: "asc" | "desc",
  direction: "next" | "previous",
  anchor?: number,
) {
  const forward = direction === "next";
  const descending = order === "desc" ? forward : !forward;
  const comparison =
    anchor === undefined ? "" : `AND start_seq ${descending ? "<" : ">"} ?`;
  return {
    sql: `SELECT message_turns.turn_id, message_turns.start_seq, events.event
      FROM message_turns JOIN events
        ON events.session_id = message_turns.session_id AND events.seq = message_turns.start_seq
      WHERE message_turns.session_id = ? ${comparison}
      ORDER BY message_turns.start_seq ${descending ? "DESC" : "ASC"}
      LIMIT ?`,
    params: anchor === undefined ? [] : [anchor],
    reverse: descending !== (order === "desc"),
  };
}

function rowToSession(row: Record<string, unknown>): SessionRow {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.metadata as string);
    if (parsed && typeof parsed === "object") metadata = parsed;
  } catch {
    // Corrupt metadata is silently discarded; the active session remains usable.
  }
  return {
    id: row.id as SessionID,
    title: row.title as string,
    createdAt: row.created_at as string,
    cancelled: (row.cancelled as number) === 1,
    resumable: (row.resumable as number) === 1,
    pinned: (row.pinned as number) === 1,
    metadata,
  };
}

function optionalJSON(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseOptionalJSON(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as any;
  } catch {
    return undefined;
  }
}
