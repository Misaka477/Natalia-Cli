import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  MCPCatalogSnapshot,
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import {
  attachRuntimeClientWorker,
  createWorkerRuntimeClient,
} from "../src/worker";
import { createRealRuntimeClient } from "../src/real-runtime";

test("worker RuntimeClient transport remains behind contracts boundary", async () => {
  const channel = new MessageChannel();
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const host: RuntimeClient = {
    start(handler) {
      sink = handler;
    },
    async submit(text) {
      const event: SubmittedTurn = {
        type: "turn.submitted",
        id: "turn_worker",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      };
      sink?.(event);
      return event;
    },
    cancel() {},
    snapshot: () => ({
      type: "snapshot.created",
      id: "snapshot_worker",
      files: [],
    }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
  };
  attachRuntimeClientWorker(channel.port1, host);
  const client = createWorkerRuntimeClient(channel.port2);
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await expect(client.submit("worker prompt")).resolves.toMatchObject({
    text: "worker prompt",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(events).toContainEqual(
    expect.objectContaining({ type: "turn.submitted", text: "worker prompt" }),
  );
});

test("a failing notification is reported instead of crashing the host", async () => {
  const channel = new MessageChannel();
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const host: RuntimeClient = {
    start(handler) {
      sink = handler;
    },
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_reject",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      } satisfies SubmittedTurn;
    },
    // The real failure this reproduces is a teardown error surfacing through a
    // notification, which used to become an unhandled rejection.
    cancel() {
      throw new Error("kill() failed: ESRCH: No such process");
    },
    snapshot: () => ({
      type: "snapshot.created",
      id: "snapshot_reject",
      files: [],
    }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
  };
  attachRuntimeClientWorker(channel.port1, host);
  const client = createWorkerRuntimeClient(channel.port2);
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));

  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  try {
    client.cancel("stop");
    await Bun.sleep(50);
  } finally {
    process.off("unhandledRejection", onRejection);
  }

  expect(rejections).toEqual([]);
  expect(
    events.filter(
      (event) =>
        event.type === "diagnostic" && event.message.includes("cancel failed"),
    ).length,
  ).toBeGreaterThan(0);
});

test("config reload replaces the worker runtime and keeps event forwarding", async () => {
  const channel = new MessageChannel();
  const disposed: string[] = [];
  const submitted: string[] = [];
  let generation = 0;
  const createHost = (): RuntimeClient => {
    const id = `host-${++generation}`;
    let sink: ((event: RuntimeEvent) => void) | undefined;
    return {
      start(handler) {
        sink = handler;
      },
      async submit(text) {
        submitted.push(`${id}:${text}`);
        const event = {
          type: "turn.submitted" as const,
          id: `turn-${id}`,
          text: `${id}:${text}`,
          byteLength: text.length,
          lineCount: 1,
          sha256: "test",
        };
        sink?.(event);
        return event;
      },
      async runtimeStatus() {
        return { type: "status.snapshot", permissions: "ask" } as never;
      },
      async dispose() {
        disposed.push(id);
      },
      cancel() {},
      snapshot: () => ({
        type: "snapshot.created",
        id: `snapshot-${id}`,
        files: [],
      }),
      diagnostic() {},
      lastSubmission: () => undefined,
      respondApproval() {
        return { accepted: true };
      },
      respondQuestion() {
        return { accepted: true };
      },
    };
  };
  const first = createHost();
  attachRuntimeClientWorker(channel.port1, first, { reload: createHost });
  const client = createWorkerRuntimeClient(channel.port2);
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));

  await Promise.race([
    client.reloadConfig?.(),
    Bun.sleep(1_000).then(() => {
      throw new Error("config reload request timed out");
    }),
  ]);
  const submission = Promise.race([
    client.submit("after reload"),
    Bun.sleep(1_000).then(() => {
      throw new Error(
        `submit after config reload timed out (${submitted.join(", ")})`,
      );
    }),
  ]);
  const result = await submission;
  expect(result).toMatchObject({ text: "host-2:after reload" });
  await Bun.sleep(0);

  expect(disposed).toEqual(["host-1"]);
  expect(submitted).toEqual(["host-2:after reload"]);
  expect(events).toContainEqual(
    expect.objectContaining({ text: "host-2:after reload" }),
  );
});

test("config reload preserves a busy runtime instead of cancelling it", async () => {
  const channel = new MessageChannel();
  let disposed = false;
  const host = {
    start() {},
    async submit() {
      throw new Error("not used");
    },
    async canReloadConfig() {
      return { allowed: false, reason: "turn is running" };
    },
    async dispose() {
      disposed = true;
    },
    cancel() {},
    snapshot: () => ({
      type: "snapshot.created" as const,
      id: "snapshot_busy",
      files: [],
    }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
  } satisfies RuntimeClient;
  attachRuntimeClientWorker(channel.port1, host, { reload: () => host });
  const client = createWorkerRuntimeClient(channel.port2);
  client.start(() => undefined);

  // Being told "not now" is an ordinary answer, so it arrives as a value. It used
  // to be thrown, which made a busy runtime indistinguishable from a broken
  // channel for any caller that only saw the rejection.
  await expect(client.reloadConfig?.()).resolves.toEqual({
    applied: false,
    reason: "turn is running",
  });
  // The point of the test is unchanged: a busy runtime is preserved, not rebuilt.
  expect(disposed).toBe(false);
});

test("config reload applies changed permission profiles to the same worker client", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-worker-reload-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  const configPath = join(root, ".natalia", "config.json");
  const writeProfile = async (
    approval: "ask" | "read_only",
    agents: Record<string, { description: string }> = {},
  ) =>
    writeFile(
      configPath,
      JSON.stringify({
        version: 2,
        defaultPermission: "active",
        permissionProfiles: { active: { approval } },
        agents,
      }),
    );
  await writeProfile("ask");

  const channel = new MessageChannel();
  const createRuntime = () =>
    createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_worker_reload",
      provider: {
        provider: "test",
        model: "test",
        async *stream() {
          yield { type: "done" as const };
        },
      },
    });
  attachRuntimeClientWorker(channel.port1, createRuntime(), {
    reload: createRuntime,
  });
  const client = createWorkerRuntimeClient(channel.port2);
  client.start(() => undefined);

  expect(await client.runtimeStatus?.()).toMatchObject({ permissions: "ask" });
  await writeProfile("read_only", {
    reviewer: { description: "Reloaded reviewer" },
  });
  await client.reloadConfig?.();
  expect(await client.runtimeStatus?.()).toMatchObject({
    permissions: "read_only",
  });
  expect(await client.agents?.()).toContainEqual(
    expect.objectContaining({
      name: "reviewer",
      description: "Reloaded reviewer",
    }),
  );
  await client.dispose?.();
});

test("the worker channel carries the runtime's answer instead of assuming one", async () => {
  // These were fire-and-forget notifications, so the worker-backed client had no
  // way to know what happened and would have had to make an outcome up. They are
  // round trips now: the host already returned the value, nothing was reading it.
  const channel = new MessageChannel();
  const host: RuntimeClient = {
    start() {},
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_outcome",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      };
    },
    cancel() {},
    pause() {
      return { paused: false, reason: "no turn has been submitted" };
    },
    resume() {
      return { resumed: false, reason: "the turn is not paused" };
    },
    snapshot: () => ({
      type: "snapshot.created",
      id: "snapshot_outcome",
      files: [],
    }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {
      return {
        accepted: false,
        reason: "the approval request is no longer pending",
      };
    },
    respondQuestion() {
      return {
        accepted: false,
        reason: "the question request is no longer pending",
      };
    },
  };
  attachRuntimeClientWorker(channel.port1, host);
  const client = createWorkerRuntimeClient(channel.port2);
  client.start(() => undefined);

  expect(await client.pause?.()).toEqual({
    paused: false,
    reason: "no turn has been submitted",
  });
  expect(await client.resume?.()).toMatchObject({ resumed: false });
  expect(
    await client.respondApproval({ requestID: "apr_gone", decision: "once" }),
  ).toEqual({
    accepted: false,
    reason: "the approval request is no longer pending",
  });
  expect(
    await client.respondQuestion({
      requestID: "qst_gone",
      answers: [["no"]],
      rejected: false,
    }),
  ).toMatchObject({ accepted: false });
  await client.dispose?.();
});

test("the worker channel routes the MCP surface", async () => {
  // The TUI's @-resource autocomplete calls backend.mcpCatalog; before the
  // channel routed it, the proxy object simply had no such method, so the
  // autocomplete silently returned empty. The method must exist and round-trip.
  const channel = new MessageChannel();
  const catalog: MCPCatalogSnapshot = {
    prompts: [{ server: "fixture", name: "review" }],
    resources: [],
  };
  const host: RuntimeClient = {
    start() {},
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_mcp",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      };
    },
    cancel() {},
    snapshot: () => ({ type: "snapshot.created", id: "snap_mcp", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    async mcpCatalog() {
      return catalog;
    },
    async getMcpPrompt(server, name) {
      return { server, name };
    },
    async readMcpResource(server, uri) {
      return { server, uri };
    },
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
  };
  attachRuntimeClientWorker(channel.port1, host);
  const client = createWorkerRuntimeClient(channel.port2);
  client.start(() => undefined);

  expect(typeof client.mcpCatalog).toBe("function");
  expect(await client.mcpCatalog!()).toEqual(catalog);
  expect(await client.getMcpPrompt!("fixture", "review")).toEqual({
    server: "fixture",
    name: "review",
  });
  expect(await client.readMcpResource!("fixture", "x://y")).toEqual({
    server: "fixture",
    uri: "x://y",
  });
  await client.dispose?.();
});

test("the worker channel routes the sandbox, agent-select and fork surface", async () => {
  // DialogSandbox guards every call (`if (!backend.sandboxList)`), so a missing
  // route degrades the whole sandbox dialog silently; App.tsx uses selectAgent
  // and sessionFork the same guarded way. The methods must exist and round-trip.
  const channel = new MessageChannel();
  const host: RuntimeClient = {
    start() {},
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_surface",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      };
    },
    cancel() {},
    snapshot: () => ({ type: "snapshot.created", id: "snap_surface", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    async sandboxList() {
      return [{ id: "box_1", status: "running", paths: 2 }];
    },
    async sandboxDiff(id) {
      return [{ kind: "modify", path: `${id}/a.ts`, oldPath: undefined }];
    },
    async sandboxResources(id) {
      return [{ id: `${id}/srv`, name: "srv", status: "running" }];
    },
    async sandboxResourceOutput(input) {
      return `output of ${input.resourceID}`;
    },
    async sandboxResourceStop(input) {
      return { id: input.id, resourceID: input.resourceID, status: "stopped" };
    },
    async sandboxMerge(id) {
      return [{ kind: "add", path: `${id}/b.ts`, oldPath: undefined }];
    },
    async sandboxDelete(id) {
      return { pendingChanges: [], runningResources: [] };
    },
    async selectAgent(name) {
      return { selectedAgent: name };
    },
    async sessionFork(id, turnID) {
      return { id: `${id}_fork`, title: "fork", createdAt: "", cancelled: false, resumable: true };
    },
    respondApproval() {
      return { accepted: true };
    },
    respondQuestion() {
      return { accepted: true };
    },
  };
  attachRuntimeClientWorker(channel.port1, host);
  const client = createWorkerRuntimeClient(channel.port2);
  client.start(() => undefined);

  expect(typeof client.sandboxList).toBe("function");
  expect(typeof client.sessionFork).toBe("function");
  expect(await client.sandboxList!()).toEqual([
    { id: "box_1", status: "running", paths: 2 },
  ]);
  expect(await client.sandboxMerge!("box_1")).toEqual([
    { kind: "add", path: "box_1/b.ts", oldPath: undefined },
  ]);
  expect(
    await client.sandboxResourceOutput!({ id: "box_1", resourceID: "srv" }),
  ).toBe("output of srv");
  expect(await client.selectAgent!("helper")).toEqual({
    selectedAgent: "helper",
  });
  expect(await client.sessionFork!("ses_a", "turn_1")).toEqual({
    id: "ses_a_fork",
    title: "fork",
    createdAt: "",
    cancelled: false,
    resumable: true,
  });
  expect(await client.sandboxDelete!("box_1")).toEqual({
    pendingChanges: [],
    runningResources: [],
  });
});
