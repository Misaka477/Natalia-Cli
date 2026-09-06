import type { SyntaxPart } from "./syntax";
import type { SyntaxWorkerRequest, SyntaxWorkerResponse } from "./syntax-worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  {
    resolve: (parts: SyntaxPart[]) => void;
    reject: (error: Error) => void;
  }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./syntax-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (event: MessageEvent<SyntaxWorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.parts);
    else entry.reject(new Error(response.error));
  });
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("syntax worker failed"));
    pending.clear();
  });
  return worker;
}

export function highlightInWorker(
  text: string,
  language?: string,
): Promise<SyntaxPart[]> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<SyntaxPart[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: SyntaxWorkerRequest = { id, text, language };
    instance.postMessage(request);
  });
}

export function highlightInWorkerBatch(
  lines: Array<{ text: string; language?: string }>,
): Promise<SyntaxPart[][]> {
  return Promise.all(
    lines.map(({ text, language }) => highlightInWorker(text, language)),
  );
}
