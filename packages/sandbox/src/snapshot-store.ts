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
 * Performance: an index records `path → { objectID, size, mtimeMs }` against
 * the object store, so re-capturing a tree that changed a few files hashes
 * and stores only those — untouched files reuse their object by a size/mtime
 * match. A file whose mtime is unchanged from the index entry is re-hashed
 * anyway (the racy-git case: a write inside the same millisecond), so the
 * shortcut can never miss a change it could have seen.
 *
 *   - capture/diff  → content-hash index of the candidate vs the base.
 *   - promote       → copy the changed files into the host, backing up the
 *     targets to `<id>.lkg` first (the last-known-good).
 *   - rollback      → restore the last-known-good backup.
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { SandboxDiffKind } from "@natalia/contracts";
import type { SandboxChange } from "./workspace-manager";
import { ObjectStore } from "@natalia/object-store";

export type IndexedFile = { objectID: string; size: number; mtimeMs: number };
export type SnapshotIndex = Map<string, IndexedFile>;

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
  constructor(
    private readonly objects: ObjectStore,
    private readonly storeDir: string,
  ) {}

  /**
   * Indexes every file under a root, reusing the previous index's object ids
   * for files whose size and mtime are unchanged (an `ignore` rel-path filter
   * excluded). A file whose mtime matches the index entry is re-hashed anyway
   * (racy-git), so a same-millisecond write is never missed.
   */
  async capture(
    root: string,
    previous?: SnapshotIndex,
    ignore?: (relPath: string) => boolean,
  ): Promise<SnapshotIndex> {
    const index: SnapshotIndex = new Map();
    for (const path of await walkFiles(root)) {
      const rel = relative(root, path).split("/").join("/");
      if (ignore?.(rel)) continue;
      const info = await stat(path);
      const prior = previous?.get(rel);
      if (prior && prior.size === info.size && prior.mtimeMs !== info.mtimeMs) {
        // Same size and a different mtime: unchanged, reuse the object.
        index.set(rel, prior);
        continue;
      }
      index.set(rel, {
        objectID: await this.objects.put(await readFile(path)),
        size: info.size,
        mtimeMs: info.mtimeMs,
      });
    }
    return index;
  }

  /** The candidate's changes against the base, by content hash. */
  async diff(
    candidateRoot: string,
    base: SnapshotIndex,
    candidateIndex: SnapshotIndex,
  ): Promise<SandboxChange[]> {
    const changes: SandboxChange[] = [];
    for (const path of await walkFiles(candidateRoot)) {
      const rel = relative(candidateRoot, path).split("/").join("/");
      const baseEntry = base.get(rel);
      if (!baseEntry) {
        changes.push({ kind: "add" as SandboxDiffKind, path: rel });
        continue;
      }
      const info = await stat(path);
      const indexed = candidateIndex.get(rel);
      const objectID =
        indexed &&
        indexed.size === info.size &&
        indexed.mtimeMs !== info.mtimeMs
          ? indexed.objectID
          : await this.objects.put(await readFile(path));
      if (objectID !== baseEntry.objectID)
        changes.push({ kind: "modify" as SandboxDiffKind, path: rel });
    }
    for (const path of base.keys()) {
      if (!(await exists(resolve(candidateRoot, path))))
        changes.push({ kind: "delete" as SandboxDiffKind, path });
    }
    return changes;
  }

  async saveIndex(id: string, index: SnapshotIndex): Promise<void> {
    await mkdir(this.storeDir, { recursive: true });
    await writeFile(
      join(this.storeDir, `${id}.base.json`),
      JSON.stringify([...index]),
    );
  }

  async loadIndex(id: string): Promise<SnapshotIndex | undefined> {
    return this.load(`${id}.base.json`);
  }

  async saveCandidateIndex(id: string, index: SnapshotIndex): Promise<void> {
    await mkdir(this.storeDir, { recursive: true });
    await writeFile(
      join(this.storeDir, `${id}.candidate.json`),
      JSON.stringify([...index]),
    );
  }

  async loadCandidateIndex(id: string): Promise<SnapshotIndex | undefined> {
    return this.load(`${id}.candidate.json`);
  }

  private async load(name: string): Promise<SnapshotIndex | undefined> {
    try {
      const parsed = JSON.parse(
        await readFile(join(this.storeDir, name), "utf8"),
      ) as Array<[string, IndexedFile]>;
      return new Map(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
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

  /**
   * Every object id the snapshot indices reference — the union of every base
   * and candidate index under the store. The shared object library's GC uses
   * this so one owner never prunes another's live objects.
   */
  async referencedObjectIDs(): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const name of await readdir(this.storeDir).catch(
      () => [] as string[],
    )) {
      if (!name.endsWith(".json")) continue;
      const index = await this.load(name);
      for (const entry of index?.values() ?? []) ids.add(entry.objectID);
    }
    return ids;
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
