import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import {
  WORKSPACE_FILES_SERVICE,
  WORKSPACE_MUTATIONS_SERVICE,
  WORKSPACE_WRITE_LOCK_SERVICE,
  type MutationRegistry,
  type WorkspaceFilesController,
  type WorkspaceWriteLock,
} from "@natalia/runtime-services";
import { createWorkspacePlugin, WORKSPACE_PLUGIN_ID } from "../src";

test("workspace resources exist only while the plugin is loaded", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-plugin-"));
  const services = new Map<string, unknown>();
  const registry = createPluginRegistry({
    tools: {
      set() {},
      get() {
        return undefined;
      },
      delete() {},
    } as never,
    allowed: ["services"],
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createWorkspacePlugin({
    workspaceRoot: root,
    listPaths: async () => [],
  });

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: WORKSPACE_PLUGIN_ID,
    provides: [
      WORKSPACE_WRITE_LOCK_SERVICE,
      WORKSPACE_MUTATIONS_SERVICE,
      WORKSPACE_FILES_SERVICE,
    ],
    requires: [],
    dependencies: [],
  });
  expect(services.size).toBe(0);

  try {
    await registry.loadBuiltin(plugin);
    expect(
      services.get(WORKSPACE_WRITE_LOCK_SERVICE) as WorkspaceWriteLock,
    ).toHaveProperty("acquire");
    expect(
      services.get(WORKSPACE_MUTATIONS_SERVICE) as MutationRegistry,
    ).toHaveProperty("register");
    expect(
      services.get(WORKSPACE_FILES_SERVICE) as WorkspaceFilesController,
    ).toHaveProperty("reconcile");

    await registry.unload(WORKSPACE_PLUGIN_ID);
    expect(services.size).toBe(0);
  } finally {
    await registry.unload(WORKSPACE_PLUGIN_ID).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
});
