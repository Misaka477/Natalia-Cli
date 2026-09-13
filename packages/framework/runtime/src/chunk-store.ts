/**
 * Content-defined chunk store — the physical dedup layer for large checkpoint
 * payloads.
 *
 * Checkpoint journals used to inline a full workspace manifest and a full
 * context-ledger snapshot per record. Most of those bytes repeat across
 * records, so the durable representation is now split:
 *
 *   * the semantic layer (checkpoint.ts) removes the *obvious* duplication by
 *     storing only what changed (allow-list: the new context entries and the
 *     changed manifest entries);
 *   * this store removes the *non-obvious* duplication by chunking the
 *     serialized payload on content-defined boundaries and deduplicating the
 *     chunks by SHA-256. A chunk that already exists is never written twice,
 *     so a repeated tool result, a shared manifest region or an unchanged
 *     anchor band costs one copy no matter how many records reference it.
 *
 * Content-defined (rolling-hash) boundaries are what make this work across
 * versions of the same payload: appending to the front/overwriting a range
 * only reshapes the chunks near the edit, so everything else still dedupes.
 * A fixed-size split would shift every boundary and dedupe nothing.
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
import { dirname, join } from "node:path";

/** Ordered content-defined chunks that reconstruct one payload. */
export type ChunkRef = {
  /** SHA-256 of each chunk, in order. */
  chunks: string[];
  /** Total payload length, verified on read. */
  size: number;
};

export type ChunkReadOptions = {
  /** Re-hash each chunk against its address on read. Defaults to true. */
  verify?: boolean;
};

export type ChunkGcOptions = {
  /**
   * Skip chunks younger than this. A chunk is written before the journal line
   * that references it, so a grace window keeps a concurrent writer's fresh
   * chunks (or another process's not-yet-committed refs) out of the collector.
   */
  minAgeMs?: number;
};

/**
 * Chunker tuning. Average 8 KiB keeps the per-chunk index small relative to
 * the payload while still giving CDC enough boundary freedom to dedupe; the
 * min/max bounds stop a pathological rolling hash from producing tiny or huge
 * chunks.
 */
const MIN_CHUNK = 2 * 1024;
const MAX_CHUNK = 64 * 1024;
const AVG_CHUNK = 8 * 1024;
const MASK = AVG_CHUNK - 1;

/** Deterministic gear table (LCG), so chunk boundaries are process-stable. */
const GEAR: Uint32Array = (() => {
  const table = new Uint32Array(256);
  let x = 0x2545f491;
  for (let index = 0; index < 256; index++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    table[index] = x >>> 0;
  }
  return table;
})();

/**
 * Splits `bytes` into content-defined chunks and returns them in order. An
 * empty payload yields no chunks (the ref then reconstructs to "").
 */
export function contentDefinedChunks(bytes: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  let start = 0;
  let hash = 0;
  for (let index = 0; index < bytes.length; index++) {
    hash = ((hash << 1) + GEAR[bytes[index]!]!) >>> 0;
    const size = index - start + 1;
    if ((size >= MIN_CHUNK && (hash & MASK) === 0) || size >= MAX_CHUNK) {
      chunks.push(bytes.subarray(start, index + 1));
      start = index + 1;
      hash = 0;
    }
  }
  if (start < bytes.length) chunks.push(bytes.subarray(start));
  return chunks;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * A git-style content-addressed chunk library. Chunks are immutable and
 * addressed by their own hash, so writes are idempotent and concurrent writers
 * can race safely.
 */
export class ChunkStore {
  constructor(private readonly root: string) {}

  private chunkPath(hash: string): string {
    return join(this.root, hash.slice(0, 2), hash);
  }

  /** Stores a payload, writing only chunks that are not already present. */
  async put(bytes: Uint8Array): Promise<ChunkRef> {
    const payload = Buffer.from(bytes);
    const chunks: string[] = [];
    for (const chunk of contentDefinedChunks(payload)) {
      const hash = sha256Hex(chunk);
      const path = this.chunkPath(hash);
      if (await pathExists(path)) {
        chunks.push(hash);
        continue;
      }
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      // Content-addressed and immutable: if two writers race, both produce the
      // same bytes, so a lost race is harmless.
      await writeFile(path, chunk, { mode: 0o600 }).catch(async (error) => {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
        if (await pathExists(path)) return;
        throw error;
      });
      chunks.push(hash);
    }
    return { chunks, size: payload.length };
  }

  /**
   * Streams a payload one chunk at a time, re-hashing each chunk against its
   * content address unless `verify` is disabled. Callers that write into a sink
   * never hold the whole payload; `get` preallocates one output buffer so it
   * never holds both the chunk list and a second concatenated copy.
   */
  async *read(
    ref: ChunkRef,
    options: ChunkReadOptions = {},
  ): AsyncGenerator<Buffer> {
    const verify = options.verify ?? true;
    for (const hash of ref.chunks) {
      const chunk = await readFile(this.chunkPath(hash));
      if (verify) {
        const actual = sha256Hex(chunk);
        if (actual !== hash)
          throw new Error(
            `chunk ${hash} failed integrity check (content hashes to ${actual})`,
          );
      }
      yield chunk;
    }
  }

  /** Rebuilds a payload, verifying per-chunk content and the total length. */
  async get(ref: ChunkRef, options: ChunkReadOptions = {}): Promise<Buffer> {
    const output = Buffer.allocUnsafe(ref.size);
    let offset = 0;
    for await (const chunk of this.read(ref, options)) {
      if (offset + chunk.length > ref.size)
        throw new Error(
          `chunk payload overruns declared size ${ref.size} at offset ${offset}`,
        );
      chunk.copy(output, offset);
      offset += chunk.length;
    }
    if (offset !== ref.size)
      throw new Error(
        `chunk payload size mismatch: expected ${ref.size}, got ${offset}`,
      );
    return output;
  }

  /** True when every chunk of the ref is present. */
  async has(ref: ChunkRef): Promise<boolean> {
    for (const hash of ref.chunks)
      if (!(await pathExists(this.chunkPath(hash)))) return false;
    return true;
  }

  /**
   * Deletes every stored chunk whose hash is not in `referenced`. Only call
   * this with the complete set of live refs (checkpoint journals plus any other
   * owner), or live payloads are lost.
   */
  async collectGarbage(
    referenced: ReadonlySet<string>,
    dryRun = false,
    options: ChunkGcOptions = {},
  ): Promise<{ removed: number; bytes: number }> {
    const minAgeMs = options.minAgeMs ?? 0;
    const cutoff = Date.now() - minAgeMs;
    let removed = 0;
    let bytes = 0;
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!entry.isFile()) continue;
        if (referenced.has(entry.name)) continue;
        const info = await stat(full);
        // Never reap a chunk that may still be in flight.
        if (minAgeMs > 0 && info.mtimeMs > cutoff) continue;
        if (!dryRun) await rm(full, { force: true });
        removed += 1;
        bytes += info.size;
      }
    };
    await walk(this.root);
    return { removed, bytes };
  }
}
