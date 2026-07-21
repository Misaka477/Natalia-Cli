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
      if (delivery !== undefined && delivery !== "steer" && delivery !== "queue")
        throw new Error("prompt.params.delivery must be steer or queue");
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: client.submitInput
          ? await client.submitInput({ text, delivery })
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
    if (body.method === "snapshot")
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: client.snapshot(),
      };
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
