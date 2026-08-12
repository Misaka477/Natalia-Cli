import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveNataliaWezTermForkExecutable } from "@natalia/native-terminal";
import { createTerminalController } from "../src/terminal-controller";

test("terminal controller init without a host environment leaves the registry absent", async () => {
  if (resolveNataliaWezTermForkExecutable()) {
    // A managed WezTerm fork build exists in this environment, so the
    // "no host" precondition cannot be reproduced here. Mirrors the watcher
    // budget pattern: skip instead of failing on an environment fact.
    console.warn(
      "skipped: a managed WezTerm fork build is present in this environment",
    );
    return;
  }
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-controller-"));
  const controller = createTerminalController({
    workspaceRoot: root,
    publish: () => undefined,
    onPerformance: () => undefined,
    runtimeID: () => "runtime-test",
    userRuntimeHome: () => undefined,
    windowMode: () => "auto",
  });
  await controller.init();
  // No WezTerm host is available in tests; init must not throw and the
  // registry stays absent so members report "Native Terminal Host is
  // unavailable" instead of crashing.
  expect(controller.get()).toBeUndefined();
  await controller.close();
});

test("an externally provided registry is installed as-is and never rebuilt", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-controller-2-"));
  const external = {
    marker: "external",
    dispose: async () => undefined,
  } as never;
  const controller = createTerminalController({
    workspaceRoot: root,
    publish: () => undefined,
    onPerformance: () => undefined,
    runtimeID: () => "runtime-test",
    userRuntimeHome: () => undefined,
    windowMode: () => "auto",
    external,
  });
  await controller.init();
  expect(controller.get()).toBe(external);
  await controller.close();
});
