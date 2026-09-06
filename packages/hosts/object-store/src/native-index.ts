import { dlopen, FFIType, ptr as ffiPtr } from "bun:ffi";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type NativeIndexEntry = {
  offset: number;
  dataOffset: number;
  origLen: number;
  compLen: number;
  kind: number;
  deltaLen: number;
};

type NativeLib = {
  symbols: {
    native_index_load: (path: string) => unknown;
    native_index_find: (handle: unknown, id: string, out: unknown) => number;
    native_index_free: (handle: unknown) => void;
  };
};

let lib: NativeLib | undefined;
let libAttempted = false;

function candidatePaths(): string[] {
  const dir = import.meta.dir;
  const base = "native-index/target/release";
  return [
    resolve(dir, "..", base, "libnatalia_index_native.so"),
    resolve(dir, "..", "..", base, "libnatalia_index_native.so"),
    resolve(
      process.cwd(),
      "packages",
      "hosts",
      "object-store",
      base,
      "libnatalia_index_native.so",
    ),
  ];
}

function loadLib(): NativeLib | undefined {
  if (libAttempted) return lib;
  libAttempted = true;
  for (const path of candidatePaths()) {
    if (!existsSync(path)) continue;
    try {
      lib = dlopen(path, {
        native_index_load: {
          args: [FFIType.cstring],
          returns: FFIType.pointer,
        },
        native_index_find: {
          args: [FFIType.pointer, FFIType.cstring, FFIType.pointer],
          returns: FFIType.int,
        },
        native_index_free: {
          args: [FFIType.pointer],
          returns: FFIType.void,
        },
      }) as unknown as NativeLib;
      return lib;
    } catch {
      lib = undefined;
    }
  }
  return undefined;
}

export class NativePackIndex {
  private handle: unknown;
  constructor(path: string) {
    const loaded = loadLib();
    if (!loaded) throw new Error("native index library unavailable");
    const handle = loaded.symbols.native_index_load(path);
    if (!handle) throw new Error("native index load failed");
    this.handle = handle;
  }

  find(id: string): NativeIndexEntry | undefined {
    const loaded = loadLib();
    if (!loaded) return undefined;
    const out = Buffer.alloc(24); // repr(C): 4*u32 + u8 + padding + u32
    const outPtr = ffiPtr(out);
    const found = loaded.symbols.native_index_find(this.handle, id, outPtr);
    if (!found) return undefined;
    return {
      offset: out.readUInt32LE(0),
      dataOffset: out.readUInt32LE(4),
      origLen: out.readUInt32LE(8),
      compLen: out.readUInt32LE(12),
      kind: out[16],
      deltaLen: out.readUInt32LE(20),
    };
  }

  free(): void {
    const loaded = loadLib();
    if (!loaded) return;
    loaded.symbols.native_index_free(this.handle);
  }
}

export function nativePackIndexAvailable(): boolean {
  return loadLib() !== undefined;
}
