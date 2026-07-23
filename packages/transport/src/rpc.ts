import type { RuntimeClient } from "@natalia/contracts";

export type RPCRequest = {
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export type RPCResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

export function stringParam(
  params: Record<string, unknown> | undefined,
  name: string,
): string {
  const value = params?.[name];
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

export function arrayParam(
  params: Record<string, unknown> | undefined,
  name: string,
): string[][] {
  const value = params?.[name];
  if (!Array.isArray(value) || !value.every((item) => Array.isArray(item)))
    throw new Error(`${name} must be an array of arrays`);
  return value.map((item) => item.map((entry) => String(entry)));
}

function optionsGuard<T>(
  value: T | undefined,
  method: string,
): asserts value is T {
  if (!value) throw new Error(`RuntimeClient does not support ${method}`);
}

export async function handleRPCMessage(
  raw: unknown,
  client: RuntimeClient,
): Promise<RPCResponse> {
  const request =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as RPCRequest)
      : undefined;
  try {
    if (!request) throw new Error("Invalid Request");
    const body = request;
    if (request.method === "prompt") {
      const text = request.params?.text;
      if (typeof text !== "string")
        throw new Error("prompt.params.text must be a string");
      const delivery = request.params?.delivery;
      if (
        delivery !== undefined &&
        delivery !== "steer" &&
        delivery !== "queue"
      )
        throw new Error("prompt.params.delivery must be steer or queue");
      const attachments = request.params?.attachments;
      if (
        attachments !== undefined &&
        (!Array.isArray(attachments) ||
          !attachments.every((attachment) => typeof attachment === "string"))
      )
        throw new Error(
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
        throw new Error("prompt.params.resources must be resource mentions");
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
        throw new Error("prompt.params.agents must be agent mentions");
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
      optionsGuard(client.pause, "pause");
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
      optionsGuard(client.resume, "resume");
      client.resume();
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { resumed: true },
      };
    }
    if (body.method === "agent.select") {
      optionsGuard(client.selectAgent, "agent.select");
      const name = body.params?.name;
      if (name !== undefined && typeof name !== "string")
        throw new Error("agent.select.params.name must be a string");
      client.selectAgent(name);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { selected: name ?? null },
      };
    }
    if (body.method === "agent.list") {
      optionsGuard(client.agents, "agent.list");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.agents(),
      };
    }
    if (body.method === "model.catalog") {
      optionsGuard(client.modelCatalog, "model.catalog");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.modelCatalog(),
      };
    }
    if (body.method === "model.selection") {
      optionsGuard(client.modelSelection, "model.selection");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.modelSelection(),
      };
    }
    if (body.method === "model.select") {
      optionsGuard(client.selectModel, "model.select");
      const modelID = body.params?.modelID;
      const variant = body.params?.variant;
      if (modelID !== undefined && typeof modelID !== "string")
        throw new Error("model.select.params.modelID must be a string");
      if (variant !== undefined && typeof variant !== "string")
        throw new Error("model.select.params.variant must be a string");
      await client.selectModel(modelID, variant);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: { modelID: modelID ?? null, variant: variant ?? null },
      };
    }
    if (body.method === "skills.list") {
      optionsGuard(client.skills, "skills.list");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.skills(),
      };
    }
    if (body.method === "workspace.files") {
      optionsGuard(client.workspaceFiles, "workspace.files");
      const query = body.params?.query;
      const type = body.params?.type;
      const limit = body.params?.limit;
      if (query !== undefined && typeof query !== "string")
        throw new Error("workspace.files.params.query must be a string");
      if (type !== undefined && type !== "file" && type !== "directory")
        throw new Error(
          "workspace.files.params.type must be file or directory",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw new Error(
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
      optionsGuard(client.workspaceSearch, "workspace.search");
      const query = stringParam(body.params, "query");
      const include = body.params?.include;
      const limit = body.params?.limit;
      if (include !== undefined && typeof include !== "string")
        throw new Error("workspace.search.params.include must be a string");
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw new Error(
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
      optionsGuard(client.workspaceList, "workspace.list");
      const path = body.params?.path;
      const offset = body.params?.offset;
      const limit = body.params?.limit;
      if (path !== undefined && typeof path !== "string")
        throw new Error("workspace.list.params.path must be a string");
      if (
        offset !== undefined &&
        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 1)
      )
        throw new Error(
          "workspace.list.params.offset must be a positive integer",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw new Error(
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
      optionsGuard(client.workspaceRead, "workspace.read");
      const offset = body.params?.offset;
      const limit = body.params?.limit;
      if (
        offset !== undefined &&
        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 1)
      )
        throw new Error(
          "workspace.read.params.offset must be a positive integer",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 2000)
      )
        throw new Error(
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
      optionsGuard(client.workspaceGlob, "workspace.glob");
      const path = body.params?.path;
      const limit = body.params?.limit;
      if (path !== undefined && typeof path !== "string")
        throw new Error("workspace.glob.params.path must be a string");
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 200)
      )
        throw new Error(
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
    if (body.method === "pty.list") {
      optionsGuard(client.ptyList, "pty.list");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.ptyList(),
      };
    }
    if (body.method === "pty.read") {
      optionsGuard(client.ptyRead, "pty.read");
      const offset = body.params?.offset;
      const maxChars = body.params?.maxChars;
      if (
        offset !== undefined &&
        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0)
      )
        throw new Error(
          "pty.read.params.offset must be a non-negative integer",
        );
      if (
        maxChars !== undefined &&
        (typeof maxChars !== "number" ||
          !Number.isInteger(maxChars) ||
          maxChars < 1 ||
          maxChars > 20000)
      )
        throw new Error(
          "pty.read.params.maxChars must be an integer between 1 and 20000",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.ptyRead({
          id: stringParam(body.params, "id"),
          offset: typeof offset === "number" ? offset : undefined,
          maxChars: typeof maxChars === "number" ? maxChars : undefined,
        }),
      };
    }
    if (body.method === "pty.write") {
      optionsGuard(client.ptyWrite, "pty.write");
      const submit = body.params?.submit;
      const sensitive = body.params?.sensitive;
      if (submit !== undefined && typeof submit !== "boolean")
        throw new Error("pty.write.params.submit must be a boolean");
      if (sensitive !== undefined && typeof sensitive !== "boolean")
        throw new Error("pty.write.params.sensitive must be a boolean");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.ptyWrite({
          id: stringParam(body.params, "id"),
          text: stringParam(body.params, "text"),
          submit: typeof submit === "boolean" ? submit : undefined,
          sensitive: typeof sensitive === "boolean" ? sensitive : undefined,
        }),
      };
    }
    if (body.method === "pty.key") {
      optionsGuard(client.ptyKey, "pty.key");
      const key = stringParam(body.params, "key");
      if (!["enter", "ctrl-c", "ctrl-d", "tab", "esc"].includes(key))
        throw new Error("pty.key.params.key is invalid");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.ptyKey({
          id: stringParam(body.params, "id"),
          key: key as "enter" | "ctrl-c" | "ctrl-d" | "tab" | "esc",
        }),
      };
    }
    if (body.method === "pty.resize") {
      optionsGuard(client.ptyResize, "pty.resize");
      const rows = body.params?.rows;
      const cols = body.params?.cols;
      if (
        typeof rows !== "number" ||
        !Number.isInteger(rows) ||
        typeof cols !== "number" ||
        !Number.isInteger(cols)
      )
        throw new Error("pty.resize.params.rows and cols must be integers");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.ptyResize({
          id: stringParam(body.params, "id"),
          rows,
          cols,
        }),
      };
    }
    if (
      body.method === "pty.attach" ||
      body.method === "pty.detach" ||
      body.method === "pty.stop"
    ) {
      const method = body.method;
      const action =
        method === "pty.attach"
          ? client.ptyAttach
          : method === "pty.detach"
            ? client.ptyDetach
            : client.ptyStop;
      optionsGuard(action, method);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await action(stringParam(body.params, "id")),
      };
    }
    if (body.method === "checkpoint.list") {
      optionsGuard(client.checkpointList, "checkpoint.list");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.checkpointList(),
      };
    }
    if (body.method === "checkpoint.preview") {
      optionsGuard(client.checkpointPreview, "checkpoint.preview");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.checkpointPreview(stringParam(body.params, "id")),
      };
    }
    if (body.method === "checkpoint.rollback") {
      optionsGuard(client.checkpointRollback, "checkpoint.rollback");
      const dryRun = body.params?.dryRun;
      if (dryRun !== undefined && typeof dryRun !== "boolean")
        throw new Error("checkpoint.rollback.params.dryRun must be a boolean");
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
      optionsGuard(client.sandboxList, "sandbox.list");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxList(),
      };
    }
    if (body.method === "sandbox.diff") {
      optionsGuard(client.sandboxDiff, "sandbox.diff");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxDiff(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.resources") {
      optionsGuard(client.sandboxResources, "sandbox.resources");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxResources(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.resource.output") {
      optionsGuard(client.sandboxResourceOutput, "sandbox.resource.output");
      const maxBytes = body.params?.maxBytes;
      if (
        maxBytes !== undefined &&
        (typeof maxBytes !== "number" ||
          !Number.isInteger(maxBytes) ||
          maxBytes < 1 ||
          maxBytes > 20000)
      )
        throw new Error(
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
      optionsGuard(client.sandboxMerge, "sandbox.merge");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxMerge(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.delete") {
      optionsGuard(client.sandboxDelete, "sandbox.delete");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sandboxDelete(stringParam(body.params, "id")),
      };
    }
    if (body.method === "sandbox.resource.stop") {
      optionsGuard(client.sandboxResourceStop, "sandbox.resource.stop");
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
        throw new Error("approval.respond.params.decision is invalid");
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
      optionsGuard(client.pendingInteractive, "interactive.pending");
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
      optionsGuard(client.history, "session.history");
      const after = body.params?.after;
      const limit = body.params?.limit;
      if (
        after !== undefined &&
        (typeof after !== "number" || !Number.isInteger(after) || after < 0)
      )
        throw new Error(
          "session.history.params.after must be a non-negative integer",
        );
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 500)
      )
        throw new Error(
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
      optionsGuard(client.messages, "session.messages");
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
        throw new Error(
          "session.messages.params.limit must be an integer between 1 and 200",
        );
      if (order !== undefined && order !== "asc" && order !== "desc")
        throw new Error("session.messages.params.order must be asc or desc");
      if (cursor !== undefined && typeof cursor !== "string")
        throw new Error("session.messages.params.cursor must be a string");
      if (cursor !== undefined && order !== undefined)
        throw new Error(
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
      optionsGuard(client.sessionList, "session.list");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionList(),
      };
    }
    if (body.method === "session.touch") {
      optionsGuard(client.sessionTouch, "session.touch");
      await client.sessionTouch(stringParam(body.params, "id"));
      return { jsonrpc: "2.0", id: body.id ?? null, result: { touched: true } };
    }
    if (body.method === "session.rename") {
      optionsGuard(client.sessionRename, "session.rename");
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
      optionsGuard(client.sessionPin, "session.pin");
      if (typeof body.params?.pinned !== "boolean")
        throw new Error("session.pin.params.pinned must be a boolean");
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
      optionsGuard(client.sessionDuplicate, "session.duplicate");
      const title = body.params?.title;
      if (title !== undefined && typeof title !== "string")
        throw new Error("session.duplicate.params.title must be a string");
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
      optionsGuard(client.sessionFork, "session.fork");
      const title = body.params?.title;
      if (title !== undefined && typeof title !== "string")
        throw new Error("session.fork.params.title must be a string");
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
      optionsGuard(client.sessionDelete, "session.delete");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.sessionDelete(stringParam(body.params, "id")),
      };
    }
    if (body.method === "mcp.catalog") {
      optionsGuard(client.mcpCatalog, "mcp.catalog");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.mcpCatalog(),
      };
    }
    if (body.method === "plugin.list") {
      optionsGuard(client.plugins, "plugin.list");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.plugins(),
      };
    }
    if (body.method === "runtime.status") {
      optionsGuard(client.runtimeStatus, "runtime.status");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.runtimeStatus(),
      };
    }
    if (body.method === "diagnostics.list") {
      optionsGuard(client.diagnostics, "diagnostics.list");
      const limit = body.params?.limit;
      if (
        limit !== undefined &&
        (typeof limit !== "number" ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 500)
      )
        throw new Error(
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
      optionsGuard(client.getMcpPrompt, "mcp.prompt");
      const arguments_ = body.params?.arguments;
      if (
        arguments_ !== undefined &&
        (!arguments_ ||
          typeof arguments_ !== "object" ||
          Array.isArray(arguments_))
      )
        throw new Error("mcp.prompt.params.arguments must be an object");
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
      optionsGuard(client.readMcpResource, "mcp.resource");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.readMcpResource(
          stringParam(body.params, "server"),
          stringParam(body.params, "uri"),
        ),
      };
    }
    throw new Error(`unsupported method: ${body.method ?? ""}`);
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request?.id ?? null,
      error: {
        code: -32602,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
