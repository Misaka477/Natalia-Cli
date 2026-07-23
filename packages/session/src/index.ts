import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import {
  mkdir,
  readFile,
  readdir,
  rename as fsRename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

export type SessionMetadata = {
  pinned?: boolean;
  lastAccessedAt?: string;
  inFlightOperation?: DurableInFlightOperation;
} & Record<string, unknown>;

/** Safe crash-audit state, intentionally insufficient to replay work. */
export type DurableInFlightOperation = {
  kind: "provider_dispatch" | "tool_execution";
  turnID: string;
  toolName?: string;
  toolCallID?: string;
  startedAt: string;
};

export type SessionRecord = {
  id: SessionID;
  title: string;
  createdAt: string;
  events: RuntimeEvent[];
  cancelled: boolean;
  resumable: boolean;
  metadata?: SessionMetadata;
  inbox?: import("./inbox").AdmittedSessionInput[];
};

export function createSessionRecord(
  id: SessionID,
  title: string,
  now = new Date(),
): SessionRecord {
  return {
    id,
    title,
    createdAt: now.toISOString(),
    events: [],
    cancelled: false,
    resumable: true,
  };
}

export function appendSessionEvent(
  session: SessionRecord,
  event: RuntimeEvent,
) {
  session.events.push(event);
  if (event.type === "turn.cancelled") session.cancelled = true;
}

export class JsonSessionStore {
  readonly dir: string;
  private writeQueue = Promise.resolve();

  constructor(dir = ".natalia/sessions") {
    this.dir = resolve(dir);
  }

  async load(id: SessionID) {
    try {
      return JSON.parse(await readFile(this.path(id), "utf8")) as SessionRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async save(session: SessionRecord) {
    const snapshot = structuredClone(session);
    const write = async () => {
      await mkdir(this.dir, { recursive: true, mode: 0o700 });
      const temporary = `${this.path(snapshot.id)}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {
        mode: 0o600,
      });
      await fsRename(temporary, this.path(snapshot.id));
    };
    const queued = this.writeQueue.then(write, write);
    this.writeQueue = queued.catch(() => undefined);
    return await queued;
  }

  async loadOrCreate(id: SessionID, title: string) {
    const existing = await this.load(id);
    if (existing) return existing;
    const session = createSessionRecord(id, title);
    await this.save(session);
    return session;
  }

  async list() {
    try {
      const entries = await readdir(this.dir, { withFileTypes: true });
      const sessions: SessionRecord[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        try {
          const session = JSON.parse(
            await readFile(join(this.dir, entry.name), "utf8"),
          ) as SessionRecord;
          if (session.id && session.title && Array.isArray(session.events))
            sessions.push(session);
        } catch {
          // Ignore corrupt records; the active session remains usable.
        }
      }
      // Pinned first, then by lastAccessedAt descending, then by createdAt descending
      return sessions.sort((left, right) => {
        const lp = left.metadata?.pinned ? 1 : 0;
        const rp = right.metadata?.pinned ? 1 : 0;
        if (lp !== rp) return rp - lp;
        const la = left.metadata?.lastAccessedAt ?? "";
        const ra = right.metadata?.lastAccessedAt ?? "";
        if (la !== ra) return ra.localeCompare(la);
        return right.createdAt.localeCompare(left.createdAt);
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async rename(id: SessionID, title: string) {
    const session = await this.load(id);
    if (!session) throw new Error(`session not found: ${id}`);
    const trimmed = title.trim();
    if (!trimmed) throw new Error("session title cannot be empty");
    session.title = trimmed;
    await this.save(session);
    return session;
  }

  async delete(id: SessionID) {
    await rm(this.path(id), { force: true });
  }

  async updateMetadata(id: SessionID, partial: Partial<SessionMetadata>) {
    const session = await this.load(id);
    if (!session) throw new Error(`session not found: ${id}`);
    session.metadata = { ...session.metadata, ...partial };
    await this.save(session);
    return session;
  }

  async duplicate(id: SessionID, newID?: SessionID, newTitle?: string) {
    const session = await this.load(id);
    if (!session) throw new Error(`session not found: ${id}`);
    const targetID =
      newID ??
      (`ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}` as SessionID);
    const copy: SessionRecord = {
      ...structuredClone(session),
      id: targetID,
      title: newTitle ?? `${session.title} (copy)`,
      metadata: {
        ...session.metadata,
        lastAccessedAt: new Date().toISOString(),
      },
    };
    await this.save(copy);
    return copy;
  }

  async fork(
    id: SessionID,
    turnID: string,
    newID?: SessionID,
    newTitle?: string,
  ) {
    const session = await this.load(id);
    if (!session) throw new Error(`session not found: ${id}`);
    const boundary = session.events.findIndex(
      (event) => event.type === "turn.submitted" && event.id === turnID,
    );
    if (boundary < 0) throw new Error(`turn not found: ${turnID}`);
    const targetID =
      newID ??
      (`ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}` as SessionID);
    const includedTurns = new Set(
      session.events
        .slice(0, boundary)
        .flatMap((event) =>
          event.type === "turn.submitted" ? [event.id] : [],
        ),
    );
    const fork: SessionRecord = {
      ...structuredClone(session),
      id: targetID,
      title: newTitle ?? `${session.title} (fork)`,
      events: structuredClone(session.events.slice(0, boundary)),
      inbox: session.inbox
        ?.filter((input) => includedTurns.has(input.id))
        .map((input) => ({ ...structuredClone(input), sessionID: targetID })),
      metadata: {
        ...session.metadata,
        lastAccessedAt: new Date().toISOString(),
      },
    };
    await this.save(fork);
    return fork;
  }

  private path(id: SessionID) {
    return join(this.dir, `${id}.json`);
  }
}

export { SqliteSessionStore } from "./sqlite-store";
export type {
  SessionRow,
  StoredContextEpoch,
  StoredSessionEvent,
} from "./sqlite-store";
export {
  releaseSessionRunCoordinator,
  SessionRunCoordinator,
  sessionRunCoordinator,
} from "./run-coordinator";
export {
  admitInput,
  admissionCutoff,
  admittedInputs,
  promoteNextQueued,
  promoteSteers,
  SessionInputConflictError,
} from "./inbox";
export type { AdmittedSessionInput, SessionInputDelivery } from "./inbox";
export {
  modelVisibleEvents,
  projectSessionMessages,
  projectSession,
  settleInterruptedTurns,
  selectedAgentFromEvents,
  selectedModelFromEvents,
} from "./projector";
export type { SessionProjection } from "./projector";
export { projectInteractiveRequests, requestsForSession } from "./interactive";
export type {
  InteractiveProjection,
  PendingApproval,
  PendingQuestion,
} from "./interactive";
