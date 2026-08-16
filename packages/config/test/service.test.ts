import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig, updateGlobalConfig } from "../src";

test("global-scope settings survive across different workspaces", async () => {
  const rootA = await mkdtemp(join(tmpdir(), "natalia-global-a-"));
  const rootB = await mkdtemp(join(tmpdir(), "natalia-global-b-"));
  const globalPath = join(
    await mkdtemp(join(tmpdir(), "natalia-global-home-")),
    "config.json",
  );
  // Write a user-level setting (team.maxConcurrent) to the GLOBAL scope.
  await updateGlobalConfig({ team: { maxConcurrent: 8 } }, globalPath);
  // A completely different workspace still sees it — this is what a workspace
  // switch relies on: settings follow the user, not the directory.
  const b = await resolveConfig({ workspaceRoot: rootB, globalPath });
  expect(b.config.team?.maxConcurrent).toBe(8);
  const a = await resolveConfig({ workspaceRoot: rootA, globalPath });
  expect(a.config.team?.maxConcurrent).toBe(8);
});
