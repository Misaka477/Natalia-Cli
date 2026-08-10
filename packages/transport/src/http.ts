import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { handleRPCMessage, RPC_WRITE_METHODS } from "./rpc";
import type { RuntimeAuthorizationContext } from "./rpc";
import type { RuntimeCapabilityGroup } from "@natalia/contracts";

export type TaskDeliveryRequest = {
  taskPath: string;
  workspaceRoot?: string;
  json?: boolean;
};

export type TaskDeliveryResult = {
  invocationID: string;
  status: string;
  waterlineAdvanced: boolean;
  exitCode: number;
  /** Lines the controller emitted, so the submitting client can print them. */
  output: string[];
};

/**
 * One credential and what it may do. The grant is expressed in the same terms
 * as the rest of the API: capability groups (the units the availability report
 * already uses) plus a single write dimension. Sessions constrain which
 * sessions' events the credential may subscribe to.
 */
export type RuntimeCredential = {
  token: string;
  write?: boolean;
  groups?: readonly RuntimeCapabilityGroup[];
  sessions?: readonly string[];
};

/**
 * The P0-D policy: default deny. A request without a credential is refused
 * unless `open` is explicitly true (which logs a startup warning), and a
 * credential only reaches what its grant names.
 */
export type RuntimeAuthorizationPolicy = {
  open?: boolean;
  credentials: RuntimeCredential[];
};

export type RuntimeHttpServerOptions = {
  client: RuntimeClient;
  hostname?: string;
  port?: number;
  /**
   * Shorthand for `authorization: { credentials: [{ token, write: true }] }`
   * with `open: false`. Kept for the daemon and existing callers; the full
   * policy is `authorization`.
   */
  token?: string;
  authorization?: RuntimeAuthorizationPolicy;
  unix?: string;
  tls?: { cert: string; key: string };
  events?: boolean;
  /**
   * Runs a task inside this process. The handler is injected because the task
   * controller belongs to the runtime, not to the transport: the transport only
   * carries the delivery.
   */
  runTask?: (request: TaskDeliveryRequest) => Promise<TaskDeliveryResult>;
};

export type RuntimeHttpServer = {
  url: string;
  stop(closeActiveConnections?: boolean): void;
};

/**
 * Resolves a request's credential to an authorization context. Returns
 * `"denied"` when the request must be refused outright (no credential and no
 * open policy, or a token that matches nothing). The refusal is the same for
 * a missing credential and for a wrong one, so a caller cannot tell "no such
 * token" from "no token allowed".
 */
export function resolveAuthorization(
  request: Request,
  policy: RuntimeAuthorizationPolicy | undefined,
  token: string | undefined,
): RuntimeAuthorizationContext | "denied" {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const presented =
    bearer ?? new URL(request.url).searchParams.get("token") ?? undefined;
  if (presented) {
    // The `token` shorthand means one full-write credential — the daemon's
    // token semantics are unchanged; scoped credentials come from the policy.
    const credentials =
      policy?.credentials ?? (token ? [{ token, write: true }] : []);
    const match = credentials.find(
      (candidate) => candidate.token === presented,
    );
    if (!match) return "denied";
    return {
      write: match.write ?? false,
      groups: match.groups
        ? new Set(match.groups as readonly string[])
        : undefined,
      sessions: match.sessions
        ? new Set(match.sessions as readonly string[])
        : undefined,
    };
  }
  if (policy?.open) return { write: true, groups: undefined };
  if (!policy && !token) return { write: true, groups: undefined };
  return "denied";
}

/**
 * The sessions a credential may see events for. Undefined means unrestricted.
 */
export function credentialSessions(
  context: RuntimeAuthorizationContext | undefined,
): ReadonlySet<string> | undefined {
  return (context as { sessions?: ReadonlySet<string> } | undefined)?.sessions;
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

type EventSubscriber = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  /** Session the subscriber asked for; undefined = all sessions (as credentialed). */
  session?: string;
};

/**
 * Whether an event belongs to a subscriber's session. Events carrying an
 * explicit session id belong to that session and no other; events without one
 * are runtime-level and reach every subscriber.
 */
function eventInSession(
  event: RuntimeEvent,
  subscriber: EventSubscriber,
): boolean {
  const own = (event as { sessionID?: unknown }).sessionID;
  if (typeof own !== "string") return true;
  return subscriber.session === undefined || own === subscriber.session;
}

export function createRuntimeHttpServer(
  options: RuntimeHttpServerOptions,
): RuntimeHttpServer {
  const subscribers = new Set<EventSubscriber>();
  const encoder = new TextEncoder();
  const eventBuffer: Array<{ id: number; event: RuntimeEvent }> = [];
  let nextEventID = 1;
  if (options.events !== false)
    options.client.start((event) => {
      const id = nextEventID++;
      eventBuffer.push({ id, event });
      if (eventBuffer.length > 500) eventBuffer.shift();
      for (const subscriber of subscribers) {
        // Session filtering happens here, server-side: a subscriber that asked
        // for session A never sees an event carrying session B, not even its
        // count or type (the acceptance criterion for P0-D).
        if (!eventInSession(event, subscriber)) continue;
        subscriber.controller.enqueue(encodeSSE(encoder, id, event));
      }
    });
  const fetchHandler = async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true });
    const authorization = resolveAuthorization(
      request,
      options.authorization,
      options.token,
    );
    if (authorization === "denied")
      return Response.json({ error: "unauthorized" }, { status: 401 });
    if (url.pathname === "/tasks/run") {
      if (request.method !== "POST")
        return Response.json({ error: "method not allowed" }, { status: 405 });
      if (!options.runTask)
        return Response.json(
          { error: "task delivery is not enabled" },
          { status: 404 },
        );
      let payload: TaskDeliveryRequest;
      try {
        payload = (await request.json()) as TaskDeliveryRequest;
      } catch {
        return Response.json(
          { error: "invalid request body" },
          { status: 400 },
        );
      }
      if (!payload?.taskPath)
        return Response.json(
          { error: "taskPath is required" },
          { status: 400 },
        );
      try {
        return Response.json(await options.runTask(payload));
      } catch (error) {
        return Response.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 422 },
        );
      }
    }
    if (url.pathname === "/events" && options.events === false)
      return Response.json({ error: "event stream disabled" }, { status: 404 });
    if (url.pathname === "/events" && request.method === "GET") {
      const requestedSession = url.searchParams.get("session") ?? undefined;
      const allowedSessions = credentialSessions(authorization);
      // A credential with a session grant may only subscribe to sessions it
      // names — the subscription itself is checked, not the data.
      if (
        requestedSession &&
        allowedSessions &&
        !allowedSessions.has(requestedSession)
      )
        return Response.json({ error: "forbidden" }, { status: 403 });
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      const subscriber: EventSubscriber = {
        controller:
          null as unknown as ReadableStreamDefaultController<Uint8Array>,
        session: requestedSession,
      };
      return new Response(
        new ReadableStream({
          start(nextController) {
            controller = nextController;
            subscriber.controller = nextController;
            subscribers.add(subscriber);
            controller.enqueue(encoder.encode(SSE_PREAMBLE));
            const marker =
              request.headers.get("last-event-id") ??
              url.searchParams.get("since");
            const since = marker === null ? undefined : Number(marker);
            const replay = (
              items:
                | Array<{ id: number; event: RuntimeEvent }>
                | Array<{ seq: number; event: RuntimeEvent }>,
            ) => {
              for (const item of items) {
                if (!eventInSession(item.event, subscriber)) continue;
                controller?.enqueue(
                  encodeSSE(
                    encoder,
                    "seq" in item ? item.seq : item.id,
                    item.event,
                  ),
                );
              }
            };
            if (
              typeof since === "number" &&
              Number.isInteger(since) &&
              since >= 0 &&
              options.client.history
            ) {
              void options.client
                .history({ after: since, limit: 500 })
                .then((history) => replay(history.events))
                .catch((error) => {
                  controller?.enqueue(
                    encodeSSE(encoder, 0, {
                      type: "diagnostic",
                      level: "warning",
                      message: `event history replay failed: ${error instanceof Error ? error.message : String(error)}`,
                    }),
                  );
                });
              return;
            }
            replay(replayEvents(eventBuffer, request));
          },
          cancel() {
            subscribers.delete(subscriber);
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        { status: 400 },
      );
    }
    const result = await handleRPCMessage(
      body,
      options.client,
      request.signal,
      authorization,
    );
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
