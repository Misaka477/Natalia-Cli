import { parentPort } from "node:worker_threads";
import { patchToStructured, countPatch } from "../structured-parse";

export type DiffParseWorkerRequest = {
  id: number;
  patch: string;
};

export type DiffParseWorkerResponse =
  | {
      id: number;
      ok: true;
      result: {
        counts: { additions: number; deletions: number };
        structured: ReturnType<typeof patchToStructured>;
      };
    }
  | { id: number; ok: false; error: string };

const port = parentPort;
if (!port) throw new Error("diff-parse worker requires parentPort");

port.on("message", (request: DiffParseWorkerRequest) => {
  try {
    const counts = countPatch(request.patch);
    const structured = patchToStructured(request.patch);
    const response: DiffParseWorkerResponse = {
      id: request.id,
      ok: true,
      result: { counts, structured },
    };
    port.postMessage(response);
  } catch (error) {
    const response: DiffParseWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    port.postMessage(response);
  }
});

export {};
