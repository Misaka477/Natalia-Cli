import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { handleRPCMessage } from "./rpc";

export type RuntimeHttpServerOptions = {
  client: RuntimeClient;
  hostname?: string;
  port?: number;
  token?: string;
  unix?: string;
  tls?: { cert: string; key: string };
};

export type RuntimeHttpServer = {
  url: string;
  stop(closeActiveConnections?: boolean): void;
};

function authorized(request: Request, token: string | undefined): boolean {
  if (!token) return true;
  return request.headers.get("authorization") === `Bearer ${token}`;
}

function replayEvents(
  events: Array<{ id: number; event: RuntimeEvent }>,
  request: Request,
) {
  const url = new URL(request.url);
  const marker =
    request.headers.get("last-event-id") ?? url.searchParams.get("since");
  if (marker === null) return [];
  const since = Number(marker);
  if (!Number.isFinite(since) || since < 0) return [];
  return events.filter((event) => event.id > since);
}

const SSE_PREAMBLE = ": natalia runtime events\n\n";

function encodeSSE(encoder: TextEncoder, id: number, event: RuntimeEvent) {
  return encoder.encode(
    `id: ${id}\nevent: runtime\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

export function createRuntimeHttpServer(
  options: RuntimeHttpServerOptions,
): RuntimeHttpServer {
  const subscribers = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();
  const eventBuffer: Array<{ id: number; event: RuntimeEvent }> = [];
  let nextEventID = 1;
  options.client.start((event) => {
    const id = nextEventID++;
    eventBuffer.push({ id, event });
    if (eventBuffer.length > 500) eventBuffer.shift();
    const payload = encodeSSE(encoder, id, event);
    for (const subscriber of subscribers) subscriber.enqueue(payload);
  });
  const fetchHandler = async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true });
    if (!authorized(request, options.token))
      return Response.json({ error: "unauthorized" }, { status: 401 });
    if (url.pathname === "/events" && request.method === "GET") {
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      return new Response(
        new ReadableStream({
          start(nextController) {
            controller = nextController;
            subscribers.add(controller);
            controller.enqueue(encoder.encode(SSE_PREAMBLE));
            const marker = request.headers.get("last-event-id") ?? url.searchParams.get("since");
            const since = marker === null ? undefined : Number(marker);
            const replay = (items: Array<{ id: number; event: RuntimeEvent }> | Array<{ seq: number; event: RuntimeEvent }>) => {
              for (const item of items)
                controller?.enqueue(
                  encodeSSE(
                    encoder,
                    "seq" in item ? item.seq : item.id,
                    item.event,
                  ),
                );
            };
            if (typeof since === "number" && Number.isInteger(since) && since >= 0 && options.client.history) {
              void options.client.history({ after: since, limit: 500 }).then((history) => replay(history.events));
              return;
            }
            replay(replayEvents(eventBuffer, request));
          },
          cancel() {
            if (controller) subscribers.delete(controller);
          },
        }),
        {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          },
        },
      );
    }
    if (url.pathname !== "/rpc" || request.method !== "POST")
      return Response.json({ error: "not found" }, { status: 404 });
    const body = await request.json();
    const result = await handleRPCMessage(body, options.client);
    if (result.error) return Response.json(result, { status: 400 });
    return Response.json(result);
  };
  const server = options.unix
    ? Bun.serve({ unix: options.unix, fetch: fetchHandler })
    : options.tls
      ? Bun.serve({
          hostname: options.hostname ?? "127.0.0.1",
          port: options.port ?? 0,
          tls: options.tls,
          fetch: fetchHandler,
        })
      : Bun.serve({
          hostname: options.hostname ?? "127.0.0.1",
          port: options.port ?? 0,
          fetch: fetchHandler,
        });
  return {
    url: options.unix
      ? `unix://${options.unix}`
      : `${options.tls ? "https" : "http"}://${server.hostname}:${server.port}`,
    stop: server.stop.bind(server),
  };
}
