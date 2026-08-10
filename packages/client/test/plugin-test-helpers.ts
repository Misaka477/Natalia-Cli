import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";

/**
 * Test helper: makes `@natalia/*` resolvable from a plugin workspace outside
 * the repo (bun resolves bare specifiers by walking up from the importing
 * file, and `/tmp` workspaces have no bun.lock/workspace context). Real
 * deployments must provide the same resolution — see the plugin guide's
 * dependency-resolution note.
 */
export async function installPluginSdkLinks(root: string) {
  const scoped = join(root, "node_modules", "@natalia");
  await mkdir(scoped, { recursive: true });
  for (const pkg of ["plugin", "contracts"]) {
    await symlink(
      join(process.cwd(), "packages", pkg),
      join(scoped, pkg),
      "dir",
    ).catch(() => undefined);
  }
}

/**
 * The plugin SDK entry as an absolute file URL for plugin test fixtures.
 * Bare-specifier resolution from a /tmp workspace is unreliable inside a test
 * process that has already resolved the specifier from the repo (bun caches
 * resolution by context), so fixtures import the SDK by absolute path.
 */
export function pluginSdkImportPath(): string {
  return join(process.cwd(), "packages", "plugin", "src", "index.ts");
}
