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
  expect(registry.runningCount()).toBe(1);
  await registry.write(started.id, "hello");
  await waitForInteractive(() => registry.get(started.id).transcript, "hello");
  expect(registry.get(started.id).transcript).toContain("hello");
  expect(registry.get(started.id).transcript.match(/hello/gu)?.length).toBe(1);
  expect(registry.get(started.id).screen.text).toContain("hello");
  expect(registry.get(started.id).revision).toBeGreaterThan(0);
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
  expect(registry.runningCount()).toBe(0);
});

test("interactive PTY subscriptions omit full transcript from live updates", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-light-update-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({ command: "cat", cwd: root });
  const updates: import("../src").InteractivePTYUpdate[] = [];
  const unsubscribe = registry.subscribe(started.id, (update) =>
    updates.push(update),
  );
  await registry.write(started.id, "lightweight");
  await waitForInteractive(
    () => registry.get(started.id).transcript,
    "lightweight",
  );
  await Bun.sleep(250);
  expect(updates.length).toBeGreaterThan(0);
  expect(updates.every((update) => update.transcript === undefined)).toBe(true);
  expect(registry.get(started.id).transcript).toContain("lightweight");
  unsubscribe();
  await registry.stop(started.id);
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

test("interactive PTY projects ANSI style through the xterm framebuffer", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-screen-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({
    command: "printf '\\033[31;1mRED\\033[0m\\n'; cat",
    cwd: root,
  });
  await waitForInteractive(() => registry.get(started.id).screen.text, "RED");
  expect(registry.get(started.id).screen.lines[0]?.[0]).toEqual([
    "R",
    1,
    1,
    undefined,
    1,
  ]);
  await registry.stop(started.id);
});

test("terminal observation waits for revision changes, timeout, exit and abort", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-observe-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({ command: "cat", cwd: root });
  const pending = registry.observe(started.id, {
    afterRevision: started.revision,
    timeoutMs: 2000,
  });
  await registry.write(started.id, "observe me");
  expect(await pending).toMatchObject({
    changed: true,
    reason: "changed",
    afterRevision: started.revision,
    session: { screen: { text: expect.stringContaining("observe me") } },
  });

  const differentialRevision = registry.get(started.id).revision;
  const differential = registry.observe(started.id, {
    afterRevision: differentialRevision,
    timeoutMs: 2000,
    differential: true,
  });
  await registry.write(started.id, "x");
  const differentialResult = await differential;
  expect(differentialResult).toMatchObject({
    changed: true,
    screenUpdate: { kind: "patch" },
    screenDelivery: {
      mode: "patch",
      reason: "differential",
    },
    session: { screen: undefined },
  });
  expect(differentialResult.screenDelivery!.payloadBytes).toBeLessThan(
    differentialResult.screenDelivery!.fullBytes,
  );

  const resizeRevision = registry.get(started.id).revision;
  const resized = registry.observe(started.id, {
    afterRevision: resizeRevision,
    timeoutMs: 2000,
    differential: true,
  });
  await registry.resize(started.id, 30, 100);
  expect(await resized).toMatchObject({
    screenUpdate: { kind: "full" },
    screenDelivery: {
      mode: "full",
      reason: "incompatible_frame",
    },
  });

  for (let index = 0; index < 9; index++) {
    const before = registry.get(started.id).revision;
    const changed = registry.observe(started.id, {
      afterRevision: before,
      timeoutMs: 2000,
    });
    await registry.write(started.id, `history-${index}`);
    expect((await changed).changed).toBe(true);
  }
  expect(
    await registry.observe(started.id, {
      afterRevision: 0,
      timeoutMs: 2000,
      differential: true,
    }),
  ).toMatchObject({
    screenUpdate: { kind: "full" },
    screenDelivery: { mode: "full", reason: "missing_base" },
  });

  const revision = registry.get(started.id).revision;
  expect(
    await registry.observe(started.id, {
      afterRevision: revision,
      timeoutMs: 5,
    }),
  ).toMatchObject({ changed: false, reason: "timeout" });

  const exited = registry.observe(started.id, {
    afterRevision: revision,
    timeoutMs: 2000,
  });
  await registry.stop(started.id);
  expect(await exited).toMatchObject({ changed: false, reason: "exited" });

  const second = await registry.start({ command: "cat", cwd: root });
  const controller = new AbortController();
  const aborted = registry.observe(second.id, {
    afterRevision: second.revision,
    timeoutMs: 2000,
    signal: controller.signal,
  });
  controller.abort(new DOMException("turn cancelled", "AbortError"));
  await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
  await registry.stop(second.id);
});

test("terminal viewers require explicit ownership and return it on release", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-owner-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({ command: "cat", cwd: root });
  expect(
    registry.registerViewer(started.id, {
      viewerID: "viewer_one",
      kind: "external",
    }),
  ).toMatchObject({
    inputOwner: { type: "model" },
    geometryOwner: { type: "model" },
    viewers: [{ id: "viewer_one", kind: "external" }],
  });
  await expect(
    registry.viewerWrite(started.id, "viewer_one", "blocked\n"),
  ).rejects.toThrow("terminal input ownership required");

  expect(registry.takeoverViewer(started.id, "viewer_one")).toMatchObject({
    inputOwner: { type: "viewer", viewerID: "viewer_one" },
    geometryOwner: { type: "viewer", viewerID: "viewer_one" },
  });
  await expect(registry.write(started.id, "model blocked")).rejects.toThrow(
    "controlled by viewer",
  );
  await expect(registry.resize(started.id, 30, 100)).rejects.toThrow(
    "geometry is controlled by viewer",
  );
  await registry.viewerWrite(started.id, "viewer_one", "viewer input\n");
  await waitForInteractive(
    () => registry.get(started.id).screen.text,
    "viewer input",
  );
  expect(
    await registry.viewerResize(started.id, "viewer_one", 30, 100),
  ).toMatchObject({ rows: 30, cols: 100 });
  await registry.viewerWrite(started.id, "viewer_one", "viewer-secret\n", {
    sensitive: true,
  });
  await Bun.sleep(50);
  expect(registry.get(started.id).transcript).not.toContain("viewer-secret");
  expect(registry.get(started.id).screen.text).not.toContain("viewer-secret");
  expect(registry.secretAudit(started.id).at(-1)).toMatchObject({
    action: "write",
    summary: expect.stringContaining("sensitive viewer input"),
  });

  registry.registerViewer(started.id, {
    viewerID: "viewer_two",
    kind: "external",
  });
  expect(() => registry.takeoverViewer(started.id, "viewer_two")).toThrow(
    "already controlled by viewer",
  );
  expect(await registry.releaseViewer(started.id, "viewer_one")).toMatchObject({
    inputOwner: { type: "model" },
    geometryOwner: { type: "model" },
    rows: 36,
    cols: 120,
  });
  await registry.write(started.id, "model resumed");
  registry.takeoverViewer(started.id, "viewer_one");
  expect(
    await registry.unregisterViewer(started.id, "viewer_one"),
  ).toMatchObject({
    inputOwner: { type: "model" },
    geometryOwner: { type: "model" },
    viewers: [{ id: "viewer_two" }],
  });
  await registry.stop(started.id);
});

test("terminal viewer watchdog expires ownership without later activity", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-watchdog-"));
  const expired: string[] = [];
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"), {
    viewerTimeoutMs: 20,
    watchdogIntervalMs: 5,
    onViewerExpired: (_session, viewerID) => expired.push(viewerID),
  });
  const started = await registry.start({ command: "cat", cwd: root });
  registry.registerViewer(started.id, {
    viewerID: "viewer_stale",
    kind: "external",
  });
  registry.takeoverViewer(started.id, "viewer_stale");
  await registry.viewerResize(started.id, "viewer_stale", 30, 100);
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && expired.length === 0) await Bun.sleep(5);
  expect(expired).toEqual(["viewer_stale"]);
  expect(registry.get(started.id)).toMatchObject({
    viewers: [],
    inputOwner: { type: "model" },
    geometryOwner: { type: "model" },
    rows: 36,
    cols: 120,
  });
  registry.dispose();
  await registry.stop(started.id);
});

test("embedded viewer can heartbeat, take control, and submit Unicode", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-embedded-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({ command: "cat", cwd: root });
  registry.registerViewer(started.id, {
    viewerID: "embedded_test",
    kind: "embedded",
  });
  expect(
    registry.heartbeatViewer(started.id, "embedded_test").viewers,
  ).toHaveLength(1);
  registry.takeoverViewer(started.id, "embedded_test");
  await registry.viewerWrite(started.id, "embedded_test", "你好\r");
  await waitForInteractive(() => registry.get(started.id).screen.text, "你好");
  expect(registry.get(started.id).inputOwner).toEqual({
    type: "viewer",
    viewerID: "embedded_test",
  });
  await registry.unregisterViewer(started.id, "embedded_test");
  expect(registry.get(started.id).inputOwner).toEqual({ type: "model" });
  registry.dispose();
  await registry.stop(started.id);
});

test("embedded viewer can own geometry while model retains input", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-geometry-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({ command: "cat", cwd: root });
  registry.registerViewer(started.id, {
    viewerID: "embedded_geometry",
    kind: "embedded",
  });
  expect(
    registry.takeGeometryViewer(started.id, "embedded_geometry"),
  ).toMatchObject({
    inputOwner: { type: "model" },
    geometryOwner: { type: "viewer", viewerID: "embedded_geometry" },
  });
  await registry.viewerResize(started.id, "embedded_geometry", 45, 140);
  await registry.write(started.id, "model still writes");
  registry.takeoverViewer(started.id, "embedded_geometry");
  expect(
    registry.releaseInputViewer(started.id, "embedded_geometry"),
  ).toMatchObject({
    inputOwner: { type: "model" },
    geometryOwner: { type: "viewer", viewerID: "embedded_geometry" },
    rows: 45,
    cols: 140,
  });
  expect(
    await registry.unregisterViewer(started.id, "embedded_geometry"),
  ).toMatchObject({
    inputOwner: { type: "model" },
    geometryOwner: { type: "model" },
    rows: 36,
    cols: 120,
  });
  registry.dispose();
  await registry.stop(started.id);
});

test("sensitive viewer input is redacted from delayed child output", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-secure-"));
  const registry = new InteractivePTYRegistry(join(root, ".natalia", "pty"));
  const started = await registry.start({
    command: "IFS= read -r secret; printf 'delayed:%s\\n' \"$secret\"; cat",
    cwd: root,
  });
  registry.registerViewer(started.id, {
    viewerID: "viewer_secure",
    kind: "external",
  });
  registry.takeoverViewer(started.id, "viewer_secure");
  await registry.viewerWrite(started.id, "viewer_secure", "late-secret\n", {
    sensitive: true,
  });
  await waitForInteractive(
    () => registry.get(started.id).screen.text,
    "delayed:[redacted]",
  );
  expect(registry.get(started.id).transcript).not.toContain("late-secret");
  expect(registry.get(started.id).screen.text).not.toContain("late-secret");
  await registry.unregisterViewer(started.id, "viewer_secure");
  registry.dispose();
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
