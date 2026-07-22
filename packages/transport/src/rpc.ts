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
  body: RPCRequest,
  client: RuntimeClient,
): Promise<RPCResponse> {
  try {
    if (body.method === "prompt") {
      const text = body.params?.text;
      if (typeof text !== "string")
        throw new Error("prompt.params.text must be a string");
      const delivery = body.params?.delivery;
      if (
        delivery !== undefined &&
        delivery !== "steer" &&
        delivery !== "queue"
      )
        throw new Error("prompt.params.delivery must be steer or queue");
      const attachments = body.params?.attachments;
      if (
        attachments !== undefined &&
        (!Array.isArray(attachments) ||
          !attachments.every((attachment) => typeof attachment === "string"))
      )
        throw new Error(
          "prompt.params.attachments must be an array of strings",
        );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: client.submitInput
          ? await client.submitInput({
              text,
              delivery,
              attachments: attachments as string[] | undefined,
            })
          : await client.submit(text),
      };
    }
    if (body.method === "cancel") {
      client.cancel(
        typeof body.params?.reason === "string"
          ? body.params.reason
          : undefined,
      );
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
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
      const limit = body.params?.limit;
      if (query !== undefined && typeof query !== "string")
        throw new Error("workspace.files.params.query must be a string");
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
      if (path !== undefined && typeof path !== "string")
        throw new Error("workspace.list.params.path must be a string");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workspaceList({
          path: typeof path === "string" ? path : undefined,
        }),
      };
    }
    if (body.method === "workspace.read") {
      optionsGuard(client.workspaceRead, "workspace.read");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: await client.workspaceRead({
          path: stringParam(body.params, "path"),
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
      id: body.id ?? null,
      error: {
        code: -32602,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
