import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolRegistry } from "@natalia/tools";
import { CapabilityRegistry } from "@natalia/capability";
import { createPluginsController } from "../src/plugins-controller";
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
