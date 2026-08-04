import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NataliaTaskStateStore } from "../src";

test("task state store records attempts and advances waterline only after final success", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-state-"));
  const store = await NataliaTaskStateStore.open(root);
  const started = store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as import("@natalia/contracts").SessionID,
    at: "2026-08-01T00:00:00.000Z",
  });
  expect(started).toMatchObject({ started: true });
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 1,
    status: "failed",
    retry: true,
    reason: "temporary network failure",
    at: "2026-08-01T00:01:00.000Z",
  });
  expect(store.getInvocation("inv_1")).toMatchObject({ status: "retrying" });
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.recordAttempt({
    invocationID: "inv_1",
    attempt: 2,
    episodeID: "epi_2" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_2" as import("@natalia/contracts").SessionID,
    at: "2026-08-01T00:02:00.000Z",
  });
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 2,
    status: "succeeded",
    retry: false,
    at: "2026-08-01T00:03:00.000Z",
  });
  expect(store.getInvocation("inv_1")).toMatchObject({
    status: "succeeded",
    waterlineAdvanced: true,
  });
  expect(store.getWaterline("task_1")).toMatchObject({
    invocationID: "inv_1",
  });
  store.close();
});

test("active invocation skips an overlap and terminal non-success does not advance waterline", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-overlap-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_active",
    taskID: "task_1",
    episodeID: "epi_active" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_active" as import("@natalia/contracts").SessionID,
  });
  const skipped = store.startInvocation({
    invocationID: "inv_skipped",
    taskID: "task_1",
    episodeID: "epi_skipped" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_skipped" as import("@natalia/contracts").SessionID,
  });
  expect(skipped).toMatchObject({
    started: false,
    invocation: { status: "skipped_due_to_overlap", waterlineAdvanced: false },
  });
  store.completeAttempt({
    invocationID: "inv_active",
    attempt: 1,
    status: "blocked",
    retry: false,
  });
  expect(store.getInvocation("inv_active")).toMatchObject({
    status: "blocked",
    waterlineAdvanced: false,
  });
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.close();
});

test("task state store rejects invalid attempt transitions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-transition-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as import("@natalia/contracts").SessionID,
  });
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 1,
    status: "cancelled",
    retry: false,
  });
  expect(() =>
    store.completeAttempt({
      invocationID: "inv_1",
      attempt: 1,
      status: "failed",
      retry: false,
    }),
  ).toThrow("already terminal");
  expect(() =>
    store.recordAttempt({
      invocationID: "inv_1",
      attempt: 2,
      episodeID: "epi_2" as import("@natalia/contracts").EpisodeID,
      sessionID: "ses_2" as import("@natalia/contracts").SessionID,
    }),
  ).toThrow("not retrying");
  store.close();
});
