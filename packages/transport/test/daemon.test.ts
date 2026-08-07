import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFakeBackend } from "@natalia/client";
import {
  createRuntimeHttpServer,
  createRuntimeDaemonStore,
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
  spawnRuntimeDaemon,
} from "../src/host";

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

test("the daemon carries a task delivery without knowing how to run one", async () => {
  const seen: unknown[] = [];
  const server = createRuntimeHttpServer({
    client: createFakeBackend(),
    port: 0,
    token: "delivery-token",
    events: false,
    runTask: async (request) => {
      seen.push(request);
      if (request.taskPath === "broken.yaml")
        throw new Error("natalia flow not found: flow_missing");
      return {
        invocationID: "inv_1",
        status: "succeeded",
        waterlineAdvanced: true,
        exitCode: 0,
        output: ['{"type":"task.invocation","status":"succeeded"}'],
      };
    },
  });
  try {
    const submit = (body: unknown, token = "delivery-token") =>
      fetch(new URL("/tasks/run", server.url).href, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    const delivered = await submit({
      taskPath: "nightly.yaml",
      workspaceRoot: "/srv/workspace",
    });
    expect(delivered.status).toBe(200);
    expect(await delivered.json()).toMatchObject({
      status: "succeeded",
      exitCode: 0,
      output: ['{"type":"task.invocation","status":"succeeded"}'],
    });
    expect(seen).toEqual([
      { taskPath: "nightly.yaml", workspaceRoot: "/srv/workspace" },
    ]);
    // Delivery is authenticated like every other daemon route.
    expect((await submit({ taskPath: "nightly.yaml" }, "wrong")).status).toBe(
      401,
    );
    expect((await submit({})).status).toBe(400);
    // A definition error is the submitter's problem, not a daemon crash.
    const rejected = await submit({ taskPath: "broken.yaml" });
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({
      error: "natalia flow not found: flow_missing",
    });
    const wrongMethod = await fetch(new URL("/tasks/run", server.url).href, {
      headers: { authorization: "Bearer delivery-token" },
    });
    expect(wrongMethod.status).toBe(405);
  } finally {
    server.stop(true);
  }
});

test("a daemon without a task handler refuses delivery instead of pretending", async () => {
  const server = createRuntimeHttpServer({
    client: createFakeBackend(),
    port: 0,
    token: "no-tasks",
    events: false,
  });
  try {
    const response = await fetch(new URL("/tasks/run", server.url).href, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer no-tasks",
      },
      body: JSON.stringify({ taskPath: "nightly.yaml" }),
    });
    expect(response.status).toBe(404);
  } finally {
    server.stop(true);
  }
});
