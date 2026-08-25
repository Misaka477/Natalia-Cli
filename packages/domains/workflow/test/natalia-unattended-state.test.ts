import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NataliaUnattendedStateStore } from "../src";

async function openState(prefix: string, taskID = "task_nightly") {
  const root = await mkdtemp(join(tmpdir(), prefix));
  return { root, store: await NataliaUnattendedStateStore.open(root, taskID) };
}

test("unattended state starts empty under the task's own directory", async () => {
  const { root, store } = await openState("natalia-unattended-init-");
  expect(store.path).toBe(
    join(root, ".natalia", "unattended", "task_nightly", "state.json"),
  );
  expect(store.state()).toMatchObject({
    version: 1,
    taskID: "task_nightly",
    watermarks: {},
    pending: {},
    fingerprints: {},
    suppressed: {},
    consecutiveFailures: 0,
  });
  expect(store.watermark("logs")).toBeUndefined();
});

test("unattended state rejects a taskID that escapes its directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-unattended-escape-"));
  for (const taskID of ["../escape", "nested/task", "..", ""])
    await expect(
      NataliaUnattendedStateStore.open(root, taskID),
    ).rejects.toThrow();
});

test("a successful task promotes the staged position to the watermark", async () => {
  const { store } = await openState("natalia-unattended-commit-");
  await store.stagePosition({
    invocationID: "inv_1",
    source: "logs",
    kind: "offset",
    position: "4096",
    at: "2026-08-05T01:00:00.000Z",
  });
  expect(store.watermark("logs")).toBeUndefined();
  await store.commit({
    invocationID: "inv_1",
    at: "2026-08-05T01:05:00.000Z",
  });
  expect(store.watermark("logs")).toEqual({
    source: "logs",
    kind: "offset",
    position: "4096",
    updatedAt: "2026-08-05T01:05:00.000Z",
  });
  expect(store.state().pending).toEqual({});
  expect(store.state().lastResult).toEqual({
    invocationID: "inv_1",
    status: "succeeded",
    at: "2026-08-05T01:05:00.000Z",
  });
});

test("a failed task keeps the watermark so the same batch is reprocessed", async () => {
  const { root, store } = await openState("natalia-unattended-failure-");
  await store.stagePosition({
    invocationID: "inv_1",
    source: "logs",
    kind: "offset",
    position: "1024",
  });
  await store.commit({ invocationID: "inv_1" });
  await store.stagePosition({
    invocationID: "inv_2",
    source: "logs",
    kind: "offset",
    position: "8192",
  });
  await store.recordFailure({ invocationID: "inv_2", status: "blocked" });
  expect(store.watermark("logs")?.position).toBe("1024");
  expect(store.state().pending).toEqual({});
  expect(store.consecutiveFailures()).toBe(1);
  // A rerun sees the pre-failure position, so nothing was silently skipped.
  const reopened = await NataliaUnattendedStateStore.open(root, "task_nightly");
  expect(reopened.watermark("logs")?.position).toBe("1024");
  expect(reopened.consecutiveFailures()).toBe(1);
  await reopened.recordFailure({ invocationID: "inv_3", status: "stalled" });
  expect(reopened.consecutiveFailures()).toBe(2);
  await reopened.commit({ invocationID: "inv_4" });
  expect(reopened.consecutiveFailures()).toBe(0);
});

test("a commit never promotes another invocation's staged position", async () => {
  const { store } = await openState("natalia-unattended-scope-");
  await store.stagePosition({
    invocationID: "inv_1",
    source: "logs",
    kind: "offset",
    position: "4096",
  });
  await store.commit({ invocationID: "inv_2" });
  expect(store.watermark("logs")).toBeUndefined();
  expect(store.state().pending).toEqual({});
});

test("staging from a new invocation discards the previous staged position", async () => {
  const { store } = await openState("natalia-unattended-restage-");
  await store.stagePosition({
    invocationID: "inv_1",
    source: "logs",
    kind: "offset",
    position: "4096",
  });
  await store.stagePosition({
    invocationID: "inv_2",
    source: "audit",
    kind: "timestamp",
    position: "2026-08-05T00:00:00.000Z",
  });
  const state = store.state();
  expect(Object.keys(state.pending)).toEqual(["audit"]);
  expect(state.pendingInvocationID).toBe("inv_2");
});

test("staged positions are validated against the declared watermark kind", async () => {
  const { store } = await openState("natalia-unattended-validate-");
  await expect(
    store.stagePosition({
      invocationID: "inv_1",
      source: "logs",
      kind: "offset",
      position: "2026-08-05T00:00:00.000Z",
    }),
  ).rejects.toThrow("offset position must be a digit string");
  await expect(
    store.stagePosition({
      invocationID: "inv_1",
      source: "logs",
      kind: "timestamp",
      position: "not-a-date",
    }),
  ).rejects.toThrow("timestamp position must be a parsable date");
  expect(store.state().pending).toEqual({});
});

test("fingerprints map to issues and a human suppression is final", async () => {
  const { root, store } = await openState("natalia-unattended-fingerprint-");
  await store.mapFingerprint({
    fingerprint: "fp_nullpointer",
    issue: "gitea#42",
    at: "2026-08-05T01:00:00.000Z",
  });
  expect(store.issueFor("fp_nullpointer")).toEqual({
    issue: "gitea#42",
    recordedAt: "2026-08-05T01:00:00.000Z",
  });
  expect(store.isSuppressed("fp_nullpointer")).toBe(false);
  await store.suppress({
    fingerprint: "fp_nullpointer",
    reason: "closed as wontfix by a maintainer",
  });
  expect(store.isSuppressed("fp_nullpointer")).toBe(true);
  await expect(
    store.mapFingerprint({ fingerprint: "fp_nullpointer", issue: "gitea#77" }),
  ).rejects.toThrow("must not be reopened");
  // The suppression survives a reopen, so the next night cannot resurrect it.
  const reopened = await NataliaUnattendedStateStore.open(root, "task_nightly");
  expect(reopened.isSuppressed("fp_nullpointer")).toBe(true);
  expect(reopened.issueFor("fp_nullpointer")?.issue).toBe("gitea#42");
});

test("every write leaves a complete file and no temporary residue", async () => {
  const { store } = await openState("natalia-unattended-atomic-");
  await store.stagePosition({
    invocationID: "inv_1",
    source: "logs",
    kind: "offset",
    position: "4096",
  });
  await store.mapFingerprint({ fingerprint: "fp_a", issue: "gitea#1" });
  await store.commit({ invocationID: "inv_1" });
  const raw = await readFile(store.path, "utf8");
  expect(() => JSON.parse(raw) as unknown).not.toThrow();
  expect(raw.endsWith("\n")).toBe(true);
  expect(
    (await readdir(store.dir)).filter((entry) => entry.endsWith(".tmp")),
  ).toEqual([]);
  expect(await readdir(store.dir)).toEqual(["state.json"]);
});

test("a damaged or future state file fails closed instead of resetting", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-unattended-corrupt-"));
  const dir = join(root, ".natalia", "unattended", "task_nightly");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "state.json"), '{"version": 1, "taskID"');
  await expect(
    NataliaUnattendedStateStore.open(root, "task_nightly"),
  ).rejects.toThrow("is not valid JSON");
  await writeFile(
    join(dir, "state.json"),
    JSON.stringify({ version: 2, taskID: "task_nightly" }),
  );
  await expect(
    NataliaUnattendedStateStore.open(root, "task_nightly"),
  ).rejects.toThrow("unsupported unattended state version");
  await writeFile(
    join(dir, "state.json"),
    JSON.stringify({ version: 1, taskID: "task_other" }),
  );
  await expect(
    NataliaUnattendedStateStore.open(root, "task_nightly"),
  ).rejects.toThrow("taskID mismatch");
});

test("recordFailure refuses to stand in for a success", async () => {
  const { store } = await openState("natalia-unattended-misuse-");
  await expect(
    store.recordFailure({ invocationID: "inv_1", status: "succeeded" }),
  ).rejects.toThrow("must not be used for a succeeded task");
});
