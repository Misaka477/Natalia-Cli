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

test("pty controller start is idempotent per natalia session", async () => {
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
    sessionID: "ses_one",
  });
  const second = await controller.start({
    command: "zsh",
    cwd: root,
    sessionID: "ses_one",
  });
  expect(second.id).toBe(first.id);
  expect(first.host).toBe("pty");
  expect(processes).toHaveLength(1);
  expect(await controller.list()).toHaveLength(1);
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

test("pty controller start without sessionID is still idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-default-"));
  const { factory, processes } = fakePty();
  const controller = createPtyTerminalController(
    controllerInput(root, factory),
  );
  const first = await controller.start({ command: "bash", cwd: root });
  const second = await controller.start({ command: "bash", cwd: root });
  expect(second.id).toBe(first.id);
  expect(processes).toHaveLength(1);
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
  await expect(controller.read(a.id)).rejects.toThrow(
    "native terminal session not found",
  );
  controller.setActiveSession("ses_a");
  expect((await controller.list()).map((session) => session.id)).toEqual([
    a.id,
  ]);
  await controller.close();
});
