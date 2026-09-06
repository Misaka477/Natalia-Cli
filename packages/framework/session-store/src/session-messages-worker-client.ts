import type { RuntimeMessagePage } from "@natalia/contracts";
import type {
  SessionMessagesWorkerRequest,
  SessionMessagesWorkerResponse,
} from "./session-messages.worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  {
    resolve: (page: RuntimeMessagePage) => void;
    reject: (error: Error) => void;
  }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./session-messages.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener(
    "message",
    (event: MessageEvent<SessionMessagesWorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.page);
      else entry.reject(new Error(response.error));
    },
  );
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("session-messages worker failed"));
    pending.clear();
  });
  return worker;
}

export function projectSessionMessagesInWorker(
  session: import("@natalia/session").SessionRecord,
  options: { limit?: number; order?: "asc" | "desc"; cursor?: string },
): Promise<RuntimeMessagePage> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<RuntimeMessagePage>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: SessionMessagesWorkerRequest = { id, session, options };
    instance.postMessage(request);
  });
}
