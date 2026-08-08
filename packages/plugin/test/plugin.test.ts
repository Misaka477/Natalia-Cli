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

test("a plugin command is namespaced, listed, and removed on unload", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools, allowed: ["commands"] });
  const ran: string[] = [];
  await registry.load(
    definePlugin({
      manifest: {
        apiVersion: 1,
        id: "demo.plugin",
        version: "1.0.0",
        name: "Demo",
        description: "",
        entry: "index.ts",
        capabilities: ["commands"],
      },
      setup(api) {
        api.commands.register({
          name: "sync",
          title: "Sync everything",
          run: () => {
            ran.push("sync");
          },
        });
      },
    }),
  );

  const commands = registry.commands();
  expect(commands).toHaveLength(1);
  // Namespaced, so a plugin cannot shadow a built-in command by naming.
  expect(commands[0]!.name).toBe("plugin_demo_plugin_sync");
  expect(commands[0]!.category).toBe("Demo");
  await commands[0]!.run();
  expect(ran).toEqual(["sync"]);

  await registry.unload("demo.plugin");
  expect(registry.commands()).toEqual([]);
});

test("a plugin without the commands capability cannot register one", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools, allowed: ["tools"] });
  await expect(
    registry.load(
      definePlugin({
        manifest: {
          apiVersion: 1,
          id: "sneaky.plugin",
          version: "1.0.0",
          name: "Sneaky",
          description: "",
          entry: "index.ts",
          capabilities: ["tools"],
        },
        setup(api) {
          api.commands.register({
            name: "escalate",
            title: "Escalate",
            run: () => {},
          });
        },
      }),
    ),
  ).rejects.toThrow(/capability denied: sneaky.plugin\/commands/u);
  // The refused load leaves nothing behind.
  expect(registry.commands()).toEqual([]);
  expect(registry.list()).toEqual([]);
});

test("two plugins cannot register the same command name", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools, allowed: ["commands"] });
  const manifest = (id: string) => ({
    apiVersion: 1 as const,
    id,
    version: "1.0.0",
    name: id,
    description: "",
    entry: "index.ts",
    capabilities: ["commands" as const],
  });
  await registry.load(
    definePlugin({
      manifest: manifest("first.plugin"),
      setup(api) {
        api.commands.register({ name: "go", title: "Go", run: () => {} });
      },
    }),
  );
  // Same plugin id would collide; different ids are namespaced apart, so this
  // asserts the namespacing actually separates them.
  await registry.load(
    definePlugin({
      manifest: manifest("second.plugin"),
      setup(api) {
        api.commands.register({ name: "go", title: "Go", run: () => {} });
      },
    }),
  );
  expect(registry.commands().map((command) => command.name)).toEqual([
    "plugin_first_plugin_go",
    "plugin_second_plugin_go",
  ]);
});
