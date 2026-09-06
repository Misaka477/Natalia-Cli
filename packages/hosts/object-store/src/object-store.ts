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
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import {
  NativePackIndex,
  nativePackIndexAvailable,
  type NativeIndexEntry,
} from "./native-index";

export class ObjectStore {
  private readonly lru = new Map<string, Buffer>();
  private lruBytes = 0;
  private readonly lruMaxBytes = 32 * 1024 * 1024;
  private readonly lruMaxEntryBytes = 4 * 1024 * 1024;
  private readonly metaDb: Database;
  private readonly chunkMin = 32 * 1024;
  private readonly chunkMax = 1024 * 1024;
  private readonly chunkMask = 0x3ffff;
  private readonly packMagic = Buffer.from("NPAC", "ascii");
  private readonly packVersion = 1;
  private readonly packs = new Map<
    string,
    {
      packFile: string;
      offset: number;
      dataOffset: number;
      origLen: number;
      compLen: number;
      kind: number;
      baseId?: string;
      deltaLen?: number;
    }
  >();
  private packsLoaded = false;
  private nativeIndexes = new Map<string, NativePackIndex>();
  private readonly packBloom = new Uint8Array(1 << 20);
  private packBloomInitialized = false;

  constructor(private readonly root: string) {
    const metaDir = join(root, ".meta");
    mkdirSync(metaDir, { recursive: true, mode: 0o700 });
    this.metaDb = new Database(join(metaDir, "index.sqlite"));
    this.metaDb.run(`
      CREATE TABLE IF NOT EXISTS metadata (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(namespace, key)
      );
    `);
    this.metaDb.run("PRAGMA journal_mode=WAL");
    this.metaDb.run("PRAGMA synchronous=NORMAL");
  }

  /** Stores a blob if absent, returning its content id. */
  async put(content: Buffer | string): Promise<string> {
    const data = Buffer.from(content);
    const id = createHash("sha256").update(data).digest("hex");
    if (await this.has(id)) return id;
    if (data.length > this.chunkMin) {
      const chunks = this.splitIntoChunks(data);
      if (chunks.length > 1) {
        const chunkIds: string[] = [];
        for (const chunk of chunks) chunkIds.push(await this.putRaw(chunk));
        const manifest = JSON.stringify({ version: 1, chunks: chunkIds });
        const manifestId = await this.putRaw(manifest);
        await this.putMeta(`chunked:${id}`, {
          manifestId,
          totalLength: data.length,
          chunks: chunkIds,
        });
        return id;
      }
    }
    return await this.putRaw(data);
  }

  async has(id: string): Promise<boolean> {
    if (this.lru.has(id)) return true;
    if (await this.getMeta<{ manifestId: string }>(`chunked:${id}`))
      return true;
    try {
      await stat(this.objectPath(id));
      return true;
    } catch {
      // Fall through to pack indexes.
    }
    if (this.packBloomInitialized && !this.bloomMaybe(id)) return false;
    await this.loadPackIndexes();
    return this.packs.has(id);
  }

  private bloomSet(id: string): void {
    const b1 = this.bloomHash(id, 1) & (this.packBloom.length - 1);
    const b2 = this.bloomHash(id, 2) & (this.packBloom.length - 1);
    this.packBloom[b1] = 1;
    this.packBloom[b2] = 1;
  }

  private bloomMaybe(id: string): boolean {
    const b1 = this.bloomHash(id, 1) & (this.packBloom.length - 1);
    const b2 = this.bloomHash(id, 2) & (this.packBloom.length - 1);
    return this.packBloom[b1] === 1 && this.packBloom[b2] === 1;
  }

  private bloomHash(id: string, salt: number): number {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= salt;
    return hash >>> 0;
  }

  async get(id: string): Promise<Buffer> {
    const cached = this.lru.get(id);
    if (cached) {
      this.lru.delete(id);
      this.lru.set(id, cached);
      return cached;
    }
    const chunked = await this.getMeta<{
      manifestId: string;
      totalLength: number;
    }>(`chunked:${id}`);
    if (chunked) {
      const manifest = JSON.parse(
        (await this.getRaw(chunked.manifestId)).toString("utf8"),
      ) as { version: number; chunks: string[] };
      const parts: Buffer[] = [];
      for (const chunkId of manifest.chunks)
        parts.push(await this.getRaw(chunkId));
      const buffer = Buffer.concat(parts);
      this.cacheSet(id, buffer);
      return buffer;
    }
    try {
      const buffer = await readFile(this.objectPath(id));
      this.cacheSet(id, buffer);
      return buffer;
    } catch {
      return await this.packGet(id);
    }
  }

  /**
   * Streams an object's contents without forcing a whole large object into one
   * Buffer. Chunked objects yield each stored chunk; normal objects yield a
   * single buffer.
   */
  async *getStream(id: string): AsyncGenerator<Buffer> {
    const chunked = await this.getMeta<{
      manifestId: string;
      chunks: string[];
    }>(`chunked:${id}`);
    if (chunked) {
      const manifest = JSON.parse(
        (await this.getRaw(chunked.manifestId)).toString("utf8"),
      ) as { version: number; chunks: string[] };
      for (const chunkId of manifest.chunks) yield await this.getRaw(chunkId);
      return;
    }
    yield await this.get(id);
  }

  private async putRaw(content: Buffer | string): Promise<string> {
    const data = Buffer.from(content);
    const id = createHash("sha256").update(data).digest("hex");
    if (await this.has(id)) return id;
    const path = this.objectPath(id);
    await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, data, { mode: 0o600 });
    return id;
  }

  private async getRaw(id: string): Promise<Buffer> {
    try {
      return await readFile(this.objectPath(id));
    } catch {
      return await this.packGet(id);
    }
  }

  private splitIntoChunks(data: Buffer): Buffer[] {
    const chunks: Buffer[] = [];
    let start = 0;
    while (start < data.length) {
      let end = Math.min(data.length, start + this.chunkMax);
      let hash = 0;
      for (let i = start; i < end; i++) {
        hash =
          (((hash << 1) + (hash << 7) + (hash << 15) + data[i]) >>> 0) ^
          data[i];
        if (
          i - start >= this.chunkMin &&
          (hash & this.chunkMask) === 0 &&
          i + 1 < data.length
        ) {
          end = i + 1;
          break;
        }
      }
      chunks.push(data.subarray(start, end));
      start = end;
    }
    return chunks;
  }

  async batchHas(ids: string[]): Promise<boolean[]> {
    return await Promise.all(ids.map((id) => this.has(id)));
  }

  async batchGet(ids: string[]): Promise<Array<Buffer | undefined>> {
    return await Promise.all(
      ids.map(async (id) => {
        try {
          return await this.get(id);
        } catch {
          return undefined;
        }
      }),
    );
  }

  async batchPut(contents: Array<Buffer | string>): Promise<string[]> {
    return await Promise.all(contents.map((content) => this.put(content)));
  }

  async delete(id: string): Promise<void> {
    const existing = this.lru.get(id);
    if (existing) {
      this.lru.delete(id);
      this.lruBytes -= existing.byteLength;
    }
    await rm(this.objectPath(id), { force: true });
  }

  private cacheSet(id: string, buffer: Buffer): void {
    if (buffer.byteLength > this.lruMaxEntryBytes) return;
    const existing = this.lru.get(id);
    if (existing) this.lruBytes -= existing.byteLength;
    this.lru.delete(id);
    this.lru.set(id, buffer);
    this.lruBytes += buffer.byteLength;
    while (this.lruBytes > this.lruMaxBytes && this.lru.size > 0) {
      const [oldest, value] = this.lru.entries().next().value as [
        string,
        Buffer,
      ];
      this.lru.delete(oldest);
      this.lruBytes -= value.byteLength;
    }
  }

  private async mapConcurrent<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (true) {
          const index = next++;
          if (index >= items.length) return;
          results[index] = await fn(items[index]!);
        }
      },
    );
    await Promise.all(workers);
    return results;
  }

  /** Stores a small JSON metadata record under an arbitrary logical key. */
  async putMeta(key: string, value: unknown): Promise<void> {
    this.metaDb.run(
      `INSERT INTO metadata (namespace, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(namespace, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      ["default", key, JSON.stringify(value), Date.now()],
    );
    // Keep legacy file fallback for older readers/tools.
    const path = this.metaPath(key);
    await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, JSON.stringify(value), { mode: 0o600 });
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const row = this.metaDb
      .query("SELECT value FROM metadata WHERE namespace = ? AND key = ?")
      .get("default", key) as { value: string } | undefined;
    if (row) {
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return undefined;
      }
    }
    try {
      return JSON.parse(await readFile(this.metaPath(key), "utf8")) as T;
    } catch {
      return undefined;
    }
  }

  async deleteMeta(key: string): Promise<void> {
    this.metaDb.run("DELETE FROM metadata WHERE namespace = ? AND key = ?", [
      "default",
      key,
    ]);
    await rm(this.metaPath(key), { force: true });
  }

  /** Compacts the SQLite metadata file after heavy delete/eviction work. */
  async vacuumMeta(): Promise<void> {
    this.metaDb.run("VACUUM");
  }

  /** Every object id currently in the store. */
  async list(): Promise<string[]> {
    const ids = new Set<string>();
    for (const prefix of await readdir(this.root).catch(() => [] as string[])) {
      if (prefix.length !== 2) continue;
      const dir = join(this.root, prefix);
      for (const name of await readdir(dir).catch(() => [] as string[])) {
        if (name.startsWith(prefix)) ids.add(name);
      }
    }
    await this.loadPackIndexes();
    for (const id of this.packs.keys()) ids.add(id);
    const chunkedRows = this.metaDb
      .query("SELECT key FROM metadata WHERE namespace = ? AND key LIKE ?")
      .all("default", "chunked:%") as Array<{ key: string }>;
    for (const row of chunkedRows) ids.add(row.key.slice("chunked:".length));
    return [...ids];
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
    await this.loadPackIndexes();
    const allIds = new Set<string>(await this.list());
    const extendedReachable = new Set(reachable);
    for (const id of reachable) {
      const chunked = await this.getMeta<{
        manifestId: string;
        chunks?: string[];
      }>(`chunked:${id}`);
      if (!chunked) continue;
      extendedReachable.add(chunked.manifestId);
      for (const chunkId of chunked.chunks ?? [])
        extendedReachable.add(chunkId);
    }
    const unreachableIds = [...allIds].filter(
      (id) => !extendedReachable.has(id),
    );
    let unreachableObjects = 0;
    let bytes = 0;
    for (const id of unreachableIds) {
      const chunked = await this.getMeta<{ manifestId: string }>(
        `chunked:${id}`,
      );
      if (chunked) {
        await this.deleteMeta(`chunked:${id}`);
        unreachableObjects++;
        continue;
      }
      const path = this.objectPath(id);
      try {
        bytes += (await stat(path)).size;
      } catch {
        continue;
      }
      await rm(path, { force: true });
      const cached = this.lru.get(id);
      if (cached) {
        this.lru.delete(id);
        this.lruBytes -= cached.byteLength;
      }
      unreachableObjects++;
    }
    const keepRawIds = new Set<string>();
    for (const id of extendedReachable) {
      if (await this.getMeta(`chunked:${id}`)) continue;
      keepRawIds.add(id);
    }
    await this.rebuildPacks(keepRawIds);
    return { unreachableObjects, bytes };
  }

  private async rebuildPacks(keepIds: Set<string>): Promise<void> {
    await this.loadPackIndexes();
    const oldPackFiles = new Set(
      [...this.packs.values()].map((entry) => entry.packFile),
    );
    const packDir = join(this.root, "packs");
    await mkdir(packDir, { recursive: true, mode: 0o700 });
    if (!keepIds.size) {
      for (const file of oldPackFiles) {
        await rm(file, { force: true });
        this.nativeIndexes.get(file)?.free();
      }
      const oldIndexes = await readdir(packDir).catch(() => [] as string[]);
      for (const file of oldIndexes.filter(
        (name) => name.endsWith(".idx.json") || name.endsWith(".idx"),
      ))
        await rm(join(packDir, file), { force: true });
      this.nativeIndexes.clear();
      this.packs.clear();
      this.packsLoaded = false;
      return;
    }
    const stamp = Date.now().toString(36);
    const packFile = join(packDir, `pack-${stamp}.pack`);
    const indexEntries: Array<{
      id: string;
      offset: number;
      dataOffset: number;
      origLen: number;
      compLen: number;
      kind: number;
      baseId?: string;
      deltaLen?: number;
    }> = [];
    const keepIdList = [...keepIds];
    const originals = await this.mapConcurrent(keepIdList, 4, async (id) => {
      try {
        return await readFile(this.objectPath(id));
      } catch {
        return await this.packGet(id);
      }
    });
    const originalById = new Map(
      originals.map((original, index) => [keepIdList[index]!, original]),
    );
    const fd = await open(packFile, "w");
    await fd.write(this.packMagic);
    await fd.write(Buffer.from([this.packVersion]));
    let offset = this.packMagic.length + 1;
    let lastId: string | undefined;
    let lastOriginal: Buffer | undefined;
    try {
      for (const id of keepIds) {
        const original = originalById.get(id)!;
        const delta =
          lastOriginal && this.deltaSize(original, lastOriginal)
            ? this.computeDelta(lastOriginal, original)
            : undefined;
        if (delta) {
          const baseId = lastId!;
          const baseIdBuffer = Buffer.from(baseId, "utf8");
          const header = Buffer.alloc(1 + 4 + baseIdBuffer.length + 4 + 4);
          header.writeUInt8(1, 0);
          header.writeUInt32LE(baseIdBuffer.length, 1);
          baseIdBuffer.copy(header, 5);
          header.writeUInt32LE(original.length, 5 + baseIdBuffer.length);
          header.writeUInt32LE(delta.bytes.length, 9 + baseIdBuffer.length);
          await fd.write(header);
          await fd.write(delta.bytes);
          indexEntries.push({
            id,
            offset,
            dataOffset: offset + header.length,
            origLen: original.length,
            compLen: 0,
            kind: 1,
            baseId,
            deltaLen: delta.bytes.length,
          });
          offset += header.length + delta.bytes.length;
        } else {
          const compressed = deflateSync(original);
          const idBuffer = Buffer.from(id, "utf8");
          const header = Buffer.alloc(1 + 4 + idBuffer.length + 4 + 4);
          header.writeUInt8(0, 0);
          header.writeUInt32LE(idBuffer.length, 1);
          idBuffer.copy(header, 5);
          header.writeUInt32LE(original.length, 5 + idBuffer.length);
          header.writeUInt32LE(compressed.length, 9 + idBuffer.length);
          await fd.write(header);
          await fd.write(compressed);
          indexEntries.push({
            id,
            offset,
            dataOffset: offset + header.length,
            origLen: original.length,
            compLen: compressed.length,
            kind: 0,
          });
          offset += header.length + compressed.length;
        }
        lastId = id;
        lastOriginal = original;
      }
      await fd.close();
    } catch (error) {
      await fd.close().catch(() => undefined);
      await rm(packFile, { force: true });
      throw error;
    }
    await this.writeBinaryIndex(packFile, indexEntries);
    for (const file of oldPackFiles) {
      await rm(file, { force: true });
      await rm(file.replace(/\.pack$/, ".idx.json"), { force: true });
      await rm(file.replace(/\.pack$/, ".idx"), { force: true });
      this.nativeIndexes.get(file)?.free();
      this.nativeIndexes.delete(file);
    }
    this.packs.clear();
    this.packsLoaded = false;
    await this.loadPackIndexes();
  }

  /**
   * Writes a pack file containing loose objects and removes the loose copies.
   * This is the Phase C compaction entry point; random reads still work
   * through the pack index.
   */
  async compact(): Promise<{
    packed: number;
    bytes: number;
    packFile: string;
  }> {
    const looseIds = await this.listLoose();
    if (!looseIds.length) return { packed: 0, bytes: 0, packFile: "" };
    const packDir = join(this.root, "packs");
    await mkdir(packDir, { recursive: true, mode: 0o700 });
    const stamp = Date.now().toString(36);
    const packFile = join(packDir, `pack-${stamp}.pack`);
    const indexEntries: Array<{
      id: string;
      offset: number;
      dataOffset: number;
      origLen: number;
      compLen: number;
      kind: number;
      baseId?: string;
      deltaLen?: number;
    }> = [];
    const looseOriginals = await this.mapConcurrent(looseIds, 4, (id) =>
      readFile(this.objectPath(id)),
    );
    const originalById = new Map(
      looseOriginals.map((original, index) => [looseIds[index]!, original]),
    );
    const fd = await open(packFile, "w");
    await fd.write(this.packMagic);
    await fd.write(Buffer.from([this.packVersion]));
    let offset = this.packMagic.length + 1;
    let totalBytes = 0;
    let lastId: string | undefined;
    let lastOriginal: Buffer | undefined;
    try {
      for (const id of looseIds) {
        const original = originalById.get(id)!;
        const delta =
          lastOriginal && this.deltaSize(original, lastOriginal)
            ? this.computeDelta(lastOriginal, original)
            : undefined;
        if (delta) {
          const baseId = lastId!;
          const baseIdBuffer = Buffer.from(baseId, "utf8");
          const header = Buffer.alloc(1 + 4 + baseIdBuffer.length + 4 + 4);
          header.writeUInt8(1, 0);
          header.writeUInt32LE(baseIdBuffer.length, 1);
          baseIdBuffer.copy(header, 5);
          header.writeUInt32LE(original.length, 5 + baseIdBuffer.length);
          header.writeUInt32LE(delta.bytes.length, 9 + baseIdBuffer.length);
          await fd.write(header);
          await fd.write(delta.bytes);
          indexEntries.push({
            id,
            offset,
            dataOffset: offset + header.length,
            origLen: original.length,
            compLen: 0,
            kind: 1,
            baseId,
            deltaLen: delta.bytes.length,
          });
          offset += header.length + delta.bytes.length;
        } else {
          const compressed = deflateSync(original);
          const idBuffer = Buffer.from(id, "utf8");
          const header = Buffer.alloc(1 + 4 + idBuffer.length + 4 + 4);
          header.writeUInt8(0, 0);
          header.writeUInt32LE(idBuffer.length, 1);
          idBuffer.copy(header, 5);
          header.writeUInt32LE(original.length, 5 + idBuffer.length);
          header.writeUInt32LE(compressed.length, 9 + idBuffer.length);
          await fd.write(header);
          await fd.write(compressed);
          indexEntries.push({
            id,
            offset,
            dataOffset: offset + header.length,
            origLen: original.length,
            compLen: compressed.length,
            kind: 0,
          });
          offset += header.length + compressed.length;
        }
        totalBytes += original.length;
        lastId = id;
        lastOriginal = original;
      }
      await fd.close();
    } catch (error) {
      await fd.close().catch(() => undefined);
      await rm(packFile, { force: true });
      throw error;
    }
    await this.writeBinaryIndex(packFile, indexEntries);
    this.packsLoaded = false;
    await this.loadPackIndexes();
    for (const id of looseIds) {
      await rm(this.objectPath(id), { force: true });
      this.lru.delete(id);
    }
    return { packed: looseIds.length, bytes: totalBytes, packFile };
  }

  private async loadPackIndexes(): Promise<void> {
    if (this.packsLoaded) return;
    this.packsLoaded = true;
    this.packBloom.fill(0);
    this.packBloomInitialized = false;
    this.nativeIndexes.clear();
    const packDir = join(this.root, "packs");
    const files = await readdir(packDir).catch(() => [] as string[]);
    for (const file of files) {
      const packFile = file.endsWith(".idx")
        ? join(packDir, file.replace(/\.idx$/, ".pack"))
        : file.endsWith(".idx.json")
          ? join(packDir, file.replace(/\.idx\.json$/, ".pack"))
          : undefined;
      if (!packFile) continue;
      let entries: Array<{
        id: string;
        offset: number;
        dataOffset: number;
        origLen: number;
        compLen: number;
        kind?: number;
        baseId?: string;
        deltaLen?: number;
      }>;
      try {
        entries = file.endsWith(".idx")
          ? this.readBinaryIndex(await readFile(join(packDir, file)))
          : (JSON.parse(
              await readFile(join(packDir, file), "utf8"),
            ) as typeof entries);
        try {
          await stat(packFile);
        } catch {
          continue;
        }
        if (file.endsWith(".idx") && nativePackIndexAvailable()) {
          try {
            this.nativeIndexes.set(packFile, new NativePackIndex(packFile));
          } catch {
            // Native module optional; JS binary parser remains authoritative.
          }
        }
        for (const entry of entries) {
          this.packs.set(entry.id, {
            packFile,
            offset: entry.offset,
            dataOffset: entry.dataOffset,
            origLen: entry.origLen,
            compLen: entry.compLen,
            kind: entry.kind ?? 0,
            ...(entry.baseId ? { baseId: entry.baseId } : {}),
            ...(entry.deltaLen !== undefined
              ? { deltaLen: entry.deltaLen }
              : {}),
          });
          this.bloomSet(entry.id);
        }
      } catch {
        // Ignore malformed pack indexes; loose objects remain fallback.
      }
    }
    this.packBloomInitialized = true;
  }

  private readBinaryIndex(buffer: Buffer): Array<{
    id: string;
    offset: number;
    dataOffset: number;
    origLen: number;
    compLen: number;
    kind: number;
    baseId?: string;
    deltaLen?: number;
  }> {
    if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "NDX1")
      throw new Error("invalid binary pack index");
    const count = buffer.readUInt32LE(8);
    let offset = 12;
    const entries: Array<{
      id: string;
      offset: number;
      dataOffset: number;
      origLen: number;
      compLen: number;
      kind: number;
      baseId?: string;
      deltaLen?: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      const idLen = buffer.readUInt32LE(offset);
      offset += 4;
      const id = buffer.toString("utf8", offset, offset + idLen);
      offset += idLen;
      const recOffset = buffer.readUInt32LE(offset);
      const dataOffset = buffer.readUInt32LE(offset + 4);
      const origLen = buffer.readUInt32LE(offset + 8);
      const compLen = buffer.readUInt32LE(offset + 12);
      const kind = buffer[offset + 16];
      offset += 17;
      let baseId: string | undefined;
      let deltaLen: number | undefined;
      if (kind === 1) {
        const baseLen = buffer.readUInt32LE(offset);
        offset += 4;
        baseId = buffer.toString("utf8", offset, offset + baseLen);
        offset += baseLen;
        deltaLen = buffer.readUInt32LE(offset);
        offset += 4;
      }
      entries.push({
        id,
        offset: recOffset,
        dataOffset,
        origLen,
        compLen,
        kind,
        ...(baseId ? { baseId } : {}),
        ...(deltaLen !== undefined ? { deltaLen } : {}),
      });
    }
    return entries;
  }

  private async writeBinaryIndex(
    packFile: string,
    entries: Array<{
      id: string;
      offset: number;
      dataOffset: number;
      origLen: number;
      compLen: number;
      kind: number;
      baseId?: string;
      deltaLen?: number;
    }>,
  ): Promise<void> {
    const indexPath = packFile.replace(/\.pack$/, ".idx");
    const buffers = [Buffer.from("NDX1", "ascii"), Buffer.alloc(8)];
    buffers[1]!.writeUInt32LE(1, 0);
    buffers[1]!.writeUInt32LE(entries.length, 4);
    for (const entry of entries) {
      const idBuffer = Buffer.from(entry.id, "utf8");
      const baseIdBuffer = entry.baseId
        ? Buffer.from(entry.baseId, "utf8")
        : undefined;
      const header = Buffer.alloc(
        4 +
          idBuffer.length +
          4 +
          4 +
          4 +
          4 +
          1 +
          (entry.kind === 1 ? 4 + (baseIdBuffer?.length ?? 0) + 4 : 0),
      );
      let o = 0;
      header.writeUInt32LE(idBuffer.length, o);
      o += 4;
      idBuffer.copy(header, o);
      o += idBuffer.length;
      header.writeUInt32LE(entry.offset, o);
      o += 4;
      header.writeUInt32LE(entry.dataOffset, o);
      o += 4;
      header.writeUInt32LE(entry.origLen, o);
      o += 4;
      header.writeUInt32LE(entry.compLen, o);
      o += 4;
      header.writeUInt8(entry.kind, o);
      o += 1;
      if (entry.kind === 1) {
        header.writeUInt32LE(baseIdBuffer?.length ?? 0, o);
        o += 4;
        if (baseIdBuffer) baseIdBuffer.copy(header, o);
        o += baseIdBuffer?.length ?? 0;
        header.writeUInt32LE(entry.deltaLen ?? 0, o);
      }
      buffers.push(header);
    }
    await writeFile(indexPath, Buffer.concat(buffers), { mode: 0o600 });
  }

  private deltaSize(current: Buffer, base: Buffer): boolean {
    if (current.length < 64 || base.length < 64) return false;
    const delta = this.computeDelta(base, current).bytes;
    // Only use delta when the instruction stream is meaningfully smaller
    // than shipping the whole object as a full zlib record.
    return delta.length < current.length * 0.7;
  }

  private computeDelta(base: Buffer, current: Buffer): { bytes: Buffer } {
    const instructions: Buffer[] = [];
    const literal: number[] = [];
    let i = 0;
    const minMatch = 8;
    const window = 16;
    const baseWindows = new Map<string, number>();
    for (let pos = 0; pos + window <= base.length; pos++) {
      baseWindows.set(base.subarray(pos, pos + window).toString("latin1"), pos);
    }

    const flushLiteral = () => {
      if (!literal.length) return;
      const buf = Buffer.from(literal);
      const head = Buffer.alloc(5);
      head.writeUInt8(1, 0);
      head.writeUInt32LE(buf.length, 1);
      instructions.push(head, buf);
      literal.length = 0;
    };

    while (i < current.length) {
      let bestLen = 0;
      let bestPos = 0;
      if (i + window <= current.length) {
        const key = current.subarray(i, i + window).toString("latin1");
        const candidate = baseWindows.get(key);
        if (candidate !== undefined) {
          const pos = candidate;
          let len = window;
          while (
            i + len < current.length &&
            pos + len < base.length &&
            base[pos + len] === current[i + len]
          )
            len++;
          bestLen = len;
          bestPos = pos;
        }
      }
      if (bestLen >= minMatch) {
        flushLiteral();
        const head = Buffer.alloc(9);
        head.writeUInt8(0, 0);
        head.writeUInt32LE(bestPos, 1);
        head.writeUInt32LE(bestLen, 5);
        instructions.push(head);
        i += bestLen;
      } else {
        literal.push(current[i]);
        i++;
      }
    }
    flushLiteral();
    return { bytes: Buffer.concat(instructions) };
  }

  private applyDelta(base: Buffer, delta: Buffer, expectedLen: number): Buffer {
    const parts: Buffer[] = [];
    let offset = 0;
    while (offset < delta.length) {
      const op = delta[offset++];
      if (op === 0) {
        const pos = delta.readUInt32LE(offset);
        const len = delta.readUInt32LE(offset + 4);
        offset += 8;
        parts.push(base.subarray(pos, pos + len));
      } else if (op === 1) {
        const len = delta.readUInt32LE(offset);
        offset += 4;
        parts.push(delta.subarray(offset, offset + len));
        offset += len;
      } else {
        throw new Error(`unknown delta op ${op}`);
      }
    }
    const original = Buffer.concat(parts);
    if (original.length !== expectedLen)
      throw new Error("delta result length mismatch");
    return original;
  }

  private findNativeEntry(
    id: string,
  ): (NativeIndexEntry & { packFile: string }) | undefined {
    for (const [packFile, native] of this.nativeIndexes) {
      const found = native.find(id);
      if (found) return { ...found, packFile };
    }
    return undefined;
  }

  private async packGet(id: string): Promise<Buffer> {
    await this.loadPackIndexes();
    const nativeEntry = this.findNativeEntry(id);
    if (nativeEntry && nativeEntry.kind === 0) {
      return await this.readPackEntry(id, {
        packFile: nativeEntry.packFile,
        offset: nativeEntry.offset,
        dataOffset: nativeEntry.dataOffset,
        origLen: nativeEntry.origLen,
        compLen: nativeEntry.compLen,
        kind: 0,
      });
    }
    let entry = this.packs.get(id);
    if (!entry) throw new Error(`object not found: ${id}`);
    try {
      return await this.readPackEntry(id, entry);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // Another ObjectStore instance may have repacked/deleted this pack.
      this.packsLoaded = false;
      this.packs.clear();
      await this.loadPackIndexes();
      entry = this.packs.get(id);
      if (!entry) throw new Error(`object not found: ${id}`);
      return await this.readPackEntry(id, entry);
    }
  }

  private async readPackEntry(
    id: string,
    entry: {
      packFile: string;
      offset: number;
      dataOffset: number;
      origLen: number;
      compLen: number;
      kind: number;
      baseId?: string;
      deltaLen?: number;
    },
  ): Promise<Buffer> {
    const fd = await open(entry.packFile, "r");
    try {
      if (entry.kind === 1) {
        const delta = Buffer.alloc(entry.deltaLen ?? 0);
        await fd.read(delta, 0, delta.length, entry.dataOffset);
        const base = entry.baseId ? await this.getRaw(entry.baseId) : undefined;
        if (!base) throw new Error(`missing delta base for ${id}`);
        const original = this.applyDelta(base, delta, entry.origLen);
        this.cacheSet(id, original);
        return original;
      }
      const compressed = Buffer.alloc(entry.compLen);
      await fd.read(compressed, 0, entry.compLen, entry.dataOffset);
      const original = inflateSync(compressed);
      if (original.length !== entry.origLen)
        throw new Error(`pack object size mismatch for ${id}`);
      this.cacheSet(id, original);
      return original;
    } finally {
      await fd.close();
    }
  }

  private async listLoose(): Promise<string[]> {
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

  private objectPath(id: string): string {
    return join(this.root, id.slice(0, 2), id);
  }

  private metaPath(key: string): string {
    return join(
      this.root,
      ".meta",
      Buffer.from(key).toString("base64url") + ".json",
    );
  }
}
