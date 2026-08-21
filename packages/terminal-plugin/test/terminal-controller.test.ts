import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createTerminalControllerPlugin,
  resolveNataliaWezTermForkExecutable,
  TERMINAL_PLUGIN_ID,
} from "../src";
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

test("terminal plugin unload owns and awaits controller teardown", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-plugin-"));
  let disposals = 0;
  const registry = createPluginRegistry({ tools: createToolRegistry([]) });
  await registry.loadBuiltin(
    createTerminalControllerPlugin({
      workspaceRoot: root,
      publish: () => undefined,
      onPerformance: () => undefined,
      runtimeID: () => "runtime-test",
      userRuntimeHome: () => undefined,
      windowMode: () => "auto",
      external: {
        async dispose() {
          await Bun.sleep(1);
          disposals += 1;
        },
      } as never,
    }),
  );

  await registry.unload(TERMINAL_PLUGIN_ID);
  expect(disposals).toBe(1);
});
