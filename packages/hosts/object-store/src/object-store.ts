/**
 * The shared content-addressed object store — one object library for the
 * framework's durable snapshots.
 *
 * Both checkpoint and the sandbox's git-free backend write here, so identical
 * files across the two subsystems share a single object (git's one global
 * object database). Objects are addressed by sha256 and stored git-style in
 * two-character prefix directories, so a directory listing never has to scan
 * a flat pile of thousands of files.
 *
 * Garbage collection is owner-relative: `collectGarbage(reachable)` deletes
 * every object the caller did not mark reachable. Owners (checkpoint journals,
 * sandbox snapshot indices) compute their own reachable set and union it, so
 * one owner's GC can never prune another owner's live objects.
 */
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

export class ObjectStore {
  constructor(private readonly root: string) {}

  /** Stores a blob if absent, returning its content id. */
  async put(content: Buffer | string): Promise<string> {
    const id = createHash("sha256").update(content).digest("hex");
    if (!(await this.has(id))) {
      const path = this.objectPath(id);
      await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
      await writeFile(path, content, { mode: 0o600 });
    }
    return id;
  }

  async has(id: string): Promise<boolean> {
    try {
      await stat(this.objectPath(id));
      return true;
    } catch {
      return false;
    }
  }

  async get(id: string): Promise<Buffer> {
    return await readFile(this.objectPath(id));
  }

  async delete(id: string): Promise<void> {
    await rm(this.objectPath(id), { force: true });
  }

  /** Every object id currently in the store. */
  async list(): Promise<string[]> {
    const ids: string[] = [];
    for (const prefix of await readdir(this.root).catch(() => [] as string[])) {
      if (prefix.length !== 2) continue;
      const dir = join(this.root, prefix);
      for (const name of await readdir(dir).catch(() => [] as string[])) {
        if (name.startsWith(prefix)) ids.push(name);
      }
    }
    return ids;
  }

  /**
   * Deletes every object not in `reachable`. Owners compute the union of what
   * they reference — checkpoint journals and sandbox snapshot indices — so this
   * never prunes a live object of another owner.
   */
  async collectGarbage(reachable: Set<string>): Promise<{
    unreachableObjects: number;
    bytes: number;
  }> {
    let unreachableObjects = 0;
    let bytes = 0;
    for (const id of await this.list()) {
      if (reachable.has(id)) continue;
      const path = this.objectPath(id);
      try {
        bytes += (await stat(path)).size;
      } catch {
        continue;
      }
      await rm(path, { force: true });
      unreachableObjects++;
    }
    return { unreachableObjects, bytes };
  }

  private objectPath(id: string): string {
    return join(this.root, id.slice(0, 2), id);
  }
}
