import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { nataliaLockSchema, type NataliaLock } from "@natalia/contracts";
import { pluginManifestSchema, type PluginManifest } from "./manifest";

export type PluginManifestEntry = { manifest: PluginManifest; path: string };
export type InstalledPluginEntryResolution = {
  entries: PluginManifestEntry[];
  errors: Array<{ id: string; error: Error }>;
};

export async function loadNataliaPluginLock(
  pluginStoreRoot: string,
): Promise<NataliaLock> {
  try {
    return nataliaLockSchema.parse(
      JSON.parse(await readFile(join(pluginStoreRoot, "natalia.lock"), "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, plugins: {} };
    throw error;
  }
}

export async function resolveInstalledPluginEntries(input: {
  pluginStoreRoot: string;
  enabled?: Record<string, boolean>;
}): Promise<InstalledPluginEntryResolution> {
  const entries: PluginManifestEntry[] = [];
  const errors: InstalledPluginEntryResolution["errors"] = [];
  let lock: NataliaLock;
  try {
    lock = await loadNataliaPluginLock(input.pluginStoreRoot);
  } catch (error) {
    return {
      entries,
      errors: [
        {
          id: "plugin-store",
          error: new Error(
            `could not read natalia.lock: ${error instanceof Error ? error.message : String(error)}`,
          ),
        },
      ],
    };
  }
  const modulesRoot = resolve(input.pluginStoreRoot, "node_modules");
  for (const [id, locked] of Object.entries(lock.plugins)) {
    if (input.enabled?.[id] === false) continue;
    try {
      if (locked.metadata.id !== id)
        throw new Error(`plugin ${id} lock entry has id ${locked.metadata.id}`);
      if (!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/iu.test(locked.packageName))
        throw new Error(
          `plugin ${id} has invalid package name in natalia.lock`,
        );
      const packageRoot = resolve(
        modulesRoot,
        ...locked.packageName.split("/"),
      );
      assertPathInside(
        modulesRoot,
        packageRoot,
        "plugin package path escapes closure",
      );
      const manifestPath = resolve(locked.manifest);
      assertPathInside(
        packageRoot,
        manifestPath,
        "plugin manifest escapes package",
      );
      const [actualModulesRoot, actualPackageRoot, actualManifestPath] =
        await Promise.all([
          realpath(modulesRoot),
          realpath(packageRoot),
          realpath(manifestPath),
        ]);
      assertPathInside(
        actualModulesRoot,
        actualPackageRoot,
        "plugin package path escapes closure",
      );
      assertPathInside(
        actualPackageRoot,
        actualManifestPath,
        "plugin manifest escapes package",
      );
      const manifest = pluginManifestSchema.parse(
        JSON.parse(await readFile(actualManifestPath, "utf8")),
      );
      if (manifest.id !== id)
        throw new Error(`plugin ${id} manifest has id ${manifest.id}`);
      if (manifest.version !== locked.metadata.resolvedVersion)
        throw new Error(`plugin ${id} version does not match natalia.lock`);
      if (manifest.scope !== locked.metadata.scope)
        throw new Error(`plugin ${id} scope does not match natalia.lock`);
      const entry = validatePluginPath(
        resolve(actualManifestPath, ".."),
        manifest.entry,
      );
      assertPathInside(
        actualPackageRoot,
        await realpath(entry),
        "plugin entry escapes package",
      );
      entries.push({ manifest, path: actualManifestPath });
    } catch (error) {
      errors.push({
        id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  return { entries, errors };
}

function assertPathInside(root: string, candidate: string, message: string) {
  const inside = relative(resolve(root), resolve(candidate));
  if (inside !== "" && (inside.startsWith("..") || isAbsolute(inside)))
    throw new Error(message);
}

export function validatePluginPath(root: string, path: string) {
  const resolved = resolve(root, path);
  const inside = relative(resolve(root), resolved);
  if (inside !== "" && (inside.startsWith("..") || isAbsolute(inside)))
    throw new Error("plugin path escapes root");
  if (
    !isAbsolute(resolved) ||
    ![".js", ".mjs", ".ts"].some((extension) => resolved.endsWith(extension))
  )
    throw new Error("plugin entry must be a local JS or TS module");
  return resolved;
}
