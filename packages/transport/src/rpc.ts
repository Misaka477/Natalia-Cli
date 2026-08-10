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
  RuntimeRefusal,
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

/**
 * The route table: every JSON-RPC method this transport serves, and the
 * `RuntimeClient` member behind it. This is the single fact source for
 * per-channel reachability — the availability report intersects what the
 * runtime implements with this table, so "I can call it" is computed from the
 * dispatch code itself and cannot drift from it. A test scans this file and
 * fails when a route block appears without a row here, or a row has no block.
 */
export const RPC_ROUTE_MEMBERS = {
  prompt: "submit",
  cancel: "cancel",
  snapshot: "snapshot",
  "approval.respond": "respondApproval",
  "question.respond": "respondQuestion",
  "interactive.pending": "pendingInteractive",
  "session.history": "history",
  "session.messages": "messages",
  pause: "pause",
  resume: "resume",
  "config.canReload": "canReloadConfig",
  "config.reload": "reloadConfig",
  "config.update": "updateConfig",
  "agent.list": "agents",
  "agent.select": "selectAgent",
  "model.catalog": "modelCatalog",
  "model.selection": "modelSelection",
  "model.select": "selectModel",
  "skills.list": "skills",
  "workspace.files": "workspaceFiles",
  "workspace.search": "workspaceSearch",
  "workspace.list": "workspaceList",
  "workspace.read": "workspaceRead",
  "workspace.glob": "workspaceGlob",
  "checkpoint.list": "checkpointList",
  "checkpoint.preview": "checkpointPreview",
  "checkpoint.rollback": "checkpointRollback",
  "sandbox.list": "sandboxList",
  "sandbox.diff": "sandboxDiff",
  "sandbox.resources": "sandboxResources",
  "sandbox.resource.output": "sandboxResourceOutput",
  "sandbox.merge": "sandboxMerge",
  "sandbox.delete": "sandboxDelete",
  "sandbox.resource.stop": "sandboxResourceStop",
  "session.list": "sessionList",
  "session.touch": "sessionTouch",
  "session.rename": "sessionRename",
  "session.pin": "sessionPin",
  "session.duplicate": "sessionDuplicate",
  "session.fork": "sessionFork",
  "session.delete": "sessionDelete",
  "session.new": "sessionNew",
  "session.archive": "sessionArchive",
  "session.export": "sessionExport",
  "mcp.catalog": "mcpCatalog",
  "mcp.prompt": "getMcpPrompt",
  "mcp.resource": "readMcpResource",
  "mcp.server.add": "mcpServerAdd",
  "mcp.server.remove": "mcpServerRemove",
  "permission.list": "permissionList",
  "permission.save": "permissionSave",
  "permission.delete": "permissionDelete",
  "agent.create": "agentCreate",
  "agent.update": "agentUpdate",
  "agent.delete": "agentDelete",
  "provider.discover": "providerDiscover",
  "provider.add": "providerAdd",
  "provider.remove": "providerRemove",
  "plugin.unload": "pluginUnload",
  "plugin.reload": "pluginReload",
  "plugin.list": "plugins",
  "command.catalog": "commandCatalog",
  "task.overview": "taskOverview",
  "flow.overview": "flowOverview",
  "document.catalog": "documentCatalog",
  "runtime.availability": null,
  "runtime.status": "runtimeStatus",
  "diagnostics.list": "diagnostics",
  "workgraph.nodes": "workGraphNodes",
  "workgraph.edges": "workGraphEdges",
  // --- P0-C: the reachability gap closed (audit list in the API plan §8.10) ---
  "nativeTerminal.list": "nativeTerminalList",
  "nativeTerminal.read": "nativeTerminalRead",
  "nativeTerminal.stop": "nativeTerminalStop",
  "nativeTerminal.openHub": "nativeTerminalOpenHub",
  "nativeTerminal.revokeApprovalScope": "nativeTerminalRevokeApprovalScope",
  "nativeTerminal.releaseHumanControl": "nativeTerminalReleaseHumanControl",
  "nativeTerminal.beginSecureInput": "nativeTerminalBeginSecureInput",
  "nativeTerminal.endSecureInput": "nativeTerminalEndSecureInput",
  "nativeTerminal.start": "nativeTerminalStart",
  "nativeTerminal.write": "nativeTerminalWrite",
  "nativeTerminal.resize": "nativeTerminalResize",
  "constitution.rules": "constitutionRules",
  "decision.records": "decisionRecords",
  "evidence.records": "evidenceRecords",
  "drift.findings": "driftFindings",
  "tools.registered": "registeredTools",
  capabilities: "capabilities",
  "session.snapshot": "sessionSnapshot",
  "submit.input": "submitInput",
  // P0-G: the flow write surface, previously CLI-only.
  "flow.save": "saveFlowDocument",
  "flow.delete": "deleteFlowDocument",
  "task.preview": "taskPermissionPreview",
} as const satisfies Readonly<Record<string, keyof RuntimeClient | null>>;

/**
 * Members a remote caller must not reach, and why. These are routed *away* on
 * purpose: a member here is reported as `implemented_unreachable` with this
 * reason, so the availability report distinguishes "forgotten" from
 * "intentionally local" — the P0-C invariant is that every unreachable member
 * has a row in this table or does not exist on the runtime.
 */
export const RPC_INTENTIONALLY_LOCAL: Readonly<Record<string, string>> = {
  dispose:
    "intentionally local: a remote caller must not dispose another party's runtime",
  start:
    "intentionally local: remote consumers subscribe to /events instead of calling start",
  lastSubmission:
    "intentionally local: a local read of the most recent submission",
  diagnostic:
    "intentionally local: one-way publishing from a local caller, not a query",
};

/** The member names this transport routes. `null` rows (availability itself) excluded. */
export const RPC_ROUTED_MEMBERS: ReadonlySet<string> = new Set(
  (Object.values(RPC_ROUTE_MEMBERS) as Array<string | null>).filter(
    (member): member is string => typeof member === "string",
  ),
);

/**
 * The write surface, as route names. A credential without the `write`
 * dimension may call anything not on this list and nothing on it. The list is
 * code and is pinned by a test: removing an entry makes a write reachable by a
 * read-only credential, which fails.
 *
 * The xterm-era terminal writes are gone with the line that hosted them; the
 * live write surface is submissions, turn control, approvals, config,
 * checkpoints, sandboxes, session management and the native terminal controls
 * (whose security note from P0-C still stands: ending a human's secure input
 * remotely is a write of the strongest kind).
 */
export const RPC_WRITE_METHODS: ReadonlySet<string> = new Set([
  "prompt",
  "cancel",
  "submit.input",
  "approval.respond",
  "question.respond",
  "pause",
  "resume",
  "agent.select",
  "model.select",
  "config.reload",
  "config.update",
  "checkpoint.rollback",
  "sandbox.merge",
  "sandbox.delete",
  "sandbox.resource.stop",
  "session.touch",
  "session.rename",
  "session.pin",
  "session.duplicate",
  "session.fork",
  "session.delete",
  "session.new",
  "session.archive",
  "mcp.server.add",
  "mcp.server.remove",
  "permission.save",
  "permission.delete",
  "agent.create",
  "agent.update",
  "agent.delete",
  "provider.add",
  "provider.remove",
  "plugin.unload",
  "plugin.reload",
  "nativeTerminal.stop",
  "nativeTerminal.revokeApprovalScope",
  "nativeTerminal.releaseHumanControl",
  "nativeTerminal.beginSecureInput",
  "nativeTerminal.endSecureInput",
  "nativeTerminal.openHub",
  "nativeTerminal.start",
  "nativeTerminal.write",
  "nativeTerminal.resize",
  "flow.save",
  "flow.delete",
]);

/**
 * Who is calling, resolved by the transport from the credential. Absent means
 * an unrestricted in-process caller (or an explicitly opened server).
 */
export type RuntimeAuthorizationContext = {
  /** May the caller use the write surface? */
  write: boolean;
  /** Capability groups the caller may reach; absent = every group. */
  groups?: ReadonlySet<string>;
  /** Sessions the caller may subscribe events for; absent = unrestricted. */
  sessions?: ReadonlySet<string>;
};

/**
 * Whether a route is inside the caller's grant. Checked before the route
 * table, so a credential that cannot call a method gets `-32001 refused`
 * whether or not the method exists — an authorization error must not double
 * as an existence probe.
 */
export function isAuthorized(
  context: RuntimeAuthorizationContext | undefined,
  method: string,
): boolean {
  if (!context) return true;
  if (!context.write && RPC_WRITE_METHODS.has(method)) return false;
  if (context.groups) {
    const member = (RPC_ROUTE_MEMBERS as Record<string, string | null>)[method];
    const group =
      typeof member === "string" ? capabilityGroupOf(member) : undefined;
    if (group && !context.groups.has(group)) return false;
  }
  return true;
}

/**
 * The reason a granted-but-denied call should carry. Kept separate from
 * `isAuthorized` so the refusal path can name the rule that fired.
 */
export function authorizationRefusalReason(
  context: RuntimeAuthorizationContext,
  method: string,
): string {
  if (!context.write && RPC_WRITE_METHODS.has(method))
    return "authorization refused: this credential has no write scope";
  const member = (RPC_ROUTE_MEMBERS as Record<string, string | null>)[method];
  const group =
    typeof member === "string" ? capabilityGroupOf(member) : undefined;
  if (group && context.groups && !context.groups.has(group))
    return `authorization refused: this credential has no access to the ${group} group`;
  return "authorization refused";
}

/**
 * A report the caller can act on: reachable members outside the credential's
 * grant are marked unreachable with an authorization reason, never with "not
 * implemented". The report must not over-promise to a read-only integration —
 * the same mistake G2 made, at a different layer.
 */
export function cullAvailabilityReport(
  report: import("@natalia/contracts").RuntimeCapabilityReport,
  authorization: RuntimeAuthorizationContext | undefined,
): import("@natalia/contracts").RuntimeCapabilityReport {
  if (!authorization || !report.channel) return report;
  const cullMember = (
    member: import("@natalia/contracts").ChannelCapabilityMember,
  ) => {
    if (member.state !== "implemented_reachable") return member;
    const method = Object.keys(RPC_ROUTE_MEMBERS).find(
      (name) =>
        (RPC_ROUTE_MEMBERS as Record<string, string | null>)[name] ===
        member.member,
    );
    if (!method) return member;
    if (!isAuthorized(authorization, method))
      return {
        ...member,
        state: "implemented_unreachable" as const,
        reason: authorizationRefusalReason(authorization, method),
      };
    return member;
  };
  return {
    ...report,
    channel: {
      ...report.channel,
      groups: report.channel.groups.map((group) => {
        const members = group.members.map(cullMember);
        const reachable = members.every(
          (member) => member.state === "implemented_reachable",
        );
        const unreachableCount = members.filter(
          (member) => member.state === "implemented_unreachable",
        ).length;
        return {
          ...group,
          members,
          reachable,
          partial: unreachableCount > 0 && unreachableCount < members.length,
        };
      }),
      requiredMembers: report.channel.requiredMembers.map(cullMember),
    },
  };
}

export async function handleRPCMessage(
  raw: unknown,
  client: RuntimeClient,
  signal?: AbortSignal,
  authorization?: RuntimeAuthorizationContext,
): Promise<RPCResponse> {
  const request =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as RPCRequest)
      : undefined;
  try {
    if (!request) throw new RuntimeInvalidRequest();
    const body = request;
    // Authorization before existence: a credential outside its grant gets
    // `-32001 refused` whether or not the method exists, so an authorization
    // error can never be used to probe the surface.
    if (body.method && !isAuthorized(authorization, body.method))
      throw new RuntimeRefusal(
        authorizationRefusalReason(authorization!, body.method),
      );
    // The route table is the authority for what a method is: a name with no row
    // here is `-32601 method not found`, before any dispatch block runs. The
    // table also feeds the availability report, so reachability is computed from
    // the same fact.
    if (!(body.method && body.method in RPC_ROUTE_MEMBERS))
      throw new RuntimeMethodNotFound(body.method ?? "");
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
      // The runtime's answer, not an assumption. This route used to reply
      // `paused: true` even when nothing was running and the runtime had done
      // nothing at all.
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.pause(
          typeof body.params?.reason === "string"
            ? body.params.reason
            : undefined,
        ),
      };
    }
    if (body.method === "resume") {
      optionsGuard(client, "resume");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.resume(),
      };
    }
    if (body.method === "agent.select") {
      optionsGuard(client, "selectAgent");
      const name = body.params?.name;
      if (name !== undefined && typeof name !== "string")
        throw invalidParams("agent.select.params.name must be a string");
      // Reports whether the selection applied, was deferred to the end of the
      // running turn, or was rejected — all three happen, and the old reply
      // claimed the first one every time.
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.selectAgent(name),
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
      // An answer to a request that already timed out is dropped by the runtime,
      // and an external UI has to be told: it used to get `responded: true`.
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.respondApproval({
          requestID,
          decision: decision as "once" | "session" | "reject",
          feedback:
            typeof body.params?.feedback === "string"
              ? body.params.feedback
              : undefined,
        }),
      };
    }
    if (body.method === "question.respond") {
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.respondQuestion({
          requestID: stringParam(body.params, "requestID"),
          answers: arrayParam(body.params, "answers"),
          rejected: Boolean(body.params?.rejected),
        }),
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
    if (body.method === "session.new") {
      optionsGuard(client, "sessionNew");
      const params = body.params;
      const id =
        params &&
        typeof params === "object" &&
        typeof (params as { id?: unknown }).id === "string"
          ? (params as { id: string }).id
          : undefined;
      const title =
        params &&
        typeof params === "object" &&
        typeof (params as { title?: unknown }).title === "string"
          ? (params as { title: string }).title
          : undefined;
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionNew?.({ id, title }),
      };
    }
    if (body.method === "session.archive") {
      optionsGuard(client, "sessionArchive");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionArchive(stringParam(body.params, "id")),
      };
    }
    if (body.method === "session.export") {
      optionsGuard(client, "sessionExport");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionExport(stringParam(body.params, "id")),
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
    // --- P0-C: native terminal host ---
    // Secure-input control and human-control release are authorization
    // semantics: ending a human's secure input remotely is as strong as writing
    // to the terminal. P0-D must scope them; until then they are routed but a
    // no-host runtime refuses them anyway.
    if (body.method === "nativeTerminal.list") {
      optionsGuard(client, "nativeTerminalList");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalList(),
      };
    }
    if (body.method === "nativeTerminal.read") {
      optionsGuard(client, "nativeTerminalRead");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalRead(stringParam(body.params, "id")),
      };
    }
    if (body.method === "nativeTerminal.stop") {
      optionsGuard(client, "nativeTerminalStop");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalStop(stringParam(body.params, "id")),
      };
    }
    if (body.method === "nativeTerminal.openHub") {
      optionsGuard(client, "nativeTerminalOpenHub");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalOpenHub(),
      };
    }
    if (body.method === "nativeTerminal.revokeApprovalScope") {
      optionsGuard(client, "nativeTerminalRevokeApprovalScope");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalRevokeApprovalScope(
          stringParam(body.params, "id"),
        ),
      };
    }
    if (body.method === "nativeTerminal.releaseHumanControl") {
      optionsGuard(client, "nativeTerminalReleaseHumanControl");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalReleaseHumanControl(
          stringParam(body.params, "id"),
        ),
      };
    }
    if (body.method === "nativeTerminal.beginSecureInput") {
      optionsGuard(client, "nativeTerminalBeginSecureInput");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalBeginSecureInput(
          stringParam(body.params, "id"),
        ),
      };
    }
    if (body.method === "nativeTerminal.endSecureInput") {
      optionsGuard(client, "nativeTerminalEndSecureInput");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalEndSecureInput(
          stringParam(body.params, "id"),
        ),
      };
    }
    // --- P0-H: the terminal write surface (host-gated, see http.ts) ---
    if (body.method === "nativeTerminal.start") {
      optionsGuard(client, "nativeTerminalStart");
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("nativeTerminal.start.params must be an object");
      const command = (params as { command?: unknown }).command;
      if (typeof command !== "string" || !command)
        throw invalidParams(
          "nativeTerminal.start.params.command must be a non-empty string",
        );
      const cwd =
        typeof (params as { cwd?: unknown }).cwd === "string"
          ? (params as { cwd: string }).cwd
          : undefined;
      const id =
        typeof (params as { id?: unknown }).id === "string"
          ? (params as { id: string }).id
          : undefined;
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalStart?.({ command, cwd, id }),
      };
    }
    if (body.method === "nativeTerminal.write") {
      optionsGuard(client, "nativeTerminalWrite");
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("nativeTerminal.write.params must be an object");
      const id = (params as { id?: unknown }).id;
      const input = (params as { input?: unknown }).input;
      if (typeof id !== "string" || !id)
        throw invalidParams(
          "nativeTerminal.write.params.id must be a non-empty string",
        );
      if (typeof input !== "string")
        throw invalidParams(
          "nativeTerminal.write.params.input must be a string",
        );
      const idempotencyKey =
        typeof (params as { idempotencyKey?: unknown }).idempotencyKey ===
        "string"
          ? (params as { idempotencyKey: string }).idempotencyKey
          : undefined;
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalWrite?.({
          id,
          input,
          idempotencyKey,
        }),
      };
    }
    if (body.method === "nativeTerminal.resize") {
      optionsGuard(client, "nativeTerminalResize");
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("nativeTerminal.resize.params must be an object");
      const id = (params as { id?: unknown }).id;
      const rows = (params as { rows?: unknown }).rows;
      const cols = (params as { cols?: unknown }).cols;
      if (typeof id !== "string" || !id)
        throw invalidParams(
          "nativeTerminal.resize.params.id must be a non-empty string",
        );
      if (typeof rows !== "number" || !Number.isInteger(rows))
        throw invalidParams(
          "nativeTerminal.resize.params.rows must be an integer",
        );
      if (typeof cols !== "number" || !Number.isInteger(cols))
        throw invalidParams(
          "nativeTerminal.resize.params.cols must be an integer",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.nativeTerminalResize?.({ id, rows, cols }),
      };
    }
    // --- P0-C: intelligence queries and capability records ---
    // These exist on the runtime, are routed now, and answer with nothing
    // until there are writers — the report says so via `unimplemented`.
    if (body.method === "constitution.rules") {
      optionsGuard(client, "constitutionRules");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.constitutionRules(),
      };
    }
    if (body.method === "decision.records") {
      optionsGuard(client, "decisionRecords");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.decisionRecords(),
      };
    }
    if (body.method === "evidence.records") {
      optionsGuard(client, "evidenceRecords");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.evidenceRecords(),
      };
    }
    if (body.method === "drift.findings") {
      optionsGuard(client, "driftFindings");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.driftFindings(),
      };
    }
    if (body.method === "tools.registered") {
      optionsGuard(client, "registeredTools");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.registeredTools(),
      };
    }
    if (body.method === "capabilities") {
      optionsGuard(client, "capabilities");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.capabilities(),
      };
    }
    if (body.method === "session.snapshot") {
      optionsGuard(client, "sessionSnapshot");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionSnapshot(),
      };
    }
    // --- P0-G follow-up: the config write surface (previously TUI-only) ---
    if (body.method === "config.update") {
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("config.update.params must be an object");
      const patch = (params as { patch?: unknown }).patch;
      if (!patch || typeof patch !== "object" || Array.isArray(patch))
        throw invalidParams("config.update.params.patch must be an object");
      const scope = (params as { scope?: unknown }).scope;
      if (scope !== undefined && scope !== "project" && scope !== "global")
        throw invalidParams(
          'config.update.params.scope must be "project" or "global"',
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.updateConfig?.({
          patch: patch as Record<string, unknown>,
          scope: scope as "project" | "global" | undefined,
        }),
      };
    }
    // --- P0-G follow-up: task document validation (previously CLI-only) ---
    if (body.method === "task.preview") {
      const path = stringParam(body.params, "path");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.taskPermissionPreview?.({ path }),
      };
    }
    // --- P0-G: flow document writes (previously CLI-only) ---
    if (body.method === "flow.save") {
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("flow.save.params must be an object");
      const document = (params as { document?: unknown }).document;
      if (!document || typeof document !== "object")
        throw invalidParams("flow.save.params.document must be an object");
      const path =
        typeof (params as { path?: unknown }).path === "string"
          ? (params as { path: string }).path
          : undefined;
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.saveFlowDocument?.({
          path,
          document: document as never,
        }),
      };
    }
    if (body.method === "flow.delete") {
      const path = stringParam(body.params, "path");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.deleteFlowDocument?.({ path }),
      };
    }
    // --- P0-C: submission with attachments, resources and agent mentions ---
    if (body.method === "submit.input") {
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("submit.input.params must be an object");
      if (typeof params.text !== "string")
        throw invalidParams("submit.input.params.text must be a string");
      const input = params as Record<string, unknown>;
      for (const field of ["attachments", "resources", "agents"] as const) {
        const value = input[field];
        if (value !== undefined && !Array.isArray(value))
          throw invalidParams(`submit.input.params.${field} must be an array`);
      }
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.submitInput?.(input as never),
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
      //
      // The report carries the RPC channel's own reachability: what the runtime
      // implements intersected with the route table above. A consumer can now
      // tell "this runtime cannot" from "this connection cannot reach it" — the
      // `terminal`/`terminalSharing` retirement and the P0-B gap list both show
      // up here before any code outside this package does.
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: cullAvailabilityReport(
          describeRuntimeCapabilities(client, {
            name: "rpc",
            routedMembers: RPC_ROUTED_MEMBERS,
            // Members routed away on purpose keep their reason, so the report
            // distinguishes "forgotten" from "intentionally local".
            unreachableReasons: RPC_INTENTIONALLY_LOCAL,
          }),
          authorization,
        ),
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
    if (body.method === "mcp.server.add") {
      optionsGuard(client, "mcpServerAdd");
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("mcp.server.add.params must be an object");
      const name = (params as { name?: unknown }).name;
      const config = (params as { config?: unknown }).config;
      if (typeof name !== "string" || !name)
        throw invalidParams(
          "mcp.server.add.params.name must be a non-empty string",
        );
      if (!config || typeof config !== "object")
        throw invalidParams("mcp.server.add.params.config must be an object");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.mcpServerAdd?.({
          name,
          config: config as never,
        }),
      };
    }
    if (body.method === "mcp.server.remove") {
      optionsGuard(client, "mcpServerRemove");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.mcpServerRemove(stringParam(body.params, "name")),
      };
    }
    if (body.method === "permission.list") {
      optionsGuard(client, "permissionList");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.permissionList?.(),
      };
    }
    if (body.method === "permission.save") {
      optionsGuard(client, "permissionSave");
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("permission.save.params must be an object");
      const name = (params as { name?: unknown }).name;
      const profile = (params as { profile?: unknown }).profile;
      if (typeof name !== "string" || !name)
        throw invalidParams(
          "permission.save.params.name must be a non-empty string",
        );
      if (!profile || typeof profile !== "object")
        throw invalidParams("permission.save.params.profile must be an object");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.permissionSave?.({
          name,
          profile: profile as never,
        }),
      };
    }
    if (body.method === "permission.delete") {
      optionsGuard(client, "permissionDelete");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.permissionDelete(stringParam(body.params, "name")),
      };
    }
    // --- P0-K: agent, provider and plugin management ---
    const managementName = (params: unknown, method: string) => {
      const value = (params as { name?: unknown })?.name;
      if (typeof value !== "string" || !value)
        throw invalidParams(`${method}.params.name must be a non-empty string`);
      return value;
    };
    const managementObject = (params: unknown, method: string) => {
      const value = (params as { config?: unknown })?.config;
      if (!value || typeof value !== "object")
        throw invalidParams(`${method}.params.config must be an object`);
      return value as never;
    };
    if (body.method === "agent.create" || body.method === "agent.update") {
      const member =
        body.method === "agent.create" ? "agentCreate" : "agentUpdate";
      optionsGuard(client, member);
      const name = managementName(body.params, body.method);
      const config = managementObject(body.params, body.method);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result:
          body.method === "agent.create"
            ? await client.agentCreate?.({ name, config })
            : await client.agentUpdate?.({ name, config }),
      };
    }
    if (body.method === "agent.delete") {
      optionsGuard(client, "agentDelete");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.agentDelete(
          managementName(body.params, "agent.delete"),
        ),
      };
    }
    if (body.method === "provider.discover") {
      optionsGuard(client, "providerDiscover");
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("provider.discover.params must be an object");
      const type = (params as { type?: unknown }).type;
      const baseURL = (params as { baseURL?: unknown }).baseURL;
      const apiKey = (params as { apiKey?: unknown }).apiKey;
      if (typeof type !== "string" || !type)
        throw invalidParams(
          "provider.discover.params.type must be a non-empty string",
        );
      if (typeof baseURL !== "string" || !baseURL)
        throw invalidParams(
          "provider.discover.params.baseURL must be a non-empty string",
        );
      if (typeof apiKey !== "string" || !apiKey)
        throw invalidParams(
          "provider.discover.params.apiKey must be a non-empty string",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.providerDiscover?.({ type, baseURL, apiKey }),
      };
    }
    if (body.method === "provider.add") {
      optionsGuard(client, "providerAdd");
      const params = body.params;
      if (!params || typeof params !== "object")
        throw invalidParams("provider.add.params must be an object");
      const name = (params as { name?: unknown }).name;
      const type = (params as { type?: unknown }).type;
      const apiKey = (params as { apiKey?: unknown }).apiKey;
      const baseURL = (params as { baseURL?: unknown }).baseURL;
      if (typeof name !== "string" || !name)
        throw invalidParams(
          "provider.add.params.name must be a non-empty string",
        );
      if (typeof type !== "string" || !type)
        throw invalidParams(
          "provider.add.params.type must be a non-empty string",
        );
      if (typeof apiKey !== "string" || !apiKey)
        throw invalidParams(
          "provider.add.params.apiKey must be a non-empty string",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.providerAdd?.({
          name,
          type,
          apiKey,
          baseURL: typeof baseURL === "string" && baseURL ? baseURL : undefined,
        }),
      };
    }
    if (body.method === "provider.remove") {
      optionsGuard(client, "providerRemove");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.providerRemove(
          managementName(body.params, "provider.remove"),
        ),
      };
    }
    if (body.method === "plugin.unload" || body.method === "plugin.reload") {
      const member =
        body.method === "plugin.unload" ? "pluginUnload" : "pluginReload";
      optionsGuard(client, member);
      const id = managementName(body.params, body.method);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result:
          body.method === "plugin.unload"
            ? await client.pluginUnload?.(id)
            : await client.pluginReload?.(id),
      };
    }
    // A name the route table accepted but no dispatch block serves: the table
    // and the code drifted. `-32601` still, so a consumer gets the same answer
    // it would for a truly unknown name.
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
