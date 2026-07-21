import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";

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
`;

export type SessionRow = {
  id: SessionID;
  title: string;
  createdAt: string;
  cancelled: boolean;
  resumable: boolean;
  pinned: boolean;
  metadata: Record<string, unknown>;
};

export class SqliteSessionStore {
  private db: Database;
  private writeQueue = Promise.resolve();

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA synchronous=NORMAL");
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
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
        `SELECT id, title, created_at, cancelled, resumable, pinned, metadata FROM sessions ORDER BY pinned DESC, created_at DESC`,
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToSession);
  }

  rename(id: SessionID, title: string) {
    const trimmed = title.trim();
    if (!trimmed) throw new Error("session title cannot be empty");
    this.run(`UPDATE sessions SET title = ? WHERE id = ?`, [trimmed, id]);
  }

  delete(id: SessionID) {
    this.run(`DELETE FROM events WHERE session_id = ?`, [id]);
    this.run(`DELETE FROM sessions WHERE id = ?`, [id]);
  }

  updateMetadata(id: SessionID, partial: Partial<SessionRow["metadata"]>) {
    const session = this.get(id);
    if (!session) throw new Error(`session not found: ${id}`);
    const next = { ...session.metadata, ...partial };
    this.run(`UPDATE sessions SET metadata = ? WHERE id = ?`, [
      JSON.stringify(next),
      id,
    ]);
  }

  appendEvent(sessionID: SessionID, event: RuntimeEvent) {
    this.run(`INSERT INTO events(session_id, event) VALUES (?, ?)`, [
      sessionID,
      JSON.stringify(event),
    ]);
    if (event.type === "session.created") {
      this.run(`UPDATE sessions SET title = ? WHERE id = ?`, [
        event.title,
        sessionID,
      ]);
    }
    if (event.type === "turn.cancelled") {
      this.run(`UPDATE sessions SET cancelled = 1 WHERE id = ?`, [sessionID]);
    }
  }

  appendEvents(sessionID: SessionID, events: RuntimeEvent[]) {
    const insert = this.db.prepare(
      `INSERT INTO events(session_id, event) VALUES (?, ?)`,
    );
    const txn = this.db.transaction(() => {
      for (const event of events) {
        insert.run(sessionID, JSON.stringify(event));
      }
    });
    txn();
  }

  loadEvents(sessionID: SessionID): RuntimeEvent[] {
    const rows = this.db
      .query(
        `SELECT event FROM events WHERE session_id = ? ORDER BY seq`,
      )
      .all(sessionID) as { event: string }[];
    return rows.map((r) => JSON.parse(r.event) as RuntimeEvent);
  }

  eventCount(sessionID: SessionID): number {
    const row = this.db
      .query(`SELECT COUNT(*) as cnt FROM events WHERE session_id = ?`)
      .get(sessionID) as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }

  async appendEventAsync(sessionID: SessionID, event: RuntimeEvent) {
    const run = () => this.appendEvent(sessionID, event);
    const queued = this.writeQueue.then(run, run);
    this.writeQueue = queued.catch(() => undefined);
    await queued;
  }

  private run(sql: string, params: unknown[] = []) {
    this.db.prepare(sql).run(...(params as never[]));
  }
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
