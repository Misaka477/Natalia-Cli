import { expect, test } from "bun:test";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { createRuntimeHttpServer } from "../src";

test("native HTTP RPC and SSE transport stays behind RuntimeClient contract", async () => {
  const events: RuntimeEvent[] = [];
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const client: RuntimeClient = {
    start(handler) {
      sink = handler;
    },
    async submit(text) {
      const event: SubmittedTurn = {
        type: "turn.submitted",
        id: "turn_1",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      };
      events.push(event);
      sink?.(event);
      return event;
    },
    cancel() {},
    pause(reason) {
      sink?.({ type: "turn.paused", id: "turn_1", reason: reason ?? "test" });
    },
    resume() {
      sink?.({ type: "turn.resumed", id: "turn_1" });
    },
    snapshot: () => ({ type: "snapshot.created", id: "snap_1", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
  const server = createRuntimeHttpServer({ client, token: "secret" });
  const unauthorized = await fetch(`${server.url}/rpc`, { method: "POST" });
  expect(unauthorized.status).toBe(401);
  const response = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "prompt",
      params: { text: "hello" },
    }),
  });
  expect((await response.json()) as { result: { text: string } }).toMatchObject(
    { result: { text: "hello" } },
  );
  expect(events).toHaveLength(1);
  const pause = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "pause",
      params: { reason: "smoke" },
    }),
  });
  expect((await pause.json()) as { result: { paused: boolean } }).toMatchObject(
    { result: { paused: true } },
  );
  server.stop(true);
});
