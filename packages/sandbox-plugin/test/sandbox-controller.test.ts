import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SnapshotSandboxManager,
  WorktreeSandboxManager,
} from "@natalia/sandbox";
import { mkdir } from "node:fs/promises";
import { createSandboxController } from "../src/sandbox-controller";

test("sandbox controller initializes lazily and refuses before init", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-controller-"));
  const controller = createSandboxController({ workspaceRoot: root });
  expect(() => controller.get()).toThrow("sandbox manager is not initialized");
  await expect(controller.referencedObjectIDs()).rejects.toThrow(
    "sandbox manager is not initialized",
  );
  expect(controller.runningResourceCount()).toBe(0);
  await controller.init();
  expect(controller.get()).toBeDefined();
  expect(await controller.referencedObjectIDs()).toBeInstanceOf(Set);
  expect(controller.runningResourceCount()).toBe(0);
});

test("sandbox controller init is idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-controller-2-"));
  const controller = createSandboxController({ workspaceRoot: root });
  await controller.init();
  const first = controller.get();
  await controller.init();
  expect(controller.get()).toBe(first);
});

test("the default sandbox backend is our own git-free snapshot manager", async () => {
  // A git repo workspace, but no backend configured: our own snapshot backend
  // is the default — git is not required.
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-default-"));
  await mkdir(join(root, ".git"), { recursive: true });
  const controller = createSandboxController({ workspaceRoot: root });
  await controller.init();
  expect(controller.get()).toBeInstanceOf(SnapshotSandboxManager);
  expect(controller.get()).not.toBeInstanceOf(WorktreeSandboxManager);
});

test("sandbox.backend=worktree opts into the real-git backend when a repo exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-worktree-opt-"));
  await mkdir(join(root, ".git"), { recursive: true });
  const controller = createSandboxController({
    workspaceRoot: root,
    backend: () => "worktree",
  });
  await controller.init();
  expect(controller.get()).toBeInstanceOf(WorktreeSandboxManager);
  expect(await controller.referencedObjectIDs()).toBeUndefined();
});
