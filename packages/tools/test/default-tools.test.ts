import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { createToolRegistry } from "../src";
import { InteractivePTYRegistry } from "@natalia/pty";
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

test("subagent retry is exposed as an explicit continuation tool", () => {
  const tools = createToolRegistry();
  expect(tools.get("agent_retry")?.requiresApproval).toBe(true);
  expect(tools.get("agent_retry")?.description).toContain("continuation");
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
  ) as { pid?: number; maxRuntimeMs?: number };
  const childPID = Number(await waitForFile(join(root, "child.pid")));
  expect(started.maxRuntimeMs).toBe(100);
  await Bun.sleep(250);
  const status = JSON.parse(
    await tools
      .get("process_status")!
      .execute({ id: "proc_deadline" }, { workspaceRoot: root }),
  ) as { status: string };
  expect(status.status).toBe("stopped");
  expect(processAlive(childPID)).toBe(false);
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
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response("<title>TS Browser</title><main>browser-ok</main>"),
  });
  try {
    expect(
      await tools
        .get("browser_visit")!
        .execute({ url: server.url.toString() }, { workspaceRoot: root }),
    ).toContain("browser-ok");
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

test("interactive tools operate a real persistent PTY through the registry", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tools-interactive-"));
  const interactivePTY = new InteractivePTYRegistry(
    join(root, ".natalia", "pty"),
  );
  const context = { workspaceRoot: root, interactivePTY };
  const tools = createToolRegistry();
  const started = JSON.parse(
    await tools
      .get("interactive_start")!
      .execute({ command: "cat", id: "tty_tools" }, context),
  ) as { id: string; status: string };
  expect(started).toMatchObject({ id: "tty_tools", status: "running" });
  await tools
    .get("interactive_write")!
    .execute({ id: "tty_tools", input: "tool input\n" }, context);
  await waitForInteractiveOutput(
    () => interactivePTY.get("tty_tools").transcript,
  );
  expect(
    await tools.get("interactive_read")!.execute({ id: "tty_tools" }, context),
  ).toContain("tool input");
  expect(
    await tools
      .get("interactive_resize")!
      .execute({ id: "tty_tools", rows: 40, cols: 100 }, context),
  ).toContain('"rows": 40');
  await tools.get("interactive_stop")!.execute({ id: "tty_tools" }, context);
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
