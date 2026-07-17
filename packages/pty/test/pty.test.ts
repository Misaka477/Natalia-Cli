import { expect, test } from "bun:test";
import {
  applyPTYAction,
  appendPTYOutput,
  createPTYSession,
  detectPrompt,
  ptyActionEvent,
  ptyUpdateEvent,
  PTYOutputCoalescer,
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
