import { expect, test } from "bun:test";
import {
  applyPTYAction,
  appendPTYOutput,
  createPTYSession,
  detectPrompt,
  ptyActionEvent,
  ptyUpdateEvent,
  PTYOutputCoalescer,
  ModelPTYRegistry,
  redactSensitiveInput,
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
