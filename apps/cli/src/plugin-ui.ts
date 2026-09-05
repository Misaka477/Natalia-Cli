import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import {
  listInstalledPlugins,
  packageDirectory,
} from "@natalia/installer";

/**
 * Resolves a plugin's renderer-side UI bundle from the local plugin store.
 *
 * The transport stays install-location agnostic; this closure is provided by
 * the CLI and owns the plugin-store path and enabled/installed checks. Official
 * and third-party plugins go through exactly the same path.
 */
export function createPluginUiResolver(pluginStoreRoot: string) {
  return async (pluginId: string) => {
    const rows = await listInstalledPlugins({
      pluginStoreRoot,
      workspaceRoot: process.cwd(),
    });
    const row = rows.find(
      (candidate) => candidate.id === pluginId && candidate.enabled,
    );
    if (!row?.packageName || !row.ui?.entry) return undefined;
    const packageDir = resolve(
      packageDirectory(resolve(pluginStoreRoot), row.packageName),
    );
    const entry = resolve(packageDir, row.ui.entry);
    const rel = relative(packageDir, entry);
    if (
      rel === ".." ||
      rel.startsWith(`..${sep}`) ||
      rel.startsWith(`${sep}`) ||
      /^[a-zA-Z]:/u.test(rel)
    )
      return undefined;
    const body = await readFile(entry);
    return { body: new Uint8Array(body) };
  };
}
