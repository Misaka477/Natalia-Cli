import {
  builtinToolFamilies,
  checkpointDisplayLine,
  compactionDisplayLine,
  globWorkspaceFiles,
  listWorkspaceFiles,
  migratedBuiltinToolFamilies,
  readWorkspaceFile,
  retryDisplayLine,
  searchWorkspaceFiles,
} from "@natalia/client";
import { discoverLocalToolFamilies } from "@natalia/local-tools-plugin";
import {
  fingerprintFile,
  loadConfigFile,
  loadTrustStore,
  migrationSummaryText,
  modelSelectionStatus,
  recordTrust,
  removeTrust,
  resolveConfig,
  resolveEffectiveModel,
  updateConfig,
} from "@natalia/config";
import type { RuntimeEvent } from "@natalia/contracts";
import { ContextWindowResolver } from "@natalia/runtime";
import {
  createLocalSessionService,
  type LocalSessionRow,
  type SessionMetadataBundle,
} from "@natalia/session-store-plugin";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
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
  const ref = loaded.config.defaultModel;
  if (!ref) throw new Error("missing default model: none configured");
  const effective = resolveEffectiveModel(loaded.config, ref);
  if (!effective) throw new Error("missing default model: none configured");
  const resolver = new ContextWindowResolver();
  const resolved = await resolver.resolve({
    provider: effective.providerID,
    model: effective.ref.model,
    explicitContextWindow: effective.limits.contextWindow,
    useModelsDevCatalog: true,
  });
  return {
    mode: process.stdout.isTTY ? "tty" : "plain",
    model: effective.ref.model,
    provider: effective.providerID,
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

export type SessionListRow = LocalSessionRow;

export async function listLocalSessions(workspaceRoot = process.cwd()) {
  return createLocalSessionService(workspaceRoot).list();
}

export async function deleteLocalSession(
  id: string,
  workspaceRoot = process.cwd(),
) {
  return createLocalSessionService(workspaceRoot).delete(id);
}

export async function showLocalSession(
  id: string,
  workspaceRoot = process.cwd(),
) {
  return createLocalSessionService(workspaceRoot).show(id);
}

export async function localWorkGraph(
  sessionID: string,
  workspaceRoot = process.cwd(),
) {
  return createLocalSessionService(workspaceRoot).workGraph(sessionID);
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
  return createLocalSessionService(workspaceRoot).rename(id, title);
}

export async function setLocalSessionPinned(
  id: string,
  pinned: boolean,
  workspaceRoot = process.cwd(),
) {
  return createLocalSessionService(workspaceRoot).setPinned(id, pinned);
}

export async function duplicateLocalSession(
  id: string,
  input: { title?: string; newID?: string; workspaceRoot?: string } = {},
) {
  return createLocalSessionService(input.workspaceRoot).duplicate(id, input);
}

export type { SessionMetadataBundle };

export async function exportLocalSessionMetadata(
  id: string,
  workspaceRoot = process.cwd(),
): Promise<SessionMetadataBundle> {
  return createLocalSessionService(workspaceRoot).exportMetadata(id);
}

export async function importLocalSessionMetadata(
  bundle: SessionMetadataBundle,
  input: { workspaceRoot?: string; id?: string; title?: string } = {},
) {
  return createLocalSessionService(input.workspaceRoot).importMetadata(
    bundle,
    input,
  );
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
  const defaultRef = loaded.config.defaultModel;
  const selection = defaultRef
    ? modelSelectionStatus(loaded.config, defaultRef)
    : {
        ref: { provider: "", model: "" },
        key: "",
        configured: false,
        usable: false,
        policyAllowed: false,
        selected: false,
        reason: "model_not_configured",
      };
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
export function toolFamilyCatalogue(): Array<{
  id: string;
  name: string;
  version: string;
  description: string;
  scope: string;
  dependencies: readonly string[];
  tools: readonly string[];
}> {
  return [
    ...builtinToolFamilies().map((family) => ({
      id: family.id,
      name: family.name,
      version: family.version,
      description: family.description,
      scope: family.scope,
      dependencies: family.dependencies ?? [],
      tools: family.tools.map((tool) => tool.name),
    })),
    ...migratedBuiltinToolFamilies,
  ];
}

export async function installToolFamily(input: {
  workspaceRoot: string;
  familyID: string;
}): Promise<{ installed: boolean; note?: string }> {
  const families = toolFamilyCatalogue();
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
  const families = toolFamilyCatalogue();
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

/**
 * Installs an out-of-tree tool family from a package manager spec.
 *
 * The P11 distribution layer, corrected by the dsh research: package
 * management is delegated to the standard package manager (npm/pnpm) — registry
 * resolution, download, versioning, dependencies and integrity are its job, and
 * its lockfile is the integrity. This is a thin forwarder: `npm install` into
 * `.natalia/tools`, then the family is discovered from the installed state (the
 * loader scans `node_modules/*` for a `natalia.tool.json`), trusted and enabled.
 */
export async function installRegistryToolFamily(input: {
  workspaceRoot: string;
  spec: string;
}): Promise<{ installed: boolean; familyID: string; source: string }> {
  const toolsDir = resolve(input.workspaceRoot, ".natalia", "tools");
  await mkdir(toolsDir, { recursive: true });
  const process = Bun.spawn(
    [
      "npm",
      "install",
      "--no-audit",
      "--no-fund",
      "--prefix",
      toolsDir,
      input.spec,
    ],
    { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0)
    throw new Error(
      `npm install ${input.spec} failed: ${(stderr || stdout).trim()}`,
    );

  // Find the installed family package by its manifest, then learn its id.
  const discovered = await discoverLocalToolFamilies(toolsDir);
  const installed = discovered.map(({ manifest, path }) => ({
    manifest,
    path,
    packageDir: resolve(path, ".."),
  }));
  if (!installed.length)
    throw new Error(
      `no tool family package found in ${toolsDir} after install`,
    );
  const entry = resolve(installed[0]!.packageDir, installed[0]!.manifest.entry);
  const module = (await import(pathToFileURL(entry).href)) as {
    default?: unknown;
  };
  const exported = module.default;
  const family =
    typeof exported === "function"
      ? (exported as () => { id: string; version: string })()
      : (exported as { id: string; version: string } | undefined);
  if (!family?.id)
    throw new Error(`tool family entry has no default export: ${entry}`);

  await recordTrust(input.workspaceRoot, {
    key: installed[0]!.packageDir,
    source: input.spec,
    version: family.version,
    fingerprint: await fingerprintFile(entry),
    installedAt: new Date().toISOString(),
  });

  const { config } = await resolveConfig({
    workspaceRoot: input.workspaceRoot,
  });
  const enabled = { ...config.tools.enabled, [family.id]: true };
  const paths = Array.from(new Set([...(config.tools.paths ?? []), toolsDir]));
  await updateConfig(input.workspaceRoot, { tools: { enabled, paths } });
  return { installed: true, familyID: family.id, source: input.spec };
}
