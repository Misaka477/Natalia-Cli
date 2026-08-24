import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  type StatusSnapshotController,
} from "@natalia/runtime-services";
import { createRuntimeUiPlugin, RUNTIME_UI_PLUGIN_ID } from "../src";

test("runtime UI service follows plugin load and unload", async () => {
  const events: unknown[] = [];
  const services = new Map<string, unknown>();
  const registry = createPluginRegistry({
    tools: {
      set() {},
      get() {
        return undefined;
      },
      delete() {},
    } as never,
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createRuntimeUiPlugin({
    provider: () => undefined,
    context: () => ({
      journalStatus: () => ({ tokenEstimate: 0, messageCount: 0 }),
    }),
    workspaceRoot: "/tmp/ws",
    permissionMode: () => "read_only",
    runningCount: async () => 0,
    publish: (event) => events.push(event),
    commands: {
      session: async () => ({
        provider: { provider: "openai", model: "gpt-test" },
        providerSource: "config",
        workspaceRoot: "/tmp/ws",
        sessionID: "ses_test",
        toolsSize: 3,
        selectedAgentName: "reviewer",
        skillsCount: 2,
        diagnostics: [],
        snapshot: {
          type: "status.snapshot",
          provider: "openai",
          model: "gpt-test",
          context: "10 tokens",
          step: "2",
          permissions: "read_only",
          cwd: "/tmp/ws",
          background: "0 running",
        },
      }),
      publish: (_sessionID, event) => events.push(event),
      egressAdvisory: "egress advisory",
    },
  });

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: RUNTIME_UI_PLUGIN_ID,
    scope: "workspace",
    provides: [STATUS_SNAPSHOT_CONTROLLER_SERVICE],
    requires: [],
    dependencies: [],
    integrationPoints: ["services", "commands"],
  });
  expect(services.has(STATUS_SNAPSHOT_CONTROLLER_SERVICE)).toBe(false);

  await registry.load(plugin);
  const controller = services.get(
    STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  ) as StatusSnapshotController;
  expect(controller).toBeDefined();
  expect(registry.commands().map((command) => command.name)).toEqual([
    "help",
    "doctor",
    "status",
    "diagnostics",
  ]);
  expect(
    await registry
      .commands()
      .find((command) => command.name === "status")
      ?.run({
        raw: "/status",
        args: [],
        workspaceRoot: "/tmp/ws",
        sessionID: "ses_test",
      }),
  ).toContain("provider: openai/gpt-test (config)");
  expect(events).toHaveLength(1);
  events.length = 0;
  controller.schedule();

  await registry.unload(RUNTIME_UI_PLUGIN_ID);
  expect(services.has(STATUS_SNAPSHOT_CONTROLLER_SERVICE)).toBe(false);
  expect(registry.commands()).toHaveLength(0);
  await Bun.sleep(10);
  expect(events).toEqual([]);
});
