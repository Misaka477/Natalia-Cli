import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import type { ServerWebSocket } from "bun";
import { handleRPCMessage, type RPCRequest } from "./rpc";

export type RuntimeWsServerOptions = {
  client: RuntimeClient;
  hostname?: string;
  port?: number;
  token?: string;
};

export type RuntimeWsServer = {
  url: string;
  stop(closeActiveConnections?: boolean): void;
};

function authorized(request: Request, token: string | undefined): boolean {
  if (!token) return true;
  if (request.headers.get("authorization") === `Bearer ${token}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("token") === token) return true;
  return false;
}

function eventPayload(id: number, event: RuntimeEvent): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    method: "event",
    params: { id, event },
  });
}

export function createRuntimeWsServer(
  options: RuntimeWsServerOptions,
): RuntimeWsServer {
  const clients = new Set<ServerWebSocket<undefined>>();
  const eventBuffer: Array<{ id: number; event: RuntimeEvent }> = [];
  let nextEventID = 1;

  options.client.start((event) => {
    const id = nextEventID++;
    eventBuffer.push({ id, event });
    if (eventBuffer.length > 500) eventBuffer.shift();
    const payload = eventPayload(id, event);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  });

  const server = Bun.serve({
    hostname: options.hostname ?? "127.0.0.1",
    port: options.port ?? 0,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/healthz") return Response.json({ ok: true });
      if (!authorized(req, options.token))
        return Response.json({ error: "unauthorized" }, { status: 401 });
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (upgraded) return undefined;
      }
      return Response.json({ error: "not found" }, { status: 404 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
        for (const { id, event } of eventBuffer) {
          ws.send(eventPayload(id, event));
        }
      },
      async message(ws, raw) {
        let body: RPCRequest;
        try {
          body = JSON.parse(raw.toString());
        } catch {
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" },
            }),
          );
          return;
        }
        const result = await handleRPCMessage(body, options.client);
        ws.send(JSON.stringify(result));
      },
      close(ws) {
        clients.delete(ws);
      },
      drain(_ws) {
        /* Bun manages backpressure internally */
      },
    },
  });

  return {
    url: `ws://${server.hostname}:${server.port}`,
    stop(closeConnections) {
      if (closeConnections) {
        for (const ws of clients) {
          ws.close(1001, "Server shutting down");
        }
        clients.clear();
      }
      server.stop();
    },
  };
}
