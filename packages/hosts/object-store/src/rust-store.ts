import { dlopen, FFIType, ptr as ffiPtr } from "bun:ffi";
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * T2 Phase A (object-store-rust plan) — the bun:ffi face of the Rust
 * CAS core. `root` is the ObjectStore's own root (shards = first two
 * hex chars), so both implementations address identical paths.
 *
 * The crate is deliberately ZERO-DEPENDENCY: this sandbox's cargo home
 * is fresh per invocation, so a registry dependency would re-download
 * every build. The loader self-heals — it builds the cdylib when it is
 * missing OR older than any crate source (the ast-pack SKIP rule's
 * freshness shape), so tests and the chain never depend on a manual
 * step.
 */

// src -> object-store -> hosts -> packages -> object-store-rust
const CRATE_DIR = resolve(
  import.meta.dir,
  "..",
  "..",
  "..",
  "object-store-rust",
);
const LIB_PATH = join(
  CRATE_DIR,
  "target",
  "release",
  "libnatalia_object_store.so",
);

type RustCasLib = {
  symbols: {
    cas_sha256_hex: (data: unknown, dataLen: number, out: unknown) => number;
    cas_put: (
      root: unknown,
      rootLen: number,
      data: unknown,
      dataLen: number,
      out: unknown,
    ) => number;
    cas_has: (
      root: unknown,
      rootLen: number,
      id: unknown,
      idLen: number,
    ) => number;
    cas_get_size: (
      root: unknown,
      rootLen: number,
      id: unknown,
      idLen: number,
    ) => number;
    cas_get: (
      root: unknown,
      rootLen: number,
      id: unknown,
      idLen: number,
      out: unknown,
      outCap: number,
    ) => number;
  };
};

let lib: RustCasLib | undefined;

async function newestSourceTime(): Promise<number> {
  let newest = 0;
  for (const name of await readdir(join(CRATE_DIR, "src"))) {
    const time = statSync(join(CRATE_DIR, "src", name)).mtimeMs;
    if (time > newest) newest = time;
  }
  const cargoTime = statSync(join(CRATE_DIR, "Cargo.toml")).mtimeMs;
  return Math.max(newest, cargoTime);
}

async function buildIfStale(): Promise<void> {
  const built = existsSync(LIB_PATH) ? statSync(LIB_PATH).mtimeMs : 0;
  if (built && built > (await newestSourceTime())) return;
  const result = spawnSync("cargo", ["build", "--release"], {
    cwd: CRATE_DIR,
    env: {
      ...process.env,
      // ~/.cargo is read-only here (the same family as ~/.npm): a /tmp
      // cargo home keeps the build writable, and a std-only crate means
      // nothing is ever fetched into it.
      CARGO_HOME: process.env.CARGO_HOME ?? "/tmp/natalia-cargo",
    },
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error)
    throw new Error(
      `object-store-rust build could not start (cargo): ${result.error.message} (cwd ${CRATE_DIR})`,
    );
  if (result.status !== 0)
    throw new Error(
      `object-store-rust build failed (cargo exit ${result.status}):\n${result.stderr}\n${result.stdout}`,
    );
}

function load(): RustCasLib {
  if (lib) return lib;
  const loaded = dlopen(LIB_PATH, {
    cas_sha256_hex: {
      args: [FFIType.pointer, FFIType.u64, FFIType.pointer],
      returns: FFIType.int,
    },
    cas_put: {
      args: [
        FFIType.pointer,
        FFIType.u64,
        FFIType.pointer,
        FFIType.u64,
        FFIType.pointer,
      ],
      returns: FFIType.int,
    },
    cas_has: {
      args: [FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.u64],
      returns: FFIType.int,
    },
    cas_get_size: {
      args: [FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.u64],
      returns: FFIType.i64,
    },
    cas_get: {
      args: [
        FFIType.pointer,
        FFIType.u64,
        FFIType.pointer,
        FFIType.u64,
        FFIType.pointer,
        FFIType.u64,
      ],
      returns: FFIType.i64,
    },
  }) as unknown as RustCasLib;
  lib = loaded;
  return loaded;
}

const enc = (text: string) => Buffer.from(text, "utf8");
// An empty Buffer has no address ffiPtr can take: the Rust side treats
// null+0 as an empty slice (the NIST empty-string vector travels here).
const bptr = (bytes: Buffer): unknown =>
  bytes.byteLength === 0 ? null : ffiPtr(bytes);
const hex = (out: Buffer) => out.toString("utf8");

export const rustCas = {
  async ensureBuilt(): Promise<void> {
    await buildIfStale();
  },
  available(): boolean {
    return existsSync(LIB_PATH);
  },
  sha256Hex(data: Buffer | string): string {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const out = Buffer.alloc(64);
    const code = load().symbols.cas_sha256_hex(
      bptr(bytes),
      bytes.byteLength,
      bptr(out),
    );
    if (code !== 0) throw new Error(`cas_sha256_hex failed: ${code}`);
    return hex(out);
  },
  put(root: string, data: Buffer | string): string {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const rootBuf = enc(root);
    const out = Buffer.alloc(64);
    const code = load().symbols.cas_put(
      ffiPtr(rootBuf),
      rootBuf.byteLength,
      bptr(bytes),
      bytes.byteLength,
      bptr(out),
    );
    if (code !== 0) throw new Error(`cas_put failed: ${code}`);
    return hex(out);
  },
  has(root: string, id: string): boolean {
    const rootBuf = enc(root);
    const idBuf = enc(id);
    return (
      load().symbols.cas_has(
        ffiPtr(rootBuf),
        rootBuf.byteLength,
        ffiPtr(idBuf),
        idBuf.byteLength,
      ) === 1
    );
  },
  getSize(root: string, id: string): number {
    const rootBuf = enc(root);
    const idBuf = enc(id);
    // bun:ffi returns i64 as BigInt by design; the sizes a store
    // object can carry fit a Number exactly (the chunk ceiling is 1 MiB).
    return Number(
      load().symbols.cas_get_size(
        ffiPtr(rootBuf),
        rootBuf.byteLength,
        ffiPtr(idBuf),
        idBuf.byteLength,
      ),
    );
  },
  get(root: string, id: string): Buffer {
    const rootBuf = enc(root);
    const idBuf = enc(id);
    const size = rustCas.getSize(root, id);
    if (size < 0) throw new Error(`object ${id} not found`);
    const out = Buffer.alloc(size);
    const written = Number(
      load().symbols.cas_get(
        ffiPtr(rootBuf),
        rootBuf.byteLength,
        ffiPtr(idBuf),
        idBuf.byteLength,
        bptr(out),
        out.byteLength,
      ),
    );
    if (written === 1) throw new Error(`object ${id} is corrupt`);
    if (written === 3) throw new Error(`object ${id}: capacity ${size}`);
    if (written < 0) throw new Error(`object ${id} unreadable (${written})`);
    return out.subarray(0, written);
  },
};
