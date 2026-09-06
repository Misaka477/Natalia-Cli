import type { DiffParseWorkerRequest, DiffParseWorkerResponse } from "./diff-parse.worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  {
    resolve: (result: DiffParseWorkerResponse extends { ok: true; result: infer R } ? R : never) => void;
    reject: (error: Error) => void;
  }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./diff-parse.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener(
    "message",
    (event: MessageEvent<DiffParseWorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.result as never);
      else entry.reject(new Error(response.error));
    },
  );
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("diff-parse worker failed"));
    pending.clear();
  });
  return worker;
}

export function parsePatchInWorker(patch: string) {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<{
    counts: { additions: number; deletions: number };
    structured: ReturnType<typeof import("../structured-parse").patchToStructured>;
  }>((resolve, reject) => {
    pending.set(id, { resolve: (value) => resolve(value as never), reject });
    const request: DiffParseWorkerRequest = { id, patch };
    instance.postMessage(request);
  });
}
