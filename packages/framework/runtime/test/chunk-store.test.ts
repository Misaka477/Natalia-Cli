import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { ChunkStore, contentDefinedChunks } from "../src/chunk-store";

/** Deterministic pseudo-random bytes, so chunk boundaries are reproducible. */
function bytes(seed: number, length: number): Buffer {
  const out = Buffer.allocUnsafe(length);
  let x = seed >>> 0 || 1;
  for (let index = 0; index < length; index++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out[index] = x & 0xff;
  }
  return out;
}

async function countChunks(root: string): Promise<number> {
  const walk = async (dir: string): Promise<number> => {
    const entries = await readdir(dir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries)
      count += entry.isDirectory()
        ? await walk(join(dir, entry.name))
        : entry.isFile()
          ? 1
          : 0;
    return count;
  };
  try {
    return await walk(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

test("chunk store round-trips a payload exactly", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const payload = bytes(7, 300_000);
    const ref = await store.put(payload);
    expect(ref.size).toBe(payload.length);
    expect(ref.chunks.length).toBeGreaterThan(1);
    expect(await store.get(ref)).toEqual(payload);
    expect(await store.has(ref)).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("chunk store handles the empty payload", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const ref = await store.put(Buffer.alloc(0));
    expect(ref).toEqual({ chunks: [], size: 0 });
    expect((await store.get(ref)).length).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("identical payloads dedupe to the same on-disk chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const payload = bytes(11, 200_000);
    const first = await store.put(payload);
    const afterFirst = await countChunks(root);
    const second = await store.put(payload);
    expect(second).toEqual(first);
    expect(await countChunks(root)).toBe(afterFirst);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("content-defined boundaries resync after an edit, so chunks dedupe", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const base = bytes(23, 500_000);
    const edited = Buffer.concat([Buffer.from("inserted-prefix\n"), base]);
    const baseRef = await store.put(base);
    const editedRef = await store.put(edited);
    const shared = editedRef.chunks.filter((hash) =>
      baseRef.chunks.includes(hash),
    ).length;
    // Only the chunk(s) around the edit should change; a fixed-size split would
    // share nothing because every boundary shifts. Random data has ~8KiB
    // chunks, so 500KiB is ~60 chunks and the tail must clearly survive.
    expect(shared).toBeGreaterThan(editedRef.chunks.length * 0.8);
    expect(await store.get(editedRef)).toEqual(edited);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("garbage collection removes only unreferenced chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const kept = await store.put(bytes(3, 120_000));
    const dropped = await store.put(bytes(99, 120_000));
    const before = await countChunks(root);
    const referenced = new Set(kept.chunks);
    const removed = await store.collectGarbage(referenced);
    expect(removed.removed).toBe(dropped.chunks.length);
    expect(await countChunks(root)).toBe(kept.chunks.length);
    expect(before).toBeGreaterThan(kept.chunks.length);
    expect(await store.get(kept)).toEqual(bytes(3, 120_000));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("chunk store detects a corrupted chunk on read", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const payload = bytes(7, 200_000);
    const ref = await store.put(payload);
    const target = ref.chunks[0]!;
    const path = join(root, target.slice(0, 2), target);
    const corrupted = Buffer.from(await readFile(path));
    corrupted[0] = corrupted[0]! ^ 0xff;
    await writeFile(path, corrupted);
    await expect(store.get(ref)).rejects.toThrow(/integrity/);
    // Verification is opt-out: the size still checks out, only the hash differs.
    expect((await store.get(ref, { verify: false })).length).toBe(
      payload.length,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("garbage collection honours the age grace window", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const ref = await store.put(bytes(1, 50_000));
    const held = await store.collectGarbage(new Set(), false, {
      minAgeMs: 60_000,
    });
    expect(held.removed).toBe(0);
    expect(await store.has(ref)).toBe(true);
    const reaped = await store.collectGarbage(new Set(), false, {
      minAgeMs: 0,
    });
    expect(reaped.removed).toBe(ref.chunks.length);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("chunk store streams a payload without concatenating it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-chunks-"));
  try {
    const store = new ChunkStore(root);
    const payload = bytes(13, 150_000);
    const ref = await store.put(payload);
    const parts: Buffer[] = [];
    for await (const chunk of store.read(ref)) parts.push(chunk);
    expect(parts.length).toBe(ref.chunks.length);
    expect(Buffer.concat(parts).equals(payload)).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("chunker emits the same ranges for the same bytes", () => {
  const payload = bytes(5, 100_000);
  const first = contentDefinedChunks(payload).map((chunk) => chunk.length);
  const second = contentDefinedChunks(payload).map((chunk) => chunk.length);
  expect(first).toEqual(second);
  expect(first.reduce((sum, length) => sum + length, 0)).toBe(payload.length);
});
