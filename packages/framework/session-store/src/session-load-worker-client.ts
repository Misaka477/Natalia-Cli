import type { RuntimeEvent } from "@natalia/contracts";
import type {
  SessionLoadWorkerRequest,
  SessionLoadWorkerResponse,
} from "./session-load.worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  { resolve: (value: RuntimeEvent[]) => void; reject: (error: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./session-load.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener(
    "message",
    (event: MessageEvent<SessionLoadWorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.events);
      else entry.reject(new Error(response.error));
    },
  );
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("session-load worker failed"));
    pending.clear();
  });
  return worker;
}

export function loadSessionEventsInWorker(
  dbPath: string,
  sessionID: string,
): Promise<RuntimeEvent[]> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<RuntimeEvent[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: SessionLoadWorkerRequest = { id, dbPath, sessionID };
    instance.postMessage(request);
  });
}
