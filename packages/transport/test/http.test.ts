import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { createRuntimeHttpServer } from "../src/host";

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
    async messages() {
      return {
        data: [
          {
            id: "turn_message",
            turnID: "turn_message",
            submitted: {
              type: "turn.submitted" as const,
              id: "turn_message",
              text: "projected",
              byteLength: 9,
              lineCount: 1,
              sha256: "test",
            },
            rows: [],
          },
        ],
        cursor: { next: "opaque-next" },
      };
    },
    async checkpointList() {
      return [checkpointFixture()];
    },
    async checkpointPreview() {
      return checkpointPreviewFixture(true);
    },
    async checkpointRollback(input) {
      return checkpointPreviewFixture(Boolean(input.dryRun));
    },
    async sandboxList() {
      return [sandboxFixture()];
    },
    async sandboxDiff() {
      return [{ kind: "modify" as const, path: "draft.txt" }];
    },
    async sandboxResources() {
      return [];
    },
    async sandboxResourceOutput() {
      return "";
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
      return { paused: true };
    },
    resume() {
      sink?.({ type: "turn.resumed", id: "turn_1" });
      return { resumed: true };
    },
    snapshot: () => ({ type: "snapshot.created", id: "snap_1", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
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
  const checkpoint = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 15,
      method: "checkpoint.rollback",
      params: { id: "checkpoint_0", dryRun: true },
    }),
  });
  expect(
    (await checkpoint.json()) as { result: { dryRun: boolean } },
  ).toMatchObject({ result: { dryRun: true } });
  const sandbox = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 16,
      method: "sandbox.list",
      params: {},
    }),
  });
  expect(
    (await sandbox.json()) as { result: Array<{ id: string }> },
  ).toMatchObject({
    result: [{ id: "sandbox_fixture" }],
  });
  const messages = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 13,
      method: "session.messages",
      params: { limit: 1, order: "asc" },
    }),
  });
  expect(
    (await messages.json()) as { result: { data: Array<{ id: string }> } },
  ).toMatchObject({ result: { data: [{ id: "turn_message" }] } });
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

function checkpointFixture() {
  return {
    id: "checkpoint_0",
    sequence: 0,
    step: 0,
    reason: "baseline" as const,
    createdAt: "2026-07-23T00:00:00.000Z",
    complete: true,
    errors: [],
    files: 0,
    changes: 0,
    tokenEstimate: 0,
    diskUsageBytes: 0,
  };
}

function checkpointPreviewFixture(dryRun: boolean) {
  return {
    checkpointID: "checkpoint_0",
    dryRun,
    changes: [],
    context: {
      truncateMessages: 0,
      targetJournalOffset: 0,
      targetStep: 0,
      targetTokens: 0,
      compactionGeneration: 0,
    },
    resources: [],
    ignoredFiles: 0,
    diskUsageBytes: 0,
    complete: true,
    warnings: [],
  };
}

function sandboxFixture() {
  return {
    id: "sandbox_fixture",
    root: "/tmp/sandbox_fixture",
    isolationLevel: "workspace" as const,
    changedFiles: 1,
    runningResources: 0,
    envAllowlist: ["PATH"],
  };
}

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
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
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

test("native RPC serves the same authenticated contract over a Unix socket", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-transport-unix-"));
  const socket = join(root, "runtime.sock");
  const server = createRuntimeHttpServer({
    client: transportClient(),
    token: "unix-token",
    unix: socket,
  });
  try {
    expect(server.url).toBe(`unix://${socket}`);
    const response = await fetch("http://localhost/rpc", {
      unix: socket,
      method: "POST",
      headers: {
        authorization: "Bearer unix-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "prompt",
        params: { text: "unix transport" },
      }),
    });
    expect(response.status).toBe(200);
    expect(
      (await response.json()) as { result: { text: string } },
    ).toMatchObject({ result: { text: "unix transport" } });
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

test("native RPC serves the same authenticated contract over temporary TLS", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-transport-tls-"));
  const keyPath = join(root, "key.pem");
  const certPath = join(root, "cert.pem");
  const openssl = Bun.which("openssl");
  if (!openssl) {
    await rm(root, { recursive: true, force: true });
    return;
  }
  // Some distributions (e.g. a conda environment with a stale install) have
  // no usable openssl.cnf anywhere, so a minimal one is generated alongside
  // the keys and passed explicitly. That also keeps the invocation identical
  // across platforms.
  const configPath = join(root, "openssl.cnf");
  await writeFile(
    configPath,
    "[req]\ndistinguished_name = dn\nprompt = no\n[dn]\nCN = 127.0.0.1\n",
  );
  const opensslProcess = Bun.spawn(
    [
      openssl,
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-config",
      configPath,
      "-days",
      "1",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  if ((await opensslProcess.exited) !== 0) {
    await rm(root, { recursive: true, force: true });
    throw new Error("openssl could not create a temporary TLS certificate");
  }
  const server = createRuntimeHttpServer({
    client: transportClient(),
    token: "tls-token",
    tls: {
      key: await readFile(keyPath, "utf8"),
      cert: await readFile(certPath, "utf8"),
    },
  });
  try {
    expect(server.url.startsWith("https://")).toBe(true);
    const response = await fetch(`${server.url}/rpc`, {
      tls: { rejectUnauthorized: false },
      method: "POST",
      headers: {
        authorization: "Bearer tls-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "prompt",
        params: { text: "tls transport" },
      }),
    });
    expect(response.status).toBe(200);
    expect(
      (await response.json()) as { result: { text: string } },
    ).toMatchObject({ result: { text: "tls transport" } });
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

function transportClient(): RuntimeClient {
  return {
    start() {},
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_transport",
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
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
  };
}

test("unattended read routes are refused when the runtime does not implement them", async () => {
  // The routes are optional on RuntimeClient, so a host that does not provide
  // them must say so rather than answering with an empty result that a consumer
  // would read as "no scheduled tasks".
  const client = {
    start() {},
    async submit() {
      throw new Error("not used");
    },
    cancel() {},
    pause() {
      return { paused: true };
    },
    resume() {
      return { resumed: true };
    },
    snapshot: () => ({ type: "session.ready", sessionID: "ses_x" }),
    diagnostic() {},
    lastSubmission: () => undefined,
  } as unknown as RuntimeClient;
  const server = createRuntimeHttpServer({ client, token: "secret" });
  try {
    for (const [method, member] of [
      ["task.overview", "taskOverview"],
      ["flow.overview", "flowOverview"],
      ["document.catalog", "documentCatalog"],
    ] as const) {
      const response = await fetch(new URL("/rpc", server.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret",
        },
        body: JSON.stringify({ id: 1, method, params: {} }),
      });
      const body = (await response.json()) as {
        error?: { code: number; data?: unknown };
      };
      // Asserted on the code and the structured data rather than the message: a
      // route this runtime cannot serve is `-32000 not supported`, and the member
      // plus its capability let a consumer disable the whole group at once.
      expect(body.error?.code).toBe(-32000);
      expect(body.error?.data).toEqual({
        kind: "notSupported",
        member,
        capability: "automation",
      });
    }
  } finally {
    server.stop();
  }
});

test("task execution requires write, automation, and deployment opt-in before parsing", async () => {
  let starts = 0;
  const authorization = {
    credentials: [
      { token: "read", groups: ["automation"] as const },
      { token: "wrong-group", write: true, groups: ["management"] as const },
      { token: "execute", write: true, groups: ["automation"] as const },
    ],
  };
  const server = createRuntimeHttpServer({
    client: transportClient(),
    authorization,
    startTask() {
      starts++;
      throw new Error("must not start");
    },
  });
  const post = (token?: string) =>
    fetch(`${server.url}/tasks/run`, {
      method: "POST",
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "content-type": "application/json",
      },
      // Deliberately invalid: every authorization/deployment gate must run
      // before a caller can use parser differences as an existence probe.
      body: "not-json",
    });
  try {
    expect((await post()).status).toBe(401);
    expect(await (await post("read")).json()).toMatchObject({
      kind: "refused",
      reason: expect.stringContaining("no write scope"),
    });
    expect(await (await post("wrong-group")).json()).toMatchObject({
      kind: "refused",
      reason: expect.stringContaining("automation group"),
    });
    expect(await (await post("execute")).json()).toMatchObject({
      kind: "refused",
      reason: "task execution is not enabled by this host",
    });
    expect(starts).toBe(0);
  } finally {
    server.stop(true);
  }
});

test("task execution exposes an authorized observation record", async () => {
  const server = createRuntimeHttpServer({
    client: transportClient(),
    authorization: {
      credentials: [
        { token: "observe", groups: ["automation"] },
        { token: "execute", write: true, groups: ["automation"] },
        { token: "management", write: true, groups: ["management"] },
      ],
    },
    taskExecution: true,
    startTask(request) {
      expect(request).toMatchObject({ taskID: "task_review", json: true });
      return {
        executionID: "exe_http_test",
        events: (async function* () {
          yield {
            type: "workflow.execution.resolved",
            executionID: "exe_http_test",
            taskID: "task_review",
          };
          yield {
            type: "workflow.execution.output",
            executionID: "exe_http_test",
            line: '{"type":"task.invocation","status":"stalled"}',
          };
          yield {
            type: "workflow.execution",
            executionID: "exe_http_test",
            status: "completed",
          };
        })(),
        result: Promise.resolve({
          invocationID: "inv_http_test",
          status: "stalled",
          waterlineAdvanced: false,
          exitCode: 0,
        }),
        cancel() {},
      };
    },
  });
  try {
    const response = await fetch(`${server.url}/tasks/run`, {
      method: "POST",
      headers: {
        authorization: "Bearer execute",
        "content-type": "application/json",
      },
      body: JSON.stringify({ taskID: "task_review", json: true }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      executionID: "exe_http_test",
      invocationID: "inv_http_test",
      status: "stalled",
      output: ['{"type":"task.invocation","status":"stalled"}'],
    });

    const observation = await fetch(
      `${server.url}/tasks/executions/exe_http_test`,
      { headers: { authorization: "Bearer observe" } },
    );
    expect(await observation.json()).toMatchObject({
      executionID: "exe_http_test",
      status: "completed",
      result: { invocationID: "inv_http_test", status: "stalled" },
    });
    const events = await fetch(
      `${server.url}/tasks/executions/exe_http_test/events`,
      { headers: { authorization: "Bearer observe" } },
    );
    expect(await events.json()).toMatchObject({
      executionID: "exe_http_test",
      events: [
        { type: "workflow.execution.resolved" },
        { type: "workflow.execution.output" },
        { type: "workflow.execution", status: "completed" },
      ],
    });
    const forbidden = await fetch(
      `${server.url}/tasks/executions/exe_http_test`,
      { headers: { authorization: "Bearer management" } },
    );
    expect(forbidden.status).toBe(403);
  } finally {
    server.stop(true);
  }
});

test("async task delivery can be observed and cancelled through the execution ID", async () => {
  let rejectResult!: (error: Error) => void;
  const result = new Promise<{
    invocationID: string;
    status: string;
    waterlineAdvanced: boolean;
    exitCode: number;
  }>((_resolve, reject) => (rejectResult = reject));
  let resolveEvent!: (value: IteratorResult<Record<string, unknown>>) => void;
  const events: AsyncIterable<Record<string, unknown>> = {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise((resolve) => (resolveEvent = resolve)),
      };
    },
  };
  const server = createRuntimeHttpServer({
    client: transportClient(),
    authorization: {
      credentials: [
        { token: "observe", groups: ["automation"] },
        { token: "execute", write: true, groups: ["automation"] },
      ],
    },
    taskExecution: true,
    startTask() {
      return {
        executionID: "exe_async_test",
        events,
        result,
        cancel() {
          resolveEvent({
            done: false,
            value: {
              type: "workflow.execution",
              executionID: "exe_async_test",
              status: "cancelled",
            },
          });
          queueMicrotask(() => {
            resolveEvent({ done: true, value: undefined });
            rejectResult(new Error("remote workflow cancellation"));
          });
        },
      };
    },
  });
  try {
    const started = await fetch(`${server.url}/tasks/run`, {
      method: "POST",
      headers: {
        authorization: "Bearer execute",
        "content-type": "application/json",
      },
      body: JSON.stringify({ taskID: "task_async", wait: false }),
    });
    expect(started.status).toBe(202);
    expect(await started.json()).toEqual({
      executionID: "exe_async_test",
      status: "running",
    });
    const running = await fetch(
      `${server.url}/tasks/executions/exe_async_test`,
      { headers: { authorization: "Bearer observe" } },
    );
    expect(await running.json()).toMatchObject({ status: "running" });
    const forbiddenCancel = await fetch(
      `${server.url}/tasks/executions/exe_async_test/cancel`,
      {
        method: "POST",
        headers: { authorization: "Bearer observe" },
      },
    );
    expect(forbiddenCancel.status).toBe(403);
    const cancelled = await fetch(
      `${server.url}/tasks/executions/exe_async_test/cancel`,
      {
        method: "POST",
        headers: { authorization: "Bearer execute" },
      },
    );
    expect(await cancelled.json()).toEqual({
      executionID: "exe_async_test",
      cancelling: true,
    });
    await Bun.sleep(0);
    const terminal = await fetch(
      `${server.url}/tasks/executions/exe_async_test`,
      { headers: { authorization: "Bearer observe" } },
    );
    expect(await terminal.json()).toMatchObject({
      status: "cancelled",
      error: "remote workflow cancellation",
    });
  } finally {
    server.stop(true);
  }
});

test("stopping the HTTP host cancels active workflow executions", async () => {
  let cancelled: string | undefined;
  const server = createRuntimeHttpServer({
    client: transportClient(),
    token: "execute",
    taskExecution: true,
    startTask() {
      return {
        executionID: "exe_stop_test",
        events: (async function* () {
          await new Promise(() => undefined);
        })(),
        result: new Promise(() => undefined),
        cancel(reason) {
          cancelled = reason;
        },
      };
    },
  });
  const started = await fetch(`${server.url}/tasks/run`, {
    method: "POST",
    headers: {
      authorization: "Bearer execute",
      "content-type": "application/json",
    },
    body: JSON.stringify({ taskID: "task_running", wait: false }),
  });
  expect(started.status).toBe(202);
  server.stop(true);
  expect(cancelled).toBe("HTTP runtime server stopped");
});
