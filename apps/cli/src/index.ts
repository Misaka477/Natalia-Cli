import {
  builtinToolFamilies,
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
  fingerprintFile,
  loadConfigFile,
  loadTrustStore,
  migrationSummaryText,
  modelSelectionStatus,
  recordTrust,
  removeTrust,
  resolveConfig,
  updateConfig,
} from "@natalia/config";
import type { RuntimeEvent } from "@natalia/contracts";
import { callRuntimeRPC } from "@natalia/transport";
import { ContextWindowResolver } from "@natalia/runtime";
import {
  JsonSessionStore,
  SqliteSessionStore,
  projectedWorkGraphEdges,
  projectedWorkGraphNodes,
} from "@natalia/session";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  const root = resolve(workspaceRoot);
  const jsonSessions = await new JsonSessionStore(
    join(root, ".natalia", "sessions"),
  ).list();
  const sqlite = localSqliteSessionStore(root);
  const sqliteSessions = sqlite
    ? sqlite.list().map(
        (session) =>
          ({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            lastAccessedAt: session.metadata.lastAccessedAt as
              | string
              | undefined,
            pinned: session.pinned,
            events: sqlite.eventCount(session.id),
            pendingInputs: sqlite.pendingInputCount(session.id),
          }) satisfies SessionListRow,
      )
    : [];
  sqlite?.close();
  const sqliteIDs = new Set(sqliteSessions.map((session) => session.id));
  const sessions = jsonSessions
    .filter((session) => !sqliteIDs.has(session.id))
    .map(
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
  return [...sqliteSessions, ...sessions].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.createdAt.localeCompare(left.createdAt);
  });
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

function localSqliteSessionStore(workspaceRoot = process.cwd()) {
  const path = join(resolve(workspaceRoot), ".natalia", "sessions.db");
  return existsSync(path) ? new SqliteSessionStore(path) : undefined;
}

export async function showLocalSession(
  id: string,
  workspaceRoot = process.cwd(),
) {
  const sqlite = localSqliteSessionStore(workspaceRoot);
  const sqliteSession = sqlite?.get(
    id as import("@natalia/contracts").SessionID,
  );
  if (sqlite && sqliteSession) {
    const result = {
      id: sqliteSession.id,
      title: sqliteSession.title,
      createdAt: sqliteSession.createdAt,
      pinned: sqliteSession.pinned,
      lastAccessedAt: sqliteSession.metadata.lastAccessedAt as
        | string
        | undefined,
      events: sqlite.eventCount(sqliteSession.id),
      pendingInputs: sqlite.pendingInputCount(sqliteSession.id),
      cancelled: sqliteSession.cancelled,
      resumable: sqliteSession.resumable,
    };
    sqlite.close();
    return result;
  }
  sqlite?.close();
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

export async function localWorkGraph(
  sessionID: string,
  workspaceRoot = process.cwd(),
) {
  const root = resolve(workspaceRoot);
  const sqlite = localSqliteSessionStore(root);
  const session = sqlite
    ? sqlite.loadRecord(sessionID as import("@natalia/contracts").SessionID)
    : undefined;
  if (sqlite) sqlite.close();
  const record =
    session ??
    (await localSessionStore(root).load(
      sessionID as import("@natalia/contracts").SessionID,
    ));
  if (!record) throw new Error(`session not found: ${sessionID}`);
  return {
    sessionID: record.id,
    nodes: projectedWorkGraphNodes(record.events),
    edges: projectedWorkGraphEdges(record.events),
  };
}

export function workGraphLines(
  graph: Awaited<ReturnType<typeof localWorkGraph>>,
) {
  return [
    `session: ${graph.sessionID}`,
    `nodes: ${graph.nodes.length}`,
    ...graph.nodes.map(
      (node) =>
        `  ${node.kind} ${node.nodeID}: ${node.summary}${node.target ? ` -> ${node.target}` : ""}`,
    ),
    `edges: ${graph.edges.length}`,
    ...graph.edges.map(
      (edge) => `  ${edge.kind}: ${edge.sourceID} -> ${edge.targetID}`,
    ),
  ];
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

/**
 * The families this CLI knows how to install and uninstall.
 *
 * This is the host's catalogue — the same `builtinToolFamilies` the runtime
 * loads — so the CLI and the runtime can never disagree about what a family id
 * means.
 */
export function toolFamilyCatalogue() {
  return builtinToolFamilies().map((family) => ({
    id: family.id,
    name: family.name,
    version: family.version,
    description: family.description,
    scope: family.scope,
    dependencies: family.dependencies ?? [],
    tools: family.tools.map((tool) => tool.name),
  }));
}

export async function installToolFamily(input: {
  workspaceRoot: string;
  familyID: string;
}): Promise<{ installed: boolean; note?: string }> {
  const families = builtinToolFamilies();
  const family = families.find((candidate) => candidate.id === input.familyID);
  if (!family)
    throw new Error(
      `unknown tool family: ${input.familyID} (known: ${families.map((candidate) => candidate.id).join(", ")})`,
    );
  const { config } = await resolveConfig({
    workspaceRoot: input.workspaceRoot,
  });
  const disabled = config.tools.enabled ?? {};
  // Installing restores a family to its default-on state.
  const note = (family.dependencies ?? []).filter(
    (dependency) => disabled[dependency] === false,
  ).length
    ? `note: ${family.id} depends on a disabled family (${(family.dependencies ?? []).filter((dependency) => disabled[dependency] === false).join(", ")}); enable it too or this family will not load`
    : undefined;
  const enabled = { ...disabled, [family.id]: true };
  await updateConfig(input.workspaceRoot, { tools: { enabled } });
  return { installed: true, note };
}

export async function uninstallToolFamily(input: {
  workspaceRoot: string;
  familyID: string;
}): Promise<{ uninstalled: boolean; note?: string }> {
  const families = builtinToolFamilies();
  const family = families.find((candidate) => candidate.id === input.familyID);
  if (!family)
    throw new Error(
      `unknown tool family: ${input.familyID} (known: ${families.map((candidate) => candidate.id).join(", ")})`,
    );
  const { config } = await resolveConfig({
    workspaceRoot: input.workspaceRoot,
  });
  const disabled = config.tools.enabled ?? {};
  const enabled = { ...disabled, [family.id]: false };
  // Uninstalling a family another enabled family depends on cascade-disables
  // that family too; the runtime will report it, and so do we.
  const affected = families
    .filter(
      (candidate) =>
        candidate.id !== family.id &&
        disabled[candidate.id] !== false &&
        (candidate.dependencies ?? []).includes(family.id),
    )
    .map((candidate) => candidate.id);
  const note = affected.length
    ? `note: disabling ${family.id} also disables ${affected.join(", ")}`
    : undefined;
  await updateConfig(input.workspaceRoot, { tools: { enabled } });
  return { uninstalled: true, note };
}

/**
 * Installs an out-of-tree tool family package from a directory.
 *
 * The directory holds a `natalia.tool.json` manifest; installing it loads the
 * family, records its source + entry fingerprint in the trust database, adds
 * its parent to `tools.paths` and enables the family — so a later load verifies
 * the package against the trust record instead of silently running whatever is
 * on disk.
 */
export async function installOutOfTreeToolFamily(input: {
  workspaceRoot: string;
  dir: string;
}): Promise<{ installed: boolean; familyID: string; note?: string }> {
  const dir = resolve(input.workspaceRoot, input.dir);
  const manifestPath = resolve(dir, "natalia.tool.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    entry?: string;
  };
  const entryPath = resolve(dir, manifest.entry ?? "index.ts");
  const module = (await import(pathToFileURL(entryPath).href)) as {
    default?: unknown;
  };
  const exported = module.default;
  const family =
    typeof exported === "function"
      ? (exported as () => { id: string; version: string })()
      : (exported as { id: string; version: string } | undefined);
  if (!family?.id)
    throw new Error(`tool family entry has no default export: ${entryPath}`);

  await recordTrust(input.workspaceRoot, {
    key: dir,
    source: dir,
    version: family.version,
    fingerprint: await fingerprintFile(entryPath),
    installedAt: new Date().toISOString(),
  });

  const { config } = await resolveConfig({
    workspaceRoot: input.workspaceRoot,
  });
  const enabled = { ...config.tools.enabled, [family.id]: true };
  const paths = Array.from(
    new Set([...(config.tools.paths ?? []), resolve(dir, "..")]),
  );
  await updateConfig(input.workspaceRoot, { tools: { enabled, paths } });
  return { installed: true, familyID: family.id };
}

/** The trust database, for `natalia trust list`. */
export async function trustList(workspaceRoot: string) {
  const store = await loadTrustStore(workspaceRoot);
  return Object.entries(store).map(([key, entry]) => ({
    key,
    source: entry.source,
    version: entry.version,
    installedAt: entry.installedAt,
  }));
}

/** Removes a trust record, for `natalia trust remove`. */
export async function trustRemove(workspaceRoot: string, key: string) {
  const store = await removeTrust(workspaceRoot, key);
  return { removed: !store[key], key };
}
