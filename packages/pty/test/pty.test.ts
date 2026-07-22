import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyPTYAction,
  appendPTYOutput,
  createPTYSession,
  detectPrompt,
  ptyActionEvent,
  ptyUpdateEvent,
  PTYOutputCoalescer,
  ModelPTYRegistry,
  PersistentPTYRegistry,
  InteractivePTYRegistry,
  redactSensitiveInput,
  sanitizeTerminalOutput,
  runRealPTYCommand,
} from "../src";

const target = { kind: "host" as const, cwd: "/repo" };

test("PTY presentation model tracks lifecycle and independent actions", () => {
  const session = createPTYSession({
    id: "pty_1",
    command: "bash",
    cwd: "/repo",
    target,
  });
  appendPTYOutput(session, { text: "ready\n$" });
  expect(session.status).toBe("running");
  expect(session.activity).toBe("waiting");
  expect(session.prompt).toBe("$");

  applyPTYAction(session, "resize", { rows: 40, cols: 120 });
  expect(session.rows).toBe(40);
  expect(session.cols).toBe(120);
  expect(ptyActionEvent(session, "write", true)).toMatchObject({
    type: "pty.action",
    redacted: true,
  });
  expect(ptyUpdateEvent(session)).toMatchObject({
    type: "pty.update",
    id: "pty_1",
  });
});

test("PTY sensitive input redacts and prompt detection works", () => {
  expect(redactSensitiveInput("secret")).toBe("******");
  expect(detectPrompt("Password:".toLowerCase())).toBe("password prompt");
});

test("runs a real command through an operating-system pseudo terminal", async () => {
  const result = await runRealPTYCommand({
    id: "pty_real",
    command: "printf 'pty-ok\\n'",
    cwd: process.cwd(),
  });
  expect(result.exitCode).toBe(0);
  expect(result.state.transcript).toContain("pty-ok");
  expect(result.state.status).toBe("exited");
  expect(result.events.map((event) => event.type)).toEqual([
    "pty.update",
    "pty.action",
  ]);
});

test("persistent PTY registry records transcript and attach state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-persist-"));
  const registry = new PersistentPTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({
    id: "tty_persist",
    command: "printf 'pty-persist\\n'",
    cwd: root,
  });
  expect(started).toMatchObject({ id: "tty_persist", status: "exited" });
  await waitForTranscript(async () => await registry.transcript("tty_persist"));
  expect(await registry.transcript("tty_persist")).toContain("pty-persist");
  expect(await registry.detach("tty_persist")).toMatchObject({
    attached: false,
  });

  const reopened = new PersistentPTYRegistry(join(root, ".natalia", "pty"));
  expect(
    (await reopened.list()).some((item) => item.id === "tty_persist"),
  ).toBe(true);
});

test("interactive PTY registry writes input, special keys, resize and transcript", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-interactive-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({
    command: "cat",
    cwd: root,
    rows: 30,
    cols: 100,
  });
  expect(started).toMatchObject({ status: "running", rows: 30, cols: 100 });
  await registry.write(started.id, "hello");
  await waitForInteractive(() => registry.get(started.id).transcript, "hello");
  expect(registry.get(started.id).transcript).toContain("hello");
  expect(registry.get(started.id).transcript.match(/hello/gu)?.length).toBe(1);
  expect(registry.read(started.id, { maxChars: 2 })).toMatchObject({
    offset: expect.any(Number),
    nextOffset: expect.any(Number),
    totalChars: expect.any(Number),
  });
  expect(await registry.resize(started.id, 40, 120)).toMatchObject({
    rows: 40,
    cols: 120,
  });
  expect(await registry.detach(started.id)).toMatchObject({ attached: false });
  expect(await registry.attach(started.id)).toMatchObject({ attached: true });
  await registry.specialKey(started.id, "ctrl-d");
  expect(await registry.stop(started.id)).toMatchObject({ status: "exited" });
});

test("interactive PTY sensitive input is redacted and audited", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-secret-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({ command: "cat", cwd: root });
  await registry.write(started.id, "super-secret", { sensitive: true });
  await waitForInteractive(
    () => registry.get(started.id).transcript,
    "[sensitive input redacted]",
  );
  expect(registry.get(started.id).transcript).not.toContain("super-secret");
  expect(registry.get(started.id).transcript).toContain(
    "[sensitive input redacted]",
  );
  expect(registry.secretAudit(started.id)[0]).toMatchObject({
    action: "write",
    summary: expect.stringContaining("redacted"),
  });
  await Bun.sleep(50);
  expect(
    await Bun.file(join(root, ".natalia", "pty", `${started.id}.log`)).text(),
  ).not.toContain("super-secret");
  await registry.stop(started.id);
});

test("output burst coalescing keeps lifecycle events while batching output", () => {
  const session = createPTYSession({
    id: "pty_burst",
    command: "bash",
    cwd: "/repo",
    target,
  });
  const coalescer = new PTYOutputCoalescer();
  expect(coalescer.push(session, { text: "a" })).toEqual([]);
  expect(coalescer.push(session, { text: "b" })).toEqual([]);
  expect(
    coalescer.push(session, { text: "exit", lifecycle: true }),
  ).toHaveLength(1);
  expect(coalescer.flush(session)).toHaveLength(1);
});

test("PTY retains full transcript while tail remains a bounded presentation summary", () => {
  const session = createPTYSession({
    id: "pty_history",
    command: "bash",
    cwd: "/repo",
    target,
  });
  appendPTYOutput(session, { text: "a".repeat(5000) }, 100);
  expect(session.transcript).toHaveLength(5000);
  expect(session.tail).toHaveLength(100);
});

test("terminal sanitizer removes OSC shell integration metadata", () => {
  const transcript = sanitizeTerminalOutput(
    "\u001b]1337;start=secret-machine-metadata\u0007hello\r\n\u001b]1337;end=secret\u001b\\$ ",
  );
  expect(transcript).toBe("hello\r\n$ ");
  expect(transcript).not.toContain("machine-metadata");
});

test("model PTY registry pauses high-risk actions until approval then executes serially", async () => {
  const registry = new ModelPTYRegistry();
  registry.create({ id: "pty_model", command: "bash", cwd: "/repo", target });
  const pending = await registry.request("pty_model", {
    action: "submit",
    input: "npm install package",
    requiresApproval: true,
    reason: "install requires approval",
  });
  expect(pending.state).toBe("awaiting_approval");
  if (pending.state !== "awaiting_approval")
    throw new Error("expected approval wait");
  expect(registry.get("pty_model").status).toBe("awaiting_approval");
  expect(pending.events.some((event) => event.type === "pty.approval")).toBe(
    true,
  );

  const executed = await registry.resolveApproval(pending.approvalID, true);
  expect(executed.state).toBe("executed");
  expect(
    executed.events.some(
      (event) => event.type === "pty.action" && event.redacted === false,
    ),
  ).toBe(true);
  expect(registry.get("pty_model").ownership).toBe("model");
});

test("model PTY registry does not execute rejected approvals", async () => {
  const registry = new ModelPTYRegistry();
  registry.create({ id: "pty_reject", command: "bash", cwd: "/repo", target });
  const pending = await registry.request("pty_reject", {
    action: "special_key",
    requiresApproval: true,
  });
  if (pending.state !== "awaiting_approval")
    throw new Error("expected approval wait");
  const result = await registry.resolveApproval(pending.approvalID, false);
  expect(result.state).toBe("rejected");
  expect(
    result.events.some(
      (event) => event.type === "pty.approval" && event.state === "rejected",
    ),
  ).toBe(true);
});

test("model PTY registry reuses a persistent session instead of recreating it", () => {
  const registry = new ModelPTYRegistry();
  const first = registry.create({
    id: "pty_persistent",
    command: "bash",
    cwd: "/repo",
    target,
  });
  const second = registry.create({
    id: "pty_persistent",
    command: "bash",
    cwd: "/repo",
    target,
  });
  expect(first.events.some((event) => event.type === "pty.timeline")).toBe(
    true,
  );
  expect(second.events).toEqual([]);
  expect(second.session).toBe(first.session);
});

test("model PTY exit preserves exited lifecycle status", async () => {
  const registry = new ModelPTYRegistry();
  registry.create({ id: "pty_exit", command: "bash", cwd: "/repo", target });
  const result = await registry.request("pty_exit", { action: "exit" });
  expect(result.state).toBe("executed");
  expect(registry.get("pty_exit").status).toBe("exited");
  expect(
    result.events.find((event) => event.type === "pty.update"),
  ).toMatchObject({
    status: "exited",
  });
});

test("a terminal PTY session ID can be recreated after model exit", async () => {
  const registry = new ModelPTYRegistry();
  const first = registry.create({
    id: "pty_reopen",
    command: "bash",
    cwd: "/repo",
    target,
  });
  await registry.request("pty_reopen", { action: "exit" });
  const recreated = registry.create({
    id: "pty_reopen",
    command: "bash",
    cwd: "/repo",
    target,
  });
  expect(recreated.session).not.toBe(first.session);
  expect(recreated.session.status).toBe("starting");
  expect(recreated.events.some((event) => event.type === "pty.timeline")).toBe(
    true,
  );
});

async function waitForTranscript(read: () => Promise<string>) {
  for (let index = 0; index < 50; index++) {
    if ((await read()).includes("pty-persist")) return;
    await Bun.sleep(20);
  }
  throw new Error("timed out waiting for PTY transcript");
}

async function waitForInteractive(read: () => string, expected: string) {
  for (let index = 0; index < 100; index++) {
    const value = read();
    if (value.includes(expected)) return;
    await Bun.sleep(20);
  }
  throw new Error("timed out waiting for interactive PTY output");
}
