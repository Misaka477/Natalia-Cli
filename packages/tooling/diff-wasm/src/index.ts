export type WasmDiffResult = {
  patch?: string;
  additions: number;
  deletions: number;
};

type WasmExports = {
  memory: WebAssembly.Memory;
  wasm_alloc(len: number): number;
  wasm_dealloc(ptr: number, len: number): void;
  wasm_diff(
    oldPtr: number,
    oldLen: number,
    newPtr: number,
    newLen: number,
    outLenPtr: number,
  ): number;
};

let engine: WasmExports | undefined;
let enginePromise: Promise<WasmExports> | undefined;

function allocString(
  exports: WasmExports,
  text: string,
): { ptr: number; len: number } {
  const bytes = new TextEncoder().encode(text);
  const ptr = exports.wasm_alloc(bytes.length);
  if (!ptr) throw new Error("wasm alloc failed");
  new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
  return { ptr, len: bytes.length };
}

function readString(exports: WasmExports, ptr: number, len: number): string {
  if (!ptr || len === 0) return "";
  return new TextDecoder().decode(
    new Uint8Array(exports.memory.buffer, ptr, len),
  );
}

export async function loadWasmDiff(): Promise<WasmExports> {
  if (engine) return engine;
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const url = new URL("./natalia_diff_wasm.wasm", import.meta.url);
    try {
      const source = await fetch(url);
      const module = await WebAssembly.instantiateStreaming(source, {});
      return module.instance.exports as unknown as WasmExports;
    } catch {
      // Node/Bun fallback: read the wasm from disk directly.
      const { readFile } = await import("node:fs/promises");
      const { fileURLToPath } = await import("node:url");
      const bytes = await readFile(fileURLToPath(url));
      const module = await WebAssembly.instantiate(bytes, {});
      return module.instance.exports as unknown as WasmExports;
    }
  })();
  engine = await enginePromise;
  return engine;
}

export async function diffWasm(
  oldText: string,
  newText: string,
): Promise<WasmDiffResult> {
  const exports = await loadWasmDiff();
  const old = allocString(exports, oldText);
  const new_ = allocString(exports, newText);
  const outLenPtr = exports.wasm_alloc(8);
  try {
    const patchPtr = exports.wasm_diff(
      old.ptr,
      old.len,
      new_.ptr,
      new_.len,
      outLenPtr,
    );
    const outLen = new DataView(exports.memory.buffer, outLenPtr, 8).getBigUint64(
      0,
      true,
    );
    const patch = readString(exports, patchPtr, Number(outLen));
    let additions = 0;
    let deletions = 0;
    for (const line of patch.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }
    return { patch, additions, deletions };
  } finally {
    exports.wasm_dealloc(old.ptr, old.len);
    exports.wasm_dealloc(new_.ptr, new_.len);
    exports.wasm_dealloc(outLenPtr, 8);
  }
}
