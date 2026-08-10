/**
 * Server side of the runtime RPC protocol: it decides what a failure *is*.
 *
 * Every failure here used to collapse into `-32602` with a message, which told a
 * remote consumer nothing it could act on. Now each failure leaves as one of five
 * kinds (`@natalia/contracts` `failures.ts`), classified from typed errors rather
 * than from message text:
 *
 *   - a name with no route            -> `-32601`, with the method
 *   - a route whose member is absent  -> `-32000`, with the member and its capability
 *   - bad arguments                   -> `-32602`, and only that
 *   - policy or state says no         -> `-32001`, with a reason
 *   - anything else                   -> `-32603`, with an ID and no detail
 *
 * The last one is deliberate: an unclassified error's message can contain an
 * absolute path, a command line or a secret, so it is replaced with an ID and the
 * detail is published as a durable diagnostic. A caller authorized to read
 * diagnostics can still get it from `diagnostics.list`; the RPC reply cannot leak
 * it to a caller who is not.
 */
import {
  RuntimeInvalidParams,
  RuntimeInvalidRequest,
  RuntimeMethodNotFound,
  RuntimeNotSupported,
  RUNTIME_RPC_ERROR_CODES,
  capabilityGroupOf,
  describeRuntimeCapabilities,
  runtimeFailureData,
} from "@natalia/contracts";
import type { RuntimeClient, RuntimeFailureData } from "@natalia/contracts";
import type { RPCRequest, RPCResponse } from "./rpc-client";

/**
 * Every param check in this file goes through here, so "the caller sent the wrong
 * thing" can never again be indistinguishable from "the runtime broke".
 */
function invalidParams(message: string): Error {
  return new RuntimeInvalidParams(message);
}

export function stringParam(
  params: Record<string, unknown> | undefined,
  name: string,
): string {
  const value = params?.[name];
  if (typeof value !== "string")
    throw invalidParams(`${name} must be a string`);
  return value;
}

function optionalStringParam(
  params: Record<string, unknown> | undefined,
  name: string,
) {
  const value = params?.[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw invalidParams(`${name} must be a string`);
  return value;
}

export function arrayParam(
  params: Record<string, unknown> | undefined,
  name: string,
): string[][] {
  const value = params?.[name];
  if (!Array.isArray(value) || !value.every((item) => Array.isArray(item)))
    throw invalidParams(`${name} must be an array of arrays`);
  return value.map((item) => item.map((entry) => String(entry)));
}

/** Members the contract marks optional, i.e. the ones a runtime may not have. */
type OptionalRuntimeMember = {
  [K in keyof RuntimeClient]-?: undefined extends RuntimeClient[K] ? K : never;
}[keyof RuntimeClient];

/**
 * The route exists but this runtime does not implement the member behind it.
 * That is `-32000 not supported`, never `-32602`: the caller's arguments were
 * fine and changing them will not help. The capability group travels with it so
 * a consumer can hide the whole group in one step.
 */
function requireMember<K extends OptionalRuntimeMember>(
  client: RuntimeClient,
  member: K,
): NonNullable<RuntimeClient[K]> {
  const value = client[member];
  if (typeof value !== "function")
    throw new RuntimeNotSupported(member, capabilityGroupOf(member));
  return value as NonNullable<RuntimeClient[K]>;
}

/** `requireMember` as a narrowing assertion, for the routes that call `client.x()`. */
function optionsGuard<K extends OptionalRuntimeMember>(
  client: RuntimeClient,
  member: K,
): asserts client is RuntimeClient & Required<Pick<RuntimeClient, K>> {
  requireMember(client, member);
}

export async function handleRPCMessage(
  raw: unknown,
  client: RuntimeClient,
  signal?: AbortSignal,
): Promise<RPCResponse> {
  const request =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as RPCRequest)
      : undefined;
  try {
    if (!request) throw new RuntimeInvalidRequest();
    const body = request;
    if (request.method === "prompt") {
      const text = request.params?.text;
      if (typeof text !== "string")
        throw invalidParams("prompt.params.text must be a string");
      const delivery = request.params?.delivery;
      if (
        delivery !== undefined &&
        delivery !== "steer" &&
        delivery !== "queue"
      )
        throw invalidParams("prompt.params.delivery must be steer or queue");
      const attachments = request.params?.attachments;
      if (
        attachments !== undefined &&
        (!Array.isArray(attachments) ||
          !attachments.every((attachment) => typeof attachment === "string"))
      )
        throw invalidParams(
          "prompt.params.attachments must be an array of strings",
        );
      const resources = request.params?.resources;
      if (
        resources !== undefined &&
        (!Array.isArray(resources) ||
          !resources.every(
            (resource) =>
              resource &&
              typeof resource === "object" &&
              typeof (resource as Record<string, unknown>).server ===
                "string" &&
              typeof (resource as Record<string, unknown>).uri === "string" &&
              typeof (resource as Record<string, unknown>).name === "string",
          ))
      )
        throw invalidParams(
          "prompt.params.resources must be resource mentions",
        );
      const agents = request.params?.agents;
      if (
        agents !== undefined &&
        (!Array.isArray(agents) ||
          !agents.every(
            (agent) =>
              agent &&
              typeof agent === "object" &&
              typeof (agent as Record<string, unknown>).name === "string",
          ))
      )
        throw invalidParams("prompt.params.agents must be agent mentions");
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: client.submitInput
          ? await client.submitInput({
              text,
              delivery,
              attachments: attachments as string[] | undefined,
              resources: resources as
                | import("@natalia/contracts").PromptResourceMention[]
                | undefined,
              agents: agents as
                | import("@natalia/contracts").PromptAgentMention[]
                | undefined,
            })
          : await client.submit(text),
      };
    }
    if (request.method === "cancel") {
      client.cancel(
        typeof request.params?.reason === "string"
          ? request.params.reason
          : undefined,
      );
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: { cancelled: true },
      };
    }
    if (body.method === "pause") {
      optionsGuard(client, "pause");
      client.pause(
        typeof body.params?.reason === "string"
          ? body.params.reason
          : undefined,
      );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { paused: true },
      };
    }
    if (body.method === "resume") {
      optionsGuard(client, "resume");
      client.resume();
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { resumed: true },
      };
    }
    if (body.method === "agent.select") {
      optionsGuard(client, "selectAgent");
      const name = body.params?.name;
      if (name !== undefined && typeof name !== "string")
        throw invalidParams("agent.select.params.name must be a string");
      client.selectAgent(name);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { selected: name ?? null },
      };
    }
    if (body.method === "agent.list") {
      optionsGuard(client, "agents");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.agents(),
      };
    }
    if (body.method === "model.catalog") {
      optionsGuard(client, "modelCatalog");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.modelCatalog(),
      };
    }
    if (body.method === "model.selection") {
      optionsGuard(client, "modelSelection");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.modelSelection(),
      };
    }
    if (body.method === "model.select") {
      optionsGuard(client, "selectModel");
      const modelID = body.params?.modelID;
      const variant = body.params?.variant;
      if (modelID !== undefined && typeof modelID !== "string")
        throw invalidParams("model.select.params.modelID must be a string");
      if (variant !== undefined && typeof variant !== "string")
        throw invalidParams("model.select.params.variant must be a string");
      await client.selectModel(modelID, variant);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { modelID: modelID ?? null, variant: variant ?? null },
      };
    }
    if (body.method === "skills.list") {
      optionsGuard(client, "skills");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.skills(),
      };
    }
    if (body.method === "workspace.files") {
      optionsGuard(client, "workspaceFiles");
      const query = body.params?.query;
      const type = body.params?.type;
      const limit = body.params?.limit;
      if (query !== undefined && typeof query !== "string")
        throw invalidParams("workspace.files.params.query must be a string");
      if (type !== undefined && type !== "file" && type !== "directory")
        throw invalidParams(
          "workspace.files.params.type must be file or directory",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw invalidParams(
          "workspace.files.params.limit must be an integer between 1 and 200",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workspaceFiles({
          query: typeof query === "string" ? query : undefined,
          type: type as "file" | "directory" | undefined,
          limit: typeof limit === "number" ? limit : undefined,
        }),
      };
    }
    if (body.method === "workspace.search") {
      optionsGuard(client, "workspaceSearch");
      const query = stringParam(body.params, "query");
      const include = body.params?.include;
      const limit = body.params?.limit;
      if (include !== undefined && typeof include !== "string")
        throw invalidParams("workspace.search.params.include must be a string");
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw invalidParams(
          "workspace.search.params.limit must be an integer between 1 and 200",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workspaceSearch({
          query,
          include: typeof include === "string" ? include : undefined,
          limit: typeof limit === "number" ? limit : undefined,
        }),
      };
    }
    if (body.method === "workspace.list") {
      optionsGuard(client, "workspaceList");
      const path = body.params?.path;
      const offset = body.params?.offset;
      const limit = body.params?.limit;
      if (path !== undefined && typeof path !== "string")
        throw invalidParams("workspace.list.params.path must be a string");
      if (
        offset !== undefined &&
        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 1)
      )
        throw invalidParams(
          "workspace.list.params.offset must be a positive integer",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw invalidParams(
          "workspace.list.params.limit must be an integer between 1 and 200",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workspaceList({
          path: typeof path === "string" ? path : undefined,
          offset: typeof offset === "number" ? offset : undefined,
          limit: typeof limit === "number" ? limit : undefined,
        }),
      };
    }
    if (body.method === "workspace.read") {
      optionsGuard(client, "workspaceRead");
      const offset = body.params?.offset;
      const limit = body.params?.limit;
      if (
        offset !== undefined &&
        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 1)
      )
        throw invalidParams(
          "workspace.read.params.offset must be a positive integer",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 2000)
      )
        throw invalidParams(
          "workspace.read.params.limit must be an integer between 1 and 2000",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workspaceRead({
          path: stringParam(body.params, "path"),
          offset: typeof offset === "number" ? offset : undefined,
          limit: typeof limit === "number" ? limit : undefined,
        }),
      };
    }
    if (body.method === "workspace.glob") {
      optionsGuard(client, "workspaceGlob");
      const path = body.params?.path;
      const limit = body.params?.limit;
      if (path !== undefined && typeof path !== "string")
        throw invalidParams("workspace.glob.params.path must be a string");
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw invalidParams(
          "workspace.glob.params.limit must be an integer between 1 and 200",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workspaceGlob({
          pattern: stringParam(body.params, "pattern"),
          path: typeof path === "string" ? path : undefined,
          limit: typeof limit === "number" ? limit : undefined,
        }),
      };
    }
    if (body.method === "terminal.list") {
      optionsGuard(client, "terminalList");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalList!(),
      };
    }
    if (body.method === "terminal.read") {
      optionsGuard(client, "terminalRead");
      const offset = body.params?.offset;
      const maxChars = body.params?.maxChars;
      if (
        offset !== undefined &&
        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0)
      )
        throw invalidParams(
          "terminal.read.params.offset must be a non-negative integer",
        );
      if (
        maxChars !== undefined &&
        (typeof maxChars !== "number" ||
          !Number.isInteger(maxChars) ||
          maxChars < 1 ||
          maxChars > 20000)
      )
        throw invalidParams(
          "terminal.read.params.maxChars must be an integer between 1 and 20000",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalRead!({
          id: stringParam(body.params, "id"),
          offset: typeof offset === "number" ? offset : undefined,
          maxChars: typeof maxChars === "number" ? maxChars : undefined,
        }),
      };
    }
    if (body.method === "terminal.observe") {
      optionsGuard(client, "terminalObserve");
      const afterRevision = body.params?.afterRevision;
      const timeoutMs = body.params?.timeoutMs;
      const differential = body.params?.differential;
      if (
        typeof afterRevision !== "number" ||
        !Number.isInteger(afterRevision) ||
        afterRevision < 0
      )
        throw invalidParams(
          "terminal.observe.params.afterRevision must be a non-negative integer",
        );
      if (
        timeoutMs !== undefined &&
        (typeof timeoutMs !== "number" ||
          !Number.isInteger(timeoutMs) ||
          timeoutMs < 0 ||
          timeoutMs > 30000)
      )
        throw invalidParams(
          "terminal.observe.params.timeoutMs must be an integer between 0 and 30000",
        );
      if (differential !== undefined && typeof differential !== "boolean")
        throw invalidParams(
          "terminal.observe.params.differential must be boolean",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalObserve({
          id: stringParam(body.params, "id"),
          afterRevision,
          timeoutMs: typeof timeoutMs === "number" ? timeoutMs : undefined,
          signal,
          differential,
        }),
      };
    }
    if (body.method === "terminal.viewer.register") {
      optionsGuard(client, "terminalViewerRegister");
      const kind = stringParam(body.params, "kind");
      if (kind !== "external" && kind !== "embedded")
        throw invalidParams("terminal.viewer.register.params.kind is invalid");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalViewerRegister({
          id: stringParam(body.params, "id"),
          viewerID: stringParam(body.params, "viewerID"),
          kind,
        }),
      };
    }
    if (body.method === "terminal.viewer.heartbeat") {
      optionsGuard(client, "terminalViewerHeartbeat");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalViewerHeartbeat({
          id: stringParam(body.params, "id"),
          viewerID: stringParam(body.params, "viewerID"),
        }),
      };
    }
    if (body.method === "terminal.viewer.control") {
      optionsGuard(client, "terminalViewerControl");
      const action = stringParam(body.params, "action");
      if (
        ![
          "takeover",
          "take_geometry",
          "release_input",
          "release",
          "unregister",
        ].includes(action)
      )
        throw invalidParams("terminal.viewer.control.params.action is invalid");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalViewerControl({
          id: stringParam(body.params, "id"),
          viewerID: stringParam(body.params, "viewerID"),
          action: action as
            | "takeover"
            | "take_geometry"
            | "release_input"
            | "release"
            | "unregister",
        }),
      };
    }
    if (body.method === "terminal.viewer.write") {
      optionsGuard(client, "terminalViewerWrite");
      if (
        body.params?.sensitive !== undefined &&
        typeof body.params.sensitive !== "boolean"
      )
        throw invalidParams(
          "terminal.viewer.write.params.sensitive must be boolean",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalViewerWrite({
          id: stringParam(body.params, "id"),
          viewerID: stringParam(body.params, "viewerID"),
          data: stringParam(body.params, "data"),
          sensitive:
            typeof body.params?.sensitive === "boolean"
              ? body.params.sensitive
              : undefined,
          idempotencyKey: optionalStringParam(body.params, "idempotencyKey"),
        }),
      };
    }
    if (body.method === "terminal.viewer.resize") {
      optionsGuard(client, "terminalViewerResize");
      const rows = body.params?.rows;
      const cols = body.params?.cols;
      if (
        typeof rows !== "number" ||
        !Number.isInteger(rows) ||
        typeof cols !== "number" ||
        !Number.isInteger(cols)
      )
        throw invalidParams(
          "terminal.viewer.resize.params.rows and cols must be integers",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalViewerResize({
          id: stringParam(body.params, "id"),
          viewerID: stringParam(body.params, "viewerID"),
          rows,
          cols,
        }),
      };
    }
    if (body.method === "terminal.scrollback") {
      optionsGuard(client, "terminalScrollback");
      const offsetFromBottom = body.params?.offsetFromBottom;
      const maxRows = body.params?.maxRows;
      if (
        offsetFromBottom !== undefined &&
        (typeof offsetFromBottom !== "number" ||
          !Number.isInteger(offsetFromBottom) ||
          offsetFromBottom < 0)
      )
        throw invalidParams(
          "terminal.scrollback.params.offsetFromBottom must be a non-negative integer",
        );
      if (
        maxRows !== undefined &&
        (typeof maxRows !== "number" ||
          !Number.isInteger(maxRows) ||
          maxRows < 1 ||
          maxRows > 200)
      )
        throw invalidParams(
          "terminal.scrollback.params.maxRows must be an integer between 1 and 200",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalScrollback({
          id: stringParam(body.params, "id"),
          offsetFromBottom:
            typeof offsetFromBottom === "number" ? offsetFromBottom : undefined,
          maxRows: typeof maxRows === "number" ? maxRows : undefined,
        }),
      };
    }
    if (body.method === "terminal.write") {
      optionsGuard(client, "terminalWrite");
      const submit = body.params?.submit;
      const sensitive = body.params?.sensitive;
      if (submit !== undefined && typeof submit !== "boolean")
        throw invalidParams("terminal.write.params.submit must be a boolean");
      if (sensitive !== undefined && typeof sensitive !== "boolean")
        throw invalidParams(
          "terminal.write.params.sensitive must be a boolean",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalWrite!({
          id: stringParam(body.params, "id"),
          text: stringParam(body.params, "text"),
          submit: typeof submit === "boolean" ? submit : undefined,
          sensitive: typeof sensitive === "boolean" ? sensitive : undefined,
          idempotencyKey: optionalStringParam(body.params, "idempotencyKey"),
        }),
      };
    }
    if (body.method === "terminal.key") {
      optionsGuard(client, "terminalKey");
      const key = stringParam(body.params, "key");
      if (!["enter", "ctrl-c", "ctrl-d", "tab", "esc"].includes(key))
        throw invalidParams("terminal.key.params.key is invalid");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalKey!({
          id: stringParam(body.params, "id"),
          key: key as "enter" | "ctrl-c" | "ctrl-d" | "tab" | "esc",
        }),
      };
    }
    if (body.method === "terminal.resize") {
      optionsGuard(client, "terminalResize");
      const rows = body.params?.rows;
      const cols = body.params?.cols;
      if (
        typeof rows !== "number" ||
        !Number.isInteger(rows) ||
        typeof cols !== "number" ||
        !Number.isInteger(cols)
      )
        throw invalidParams(
          "terminal.resize.params.rows and cols must be integers",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.terminalResize!({
          id: stringParam(body.params, "id"),
          rows,
          cols,
        }),
      };
    }
    if (
      body.method === "terminal.attach" ||
      body.method === "terminal.detach" ||
      body.method === "terminal.stop"
    ) {
      const member =
        body.method === "terminal.attach"
          ? "terminalAttach"
          : body.method === "terminal.detach"
            ? "terminalDetach"
            : "terminalStop";
      const action = requireMember(client, member);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await action(stringParam(body.params, "id")),
      };
    }
    if (body.method === "checkpoint.list") {
      optionsGuard(client, "checkpointList");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.checkpointList(),
      };
    }
    if (body.method === "checkpoint.preview") {
      optionsGuard(client, "checkpointPreview");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.checkpointPreview(stringParam(body.params, "id")),
      };
    }
    if (body.method === "checkpoint.rollback") {
      optionsGuard(client, "checkpointRollback");
      const dryRun = body.params?.dryRun;
      if (dryRun !== undefined && typeof dryRun !== "boolean")
        throw invalidParams(
          "checkpoint.rollback.params.dryRun must be a boolean",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.checkpointRollback({
          id: stringParam(body.params, "id"),
          dryRun: typeof dryRun === "boolean" ? dryRun : undefined,
        }),
      };
    }
    if (body.method === "sandbox.list") {
      optionsGuard(client, "sandboxList");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxList(),
      };
    }
    if (body.method === "sandbox.diff") {
      optionsGuard(client, "sandboxDiff");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxDiff(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.resources") {
      optionsGuard(client, "sandboxResources");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxResources(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.resource.output") {
      optionsGuard(client, "sandboxResourceOutput");
      const maxBytes = body.params?.maxBytes;
      if (
        maxBytes !== undefined &&
        (typeof maxBytes !== "number" ||
          !Number.isInteger(maxBytes) ||
          maxBytes < 1 ||
          maxBytes > 20000)
      )
        throw invalidParams(
          "sandbox.resource.output.params.maxBytes must be an integer between 1 and 20000",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxResourceOutput({
          id: stringParam(body.params, "id"),
          resourceID: stringParam(body.params, "resourceID"),
          maxBytes: typeof maxBytes === "number" ? maxBytes : undefined,
        }),
      };
    }
    if (body.method === "sandbox.merge") {
      optionsGuard(client, "sandboxMerge");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxMerge(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.delete") {
      optionsGuard(client, "sandboxDelete");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxDelete(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.resource.stop") {
      optionsGuard(client, "sandboxResourceStop");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxResourceStop({
          id: stringParam(body.params, "id"),
          resourceID: stringParam(body.params, "resourceID"),
        }),
      };
    }
    if (body.method === "approval.respond") {
      const requestID = stringParam(body.params, "requestID");
      const decision = stringParam(body.params, "decision");
      if (!["once", "session", "reject"].includes(decision))
        throw invalidParams("approval.respond.params.decision is invalid");
      client.respondApproval({
        requestID,
        decision: decision as "once" | "session" | "reject",
        feedback:
          typeof body.params?.feedback === "string"
            ? body.params.feedback
            : undefined,
      });
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { responded: true },
      };
    }
    if (body.method === "question.respond") {
      client.respondQuestion({
        requestID: stringParam(body.params, "requestID"),
        answers: arrayParam(body.params, "answers"),
        rejected: Boolean(body.params?.rejected),
      });
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { responded: true },
      };
    }
    if (body.method === "interactive.pending") {
      optionsGuard(client, "pendingInteractive");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.pendingInteractive(),
      };
    }
    if (body.method === "snapshot")
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: client.snapshot(),
      };
    if (body.method === "session.history") {
      optionsGuard(client, "history");
      const after = body.params?.after;
      const limit = body.params?.limit;
      if (
        after !== undefined &&
        (typeof after !== "number" || !Number.isInteger(after) || after < 0)
      )
        throw invalidParams(
          "session.history.params.after must be a non-negative integer",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 500)
      )
        throw invalidParams(
          "session.history.params.limit must be an integer between 1 and 500",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.history({
          after: typeof after === "number" ? after : undefined,
          limit: typeof limit === "number" ? limit : undefined,
        }),
      };
    }
    if (body.method === "session.messages") {
      optionsGuard(client, "messages");
      const limit = body.params?.limit;
      const order = body.params?.order;
      const cursor = body.params?.cursor;
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw invalidParams(
          "session.messages.params.limit must be an integer between 1 and 200",
        );
      if (order !== undefined && order !== "asc" && order !== "desc")
        throw invalidParams(
          "session.messages.params.order must be asc or desc",
        );
      if (cursor !== undefined && typeof cursor !== "string")
        throw invalidParams("session.messages.params.cursor must be a string");
      if (cursor !== undefined && order !== undefined)
        throw invalidParams(
          "session.messages.params.cursor cannot be combined with order",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.messages({
          limit: typeof limit === "number" ? limit : undefined,
          order: order as "asc" | "desc" | undefined,
          cursor: typeof cursor === "string" ? cursor : undefined,
        }),
      };
    }
    if (body.method === "session.list") {
      optionsGuard(client, "sessionList");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionList(),
      };
    }
    if (body.method === "session.touch") {
      optionsGuard(client, "sessionTouch");
      await client.sessionTouch(stringParam(body.params, "id"));
      return { jsonrpc: "2.0", id: body.id ?? null, result: { touched: true } };
    }
    if (body.method === "session.rename") {
      optionsGuard(client, "sessionRename");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionRename(
          stringParam(body.params, "id"),
          stringParam(body.params, "title"),
        ),
      };
    }
    if (body.method === "session.pin") {
      optionsGuard(client, "sessionPin");
      if (typeof body.params?.pinned !== "boolean")
        throw invalidParams("session.pin.params.pinned must be a boolean");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionPin(
          stringParam(body.params, "id"),
          body.params.pinned,
        ),
      };
    }
    if (body.method === "session.duplicate") {
      optionsGuard(client, "sessionDuplicate");
      const title = body.params?.title;
      if (title !== undefined && typeof title !== "string")
        throw invalidParams("session.duplicate.params.title must be a string");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionDuplicate(
          stringParam(body.params, "id"),
          typeof title === "string" ? title : undefined,
        ),
      };
    }
    if (body.method === "session.fork") {
      optionsGuard(client, "sessionFork");
      const title = body.params?.title;
      if (title !== undefined && typeof title !== "string")
        throw invalidParams("session.fork.params.title must be a string");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionFork(
          stringParam(body.params, "id"),
          stringParam(body.params, "turnID"),
          typeof title === "string" ? title : undefined,
        ),
      };
    }
    if (body.method === "session.delete") {
      optionsGuard(client, "sessionDelete");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionDelete(stringParam(body.params, "id")),
      };
    }
    if (body.method === "mcp.catalog") {
      optionsGuard(client, "mcpCatalog");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.mcpCatalog(),
      };
    }
    if (body.method === "plugin.list") {
      optionsGuard(client, "plugins");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.plugins(),
      };
    }
    if (body.method === "command.catalog") {
      optionsGuard(client, "commandCatalog");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.commandCatalog(),
      };
    }
    if (body.method === "workgraph.nodes") {
      optionsGuard(client, "workGraphNodes");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workGraphNodes(),
      };
    }
    if (body.method === "workgraph.edges") {
      optionsGuard(client, "workGraphEdges");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workGraphEdges(),
      };
    }
    // Unattended work, read-only. These are the routes that let another program
    // inspect scheduled tasks and flows without running the CLI.
    if (body.method === "task.overview") {
      optionsGuard(client, "taskOverview");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.taskOverview(),
      };
    }
    if (body.method === "flow.overview") {
      optionsGuard(client, "flowOverview");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.flowOverview(),
      };
    }
    if (body.method === "document.catalog") {
      optionsGuard(client, "documentCatalog");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.documentCatalog(),
      };
    }
    if (body.method === "config.reload") {
      optionsGuard(client, "reloadConfig");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.reloadConfig!(),
      };
    }
    if (body.method === "config.canReload") {
      optionsGuard(client, "canReloadConfig");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.canReloadConfig!(),
      };
    }
    if (body.method === "runtime.availability") {
      // Derived from the client, so there is deliberately no options guard: this
      // answers "what does this runtime implement", and a runtime that implements
      // little must still be able to say so. Asking the runtime to declare it
      // would let the declaration drift from the code.
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: describeRuntimeCapabilities(client),
      };
    }
    if (body.method === "runtime.status") {
      optionsGuard(client, "runtimeStatus");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.runtimeStatus(),
      };
    }
    if (body.method === "diagnostics.list") {
      optionsGuard(client, "diagnostics");
      const limit = body.params?.limit;
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 500)
      )
        throw invalidParams(
          "diagnostics.list.params.limit must be an integer between 1 and 500",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.diagnostics(
          typeof limit === "number" ? limit : undefined,
        ),
      };
    }
    if (body.method === "mcp.prompt") {
      optionsGuard(client, "getMcpPrompt");
      const arguments_ = body.params?.arguments;
      if (
        arguments_ !== undefined &&
        (!arguments_ ||
          typeof arguments_ !== "object" ||
          Array.isArray(arguments_))
      )
        throw invalidParams("mcp.prompt.params.arguments must be an object");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.getMcpPrompt(
          stringParam(body.params, "server"),
          stringParam(body.params, "name"),
          arguments_ as Record<string, string> | undefined,
        ),
      };
    }
    if (body.method === "mcp.resource") {
      optionsGuard(client, "readMcpResource");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.readMcpResource(
          stringParam(body.params, "server"),
          stringParam(body.params, "uri"),
        ),
      };
    }
    // No route by that name. `-32601`, not `-32602`: a consumer that gets this
    // is talking to a runtime older or newer than it expects, or has a typo —
    // both call for a different reaction than fixing an argument.
    throw new RuntimeMethodNotFound(body.method ?? "");
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request?.id ?? null,
      error: describeFailure(error, client, request?.method),
    };
  }
}

/**
 * Turns a thrown error into a JSON-RPC error object.
 *
 * Classification comes from the typed failure the thrower attached, never from
 * reading its message: matching on prose is how a refusal quietly becomes a bug
 * report the day someone rewords a string.
 *
 * An error with no classification is internal by definition. Its message is
 * dropped rather than forwarded, because at this point we do not know what is in
 * it — `ENOENT: ... stat '/home/someone/project/secret'` is a real example. The
 * detail is published as a durable diagnostic under an ID that travels with the
 * error, so whoever can read `diagnostics.list` can still find it.
 */
function describeFailure(
  error: unknown,
  client: RuntimeClient,
  method: string | undefined,
): { code: number; message: string; data: RuntimeFailureData } {
  const classified = runtimeFailureData(error);
  if (classified)
    return {
      code: RUNTIME_RPC_ERROR_CODES[classified.kind],
      message: error instanceof Error ? error.message : String(error),
      data: classified,
    };
  const message = error instanceof Error ? error.message : String(error);
  const errorID = `err_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  // Reporting a failure must not be able to fail. `diagnostic` is required by the
  // contract, but this path runs for clients that are wrong about that, and a
  // throw here would replace the caller's answer with a broken connection. The
  // reply is the same either way; only the durable copy of the detail is lost.
  try {
    client.diagnostic(
      `rpc ${method ?? "request"} failed [${errorID}]: ${message}`,
      "error",
    );
  } catch {
    /* a runtime that cannot record its own failure still owes the caller a reply */
  }
  return {
    code: RUNTIME_RPC_ERROR_CODES.internal,
    message: "internal runtime failure",
    data: { kind: "internal", errorID },
  };
}
