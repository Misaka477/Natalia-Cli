import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import {
  createToolRegistry,
  encodeTerminalKey,
  ManagedProcessRegistry,
  nativeTerminalReadPage,
  nativeTerminalSearchPage,
} from "../src";
import { NativeTerminalRegistry } from "@natalia/native-terminal";
import { WorkspaceSandboxManager } from "@natalia/sandbox";

test("default file tools read write and edit inside workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-files-"));
  const tools = createToolRegistry();
  await tools
    .get("write_file")!
    .execute(
      { path: "example.txt", content: "hello" },
      { workspaceRoot: root },
    );
  expect(
    await tools
      .get("read_file")!
      .execute({ path: "example.txt" }, { workspaceRoot: root }),
  ).toBe("hello");
  await tools
    .get("edit_file")!
    .execute(
      { path: "example.txt", oldText: "hello", newText: "updated" },
      { workspaceRoot: root },
    );
  expect(await readFile(join(root, "example.txt"), "utf8")).toBe("updated");
  await expect(
    tools
      .get("read_file")!
      .execute({ path: "../escape" }, { workspaceRoot: root }),
  ).rejects.toThrow("path escapes workspace");
});

test("default shell and process tools execute real commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-process-"));
  await writeFile(join(root, "data.txt"), "ok\n");
  const tools = createToolRegistry();
  const shell = await tools
    .get("run_shell")!
    .execute({ command: "cat data.txt" }, { workspaceRoot: root });
  expect(shell).toContain("ok");

  const started = JSON.parse(
    await tools.get("process_start")!.execute(
      {
        id: "proc_test",
        command: "echo ready; sleep 0.2",
        readyPattern: "ready",
        maxOutputBytes: 100,
      },
      { workspaceRoot: root },
    ),
  ) as { id: string; status: string };
  expect(started).toMatchObject({ id: "proc_test", status: "running" });
  await waitForOutput(async () =>
    tools
      .get("process_output")!
      .execute({ id: "proc_test" }, { workspaceRoot: root }),
  );
  expect(
    await tools
      .get("process_output")!
      .execute({ id: "proc_test" }, { workspaceRoot: root }),
  ).toContain("ready");
  expect(
    JSON.parse(
      await tools
        .get("process_ready")!
        .execute({ id: "proc_test", timeoutMs: 2000 }, { workspaceRoot: root }),
    ),
  ).toMatchObject({ ready: true, readyPattern: "ready", maxOutputBytes: 100 });
  const listed = JSON.parse(
    await tools.get("process_list")!.execute({}, { workspaceRoot: root }),
  ) as Array<{ id: string }>;
  expect(listed.some((item) => item.id === "proc_test")).toBe(true);
  const detached = JSON.parse(
    await tools
      .get("process_detach")!
      .execute({ id: "proc_test" }, { workspaceRoot: root }),
  ) as { attached: boolean };
  expect(detached.attached).toBe(false);
  const audit = JSON.parse(
    await tools.get("process_audit")!.execute({}, { workspaceRoot: root }),
  ) as { processes: Array<{ id: string; persistent: boolean }> };
  expect(
    audit.processes.some((item) => item.id === "proc_test" && item.persistent),
  ).toBe(true);
  await tools
    .get("process_stop")!
    .execute({ id: "proc_test" }, { workspaceRoot: root });
});

test("managed process registry reports live workspace process counts", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-process-count-"));
  const registry = new ManagedProcessRegistry();
  const tools = createToolRegistry(undefined, registry);
  await tools
    .get("process_start")!
    .execute(
      { id: "proc_count", command: "sleep 30" },
      { workspaceRoot: root },
    );
  expect(await registry.runningCount({ workspaceRoot: root })).toBe(1);
  await tools
    .get("process_stop")!
    .execute({ id: "proc_count" }, { workspaceRoot: root });
  expect(await registry.runningCount({ workspaceRoot: root })).toBe(0);
});

test("subagent retry is exposed as an explicit continuation tool", () => {
  const tools = createToolRegistry();
  expect(tools.get("agent_retry")?.requiresApproval).toBe(true);
  expect(tools.get("agent_retry")?.description).toContain("continuation");
});

test("plan retains the approval boundary of its durable todo write", () => {
  expect(createToolRegistry().get("plan")?.requiresApproval).toBe(true);
});

test("managed process registry persists state for restart and background aliases", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-persist-"));
  const first = createToolRegistry();
  await first
    .get("background_start")!
    .execute(
      { id: "proc_persist", command: "echo persisted; sleep 0.2" },
      { workspaceRoot: root },
    );
  await waitForOutput(async () =>
    first
      .get("background_output")!
      .execute({ id: "proc_persist" }, { workspaceRoot: root }),
  );

  const second = createToolRegistry();
  const listed = JSON.parse(
    await second.get("background_list")!.execute({}, { workspaceRoot: root }),
  ) as Array<{ id: string }>;
  expect(listed.some((item) => item.id === "proc_persist")).toBe(true);
  expect(
    await second
      .get("background_output")!
      .execute({ id: "proc_persist" }, { workspaceRoot: root }),
  ).toContain("persisted");
  await second
    .get("background_stop")!
    .execute({ id: "proc_persist" }, { workspaceRoot: root });
});

test("managed process restart preserves readiness configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-restart-"));
  const tools = createToolRegistry();
  await tools.get("process_start")!.execute(
    {
      id: "proc_restart",
      command: "echo ready; sleep 1",
      readyPattern: "ready",
      maxOutputBytes: 91,
      stopTimeoutMs: 77,
    },
    { workspaceRoot: root },
  );
  const restarted = JSON.parse(
    await tools
      .get("process_restart")!
      .execute({ id: "proc_restart" }, { workspaceRoot: root }),
  ) as {
    readyPattern?: string;
    maxOutputBytes?: number;
    stopTimeoutMs?: number;
  };
  expect(restarted).toMatchObject({
    readyPattern: "ready",
    maxOutputBytes: 91,
    stopTimeoutMs: 77,
  });
  await tools
    .get("process_stop")!
    .execute({ id: "proc_restart" }, { workspaceRoot: root });
});

test("managed process stop terminates the owned process group", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-process-group-"));
  const tools = createToolRegistry();
  const started = JSON.parse(
    await tools.get("process_start")!.execute(
      {
        id: "proc_group",
        command: "sleep 30 & echo $! > child.pid; wait",
        stopTimeoutMs: 50,
      },
      { workspaceRoot: root },
    ),
  ) as { pid?: number };
  const childPID = Number(await waitForFile(join(root, "child.pid")));
  expect(started.pid).toBeNumber();
  await tools
    .get("process_stop")!
    .execute({ id: "proc_group" }, { workspaceRoot: root });
  await Bun.sleep(100);
  expect(processAlive(started.pid!)).toBe(false);
  expect(processAlive(childPID)).toBe(false);
});

test("managed process output uses a UTF-8 byte budget", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-process-output-"));
  const tools = createToolRegistry();
  await tools.get("process_start")!.execute(
    {
      id: "proc_output",
      command: "printf 'abc界界'; sleep 1",
      maxOutputBytes: 6,
    },
    { workspaceRoot: root },
  );
  await waitForOutput(
    async () =>
      await tools
        .get("process_output")!
        .execute({ id: "proc_output" }, { workspaceRoot: root }),
    "界",
  );
  const output = await tools
    .get("process_output")!
    .execute({ id: "proc_output" }, { workspaceRoot: root });
  expect(Buffer.byteLength(output)).toBeLessThanOrEqual(6);
  await tools
    .get("process_stop")!
    .execute({ id: "proc_output" }, { workspaceRoot: root });
});

test("managed process max runtime stops the owned process group", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-process-deadline-"));
  const tools = createToolRegistry();
  const started = JSON.parse(
    await tools.get("process_start")!.execute(
      {
        id: "proc_deadline",
        command: "sleep 30 & echo $! > child.pid; wait",
        maxRuntimeMs: 100,
      },
      { workspaceRoot: root },
    ),
  ) as { pid?: number; maxRuntimeMs?: number; deadlineAt?: string };
  const childPID = Number(await waitForFile(join(root, "child.pid")));
  expect(started.maxRuntimeMs).toBe(100);
  expect(started.deadlineAt).toBeString();
  await Bun.sleep(250);
  const status = JSON.parse(
    await tools
      .get("process_status")!
      .execute({ id: "proc_deadline" }, { workspaceRoot: root }),
  ) as { status: string };
  expect(status.status).toBe("stopped");
  expect(processAlive(childPID)).toBe(false);
});

test("reopened managed process registry restores a durable deadline", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-tools-process-reopen-deadline-"),
  );
  const first = createToolRegistry();
  await first.get("process_start")!.execute(
    {
      id: "proc_reopen_deadline",
      command: "sleep 30",
      maxRuntimeMs: 150,
    },
    { workspaceRoot: root },
  );
  const reopened = createToolRegistry();
  await reopened.get("process_list")!.execute({}, { workspaceRoot: root });
  await Bun.sleep(300);
  const status = JSON.parse(
    await reopened
      .get("process_status")!
      .execute({ id: "proc_reopen_deadline" }, { workspaceRoot: root }),
  ) as { status: string };
  expect(status.status).toBe("stopped");
});

test("reopened registry immediately stops an overdue durable deadline", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-process-overdue-"));
  const first = createToolRegistry();
  const started = JSON.parse(
    await first
      .get("process_start")!
      .execute(
        { id: "proc_overdue", command: "sleep 30", maxRuntimeMs: 10_000 },
        { workspaceRoot: root },
      ),
  ) as { pid?: number };
  const manifest = join(root, ".natalia", "processes", "processes.json");
  const parsed = JSON.parse(await readFile(manifest, "utf8")) as {
    processes: Array<{ deadlineAt?: string }>;
  };
  parsed.processes[0]!.deadlineAt = new Date(Date.now() - 1).toISOString();
  await writeFile(manifest, `${JSON.stringify(parsed)}\n`);
  const reopened = createToolRegistry();
  const status = JSON.parse(
    await reopened
      .get("process_status")!
      .execute({ id: "proc_overdue" }, { workspaceRoot: root }),
  ) as { status: string };
  expect(status.status).toBe("stopped");
  expect(processAlive(started.pid!)).toBe(false);
});

test("managed process resource limits require positive values", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-process-limits-"));
  const tools = createToolRegistry();
  await expect(
    tools
      .get("process_start")!
      .execute(
        { command: "sleep 1", maxOutputBytes: 0 },
        { workspaceRoot: root },
      ),
  ).rejects.toThrow("value must be a positive number");
  await expect(
    tools
      .get("process_start")!
      .execute(
        { command: "sleep 1", stopTimeoutMs: -1 },
        { workspaceRoot: root },
      ),
  ).rejects.toThrow("value must be a positive number");
});

test("managed process IDs and deadlines are isolated by workspace", async () => {
  const firstRoot = await mkdtemp(
    join(tmpdir(), "natalia-tools-process-first-"),
  );
  const secondRoot = await mkdtemp(
    join(tmpdir(), "natalia-tools-process-second-"),
  );
  const tools = createToolRegistry();
  await tools
    .get("process_start")!
    .execute(
      { id: "proc_same", command: "sleep 30", maxRuntimeMs: 100 },
      { workspaceRoot: firstRoot },
    );
  await tools
    .get("process_start")!
    .execute(
      { id: "proc_same", command: "sleep 30" },
      { workspaceRoot: secondRoot },
    );
  await Bun.sleep(250);
  const first = JSON.parse(
    await tools
      .get("process_status")!
      .execute({ id: "proc_same" }, { workspaceRoot: firstRoot }),
  ) as { status: string };
  const second = JSON.parse(
    await tools
      .get("process_status")!
      .execute({ id: "proc_same" }, { workspaceRoot: secondRoot }),
  ) as { status: string };
  expect(first.status).toBe("stopped");
  expect(second.status).toBe("running");
  await tools
    .get("process_stop")!
    .execute({ id: "proc_same" }, { workspaceRoot: secondRoot });
});

test("native glob grep and durable todo tools operate inside the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-discovery-"));
  await writeFile(join(root, "needle.ts"), "export const needle = 'found';\n");
  await writeFile(join(root, "other.txt"), "nothing here\n");
  const tools = createToolRegistry();
  expect(
    await tools
      .get("glob")!
      .execute({ pattern: "**/*.ts" }, { workspaceRoot: root }),
  ).toBe("needle.ts");
  expect(
    await tools
      .get("grep")!
      .execute(
        { pattern: "needle", include: "**/*.ts" },
        { workspaceRoot: root },
      ),
  ).toContain("needle.ts:1:");
  await tools
    .get("todo_write")!
    .execute(
      { items: [{ content: "finish TS7", status: "in_progress" }] },
      { workspaceRoot: root },
    );
  expect(
    await tools.get("todo_read")!.execute({}, { workspaceRoot: root }),
  ).toContain("finish TS7");
  await tools
    .get("plan")!
    .execute(
      { items: [{ content: "cutover evidence", status: "pending" }] },
      { workspaceRoot: root },
    );
  expect(
    await tools.get("todo_read")!.execute({}, { workspaceRoot: root }),
  ).toContain("cutover evidence");
});

test("glob and grep preflight every exposed or read workspace path", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-read-policy-"));
  await writeFile(join(root, "allowed.ts"), "const value = 'needle';\n");
  await writeFile(join(root, "protected.ts"), "const secret = 'needle';\n");
  const checks: Array<{ toolName: string; paths: string[] }> = [];
  const context = {
    workspaceRoot: root,
    workspaceReadAuthorize: async (input: {
      toolName: "glob" | "grep";
      paths: string[];
    }) => {
      checks.push(input);
      if (input.paths.includes("protected.ts")) throw new Error("protected");
    },
  };
  const tools = createToolRegistry();
  await expect(
    tools.get("glob")!.execute({ pattern: "*.ts" }, context),
  ).rejects.toThrow("protected");
  await expect(
    tools.get("grep")!.execute({ pattern: "needle", include: "*.ts" }, context),
  ).rejects.toThrow("protected");
  expect(checks).toEqual([
    { toolName: "glob", paths: ["allowed.ts", "protected.ts"] },
    { toolName: "grep", paths: ["allowed.ts"] },
    { toolName: "grep", paths: ["protected.ts"] },
  ]);
});

test("media and browser visit tools provide native TS metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-browser-"));
  await writeFile(
    join(root, "image.png"),
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  );
  const tools = createToolRegistry();
  expect(
    await tools
      .get("read_media_file")!
      .execute({ path: "image.png" }, { workspaceRoot: root }),
  ).toContain('"kind": "png"');
  let browserHeaders: Headers | undefined;
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      browserHeaders = request.headers;
      return new Response("<title>TS Browser</title><main>browser-ok</main>");
    },
  });
  try {
    expect(
      await tools.get("browser_visit")!.execute(
        { url: server.url.toString() },
        {
          workspaceRoot: root,
          settings: {
            allowLocalhost: true,
            allowedSchemes: ["http"],
            browserUserAgent: "Natalia browser test",
            browserHeaders: { "x-natalia-test": "enabled" },
          },
        },
      ),
    ).toContain("browser-ok");
    expect(browserHeaders?.get("user-agent")).toBe("Natalia browser test");
    expect(browserHeaders?.get("x-natalia-test")).toBe("enabled");
    await expect(
      tools
        .get("browser_visit")!
        .execute(
          { url: server.url.toString() },
          { workspaceRoot: root, settings: { allowLocalhost: false } },
        ),
    ).rejects.toThrow("localhost network access is not allowed");
    await expect(
      tools
        .get("browser_visit")!
        .execute(
          { url: server.url.toString() },
          { workspaceRoot: root, settings: { allowedSchemes: ["https"] } },
        ),
    ).rejects.toThrow("network scheme is not allowed");
    await expect(
      tools
        .get("browser_visit")!
        .execute(
          { url: server.url.toString() },
          { workspaceRoot: root, settings: { browserEnabled: false } },
        ),
    ).rejects.toThrow("browser tools are disabled");
  } finally {
    server.stop(true);
  }
});

test("ask_user tool delegates to the runtime question channel", async () => {
  const tools = createToolRegistry();
  const result = await tools.get("ask_user")!.execute(
    { question: "Pick one", options: ["yes", "no"] },
    {
      workspaceRoot: tmpdir(),
      askQuestion: async (request) => {
        expect(request.questions[0]?.options).toEqual([
          { label: "yes" },
          { label: "no" },
        ]);
        return [["yes"]];
      },
    },
  );
  expect(result).toContain("yes");
});

test("web_search uses a native configured endpoint without proxying Go", async () => {
  const tools = createToolRegistry();
  const saved = process.env.NATALIA_WEB_SEARCH_URL;
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      expect(new URL(request.url).searchParams.get("q")).toBe("Natalia TS7");
      return new Response("native search result");
    },
  });
  process.env.NATALIA_WEB_SEARCH_URL = server.url.toString();
  try {
    await expect(
      tools
        .get("web_search")!
        .execute({ query: "Natalia TS7" }, { workspaceRoot: tmpdir() }),
    ).resolves.toContain("native search result");
  } finally {
    server.stop(true);
    if (saved) process.env.NATALIA_WEB_SEARCH_URL = saved;
    else delete process.env.NATALIA_WEB_SEARCH_URL;
  }
});

test("web_search selects the configured endpoint only when its priority permits", async () => {
  const tools = createToolRegistry();
  const configured = Bun.serve({
    port: 0,
    fetch: () => new Response("configured provider result"),
  });
  try {
    await expect(
      tools.get("web_search")!.execute(
        { query: "priority" },
        {
          workspaceRoot: tmpdir(),
          settings: {
            webSearchEndpoint: configured.url.toString(),
            webSearchProviderPriority: ["configured", "duckduckgo"],
            allowLocalhost: true,
          },
        },
      ),
    ).resolves.toContain("configured provider result");
  } finally {
    configured.stop(true);
  }
});

test("interactive Terminal tools keep model I/O on one native host pane", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-interactive-"));
  const writes: string[] = [];
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      return "native terminal output";
    },
    async write(_paneID, data) {
      writes.push(data);
    },
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  const startResult = await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_tools" }, context);
  const started = JSON.parse(startResult) as {
    id: string;
    status: string;
    paneID: number;
  };
  expect(started).toMatchObject({
    id: "tty_tools",
    status: "running",
    paneID: 73,
  });
  await tools
    .get("interactive_terminal_write")!
    .execute({ id: "tty_tools", input: "tool input\n" }, context);
  expect(
    JSON.parse(
      await tools
        .get("interactive_terminal_send_line")!
        .execute(
          { id: "tty_tools", text: "atomic command", idempotencyKey: "line_1" },
          context,
        ),
    ),
  ).toMatchObject({ writtenBytes: 15, submitted: true, delivery: "accepted" });
  expect(
    JSON.parse(
      await tools.get("interactive_terminal_write")!.execute(
        {
          id: "tty_tools",
          input: "idempotent input\n",
          idempotencyKey: "write_1",
        },
        context,
      ),
    ),
  ).toMatchObject({ delivery: "accepted" });
  expect(
    JSON.parse(
      await tools.get("interactive_terminal_write")!.execute(
        {
          id: "tty_tools",
          input: "idempotent input\n",
          idempotencyKey: "write_1",
        },
        context,
      ),
    ),
  ).toMatchObject({ delivery: "duplicate" });
  await tools
    .get("interactive_terminal_keys")!
    .execute({ id: "tty_tools", key: "ctrl-c" }, context);
  await nativeTerminal.openHub();
  await nativeTerminal.claimHumanInput("tty_tools");
  await expect(
    tools
      .get("interactive_terminal_write")!
      .execute({ id: "tty_tools", input: "must not interleave" }, context),
  ).rejects.toThrow("controlled by a human");
  nativeTerminal.releaseHumanControl("tty_tools");
  expect(
    await tools
      .get("interactive_terminal_read")!
      .execute({ id: "tty_tools" }, context),
  ).toContain("native terminal output");
  expect(writes.join("")).toBe(
    "tool input\natomic command\ridempotent input\n\x03",
  );
  expect(tools.has("interactive_start")).toBe(true);
  expect(tools.has("interactive_send_line")).toBe(true);
  expect(tools.has("interactive_terminal_attach")).toBe(false);
  expect(tools.has("interactive_terminal_detach")).toBe(false);
  expect(tools.has("interactive_attach")).toBe(false);
  expect(tools.has("interactive_detach")).toBe(false);
  expect(tools.get("interactive_start")?.name).toBe(
    "interactive_terminal_start",
  );
  expect([...tools.keys()]).not.toContain("interactive_start");
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_tools" }, context);
});

test("encodes normalized native terminal key sequences", () => {
  expect(encodeTerminalKey({ key: "enter" })).toBe("\r");
  expect(encodeTerminalKey({ key: "Esc" })).toBe("\x1b");
  expect(encodeTerminalKey({ key: "ArrowUp", modifiers: ["ctrl"] })).toBe(
    "\x1b[1;5A",
  );
  expect(
    encodeTerminalKey({ key: "Delete", modifiers: ["alt", "shift"] }),
  ).toBe("\x1b[3;4~");
  expect(encodeTerminalKey({ key: "F12", repeat: 2 })).toBe("\x1b[24~\x1b[24~");
  expect(encodeTerminalKey({ key: "c", modifiers: ["ctrl", "alt"] })).toBe(
    "\x1b\x03",
  );
  expect(encodeTerminalKey({ text: "你好", repeat: 2 })).toBe("你好你好");
  expect(() => encodeTerminalKey({ key: "Unknown" })).toThrow(
    "unsupported terminal key",
  );
  expect(() =>
    encodeTerminalKey({ key: "Enter", modifiers: ["ctrl"] }),
  ).toThrow("not encodable");
  expect(encodeTerminalKey({ key: "V" })).toBe("V");
  expect(encodeTerminalKey({ key: "A", modifiers: ["ctrl"] })).toBe("\x01");
  expect(encodeTerminalKey({ text: "vim" })).toBe("vim");
  expect(encodeTerminalKey({ text: "你好🚀" })).toBe("你好🚀");
});

test("unified interactive terminal input tool sends text and key sequences", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-input-"));
  const writes: string[] = [];
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      return "native terminal output";
    },
    async write(_paneID, data) {
      writes.push(data);
    },
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_input" }, context);
  await tools
    .get("interactive_terminal_input")!
    .execute({ id: "tty_input", text: "vim" }, context);
  expect(writes.at(-1)).toBe("vim\r");
  await tools
    .get("interactive_terminal_input")!
    .execute({ id: "tty_input", text: "vim", submit: false }, context);
  expect(writes.at(-1)).toBe("vim");
  await tools.get("interactive_terminal_input")!.execute(
    {
      id: "tty_input",
      keys: [{ key: "ArrowUp" }, { key: "Enter" }],
    },
    context,
  );
  expect(writes.at(-1)).toBe("\x1b[A\r");
  await tools.get("interactive_terminal_input")!.execute(
    {
      id: "tty_input",
      text: "vim",
      keys: [{ key: "Escape" }],
      submit: false,
    },
    context,
  );
  expect(writes.at(-1)).toBe("vim\x1b");
  await tools
    .get("interactive_terminal_input")!
    .execute({ id: "tty_input", text: "Vim" }, context);
  expect(writes.at(-1)).toBe("Vim\r");
  expect(tools.has("interactive_input")).toBe(true);
  expect(tools.has("interactive_terminal_input")).toBe(true);
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_input" }, context);
});

test("interactive terminal snapshot returns cursor and revision without afterRevision", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-snapshot-"));
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      return "snapshot output";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_snapshot" }, context);
  const snap = JSON.parse(
    await tools
      .get("interactive_terminal_snapshot")!
      .execute({ id: "tty_snapshot" }, context),
  );
  expect(snap).toMatchObject({
    id: "tty_snapshot",
    host: "wezterm",
    text: "snapshot output",
    cursorX: 0,
    cursorY: 0,
    rows: 24,
    cols: 80,
    status: "running",
    inputOwner: "model",
  });
  expect(typeof snap.revision).toBe("number");
  expect(tools.has("interactive_snapshot")).toBe(true);
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_snapshot" }, context);
});

test("terminal observe latest mode returns current state without waiting", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-observe-"));
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      return "latest output";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_observe" }, context);
  const obs = JSON.parse(
    await tools
      .get("terminal_observe")!
      .execute(
        { id: "tty_observe", afterRevision: 0, mode: "latest" },
        context,
      ),
  );
  expect(obs).toMatchObject({
    id: "tty_observe",
    mode: "latest",
    text: "latest output",
    cursorX: 0,
    cursorY: 0,
    rows: 24,
    cols: 80,
    currentRevision: expect.any(Number),
  });
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_observe" }, context);
});

test("terminal observe tail mode returns only recent lines", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-observe-"));
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      return "line1\nline2\nline3\nline4\nline5\n";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_tail" }, context);
  const obs = JSON.parse(
    await tools
      .get("terminal_observe")!
      .execute(
        { id: "tty_tail", afterRevision: 0, mode: "tail", scrollbackRows: 3 },
        context,
      ),
  );
  expect(obs.text).toBe("line3\nline4\nline5");
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_tail" }, context);
});

test("terminal observe cursor mode returns lines around cursor", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-observe-"));
  const lines =
    Array.from({ length: 30 }, (_, i) => `line${i}`).join("\n") + "\n";
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [
        {
          pane_id: 73,
          window_id: 3,
          tab_id: 5,
          rows: 24,
          cols: 80,
          cursor_x: 0,
          cursor_y: 15,
        },
      ];
    },
    async read() {
      return lines;
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_cursor" }, context);
  const obs = JSON.parse(
    await tools
      .get("terminal_observe")!
      .execute({ id: "tty_cursor", afterRevision: 0, mode: "cursor" }, context),
  );
  expect(obs.cursorY).toBe(15);
  expect(obs.text).toContain(
    Array.from({ length: 11 }, (_, i) => `line${i + 10}`).join("\n") + "\n",
  );
  expect(obs.text).not.toContain("line0");
  expect(obs.text).not.toContain("line29");
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_cursor" }, context);
});

test("terminal observe new_only mode returns only new text since last observation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-observe-"));
  let readCall = 0;
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      readCall += 1;
      if (readCall === 1) return "initial text\n";
      return "initial text\nnew line 1\nnew line 2\n";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_new_only" }, context);
  const first = JSON.parse(
    await tools
      .get("terminal_observe")!
      .execute(
        { id: "tty_new_only", afterRevision: 0, mode: "new_only" },
        context,
      ),
  );
  expect(first.text).toBe("initial text\n");
  const second = JSON.parse(
    await tools.get("terminal_observe")!.execute(
      {
        id: "tty_new_only",
        afterRevision: first.currentRevision,
        mode: "new_only",
      },
      context,
    ),
  );
  expect(second.text).toBe("new line 1\nnew line 2\n");
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_new_only" }, context);
});

test("interactive terminal input paste mode wraps text in bracketed paste escape sequences", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-paste-"));
  const writes: string[] = [];
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      return "native terminal output";
    },
    async write(_paneID, data) {
      writes.push(data);
    },
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_paste" }, context);
  await tools
    .get("interactive_terminal_input")!
    .execute({ id: "tty_paste", text: "hello world", paste: true }, context);
  expect(writes.at(-1)).toBe("\x1b[?2004hhello world\x1b[?2004l");
  const result = JSON.parse(
    await tools
      .get("interactive_terminal_input")!
      .execute({ id: "tty_paste", text: "vim", paste: true }, context),
  );
  expect(result.submitted).toBe(false);
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_paste" }, context);
});

test("terminal observe afterRevision is optional and defaults to current state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-observe-"));
  const nativeTerminal = new NativeTerminalRegistry({
    kind: "wezterm",
    executable: "wezterm",
    async spawn() {
      return { pane_id: 73, window_id: 3, tab_id: 5 };
    },
    async list() {
      return [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }];
    },
    async read() {
      return "no afterRevision output";
    },
    async write() {},
    async focus() {},
    async resize() {},
    async stop() {},
  });
  const context = { workspaceRoot: root, nativeTerminal };
  const tools = createToolRegistry();
  await tools
    .get("interactive_terminal_start")!
    .execute({ command: "cat", id: "tty_no_ar" }, context);
  const obs = JSON.parse(
    await tools
      .get("terminal_observe")!
      .execute({ id: "tty_no_ar", mode: "latest" }, context),
  );
  expect(obs.text).toBe("no afterRevision output");
  expect(obs.currentRevision).toBe(obs.revision);
  await tools
    .get("interactive_terminal_stop")!
    .execute({ id: "tty_no_ar" }, context);
});

test("native terminal scrollback pages preserve CJK line boundaries and cursors", () => {
  const text = Array.from(
    { length: 4_000 },
    (_, index) => `第${index}行\n`,
  ).join("");
  const first = nativeTerminalReadPage(text, { startLine: 100 });
  expect(first).toMatchObject({
    truncated: true,
    totalBytes: new TextEncoder().encode(text).byteLength,
    endLine: 100 + first.deliveredLines - 1,
    nextStartLine: 100 + first.deliveredLines,
  });
  expect(first.text.endsWith("\n")).toBe(true);
  expect(new TextDecoder().decode(new TextEncoder().encode(first.text))).toBe(
    first.text,
  );
  const final = nativeTerminalReadPage("最后一行", { startLine: 4_100 });
  expect(final).toMatchObject({
    truncated: false,
    deliveredLines: 1,
    endLine: 4_100,
    nextStartLine: undefined,
  });
});

test("native terminal search pages bounded Unicode matches without screen transport", () => {
  const text = Array.from(
    { length: 200 },
    (_, index) => `line ${index}${index % 50 === 0 ? " 命中" : ""}\n`,
  ).join("");
  const result = nativeTerminalSearchPage(text, {
    query: "命中",
    startLine: 500,
    endLine: 900,
    requestedEndLine: 900,
    maxMatches: 2,
  });
  expect(result).toMatchObject({
    searchedRange: { startLine: 500, endLine: 699, scannedLines: 200 },
    matches: [
      { line: 500, text: "line 0 命中" },
      { line: 550, text: "line 50 命中" },
    ],
    truncatedMatches: true,
    nextCursor: { startLine: 700, endLine: 900 },
  });
  const final = nativeTerminalSearchPage("one\n命中\n", {
    query: "命中",
    startLine: 900,
    endLine: 901,
    requestedEndLine: 901,
    maxMatches: 20,
  });
  expect(final).toMatchObject({
    matches: [{ line: 901, text: "命中" }],
    nextCursor: undefined,
  });
});

test("sandbox tools create execute diff and merge through the registry", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-sandbox-"));
  const events: string[] = [];
  const context = {
    workspaceRoot: root,
    sandboxes: new WorkspaceSandboxManager(join(root, ".natalia", "sandboxes")),
    onSandboxEvent: (event: { type: string }) => events.push(event.type),
  };
  const tools = createToolRegistry();
  await tools.get("sandbox_create")!.execute({ id: "box" }, context);
  expect(
    await tools
      .get("sandbox_execute")!
      .execute({ id: "box", command: "printf sandbox-tool-ok" }, context),
  ).toContain("sandbox-tool-ok");
  await tools
    .get("sandbox_write")!
    .execute(
      { id: "box", path: "nested/note.txt", content: "sandbox content" },
      context,
    );
  expect(
    await tools.get("sandbox_diff")!.execute({ id: "box" }, context),
  ).toContain("nested/note.txt");
  await tools.get("sandbox_merge")!.execute({ id: "box" }, context);
  expect(await readFile(join(root, "nested", "note.txt"), "utf8")).toBe(
    "sandbox content",
  );
  expect(events).toContain("sandbox.update");
  const resource = JSON.parse(
    await tools.get("sandbox_resource_start")!.execute(
      {
        id: "box",
        resourceID: "resource_tool",
        command: "printf tool-resource; sleep 30",
      },
      context,
    ),
  ) as { id: string };
  await waitForOutput(
    async () =>
      tools
        .get("sandbox_resource_output")!
        .execute({ id: "box", resourceID: resource.id }, context),
    "tool-resource",
  );
  expect(
    await tools.get("sandbox_resource_list")!.execute({ id: "box" }, context),
  ).toContain("resource_tool");
  await tools
    .get("sandbox_resource_stop")!
    .execute({ id: "box", resourceID: resource.id }, context);
  await tools.get("sandbox_delete")!.execute({ id: "box" }, context);
  expect(events).toContain("sandbox.audit");
});

async function waitForOutput(read: () => Promise<string>, expected = "ready") {
  for (let index = 0; index < 50; index++) {
    if ((await read()).includes(expected)) return;
    await Bun.sleep(20);
  }
}

async function waitForInteractiveOutput(read: () => string) {
  for (let index = 0; index < 100; index++) {
    if (read().includes("tool input")) return;
    await Bun.sleep(20);
  }
  throw new Error(`timed out waiting for interactive tool output: ${read()}`);
}

function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(path: string) {
  for (let index = 0; index < 50; index++) {
    try {
      return await readFile(path, "utf8");
    } catch {
      await Bun.sleep(20);
    }
  }
  throw new Error(`timed out waiting for ${path}`);
}
