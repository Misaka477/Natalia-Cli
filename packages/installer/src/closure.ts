import { randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  rename,
  rmdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { nataliaLockSchema, type NataliaLock } from "@natalia/contracts";

export function pluginClosurePaths(workspaceRoot: string) {
  const nataliaDir = resolve(workspaceRoot, ".natalia");
  return {
    nataliaDir,
    pluginsDir: join(nataliaDir, "plugins"),
    stagingDir: join(nataliaDir, "plugin-staging"),
    backupDir: join(nataliaDir, "plugin-backups"),
    lockPath: join(nataliaDir, "natalia.lock"),
  };
}

export type FileSnapshot = { path: string; contents?: Buffer };

export async function snapshotFile(path: string): Promise<FileSnapshot> {
  try {
    return { path, contents: await readFile(path) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path };
    throw error;
  }
}

export async function restoreFile(snapshot: FileSnapshot) {
  if (!snapshot.contents) {
    await rm(snapshot.path, { force: true });
    return;
  }
  await mkdir(dirname(snapshot.path), { recursive: true, mode: 0o700 });
  await writeFile(snapshot.path, snapshot.contents, { mode: 0o600 });
}

export async function rollbackWith(
  originalError: unknown,
  restorations: Array<() => Promise<void>>,
): Promise<never> {
  const errors = [originalError];
  for (const restore of restorations)
    try {
      await restore();
    } catch (error) {
      errors.push(error);
    }
  if (errors.length > 1)
    throw new AggregateError(errors, "plugin transaction rollback failed");
  throw originalError;
}

export async function cleanupInstallStage(stage: string, stagingDir: string) {
  const errors: unknown[] = [];
  for (const cleanup of [
    async () => await rm(stage, { recursive: true, force: true }),
    async () => await rmdir(stagingDir),
  ])
    try {
      await cleanup();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        errors.push(error);
    }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(errors, "plugin staging cleanup failed");
}

export async function backupClosure(workspaceRoot: string) {
  const paths = pluginClosurePaths(workspaceRoot);
  const backup = join(paths.backupDir, randomUUID());
  const existed = await stat(paths.pluginsDir)
    .then(() => true)
    .catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    });
  await mkdir(paths.backupDir, { recursive: true, mode: 0o700 });
  try {
    if (existed) {
      await rename(paths.pluginsDir, backup);
      await cp(backup, paths.pluginsDir, {
        recursive: true,
        preserveTimestamps: true,
      });
    } else await mkdir(paths.pluginsDir, { recursive: true, mode: 0o700 });
  } catch (error) {
    await rm(paths.pluginsDir, { recursive: true, force: true });
    if (existed) await rename(backup, paths.pluginsDir);
    throw error;
  }
  return { backup, existed, paths };
}

export async function restoreClosure(
  snapshot: Awaited<ReturnType<typeof backupClosure>>,
) {
  await rm(snapshot.paths.pluginsDir, { recursive: true, force: true });
  if (snapshot.existed)
    await rename(snapshot.backup, snapshot.paths.pluginsDir);
  else await rm(snapshot.backup, { recursive: true, force: true });
  await rm(snapshot.paths.backupDir).catch(() => undefined);
}

export async function discardClosureBackup(
  snapshot: Awaited<ReturnType<typeof backupClosure>>,
) {
  await rm(snapshot.backup, { recursive: true, force: true });
  await rm(snapshot.paths.backupDir).catch(() => undefined);
}

export async function loadNataliaLock(
  workspaceRoot: string,
): Promise<NataliaLock> {
  try {
    return nataliaLockSchema.parse(
      JSON.parse(
        await readFile(pluginClosurePaths(workspaceRoot).lockPath, "utf8"),
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, plugins: {} };
    throw error;
  }
}

export async function saveNataliaLock(
  workspaceRoot: string,
  lock: NataliaLock,
) {
  const parsed = nataliaLockSchema.parse(lock);
  const { lockPath } = pluginClosurePaths(workspaceRoot);
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  const temporary = `${lockPath}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, lockPath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export type PackageManagerRun = (input: {
  args: string[];
  cwd: string;
}) => Promise<void>;

export const runNpm: PackageManagerRun = async ({ args, cwd }) => {
  const child = Bun.spawn(["npm", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0)
    throw new Error(
      `npm ${args.join(" ")} failed: ${(stderr || stdout).trim()}`,
    );
};

export function npmInstallArgs(prefix: string, spec: string) {
  return [
    "install",
    "--no-audit",
    "--no-fund",
    "--ignore-scripts",
    "--save-exact",
    "--prefix",
    prefix,
    spec,
  ];
}

export function npmUninstallArgs(prefix: string, packageName: string) {
  return [
    "uninstall",
    "--no-audit",
    "--no-fund",
    "--ignore-scripts",
    "--prefix",
    prefix,
    packageName,
  ];
}

export async function closureDependencies(prefix: string) {
  try {
    const value = JSON.parse(
      await readFile(join(prefix, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    return value.dependencies ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export function packageDirectory(prefix: string, packageName: string) {
  return join(prefix, "node_modules", ...packageName.split("/"));
}

export async function readPackageRecord(prefix: string, packageName: string) {
  const lock = JSON.parse(
    await readFile(join(prefix, "package-lock.json"), "utf8"),
  ) as { packages?: Record<string, unknown> };
  return lock.packages?.[`node_modules/${packageName}`] as
    | { version?: string; integrity?: string }
    | undefined;
}
