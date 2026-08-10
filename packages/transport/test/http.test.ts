import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  const terminalViewerActions: string[] = [];
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
    async terminalList() {
      return [ptyFixture()];
    },
    async terminalRead() {
      return {
        ...ptyFixture(),
        offset: 0,
        nextOffset: 3,
        totalChars: 3,
        truncated: false,
      };
    },
    async terminalObserve(input) {
      return {
        session: ptyFixture(),
        afterRevision: input.afterRevision,
        changed: false,
        reason: "timeout" as const,
      };
    },
    async terminalViewerRegister(input) {
      terminalViewerActions.push(`register:${input.viewerID}`);
      return ptyFixture();
    },
    async terminalViewerHeartbeat(input) {
      terminalViewerActions.push(`heartbeat:${input.viewerID}`);
      return ptyFixture();
    },
    async terminalViewerControl(input) {
      terminalViewerActions.push(`${input.action}:${input.viewerID}`);
      return ptyFixture();
    },
    async terminalViewerWrite(input) {
      terminalViewerActions.push(
        `write:${input.viewerID}:${input.data}:${input.sensitive ?? false}`,
      );
      return ptyFixture();
    },
    async terminalViewerResize(input) {
      terminalViewerActions.push(
        `resize:${input.viewerID}:${input.rows}x${input.cols}`,
      );
      return { ...ptyFixture(), rows: input.rows, cols: input.cols };
    },
    async terminalScrollback(input) {
      return {
        offsetFromBottom: input.offsetFromBottom ?? 0,
        start: 0,
        end: 1,
        totalLines: 1,
        lines: [[["history", 1]]],
        text: "history",
        cursorRow: 0,
        cursorCol: 0,
      };
    },
    async terminalWrite() {
      return ptyFixture();
    },
    async terminalKey() {
      return ptyFixture();
    },
    async terminalResize() {
      return { ...ptyFixture(), rows: 32, cols: 120 };
    },
    async terminalAttach() {
      return ptyFixture();
    },
    async terminalDetach() {
      return { ...ptyFixture(), attached: false };
    },
    async terminalStop() {
      return { ...ptyFixture(), status: "exited" as const };
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
  const terminal = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 14,
      method: "terminal.resize",
      params: { id: "tty_fixture", rows: 32, cols: 120 },
    }),
  });
  expect(
    (await terminal.json()) as { result: { rows: number; cols: number } },
  ).toMatchObject({
    result: { rows: 32, cols: 120 },
  });
  const terminal2 = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 140,
      method: "terminal.resize",
      params: { id: "tty_fixture", rows: 32, cols: 120 },
    }),
  });
  expect(
    (await terminal2.json()) as { result: { rows: number; cols: number } },
  ).toMatchObject({
    result: { rows: 32, cols: 120 },
  });
  const terminalObserve = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 141,
      method: "terminal.observe",
      params: { id: "tty_fixture", afterRevision: 0, timeoutMs: 10 },
    }),
  });
  expect(
    (await terminalObserve.json()) as {
      result: { reason: string; afterRevision: number };
    },
  ).toMatchObject({ result: { reason: "timeout", afterRevision: 0 } });
  for (const [method, params] of [
    [
      "terminal.viewer.register",
      { id: "tty_fixture", viewerID: "viewer_http", kind: "external" },
    ],
    [
      "terminal.viewer.control",
      { id: "tty_fixture", viewerID: "viewer_http", action: "takeover" },
    ],
    [
      "terminal.viewer.write",
      {
        id: "tty_fixture",
        viewerID: "viewer_http",
        data: "x",
        sensitive: true,
      },
    ],
    [
      "terminal.viewer.resize",
      { id: "tty_fixture", viewerID: "viewer_http", rows: 30, cols: 100 },
    ],
    [
      "terminal.viewer.heartbeat",
      { id: "tty_fixture", viewerID: "viewer_http" },
    ],
    [
      "terminal.viewer.control",
      { id: "tty_fixture", viewerID: "viewer_http", action: "unregister" },
    ],
  ] as const) {
    const response = await fetch(`${server.url}/rpc`, {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 142, method, params }),
    });
    expect(response.ok).toBe(true);
  }
  expect(terminalViewerActions).toEqual([
    "register:viewer_http",
    "takeover:viewer_http",
    "write:viewer_http:x:true",
    "resize:viewer_http:30x100",
    "heartbeat:viewer_http",
    "unregister:viewer_http",
  ]);
  const scrollback = await fetch(`${server.url}/rpc`, {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 143,
      method: "terminal.scrollback",
      params: { id: "tty_fixture", offsetFromBottom: 20, maxRows: 10 },
    }),
  });
  expect(await scrollback.json()).toMatchObject({
    result: { offsetFromBottom: 20, text: "history" },
  });
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

function ptyFixture() {
  return {
    id: "tty_fixture",
    command: "cat",
    cwd: "/tmp",
    status: "running" as const,
    attached: true,
    rows: 24,
    cols: 80,
    transcript: "ok\n",
    tail: "ok\n",
    startedAt: "2026-07-23T00:00:00.000Z",
    secretAudit: [],
  };
}

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
  const process = Bun.spawn(
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
      "-subj",
      "/CN=127.0.0.1",
      "-days",
      "1",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  if ((await process.exited) !== 0) {
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
    respondApproval() {},
    respondQuestion() {},
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
    pause() {},
    resume() {},
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
