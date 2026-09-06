import {
  OFFICIAL_PLUGIN_PACKAGES,
  installPlugin,
  listInstalledPlugins,
  loadNataliaLock,
  saveNataliaLock,
  setPluginEnabled,
  uninstallPlugin,
} from "@natalia/installer";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";

type OfficialPlugin = (typeof OFFICIAL_PLUGIN_PACKAGES)[number];

async function installOfficialLocal(
  pluginStoreRoot: string,
  official: OfficialPlugin,
) {
  const distributionRoot = resolve(pluginStoreRoot, "..", "plugins");
  const sourceDir = resolve(distributionRoot, official.directory);
  const packagesDir = resolve(pluginStoreRoot, "node_modules");
  const packageRoot = resolve(packagesDir, ...official.packageName.split("/"));
  await mkdir(packagesDir, { recursive: true });
  await rm(packageRoot, { recursive: true, force: true });
  await cp(sourceDir, packageRoot, { recursive: true });
  const lock = await loadNataliaLock(pluginStoreRoot);
  lock.plugins[official.id] = {
    packageName: official.packageName,
    manifest: resolve(packageRoot, "natalia.plugin.json"),
    metadata: {
      id: official.id,
      source: {
        type: "path",
        path: sourceDir,
      },
      resolvedVersion: "1.0.0",
      scope: "session",
      dependencies: [],
    },
  };
  await saveNataliaLock(pluginStoreRoot, lock);
  return {
    installed: true,
    pluginID: official.id,
    packageName: official.packageName,
  };
}

type PluginRuntime = Pick<
  RuntimeServiceClient,
  "pluginInstall" | "pluginUninstall" | "pluginSetEnabled" | "pluginCatalog"
>;

export function createPluginRuntime(ctx: RuntimeContext): PluginRuntime {
  async function requirePluginStore(): Promise<string> {
    if (!ctx.state.pluginStoreRoot)
      throw new Error("plugin store is not configured for this runtime");
    return ctx.state.pluginStoreRoot;
  }

  return {
    async pluginCatalog() {
      const pluginStoreRoot = await requirePluginStore();
      return await listInstalledPlugins({
        pluginStoreRoot,
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
      });
    },
    async pluginInstall(input) {
      const pluginStoreRoot = await requirePluginStore();
      const official = OFFICIAL_PLUGIN_PACKAGES.find(
        (plugin) => plugin.packageName === input.spec,
      );
      const result = official
        ? await installOfficialLocal(pluginStoreRoot, official)
        : await installPlugin({
            pluginStoreRoot,
            spec: input.spec,
            workspaceRoot: ctx.ports.getWorkspaceRoot(),
          });
      await ctx.ports.reloadConfigFromDisk?.();
      return result;
    },
    async pluginUninstall(input) {
      const pluginStoreRoot = await requirePluginStore();
      const result = await uninstallPlugin({
        pluginStoreRoot,
        pluginID: input.pluginID,
      });
      await ctx.ports.reloadConfigFromDisk?.();
      return result;
    },
    async pluginSetEnabled(input) {
      const pluginStoreRoot = await requirePluginStore();
      const result = await setPluginEnabled({
        pluginStoreRoot,
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        pluginID: input.pluginID,
        enabled: input.enabled,
        apply: async () => {
          await ctx.ports.reloadConfigFromDisk?.();
        },
      });
      return result;
    },
  };
}
