import { resolveConfig } from "@anthelia/config";
import type {
  PluginPackageSource,
  PluginUiManifest,
} from "@anthelia/contracts";
import { discoverPluginManifests } from "@anthelia/plugin";
import {
  loadNataliaLock,
  packageDirectory,
  pluginClosurePaths,
} from "./closure";

export type PluginCatalogRow = {
  id: string;
  name: string | null;
  version: string;
  scope: "process" | "workspace" | "session";
  enabled: boolean;
  installed: boolean;
  source: PluginPackageSource;
  packageName: string | null;
  ui?: PluginUiManifest;
};

export async function listInstalledPlugins(input: {
  pluginStoreRoot: string;
  workspaceRoot: string;
  globalPath?: string;
}): Promise<PluginCatalogRow[]> {
  const [lock, { config }] = await Promise.all([
    loadNataliaLock(input.pluginStoreRoot),
    resolveConfig(input),
  ]);
  const rows: PluginCatalogRow[] = [];
  for (const entry of Object.values(lock.plugins)) {
    const packageDir = packageDirectory(
      pluginClosurePaths(input.pluginStoreRoot).pluginsDir,
      entry.packageName,
    );
    const manifest = (
      await discoverPluginManifests(packageDir, { nodeModules: false })
    )[0]?.manifest;
    rows.push({
      id: entry.metadata.id,
      name: manifest?.name ?? null,
      version: entry.metadata.resolvedVersion,
      scope: entry.metadata.scope,
      enabled: config.plugins.enabled[entry.metadata.id] !== false,
      installed: true,
      source: entry.metadata.source,
      packageName: entry.packageName,
      ui: manifest?.apiVersion === 2 ? manifest.ui : undefined,
    });
  }
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}
