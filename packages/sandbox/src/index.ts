import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  ExecutionTarget,
  RuntimeEvent,
  SandboxDiffKind,
} from "@natalia/contracts";

export type IsolationLevel = "workspace" | "container" | "vm";

export type SandboxManifest = {
  id: string;
  root: string;
  isolationLevel: IsolationLevel;
  changedFiles: SandboxChange[];
  runningResources: string[];
  envAllowlist: string[];
};

export type SandboxResourceInfo = {
  id: string;
  sandboxID: string;
  command: string;
  pid: number;
  status: "running" | "exited" | "failed" | "stopped";
  outputPath: string;
  startedAt: string;
  endedAt?: string;
};

export type SandboxChange = {
  kind: SandboxDiffKind;
  path: string;
  oldPath?: string;
  mode?: string;
  content?: string;
};

export type SandboxManager = {
  create(id: string): Promise<SandboxManifest>;
  delete(
    id: string,
  ): Promise<{ pendingChanges: SandboxChange[]; runningResources: string[] }>;
  previewMerge(id: string): Promise<SandboxChange[]>;
  merge(
    id: string,
    hostRoot: string,
    authorize?: (paths: string[]) => Promise<void>,
  ): Promise<SandboxChange[]>;
};

export type SandboxExecutor = {
  target(id: string): ExecutionTarget;
  environment(
    allowlist: string[],
    source?: NodeJS.ProcessEnv,
  ): Record<string, string>;
  execute(
    id: string,
    command: string,
    options?: { signal?: AbortSignal; env?: NodeJS.ProcessEnv },
  ): Promise<{ exitCode: number; output: string; target: ExecutionTarget }>;
};

export class WorkspaceSandboxManager
  implements SandboxManager, SandboxExecutor
{
  private sandboxes = new Map<string, SandboxManifest>();
  private resources = new Map<string, SandboxResourceInfo>();
  private initialized?: Promise<void>;

  constructor(private readonly baseRoot: string) {}

  async initialize() {
    if (!this.initialized) this.initialized = this.load();
    await this.initialized;
  }

  async create(id: string) {
    await this.initialize();
    const root = resolve(this.baseRoot, id);
    await mkdir(root, { recursive: true });
    const manifest: SandboxManifest = {
      id,
      root,
      isolationLevel: "workspace",
      changedFiles: [],
      runningResources: [],
      envAllowlist: ["PATH", "HOME", "LANG", "TERM"],
    };
    this.sandboxes.set(id, manifest);
    await this.persist(manifest);
    return manifest;
  }

  target(id: string): ExecutionTarget {
    const manifest = this.mustGet(id);
    return {
      kind: "sandbox",
      sandboxID: id,
      root: manifest.root,
      isolationLevel: manifest.isolationLevel,
    };
  }

  environment(allowlist: string[], source: NodeJS.ProcessEnv = process.env) {
    const env: Record<string, string> = {};
    for (const key of allowlist) {
      const value = source[key];
      if (value !== undefined && !isSecretEnvKey(key)) env[key] = value;
    }
    return env;
  }

  async execute(
    id: string,
    command: string,
    options: { signal?: AbortSignal; env?: NodeJS.ProcessEnv } = {},
  ) {
    const manifest = this.mustGet(id);
    const process = Bun.spawn(["bash", "-lc", command], {
      cwd: manifest.root,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: this.environment(manifest.envAllowlist, options.env),
    });
    const abort = () => process.kill("SIGTERM");
    options.signal?.addEventListener("abort", abort, { once: true });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    options.signal?.removeEventListener("abort", abort);
    return { exitCode, output: `${stdout}${stderr}`, target: this.target(id) };
  }

  async startResource(id: string, command: string, resourceID?: string) {
    await this.initialize();
    const manifest = this.mustGet(id);
    const finalID =
      resourceID ?? `sbx_${id}_${manifest.runningResources.length + 1}`;
    if (this.resources.has(finalID))
      throw new Error(`sandbox resource already exists: ${finalID}`);
    const outputPath = resolve(
      manifest.root,
      ".natalia",
      "resources",
      `${finalID}.log`,
    );
    await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
    const launcher = Bun.spawn(
      [
        "bash",
        "-lc",
        `bash -c ${shellQuote(command)} > ${shellQuote(outputPath)} 2>&1 & echo $!`,
      ],
      {
        cwd: manifest.root,
        stdout: "pipe",
        stderr: "pipe",
        env: this.environment(manifest.envAllowlist),
      },
    );
    const pid = Number((await new Response(launcher.stdout).text()).trim());
    const stderr = await new Response(launcher.stderr).text();
    if ((await launcher.exited) !== 0 || !Number.isFinite(pid))
      throw new Error(`failed to start sandbox resource: ${stderr}`);
    const resource: SandboxResourceInfo = {
      id: finalID,
      sandboxID: id,
      command,
      pid,
      status: "running",
      outputPath,
      startedAt: new Date().toISOString(),
    };
    this.resources.set(finalID, resource);
    manifest.runningResources.push(finalID);
    await this.persist(manifest);
    return { ...resource };
  }

  resourcesFor(id: string) {
    const manifest = this.mustGet(id);
    return manifest.runningResources
      .map((resourceID) => this.refreshResource(this.resources.get(resourceID)))
      .filter(
        (resource): resource is SandboxResourceInfo => resource !== undefined,
      );
  }

  runningResourceCount(): number {
    return [...this.resources.values()].filter(
      (resource) => this.refreshResource(resource)?.status === "running",
    ).length;
  }

  async resourceOutput(id: string, resourceID: string, maxBytes = 20000) {
    this.mustGet(id);
    const resource = this.mustResource(resourceID);
    try {
      return (await readFile(resource.outputPath, "utf8")).slice(-maxBytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  }

  async stopResource(id: string, resourceID: string) {
    await this.initialize();
    const manifest = this.mustGet(id);
    const resource = this.mustResource(resourceID);
    if (resource.status === "running") process.kill(resource.pid, "SIGTERM");
    resource.status = "stopped";
    resource.endedAt = new Date().toISOString();
    manifest.runningResources = manifest.runningResources.filter(
      (item) => item !== resourceID,
    );
    await this.persist(manifest);
    return { ...resource };
  }

  async write(id: string, path: string, content: string, mode?: string) {
    await this.initialize();
    const manifest = this.mustGet(id);
    const full = await containPath(manifest.root, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
    this.record(id, { kind: "modify", path, mode, content });
    await this.persist(manifest);
  }

  async deletePath(id: string, path: string) {
    await this.initialize();
    const manifest = this.mustGet(id);
    const full = await containPath(manifest.root, path);
    await rm(full, { recursive: true, force: true });
    this.record(id, { kind: "delete", path });
    await this.persist(manifest);
  }

  async renamePath(id: string, oldPath: string, path: string) {
    await this.initialize();
    const manifest = this.mustGet(id);
    const oldFull = await containPath(manifest.root, oldPath);
    const newFull = await containPath(manifest.root, path);
    await mkdir(dirname(newFull), { recursive: true });
    await rename(oldFull, newFull);
    this.record(id, { kind: "rename", oldPath, path });
    await this.persist(manifest);
  }

  async modePath(id: string, path: string, mode: string) {
    await this.initialize();
    await containPath(this.mustGet(id).root, path);
    this.record(id, { kind: "mode", path, mode });
    await this.persist(this.mustGet(id));
  }

  async previewMerge(id: string) {
    const manifest = this.mustGet(id);
    manifest.changedFiles = classifyRenames(manifest.changedFiles);
    return manifest.changedFiles.map((change) => ({ ...change }));
  }

  async merge(
    id: string,
    hostRoot: string,
    authorize?: (paths: string[]) => Promise<void>,
  ) {
    await this.initialize();
    const manifest = this.mustGet(id);
    const changes = await this.previewMerge(id);
    const previewRevision = JSON.stringify(changes);
    await authorize?.(mergeMutationPaths(changes));
    if (JSON.stringify(manifest.changedFiles) !== previewRevision)
      throw new Error("sandbox manifest changed during merge authorization");
    const backups: Array<{ path: string; content?: Buffer; existed: boolean }> =
      [];
    try {
      for (const change of changes) {
        const target = await containPath(hostRoot, change.path);
        const oldTarget = change.oldPath
          ? await containPath(hostRoot, change.oldPath)
          : undefined;
        const existing = await readOptional(target);
        backups.push({
          path: target,
          content: existing,
          existed: existing !== undefined,
        });
        if (oldTarget) {
          const old = await readOptional(oldTarget);
          backups.push({
            path: oldTarget,
            content: old,
            existed: old !== undefined,
          });
        }
        if (change.kind === "delete") {
          await rm(target, { recursive: true, force: true });
        } else if (change.kind === "mode") {
          if (!change.mode)
            throw new Error("sandbox mode change is missing mode");
          await chmod(target, Number.parseInt(change.mode, 8));
        } else {
          await mkdir(dirname(target), { recursive: true });
          const source = await containPath(manifest.root, change.path);
          await writeFile(target, await readFile(source));
          if (change.mode) await chmod(target, Number.parseInt(change.mode, 8));
          if (oldTarget) await rm(oldTarget, { recursive: true, force: true });
        }
      }
      manifest.changedFiles = [];
      await this.persist(manifest);
      return changes;
    } catch (error) {
      for (const backup of backups.reverse()) {
        if (!backup.existed) await rm(backup.path, { force: true });
        else if (backup.content) await writeFile(backup.path, backup.content);
      }
      throw error;
    }
  }

  async delete(id: string) {
    await this.initialize();
    const manifest = this.mustGet(id);
    const result = {
      pendingChanges: manifest.changedFiles.map((change) => ({ ...change })),
      runningResources: [...manifest.runningResources],
    };
    for (const resourceID of manifest.runningResources)
      await this.stopResource(id, resourceID).catch(() => undefined);
    this.sandboxes.delete(id);
    await rm(manifest.root, { recursive: true, force: true });
    return result;
  }

  updateEvent(id: string): RuntimeEvent {
    const manifest = this.mustGet(id);
    return {
      type: "sandbox.update",
      id,
      status: manifest.changedFiles.length ? "changed" : "created",
      root: manifest.root,
      isolationLevel: manifest.isolationLevel,
      changedFiles: manifest.changedFiles.length,
      runningResources: manifest.runningResources.length,
      target: this.target(id),
      resourcePolicy:
        "workspace isolation only; no namespace/container/VM limits",
    };
  }

  diffEvent(id: string): RuntimeEvent {
    return { type: "sandbox.diff", id, changes: this.mustGet(id).changedFiles };
  }

  auditEvent(
    id: string,
    action: string,
    approvalRequired = true,
  ): RuntimeEvent {
    return {
      type: "sandbox.audit",
      id,
      action,
      target: this.target(id),
      approvalRequired,
      checkpointPolicy: "sandbox_manifest",
      message: "Sandbox is workspace isolation, not container or VM security.",
    };
  }

  private record(id: string, change: SandboxChange) {
    const manifest = this.mustGet(id);
    manifest.changedFiles.push(change);
  }

  private async load() {
    const entries = await readdir(this.baseRoot, { withFileTypes: true }).catch(
      () => [],
    );
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const state = JSON.parse(
          await readFile(
            join(this.baseRoot, entry.name, ".natalia-manifest.json"),
            "utf8",
          ),
        ) as { manifest?: SandboxManifest; resources?: SandboxResourceInfo[] };
        if (!state.manifest || state.manifest.id !== entry.name) continue;
        const manifest = {
          ...state.manifest,
          root: resolve(this.baseRoot, entry.name),
        };
        manifest.runningResources = [];
        this.sandboxes.set(manifest.id, manifest);
        for (const resource of state.resources ?? [])
          this.resources.set(resource.id, {
            ...resource,
            sandboxID: resource.sandboxID ?? manifest.id,
            status: resource.status === "running" ? "stopped" : resource.status,
            endedAt:
              resource.status === "running"
                ? new Date().toISOString()
                : resource.endedAt,
          });
        await this.persist(manifest);
      } catch {
        // An invalid sandbox manifest is ignored rather than granting access.
      }
    }
  }

  private async persist(manifest: SandboxManifest) {
    await mkdir(manifest.root, { recursive: true, mode: 0o700 });
    await writeFile(
      join(manifest.root, ".natalia-manifest.json"),
      `${JSON.stringify(
        {
          manifest,
          resources: [...this.resources.values()].filter(
            (resource) => resource.sandboxID === manifest.id,
          ),
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    );
  }

  private mustGet(id: string) {
    const manifest = this.sandboxes.get(id);
    if (!manifest) throw new Error(`unknown sandbox: ${id}`);
    return manifest;
  }

  private mustResource(id: string) {
    const resource = this.refreshResource(this.resources.get(id));
    if (!resource) throw new Error(`unknown sandbox resource: ${id}`);
    return resource;
  }

  private refreshResource(resource: SandboxResourceInfo | undefined) {
    if (!resource || resource.status !== "running") return resource;
    try {
      process.kill(resource.pid, 0);
    } catch {
      resource.status = "exited";
      resource.endedAt = new Date().toISOString();
    }
    return resource;
  }
}

export async function containPath(root: string, requested: string) {
  if (isAbsolute(requested))
    throw new Error("absolute sandbox paths are not allowed");
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, requested);
  const rel = relative(resolvedRoot, target);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error("sandbox path escape blocked");
  await rejectSymlinkEscape(resolvedRoot, target);
  return target;
}

export function isSecretEnvKey(key: string) {
  return /(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY|AUTHORIZATION)/iu.test(key);
}

function classifyRenames(changes: SandboxChange[]) {
  const normalized: SandboxChange[] = [];
  for (const change of changes) {
    if (change.kind === "rename" && change.oldPath)
      removeChangesForPath(normalized, change.oldPath);
    if (change.kind === "delete") removeChangesForPath(normalized, change.path);
    normalized.push({ ...change });
  }
  return normalized;
}

function mergeMutationPaths(changes: SandboxChange[]) {
  return [
    ...new Set(
      changes.flatMap((change) =>
        change.oldPath ? [change.path, change.oldPath] : [change.path],
      ),
    ),
  ].sort();
}

function removeChangesForPath(changes: SandboxChange[], path: string) {
  for (let index = changes.length - 1; index >= 0; index--) {
    const change = changes[index]!;
    if (change.path === path) changes.splice(index, 1);
  }
}

async function rejectSymlinkEscape(root: string, target: string) {
  let cursor = dirname(target);
  while (cursor.startsWith(root)) {
    try {
      const stats = await lstat(cursor);
      if (stats.isSymbolicLink()) {
        const real = await realpath(cursor);
        if (!real.startsWith(root))
          throw new Error("sandbox symlink escape blocked");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

async function readOptional(path: string) {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function shellQuote(value: string) {
  return `'${value.replace(/'/gu, `'\''`)}'`;
}
