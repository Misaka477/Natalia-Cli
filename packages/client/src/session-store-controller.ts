import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  RuntimeEvent,
  RuntimeSessionSummary,
  SessionID,
} from "@natalia/contracts";
import {
  JsonSessionStore,
  SqliteSessionStore,
  createSessionRecord,
  type SessionRecord,
  type SessionRow,
} from "@natalia/session";
import {
  cleanupUnreferencedAttachments,
  referencedAttachmentsForSessions,
} from "./attachments";

/**
 * Shared SQLite handles are refcounted by database path: several runtimes in
 * one process (TUI worker, CLI, tests) may open the same `.natalia/sessions.db`,
 * and the last one to close releases the handle.
 */
const sqliteStores = new Map<string, SqliteSessionStore>();
const sqliteStoreUsers = new Map<string, number>();

function retainSqliteStore(path: string, store: SqliteSessionStore) {
  sqliteStores.set(path, store);
  sqliteStoreUsers.set(path, (sqliteStoreUsers.get(path) ?? 0) + 1);
}

function releaseSqliteStore(path: string) {
  const remaining = (sqliteStoreUsers.get(path) ?? 1) - 1;
  if (remaining > 0) {
    sqliteStoreUsers.set(path, remaining);
    return;
  }
  sqliteStoreUsers.delete(path);
  const store = sqliteStores.get(path);
  sqliteStores.delete(path);
  if (store) void store.close();
}

/**
 * The session store resource controller — the first cut of the session /
 * recovery split (mainline plan §15, knife 5). It owns the store selection
 * (JSON files vs the shared SQLite handle), the session-management surface
 * (list/touch/rename/pin/duplicate/fork/delete/new/archive/export) and the
 * summary projections. The journal-recovery flow (inbox promotion, context
 * rebuild, publish) stays in the runtime — it is coupled to the turn
 * machinery, not to the store.
 *
 * Multi-session shape (plan §41.9): `sessionID()` is an accessor, and every
 * read here is by id; nothing captures "the current session".
 */
export function createSessionStoreController(input: {
  workspaceRoot: string;
  sessionID(): SessionID;
  sessionDir?: string;
  useSqliteStore?: boolean;
  title?: string;
}) {
  let sessionStore: JsonSessionStore;
  let sqliteStore: SqliteSessionStore | undefined;
  let sqliteStorePath: string | undefined;

  async function init() {
    sessionStore = new JsonSessionStore(
      input.sessionDir ?? join(input.workspaceRoot, ".natalia", "sessions"),
    );
    if (input.useSqliteStore) {
      const databasePath = join(input.workspaceRoot, ".natalia", "sessions.db");
      await mkdir(dirname(databasePath), { recursive: true });
      sqliteStore = sqliteStores.get(databasePath);
      if (!sqliteStore) sqliteStore = new SqliteSessionStore(databasePath);
      retainSqliteStore(databasePath, sqliteStore);
      sqliteStorePath = databasePath;
      sqliteStore.create(
        input.sessionID(),
        input.title ?? `Natalia TS session ${input.sessionID()}`,
      );
    }
  }

  function json(): JsonSessionStore {
    return sessionStore;
  }

  function sqlite(): SqliteSessionStore | undefined {
    return sqliteStore;
  }

  function sqlitePath(): string | undefined {
    return sqliteStorePath;
  }

  function summary(record: SessionRecord): RuntimeSessionSummary {
    return {
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      lastAccessedAt: record.metadata?.lastAccessedAt,
      pinned: Boolean(record.metadata?.pinned),
      archived: Boolean(record.metadata?.archived),
      events: record.events.length,
      pendingInputs:
        record.inbox?.filter((input) => !input.promotedAt).length ?? 0,
      cancelled: record.cancelled,
      resumable: record.resumable,
    };
  }

  function sqliteSummary(
    record: SessionRow,
    store: SqliteSessionStore,
  ): RuntimeSessionSummary {
    return {
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      lastAccessedAt: record.metadata.lastAccessedAt as string | undefined,
      pinned: record.pinned,
      events: store.eventCount(record.id),
      pendingInputs: 0,
      cancelled: record.cancelled,
      resumable: record.resumable,
    };
  }

  async function byID(id: string) {
    const record = await sessionStore.load(id as SessionID);
    if (!record) throw new Error(`session not found: ${id}`);
    return record;
  }

  async function byIDOptional(id: string) {
    return await sessionStore.load(id as SessionID);
  }

  // --- session management surface ---

  async function list(): Promise<RuntimeSessionSummary[]> {
    const store = sqliteStore;
    if (store)
      return store.list().map((record) => ({
        id: record.id,
        title: record.title,
        createdAt: record.createdAt,
        lastAccessedAt: record.metadata.lastAccessedAt as string | undefined,
        pinned: record.pinned,
        events: store.eventCount(record.id),
        pendingInputs: store.pendingInputCount(record.id),
        cancelled: record.cancelled,
        resumable: record.resumable,
      }));
    return (await sessionStore.list()).map(summary);
  }

  async function touch(id: string) {
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store) {
      store.touch(id as SessionID);
      return;
    }
    await sessionStore.updateMetadata(id as SessionID, {
      lastAccessedAt: new Date().toISOString(),
    });
  }

  async function rename(id: string, title: string) {
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store)
      return sqliteSummary(store.rename(id as SessionID, title), store);
    const session = await sessionStore.rename(id as SessionID, title);
    return summary(session);
  }

  async function pin(id: string, pinned: boolean) {
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store) return sqliteSummary(store.pin(id as SessionID, pinned), store);
    const session = await sessionStore.updateMetadata(id as SessionID, {
      pinned,
    });
    return summary(session);
  }

  async function duplicate(id: string, title?: string) {
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store)
      return summary(store.duplicate(id as SessionID, undefined, title));
    const session = await sessionStore.duplicate(
      id as SessionID,
      undefined,
      title,
    );
    return summary(session);
  }

  async function fork(id: string, turnID: string, title?: string) {
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store)
      return summary(store.fork(id as SessionID, turnID, undefined, title));
    const session = await sessionStore.fork(
      id as SessionID,
      turnID,
      undefined,
      title,
    );
    return summary(session);
  }

  async function del(id: string) {
    if (id === input.sessionID())
      throw new Error("cannot delete the active runtime session");
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store) {
      if (!store.get(id as SessionID))
        throw new Error(`session not found: ${id}`);
      store.delete(id as SessionID);
      const removedAttachments = await cleanupUnreferencedAttachments({
        workspaceRoot: input.workspaceRoot,
        attachments: store.referencedAttachments(),
      });
      return { id, removedAttachments: removedAttachments.length };
    }
    await byID(id);
    await sessionStore.delete(id as SessionID);
    const removedAttachments = await cleanupUnreferencedAttachments({
      workspaceRoot: input.workspaceRoot,
      attachments: referencedAttachmentsForSessions(await sessionStore.list()),
    });
    return { id, removedAttachments: removedAttachments.length };
  }

  async function create(input_: { id?: string; title?: string }) {
    const id =
      input_.id ?? `ses_${randomUUID().replace(/-/gu, "").slice(0, 16)}`;
    if (input_.id) {
      const existing = await byIDOptional(id);
      if (existing) return { sessionID: id, created: false };
    }
    const record = createSessionRecord(
      id as SessionID,
      input_.title ?? "Untitled session",
    );
    await sessionStore.save(record);
    return { sessionID: id, created: true };
  }

  async function archive(id: string) {
    const record = await byIDOptional(id);
    if (!record) throw new Error(`session not found: ${id}`);
    if (record.metadata?.archived) return { id, archived: true };
    record.metadata = { ...record.metadata, archived: true };
    await sessionStore.save(record);
    return { id, archived: true };
  }

  async function export_(id: string): Promise<{
    sessionID: string;
    title: string;
    createdAt: string;
    archived: boolean;
    events: Array<{ seq: number; event: RuntimeEvent }>;
  }> {
    const record = await byIDOptional(id);
    if (!record) throw new Error(`session not found: ${id}`);
    return {
      sessionID: record.id,
      title: record.title,
      createdAt: record.createdAt,
      archived: Boolean(record.metadata?.archived),
      events: record.events.map((event, index) => ({
        seq: index + 1,
        event,
      })),
    };
  }

  async function close() {
    if (sqliteStorePath) releaseSqliteStore(sqliteStorePath);
    sqliteStore = undefined;
    sqliteStorePath = undefined;
  }

  return {
    init,
    json,
    sqlite,
    sqlitePath,
    summary,
    sqliteSummary,
    byID,
    byIDOptional,
    list,
    touch,
    rename,
    pin,
    duplicate,
    fork,
    delete: del,
    create,
    archive,
    export: export_,
    close,
  };
}
