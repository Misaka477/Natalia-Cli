import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  DurableContextCheckpointRecord,
  LocalAttachment,
  RuntimeEvent,
  RuntimeMessagePage,
  RuntimeSessionSummary,
  SessionID,
} from "@natalia/contracts";
import {
  JsonSessionStore,
  SqliteSessionStore,
  createSessionRecord,
  projectSessionMessages,
  type SessionMetadata,
  type SessionRecord,
  type SessionRow,
  type StoredContextEpoch,
} from "@natalia/session";
import type {
  AttachmentService,
  SessionStoreController,
  SessionStoreRecoveryView,
} from "@natalia/runtime-services";
import { loadSessionEventsInWorker } from "./session-load-worker-client";

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
 * The pending-human-terminal metadata as a typed value, or undefined. SQLite
 * rows carry metadata as a loose record, so the shape is checked before it is
 * projected into the public summary.
 */
function pendingHumanTerminalOf(
  metadata: Record<string, unknown>,
): RuntimeSessionSummary["pendingHumanTerminal"] | undefined {
  const pending = metadata.pendingHumanTerminal;
  if (
    !pending ||
    typeof pending !== "object" ||
    typeof (pending as { terminalID?: unknown }).terminalID !== "string" ||
    typeof (pending as { reason?: unknown }).reason !== "string" ||
    typeof (pending as { since?: unknown }).since !== "string"
  )
    return undefined;
  return pending as RuntimeSessionSummary["pendingHumanTerminal"];
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
  attachments: AttachmentService;
}): SessionStoreController {
  let sessionStore: JsonSessionStore;
  let sqliteStore: SqliteSessionStore | undefined;
  let sqliteStorePath: string | undefined;
  let initialized = false;

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
      console.warn("[session-store] workspaceRoot:", input.workspaceRoot);
      console.warn("[session-store] sqlite db:", databasePath);
      // Import leftover JSON sessions once, then delete the JSON files so a
      // later restart cannot resurrect sessions the user already deleted from
      // SQLite. Once SQLite already has sessions, a JSON id that is missing
      // there is treated as deleted rather than re-imported.
      const sqliteHasSessions = sqliteStore.list().length > 0;
      for (const legacy of await sessionStore.list()) {
        if (sqliteStore.wasDeleted(legacy.id)) {
          await sessionStore.delete(legacy.id);
          continue;
        }
        if (!sqliteStore.get(legacy.id)) {
          if (sqliteHasSessions) {
            sqliteStore.markDeleted(legacy.id);
            await sessionStore.delete(legacy.id);
            continue;
          }
          sqliteStore.replace(legacy);
        }
        await sessionStore.delete(legacy.id);
      }
      const startup =
        sqliteStore.get(input.sessionID()) ??
        sqliteStore.create(input.sessionID(), input.title ?? "New session");
      if (input.title && !startup.metadata.titleSource)
        sqliteStore.updateMetadata(input.sessionID(), {
          titleSource: "manual",
        });
    }
    initialized = true;
  }

  function status() {
    return {
      initialized,
      mode: input.useSqliteStore ? ("sqlite" as const) : ("json" as const),
    };
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
      ...(pendingHumanTerminalOf(record.metadata ?? {})
        ? {
            pendingHumanTerminal: pendingHumanTerminalOf(
              record.metadata ?? {},
            )!,
          }
        : {}),
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
      archived: Boolean(record.metadata.archived),
      events: store.eventCount(record.id),
      pendingInputs: 0,
      cancelled: record.cancelled,
      resumable: record.resumable,
      ...(pendingHumanTerminalOf(record.metadata)
        ? { pendingHumanTerminal: pendingHumanTerminalOf(record.metadata)! }
        : {}),
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

  async function load(
    id: SessionID,
    options: {
      title?: string;
      create?: boolean;
      indexedRecovery?: boolean;
    } = {},
  ): Promise<{
    session: SessionRecord;
    contextEpoch?: StoredContextEpoch;
    recovery?: SessionStoreRecoveryView;
  }> {
    const loadStart = performance.now();
    const mark = (name: string) =>
      console.warn(
        `[perf] sessionStore.load.${name} id=${id} +${(performance.now() - loadStart).toFixed(1)}ms`,
      );
    console.warn(`[perf] sessionStore.load start id=${id}`);
    const store = sqliteStore;
    const legacy =
      options.create && !store
        ? await sessionStore.loadOrCreate(id, options.title ?? "New session")
        : await sessionStore.load(id);
    if (!store) {
      if (!legacy) throw new Error(`session not found: ${id}`);
      mark("jsonStore");
      return { session: legacy };
    }

    let durable = store.get(id);
    if (!durable && legacy) {
      store.replace(legacy);
      durable = store.get(id);
    }
    if (!durable) throw new Error(`session not found: ${id}`);
    mark("get");
    const contextEpoch = store.loadContextEpoch(id);
    mark("contextEpoch");
    const indexedRecovery = options.indexedRecovery && Boolean(contextEpoch);
    let events = indexedRecovery ? [] : store.loadEvents(id);
    mark("events");
    if (!events.length && !indexedRecovery && legacy?.events.length) {
      store.replace(legacy);
      durable = store.get(id)!;
      events = store.loadEvents(id);
      mark("eventsReplace");
    }
    const inbox = store.loadInbox(id);
    mark("inbox");
    const recovery = indexedRecovery
      ? store.loadRecoveryProjection(id)
      : undefined;
    if (recovery) mark("recoveryProjection");
    return {
      session: {
        ...(legacy ?? createSessionRecord(id, options.title ?? "New session")),
        title: durable.title,
        createdAt: durable.createdAt,
        cancelled: durable.cancelled,
        resumable: durable.resumable,
        metadata: durable.metadata,
        events: events.length ? events : (legacy?.events ?? []),
        inbox: inbox.length ? inbox : legacy?.inbox,
      },
      contextEpoch,
      ...(recovery ? { recovery } : {}),
    };
  }

  async function saveInbox(session: SessionRecord) {
    if (sqliteStore) sqliteStore.replaceInbox(session.id, session.inbox ?? []);
    else await sessionStore.save(session);
  }

  async function appendEvent(session: SessionRecord, event: RuntimeEvent) {
    if (sqliteStore) {
      // Queue the event and let the SQLite store flush in batches (20ms or
      // 100 events). Awaiting a flush per event makes initialization spend
      // seconds writing hundreds of synthetic capability/tool events one by
      // one; batching is safe because the store still flushes before dispose
      // and on durable barriers.
      sqliteStore.enqueueEvent(session.id, event);
    } else await sessionStore.save(session);
  }

  async function appendEvents(session: SessionRecord, events: RuntimeEvent[]) {
    if (sqliteStore) sqliteStore.appendEvents(session.id, events);
    else await sessionStore.save(session);
  }

  async function updateMetadata(
    session: SessionRecord,
    partial: Partial<SessionMetadata>,
  ) {
    if (sqliteStore) sqliteStore.updateMetadata(session.id, partial);
    else await sessionStore.save(session);
  }

  function contextEventsAfter(id: SessionID, epoch?: StoredContextEpoch) {
    return epoch && sqliteStore
      ? sqliteStore.loadEventsAfter(id, epoch.baselineSeq)
      : undefined;
  }

  function writeContextEpoch(
    id: SessionID,
    snapshot: DurableContextCheckpointRecord,
  ) {
    if (sqliteStore) sqliteStore.writeContextEpoch(id, snapshot);
  }

  function ensureMessageIndex(id: SessionID) {
    if (sqliteStore) sqliteStore.ensureMessageIndex(id);
  }

  async function loadFullAsync(id: SessionID): Promise<SessionRecord> {
    if (!sqliteStore) {
      const record = await sessionStore.load(id);
      if (!record) throw new Error(`session not found: ${id}`);
      return record;
    }
    const durable = sqliteStore.get(id);
    if (!durable) throw new Error(`session not found: ${id}`);
    let events: RuntimeEvent[];
    if (sqliteStorePath) {
      try {
        events = await loadSessionEventsInWorker(sqliteStorePath, id);
      } catch {
        events = await sqliteStore.loadEventsAsync(id);
      }
    } else {
      events = await sqliteStore.loadEventsAsync(id);
    }
    const inbox = sqliteStore.loadInbox(id);
    return {
      id,
      title: durable.title,
      createdAt: durable.createdAt,
      cancelled: durable.cancelled,
      resumable: durable.resumable,
      metadata: durable.metadata,
      events,
      ...(inbox.length ? { inbox } : {}),
    };
  }

  async function referencedAttachments(): Promise<LocalAttachment[]> {
    return sqliteStore
      ? sqliteStore.referencedAttachments()
      : input.attachments.referencedForSessions(await sessionStore.list());
  }

  async function history(
    id: SessionID,
    fallback: RuntimeEvent[],
    options: { after?: number; offset?: number; limit?: number } = {},
  ) {
    if (sqliteStore) return sqliteStore.loadEventPage(id, options);
    const record = await sessionStore.load(id);
    const source = record?.events ?? fallback;
    const after = Math.max(0, options.after ?? 0);
    const offset = Math.max(0, options.offset ?? 0);
    const start = options.offset === undefined ? after : offset;
    const limit = Math.min(2000, Math.max(1, options.limit ?? 100));
    const page = source.slice(start, start + limit + 1);
    return {
      events: page
        .slice(0, limit)
        .map((event, index) => ({ seq: start + index + 1, event })),
      hasMore: page.length > limit,
    };
  }

  async function messages(
    id: SessionID,
    fallback: SessionRecord,
    options: { limit?: number; order?: "asc" | "desc"; cursor?: string } = {},
  ): Promise<RuntimeMessagePage> {
    if (sqliteStore) return sqliteStore.loadMessagePage(id, options);
    try {
      const { projectSessionMessagesInWorker } = await import(
        "./session-messages-worker-client"
      );
      return await projectSessionMessagesInWorker(fallback, options);
    } catch {
      return projectSessionMessages(fallback, options);
    }
  }

  async function flush(id?: SessionID) {
    await sqliteStore?.flushPendingWrites(id);
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
        archived: Boolean(record.metadata.archived),
        ...(pendingHumanTerminalOf(record.metadata)
          ? { pendingHumanTerminal: pendingHumanTerminalOf(record.metadata)! }
          : {}),
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
      const durable = store.get(id as SessionID);
      const legacy = await sessionStore.load(id as SessionID);
      if (!durable && !legacy) throw new Error(`session not found: ${id}`);
      if (durable) store.delete(id as SessionID);
      await sessionStore.delete(id as SessionID);
      const removedAttachments = await input.attachments.cleanup(
        durable
          ? store.referencedAttachments()
          : input.attachments.referencedForSessions(await sessionStore.list()),
      );
      return { id, removedAttachments: removedAttachments.length };
    }
    await byID(id);
    await sessionStore.delete(id as SessionID);
    const removedAttachments = await input.attachments.cleanup(
      input.attachments.referencedForSessions(await sessionStore.list()),
    );
    return { id, removedAttachments: removedAttachments.length };
  }

  async function messageRollback(id: string, turnID: string) {
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store) {
      const endSeq = store.seqForTurnEnd(id as SessionID, turnID);
      store.truncateAfter(id as SessionID, endSeq);
      return { id, rolledBackTo: turnID };
    }
    const record = await byID(id);
    const start = record.events.findIndex(
      (event) => event.type === "turn.submitted" && event.id === turnID,
    );
    if (start < 0) throw new Error(`turn not found: ${turnID}`);
    const next = record.events.findIndex(
      (event, index) => index > start && event.type === "turn.submitted",
    );
    const end = next === -1 ? record.events.length : next;
    record.events = record.events.slice(0, end);
    await sessionStore.save(record);
    return { id, rolledBackTo: turnID };
  }

  async function create(input_: { id?: string; title?: string }) {
    const id =
      input_.id ?? `ses_${randomUUID().replace(/-/gu, "").slice(0, 16)}`;
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store?.get(id as SessionID)) return { sessionID: id, created: false };
    if (input_.id && (await byIDOptional(id)))
      return { sessionID: id, created: false };
    const record = createSessionRecord(
      id as SessionID,
      input_.title ?? "New session",
    );
    record.metadata = { titleSource: input_.title ? "manual" : "fallback" };
    if (store) {
      store.create(record.id, record.title);
      store.updateMetadata(record.id, record.metadata);
      return { sessionID: id, created: true };
    }
    await sessionStore.save(record);
    return { sessionID: id, created: true };
  }

  async function setAutoTitle(
    id: string,
    title: string,
    source: "generated" | "fallback",
  ) {
    const store = sqliteStore as SqliteSessionStore | undefined;
    if (store)
      return sqliteSummary(
        store.setAutoTitle(id as SessionID, title, source),
        store,
      );
    return summary(
      await sessionStore.setAutoTitle(id as SessionID, title, source),
    );
  }

  async function archive(id: string) {
    const record = (await load(id as SessionID)).session;
    if (record.metadata?.archived) return { id, archived: true };
    record.metadata = { ...record.metadata, archived: true };
    await updateMetadata(record, { archived: true });
    return { id, archived: true };
  }

  async function restore(id: string) {
    const record = (await load(id as SessionID)).session;
    if (!record.metadata?.archived) return { id, archived: false };
    record.metadata = { ...record.metadata, archived: false };
    await updateMetadata(record, { archived: false });
    return { id, archived: false };
  }

  async function export_(id: string): Promise<{
    sessionID: string;
    title: string;
    createdAt: string;
    archived: boolean;
    events: Array<{ seq: number; event: RuntimeEvent }>;
  }> {
    const record = (await load(id as SessionID)).session;
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
    initialized = false;
  }

  return {
    init,
    status,
    load,
    saveInbox,
    appendEvent,
    appendEvents,
    updateMetadata,
    contextEventsAfter,
    writeContextEpoch,
    ensureMessageIndex,
    loadFullAsync,
    referencedAttachments,
    history,
    messages,
    flush,
    list,
    touch,
    rename,
    pin,
    duplicate,
    fork,
    delete: del,
    create,
    messageRollback,
    setAutoTitle,
    archive,
    restore,
    export: export_,
    close,
  };
}
