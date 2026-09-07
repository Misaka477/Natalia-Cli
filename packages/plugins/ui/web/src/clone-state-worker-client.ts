import type { AppState } from "@natalia/view-store";
import type {
  CloneStateWorkerRequest,
  CloneStateWorkerResponse,
} from "./clone-state.worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  { resolve: (state: AppState) => void; reject: (error: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./clone-state.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener(
    "message",
    (event: MessageEvent<CloneStateWorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.state);
      else entry.reject(new Error(response.error));
    },
  );
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("clone-state worker failed"));
    pending.clear();
  });
  return worker;
}

export function cloneStateInWorker(state: AppState): Promise<AppState> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<AppState>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: CloneStateWorkerRequest = { id, state };
    instance.postMessage(request);
  });
}
