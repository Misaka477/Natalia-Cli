import {
  checkpointDisplayLine,
  compactionDisplayLine,
  globWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  retryDisplayLine,
  searchWorkspaceFiles,
} from "@natalia/client";
import {
  cleanupUnreferencedAttachments,
  referencedAttachmentsForSessions,
} from "@natalia/client";
import {
  loadConfigFile,
  migrationSummaryText,
  modelSelectionStatus,
  resolveConfig,
} from "@natalia/config";
import type { RuntimeEvent } from "@natalia/contracts";
import type { RuntimePTYSession } from "@natalia/contracts";
import {
  applyTerminalScreenUpdate,
  renderTerminalSnapshotANSI,
} from "@natalia/terminal";
export {
  externalTerminalLaunchCommand,
  launchExternalTerminal,
} from "@natalia/terminal";
import { callRuntimeRPC } from "@natalia/transport";
import { ContextWindowResolver } from "@natalia/runtime";
import { JsonSessionStore } from "@natalia/session";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";

export type StartupDiagnostics = {
  configPath: string;
  migrationSummary: string;
  tty: boolean;
  automation: boolean;
};

export async function startupDiagnostics(
  configPath: string,
  tty = Boolean(process.stdout.isTTY),
): Promise<StartupDiagnostics> {
  const loaded = await loadConfigFile(configPath);
  return {
    configPath,
    migrationSummary: migrationSummaryText(loaded.summary),
    tty,
    automation: !tty,
  };
}

export async function attachTerminalReadOnly(input: {
  id: string;
  url: string;
  token?: string;
  signal?: AbortSignal;
  pollMs?: number;
  write?: (frame: string) => void;
  viewerID?: string;
  sensitive?: boolean;
  manageViewer?: boolean;
}) {
  const write = input.write ?? ((frame: string) => process.stdout.write(frame));
  const viewerID = input.viewerID ?? `viewer_${randomUUID()}`;
  let revision = -1;
  let last: RuntimePTYSession | undefined;
  let screen: RuntimePTYSession["screen"];
  if (input.manageViewer !== false)
    await callRuntimeRPC({
      url: input.url,
      token: input.token,
      method: "terminal.viewer.register",
      params: { id: input.id, viewerID, kind: "external" },
    });
  write("\x1b[?1049h\x1b[?25l");
  try {
    while (!input.signal?.aborted) {
      const observation = await callRuntimeRPC<{
        session: RuntimePTYSession;
        afterRevision: number;
        changed: boolean;
        reason: "changed" | "timeout" | "exited";
        screenUpdate?: import("@natalia/contracts").TerminalScreenUpdate;
      }>({
        url: input.url,
        token: input.token,
        method: "terminal.observe",
        signal: input.signal,
        params: {
          id: input.id,
          afterRevision: Math.max(0, revision),
          timeoutMs: Math.min(30_000, Math.max(0, input.pollMs ?? 30_000)),
          differential: revision >= 0,
        },
      });
      const session = observation.session;
      last = observation.session;
      screen = applyTerminalScreenUpdate(
        screen ?? session.screen,
        observation.screenUpdate,
        revision >= 0 ? revision : undefined,
      );
      if (screen && session.revision !== revision) {
        revision = session.revision ?? revision;
        write(renderTerminalSnapshotANSI(screen));
      }
      if (session.status === "exited" || session.status === "failed") break;
    }
  } catch (error) {
    if (!input.signal?.aborted) throw error;
  } finally {
    write("\x1b[0m\x1b[?2004l\x1b[?25h\x1b[?1049l");
    if (input.manageViewer !== false)
      await callRuntimeRPC({
        url: input.url,
        token: input.token,
        method: "terminal.viewer.control",
        params: { id: input.id, viewerID, action: "unregister" },
      }).catch(() => undefined);
  }
  return last;
}

export async function attachTerminalWithControl(input: {
  id: string;
  url: string;
  token?: string;
  signal?: AbortSignal;
  viewerID?: string;
  sensitive?: boolean;
}) {
  const viewerID = input.viewerID ?? `viewer_${randomUUID()}`;
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener("abort", abort, { once: true });
  await callRuntimeRPC({
    url: input.url,
    token: input.token,
    method: "terminal.viewer.register",
    params: { id: input.id, viewerID, kind: "external" },
  });
  await callRuntimeRPC({
    url: input.url,
    token: input.token,
    method: "terminal.viewer.control",
    params: { id: input.id, viewerID, action: "takeover" },
  });

  let writes = Promise.resolve();
  const send = (method: string, params: Record<string, unknown>) => {
    writes = writes.then(async () => {
      await callRuntimeRPC({
        url: input.url,
        token: input.token,
        method,
        params: { id: input.id, viewerID, ...params },
      });
    });
  };
  const resize = () => {
    const rows = process.stdout.rows;
    const cols = process.stdout.columns;
    if (rows && cols)
      send("terminal.viewer.resize", {
        rows: Math.max(10, rows),
        cols: Math.max(20, cols),
      });
  };
  const onData = (chunk: Buffer) => {
    const data = chunk.toString("utf8");
    if (data.includes("\x1d")) {
      controller.abort();
      return;
    }
    send("terminal.viewer.write", { data, sensitive: input.sensitive });
  };
  const raw = Boolean(process.stdin.isTTY && process.stdin.setRawMode);
  if (raw) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", onData);
  process.stdout.on("resize", resize);
  resize();
  const heartbeat = setInterval(
    () => send("terminal.viewer.heartbeat", {}),
    10_000,
  );
  heartbeat.unref();
  try {
    return await attachTerminalReadOnly({
      ...input,
      viewerID,
      manageViewer: false,
      signal: controller.signal,
    });
  } finally {
    clearInterval(heartbeat);
    process.stdin.off("data", onData);
    process.stdout.off("resize", resize);
    if (raw) process.stdin.setRawMode(false);
    process.stdin.pause();
    await writes.catch(() => undefined);
    await callRuntimeRPC({
      url: input.url,
      token: input.token,
      method: "terminal.viewer.control",
      params: { id: input.id, viewerID, action: "unregister" },
    }).catch(() => undefined);
    input.signal?.removeEventListener("abort", abort);
  }
}

export async function plainStatus(configPath: string) {
  const loaded = await loadConfigFile(configPath);
  const model = loaded.config.models[loaded.config.defaultModel];
  if (!model)
    throw new Error(`missing default model: ${loaded.config.defaultModel}`);
  const resolver = new ContextWindowResolver();
  const resolved = await resolver.resolve({
    provider: model.provider,
    model: model.model,
    explicitContextWindow: model.contextWindow,
  });
  return {
    mode: process.stdout.isTTY ? "tty" : "plain",
    model: model.model,
    provider: model.provider,
    contextWindow: resolved,
  };
}

export function plainEventLine(event: RuntimeEvent) {
  return (
    checkpointDisplayLine(event) ??
    retryDisplayLine(event) ??
    compactionDisplayLine(event) ??
    event.type
  );
}

export type SessionListRow = {
  id: string;
  title: string;
  createdAt: string;
  lastAccessedAt?: string;
  pinned: boolean;
  events: number;
  pendingInputs: number;
};

export async function listLocalSessions(workspaceRoot = process.cwd()) {
  const sessions = await new JsonSessionStore(
    join(resolve(workspaceRoot), ".natalia", "sessions"),
  ).list();
  return sessions.map(
    (session) =>
      ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastAccessedAt: session.metadata?.lastAccessedAt,
        pinned: Boolean(session.metadata?.pinned),
        events: session.events.length,
        pendingInputs:
          session.inbox?.filter((input) => !input.promotedAt).length ?? 0,
      }) satisfies SessionListRow,
  );
}

export async function deleteLocalSession(
  id: string,
  workspaceRoot = process.cwd(),
) {
  const store = new JsonSessionStore(
    join(resolve(workspaceRoot), ".natalia", "sessions"),
  );
  if (!(await store.load(id as import("@natalia/contracts").SessionID)))
    throw new Error(`session not found: ${id}`);
  await store.delete(id as import("@natalia/contracts").SessionID);
  const removedAttachments = await cleanupUnreferencedAttachments({
    workspaceRoot,
    attachments: referencedAttachmentsForSessions(await store.list()),
  });
  return { id, deleted: true, removedAttachments: removedAttachments.length };
}

function localSessionStore(workspaceRoot = process.cwd()) {
  return new JsonSessionStore(
    join(resolve(workspaceRoot), ".natalia", "sessions"),
  );
}

export async function showLocalSession(
  id: string,
  workspaceRoot = process.cwd(),
) {
  const session = await localSessionStore(workspaceRoot).load(
    id as import("@natalia/contracts").SessionID,
  );
  if (!session) throw new Error(`session not found: ${id}`);
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    pinned: Boolean(session.metadata?.pinned),
    lastAccessedAt: session.metadata?.lastAccessedAt,
    events: session.events.length,
    pendingInputs:
      session.inbox?.filter((input) => !input.promotedAt).length ?? 0,
    cancelled: session.cancelled,
    resumable: session.resumable,
  };
}

export async function renameLocalSession(
  id: string,
  title: string,
  workspaceRoot = process.cwd(),
) {
  const session = await localSessionStore(workspaceRoot).rename(
    id as import("@natalia/contracts").SessionID,
    title,
  );
  return { id: session.id, title: session.title };
}

export async function setLocalSessionPinned(
  id: string,
  pinned: boolean,
  workspaceRoot = process.cwd(),
) {
  const session = await localSessionStore(workspaceRoot).updateMetadata(
    id as import("@natalia/contracts").SessionID,
    { pinned },
  );
  return { id: session.id, pinned: Boolean(session.metadata?.pinned) };
}

export async function duplicateLocalSession(
  id: string,
  input: { title?: string; newID?: string; workspaceRoot?: string } = {},
) {
  const session = await localSessionStore(input.workspaceRoot).duplicate(
    id as import("@natalia/contracts").SessionID,
    input.newID as import("@natalia/contracts").SessionID | undefined,
    input.title,
  );
  return { id: session.id, title: session.title, duplicatedFrom: id };
}

export type SessionMetadataBundle = {
  version: 1;
  source: { id: string; createdAt: string };
  title: string;
  pinned: boolean;
  cancelled: boolean;
  resumable: boolean;
};

export async function exportLocalSessionMetadata(
  id: string,
  workspaceRoot = process.cwd(),
): Promise<SessionMetadataBundle> {
  const session = await localSessionStore(workspaceRoot).load(
    id as import("@natalia/contracts").SessionID,
  );
  if (!session) throw new Error(`session not found: ${id}`);
  return {
    version: 1,
    source: { id: session.id, createdAt: session.createdAt },
    title: session.title,
    pinned: Boolean(session.metadata?.pinned),
    cancelled: session.cancelled,
    resumable: session.resumable,
  };
}

export async function importLocalSessionMetadata(
  bundle: SessionMetadataBundle,
  input: { workspaceRoot?: string; id?: string; title?: string } = {},
) {
  if (bundle.version !== 1 || !bundle.source?.id || !bundle.title)
    throw new Error("invalid session metadata bundle");
  const store = localSessionStore(input.workspaceRoot);
  const id = (input.id ??
    `ses_import_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`) as import("@natalia/contracts").SessionID;
  if (await store.load(id)) throw new Error(`session already exists: ${id}`);
  const { createSessionRecord } = await import("@natalia/session");
  const session = createSessionRecord(id, input.title ?? bundle.title);
  session.cancelled = bundle.cancelled;
  session.resumable = bundle.resumable;
  session.metadata = { pinned: bundle.pinned, importedFrom: bundle.source.id };
  await store.save(session);
  return {
    id: session.id,
    title: session.title,
    importedFrom: bundle.source.id,
  };
}

export async function doctorReport(input: {
  configPath: string;
  workspaceRoot?: string;
}) {
  const loaded = await loadConfigFile(input.configPath);
  const resolved = await resolveConfig({
    workspaceRoot: input.workspaceRoot ?? process.cwd(),
    globalPath: input.configPath,
  });
  const selection = modelSelectionStatus(
    loaded.config,
    loaded.config.defaultModel,
  );
  const sessions = await listLocalSessions(input.workspaceRoot);
  return {
    configPath: input.configPath,
    migration: migrationSummaryText(loaded.summary),
    defaultModel: selection,
    sessions: {
      count: sessions.length,
      pendingInputs: sessions.reduce(
        (sum, session) => sum + session.pendingInputs,
        0,
      ),
    },
    runtime: {
      tty: Boolean(process.stdout.isTTY),
      automation: !process.stdout.isTTY,
    },
    sources: resolved.sources.map((source) => ({
      scope: source.scope,
      path: source.path,
      applied: source.applied,
      diagnostic: source.diagnostic,
    })),
  };
}

export function sessionTable(rows: SessionListRow[]) {
  if (!rows.length) return "no sessions";
  return [
    "ID\tTITLE\tEVENTS\tPENDING\tPINNED",
    ...rows.map((session) =>
      [
        session.id,
        session.title.replace(/\s+/gu, " "),
        session.events,
        session.pendingInputs,
        session.pinned ? "yes" : "no",
      ].join("\t"),
    ),
  ].join("\n");
}

export function parseAttachmentFlags(argv: string[]) {
  const attachments: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] !== "--attach") continue;
    const path = argv[index + 1];
    if (!path || path.startsWith("--"))
      throw new Error("--attach requires a workspace-relative path");
    attachments.push(path);
    index++;
  }
  return attachments;
}

export function promptArguments(argv: string[]) {
  const attachments = parseAttachmentFlags(argv);
  const text = argv
    .filter((value, index) => {
      if (value === "--attach") return false;
      if (index > 0 && argv[index - 1] === "--attach") return false;
      return value !== "--json";
    })
    .join(" ")
    .trim();
  return { text, attachments };
}

export async function workspaceFilesystemCommand(input: {
  action: "list" | "read" | "glob" | "search";
  workspaceRoot?: string;
  path?: string;
  pattern?: string;
  query?: string;
  include?: string;
  offset?: number;
  limit?: number;
}) {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  if (input.action === "list")
    return await listWorkspaceFiles({
      workspaceRoot,
      path: input.path,
      offset: input.offset,
      limit: input.limit,
    });
  if (input.action === "read") {
    if (!input.path) throw new Error("fs read requires a path");
    return await readWorkspaceFile({
      workspaceRoot,
      path: input.path,
      offset: input.offset,
      limit: input.limit,
    });
  }
  if (input.action === "glob") {
    if (!input.pattern) throw new Error("fs glob requires a pattern");
    return await globWorkspaceFiles({
      workspaceRoot,
      pattern: input.pattern,
      path: input.path,
      limit: input.limit,
    });
  }
  if (!input.query) throw new Error("fs search requires a query");
  return await searchWorkspaceFiles({
    workspaceRoot,
    query: input.query,
    include: input.include,
    limit: input.limit,
  });
}
