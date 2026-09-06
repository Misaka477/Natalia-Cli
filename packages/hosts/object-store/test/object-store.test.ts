import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObjectStore } from "../src";
import {
  NativePackIndex,
  nativePackIndexAvailable,
} from "../src/native-index";

const sha256 = (content: Buffer | string) =>
  createHash("sha256").update(content).digest("hex");

async function openStore(prefix: string): Promise<{
  root: string;
  objects: ObjectStore;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  return { root, objects: new ObjectStore(join(root, "objects")) };
}

test("content-addressed store deduplicates identical blobs", async () => {
  const { objects } = await openStore("natalia-object-dedup-");
  const id1 = await objects.put("same content");
  const id2 = await objects.put("same content");
  expect(id1).toBe(sha256("same content"));
  expect(id2).toBe(id1);
  expect(await objects.has(id1)).toBe(true);
  expect(await objects.has("0000000000000000000000000000000000000000000000000000000000000000")).toBe(false);
  expect((await objects.get(id1)).toString("utf8")).toBe("same content");
  expect(await objects.list()).toEqual([id1]);
  await objects.delete(id1);
  expect(await objects.has(id1)).toBe(false);
});

test("batch APIs roundtrip content and metadata", async () => {
  const { objects } = await openStore("natalia-object-batch-");
  const ids = await objects.batchPut(["alpha", "beta", "gamma"]);
  expect(ids).toHaveLength(3);
  expect(await objects.batchHas(ids)).toEqual([true, true, true]);
  expect(
    (await objects.batchGet(ids)).map((b) => b?.toString("utf8")),
  ).toEqual(["alpha", "beta", "gamma"]);

  await objects.putMeta("key:one", { ok: true, n: 1 });
  expect(await objects.getMeta<{ ok: boolean; n: number }>("key:one")).toEqual({
    ok: true,
    n: 1,
  });
  await objects.putMeta("key:one", { ok: false, n: 2 });
  expect(await objects.getMeta<{ ok: boolean; n: number }>("key:one")).toEqual({
    ok: false,
    n: 2,
  });
  await objects.deleteMeta("key:one");
  expect(await objects.getMeta("key:one")).toBeUndefined();
  await objects.vacuumMeta();
});

test("large blobs are chunked and streamed without corruption", async () => {
  const { objects } = await openStore("natalia-object-chunk-");
  // > chunkMin and large enough to exercise multiple content-defined chunks.
  const text = "0123456789abcdef".repeat(64 * 1024); // 1 MiB
  const id = await objects.put(text);
  expect(id).toBe(sha256(Buffer.from(text)));
  const restored = (await objects.get(id)).toString("utf8");
  expect(restored).toBe(text);

  let total = 0;
  let chunks = 0;
  for await (const chunk of objects.getStream(id)) {
    total += chunk.byteLength;
    chunks++;
  }
  expect(total).toBe(text.length);
  expect(chunks).toBeGreaterThan(1);
  expect(await objects.list()).toContain(id);
});

test("compact packs loose objects and keeps random reads working", async () => {
  const { root, objects } = await openStore("natalia-object-pack-");
  const contents = Array.from({ length: 40 }, (_, i) => `object-${i}\n`);
  const ids = await objects.batchPut(contents);
  const result = await objects.compact();
  expect(result.packed).toBe(40);
  const packs = await readdir(join(root, "objects", "packs"));
  expect(packs.some((name) => name.endsWith(".pack"))).toBe(true);
  expect(packs.some((name) => name.endsWith(".idx"))).toBe(true);
  expect(await objects.batchHas(ids)).toEqual(ids.map(() => true));
  expect(
    (await objects.batchGet(ids)).map((b) => b?.toString("utf8")),
  ).toEqual(contents);
});

test("delta-packed similar objects survive a round trip", async () => {
  const { root, objects } = await openStore("natalia-object-delta-");
  const base =
    "function add(a: number, b: number): number {\n" +
    "  const total = a + b;\n" +
    "  const label = `sum of ${a} and ${b}`;\n" +
    "  console.log(label, total);\n" +
    "  return total;\n" +
    "}\n";
  const current = base
    .replace("a: number, b: number", "a: number, b: number, c: number")
    .replace("a + b", "a + b + c");
  const baseID = await objects.put(base);
  const currentID = await objects.put(current);
  await objects.compact();

  const idxFiles = (await readdir(join(root, "objects", "packs"))).filter(
    (name) => name.endsWith(".idx"),
  );
  expect(idxFiles.length).toBeGreaterThan(0);
  const idxBytes = await readFile(join(root, "objects", "packs", idxFiles[0]!));
  expect(idxBytes.toString("ascii", 0, 4)).toBe("NDX1");
  const count = idxBytes.readUInt32LE(8);
  let offset = 12;
  let sawDelta = false;
  for (let i = 0; i < count; i++) {
    const idLen = idxBytes.readUInt32LE(offset);
    offset += 4 + idLen;
    const recordKind = idxBytes[offset + 16];
    offset += 17;
    if (recordKind === 1) {
      const baseLen = idxBytes.readUInt32LE(offset);
      offset += 4 + baseLen + 4;
      sawDelta = true;
    }
  }
  expect(sawDelta).toBe(true);
  expect((await objects.get(baseID)).toString("utf8")).toBe(base);
  expect((await objects.get(currentID)).toString("utf8")).toBe(current);
});

test("garbage collection preserves reachable objects including chunk manifests", async () => {
  const { objects } = await openStore("natalia-object-gc-");
  const live = await objects.put("live-content");
  const dead = await objects.put("dead-content");
  const largeText = "x".repeat(512 * 1024);
  const liveLarge = await objects.put(largeText);
  const deadLarge = await objects.put("y".repeat(512 * 1024));

  const result = await objects.collectGarbage(new Set([live, liveLarge]));
  expect(result.unreachableObjects).toBeGreaterThanOrEqual(2);
  expect(await objects.has(live)).toBe(true);
  expect(await objects.has(liveLarge)).toBe(true);
  expect((await objects.get(liveLarge)).toString()).toBe(largeText);
  expect(await objects.has(dead)).toBe(false);
  expect(await objects.has(deadLarge)).toBe(false);
});

test("native FFI index can parse generated binary .idx entries", async () => {
  const { root, objects } = await openStore("natalia-object-native-");
  const id = await objects.put("native-indexed-content");
  await objects.compact();
  if (!nativePackIndexAvailable()) return;

  const idxFiles = (await readdir(join(root, "objects", "packs"))).filter(
    (name) => name.endsWith(".idx"),
  );
  expect(idxFiles.length).toBe(1);
  const idx = new NativePackIndex(join(root, "objects", "packs", idxFiles[0]!));
  try {
    const entry = idx.find(id);
    expect(entry).toBeDefined();
    expect(entry!.origLen).toBe(Buffer.byteLength("native-indexed-content"));
    expect(idx.find("not-present-in-this-pack")).toBeUndefined();
  } finally {
    idx.free();
  }
});

test("multiple ObjectStore instances share the same content-addressed root", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-object-multi-"));
  const a = new ObjectStore(join(root, "objects"));
  const b = new ObjectStore(join(root, "objects"));
  const contents = Array.from({ length: 20 }, (_, i) => `shared-${i}`);
  const ids = await Promise.all(contents.map((c, i) => (i % 2 ? a : b).put(c)));
  for (let i = 0; i < ids.length; i++) {
    expect(await a.has(ids[i]!)).toBe(true);
    expect(await b.has(ids[i]!)).toBe(true);
    expect((await (i % 2 ? b : a).get(ids[i]!)).toString()).toBe(contents[i]);
  }
});
