import { resolveConfig } from "@natalia/config";
import type { PluginPackageSource } from "@natalia/contracts";
import { discoverPluginManifests } from "@natalia/plugin";
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
    });
  }
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}
