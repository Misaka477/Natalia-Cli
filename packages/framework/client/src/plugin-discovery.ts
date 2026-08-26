import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginPackageConfig } from "@natalia/contracts";
import {
  resolveInstalledPluginEntries,
  validatePluginPath,
  type DesiredPluginEntry,
  type Plugin,
  type PluginManifestEntry,
} from "@natalia/plugin";

export async function discoverDesiredPluginEntries(input: {
  pluginStoreRoot: string;
  packages?: Record<string, PluginPackageConfig>;
  enabled?: Record<string, boolean>;
  declaredIDs: string[];
  onError(id: string, error: unknown): void;
}): Promise<DesiredPluginEntry[]> {
  const installed = await resolveInstalledPluginEntries({
    pluginStoreRoot: input.pluginStoreRoot,
    enabled: input.enabled,
  });
  for (const failure of installed.errors)
    input.onError(failure.id, failure.error);

  const ids = new Set(input.declaredIDs);
  for (const id of installed.entries.map(({ manifest }) => manifest.id)) {
    if (ids.has(id)) throw new Error(`duplicate plugin id: ${id}`);
    ids.add(id);
  }
  return installed.entries.map((entry) => desiredEntry(entry, input));
}

function desiredEntry(
  entry: PluginManifestEntry,
  input: { onError(id: string, error: unknown): void },
): DesiredPluginEntry {
  const { manifest, path } = entry;
  return {
    id: manifest.id,
    enabled: true,
    fingerprint: JSON.stringify({ manifest, path }),
    manifest,
    onError: (error) => input.onError(manifest.id, error),
    async load(cacheBust) {
      const modulePath = validatePluginPath(
        resolve(path, ".."),
        manifest.entry,
      );
      const specifier = cacheBust
        ? `${modulePath}?reload=${cacheBust}`
        : pathToFileURL(modulePath).href;
      const module = (await import(specifier)) as { default?: unknown };
      const candidate = module.default as Partial<Plugin> | undefined;
      if (!candidate?.setup || typeof candidate.setup !== "function")
        throw new Error(`plugin module has no setup function: ${manifest.id}`);
      return { ...candidate, manifest } as Plugin;
    },
  };
}
