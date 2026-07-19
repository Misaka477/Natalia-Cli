import { expect, test } from "bun:test";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { createRuntimeWsServer } from "../src";

function collectMessages(ws: WebSocket): {
  messages: any[];
  waitFor: (pred: (m: any) => boolean, timeout?: number) => Promise<any>;
} {
  const messages: any[] = [];
  const pending: Array<{
    pred: (m: any) => boolean;
    resolve: (m: any) => void;
    onTimeout: () => void;
    timer?: any;
  }> = [];

  ws.addEventListener("message", (event: MessageEvent) => {
    let parsed: any;
    try {
      parsed = JSON.parse(event.data as string);
    } catch {
      return;
    }
    messages.push(parsed);
    for (let i = pending.length - 1; i >= 0; i--) {
      const entry = pending[i];
      if (entry.pred(parsed)) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.resolve(parsed);
        pending.splice(i, 1);
      }
    }
  });

  return {
    messages,
    waitFor(pred: (m: any) => boolean, timeout = 5000) {
      const existing = messages.find(pred);
      if (existing) return Promise.resolve(existing);
      return new Promise<any>((resolve, reject) => {
        const entry = {
          pred,
          resolve,
          onTimeout() {
            reject(new Error("timeout waiting for message"));
          },
        } as {
          pred: (m: any) => boolean;
          resolve: (m: any) => void;
          onTimeout: () => void;
          timer?: any;
        };
        if (timeout > 0) {
          entry.timer = setTimeout(() => {
            const idx = pending.indexOf(entry);
            if (idx >= 0) pending.splice(idx, 1);
            entry.onTimeout();
          }, timeout);
        }
        pending.push(entry);
      });
    },
  };
}

test("native WS RPC transport behind RuntimeClient contract", async () => {
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

  const server = createRuntimeWsServer({ client, token: "secret" });

  const ws = new WebSocket(`${server.url}/ws?token=secret`);

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("WS connection failed"));
  });

  const { waitFor } = collectMessages(ws);

  // --- prompt RPC ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "prompt",
      params: { text: "hello" },
    }),
  );

  const promptResp = await waitFor((m) => m.id === 1);
  expect(promptResp).toMatchObject({
    jsonrpc: "2.0",
    id: 1,
    result: { text: "hello" },
  });
  expect(events).toHaveLength(1);

  const submitEvt = await waitFor(
    (m) => m.method === "event" && m.params?.event?.type === "turn.submitted",
  );
  expect(submitEvt).toMatchObject({
    jsonrpc: "2.0",
    method: "event",
    params: { event: { type: "turn.submitted" } },
  });

  // --- pause RPC + event broadcast ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "pause",
      params: { reason: "smoke" },
    }),
  );

  const pauseResp = await waitFor((m) => m.id === 2);
  expect(pauseResp).toMatchObject({
    jsonrpc: "2.0",
    id: 2,
    result: { paused: true },
  });

  const pauseEvt = await waitFor(
    (m) => m.method === "event" && m.params?.event?.type === "turn.paused",
  );
  expect(pauseEvt).toMatchObject({
    jsonrpc: "2.0",
    method: "event",
    params: { event: { type: "turn.paused" } },
  });

  // --- resume RPC ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "resume",
    }),
  );

  const resumeResp = await waitFor((m) => m.id === 3);
  expect(resumeResp).toMatchObject({
    jsonrpc: "2.0",
    id: 3,
    result: { resumed: true },
  });

  // --- snapshot RPC ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "snapshot",
    }),
  );

  const snapResp = await waitFor((m) => m.id === 4);
  expect(snapResp).toMatchObject({
    jsonrpc: "2.0",
    id: 4,
    result: { type: "snapshot.created", id: "snap_1" },
  });

  // --- unsupported method ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "bogus",
    }),
  );

  const errResp = await waitFor((m) => m.id === 5);
  expect(errResp).toMatchObject({
    jsonrpc: "2.0",
    id: 5,
    error: { code: -32602 },
  });

  // --- invalid JSON ---
  ws.send("not json");

  const parseErr = await waitFor((m) => m.id === null);
  expect(parseErr).toMatchObject({
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700 },
  });

  // --- cancel RPC ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 6,
      method: "cancel",
    }),
  );

  const cancelResp = await waitFor((m) => m.id === 6);
  expect(cancelResp).toMatchObject({
    jsonrpc: "2.0",
    id: 6,
    result: { cancelled: true },
  });

  // --- approval.respond RPC ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "approval.respond",
      params: { requestID: "req_1", decision: "once", feedback: "ok" },
    }),
  );

  const approvalResp = await waitFor((m) => m.id === 7);
  expect(approvalResp).toMatchObject({
    jsonrpc: "2.0",
    id: 7,
    result: { responded: true },
  });

  // --- question.respond RPC ---
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 8,
      method: "question.respond",
      params: {
        requestID: "req_2",
        answers: [["yes"]],
        rejected: false,
      },
    }),
  );

  const questionResp = await waitFor((m) => m.id === 8);
  expect(questionResp).toMatchObject({
    jsonrpc: "2.0",
    id: 8,
    result: { responded: true },
  });

  ws.close();
  server.stop(true);
});

test("WS unauthorized upgrade rejected", async () => {
  const client: RuntimeClient = {
    start() {},
    async submit(text) {
      throw new Error("unused");
    },
    cancel() {},
    snapshot: () => ({ type: "snapshot.created", id: "x", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };

  const server = createRuntimeWsServer({ client, token: "secret" });
  const httpUrl = server.url.replace("ws://", "http://");

  const res = await fetch(`${httpUrl}/ws`);
  expect(res.status).toBe(401);

  server.stop(true);
});

test("WS /healthz returns ok", async () => {
  const client: RuntimeClient = {
    start() {},
    async submit(text) {
      throw new Error("unused");
    },
    cancel() {},
    snapshot: () => ({ type: "snapshot.created", id: "x", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };

  const server = createRuntimeWsServer({ client, token: "secret" });
  const httpUrl = server.url.replace("ws://", "http://");

  const res = await fetch(`${httpUrl}/healthz`);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true });

  server.stop(true);
});
