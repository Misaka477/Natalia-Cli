import type { RuntimeStructuredDiffHunk } from "@natalia/contracts";
import type { StructuredDiffResult } from "@natalia/diff-wasm";
import type { DiffWorkerRequest, DiffWorkerResponse } from "./diff-worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  {
    resolve: (result: StructuredDiffResult) => void;
    reject: (error: Error) => void;
  }
>();
const streaming = new Map<
  number,
  {
    onHunk: (hunk: RuntimeStructuredDiffHunk) => void;
    resolve: (meta: { additions: number; deletions: number }) => void;
    reject: (error: Error) => void;
  }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./diff-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener(
    "message",
    (event: MessageEvent<DiffWorkerResponse>) => {
      const response = event.data;
      const single = pending.get(response.id);
      if (single) {
        pending.delete(response.id);
        if (response.ok && "result" in response) {
          single.resolve(response.result);
        } else if (response.ok) {
          single.reject(new Error("unexpected stream response"));
        } else {
          single.reject(new Error(response.error));
        }
        return;
      }
      const stream = streaming.get(response.id);
      if (!stream) return;
      if (!response.ok) {
        streaming.delete(response.id);
        stream.reject(new Error(response.error));
        return;
      }
      if (!("stream" in response && response.stream)) return;
      if (response.kind === "start") return;
      if (response.kind === "hunk") {
        stream.onHunk(response.hunk);
        return;
      }
      if (response.kind === "done") {
        streaming.delete(response.id);
        stream.resolve(
          response as unknown as { additions: number; deletions: number },
        );
      }
    },
  );
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("diff worker failed"));
    pending.clear();
    for (const { reject } of streaming.values())
      reject(new Error("diff worker failed"));
    streaming.clear();
  });
  return worker;
}

/**
 * Runs a structured diff (`@natalia/diff-wasm` + parseDiffBinary) inside a
 * dedicated Web Worker. The main thread only receives the already-parsed
 * `StructuredDiffResult`.
 */
export function computeDiffInWorker(
  oldText: string,
  newText: string,
): Promise<StructuredDiffResult> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<StructuredDiffResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: DiffWorkerRequest = {
      id,
      oldText,
      newText,
    };
    instance.postMessage(request);
  });
}

/**
 * Streaming variant: hunks are posted one-by-one from the Worker so a large
 * diff can be rendered incrementally without waiting for the full result.
 */
export function computeDiffInWorkerStream(
  oldText: string,
  newText: string,
  onHunk: (hunk: RuntimeStructuredDiffHunk) => void,
): Promise<{ additions: number; deletions: number }> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<{ additions: number; deletions: number }>(
    (resolve, reject) => {
      streaming.set(id, { onHunk, resolve, reject });
      const request: DiffWorkerRequest = {
        id,
        oldText,
        newText,
        stream: true,
      };
      instance.postMessage(request);
    },
  );
}
