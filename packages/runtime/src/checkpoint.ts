import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  appendFile,
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import type {
  CheckpointChangeKind,
  CheckpointPreview,
  CheckpointResourcePolicy,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import type { ContextLedger, DurableContextCheckpoint } from "./context";

export type CheckpointReason =
  | "baseline"
  | "turn_begin"
  | "step_begin"
  | "manual"
  | "pre_tool"
  | "pre_compaction"
  | "rollback_safety";

export type ManifestEntry = {
  path: string;
  kind: "regular" | "symlink";
  objectHash?: string;
  size?: number;
  mode: number;
  linkTarget?: string;
};

export type WorkspaceManifest = {
  root: string;
  entries: Record<string, ManifestEntry>;
  complete: boolean;
  errors: string[];
  ignoredFiles: number;
  totalBytes: number;
};

export type CheckpointChange = {
  kind: CheckpointChangeKind;
  path: string;
  oldPath?: string;
  mode?: string;
};

export type CheckpointRecord = {
  schemaVersion: 2;
  id: string;
  sequence: number;
  sessionID: SessionID;
  turnID?: string;
  stepID?: string;
  step: number;
  reason: CheckpointReason;
  createdAt: string;
  cwd: string;
  complete: boolean;
  errors: string[];
  manifest: WorkspaceManifest;
  context: DurableContextCheckpoint;
  changes: CheckpointChange[];
  runtime: {
    status: string;
    model?: string;
    tokenEstimate: number;
    compactionGeneration: number;
  };
  diskUsageBytes: number;
};

export type CheckpointRuntimeResource = {
  kind: CheckpointResourcePolicy["kind"];
  id: string;
  status: "running" | "waiting" | "pending" | "stopped" | "preserve_dirty";
  summary: string;
};

export type CheckpointStoreOptions = {
  sessionID: SessionID;
  workspaceRoot: string;
  storeDir?: string;
  enabled?: boolean;
  maxFiles?: number;
  maxBytes?: number;
  ignore?: string[];
  additionalDirs?: string[];
  onEvent?: (event: RuntimeEvent) => void;
  now?: () => Date;
};

export type CreateCheckpointInput = {
  reason: CheckpointReason;
  context: ContextLedger;
  step: number;
  turnID?: string;
  stepID?: string;
  model?: string;
  status?: string;
};

export type RollbackOptions = {
  context: ContextLedger;
  dryRun?: boolean;
  resources?: CheckpointRuntimeResource[];
  failAfterWorkspaceApply?: boolean;
  failContextRestore?: boolean;
};

export type CheckpointCommandResult = {
  ok: boolean;
  output: string;
  event?: RuntimeEvent;
};

const DEFAULT_IGNORES = [
  ".git",
  ".natalia",
  "node_modules",
  "dist",
  "devref",
  ".kilo/sessions",
  ".kilo/agent-manager.json",
];

export class CheckpointStore {
  readonly workspaceRoot: string;
  readonly storeDir: string;
  private readonly sessionID: SessionID;
  private readonly enabled: boolean;
  private readonly maxFiles: number;
  private readonly maxBytes: number;
  private readonly ignore: string[];
  private readonly additionalDirs: string[];
  private readonly now: () => Date;
  private readonly onEvent?: (event: RuntimeEvent) => void;
  private unavailableReason: string | undefined;

  constructor(options: CheckpointStoreOptions) {
    this.sessionID = options.sessionID;
    this.workspaceRoot = resolve(options.workspaceRoot);
    this.storeDir = resolve(
      options.storeDir ??
        join(this.workspaceRoot, ".natalia", "checkpoints", options.sessionID),
    );
    this.enabled = options.enabled ?? true;
    this.maxFiles = options.maxFiles ?? 20000;
    this.maxBytes = options.maxBytes ?? 512 * 1024 * 1024;
    this.ignore = [...DEFAULT_IGNORES, ...(options.ignore ?? [])];
    this.additionalDirs = options.additionalDirs ?? [];
    this.now = options.now ?? (() => new Date());
    this.onEvent = options.onEvent;
  }

  static async open(options: CheckpointStoreOptions) {
    const store = new CheckpointStore(options);
    await store.initialize();
    return store;
  }

  async initialize() {
    if (!this.enabled) {
      this.unavailableReason = "disabled_by_config";
      this.emit({
        type: "checkpoint.unavailable",
        reason: "disabled_by_config",
        suggestion:
          "Set checkpoint.enabled=true to restore /checkpoint and /rollback.",
        disabledByConfig: true,
      });
      return;
    }
    try {
      assertContained(this.workspaceRoot, this.workspaceRoot);
      await mkdir(this.objectRoot(), { recursive: true, mode: 0o700 });
      await appendFile(this.journalPath(), "", { mode: 0o600 });
    } catch (error) {
      const message = errorMessage(error);
      this.unavailableReason = message;
      this.emit({
        type: "checkpoint.unavailable",
        reason: message,
        suggestion:
          "Check workspace permissions and the checkpoint store path, then restart the session.",
      });
    }
  }

  async ensureBaseline(context: ContextLedger, step = 0) {
    if ((await this.list()).length > 0) return undefined;
    return this.createCheckpoint({
      reason: "baseline",
      context,
      step,
      status: "baseline",
    });
  }

  async createCheckpoint(
    input: CreateCheckpointInput,
  ): Promise<CheckpointRecord> {
    this.assertAvailable();
    const existing = await this.list();
    const sequence =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((record) => record.sequence)) + 1;
    const previous = existing.at(-1);
    const id = sequence === 0 ? "checkpoint_0" : `checkpoint_${sequence}`;
    try {
      const manifest = await this.captureManifest();
      const context = input.context.durableCheckpoint(input.step);
      const diskUsageBytes = await this.diskUsageBytes();
      const record: CheckpointRecord = {
        schemaVersion: 2,
        id,
        sequence,
        sessionID: this.sessionID,
        turnID: input.turnID,
        stepID: input.stepID,
        step: input.step,
        reason: input.reason,
        createdAt: this.now().toISOString(),
        cwd: this.workspaceRoot,
        complete: manifest.complete,
        errors: manifest.errors,
        manifest,
        context,
        changes: diffManifests(previous?.manifest, manifest),
        runtime: {
          status: input.status ?? "ready",
          model: input.model,
          tokenEstimate: context.tokenEstimate,
          compactionGeneration: context.compactionGeneration,
        },
        diskUsageBytes,
      };
      await appendFile(this.journalPath(), `${JSON.stringify(record)}\n`, {
        mode: 0o600,
      });
      this.emit({
        type: "checkpoint.created",
        id: record.id,
        reason: record.reason,
        sequence: record.sequence,
        complete: record.complete,
        files: Object.keys(record.manifest.entries).length,
        changes: record.changes.length,
        contextJournalOffset: record.context.journalOffset,
        step: record.context.step,
        tokenEstimate: record.context.tokenEstimate,
        diskUsageBytes: record.diskUsageBytes,
      });
      if (!record.complete)
        this.emit({
          type: "checkpoint.failed",
          reason: record.reason,
          message: "checkpoint captured incomplete workspace manifest",
          incomplete: true,
          errors: record.errors,
        });
      return record;
    } catch (error) {
      const message = errorMessage(error);
      this.emit({ type: "checkpoint.failed", reason: input.reason, message });
      throw error;
    }
  }

  async list(): Promise<CheckpointRecord[]> {
    if (this.unavailableReason) return [];
    try {
      const text = await readFile(this.journalPath(), "utf8");
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as CheckpointRecord);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async get(id: string) {
    const records = await this.list();
    if (id === "last") return records.at(-1);
    return records.find(
      (record) => record.id === id || String(record.sequence) === id,
    );
  }

  async previewRollback(
    id: string,
    context: ContextLedger,
    resources: CheckpointRuntimeResource[] = [],
    dryRun = false,
  ): Promise<CheckpointPreview> {
    this.assertAvailable();
    const target = await this.get(id);
    if (!target) throw new Error(`checkpoint not found: ${id}`);
    const current = await this.captureManifest({ writeObjects: false });
    const contextStatus = context.journalStatus();
    const preview: CheckpointPreview = {
      checkpointID: target.id,
      dryRun,
      changes: diffManifests(current, target.manifest),
      context: {
        truncateMessages: Math.max(
          0,
          contextStatus.messageCount - target.context.entries.length,
        ),
        targetJournalOffset: target.context.journalOffset,
        targetStep: target.context.step,
        targetTokens: target.context.tokenEstimate,
        compactionGeneration: target.context.compactionGeneration,
      },
      resources: resourcePolicies(resources),
      ignoredFiles: current.ignoredFiles,
      diskUsageBytes: await this.diskUsageBytes(),
      complete: target.complete && current.complete,
      warnings: [
        ...target.errors,
        ...current.errors,
        ...additionalDirWarnings(this.workspaceRoot, this.additionalDirs),
      ],
    };
    this.emit({ type: "rollback.previewed", preview });
    return preview;
  }

  async rollbackTo(
    id: string,
    options: RollbackOptions,
  ): Promise<CheckpointPreview> {
    const target = await this.get(id);
    if (!target) throw new Error(`checkpoint not found: ${id}`);
    if (!target.complete)
      throw new Error(`checkpoint is incomplete: ${target.id}`);
    const preview = await this.previewRollback(
      target.id,
      options.context,
      options.resources,
      Boolean(options.dryRun),
    );
    if (options.dryRun) return preview;

    const safety = await this.createCheckpoint({
      reason: "rollback_safety",
      context: options.context,
      step: options.context.journalStatus().messageCount,
      status: "rollback_safety",
    });
    preview.safetyCheckpointID = safety.id;
    this.emit({
      type: "rollback.begin",
      checkpointID: target.id,
      safetyCheckpointID: safety.id,
    });
    try {
      const applied = await this.applyManifest(target.manifest);
      if (options.failAfterWorkspaceApply)
        throw new Error("injected workspace rollback failure");
      if (options.failContextRestore)
        throw new Error("injected context rollback failure");
      options.context.restoreDurableCheckpoint(target.context);
      await this.truncateFutureCheckpoints(target, safety);
      this.emit({
        type: "rollback.end",
        checkpointID: target.id,
        safetyCheckpointID: safety.id,
        restoredFiles: applied.restoredFiles,
        deletedFiles: applied.deletedFiles,
        contextJournalOffset: target.context.journalOffset,
        step: target.context.step,
      });
      return preview;
    } catch (error) {
      let recovered = false;
      try {
        await this.applyManifest(safety.manifest);
        options.context.restoreDurableCheckpoint(safety.context);
        recovered = true;
      } finally {
        this.emit({
          type: "rollback.failed",
          checkpointID: target.id,
          safetyCheckpointID: safety.id,
          message: errorMessage(error),
          recovered,
        });
      }
      throw error;
    }
  }

  async gcObjects(dryRun = true) {
    const referenced = new Set<string>();
    for (const record of await this.list()) {
      for (const entry of Object.values(record.manifest.entries))
        if (entry.objectHash) referenced.add(entry.objectHash);
    }
    const existing = await listObjectHashes(this.objectRoot());
    const unreachable = existing.filter((hash) => !referenced.has(hash));
    let bytes = 0;
    for (const hash of unreachable)
      bytes += await fileSize(this.objectPath(hash));
    if (!dryRun) {
      for (const hash of unreachable)
        await rm(this.objectPath(hash), { force: true });
    }
    return { dryRun, unreachableObjects: unreachable.length, bytes };
  }

  async diskUsageBytes() {
    return directorySize(this.storeDir);
  }

  async captureManifest(
    options: { writeObjects?: boolean } = {},
  ): Promise<WorkspaceManifest> {
    const writeObjects = options.writeObjects ?? true;
    const manifest: WorkspaceManifest = {
      root: this.workspaceRoot,
      entries: {},
      complete: true,
      errors: [],
      ignoredFiles: 0,
      totalBytes: 0,
    };
    const roots = [this.workspaceRoot];
    for (const dir of this.additionalDirs) {
      const resolved = resolve(this.workspaceRoot, dir);
      if (isContained(this.workspaceRoot, resolved)) roots.push(resolved);
      else {
        manifest.complete = false;
        manifest.errors.push(`additional dir escapes workspace root: ${dir}`);
      }
    }
    for (const root of roots)
      await this.scanDirectory(root, manifest, writeObjects);
    return manifest;
  }

  private async scanDirectory(
    dir: string,
    manifest: WorkspaceManifest,
    writeObjects: boolean,
  ): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = normalizeManifestPath(relative(this.workspaceRoot, full));
      if (!rel || this.shouldIgnore(rel, full)) {
        manifest.ignoredFiles += 1;
        continue;
      }
      if (Object.keys(manifest.entries).length >= this.maxFiles) {
        manifest.complete = false;
        manifest.errors.push(
          `checkpoint file count guard exceeded: ${this.maxFiles}`,
        );
        return;
      }
      try {
        const info = await lstat(full);
        if (info.isDirectory()) {
          await this.scanDirectory(full, manifest, writeObjects);
          continue;
        }
        if (info.isSymbolicLink()) {
          await this.captureSymlink(full, rel, manifest);
          continue;
        }
        if (!info.isFile()) {
          manifest.ignoredFiles += 1;
          continue;
        }
        manifest.totalBytes += info.size;
        if (manifest.totalBytes > this.maxBytes) {
          manifest.complete = false;
          manifest.errors.push(
            `checkpoint byte guard exceeded: ${this.maxBytes}`,
          );
          return;
        }
        const bytes = await readFile(full);
        const objectHash = createHash("sha256").update(bytes).digest("hex");
        if (writeObjects) await this.writeObject(objectHash, bytes);
        manifest.entries[rel] = {
          path: rel,
          kind: "regular",
          objectHash,
          size: info.size,
          mode: info.mode & 0o777,
        };
      } catch (error) {
        manifest.complete = false;
        manifest.errors.push(`${rel}: ${errorMessage(error)}`);
      }
    }
  }

  private async captureSymlink(
    full: string,
    rel: string,
    manifest: WorkspaceManifest,
  ) {
    const target = await readlink(full);
    const resolvedTarget = resolve(dirname(full), target);
    if (!isContained(this.workspaceRoot, resolvedTarget)) {
      manifest.complete = false;
      manifest.errors.push(
        `symlink escapes workspace root: ${rel} -> ${target}`,
      );
      return;
    }
    const info = await lstat(full);
    manifest.entries[rel] = {
      path: rel,
      kind: "symlink",
      mode: info.mode & 0o777,
      linkTarget: target,
    };
  }

  private async writeObject(hash: string, bytes: Buffer) {
    const path = this.objectPath(hash);
    try {
      await stat(path);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, bytes, { mode: 0o600 });
  }

  private async applyManifest(manifest: WorkspaceManifest) {
    const current = await this.captureManifest({ writeObjects: false });
    let restoredFiles = 0;
    let deletedFiles = 0;
    for (const path of Object.keys(current.entries)) {
      if (manifest.entries[path]) continue;
      await removeWorkspacePath(this.workspaceRoot, path);
      deletedFiles += 1;
    }
    for (const entry of Object.values(manifest.entries)) {
      const full = workspacePath(this.workspaceRoot, entry.path);
      await mkdir(dirname(full), { recursive: true });
      await rm(full, { force: true, recursive: true });
      if (entry.kind === "symlink") {
        if (!entry.linkTarget)
          throw new Error(`missing symlink target: ${entry.path}`);
        const resolvedTarget = resolve(dirname(full), entry.linkTarget);
        if (!isContained(this.workspaceRoot, resolvedTarget))
          throw new Error(
            `refusing to restore escaping symlink: ${entry.path}`,
          );
        await symlink(entry.linkTarget, full);
        restoredFiles += 1;
        continue;
      }
      if (!entry.objectHash)
        throw new Error(`missing object hash: ${entry.path}`);
      const temp = `${full}.natalia-rollback-tmp`;
      await copyFile(
        this.objectPath(entry.objectHash),
        temp,
        constants.COPYFILE_FICLONE_FORCE,
      ).catch(async () => copyFile(this.objectPath(entry.objectHash!), temp));
      await chmod(temp, entry.mode);
      await rename(temp, full);
      restoredFiles += 1;
    }
    return { restoredFiles, deletedFiles };
  }

  private async truncateFutureCheckpoints(
    target: CheckpointRecord,
    safety: CheckpointRecord,
  ) {
    const records = await this.list();
    const retained = records.filter(
      (record) => record.sequence <= target.sequence || record.id === safety.id,
    );
    await writeFile(
      this.journalPath(),
      retained.map((record) => JSON.stringify(record)).join("\n") + "\n",
      { mode: 0o600 },
    );
  }

  private shouldIgnore(rel: string, full: string) {
    if (isContained(this.storeDir, full) || full === this.storeDir) return true;
    return this.ignore.some((pattern) => matchesIgnore(rel, pattern));
  }

  private assertAvailable() {
    if (!this.enabled) throw new Error("checkpoint disabled by config");
    if (this.unavailableReason)
      throw new Error(`checkpoint unavailable: ${this.unavailableReason}`);
  }

  private journalPath() {
    return join(this.storeDir, "journal.jsonl");
  }

  private objectRoot() {
    return join(this.storeDir, "objects");
  }

  private objectPath(hash: string) {
    return join(this.objectRoot(), hash.slice(0, 2), hash);
  }

  private emit(event: RuntimeEvent) {
    this.onEvent?.(event);
  }
}

export async function initializeDefaultCheckpointStore(
  options: CheckpointStoreOptions & { context: ContextLedger },
) {
  const store = await CheckpointStore.open(options);
  if (options.enabled !== false) await store.ensureBaseline(options.context, 0);
  return store;
}

export async function runCheckpointCommand(
  store: CheckpointStore,
  context: ContextLedger,
  command: string,
): Promise<CheckpointCommandResult> {
  const parts = command.trim().split(/\s+/u);
  const name = parts[0];
  if (name === "/checkpoint") {
    const record = await store.createCheckpoint({
      reason: "manual",
      context,
      step: context.journalStatus().messageCount,
    });
    return { ok: true, output: formatCheckpoint(record) };
  }
  if (name === "/checkpoints") {
    if (parts[1] === "gc") {
      const result = await store.gcObjects(parts.includes("--dry-run"));
      return {
        ok: true,
        output: `checkpoint gc ${result.dryRun ? "dry-run" : "applied"}: ${result.unreachableObjects} objects, ${result.bytes} bytes`,
      };
    }
    const limitIndex = parts.indexOf("--limit");
    const limit = limitIndex >= 0 ? Number(parts[limitIndex + 1]) : 20;
    const records = (await store.list()).slice(-limit);
    return { ok: true, output: records.map(formatCheckpoint).join("\n") };
  }
  if (name === "/rollback") {
    const target = parts[1] ?? "last";
    const dryRun = parts.includes("--dry-run");
    const preview = await store.rollbackTo(target, { context, dryRun });
    return { ok: true, output: formatRollbackPreview(preview) };
  }
  return { ok: false, output: `unknown checkpoint command: ${name}` };
}

export function checkpointProgressLine(event: RuntimeEvent) {
  switch (event.type) {
    case "checkpoint.created":
      return `checkpoint ${event.id} created (${event.files} files, ${event.changes} changes, ${event.complete ? "complete" : "incomplete"})`;
    case "checkpoint.failed":
      return `checkpoint failed: ${event.message}`;
    case "checkpoint.unavailable":
      return `checkpoint unavailable: ${event.reason}. ${event.suggestion}`;
    case "rollback.previewed":
      return `rollback preview ${event.preview.checkpointID}: ${event.preview.changes.length} file changes, truncate ${event.preview.context.truncateMessages} context messages`;
    case "rollback.begin":
      return `rollback ${event.checkpointID} begin (safety ${event.safetyCheckpointID})`;
    case "rollback.end":
      return `rollback ${event.checkpointID} complete (${event.restoredFiles} restored, ${event.deletedFiles} deleted, step ${event.step})`;
    case "rollback.failed":
      return `rollback ${event.checkpointID} failed: ${event.message} (${event.recovered ? "safety restored" : "safety restore failed"})`;
    default:
      return undefined;
  }
}

function diffManifests(
  before: WorkspaceManifest | undefined,
  after: WorkspaceManifest,
): CheckpointChange[] {
  if (!before) {
    return Object.values(after.entries).map((entry) => ({
      kind: "add" as const,
      path: entry.path,
      mode: modeString(entry.mode),
    }));
  }
  const changes: CheckpointChange[] = [];
  const beforeByHash = new Map<string, string>();
  for (const entry of Object.values(before.entries)) {
    const key = entryKey(entry);
    if (key) beforeByHash.set(key, entry.path);
  }
  for (const [path, entry] of Object.entries(after.entries)) {
    const old = before.entries[path];
    if (!old) {
      const oldPath = beforeByHash.get(entryKey(entry));
      changes.push({
        kind: oldPath ? "rename" : "add",
        path,
        oldPath,
        mode: modeString(entry.mode),
      });
      continue;
    }
    if (old.kind !== entry.kind) changes.push({ kind: "symlink", path });
    else if (
      old.objectHash !== entry.objectHash ||
      old.linkTarget !== entry.linkTarget
    )
      changes.push({
        kind: entry.kind === "symlink" ? "symlink" : "modify",
        path,
      });
    if (old.mode !== entry.mode)
      changes.push({
        kind: "mode",
        path,
        mode: `${modeString(old.mode)} -> ${modeString(entry.mode)}`,
      });
  }
  for (const path of Object.keys(before.entries)) {
    if (!after.entries[path]) changes.push({ kind: "delete", path });
  }
  return changes;
}

function resourcePolicies(
  resources: CheckpointRuntimeResource[],
): CheckpointResourcePolicy[] {
  return resources.map((resource) => {
    if (resource.kind === "pending_modal")
      return {
        kind: resource.kind,
        id: resource.id,
        action: "invalidate",
        summary: resource.summary,
      };
    if (resource.kind === "tool")
      return {
        kind: resource.kind,
        id: resource.id,
        action: "cancel",
        summary: resource.summary,
      };
    if (
      resource.status === "running" ||
      resource.status === "waiting" ||
      resource.status === "pending"
    )
      return {
        kind: resource.kind,
        id: resource.id,
        action: "stop",
        summary: resource.summary,
      };
    if (resource.status === "preserve_dirty")
      return {
        kind: resource.kind,
        id: resource.id,
        action: "preserve_dirty",
        summary: resource.summary,
      };
    return {
      kind: resource.kind,
      id: resource.id,
      action: "none",
      summary: resource.summary,
    };
  });
}

function formatCheckpoint(record: CheckpointRecord) {
  return `${record.id} step=${record.step} reason=${record.reason} files=${Object.keys(record.manifest.entries).length} changes=${record.changes.length} tokens=${record.context.tokenEstimate} ${record.complete ? "complete" : "incomplete"}`;
}

function formatRollbackPreview(preview: CheckpointPreview) {
  return `rollback ${preview.checkpointID}${preview.dryRun ? " dry-run" : ""}: ${preview.changes.length} file changes, truncate ${preview.context.truncateMessages} messages, resources=${preview.resources.length}`;
}

function additionalDirWarnings(root: string, dirs: string[]) {
  return dirs
    .filter((dir) => !isContained(root, resolve(root, dir)))
    .map((dir) => `additional dir escapes workspace root: ${dir}`);
}

function matchesIgnore(rel: string, pattern: string) {
  const normalized = normalizeManifestPath(pattern.replace(/^\/+|\/+$/gu, ""));
  if (!normalized) return false;
  if (normalized.includes("*")) {
    const regex = new RegExp(
      `^${normalized
        .replace(/[.+?^${}()|[\]\\]/gu, "\\$&")
        .replace(/\*\*/gu, ".*")
        .replace(/\*/gu, "[^/]*")}$`,
      "u",
    );
    return regex.test(rel) || regex.test(basename(rel));
  }
  return (
    rel === normalized ||
    rel.startsWith(`${normalized}/`) ||
    basename(rel) === normalized ||
    rel.includes(`/${normalized}/`)
  );
}

function entryKey(entry: ManifestEntry | undefined) {
  if (!entry) return "";
  if (entry.kind === "regular")
    return `regular:${entry.objectHash}:${entry.size}`;
  return `symlink:${entry.linkTarget}`;
}

function modeString(mode: number) {
  return `0${mode.toString(8)}`;
}

function normalizeManifestPath(path: string) {
  return path.replace(/\\/gu, "/").replace(/^\.\//u, "");
}

function workspacePath(root: string, path: string) {
  const resolved = resolve(root, path);
  assertContained(root, resolved);
  return resolved;
}

async function removeWorkspacePath(root: string, path: string) {
  const full = workspacePath(root, path);
  await rm(full, { force: true, recursive: true });
}

function assertContained(root: string, target: string) {
  if (!isContained(root, target))
    throw new Error(`path escapes workspace root: ${target}`);
}

function isContained(root: string, target: string) {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function directorySize(path: string): Promise<number> {
  try {
    const info = await lstat(path);
    if (info.isFile() || info.isSymbolicLink()) return info.size;
    if (!info.isDirectory()) return 0;
    const entries = await readdir(path);
    let size = 0;
    for (const entry of entries) size += await directorySize(join(path, entry));
    return size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function listObjectHashes(root: string): Promise<string[]> {
  try {
    const buckets = await readdir(root, { withFileTypes: true });
    const hashes: string[] = [];
    for (const bucket of buckets) {
      if (!bucket.isDirectory()) continue;
      const files = await readdir(join(root, bucket.name), {
        withFileTypes: true,
      });
      for (const file of files) if (file.isFile()) hashes.push(file.name);
    }
    return hashes;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function fileSize(path: string) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
