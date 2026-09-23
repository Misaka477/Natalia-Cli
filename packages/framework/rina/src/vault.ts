import type { RuntimeEvent } from "@anthelia/contracts";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";

/**
 * RINA Phase1 — the Cold Vault (the study's own split: hot state
 * first, the vault thickens the SAME contract without rewriting it).
 *
 * What this stores: structured facts DERIVED from journaled events —
 * record type, entity key, a short deterministic LABEL as the summary,
 * and the `(sessionID, seq)` pointer. What it never stores: event
 * bodies (the study's isolation rule — a collab message's text is the
 * user's content, not a memory record; `content` stays NULL and a
 * unit test proves the body never reaches the disk).
 *
 * FTS5 with porter unicode61 (probed live in this round: bun's SQLite
 * carries it) + bm25 rank for recall; the multi-signal scoring model
 * is Phase2's, by the study's own phase table.
 *
 * The write-behind rides the study's choke point: publishForSession's
 * appendSite enqueues; a100ms/N=50 timer (or an explicit flushNow,
 * the test seam) lands them in one transaction. Rebuild = replaying
 * the same events through the same mapper — journal stays the source
 * of truth, the vault is a derived index (rebuild-identical is a
 * test).
 */

export type VaultRecordType =
  | "plan"
  | "mailbox"
  | "collab"
  | "evidence"
  | "tool_history"
  | "decision";

export type VaultRecord = {
  id: string;
  workspaceID: string;
  sessionID: string;
  agentID?: string;
  recordType: VaultRecordType;
  entityKey: string;
  summary: string;
  seq?: number;
  sourceEvidenceID?: string;
};

export type VaultRecallScope = {
  sessionID?: string;
  workspaceID?: string;
  recordType?: VaultRecordType;
  limit?: number;
};

export type VaultRecallHit = {
  id: string;
  recordType: VaultRecordType;
  entityKey: string;
  summary: string;
  sessionID: string;
  seq?: number;
  createdAt: string;
  /** FTS5's bm25 (lower = better, negated so bigger = better). */
  rank: number;
};

export type RinaVaultService = {
  /** The write-behind entry: journaled events queue here, flush on
   * N=50 /100ms or via flushNow (the explicit seam). */
  enqueue(event: RuntimeEvent): void;
  flushNow(): number;
  remember(record: VaultRecord): string;
  recall(query: string, scope?: VaultRecallScope): VaultRecallHit[];
  /** Delete by scope (the study's invalidation scopes). Returns count. */
  invalidate(scope: {
    sessionID?: string;
    workspaceID?: string;
    recordType?: VaultRecordType;
    id?: string;
  }): number;
  /** Rebuild the whole vault from journaled events (rebuild-identical). */
  rebuild(events: readonly RuntimeEvent[]): number;
  /** The hot-state face: the wire injects its reader; without one the
   * answer says WHY it cannot serve (a reason, not a stub — Phase0's
   * consumers are still unswitched, the study's own boundary). */
  state(
    sessionID: string,
  ): { available: true; state: unknown } | { available: false; reason: string };
  close(): void;
};

// ---------------------------------------------------------------------------
// The event → record classification: an EXPLICIT list, law1-style. Only
// events whose identity is structural make the cut; labels come from the
// event's own short fields, never from bodies.
// ---------------------------------------------------------------------------

type EventClassification = {
  recordType: VaultRecordType;
  /** The stable identity for this event's subject. */
  entityOf: (event: RuntimeEvent) => string;
  /** The deterministic label (short fields only). */
  label: (event: RuntimeEvent) => string;
};

const CLASSIFIED: Partial<Record<RuntimeEvent["type"], EventClassification>> = {
  "composition.switched": {
    recordType: "decision",
    entityOf: (event) => (event as { to?: string }).to ?? "unknown",
    label: (event) =>
      `switched: ${(event as { reason?: string }).reason ?? ""}`.slice(0, 200),
  },
  "drift.finding_opened": {
    recordType: "evidence",
    entityOf: (event) => String((event as { id?: string }).id ?? "drift"),
    label: (event) =>
      `drift: ${String((event as { severity?: string }).severity ?? "unknown")}`,
  },
  "feedback.recorded": {
    recordType: "evidence",
    entityOf: (event) => String((event as { id?: string }).id ?? "feedback"),
    label: () => "feedback recorded",
  },
};

function classify(event: RuntimeEvent): VaultRecord | undefined {
  const rule = CLASSIFIED[event.type];
  if (!rule) return undefined;
  const sessionID = String((event as { sessionID?: string }).sessionID ?? "");
  if (!sessionID) return undefined; // an unjournaled-for-session event is not a memory
  const workspaceID = String(
    (event as { workspaceID?: string }).workspaceID ?? "",
  );
  const seq = (event as { seq?: number }).seq;
  const agentID = (event as { agentID?: string }).agentID;
  return {
    id: `${sessionID}:${seq ?? `${event.type}:${(event as { at?: string }).at ?? "0"}`}`,
    workspaceID,
    sessionID,
    ...(agentID ? { agentID } : {}),
    recordType: rule.recordType,
    entityKey: rule.entityOf(event),
    summary: rule.label(event),
    ...(typeof seq === "number" ? { seq } : {}),
  };
}

export type ContextVault = RinaVaultService & { readonly path: string };

/**
 * The fail-soft twin: a vault whose STORE cannot open (a read-only
 * home in a sandbox, a locked dir in the field) must never kill the
 * boot — and must never lie either. Enqueue drops (the wire publishes
 * a diagnostic when it constructs this, so the loss is observable),
 * reads answer empty/`available:false` with the SAME reason, and
 * explicit WRITES fail loud with it — silently swallowing a
 * remember() would be the dishonest direction.
 */
export function createUnavailableVault(reason: string): RinaVaultService {
  const absent = { available: false as const, reason };
  return {
    enqueue: () => undefined,
    flushNow: () => 0,
    remember: () => {
      throw new Error(`context vault unavailable: ${reason}`);
    },
    recall: () => [],
    invalidate: () => 0,
    rebuild: () => 0,
    state: () => absent,
    close: () => undefined,
  };
}

const FLUSH_MS = 100;
const FLUSH_N = 50;

export function createContextVault(input: {
  dir: string;
  /** The hot-state reader the wire injects (Phase0's fact state). */
  readFactState?: (sessionID: string) => unknown;
  flushMs?: number;
  flushN?: number;
}): ContextVault {
  mkdirSync(input.dir, { recursive: true, mode: 0o700 });
  const path = join(input.dir, "vault.sqlite");
  const db = new Database(path);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS context_records (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      agent_id TEXT,
      record_type TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT,
      source_evidence_id TEXT,
      seq INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
      priority REAL NOT NULL DEFAULT 0.5
    );
    CREATE INDEX IF NOT EXISTS context_records_session ON context_records (session_id, seq);
    CREATE VIRTUAL TABLE IF NOT EXISTS context_records_fts USING fts5(
      id UNINDEXED,
      summary,
      entity_key,
      tokenize = 'porter unicode61'
    );
    CREATE TABLE IF NOT EXISTS context_history (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      at TEXT NOT NULL
    );
  `);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO context_records
      (id, workspace_id, session_id, agent_id, record_type, entity_key, summary,
       content, source_evidence_id, seq, created_at, updated_at, access_count, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0, 0.5)
  `);
  const ftsInsert = db.prepare(
    "INSERT OR REPLACE INTO context_records_fts (id, summary, entity_key) VALUES (?, ?, ?)",
  );
  const historyInsert = db.prepare(
    "INSERT OR REPLACE INTO context_history (id, record_id, action, at) VALUES (?, ?, ?, ?)",
  );

  let queue: VaultRecord[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flushMs = input.flushMs ?? FLUSH_MS;
  const flushN = input.flushN ?? FLUSH_N;

  function land(records: readonly VaultRecord[], action: string): number {
    if (!records.length) return 0;
    const now = new Date().toISOString();
    db.transaction(() => {
      for (const record of records) {
        insert.run(
          record.id,
          record.workspaceID,
          record.sessionID,
          record.agentID ?? null,
          record.recordType,
          record.entityKey,
          record.summary,
          record.sourceEvidenceID ?? null,
          record.seq ?? null,
          now,
          now,
        );
        ftsInsert.run(record.id, record.summary, record.entityKey);
        historyInsert.run(
          `${action}:${record.id}:${now}`,
          record.id,
          action,
          now,
        );
      }
    })();
    return records.length;
  }

  function flushNow(): number {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    const pending = queue;
    queue = [];
    return land(pending, "insert");
  }

  function schedule(): void {
    if (queue.length >= flushN) {
      flushNow();
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      flushNow();
    }, flushMs);
    timer.unref?.();
  }

  const invalidateSelect = (scope: {
    sessionID?: string;
    workspaceID?: string;
    recordType?: VaultRecordType;
    id?: string;
  }): { sql: string; args: (string | number | null)[] } => {
    const where: string[] = [];
    const args: (string | number | null)[] = [];
    if (scope.id) {
      where.push("id = ?");
      args.push(scope.id);
    }
    if (scope.sessionID) {
      where.push("session_id = ?");
      args.push(scope.sessionID);
    }
    if (scope.workspaceID) {
      where.push("workspace_id = ?");
      args.push(scope.workspaceID);
    }
    if (scope.recordType) {
      where.push("record_type = ?");
      args.push(scope.recordType);
    }
    if (!where.length)
      throw new Error("invalidate scope must name at least one dimension");
    return { sql: where.join(" AND "), args };
  };

  return {
    path,
    enqueue(event: RuntimeEvent): void {
      const record = classify(event);
      if (!record) return;
      queue.push(record);
      schedule();
    },
    flushNow,
    remember(record: VaultRecord): string {
      land([record], "insert");
      return record.id;
    },
    recall(query: string, scope: VaultRecallScope = {}): VaultRecallHit[] {
      flushNow(); // a recall sees everything enqueued (no read-your-own-writes gap)
      const filters: string[] = [];
      const args: (string | number | null)[] = [];
      if (scope.sessionID) {
        filters.push("r.session_id = ?");
        args.push(scope.sessionID);
      }
      if (scope.workspaceID) {
        filters.push("r.workspace_id = ?");
        args.push(scope.workspaceID);
      }
      if (scope.recordType) {
        filters.push("r.record_type = ?");
        args.push(scope.recordType);
      }
      const limit = Math.max(1, Math.min(scope.limit ?? 20, 200));
      const sql = `
        SELECT r.id, r.record_type, r.entity_key, r.summary, r.session_id, r.seq, r.created_at,
               bm25(context_records_fts) AS rank
        FROM context_records_fts
        JOIN context_records r ON r.id = context_records_fts.id
        WHERE context_records_fts MATCH ?
          ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
        ORDER BY rank
        LIMIT ?`;
      const rows = db.query(sql).all(query, ...args, limit) as Array<{
        id: string;
        record_type: VaultRecordType;
        entity_key: string;
        summary: string;
        session_id: string;
        seq: number | null;
        created_at: string;
        rank: number;
      }>;
      const touch = db.prepare(
        "UPDATE context_records SET access_count = access_count + 1 WHERE id = ?",
      );
      const now = new Date().toISOString();
      db.transaction(() => {
        for (const row of rows) {
          touch.run(row.id);
          historyInsert.run(
            `accessed:${row.id}:${now}`,
            row.id,
            "accessed",
            now,
          );
        }
      })();
      return rows.map((row) => ({
        id: row.id,
        recordType: row.record_type,
        entityKey: row.entity_key,
        summary: row.summary,
        sessionID: row.session_id,
        ...(row.seq === null ? {} : { seq: row.seq }),
        createdAt: row.created_at,
        // bm25 ascends (lower better); expose a bigger-is-better rank
        rank: -row.rank,
      }));
    },
    invalidate(scope): number {
      const { sql, args } = invalidateSelect(scope);
      const ids = (
        db
          .query(`SELECT id FROM context_records WHERE ${sql}`)
          .all(...args) as Array<{
          id: string;
        }>
      ).map((row) => row.id);
      if (!ids.length) return 0;
      const now = new Date().toISOString();
      db.transaction(() => {
        db.run(`DELETE FROM context_records WHERE ${sql}`, args);
        for (const id of ids) {
          db.run("DELETE FROM context_records_fts WHERE id = ?", [id]);
          historyInsert.run(`evict:${id}:${now}`, id, "evict", now);
        }
      })();
      return ids.length;
    },
    rebuild(events: readonly RuntimeEvent[]): number {
      flushNow();
      const now = new Date().toISOString();
      db.transaction(() => {
        db.run(
          "DELETE FROM context_records_fts WHERE id IN (SELECT id FROM context_records)",
        );
        db.run("DELETE FROM context_records");
        db.run("DELETE FROM context_history");
      })();
      const records = events
        .map((event) => classify(event))
        .filter((record): record is VaultRecord => record !== undefined);
      const dropped = land(records, "insert");
      historyInsert.run(`rebuild:${now}`, "-", "rebuild", now);
      return dropped;
    },
    state(sessionID: string) {
      if (!input.readFactState)
        return {
          available: false,
          reason:
            "the hot-state reader attaches with Phase2's consumer switch (Phase0's facts exist; their consumers are still unswitched — the study's own boundary)",
        };
      const state = input.readFactState(sessionID);
      if (state === undefined)
        return {
          available: false,
          reason: `no hot state for session ${sessionID}`,
        };
      return { available: true, state };
    },
    close(): void {
      flushNow();
      db.close();
    },
  };
}
