import type { RuntimeClient } from "@natalia/contracts";

type TerminalHostClient = RuntimeClient & {
  subscribeTerminalOutput?(
    id: string,
    listener: (chunk: string) => void,
  ): () => void;
};
import type { ServerWebSocket } from "bun";
import { credentialSessions, type RuntimeAuthorizationContext } from "./rpc";

export type TerminalWsMessage =
  | { type: "input"; data: string }
  | { type: "resize"; rows: number; cols: number }
  | { type: "close" };

export type TerminalWsServerMessage =
  | { type: "ready"; id: string; rows?: number; cols?: number }
  | { type: "output"; data: string }
  | { type: "exit"; id: string }
  | { type: "error"; message: string };

type TerminalSocketData = {
  sessionID: string;
  terminalID: string;
  authorization?: RuntimeAuthorizationContext;
  unsubscribe?: () => void;
};

const TERMINAL_PATH = /^\/terminal\/([^/]+)\/([^/]+)$/u;

export function matchTerminalPath(pathname: string) {
  const match = pathname.match(TERMINAL_PATH);
  if (!match) return undefined;
  return {
    sessionID: decodeURIComponent(match[1]!),
    terminalID: decodeURIComponent(match[2]!),
  };
}

export function authorizeTerminalSession(
  sessionID: string,
  authorization: RuntimeAuthorizationContext | undefined,
) {
  const allowed = credentialSessions(authorization);
  if (!allowed) return true;
  return allowed.has(sessionID);
}

function send(
  ws: ServerWebSocket<TerminalSocketData>,
  message: TerminalWsServerMessage,
) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

export function terminalWebsocketHandlers(client: TerminalHostClient) {
  return {
    async open(ws: ServerWebSocket<TerminalSocketData>) {
      const { sessionID, terminalID } = ws.data;
      try {
        const listed = await client.nativeTerminalList?.();
        let session = listed?.find((item) => item.id === terminalID);
        if (!session) {
          session = await client.nativeTerminalStart?.({
            command: process.env.SHELL || "bash",
            id: terminalID,
            sessionID,
          });
        }
        if (!session) {
          send(ws, {
            type: "error",
            message: "Native Terminal Host is unavailable",
          });
          ws.close(1011, "terminal unavailable");
          return;
        }
        send(ws, {
          type: "ready",
          id: session.id,
          rows: session.rows,
          cols: session.cols,
        });
        const snapshot = await client.nativeTerminalRead?.(session.id);
        if (snapshot?.text) send(ws, { type: "output", data: snapshot.text });
        if (!client.subscribeTerminalOutput) return;
        ws.data.unsubscribe = client.subscribeTerminalOutput(
          session.id,
          (chunk) => {
            send(ws, { type: "output", data: chunk });
          },
        );
      } catch (error) {
        send(ws, {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
        ws.close(1011, "terminal open failed");
      }
    },
    async message(
      ws: ServerWebSocket<TerminalSocketData>,
      raw: string | Buffer,
    ) {
      let body: TerminalWsMessage;
      try {
        body = JSON.parse(raw.toString()) as TerminalWsMessage;
      } catch {
        send(ws, { type: "error", message: "invalid terminal message" });
        return;
      }
      const { terminalID } = ws.data;
      try {
        if (body.type === "input") {
          if (typeof body.data !== "string") {
            send(ws, { type: "error", message: "input data must be a string" });
            return;
          }
          await client.nativeTerminalWrite?.({
            id: terminalID,
            input: body.data,
          });
          return;
        }
        if (body.type === "resize") {
          if (!Number.isInteger(body.rows) || !Number.isInteger(body.cols)) {
            send(ws, {
              type: "error",
              message: "resize requires integer rows and cols",
            });
            return;
          }
          await client.nativeTerminalResize?.({
            id: terminalID,
            rows: body.rows,
            cols: body.cols,
          });
          return;
        }
        if (body.type === "close") {
          await client.nativeTerminalStop?.(terminalID);
          ws.data.unsubscribe?.();
          send(ws, { type: "exit", id: terminalID });
          ws.close(1000, "closed");
        }
      } catch (error) {
        send(ws, {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    close(ws: ServerWebSocket<TerminalSocketData>) {
      ws.data.unsubscribe?.();
    },
  };
}

export function upgradeTerminalSocket(
  request: Request,
  server: {
    upgrade(
      request: Request,
      options: { data: TerminalSocketData },
    ): boolean;
  },
  authorization: RuntimeAuthorizationContext | undefined,
) {
  const url = new URL(request.url);
  const match = matchTerminalPath(url.pathname);
  if (!match) return undefined;
  if (!authorizeTerminalSession(match.sessionID, authorization)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const upgraded = server.upgrade(request, {
    data: {
      sessionID: match.sessionID,
      terminalID: match.terminalID,
      authorization,
    },
  });
  if (upgraded) return null;
  return Response.json({ error: "upgrade failed" }, { status: 400 });
}

export type { TerminalSocketData };
