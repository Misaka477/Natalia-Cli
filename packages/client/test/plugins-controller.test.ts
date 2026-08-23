import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolRegistry } from "@natalia/tools";
import { CapabilityRegistry } from "@natalia/capability";
import { createPluginsController } from "../src/plugins-controller";
import { createRuntimeConfigPlugin } from "@natalia/runtime-config-plugin";
import {
  installPluginSdkLinks,
  pluginSdkImportPath,
} from "./plugin-test-helpers";

async function pluginWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-controller-"));
  await mkdir(join(root, ".natalia", "plugins", "demo.plugin"), {
    recursive: true,
  });
  await installPluginSdkLinks(root);
  await writeFile(
    join(root, ".natalia", "plugins", "demo.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "demo.plugin",
      version: "1.0.0",
      name: "Demo",
      capabilities: ["commands"],
    }),
  );
  await writeFile(
    join(root, ".natalia", "plugins", "demo.plugin", "index.ts"),
    `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "demo.plugin", version: "1.0.0", name: "Demo", capabilities: ["commands"] }, setup(api) { api.commands.register({ name: "hello", title: "Hello", run() {} }); } });`,
  );
  return root;
}

function makeController(
  root: string,
  capabilityRegistry = new CapabilityRegistry(),
  config: {
    enabled?: Record<string, boolean>;
    settings?: Record<string, unknown>;
  } = {},
) {
  let synced = 0;
  const controller = createPluginsController({
    workspaceRoot: root,
    tools: createToolRegistry([]),
    capabilityRegistry,
    pluginPaths: () => [".natalia/plugins"],
    pluginEnabled: () => config.enabled,
    pluginSettings: () => config.settings,
    publish: () => undefined,
    syncGlobalCommands: () => {
      synced++;
    },
  });
  return { controller, synced: () => synced };
}

test("plugins controller reconciles the configured external plugin set", async () => {
  const root = await pluginWorkspace();
  const config: {
    enabled?: Record<string, boolean>;
    settings?: Record<string, unknown>;
  } = {};
  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel, config);
  await controller.init();
  expect(controller.list().map((plugin) => plugin.id)).toEqual(["demo.plugin"]);

  config.enabled = { "demo.plugin": false };
  await controller.reconcile();
  expect(controller.list()).toHaveLength(0);
  expect(kernel.has("demo.plugin")).toBe(false);

  config.enabled = { "demo.plugin": true };
  await controller.reconcile();
  expect(controller.list().map((plugin) => plugin.id)).toEqual(["demo.plugin"]);
  expect(kernel.has("demo.plugin")).toBe(true);
  await controller.close();
});

test("plugins controller reapplies external plugin settings on reconcile", async () => {
  const root = await pluginWorkspace();
  const entry = join(root, ".natalia", "plugins", "demo.plugin", "index.ts");
  await writeFile(
    entry,
    `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "demo.plugin", version: "1.0.0", name: "Demo", capabilities: ["commands"] }, setup(api) { const name = String(api.config); api.commands.register({ name, title: name, run() {} }); } });`,
  );
  const config: { settings?: Record<string, unknown> } = {
    settings: { "demo.plugin": "before" },
  };
  const { controller } = makeController(root, new CapabilityRegistry(), config);
  await controller.init();
  expect(
    controller
      .get()
      .commands()
      .map((command) => command.name),
  ).toEqual(["before"]);

  config.settings = { "demo.plugin": "after" };
  await controller.reconcile();
  expect(
    controller
      .get()
      .commands()
      .map((command) => command.name),
  ).toEqual(["after"]);
  await controller.close();
});

test("plugins controller loads, unloads idempotently and reloads", async () => {
  const root = await pluginWorkspace();
  const { controller, synced } = makeController(root);
  await controller.init();
  expect(synced()).toBeGreaterThan(0);
  expect(
    controller
      .get()
      .list()
      .some((p) => p.id === "demo.plugin"),
  ).toBe(true);

  const unloaded = await controller.unload("demo.plugin");
  expect(unloaded.unloaded).toBe(true);
  const again = await controller.unload("demo.plugin");
  expect(again.unloaded).toBe(true);
  expect(controller.get().list()).toHaveLength(0);

  const reloaded = await controller.reload("demo.plugin");
  expect(reloaded.reloaded).toBe(true);
  expect(
    controller
      .get()
      .list()
      .some((p) => p.id === "demo.plugin"),
  ).toBe(true);

  const missing = await controller
    .reload("missing.plugin")
    .catch((error: unknown) => error);
  expect((missing as Error).message).toContain("plugin not found");

  await controller.close();
  expect(() => controller.get()).toThrow("plugins are not enabled");
});

test("plugins controller loads only configured lock-backed packages", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-closure-"));
  const modulesRoot = join(root, ".natalia", "plugins", "node_modules");
  const configuredRoot = join(modulesRoot, "configured-plugin");
  const neighborRoot = join(modulesRoot, "neighbor-plugin");
  await Promise.all([
    mkdir(configuredRoot, { recursive: true }),
    mkdir(neighborRoot, { recursive: true }),
  ]);
  for (const [directory, id, command] of [
    [configuredRoot, "configured.plugin", "configured"],
    [neighborRoot, "neighbor.plugin", "neighbor"],
  ] as const) {
    await writeFile(
      join(directory, "natalia.plugin.json"),
      JSON.stringify({
        apiVersion: 1,
        id,
        version: "1.0.0",
        name: id,
        entry: "index.ts",
        capabilities: ["commands"],
        scope: "workspace",
      }),
    );
    await writeFile(
      join(directory, "index.ts"),
      `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "${id}", version: "1.0.0", name: "${id}", capabilities: ["commands"], scope: "workspace" }, setup(api) { api.commands.register({ name: "${command}", title: "${command}", run() {} }); } });`,
    );
  }
  await writeFile(
    join(root, ".natalia", "natalia.lock"),
    JSON.stringify({
      version: 1,
      plugins: {
        "configured.plugin": {
          packageName: "configured-plugin",
          manifest: join(configuredRoot, "natalia.plugin.json"),
          metadata: {
            id: "configured.plugin",
            source: { type: "registry", spec: "configured-plugin@1.0.0" },
            resolvedVersion: "1.0.0",
            scope: "workspace",
            dependencies: [],
          },
        },
      },
    }),
  );
  const controller = createPluginsController({
    workspaceRoot: root,
    tools: createToolRegistry([]),
    capabilityRegistry: new CapabilityRegistry(),
    pluginPaths: () => [],
    pluginPackages: () => ({
      "configured.plugin": {
        source: { type: "registry", spec: "configured-plugin@1.0.0" },
        version: "1.0.0",
        scope: "workspace",
      },
    }),
    pluginEnabled: () => undefined,
    pluginSettings: () => undefined,
    publish: () => undefined,
    syncGlobalCommands: () => undefined,
  });
  await controller.init();
  expect(controller.list().map((plugin) => plugin.id)).toEqual([
    "configured.plugin",
  ]);
  expect(
    controller
      .get()
      .commands()
      .map((command) => command.name),
  ).toEqual(["configured"]);
  await controller.close();
});

test("plugin tools are owned by the kernel with the plugin's declared scope", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-owned-"));
  await mkdir(join(root, ".natalia", "plugins", "scanner.plugin"), {
    recursive: true,
  });
  await writeFile(
    join(root, ".natalia", "plugins", "scanner.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "scanner.plugin",
      version: "1.0.0",
      name: "Scanner",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
      scope: "workspace",
    }),
  );
  await writeFile(
    join(root, ".natalia", "plugins", "scanner.plugin", "index.ts"),
    `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "scanner.plugin", version: "1.0.0", name: "Scanner", capabilities: ["tools"], scope: "workspace" }, setup(api) { api.tools.register({ name: "scan", description: "Scan", requiresApproval: false, parameters: { type: "object", properties: {} }, async execute() { return "ok"; } }); } });`,
  );

  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  await controller.init();

  // The kernel owns the plugin's tool, named after the plugin, with the scope
  // the plugin declared — the same attribution a built-in family gets.
  expect(kernel.ownerOf("tools", "scan")).toBe("scanner.plugin");
  expect(kernel.scopeOf("scanner.plugin")).toBe("workspace");

  await controller.unload("scanner.plugin");
  expect(kernel.has("scanner.plugin")).toBe(false);
  expect(kernel.ownerOf("tools", "scan")).toBeUndefined();
  await controller.close();
});

test("a failing plugin's diagnostic is attributed to the plugin", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-owner-"));
  // A plugin whose entry does not exist fails to load; its diagnostic must say
  // which plugin it belongs to, so "which package failed" is traceable.
  await mkdir(join(root, ".natalia", "plugins", "broken.plugin"), {
    recursive: true,
  });
  await writeFile(
    join(root, ".natalia", "plugins", "broken.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "broken.plugin",
      version: "1.0.0",
      name: "Broken",
      description: "",
      entry: "missing.ts",
      capabilities: [],
    }),
  );
  const diagnostics: Array<{ owner?: string; message: string }> = [];
  const controller = createPluginsController({
    workspaceRoot: root,
    tools: createToolRegistry([]),
    capabilityRegistry: new CapabilityRegistry(),
    pluginPaths: () => [".natalia/plugins"],
    pluginEnabled: () => undefined,
    pluginSettings: () => undefined,
    publish: (event) => {
      if (event.type === "diagnostic") diagnostics.push(event);
    },
    syncGlobalCommands: () => undefined,
  });
  await controller.init();
  expect(diagnostics.length).toBeGreaterThan(0);
  expect(diagnostics.some((entry) => entry.owner === "broken.plugin")).toBe(
    true,
  );
  await controller.close();
});

test("plugin reload re-reads the module after a file change (cache-bust)", async () => {
  const root = await pluginWorkspace();
  const { controller } = makeController(root);
  await controller.init();
  // The plugin's file changes on disk (an agent self-edit promoted to the
  // system slot); reload must re-read it, not serve the cached module.
  const entry = join(root, ".natalia", "plugins", "demo.plugin", "index.ts");
  try {
    for (const name of ["reloaded_once", "reloaded_twice"]) {
      await writeFile(
        entry,
        `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "demo.plugin", version: "1.0.0", name: "Demo", capabilities: ["commands"] }, setup(api) { api.commands.register({ name: "${name}", title: "Reloaded", run() {} }); } });`,
      );
      await controller.reload("demo.plugin");
    }
    const commands = controller.get().commands();
    // The second immediate reload must expose v2 even when both calls happen
    // within one clock tick.
    expect(commands.some((command) => command.name === "reloaded_twice")).toBe(
      true,
    );
  } finally {
    await controller.close();
  }
});

test("the plugin capability owns its tools, commands and listeners (single channel)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-single-"));
  await mkdir(join(root, ".natalia", "plugins", "full.plugin"), {
    recursive: true,
  });
  await writeFile(
    join(root, ".natalia", "plugins", "full.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "full.plugin",
      version: "1.0.0",
      name: "Full",
      description: "",
      entry: "index.ts",
      capabilities: ["tools", "commands", "events"],
    }),
  );
  await writeFile(
    join(root, ".natalia", "plugins", "full.plugin", "index.ts"),
    `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "full.plugin", version: "1.0.0", name: "Full", capabilities: ["tools", "commands", "events"] }, setup(api) {
  api.tools.register({ name: "run", description: "Run", requiresApproval: false, parameters: { type: "object", properties: {} }, async execute() { return "ok"; } });
  api.commands.register({ name: "greet", title: "Greet", run() {} });
  api.events.on(() => {});
} });`,
  );

  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  await controller.init();

  // The plugin capability owns every kind it registers — tools, commands and
  // listeners are all kernel contributions, the same single channel a built-in
  // tool family uses.
  expect(kernel.ownerOf("tools", "run")).toBe("full.plugin");
  expect(kernel.ownerOf("commands", "greet")).toBe("full.plugin");
  expect(
    kernel
      .contributions("listeners")
      .some(
        (entry) =>
          entry.capabilityID === "full.plugin" &&
          entry.name.startsWith("full.plugin:listener:"),
      ),
  ).toBe(true);

  // Unloading the plugin releases everything it owned, in every kind.
  await controller.unload("full.plugin");
  expect(kernel.ownerOf("tools", "run")).toBeUndefined();
  expect(kernel.ownerOf("commands", "greet")).toBeUndefined();
  expect(kernel.contributions("listeners")).toHaveLength(0);
  await controller.close();
});

test("a plugin provides a service through the kernel, resolvable by name", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-service-"));
  await mkdir(join(root, ".natalia", "plugins", "svc.plugin"), {
    recursive: true,
  });
  await writeFile(
    join(root, ".natalia", "plugins", "svc.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "svc.plugin",
      version: "1.0.0",
      name: "Svc",
      description: "",
      entry: "index.ts",
      capabilities: [],
      provides: ["greeting"],
    }),
  );
  await writeFile(
    join(root, ".natalia", "plugins", "svc.plugin", "index.ts"),
    `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "svc.plugin", version: "1.0.0", name: "Svc", provides: ["greeting"] }, setup(api) {
  api.services.provide("greeting", { text: "hello" });
} });`,
  );

  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  await controller.init();

  // The plugin's service is a kernel-owned contribution, resolvable by name —
  // the first-class service surface a built-in capability has.
  expect(kernel.ownerOf("services", "greeting")).toBe("svc.plugin");
  expect(kernel.service<{ text: string }>("greeting")?.text).toBe("hello");
  await controller.unload("svc.plugin");
  expect(kernel.ownerOf("services", "greeting")).toBeUndefined();
  await controller.close();
});

test("the composition root can unload a builtin through its lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-builtin-"));
  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  await controller.init({ loadLocal: false });
  await controller.loadBuiltin({
    manifest: {
      apiVersion: 2,
      id: "builtin.service",
      version: "1.0.0",
      name: "Builtin Service",
      description: "Test builtin lifecycle.",
      entry: "natalia:test:builtin-service",
      scope: "workspace",
      provides: ["builtin.greeting"],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide("builtin.greeting", { text: "hello" });
    },
  });

  expect(kernel.service("builtin.greeting")).toBeDefined();
  await expect(controller.unload("builtin.service")).rejects.toThrow(
    "plugin not found",
  );
  await controller.unloadBuiltin("builtin.service");
  expect(kernel.service("builtin.greeting")).toBeUndefined();
  await controller.unloadBuiltin("builtin.service");
  await controller.close();
});

test("desired builtin reconciliation diffs identity, settings and enabled state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-builtins-desired-"));
  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  const lifecycle: string[] = [];
  const entry = (fingerprint: string, enabled = true) => ({
    id: "builtin.desired",
    enabled,
    fingerprint,
    create: () => ({
      manifest: {
        apiVersion: 2 as const,
        id: "builtin.desired",
        version: "1.0.0",
        name: "Desired",
        description: "Desired state test builtin.",
        entry: "natalia:test:desired",
        scope: "workspace" as const,
        provides: ["desired.value"],
        requires: [],
        optionalRequires: [],
        conflicts: [],
        dependencies: [],
        hooks: {},
        integrationPoints: ["services" as const],
      },
      setup(
        api: Parameters<
          ReturnType<typeof createRuntimeConfigPlugin>["setup"]
        >[0],
      ) {
        lifecycle.push("setup");
        api.services.provide("desired.value", {});
      },
      dispose() {
        lifecycle.push("dispose");
      },
    }),
  });

  await controller.init({ loadLocal: false });
  await controller.reconcileDesiredBuiltins([entry("one")], {
    "builtin.desired": { value: 1 },
  });
  await controller.reconcileDesiredBuiltins([entry("one")], {
    "builtin.desired": { value: 1 },
  });
  expect(lifecycle).toEqual(["setup"]);

  await controller.reconcileDesiredBuiltins([entry("two")], {
    "builtin.desired": { value: 1 },
  });
  await controller.reconcileDesiredBuiltins([entry("two")], {
    "builtin.desired": { value: 2 },
  });
  expect(lifecycle).toEqual(["setup", "dispose", "setup", "dispose", "setup"]);

  await controller.reconcileDesiredBuiltins([entry("two", false)], {});
  expect(kernel.service("desired.value")).toBeUndefined();
  expect(lifecycle.at(-1)).toBe("dispose");
  await controller.close();
});

test("desired builtin reconciliation restores dependency closure in catalog order", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-builtins-deps-"));
  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  const lifecycle: string[] = [];
  const catalog = (providerFingerprint: string) => [
    {
      id: "builtin.provider",
      enabled: true,
      fingerprint: providerFingerprint,
      create: () => ({
        manifest: {
          apiVersion: 2 as const,
          id: "builtin.provider",
          version: "1.0.0",
          name: "Provider",
          description: "",
          entry: "natalia:test:provider",
          scope: "workspace" as const,
          provides: [],
          requires: [],
          optionalRequires: [],
          conflicts: [],
          dependencies: [],
          hooks: {},
          integrationPoints: [],
        },
        setup() {
          lifecycle.push(`provider:${providerFingerprint}`);
        },
      }),
    },
    {
      id: "builtin.consumer",
      enabled: true,
      fingerprint: "stable",
      create: () => ({
        manifest: {
          apiVersion: 2 as const,
          id: "builtin.consumer",
          version: "1.0.0",
          name: "Consumer",
          description: "",
          entry: "natalia:test:consumer",
          scope: "workspace" as const,
          provides: [],
          requires: [],
          optionalRequires: [],
          conflicts: [],
          dependencies: [
            {
              id: "builtin.provider",
              spec: "*",
              optional: false,
              peer: false,
            },
          ],
          hooks: {},
          integrationPoints: [],
        },
        setup() {
          lifecycle.push("consumer");
        },
      }),
    },
  ];

  await controller.init({ loadLocal: false });
  await controller.reconcileDesiredBuiltins(catalog("one"), undefined);
  await controller.reconcileDesiredBuiltins(catalog("two"), undefined);
  expect(lifecycle).toEqual([
    "provider:one",
    "consumer",
    "provider:two",
    "consumer",
  ]);
  expect(controller.active("builtin.consumer")).toBe(true);
  await controller.close();
});

test("concurrent desired builtin reconciliation serializes complete lifecycle changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-builtins-concurrent-"));
  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  const lifecycle: string[] = [];
  const entry = (fingerprint: string) => ({
    id: "builtin.concurrent",
    enabled: true,
    fingerprint,
    create: () => ({
      manifest: {
        apiVersion: 2 as const,
        id: "builtin.concurrent",
        version: "1.0.0",
        name: "Concurrent",
        description: "",
        entry: "natalia:test:concurrent",
        scope: "workspace" as const,
        provides: [],
        requires: [],
        optionalRequires: [],
        conflicts: [],
        dependencies: [],
        hooks: {},
        integrationPoints: [],
      },
      async setup() {
        lifecycle.push(`setup:${fingerprint}`);
        await Promise.resolve();
      },
      async dispose() {
        lifecycle.push(`dispose:${fingerprint}`);
        await Promise.resolve();
      },
    }),
  });

  await controller.init({ loadLocal: false });
  await controller.reconcileDesiredBuiltins([entry("one")], undefined);
  await Promise.all([
    controller.reconcileDesiredBuiltins([entry("two")], undefined),
    controller.reconcileDesiredBuiltins([entry("three")], undefined),
  ]);
  expect(lifecycle).toEqual([
    "setup:one",
    "dispose:one",
    "setup:two",
    "dispose:two",
    "setup:three",
  ]);
  expect(kernel.has("builtin.concurrent")).toBe(true);
  await controller.close();
});

test("a plugin providing an undeclared service is refused", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-undeclared-"));
  await mkdir(join(root, ".natalia", "plugins", "bad.plugin"), {
    recursive: true,
  });
  await writeFile(
    join(root, ".natalia", "plugins", "bad.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "bad.plugin",
      version: "1.0.0",
      name: "Bad",
      description: "",
      entry: "index.ts",
      capabilities: [],
      provides: [],
    }),
  );
  await writeFile(
    join(root, ".natalia", "plugins", "bad.plugin", "index.ts"),
    `import { definePlugin } from "${pluginSdkImportPath()}";
export default definePlugin({ manifest: { apiVersion: 1, id: "bad.plugin", version: "1.0.0", name: "Bad" }, setup(api) {
  api.services.provide("undeclared", {});
} });`,
  );
  const diagnostics: string[] = [];
  const controller = createPluginsController({
    workspaceRoot: root,
    tools: createToolRegistry([]),
    capabilityRegistry: new CapabilityRegistry(),
    pluginPaths: () => [".natalia/plugins"],
    pluginEnabled: () => undefined,
    pluginSettings: () => undefined,
    publish: (event) => {
      if (event.type === "diagnostic") diagnostics.push(event.message);
    },
    syncGlobalCommands: () => undefined,
  });
  await controller.init();
  expect(
    diagnostics.some((message) => message.includes("undeclared service")),
  ).toBe(true);
  await controller.close();
});

test("a plugin requiring a service waits for it before its setup runs", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-requires-"));
  await mkdir(join(root, ".natalia", "plugins", "req.plugin"), {
    recursive: true,
  });
  await writeFile(
    join(root, ".natalia", "plugins", "req.plugin", "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "req.plugin",
      version: "1.0.0",
      name: "Req",
      description: "",
      entry: "index.ts",
      capabilities: [],
      requires: ["runtime.config"],
    }),
  );
  await writeFile(
    join(root, ".natalia", "plugins", "req.plugin", "index.ts"),
    `import { definePlugin } from "${pluginSdkImportPath()}";
let setupRan = false;
export default definePlugin({ manifest: { apiVersion: 1, id: "req.plugin", version: "1.0.0", name: "Req", requires: ["runtime.config"] }, setup(api) {
  setupRan = true;
  (globalThis as any).__reqPluginSetupRan = setupRan;
} });`,
  );

  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  // The runtime-config builtin provides the required service before the local
  // plugin loads, exactly as the real runtime wires it.
  await controller.init({ loadLocal: false });
  await controller.loadBuiltin(
    createRuntimeConfigPlugin({ runtime: {} } as never),
  );
  await controller.loadLocal();
  // Plugin dependency ordering ensures the service is available before setup.
  expect(kernel.has("req.plugin")).toBe(true);
  await controller.close();
});

test("plugins controller reactivates a mounted plugin when service provider identity changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugins-epochs-"));
  const kernel = new CapabilityRegistry();
  const { controller } = makeController(root, kernel);
  const lifecycle: string[] = [];
  let epoch = 0;
  await controller.init({ loadLocal: false });
  await controller.loadBuiltin({
    manifest: {
      apiVersion: 2,
      id: "builtin.consumer",
      version: "1.0.0",
      name: "Consumer",
      description: "",
      entry: "natalia:test:consumer",
      scope: "workspace",
      provides: [],
      requires: ["test.provider"],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["resources"],
    },
    setup(api) {
      const current = ++epoch;
      lifecycle.push(`setup:${current}`);
      api.resources.register({ name: "consumer.resource", epoch: current });
    },
    dispose() {
      lifecycle.push(`dispose:${epoch}`);
    },
  });
  expect(controller.status("builtin.consumer")?.status).toBe("pending");
  expect(controller.active("builtin.consumer")).toBe(false);

  const providerA = kernel.registerOwner({
    id: "provider:a",
    name: "Provider A",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  providerA.contribute("services", "test.provider", {});
  await controller.get().whenIdle();
  expect(controller.active("builtin.consumer")).toBe(true);
  expect(
    kernel.contribution<{ epoch: number }>("resources", "consumer.resource")
      ?.epoch,
  ).toBe(1);

  const providerB = kernel.registerOwner({
    id: "provider:b",
    name: "Provider B",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
    precedence: 1,
  });
  providerB.contribute("services", "test.provider", {});
  await controller.get().whenIdle();
  expect(controller.active("builtin.consumer")).toBe(true);
  expect(
    kernel.contribution<{ epoch: number }>("resources", "consumer.resource")
      ?.epoch,
  ).toBe(2);

  providerB.release();
  await controller.get().whenIdle();
  expect(controller.status("builtin.consumer")?.status).toBe("pending");
  expect(kernel.contribution("resources", "consumer.resource")).toBeUndefined();

  const providerC = kernel.registerOwner({
    id: "provider:c",
    name: "Provider C",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  providerC.contribute("services", "test.provider", {});
  await controller.get().whenIdle();
  expect(
    kernel.contribution<{ epoch: number }>("resources", "consumer.resource")
      ?.epoch,
  ).toBe(3);
  expect(lifecycle).toEqual([
    "setup:1",
    "dispose:1",
    "setup:2",
    "dispose:2",
    "setup:3",
  ]);
  await controller.unloadBuiltin("builtin.consumer");
  expect(lifecycle).toEqual([
    "setup:1",
    "dispose:1",
    "setup:2",
    "dispose:2",
    "setup:3",
    "dispose:3",
  ]);
  providerA.release();
  providerC.release();
  await controller.close();
});
