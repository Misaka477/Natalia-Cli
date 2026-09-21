import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPtyTerminalController,
  type PtyFactory,
  type PtyProcess,
} from "../src";

function fakePty(): { factory: PtyFactory; processes: PtyProcess[] } {
  const processes: PtyProcess[] = [];
  let nextPid = 1000;
  const factory: PtyFactory = () => {
    const dataListeners = new Set<(data: string) => void>();
    const exitListeners = new Set<
      (event: { exitCode: number; signal?: number }) => void
    >();
    const process: PtyProcess & {
      emit(data: string): void;
      exit(code?: number): void;
    } = {
      pid: nextPid++,
      write(data) {
        for (const listener of dataListeners) listener(data);
      },
      resize() {},
      kill() {
        process.exit(0);
      },
      onData(listener) {
        dataListeners.add(listener);
        return {
          dispose() {
            dataListeners.delete(listener);
          },
        };
      },
      onExit(listener) {
        exitListeners.add(listener);
        return {
          dispose() {
            exitListeners.delete(listener);
          },
        };
      },
      emit(data) {
        for (const listener of dataListeners) listener(data);
      },
      exit(code = 0) {
        for (const listener of exitListeners) listener({ exitCode: code });
      },
    };
    processes.push(process);
    return process;
  };
  return { factory, processes };
}

function controllerInput(
  root: string,
  spawn: PtyFactory,
  events: unknown[] = [],
) {
  return {
    workspaceRoot: root,
    publish: (event: unknown) => {
      events.push(event);
    },
    onPerformance: () => undefined,
    runtimeID: () => "runtime-test",
    userRuntimeHome: () => undefined,
    windowMode: () => "windowless" as const,
    spawn,
  };
}

test("pty controller start is idempotent per terminal id, not per natalia session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-idempotent-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  await controller.init();
  await controller.init();
  const first = await controller.start({
    command: "bash",
    cwd: root,
    id: "term_a",
    sessionID: "ses_one",
  });
  const same = await controller.start({
    command: "zsh",
    cwd: root,
    id: "term_a",
    sessionID: "ses_one",
  });
  const second = await controller.start({
    command: "zsh",
    cwd: root,
    id: "term_b",
    sessionID: "ses_one",
  });
  expect(same.id).toBe(first.id);
  expect(second.id).not.toBe(first.id);
  expect(first.host).toBe("pty");
  expect(processes).toHaveLength(2);
  expect(await controller.list()).toHaveLength(2);
  await controller.close();
});

test("pty controller start with the same id returns the running session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-same-id-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  const first = await controller.start({
    command: "bash",
    cwd: root,
    id: "term_web",
  });
  const second = await controller.start({
    command: "bash",
    cwd: root,
    id: "term_web",
  });
  expect(second.id).toBe(first.id);
  expect(processes).toHaveLength(1);
  await controller.close();
});

test("pty controller write, read, resize, and observe", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-io-"));
  const { factory } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  const started = await controller.start({ command: "cat", cwd: root });
  const written = await controller.write(started.id, "hello\n");
  expect(written).toEqual({ writtenBytes: 6, delivery: "accepted" });
  const duplicate = await controller.write(started.id, "hello\n", {
    idempotencyKey: "k1",
  });
  expect(duplicate.delivery).toBe("accepted");
  const again = await controller.write(started.id, "hello\n", {
    idempotencyKey: "k1",
  });
  expect(again.delivery).toBe("duplicate");
  const snapshot = await controller.snapshot(started.id);
  expect(snapshot.text).toBe("hello\nhello\n");
  const read = await controller.read(started.id);
  expect(read.text).toBe("hello\nhello\n");
  const resized = await controller.resize(started.id, 40, 120, "human");
  expect(resized.rows).toBe(40);
  expect(resized.cols).toBe(120);
  const observed = await controller.observe(started.id, 0, { timeoutMs: 50 });
  expect(observed.changed).toBe(true);
  await controller.close();
});

test("pty controller close kills remaining processes and rejects later start", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-close-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  await controller.start({ command: "bash", cwd: root, sessionID: "ses_a" });
  await controller.close();
  await controller.close();
  expect(await controller.list()).toEqual([]);
  expect((processes[0] as { pid: number }).pid).toBeGreaterThan(0);
  await expect(
    controller.start({ command: "bash", cwd: root }),
  ).rejects.toThrow("terminal controller is closed");
  await expect(controller.init()).rejects.toThrow(
    "terminal controller is closed",
  );
});

test("pty controller start without an id creates a new terminal each time", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-default-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  const first = await controller.start({ command: "bash", cwd: root });
  const second = await controller.start({ command: "bash", cwd: root });
  expect(second.id).not.toBe(first.id);
  expect(processes).toHaveLength(2);
  await controller.close();
});

test("pty controller isolates sessions via setActiveSession", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-isolate-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  controller.setActiveSession("ses_a");
  const a = await controller.start({
    command: "bash",
    cwd: root,
    sessionID: "ses_a",
  });
  controller.setActiveSession("ses_b");
  const b = await controller.start({
    command: "bash",
    cwd: root,
    sessionID: "ses_b",
  });
  expect(a.id).not.toBe(b.id);
  expect(processes).toHaveLength(2);
  expect(await controller.list()).toEqual([
    expect.objectContaining({ id: b.id }),
  ]);
  await expect(controller.read(a.id)).rejects.toThrow(/belongs to session/);
  await expect(controller.write(a.id, "from-b\n")).rejects.toThrow(
    /belongs to session/,
  );
  controller.setActiveSession("ses_a");
  expect((await controller.list()).map((session) => session.id)).toEqual([
    a.id,
  ]);
  expect((await controller.read(a.id)).text).toBe("");
  await expect(controller.write(a.id, "from-a\n")).resolves.toMatchObject({
    delivery: "accepted",
  });
  await controller.close();
});

test("pty controller subscribeOutput replays buffer then live chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-subscribe-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  const started = await controller.start({ command: "cat", cwd: root });
  await controller.write(started.id, "hello\n");
  const chunks: string[] = [];
  const unsubscribe = controller.subscribeOutput!(started.id, (chunk) => {
    chunks.push(chunk);
  });
  expect(chunks).toEqual(["hello\n"]);
  (processes[0] as PtyProcess & { emit(data: string): void }).emit("world\n");
  expect(chunks).toEqual(["hello\n", "world\n"]);
  unsubscribe();
  (processes[0] as PtyProcess & { emit(data: string): void }).emit("ignored\n");
  expect(chunks).toEqual(["hello\n", "world\n"]);
  await controller.close();
});

test("default python pty spawn runs an interactive shell", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-python-pty-"));
  const controller = createPtyTerminalController({
    workspaceRoot: root,
    publish: () => undefined,
    onPerformance: () => undefined,
    runtimeID: () => "runtime-test",
    userRuntimeHome: () => undefined,
    windowMode: () => "windowless",
  });
  const started = await controller.start({
    command: "printf '__PTY_READY__\\n'",
    cwd: root,
    sessionID: "ses_python_pty",
  });
  expect(started.host).toBe("pty");
  let text = "";
  const unsubscribe = controller.subscribeOutput!(started.id, (chunk) => {
    text += chunk;
  });
  const deadline = Date.now() + 8_000;
  while (!text.includes("__PTY_READY__") && Date.now() < deadline)
    await Bun.sleep(50);
  unsubscribe();
  expect(text).toContain("__PTY_READY__");
  await controller.close();
}, 15_000);

test("input written the instant a pty starts is not dropped by the bridge", async () => {
  // Regression: the python bridge reads the startup spec with its own line
  // reader. An input message that landed in the same socket read as the spec
  // was left in that reader's buffer while the select loop only watched for
  // NEW bytes, so the first write of a freshly started terminal vanished.
  // Hosts write the moment start() resolves, so the wait is deliberately zero.
  const root = await mkdtemp(join(tmpdir(), "natalia-python-pty-race-"));
  const controller = createPtyTerminalController({
    workspaceRoot: root,
    publish: () => undefined,
    onPerformance: () => undefined,
    runtimeID: () => "runtime-test",
    userRuntimeHome: () => undefined,
    windowMode: () => "windowless",
  });
  const started = await controller.start({
    // The managed pane shell wraps commands in a profile-sourcing `sh -lc`;
    // the bash
    // inside is interactive but must not read the developer's rc files to
    // keep the test deterministic.
    command: "exec bash --norc --noprofile",
    cwd: root,
    sessionID: "ses_python_pty_race",
  });
  expect(started.host).toBe("pty");
  await controller.write(started.id, "printf '__PTY_READY__\\n'\n");
  let text = "";
  const unsubscribe = controller.subscribeOutput!(started.id, (chunk) => {
    text += chunk;
  });
  const deadline = Date.now() + 8_000;
  while (!text.includes("__PTY_READY__") && Date.now() < deadline)
    await Bun.sleep(50);
  unsubscribe();
  expect(text).toContain("__PTY_READY__");
  await controller.close();
}, 15_000);
test("pty controller caps running terminals per natalia session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-cap-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController({
    ...controllerInput(root, factory),
    maxPerSession: 2,
  });
  await controller.start({
    command: "bash",
    cwd: root,
    id: "term_1",
    sessionID: "ses_cap",
  });
  await controller.start({
    command: "bash",
    cwd: root,
    id: "term_2",
    sessionID: "ses_cap",
  });
  await expect(
    controller.start({
      command: "bash",
      cwd: root,
      id: "term_3",
      sessionID: "ses_cap",
    }),
  ).rejects.toThrow("session already has 2 running terminals");
  expect(processes).toHaveLength(2);
  await controller.close();
});

test("pty controller recycles the oldest idle terminal when the cap is hit", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-idle-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController({
    ...controllerInput(root, factory),
    maxPerSession: 2,
    idleMs: 20,
  });
  const first = await controller.start({
    command: "bash",
    cwd: root,
    id: "term_old",
    sessionID: "ses_idle",
  });
  await controller.start({
    command: "bash",
    cwd: root,
    id: "term_new",
    sessionID: "ses_idle",
  });
  await Bun.sleep(30);
  const third = await controller.start({
    command: "bash",
    cwd: root,
    id: "term_third",
    sessionID: "ses_idle",
  });
  expect(third.id).toBe("term_third");
  expect(processes).toHaveLength(3);
  const listed = (await controller.list()).filter(
    (session) => session.status === "running",
  );
  expect(listed.map((session) => session.id).sort()).toEqual([
    "term_new",
    "term_third",
  ]);
  expect(listed.find((session) => session.id === first.id)).toBeUndefined();
  await controller.close();
});

test("pty controller stopForSession kills every pane of that session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-stop-session-"));
  const { factory } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  await controller.start({
    command: "bash",
    cwd: root,
    id: "a1",
    sessionID: "ses_a",
  });
  await controller.start({
    command: "bash",
    cwd: root,
    id: "a2",
    sessionID: "ses_a",
  });
  await controller.start({
    command: "bash",
    cwd: root,
    id: "b1",
    sessionID: "ses_b",
  });
  await controller.stopForSession!("ses_a");
  controller.setActiveSession("ses_a");
  expect(
    (await controller.list()).filter((session) => session.status === "running"),
  ).toEqual([]);
  controller.setActiveSession("ses_b");
  expect(
    (await controller.list())
      .filter((session) => session.status === "running")
      .map((session) => session.id),
  ).toEqual(["b1"]);
  await controller.close();
});

test("pty controller refuses to reuse a terminal id from another session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-owner-"));
  const { factory } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  await controller.start({
    command: "bash",
    cwd: root,
    id: "term_shared",
    sessionID: "ses_a",
  });
  await expect(
    controller.start({
      command: "bash",
      cwd: root,
      id: "term_shared",
      sessionID: "ses_b",
    }),
  ).rejects.toThrow("belongs to session ses_a");
  await controller.close();
});
