import type {
  RuntimeEvent,
  RuntimeMessagePage,
  SessionID,
} from "@natalia/contracts";
import type {
  SessionLoadWorkerRequest,
  SessionLoadWorkerResponse,
} from "./session-load.worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  {
    resolve: (value: RuntimeEvent[] | RuntimeMessagePage) => void;
    reject: (error: Error) => void;
  }
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
      if (response.ok) {
        if ("events" in response) entry.resolve(response.events);
        else entry.resolve(response.page);
      } else entry.reject(new Error(response.error));
    },
  );
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("session-load worker failed"));
    pending.clear();
  });
  return worker;
}

type SessionLoadWorkerTask =
  | { op: "events"; dbPath: string; sessionID: string }
  | {
      op: "messagePage";
      dbPath: string;
      sessionID: SessionID;
      options: { limit?: number; order?: "asc" | "desc"; cursor?: string };
    };

async function run<T>(request: SessionLoadWorkerTask): Promise<T> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    instance.postMessage({ ...request, id } as SessionLoadWorkerRequest);
  });
}

export function loadSessionEventsInWorker(
  dbPath: string,
  sessionID: string,
): Promise<RuntimeEvent[]> {
  return run<RuntimeEvent[]>({ op: "events", dbPath, sessionID });
}

export function loadMessagePageInWorker(
  dbPath: string,
  sessionID: SessionID,
  options: { limit?: number; order?: "asc" | "desc"; cursor?: string },
): Promise<RuntimeMessagePage> {
  return run<RuntimeMessagePage>({
    op: "messagePage",
    dbPath,
    sessionID,
    options,
  });
}
