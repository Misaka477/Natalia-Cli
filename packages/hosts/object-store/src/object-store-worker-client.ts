import type { MaintenanceWorkerRequest, MaintenanceWorkerResponse } from "./maintenance.worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  {
    resolve: (result: MaintenanceWorkerResponse extends { result: infer R } ? R : never) => void;
    reject: (error: Error) => void;
  }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./maintenance.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (event: MessageEvent<MaintenanceWorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.result as never);
    else entry.reject(new Error(response.error));
  });
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("object-store worker failed"));
    pending.clear();
  });
  return worker;
}

export function runObjectStoreMaintenance<T>(
  request: Omit<MaintenanceWorkerRequest, "id">,
): Promise<T> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (result) => resolve(result as T),
      reject,
    });
    instance.postMessage({ ...request, id } as MaintenanceWorkerRequest);
  });
}
