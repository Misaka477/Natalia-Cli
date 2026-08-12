import { API_VERSION } from "@natalia/contracts";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { handleRPCMessage, RPC_WRITE_METHODS } from "./rpc";
import type { RuntimeAuthorizationContext } from "./rpc";
import type { RuntimeCapabilityGroup } from "@natalia/contracts";

export type TaskDeliveryRequest = {
  taskPath?: string;
  taskID?: string;
  workspaceRoot?: string;
  json?: boolean;
  /** Return 202 after admission instead of waiting for the terminal task result. */
  wait?: boolean;
  /** Replays the same admitted execution instead of starting it twice. */
  idempotencyKey?: string;
};

export type TaskExecutionHandle = {
  executionID: string;
  events: AsyncIterable<Record<string, unknown>>;
  result: Promise<Omit<TaskDeliveryResult, "output" | "executionID">>;
  cancel(reason?: string): void;
};

export type TaskDeliveryResult = {
  executionID?: string;
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
   * Gates the P0-H terminal write surface (`nativeTerminal.start` /
   * `nativeTerminal.write` / `nativeTerminal.resize`). Default is `false`:
   * without it those three routes answer `-32001 refused` — remote terminal
   * write is remote shell, so it must be an explicit deployment decision,
   * exactly like `runTask`.
   */
  terminalWrite?: boolean;
  /** Explicit deployment opt-in for remote workflow execution. */
  taskExecution?: boolean;
  /**
   * Runs a task inside this process. The handler is injected because the task
   * controller belongs to the runtime, not to the transport: the transport only
   * carries the delivery.
   */
  runTask?: (request: TaskDeliveryRequest) => Promise<TaskDeliveryResult>;
  startTask?: (
    request: TaskDeliveryRequest,
  ) => TaskExecutionHandle | Promise<TaskExecutionHandle>;
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
const TASK_EXECUTION_RECORD_LIMIT = 100;
const TASK_EXECUTION_EVENT_LIMIT = 500;
const TASK_EXECUTION_OUTPUT_LIMIT = 500;

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
  const taskExecutions = new Map<
    string,
    {
      status: "running" | "completed" | "failed" | "cancelled";
      events: Record<string, unknown>[];
      result?: Omit<TaskDeliveryResult, "output">;
      error?: string;
    }
  >();
  const taskExecutionHandles = new Map<string, TaskExecutionHandle>();
  const taskExecutionIdempotency = new Map<
    string,
    { fingerprint: string; executionID: string }
  >();
  let taskExecutionReservations = 0;
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
    if (url.pathname === "/healthz")
      return Response.json({ ok: true, apiVersion: API_VERSION });
    const authorization = resolveAuthorization(
      request,
      options.authorization,
      options.token,
    );
    if (authorization === "denied")
      return Response.json({ error: "unauthorized" }, { status: 401 });
    const executionMatch = url.pathname.match(
      /^\/tasks\/executions\/([^/]+)(?:\/(events|cancel))?$/u,
    );
    if (executionMatch && executionMatch[2] === "cancel") {
      if (request.method !== "POST")
        return Response.json({ error: "method not allowed" }, { status: 405 });
      if (!authorization.write)
        return refused(
          "authorization refused: this credential has no write scope",
        );
      if (authorization.groups && !authorization.groups.has("automation"))
        return refused(
          "authorization refused: this credential has no access to the automation group",
        );
      if (!options.taskExecution)
        return refused("task execution is not enabled by this host");
      const handle = taskExecutionHandles.get(executionMatch[1] ?? "");
      if (!handle)
        return Response.json(
          { error: "active execution not found" },
          { status: 404 },
        );
      handle.cancel("remote workflow cancellation");
      return Response.json({
        executionID: executionMatch[1],
        cancelling: true,
      });
    }
    if (executionMatch && request.method === "GET") {
      if (authorization.groups && !authorization.groups.has("automation"))
        return refused(
          "authorization refused: this credential has no access to the automation group",
        );
      const execution = taskExecutions.get(executionMatch[1] ?? "");
      if (!execution)
        return Response.json({ error: "execution not found" }, { status: 404 });
      return Response.json(
        executionMatch[2] === "events"
          ? { executionID: executionMatch[1], events: execution.events }
          : { executionID: executionMatch[1], ...execution },
      );
    }
    if (url.pathname === "/tasks/run") {
      if (request.method !== "POST")
        return Response.json({ error: "method not allowed" }, { status: 405 });
      if (!authorization.write)
        return refused(
          "authorization refused: this credential has no write scope",
        );
      if (authorization.groups && !authorization.groups.has("automation"))
        return refused(
          "authorization refused: this credential has no access to the automation group",
        );
      if (!options.taskExecution)
        return refused("task execution is not enabled by this host");
      if (!options.startTask && !options.runTask)
        return Response.json(
          { error: "task execution is unavailable" },
          { status: 503 },
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
      if (Boolean(payload?.taskPath) === Boolean(payload?.taskID))
        return Response.json(
          { error: "exactly one taskPath or taskID is required" },
          { status: 400 },
        );
      try {
        const idempotencyKey =
          request.headers.get("idempotency-key") ?? payload.idempotencyKey;
        const fingerprint = JSON.stringify({
          ...payload,
          wait: undefined,
          idempotencyKey: undefined,
        });
        if (idempotencyKey) {
          const existing = taskExecutionIdempotency.get(idempotencyKey);
          if (existing) {
            if (existing.fingerprint !== fingerprint)
              return Response.json(
                { error: "idempotency key was reused with different request" },
                { status: 409 },
              );
            const record = taskExecutions.get(existing.executionID);
            if (record)
              return Response.json(
                { executionID: existing.executionID, status: record.status },
                { status: 202 },
              );
          }
          payload.idempotencyKey = idempotencyKey;
        }
        if (!options.startTask)
          return Response.json(await options.runTask!(payload));
        if (
          taskExecutions.size + taskExecutionReservations >=
          TASK_EXECUTION_RECORD_LIMIT
        ) {
          const terminal = [...taskExecutions].find(
            ([, execution]) => execution.status !== "running",
          );
          if (terminal) taskExecutions.delete(terminal[0]);
          else
            return Response.json(
              { error: "task execution observation capacity is full" },
              { status: 503 },
            );
        }
        taskExecutionReservations += 1;
        let handle: TaskExecutionHandle;
        try {
          handle = await options.startTask(payload);
        } finally {
          taskExecutionReservations -= 1;
        }
        if (taskExecutions.has(handle.executionID)) {
          handle.cancel("duplicate workflow execution ID");
          return Response.json(
            { error: "workflow execution ID is already being observed" },
            { status: 409 },
          );
        }
        const record: {
          status: "running" | "completed" | "failed" | "cancelled";
          events: Record<string, unknown>[];
          result?: Omit<TaskDeliveryResult, "output">;
          error?: string;
        } = {
          status: "running",
          events: [],
        };
        taskExecutions.set(handle.executionID, record);
        taskExecutionHandles.set(handle.executionID, handle);
        if (idempotencyKey)
          taskExecutionIdempotency.set(idempotencyKey, {
            fingerprint,
            executionID: handle.executionID,
          });
        const output: string[] = [];
        const pump = (async () => {
          for await (const event of handle.events) {
            record.events.push(event);
            if (record.events.length > TASK_EXECUTION_EVENT_LIMIT)
              record.events.shift();
            if (event.type === "workflow.execution") {
              if (event.status === "cancelled") record.status = "cancelled";
              else if (event.status === "failed") record.status = "failed";
              else if (event.status === "completed")
                record.status = "completed";
            }
            if (
              event.type === "workflow.execution.output" &&
              typeof event.line === "string"
            )
              output.push(event.line);
            if (output.length > TASK_EXECUTION_OUTPUT_LIMIT) output.shift();
          }
        })();
        const settle = async () => {
          try {
            const result = await handle.result;
            await pump;
            const completed = { ...result, executionID: handle.executionID };
            Object.assign(record, { status: "completed", result: completed });
            return { ...completed, output };
          } catch (error) {
            await pump;
            Object.assign(record, {
              status: record.status === "cancelled" ? "cancelled" : "failed",
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          } finally {
            taskExecutionHandles.delete(handle.executionID);
          }
        };
        if (payload.wait === false) {
          void settle().catch(() => undefined);
          return Response.json(
            { executionID: handle.executionID, status: "running" },
            { status: 202 },
          );
        }
        try {
          return Response.json(await settle());
        } catch (error) {
          throw error;
        }
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
    // P0-H: the terminal write surface is gated here, at the deployment layer,
    // like /tasks/run. The routes exist and are writes; without the explicit
    // `terminalWrite: true` option they answer refused, so a host that never
    // opted in cannot be reached remotely through a terminal write. A caller
    // without write scope is left to the authorization layer ("no write
    // scope"): the gate answers only for callers who would otherwise get
    // through.
    const method = (body as { method?: unknown })?.method;
    if (
      typeof method === "string" &&
      (method === "nativeTerminal.start" ||
        method === "nativeTerminal.write" ||
        method === "nativeTerminal.resize") &&
      !options.terminalWrite &&
      authorization?.write !== false
    ) {
      return Response.json(
        {
          jsonrpc: "2.0",
          id: (body as { id?: unknown })?.id ?? null,
          error: {
            code: -32001,
            message: "terminal write is not enabled by this host",
            data: {
              kind: "refused",
              reason: "terminal write is not enabled by this host",
            },
          },
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
  // Bun's default idle timeout is 10s, which would kill an SSE subscription
  // that goes quiet — the runtime's default is to stay silent until it has
  // something to say. A quiet event stream must outlive a quiet terminal.
  // Bun's default idle timeout is 10s, which would kill an SSE subscription
  // that goes quiet — the runtime's default is to stay silent until it has
  // something to say. A quiet event stream must outlive a quiet terminal.
  // `idleTimeout` exists at runtime (Bun 1.3.14) but is missing from the
  // published bun-types; the cast carries it without losing the rest.
  const serveOptions = (base: Parameters<typeof Bun.serve>[0]) =>
    ({ ...base, idleTimeout: 255 }) as Parameters<typeof Bun.serve>[0];
  const server = options.unix
    ? Bun.serve(serveOptions({ unix: options.unix, fetch: fetchHandler }))
    : options.tls
      ? Bun.serve(
          serveOptions({
            hostname: options.hostname ?? "127.0.0.1",
            port: options.port ?? 0,
            tls: options.tls,
            fetch: fetchHandler,
          }),
        )
      : Bun.serve(
          serveOptions({
            hostname: options.hostname ?? "127.0.0.1",
            port: options.port ?? 0,
            fetch: fetchHandler,
          }),
        );
  return {
    url: options.unix
      ? `unix://${options.unix}`
      : `${options.tls ? "https" : "http"}://${server.hostname}:${server.port}`,
    stop(closeActiveConnections?: boolean) {
      for (const handle of taskExecutionHandles.values())
        handle.cancel("HTTP runtime server stopped");
      server.stop(closeActiveConnections);
    },
  };
}

function refused(reason: string) {
  return Response.json(
    { error: reason, kind: "refused", reason },
    { status: 403 },
  );
}
