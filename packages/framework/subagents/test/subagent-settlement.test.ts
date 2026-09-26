import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentRegistry, subagentSettlementReason } from "../src";
import type { RunnerCallback } from "../src";

/**
 * The settlement spine's subagent adopter (the Natalia settlement plan's
 * block 4): every terminal transition fires the hook the composition
 * binds to the spine, so the parent is told instead of polling
 * `agent_wait`. The registry-level pins here; the composition's binding is
 * the thin part.
 */

const instantRunner: RunnerCallback = async () => undefined;

async function registryFor(
  workDir: string,
  onSettled: (record: { status: string; outputs: unknown[] }) => void,
) {
  return new SubagentRegistry({
    workDir,
    runner: instantRunner,
    clock: () => Date.now(),
    onSettled: onSettled as never,
  });
}

test("the reason mapping is the record's status, pure", () => {
  expect(subagentSettlementReason("completed")).toBe("completed");
  expect(subagentSettlementReason("failed")).toBe("failed");
  expect(subagentSettlementReason("stopped")).toBe("stopped");
});

test("a completed run fires the hook once with its record", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "subagent-settle-ok-"));
  const seen: Array<{ status: string; outputs: unknown[] }> = [];
  const registry = await registryFor(workDir, (record) => seen.push(record));
  await registry.spawn("do the thing", { parentSessionID: "ses_parent" });
  // The runPromise settles the run asynchronously.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(seen).toHaveLength(1);
  expect(seen[0]!.status).toBe("completed");
  // One transition, one notice: a settled record does not re-fire.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(seen).toHaveLength(1);
});

test("a failed run fires the hook with the failure on the record", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "subagent-settle-fail-"));
  const seen: Array<{ status: string; outputs: unknown[] }> = [];
  const registry = new SubagentRegistry({
    workDir,
    runner: (async () => {
      throw new Error("provider exploded");
    }) as RunnerCallback,
    onSettled: (record) => seen.push(record) as never,
  });
  await registry.spawn("do the thing");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(seen).toHaveLength(1);
  expect(seen[0]!.status).toBe("failed");
});

test("a run the restart interrupted tells its parent on load", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "subagent-settle-restore-"));
  // Seed a store whose record is still "running" (an interrupted run).
  const first = new SubagentRegistry({
    workDir,
    runner: (async () => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }) as RunnerCallback,
  });
  const record = await first.spawn("long work", {
    parentSessionID: "ses_gone",
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await first.save();
  // A fresh registry (the restart) recovers it, and the hook fires.
  const seen: Array<{ status: string }> = [];
  const second = new SubagentRegistry({
    workDir,
    runner: instantRunner,
    onSettled: (recovered) => seen.push(recovered) as never,
  });
  await second.load();
  expect(seen).toHaveLength(1);
  expect(seen[0]!.status).toBe("stopped");
  expect(record.status).toBe("running");
});

test("a throwing hook degrades — the child's ending never fails on it", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "subagent-settle-throw-"));
  const registry = new SubagentRegistry({
    workDir,
    runner: instantRunner,
    onSettled: () => {
      throw new Error("notice could not fly");
    },
  });
  // The run settles despite the hook's throw (the spine's discipline).
  const record = await registry.spawn("do the thing");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(registry.status(record.id)).toBe("completed");
});

test("a registry without the hook behaves exactly as before", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "subagent-settle-bare-"));
  const registry = new SubagentRegistry({
    workDir,
    runner: instantRunner,
  });
  const record = await registry.spawn("do the thing");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(registry.status(record.id)).toBe("completed");
});
