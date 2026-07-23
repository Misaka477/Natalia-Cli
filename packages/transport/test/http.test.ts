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
    async history(options = {}) {
      return {
        events:
          options.after === undefined || options.after < 7
            ? [
                {
                  seq: 7,
                  event: {
                    type: "diagnostic" as const,
                    level: "info" as const,
                    message: "durable replay",
                  },
                },
              ]
            : [],
        hasMore: false,
      };
    },
    async pendingInteractive() {
      return {
        approvals: [
          {
            type: "approval.request" as const,
            id: "approval_open",
            title: "Write",
            preview: "file",
          },
        ],
        questions: [],
      };
    },
    async plugins() {
      return [
        {
          id: "demo.plugin",
          version: "1.0.0",
          name: "Demo",
          description: "",
          capabilities: ["tools"],
        },
      ];
    },
    async runtimeStatus() {
      return {
        type: "status.snapshot",
        model: "test",
        provider: "fixture",
        context: "0 tokens",
        step: "0",
        permissions: "ask",
        cwd: "/tmp",
        background: "0 running",
      };
    },
    async diagnostics() {
      return [
        {
          type: "diagnostic",
          level: "info",
          message: "safe",
          at: "2026-07-22T00:00:00.000Z",
        },
      ];
    },
    async agents() {
      return [
        {
          name: "review",
          description: "Review changes",
          mode: "primary",
          hidden: false,
          model: "test-model",
          maxSteps: 12,
          allowedTools: ["read_file"],
          excludedTools: ["run_shell"],
          mcpServers: ["docs"],
        },
      ];
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
  const plugins = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 8,
      method: "plugin.list",
      params: {},
    }),
  });
  expect(
    (await plugins.json()) as { result: Array<{ id: string }> },
  ).toMatchObject({ result: [{ id: "demo.plugin" }] });
  const diagnostics = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "diagnostics.list",
      params: { limit: 1 },
    }),
  });
  expect(
    (await diagnostics.json()) as { result: Array<{ message: string }> },
  ).toMatchObject({ result: [{ message: "safe" }] });
  const status = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 12,
      method: "runtime.status",
      params: {},
    }),
  });
  expect(
    (await status.json()) as { result: { background: string } },
  ).toMatchObject({ result: { background: "0 running" } });
  const agents = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 11,
      method: "agent.list",
      params: {},
    }),
  });
  expect(
    (await agents.json()) as {
      result: Array<{ name: string; maxSteps: number }>;
    },
  ).toMatchObject({ result: [{ name: "review", maxSteps: 12 }] });
  const pending = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 9,
      method: "interactive.pending",
      params: {},
    }),
  });
  expect(
    (await pending.json()) as { result: { approvals: Array<{ id: string }> } },
  ).toMatchObject({
    result: { approvals: [{ id: "approval_open" }] },
  });
  const replay = await fetch(`${server.url}/events?since=0`, {
    headers: { authorization: "Bearer secret" },
  });
  const reader = replay.body!.getReader();
  const decoder = new TextDecoder();
  let replayed = "";
  for (
    let index = 0;
    index < 4 && !replayed.includes("durable replay");
    index++
  ) {
    const next = await reader.read();
    replayed += decoder.decode(next.value);
  }
  expect(replayed).toContain("id: 7");
  expect(replayed).toContain("durable replay");
  await reader.cancel();
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

test("HTTP transport returns JSON-RPC errors for malformed request bodies", async () => {
  const client: RuntimeClient = {
    start() {},
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_invalid",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      };
    },
    cancel() {},
    snapshot: () => ({ type: "snapshot.created", id: "snap", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
  const server = createRuntimeHttpServer({ client });
  try {
    for (const body of ["", "null"]) {
      const response = await fetch(`${server.url}/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        jsonrpc: "2.0",
        id: null,
        error: expect.any(Object),
      });
    }
  } finally {
    server.stop(true);
  }
});
