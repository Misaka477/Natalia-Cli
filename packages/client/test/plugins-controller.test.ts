import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolRegistry } from "@natalia/tools";
import { CapabilityRegistry } from "@natalia/capability";
import {
  createPluginsController,
  pluginCapabilityID,
} from "../src/plugins-controller";
import { registerRuntimeConfigCapability } from "../src/capabilities/runtime-config-capability";
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
) {
  let synced = 0;
  const controller = createPluginsController({
    workspaceRoot: root,
    tools: createToolRegistry([]),
    capabilityRegistry,
    pluginPaths: () => [],
    pluginEnabled: () => undefined,
    pluginCapabilities: () => undefined,
    pluginReadOnly: () => undefined,
    pluginSettings: () => undefined,
    publish: () => undefined,
    syncGlobalCommands: () => {
      synced++;
    },
  });
  return { controller, synced: () => synced };
}

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
  expect(kernel.ownerOf("tools", "plugin_scanner_plugin_scan")).toBe(
    "plugin:scanner.plugin",
  );
  expect(kernel.scopeOf("plugin:scanner.plugin")).toBe("workspace");

  await controller.unload("scanner.plugin");
  expect(kernel.has("plugin:scanner.plugin")).toBe(false);
  expect(kernel.ownerOf("tools", "plugin_scanner_plugin_scan")).toBeUndefined();
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
    pluginPaths: () => [],
    pluginEnabled: () => undefined,
    pluginCapabilities: () => undefined,
    pluginReadOnly: () => undefined,
    pluginSettings: () => undefined,
    publish: (event) => {
      if (event.type === "diagnostic") diagnostics.push(event);
    },
    syncGlobalCommands: () => undefined,
  });
  await controller.init();
  expect(diagnostics.length).toBeGreaterThan(0);
  expect(
    diagnostics.some((entry) => entry.owner === "plugin:broken.plugin"),
  ).toBe(true);
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
    // Command names are namespaced to the plugin. The second immediate reload
    // must expose v2 even when both calls happen within one clock tick.
    expect(
      commands.some(
        (command) => command.name === "plugin_demo_plugin_reloaded_twice",
      ),
    ).toBe(true);
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
  expect(kernel.ownerOf("tools", "plugin_full_plugin_run")).toBe(
    "plugin:full.plugin",
  );
  expect(kernel.ownerOf("commands", "plugin_full_plugin_greet")).toBe(
    "plugin:full.plugin",
  );
  expect(
    kernel
      .contributions("listeners")
      .some(
        (entry) =>
          entry.capabilityID === "plugin:full.plugin" &&
          entry.name.startsWith("plugin_full_plugin_listener_"),
      ),
  ).toBe(true);

  // Unloading the plugin releases everything it owned, in every kind.
  await controller.unload("full.plugin");
  expect(kernel.ownerOf("tools", "plugin_full_plugin_run")).toBeUndefined();
  expect(
    kernel.ownerOf("commands", "plugin_full_plugin_greet"),
  ).toBeUndefined();
  expect(kernel.contributions("listeners")).toHaveLength(0);
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
  expect(kernel.ownerOf("services", "greeting")).toBe("plugin:svc.plugin");
  expect(kernel.service<{ text: string }>("greeting")?.text).toBe("hello");
  await controller.unload("svc.plugin");
  expect(kernel.ownerOf("services", "greeting")).toBeUndefined();
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
    pluginPaths: () => [],
    pluginEnabled: () => undefined,
    pluginCapabilities: () => undefined,
    pluginReadOnly: () => undefined,
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
  // The required service is provided before the plugin loads.
  registerRuntimeConfigCapability(kernel, { runtime: {} } as never);
  const { controller } = makeController(root, kernel);
  await controller.init();
  // The capability activated (its requires satisfied) and setup ran.
  expect(kernel.isPending(pluginCapabilityID("req.plugin"))).toBe(false);
  expect(kernel.has(pluginCapabilityID("req.plugin"))).toBe(true);
});
