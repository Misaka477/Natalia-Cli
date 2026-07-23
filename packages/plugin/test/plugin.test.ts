import { expect, test } from "bun:test";
import { createToolRegistry } from "@natalia/tools";
import {
  createPluginRegistry,
  definePlugin,
  runPluginConformance,
} from "../src";

test("plugin registrations are capability-gated and removed on unload", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools, allowed: ["tools"] });
  await registry.load(
    definePlugin({
      manifest: {
        apiVersion: 1,
        id: "demo.plugin",
        version: "1.0.0",
        name: "Demo",
        description: "",
        entry: "index.ts",
        capabilities: ["tools"],
      },
      setup(api) {
        api.tools.register({
          name: "echo",
          description: "Echo",
          requiresApproval: false,
          parameters: { type: "object", properties: {} },
          async execute() {
            return "ok";
          },
        });
      },
    }),
  );
  expect(tools.has("plugin_demo_plugin_echo")).toBe(true);
  await registry.unload("demo.plugin");
  expect(tools.has("plugin_demo_plugin_echo")).toBe(false);
  expect(registry.audit().map((entry) => entry.action)).toEqual([
    "loaded",
    "unloaded",
  ]);
});

test("plugin tools require approval unless workspace marks plugin read-only", async () => {
  const safeTools = createToolRegistry([]);
  const safeRegistry = createPluginRegistry({
    tools: safeTools,
    readOnly: { "safe.plugin": true },
  });
  await safeRegistry.load(pluginWithReadOnlyTool("safe.plugin"));
  expect(safeTools.get("plugin_safe_plugin_observe")?.requiresApproval).toBe(
    false,
  );

  const guardedTools = createToolRegistry([]);
  const guardedRegistry = createPluginRegistry({ tools: guardedTools });
  await guardedRegistry.load(pluginWithReadOnlyTool("guarded.plugin"));
  expect(
    guardedTools.get("plugin_guarded_plugin_observe")?.requiresApproval,
  ).toBe(true);
});

test("plugin conformance harness verifies lifecycle cleanup", async () => {
  const results = await runPluginConformance({
    plugin: definePlugin({
      manifest: {
        apiVersion: 1,
        id: "conformance.plugin",
        version: "1.0.0",
        name: "Conformance",
        description: "",
        entry: "index.ts",
        capabilities: ["tools"],
      },
      setup(api) {
        api.tools.register({
          name: "ping",
          description: "Ping",
          requiresApproval: false,
          parameters: { type: "object", properties: {} },
          async execute() {
            return "pong";
          },
        });
      },
    }),
    allowed: ["tools"],
  });
  expect(results).toEqual([
    { name: "manifest-and-setup", passed: true },
    { name: "owned-registration-cleanup", passed: true, detail: undefined },
  ]);
});

test("plugin cannot use an undeclared capability", async () => {
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    allowed: ["tools"],
  });
  await expect(
    registry.load(
      definePlugin({
        manifest: {
          apiVersion: 1,
          id: "events.plugin",
          version: "1.0.0",
          name: "Events",
          description: "",
          entry: "index.ts",
          capabilities: [],
        },
        setup(api) {
          api.events.on(() => undefined);
        },
      }),
    ),
  ).rejects.toThrow("capability denied");
});

test("an explicit empty capability grant denies all plugin capabilities", async () => {
  const registry = createPluginRegistry({ tools: createToolRegistry([]) });
  await expect(
    registry.load(
      definePlugin({
        manifest: {
          apiVersion: 1,
          id: "restricted.plugin",
          version: "1.0.0",
          name: "Restricted",
          description: "",
          entry: "index.ts",
          capabilities: ["tools"],
        },
        setup(api) {
          api.tools.register({
            name: "echo",
            description: "Echo",
            requiresApproval: false,
            parameters: { type: "object", properties: {} },
            async execute() {
              return "ok";
            },
          });
        },
      }),
      [],
    ),
  ).rejects.toThrow("capability denied");
});

function pluginWithReadOnlyTool(id: string) {
  return definePlugin({
    manifest: {
      apiVersion: 1,
      id,
      version: "1.0.0",
      name: "Observe",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    },
    setup(api) {
      api.tools.register({
        name: "observe",
        description: "Observe",
        requiresApproval: false,
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok";
        },
      });
    },
  });
}
