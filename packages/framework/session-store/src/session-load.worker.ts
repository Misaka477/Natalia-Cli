import { parentPort } from "node:worker_threads";
import { Database } from "bun:sqlite";

export type SessionLoadWorkerRequest =
  | {
      id: number;
      op: "events";
      dbPath: string;
      sessionID: string;
    }
  | {
      id: number;
      op: "messagePage";
      dbPath: string;
      sessionID: string;
      options: { limit?: number; order?: "asc" | "desc"; cursor?: string };
    };

export type SessionLoadWorkerResponse =
  | {
      id: number;
      ok: true;
      events: import("@natalia/contracts").RuntimeEvent[];
    }
  | {
      id: number;
      ok: true;
      page: import("@natalia/contracts").RuntimeMessagePage;
    }
  | { id: number; ok: false; error: string };

const port = parentPort;
if (!port) throw new Error("session-load worker requires parentPort");

port.on("message", async (request: SessionLoadWorkerRequest) => {
  try {
    if (request.op === "messagePage") {
      const { SqliteSessionStore } = await import("@natalia/session");
      const store = new SqliteSessionStore(request.dbPath);
      try {
        const page = store.loadMessagePage(
          request.sessionID as import("@natalia/contracts").SessionID,
          request.options,
        );
        const response: SessionLoadWorkerResponse = {
          id: request.id,
          ok: true,
          page,
        };
        port.postMessage(response);
      } finally {
        store.close();
      }
      return;
    }
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
    } finally {
      db?.close();
    }
  } catch (error) {
    const response: SessionLoadWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    port.postMessage(response);
  }
});

export {};
