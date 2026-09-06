import type { SessionProjection } from "@natalia/session";
import type {
  RuntimeEvent,
  RuntimeMessagePage,
} from "@natalia/contracts";
import type {
  SessionProjectWorkerRequest,
  SessionProjectWorkerResponse,
} from "./session-project.worker";

type SessionProjectTask =
  | {
      op: "project";
      session: import("@natalia/session").SessionRecord;
    }
  | {
      op: "messages";
      session: import("@natalia/session").SessionRecord;
      options: { limit?: number; order?: "asc" | "desc"; cursor?: string };
    }
  | {
      op: "canonicalTools";
      events: RuntimeEvent[];
    }
  | {
      op: "projection";
      name:
        | "planDocs"
        | "evidenceRecords"
        | "constitutionRules"
        | "decisionRecords"
        | "workGraphNodes"
        | "workGraphEdges"
        | "mailboxMessages"
        | "collabMessages";
      events: RuntimeEvent[];
    };

let worker: Worker | undefined;
let nextID = 1;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./session-project.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener(
    "message",
    (event: MessageEvent<SessionProjectWorkerResponse>) => {
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
      reject(new Error("session-project worker failed"));
    pending.clear();
  });
  return worker;
}

async function run<T>(
  request: SessionProjectTask,
): Promise<T> {
  const id = nextID++;
  const instance = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    instance.postMessage({ ...request, id } as SessionProjectWorkerRequest);
  });
}

export function projectSessionInWorker(
  session: import("@natalia/session").SessionRecord,
): Promise<SessionProjection> {
  return run<SessionProjection>({ op: "project", session });
}

export function projectSessionMessagesInWorker(
  session: import("@natalia/session").SessionRecord,
  options: { limit?: number; order?: "asc" | "desc"; cursor?: string },
): Promise<RuntimeMessagePage> {
  return run<RuntimeMessagePage>({ op: "messages", session, options });
}

export function projectedCanonicalToolsInWorker(
  events: RuntimeEvent[],
): Promise<unknown> {
  return run<unknown>({ op: "canonicalTools", events });
}

export function runSessionProjectionInWorker(
  name:
    | "planDocs"
    | "evidenceRecords"
    | "constitutionRules"
    | "decisionRecords"
    | "workGraphNodes"
    | "workGraphEdges"
    | "mailboxMessages"
    | "collabMessages",
  events: RuntimeEvent[],
): Promise<unknown> {
  return run<unknown>({ op: "projection", name, events });
}
