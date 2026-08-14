import { expect, test } from "bun:test";
import { z } from "zod";
import { createToolRegistry } from "@natalia/tools";
import {
  createPluginRegistry,
  definePlugin,
  resolvePluginConfig,
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

function configuredPlugin(input: {
  id: string;
  seen: { config?: unknown };
  configSchema?: ReturnType<typeof z.object>;
}) {
  return definePlugin({
    manifest: {
      apiVersion: 1,
      id: input.id,
      version: "1.0.0",
      name: "Configured",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    },
    configSchema: input.configSchema,
    setup(api) {
      input.seen.config = api.config;
      api.tools.register({
        name: "run",
        description: "Run",
        requiresApproval: false,
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok";
        },
      });
    },
  });
}

test("a plugin receives its own config validated by its declared schema", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools, allowed: ["tools"] });
  const seen: { config?: unknown } = {};
  await registry.load(
    configuredPlugin({
      id: "configured.plugin",
      seen,
      configSchema: z.object({
        retries: z.number().int().default(3),
        label: z.string(),
      }),
    }),
    undefined,
    { label: "primary" },
  );
  // The parsed value reaches setup, so schema defaults are applied.
  expect(seen.config).toEqual({ retries: 3, label: "primary" });
  expect(tools.has("plugin_configured_plugin_run")).toBe(true);
});

test("an invalid plugin config fails the load and registers nothing", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools, allowed: ["tools"] });
  const seen: { config?: unknown } = {};
  await expect(
    registry.load(
      configuredPlugin({
        id: "invalid.plugin",
        seen,
        configSchema: z.object({ label: z.string() }),
      }),
      undefined,
      { label: 42 },
    ),
  ).rejects.toThrow(/plugin config invalid: invalid.plugin/u);
  // Misconfiguration fails before setup runs, so nothing was contributed.
  expect(seen.config).toBeUndefined();
  expect(tools.has("plugin_invalid_plugin_run")).toBe(false);
  expect(registry.list()).toEqual([]);
  expect(registry.audit().map((entry) => entry.action)).toEqual(["failed"]);
});

test("a plugin without a config schema keeps its config unchanged", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools, allowed: ["tools"] });
  const seen: { config?: unknown } = {};
  await registry.load(configuredPlugin({ id: "raw.plugin", seen }), undefined, {
    anything: true,
  });
  expect(seen.config).toEqual({ anything: true });
});

test("plugin config validation reports the failing path", () => {
  const seen: { config?: unknown } = {};
  const plugin = configuredPlugin({
    id: "paths.plugin",
    seen,
    configSchema: z.object({ nested: z.object({ port: z.number() }) }),
  });
  expect(() => resolvePluginConfig(plugin, { nested: { port: "80" } })).toThrow(
    /\(at nested.port\)/u,
  );
});

test("an async plugin config schema is refused instead of loading unvalidated", () => {
  const seen: { config?: unknown } = {};
  const plugin = {
    ...configuredPlugin({ id: "async.plugin", seen }),
    configSchema: {
      "~standard": {
        validate: () => Promise.resolve({ value: {} }),
      },
    },
  };
  expect(() => resolvePluginConfig(plugin, {})).toThrow(
    /must be synchronous: async.plugin/u,
  );
});

test("conformance checks a plugin against the config it will be loaded with", async () => {
  const seen: { config?: unknown } = {};
  const plugin = configuredPlugin({
    id: "conformance.plugin",
    seen,
    configSchema: z.object({ endpoint: z.string().min(1) }),
  });
  const passed = await runPluginConformance({
    plugin,
    allowed: ["tools"],
    config: { endpoint: "https://example.test" },
  });
  expect(passed.every((check) => check.passed)).toBe(true);
  expect(seen.config).toEqual({ endpoint: "https://example.test" });

  // The same plugin with an unusable config fails its conformance run, so a
  // config contract is testable before the plugin ships.
  const failed = await runPluginConformance({
    plugin,
    allowed: ["tools"],
    config: {},
  });
  expect(failed[0]?.passed).toBe(false);
  expect(failed[0]?.detail).toMatch(
    /plugin config invalid: conformance.plugin/u,
  );
});
