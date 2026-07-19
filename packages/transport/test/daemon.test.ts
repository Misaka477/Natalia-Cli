import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createRuntimeDaemonStore,
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
  spawnRuntimeDaemon,
} from "../src";

test("native TS daemon store writes private token registration and stale cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-daemon-"));
  const store = createRuntimeDaemonStore({
    dir: root,
    version: "test-version",
  });
  const token = await daemonToken(store);
  expect(token.length).toBeGreaterThan(20);
  expect(await readFile(store.tokenPath, "utf8")).toContain(token);
  await registerRuntimeDaemon(store, {
    url: "http://127.0.0.1:8787",
    pid: 99999999,
    transport: "http",
  });
  expect(await runtimeDaemonStatus(store)).toMatchObject({ state: "stale" });
  expect(await runtimeDaemonStatus(store)).toMatchObject({ state: "missing" });
});

test("native TS daemon process can be spawned and stopped without Go launcher", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-daemon-process-"));
  const store = createRuntimeDaemonStore({
    dir: root,
    version: "test-version",
  });
  const pid = spawnRuntimeDaemon({
    command: ["bash", "-lc", "sleep 30"],
    cwd: root,
  });
  await registerRuntimeDaemon(store, {
    url: "http://127.0.0.1:8788",
    pid,
    transport: "http",
  });
  expect(await runtimeDaemonStatus(store)).toMatchObject({ state: "running" });
  expect(await stopRuntimeDaemon(store)).toMatchObject({ stopped: true, pid });
});
