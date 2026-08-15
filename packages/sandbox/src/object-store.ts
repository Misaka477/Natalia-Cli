/**
 * A content-addressed object store — the high-performance core of the
 * git-free backend.
 *
 * Every file is stored once, keyed by its sha256. Identical files across
 * snapshots (the common case: a sandbox's base and an untouched file) share
 * one object, so re-capturing a workspace that changed a few files does not
 * re-store or re-read the rest. This is the git object-database idea with our
 * own format: no packfiles, no zlib, no index binary — just content-addressed
 * blobs under `.natalia/objects/`, which is all the sandbox needs.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export class ObjectStore {
  constructor(private readonly dir: string) {}

  /** Stores a blob if absent, returning its content id. */
  async put(content: Buffer | string): Promise<string> {
    const id = createHash("sha256").update(content).digest("hex");
    if (!(await this.has(id))) {
      await mkdir(this.dir, { recursive: true });
      await writeFile(join(this.dir, id), content);
    }
    return id;
  }

  async has(id: string): Promise<boolean> {
    try {
      await readFile(join(this.dir, id));
      return true;
    } catch {
      return false;
    }
  }

  async get(id: string): Promise<Buffer> {
    return await readFile(join(this.dir, id));
  }
}
