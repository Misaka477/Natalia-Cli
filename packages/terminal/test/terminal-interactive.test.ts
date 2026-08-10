import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyTerminalAction,
  appendTerminalOutput,
  createTerminalSession,
  detectPrompt,
  terminalActionEvent,
  terminalUpdateEvent,
  TerminalOutputCoalescer,
  ModelTerminalRegistry,
  redactSensitiveInput,
  sanitizeTerminalOutput,
} from "../src";

const target = { kind: "host" as const, cwd: "/repo" };

test("Terminal presentation model tracks lifecycle and independent actions", () => {
  const session = createTerminalSession({
    id: "terminal_1",
    command: "bash",
    cwd: "/repo",
    target,
  });
  appendTerminalOutput(session, { text: "ready\n$" });
  expect(session.status).toBe("running");
  expect(session.activity).toBe("waiting");
  expect(session.prompt).toBe("$");

  applyTerminalAction(session, "resize", { rows: 40, cols: 120 });
  expect(session.rows).toBe(40);
  expect(session.cols).toBe(120);
  expect(terminalActionEvent(session, "write", true)).toMatchObject({
    type: "terminal.action",
    redacted: true,
  });
  expect(terminalUpdateEvent(session)).toMatchObject({
    type: "terminal.update",
    id: "terminal_1",
  });
});

test("Terminal sensitive input redacts and prompt detection works", () => {
  expect(redactSensitiveInput("secret")).toBe("******");
  expect(detectPrompt("Password:".toLowerCase())).toBe("password prompt");
  expect(detectPrompt("$ ")).toBe("$ ");
  expect(detectPrompt("# ")).toBe("# ");
  expect(detectPrompt("PS C:\\Users\\admin> ")).toBe("PS C:\\Users\\admin> ");
  expect(detectPrompt(">>> ")).toBe(">>> ");
  expect(detectPrompt("In [1]: ")).toBe("In [1]: ");
  expect(detectPrompt("❯ ")).toBe("❯ ");
  expect(detectPrompt("➜ ")).toBe("➜ ");
  expect(detectPrompt("-- NORMAL --")).toBe("-- NORMAL --");
  expect(detectPrompt("-- INSERT --")).toBe("-- INSERT --");
  expect(detectPrompt("-- VISUAL --")).toBe("-- VISUAL --");
  expect(detectPrompt("-- VISUAL BLOCK --")).toBe("-- VISUAL BLOCK --");
  expect(detectPrompt("-- REPLACE --")).toBe("-- REPLACE --");
  expect(detectPrompt("not a prompt line")).toBeUndefined();
});

test("output burst coalescing keeps lifecycle events while batching output", () => {
  const session = createTerminalSession({
    id: "terminal_burst",
    command: "bash",
    cwd: "/repo",
    target,
  });
  const coalescer = new TerminalOutputCoalescer();
  expect(coalescer.push(session, { text: "a" })).toEqual([]);
  expect(coalescer.push(session, { text: "b" })).toEqual([]);
  expect(
    coalescer.push(session, { text: "exit", lifecycle: true }),
  ).toHaveLength(1);
  expect(coalescer.flush(session)).toHaveLength(1);
});

test("terminal retains full transcript while tail remains a bounded presentation summary", () => {
  const session = createTerminalSession({
    id: "terminal_history",
    command: "bash",
    cwd: "/repo",
    target,
  });
  appendTerminalOutput(session, { text: "a".repeat(5000) }, 100);
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

test("model terminal registry pauses high-risk actions until approval then executes serially", async () => {
  const registry = new ModelTerminalRegistry();
  registry.create({
    id: "terminal_model",
    command: "bash",
    cwd: "/repo",
    target,
  });
  const pending = await registry.request("terminal_model", {
    action: "submit",
    input: "npm install package",
    requiresApproval: true,
    reason: "install requires approval",
  });
  expect(pending.state).toBe("awaiting_approval");
  if (pending.state !== "awaiting_approval")
    throw new Error("expected approval wait");
  expect(registry.get("terminal_model").status).toBe("awaiting_approval");
  expect(
    pending.events.some((event) => event.type === "terminal.approval"),
  ).toBe(true);

  const executed = await registry.resolveApproval(pending.approvalID, true);
  expect(executed.state).toBe("executed");
  expect(
    executed.events.some(
      (event) => event.type === "terminal.action" && event.redacted === false,
    ),
  ).toBe(true);
  expect(registry.get("terminal_model").ownership).toBe("model");
});

test("model terminal registry does not execute rejected approvals", async () => {
  const registry = new ModelTerminalRegistry();
  registry.create({
    id: "terminal_reject",
    command: "bash",
    cwd: "/repo",
    target,
  });
  const pending = await registry.request("terminal_reject", {
    action: "special_key",
    requiresApproval: true,
  });
  if (pending.state !== "awaiting_approval")
    throw new Error("expected approval wait");
  const result = await registry.resolveApproval(pending.approvalID, false);
  expect(result.state).toBe("rejected");
  expect(
    result.events.some(
      (event) =>
        event.type === "terminal.approval" && event.state === "rejected",
    ),
  ).toBe(true);
});

test("model terminal registry reuses a persistent session instead of recreating it", () => {
  const registry = new ModelTerminalRegistry();
  const first = registry.create({
    id: "terminal_persistent",
    command: "bash",
    cwd: "/repo",
    target,
  });
  const second = registry.create({
    id: "terminal_persistent",
    command: "bash",
    cwd: "/repo",
    target,
  });
  expect(first.events.some((event) => event.type === "terminal.timeline")).toBe(
    true,
  );
  expect(second.events).toEqual([]);
  expect(second.session).toBe(first.session);
});

test("model terminal exit preserves exited lifecycle status", async () => {
  const registry = new ModelTerminalRegistry();
  registry.create({
    id: "terminal_exit",
    command: "bash",
    cwd: "/repo",
    target,
  });
  const result = await registry.request("terminal_exit", { action: "exit" });
  expect(result.state).toBe("executed");
  expect(registry.get("terminal_exit").status).toBe("exited");
  expect(
    result.events.find((event) => event.type === "terminal.update"),
  ).toMatchObject({
    status: "exited",
  });
});

test("a terminal session ID can be recreated after model exit", async () => {
  const registry = new ModelTerminalRegistry();
  const first = registry.create({
    id: "terminal_reopen",
    command: "bash",
    cwd: "/repo",
    target,
  });
  await registry.request("terminal_reopen", { action: "exit" });
  const recreated = registry.create({
    id: "terminal_reopen",
    command: "bash",
    cwd: "/repo",
    target,
  });
  expect(recreated.session).not.toBe(first.session);
  expect(recreated.session.status).toBe("starting");
  expect(
    recreated.events.some((event) => event.type === "terminal.timeline"),
  ).toBe(true);
});

async function waitForTranscript(read: () => Promise<string>) {
  for (let index = 0; index < 50; index++) {
    if ((await read()).includes("terminal-persist")) return;
    await Bun.sleep(20);
  }
  throw new Error("timed out waiting for terminal transcript");
}

async function waitForInteractive(read: () => string, expected: string) {
  for (let index = 0; index < 100; index++) {
    const value = read();
    if (value.includes(expected)) return;
    await Bun.sleep(20);
  }
  throw new Error("timed out waiting for interactive terminal output");
}
