import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSandboxController } from "../src/sandbox-controller";

test("sandbox controller initializes lazily and refuses before init", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-controller-"));
  const controller = createSandboxController({ workspaceRoot: root });
  expect(() => controller.get()).toThrow("sandbox manager is not initialized");
  expect(controller.runningResourceCount()).toBe(0);
  await controller.init();
  expect(controller.get()).toBeDefined();
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
