/**
 * A git-free snapshot store — the "类 git" layer that gives every workspace
 * candidate/promotion/rollback semantics without requiring git.
 *
 * Git is a content-addressed store of snapshots with branches and merges. For
 * the sandbox we need a subset: a base snapshot to diff a candidate against,
 * a promotion that applies the candidate's changes to the host with a
 * last-known-good backup, and a rollback that restores it. That subset has no
 * reason to depend on git, and the worktree backend's `candidate/<id>`
 * branches are just one implementation of it.
 *
 *   - capture/diff  → content-hash index of the candidate vs the base.
 *   - promote       → copy the changed files into the host, backing up the
 *     targets to `<id>.lkg` first (the last-known-good).
 *   - rollback      → restore the last-known-good backup.
 *
 * The store is content-addressed by sha256, so identical files cost nothing
 * extra and a changed file is detected by hash, not mtime.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { SandboxDiffKind } from "@natalia/contracts";
import type { SandboxChange } from "./workspace-manager";

export type FileSnapshot = { sha256: string; bytes: number };
export type FileSnapshotIndex = Map<string, FileSnapshot>;

const sha256 = async (path: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  return files;
}

export class SnapshotStore {
  constructor(private readonly storeDir: string) {}

  /** Content-hash index of every file under a root (an `ignore` rel-path filter excluded). */
  async capture(
    root: string,
    ignore?: (relPath: string) => boolean,
  ): Promise<FileSnapshotIndex> {
    const index: FileSnapshotIndex = new Map();
    for (const path of await walkFiles(root)) {
      const rel = relative(root, path).split("/").join("/");
      if (ignore?.(rel)) continue;
      const info = await stat(path);
      index.set(rel, {
        sha256: await sha256(path),
        bytes: info.size,
      });
    }
    return index;
  }

  async saveIndex(id: string, index: FileSnapshotIndex): Promise<void> {
    await mkdir(this.storeDir, { recursive: true });
    await writeFile(
      join(this.storeDir, `${id}.base.json`),
      JSON.stringify([...index]),
    );
  }

  async loadIndex(id: string): Promise<FileSnapshotIndex | undefined> {
    try {
      const parsed = JSON.parse(
        await readFile(join(this.storeDir, `${id}.base.json`), "utf8"),
      ) as Array<[string, FileSnapshot]>;
      return new Map(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  /**
   * The candidate's changes against the base: added, modified (by hash) and
   * deleted files.
   */
  async diff(
    candidateRoot: string,
    base: FileSnapshotIndex,
  ): Promise<SandboxChange[]> {
    const changes: SandboxChange[] = [];
    for (const path of await walkFiles(candidateRoot)) {
      const rel = relative(candidateRoot, path).split("/").join("/");
      const baseSnapshot = base.get(rel);
      if (!baseSnapshot) {
        changes.push({ kind: "add" as SandboxDiffKind, path: rel });
        continue;
      }
      if ((await sha256(path)) !== baseSnapshot.sha256)
        changes.push({ kind: "modify" as SandboxDiffKind, path: rel });
    }
    for (const path of base.keys()) {
      if (!(await exists(resolve(candidateRoot, path))))
        changes.push({ kind: "delete" as SandboxDiffKind, path });
    }
    return changes;
  }

  /**
   * Promotes the candidate's changes into the host: backs each target up to
   * `<id>.lkg` first (the last-known-good), then applies the candidate file.
   * Authorize runs on the changed paths before anything is touched.
   */
  async promote(
    id: string,
    candidateRoot: string,
    hostRoot: string,
    changes: SandboxChange[],
    authorize?: (paths: string[]) => Promise<void>,
  ): Promise<void> {
    const paths = changes
      .filter((change) => change.kind !== "delete")
      .map((change) => change.path);
    await authorize?.(paths);
    const lkgDir = join(this.storeDir, `${id}.lkg`);
    await mkdir(lkgDir, { recursive: true });
    for (const change of changes) {
      const target = join(hostRoot, change.path);
      const backupPath = join(lkgDir, change.path);
      // Backup the host target before touching it, so rollback can restore it.
      await mkdir(join(backupPath, ".."), { recursive: true });
      await writeFile(
        backupPath,
        await readFile(target).catch(() => Buffer.alloc(0)),
      );
      if (change.kind === "delete") continue;
      const source = join(candidateRoot, change.path);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, await readFile(source));
    }
  }

  /**
   * Restores the host to the last-known-good state recorded by the last
   * promote: every file the promote backed up is written back over the host.
   */
  async rollback(hostRoot: string, id: string): Promise<boolean> {
    const lkgDir = join(this.storeDir, `${id}.lkg`);
    let exists = true;
    try {
      await stat(lkgDir);
    } catch {
      exists = false;
    }
    if (!exists) return false;
    for (const path of await walkFiles(lkgDir)) {
      const rel = relative(lkgDir, path).split("/").join("/");
      const target = join(hostRoot, rel);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, await readFile(path));
    }
    return true;
  }

  /** Whether a last-known-good exists for the sandbox. */
  async hasLastKnownGood(id: string): Promise<boolean> {
    try {
      await stat(join(this.storeDir, `${id}.lkg`));
      return true;
    } catch {
      return false;
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
