import { resolveConfig } from "@natalia/config";
import type { PluginPackageSource } from "@natalia/contracts";
import { discoverPluginManifests, type PluginManifest } from "@natalia/plugin";
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
  source: PluginPackageSource | { type: "runtime" };
  packageName: string | null;
};

export function runtimeDefaultPlugin(
  id: string,
  additionalManifests: readonly PluginManifest[] = [],
) {
  return additionalManifests.find((manifest) => manifest.id === id);
}

export async function listInstalledPlugins(
  workspaceRoot: string,
  options: {
    globalPath?: string;
    runtimeManifests?: readonly PluginManifest[];
  } = {},
): Promise<PluginCatalogRow[]> {
  const { runtimeManifests = [], ...configOptions } = options;
  const [lock, { config }] = await Promise.all([
    loadNataliaLock(workspaceRoot),
    resolveConfig({ workspaceRoot, ...configOptions }),
  ]);
  const rows = new Map<string, PluginCatalogRow>();
  for (const manifest of runtimeManifests)
    rows.set(manifest.id, {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      scope: manifest.scope,
      enabled: config.plugins.enabled[manifest.id] !== false,
      installed: true,
      source: { type: "runtime" },
      packageName: null,
    });
  for (const entry of Object.values(lock.plugins)) {
    const packageDir = packageDirectory(
      pluginClosurePaths(workspaceRoot).pluginsDir,
      entry.packageName,
    );
    const manifest = (
      await discoverPluginManifests(packageDir, { nodeModules: false })
    )[0]?.manifest;
    rows.set(entry.metadata.id, {
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
  return [...rows.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}
