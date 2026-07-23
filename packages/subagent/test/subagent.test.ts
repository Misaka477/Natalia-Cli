import { expect, test, mock, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentRegistry, SubagentStore } from "../src";

function tempDir() {
  return mkdtemp(join(tmpdir(), "natalia-subagent-"));
}

function immediateRunner(
  task: string,
  ctx: { log: (t: string) => void; setStatus: (s: string) => void },
) {
  ctx.log(`starting: ${task}`);
  ctx.log(`done: ${task}`);
  ctx.setStatus("completed");
}

async function delayedRunner(
  task: string,
  ctx: {
    log: (t: string) => void;
    setStatus: (s: string) => void;
    signal: AbortSignal;
  },
) {
  ctx.log(`starting: ${task}`);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      ctx.setStatus("stopped");
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (ctx.signal.aborted) {
      onAbort();
      return;
    }
    ctx.signal.addEventListener("abort", onAbort, { once: true });
    setTimeout(() => {
      ctx.signal.removeEventListener("abort", onAbort);
      ctx.log(`done: ${task}`);
      ctx.setStatus("completed");
      resolve();
    }, 50);
  });
}

afterEach(() => {});

test("spawn creates record and runs runner", async () => {
  const dir = await tempDir();
  const reg = new SubagentRegistry({ runner: immediateRunner, workDir: dir });
  const rec = await reg.spawn("test task");
  expect(rec.id).toBe("a1");
  expect(rec.task).toBe("test task");
  expect(rec.status).toBe("completed");
  expect(rec.outputs.length).toBe(2);
  expect(rec.outputs[0].text).toBe("starting: test task");
  expect(rec.outputs[1].text).toBe("done: test task");
});

test("spawn rejects empty task", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  expect(reg.spawn("")).rejects.toThrow("task is required");
});

test("list returns spawned agents", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  expect(reg.list()).toHaveLength(0);
  await reg.spawn("task1");
  await reg.spawn("task2");
  expect(reg.list()).toHaveLength(2);
});

test("get returns agent by id", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  const rec = await reg.spawn("get test");
  expect(reg.get("a1")).toBe(rec);
  expect(reg.get("nonexistent" as any)).toBeUndefined();
});

test("status returns agent status", async () => {
  const reg = new SubagentRegistry({ runner: delayedRunner });
  const rec = await reg.spawn("status test");
  expect(rec.status).toBe("running");
  expect(reg.runningCount()).toBe(1);
  await new Promise((r) => setTimeout(r, 100));
  expect(rec.status).toBe("completed");
  expect(reg.runningCount()).toBe(0);
});

test("output returns agent outputs", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("output test");
  const outputs = reg.output("a1");
  expect(outputs).toBeDefined();
  expect(outputs).toHaveLength(2);
  expect(reg.output("missing" as any)).toBeUndefined();
});

test("formatOutput defaults to the concise final result and keeps verbose audit opt-in", async () => {
  const root = await tempDir();
  const registry = new SubagentRegistry({
    workDir: root,
    runner: async (_task, context) => {
      context.log("thinking: internal detail");
      context.log("final factual result");
    },
  });
  const agent = await registry.spawn("concise output");
  for (let index = 0; index < 50; index++) {
    if (registry.status(agent.id) === "completed") break;
    await Bun.sleep(10);
  }
  expect(await registry.formatOutput(agent.id)).toContain(
    "final factual result",
  );
  expect(await registry.formatOutput(agent.id)).not.toContain("thinking:");
  expect(await registry.formatOutput(agent.id, true)).toContain(
    "thinking: internal detail",
  );
});

test("stop aborts running agent", async () => {
  const dir = await tempDir();
  const reg = new SubagentRegistry({ runner: delayedRunner, workDir: dir });
  await reg.spawn("stop test");
  expect(reg.status("a1")).toBe("running");
  const ok = reg.stop("a1");
  expect(ok).toBeTrue();
  await new Promise((r) => setTimeout(r, 20));
  expect(reg.status("a1")).toBe("stopped");
});

test("stop persists a running agent status without waiting for completion", async () => {
  const dir = await tempDir();
  const reg = new SubagentRegistry({ runner: delayedRunner, workDir: dir });
  await reg.spawn("persist stop");
  expect(reg.stop("a1")).toBeTrue();
  await Bun.sleep(20);
  expect((await new SubagentStore(dir).load())[0]?.status).toBe("stopped");
});

test("stop returns false for unknown agent", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  expect(reg.stop("missing" as any)).toBeFalse();
});

test("resume restarts a paused runner", async () => {
  let runs = 0;
  const reg = new SubagentRegistry({
    runner: async () => {
      runs++;
    },
  });
  await reg.spawn("resume test");
  await Bun.sleep(10);
  expect(await reg.resume("a1")).toBeFalse();
  const rec = reg.get("a1")!;
  (rec as any).status = "paused";
  expect(await reg.resume("a1")).toBeTrue();
  await Bun.sleep(10);
  expect(runs).toBe(2);
  expect(rec.status).toBe("completed");
});

test("resume returns false for unknown agent", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  expect(await reg.resume("missing" as any)).toBeFalse();
});

test("attach/detach toggle attached flag", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("attach test");
  const rec = reg.get("a1")!;
  expect(rec.attached).toBeTrue();
  expect(reg.detach("a1")).toBeTrue();
  expect(rec.attached).toBeFalse();
  expect(reg.attach("a1")).toBeTrue();
  expect(rec.attached).toBeTrue();
  expect(reg.detach("missing" as any)).toBeFalse();
  expect(reg.attach("missing" as any)).toBeFalse();
});

test("cleanup removes completed/failed/stopped agents", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("c1");
  await reg.spawn("c2");
  await new Promise((r) => setTimeout(r, 10));
  const affected = reg.cleanup();
  expect(affected).toHaveLength(2);
  expect(reg.list()).toHaveLength(0);
});

test("cleanup dry run does not remove agents", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("dry");
  await new Promise((r) => setTimeout(r, 10));
  const affected = reg.cleanup(true);
  expect(affected).toHaveLength(1);
  expect(reg.list()).toHaveLength(1);
});

test("audit returns text format by default", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("audit test");
  const audit = reg.audit();
  expect(audit).not.toBe("<no agent audit entries>");
  expect(audit).toContain("event_id=");
  expect(audit).toContain("agent_id=");
  expect(audit).toContain("action=");
  expect(audit).toContain("status=");
});

test("audit returns json format", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("json audit");
  const json = reg.audit(undefined, "json");
  expect(json).toStartWith("[");
  expect(json).toContain("event_id");
  expect(json).toContain("resource_type");
  expect(json).toContain("agent_id");
  expect(json).toContain("action");
  expect(json).toContain("status");
  expect(json).toContain("time");
});

test("audit tail limits entries", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("tail test");
  await reg.spawn("tail test 2");
  const tail = reg.audit(1);
  const lines = tail.split("\n");
  expect(lines).toHaveLength(1);
});

test("audit returns no entries message when empty", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  expect(reg.audit()).toBe("<no agent audit entries>");
});

test("subscribe receives events", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  const events: any[] = [];
  const unsub = reg.subscribe((e) => events.push(e));
  await reg.spawn("events");
  await new Promise((r) => setTimeout(r, 10));
  expect(events.length).toBeGreaterThanOrEqual(3);
  expect(events[0].event).toBe("created");
  const done = events.find((e) => e.event === "done");
  expect(done).toBeDefined();
  unsub();
});

test("subscribe unsubscribe stops events", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  const events: any[] = [];
  const unsub = reg.subscribe((e) => events.push(e));
  unsub();
  await reg.spawn("unsub");
  await new Promise((r) => setTimeout(r, 10));
  expect(events).toHaveLength(0);
});

test("formatList returns formatted output", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  const formatted = await reg.formatList();
  expect(formatted).toBe("no subagents");
  await reg.spawn("format list");
  const list = await reg.formatList();
  expect(list).toContain("a1");
  expect(list).toContain("completed");
  expect(list).toContain("format list");
  expect(list).toContain("remaining_resources:");
});

test("formatOutput returns a concise result and can expose full agent outputs", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("format out");
  const out = await reg.formatOutput("a1");
  expect(out).toContain("done: format out");
  expect(out).not.toContain("starting: format out");
  expect(await reg.formatOutput("a1", true)).toContain("starting: format out");
  expect(reg.formatOutput("missing" as any)).rejects.toThrow("not found");
});

test("formatStatus returns detailed agent info", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  await reg.spawn("status detail");
  const s = await reg.formatStatus("a1");
  expect(s).toContain("a1");
  expect(s).toContain("completed");
  expect(s).toContain("status detail");
  expect(reg.formatStatus("missing" as any)).rejects.toThrow("not found");
});

test("store saves and loads manifest", async () => {
  const dir = await tempDir();
  const store = new SubagentStore(dir);
  const records = await store.load();
  expect(records).toHaveLength(0);
  const now = Date.now();
  await store.save([
    {
      id: "a1" as any,
      task: "persist",
      mode: "code",
      status: "completed",
      attached: true,
      modelProfile: "",
      allowedTools: [],
      excludeTools: [],
      outputs: [{ step: 1, text: "ok", timestamp: now }],
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const loaded = await store.load();
  expect(loaded).toHaveLength(1);
  expect(loaded[0].id).toBe("a1");
  expect(loaded[0].task).toBe("persist");
  expect(loaded[0].outputs[0].text).toBe("ok");
});

test("store handles missing directory", async () => {
  const dir = await tempDir();
  const store = new SubagentStore(join(dir, "nonexistent"));
  const records = await store.load();
  expect(records).toHaveLength(0);
});

test("store handles corrupt manifest", async () => {
  const dir = await tempDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), "{corrupt");
  const store = new SubagentStore(dir);
  const records = await store.load();
  expect(records).toHaveLength(0);
});

test("spawn respects AbortSignal from options", async () => {
  const reg = new SubagentRegistry({ runner: delayedRunner });
  const ac = new AbortController();
  const spawnPromise = reg.spawn("abortable", { signal: ac.signal });
  ac.abort();
  const rec = await spawnPromise;
  expect(rec.status).toBe("stopped");
});

test("spawn sets mode and modelProfile from options", async () => {
  const reg = new SubagentRegistry({ runner: immediateRunner });
  const rec = await reg.spawn("options", {
    mode: "debug",
    modelProfile: "strong",
    allowedTools: ["read", "write"],
    excludeTools: ["delete"],
  });
  expect(rec.mode).toBe("debug");
  expect(rec.modelProfile).toBe("strong");
  expect(rec.allowedTools).toEqual(["read", "write"]);
  expect(rec.excludeTools).toEqual(["delete"]);
});

test("load restores agents from store on construction", async () => {
  const dir = await tempDir();
  const store = new SubagentStore(dir);
  const now = Date.now();
  await store.save([
    {
      id: "a1" as any,
      task: "pre existing",
      mode: "code",
      status: "completed",
      attached: false,
      modelProfile: "",
      allowedTools: [],
      excludeTools: [],
      outputs: [{ step: 1, text: "done", timestamp: now }],
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const reg = new SubagentRegistry({ runner: immediateRunner, workDir: dir });
  await reg.load();
  expect(reg.list()).toHaveLength(1);
  expect(reg.get("a1" as any)?.task).toBe("pre existing");
});

test("load marks process-local running agents stopped after runtime restart", async () => {
  const dir = await tempDir();
  const store = new SubagentStore(dir);
  const now = Date.now();
  await store.save([
    {
      id: "a1" as any,
      task: "interrupted",
      mode: "code",
      status: "running",
      attached: true,
      modelProfile: "",
      allowedTools: [],
      excludeTools: [],
      outputs: [],
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const registry = new SubagentRegistry({
    runner: immediateRunner,
    workDir: dir,
  });
  await registry.load();
  expect(registry.status("a1" as any)).toBe("stopped");
  expect(registry.output("a1" as any)?.at(-1)?.text).toContain(
    "runtime restarted",
  );
  expect((await store.load())[0]?.status).toBe("stopped");
});

test("retry explicitly starts a new continuation for stopped subagents", async () => {
  const root = await tempDir();
  let calls = 0;
  const registry = new SubagentRegistry({
    workDir: root,
    runner: async (_task, context) => {
      calls++;
      context.log(`run ${calls}`);
      if (calls === 1) throw new Error("first run failed");
    },
  });
  const record = await registry.spawn("retry task", {
    parentSessionID: "ses_parent",
  });
  for (let attempt = 0; attempt < 20 && record.status !== "failed"; attempt++)
    await Bun.sleep(5);
  expect(record.status).toBe("failed");
  const retried = await registry.retry(record.id);
  for (
    let attempt = 0;
    attempt < 20 && record.status !== "completed";
    attempt++
  )
    await Bun.sleep(5);
  expect(retried?.continuation).toBe(1);
  expect(record.status).toBe("completed");
  expect(record.parentSessionID).toBe("ses_parent");
  expect(
    record.outputs.some((output) =>
      output.text.includes("retrying continuation 1"),
    ),
  ).toBe(true);
});

test("spawn enforces configured nested subagent depth", async () => {
  const registry = new SubagentRegistry({ runner: immediateRunner });
  const root = await registry.spawn("root", { maxDepth: 2 });
  const child = await registry.spawn("child", {
    parentAgentID: root.id,
    maxDepth: 2,
  });
  await expect(
    registry.spawn("grandchild", { parentAgentID: child.id, maxDepth: 2 }),
  ).rejects.toThrow("depth limit reached (2)");
  expect(child.parentAgentID).toBe(root.id);
});

test("save persists to store", async () => {
  const dir = await tempDir();
  const reg = new SubagentRegistry({ runner: immediateRunner, workDir: dir });
  await reg.spawn("save test");
  await reg.save();
  const store = new SubagentStore(dir);
  const records = await store.load();
  expect(records).toHaveLength(1);
  expect(records[0].task).toBe("save test");
});

test("spawn auto-saves after runner completes", async () => {
  const dir = await tempDir();
  const reg = new SubagentRegistry({ runner: delayedRunner, workDir: dir });
  await reg.spawn("auto save");
  await new Promise((r) => setTimeout(r, 100));
  const store = new SubagentStore(dir);
  const records = await store.load();
  expect(records).toHaveLength(1);
  expect(records[0].status).toBe("completed");
});

test("runner failure sets failed status", async () => {
  const reg = new SubagentRegistry({
    runner: async (
      _task: string,
      ctx: {
        log: (t: string) => void;
        setStatus: (s: string) => void;
        signal: AbortSignal;
      },
    ) => {
      ctx.setStatus("running");
      throw new Error("runner failed");
    },
  });
  const rec = await reg.spawn("fail test");
  await new Promise((r) => setTimeout(r, 10));
  expect(rec.status).toBe("failed");
  expect(rec.outputs.some((o) => o.text.includes("runner failed"))).toBeTrue();
});
