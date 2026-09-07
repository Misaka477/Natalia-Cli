import type { ConfigV3 } from "@natalia/contracts";
import type {
  SecondaryWorkerRequest,
  SecondaryWorkerResponse,
} from "./secondary.worker";

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./secondary.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener(
    "message",
    (event: MessageEvent<SecondaryWorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.result);
      else entry.reject(new Error(response.error));
    },
  );
  worker.addEventListener("error", () => {
    for (const { reject } of pending.values())
      reject(new Error("secondary worker failed"));
    pending.clear();
  });
  return worker;
}

type SecondaryWorkerTask =
  | { op: "configClone"; config: ConfigV3 }
  | { op: "pluginList"; plugins: unknown[] };

async function run<T>(request: SecondaryWorkerTask): Promise<T> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    instance.postMessage({ ...request, id } as SecondaryWorkerRequest);
  });
}

export function cloneConfigInWorker(config: ConfigV3): Promise<ConfigV3> {
  return run<ConfigV3>({ op: "configClone", config });
}

export function projectPluginsInWorker(plugins: unknown[]): Promise<
  Array<{
    id: string;
    version: string;
    name: string;
    description: string;
    capabilities: string[];
  }>
> {
  return run({
    op: "pluginList",
    plugins,
  });
}
