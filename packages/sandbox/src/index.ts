import {
  lstat,
  mkdir,
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
  merge(id: string, hostRoot: string): Promise<SandboxChange[]>;
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

  constructor(private readonly baseRoot: string) {}

  async create(id: string) {
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
      command,
      pid,
      status: "running",
      outputPath,
      startedAt: new Date().toISOString(),
    };
    this.resources.set(finalID, resource);
    manifest.runningResources.push(finalID);
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
    const manifest = this.mustGet(id);
    const resource = this.mustResource(resourceID);
    if (resource.status === "running") process.kill(resource.pid, "SIGTERM");
    resource.status = "stopped";
    resource.endedAt = new Date().toISOString();
    manifest.runningResources = manifest.runningResources.filter(
      (item) => item !== resourceID,
    );
    return { ...resource };
  }

  async write(id: string, path: string, content: string, mode?: string) {
    const manifest = this.mustGet(id);
    const full = await containPath(manifest.root, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
    this.record(id, { kind: "modify", path, mode, content });
  }

  async deletePath(id: string, path: string) {
    const manifest = this.mustGet(id);
    const full = await containPath(manifest.root, path);
    await rm(full, { recursive: true, force: true });
    this.record(id, { kind: "delete", path });
  }

  async renamePath(id: string, oldPath: string, path: string) {
    const manifest = this.mustGet(id);
    const oldFull = await containPath(manifest.root, oldPath);
    const newFull = await containPath(manifest.root, path);
    await mkdir(dirname(newFull), { recursive: true });
    await rename(oldFull, newFull);
    this.record(id, { kind: "rename", oldPath, path });
  }

  async modePath(id: string, path: string, mode: string) {
    await containPath(this.mustGet(id).root, path);
    this.record(id, { kind: "mode", path, mode });
  }

  async previewMerge(id: string) {
    const manifest = this.mustGet(id);
    manifest.changedFiles = classifyRenames(manifest.changedFiles);
    return manifest.changedFiles.map((change) => ({ ...change }));
  }

  async merge(id: string, hostRoot: string) {
    const manifest = this.mustGet(id);
    const changes = await this.previewMerge(id);
    const backups: Array<{ path: string; content?: Buffer; existed: boolean }> =
      [];
    try {
      for (const change of changes) {
        const target = await containPath(hostRoot, change.path);
        const existing = await readOptional(target);
        backups.push({
          path: target,
          content: existing,
          existed: existing !== undefined,
        });
        if (change.kind === "delete") {
          await rm(target, { recursive: true, force: true });
        } else {
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, change.content ?? "");
        }
      }
      manifest.changedFiles = [];
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
    const manifest = this.mustGet(id);
    const result = {
      pendingChanges: manifest.changedFiles.map((change) => ({ ...change })),
      runningResources: [...manifest.runningResources],
    };
    this.sandboxes.delete(id);
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
  return changes.map((change) => ({ ...change }));
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
