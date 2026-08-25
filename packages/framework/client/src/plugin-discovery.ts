import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginPackageConfig } from "@natalia/contracts";
import {
  discoverPluginManifests,
  resolveInstalledPluginEntries,
  validatePluginPath,
  type DesiredPluginEntry,
  type Plugin,
  type PluginManifestEntry,
} from "@natalia/plugin";

export async function discoverDesiredPluginEntries(input: {
  workspaceRoot: string;
  paths: string[];
  packages: Record<string, PluginPackageConfig>;
  enabled?: Record<string, boolean>;
  declaredIDs: string[];
  onError(id: string, error: unknown): void;
}): Promise<DesiredPluginEntry[]> {
  const installed = await resolveInstalledPluginEntries({
    workspaceRoot: input.workspaceRoot,
    packages: input.packages,
    enabled: input.enabled,
  });
  for (const failure of installed.errors)
    input.onError(failure.id, failure.error);

  const ids = new Set(input.declaredIDs);
  const configured = new Set(Object.keys(input.packages));
  for (const id of configured) {
    if (ids.has(id)) throw new Error(`duplicate plugin id: ${id}`);
    ids.add(id);
  }
  const discovered = [...installed.entries];
  const roots = new Set([
    resolve(input.workspaceRoot, ".natalia", "plugins"),
    ...input.paths.map((path) => resolve(input.workspaceRoot, path)),
  ]);
  for (const root of roots)
    for (const entry of await discoverPluginManifests(root, {
      nodeModules: false,
    })) {
      if (configured.has(entry.manifest.id))
        throw new Error(
          `plugin ${entry.manifest.id} is declared by more than one source`,
        );
      assertUnique(entry, ids);
      if (input.enabled?.[entry.manifest.id] === false) continue;
      discovered.push(entry);
    }

  return discovered.map((entry) => desiredEntry(entry, input));
}

function assertUnique(entry: PluginManifestEntry, ids: Set<string>) {
  if (ids.has(entry.manifest.id))
    throw new Error(`duplicate plugin id: ${entry.manifest.id}`);
  ids.add(entry.manifest.id);
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
