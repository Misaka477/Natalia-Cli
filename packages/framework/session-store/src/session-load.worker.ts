import { parentPort } from "node:worker_threads";
import { Database } from "bun:sqlite";

export type SessionLoadWorkerRequest = {
  id: number;
  dbPath: string;
  sessionID: string;
};

export type SessionLoadWorkerResponse =
  | {
      id: number;
      ok: true;
      events: import("@natalia/contracts").RuntimeEvent[];
    }
  | { id: number; ok: false; error: string };

const port = parentPort;
if (!port) throw new Error("session-load worker requires parentPort");

port.on("message", (request: SessionLoadWorkerRequest) => {
  let db: Database | undefined;
  try {
    db = new Database(request.dbPath);
    db.exec("PRAGMA query_only=ON");
    const rows = db
      .query(`SELECT event FROM events WHERE session_id = ? ORDER BY seq`)
      .all(request.sessionID) as { event: string }[];
    const events = rows.map(
      (row) =>
        JSON.parse(row.event) as import("@natalia/contracts").RuntimeEvent,
    );
    const response: SessionLoadWorkerResponse = {
      id: request.id,
      ok: true,
      events,
    };
    port.postMessage(response);
  } catch (error) {
    const response: SessionLoadWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    port.postMessage(response);
  } finally {
    db?.close();
  }
});

export {};
