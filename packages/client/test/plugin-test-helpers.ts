import { cp, mkdir, symlink } from "node:fs/promises";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

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
    const target = join(scoped, pkg);
    try {
      await symlink(join(process.cwd(), "packages", pkg), target, "dir");
    } catch {
      // Windows without Developer Mode cannot create directory symlinks, and a
      // hard failure here would mask the plugin-loading behaviour under test.
      // A copy resolves identically inside the test process. The packages'
      // own node_modules links (bun junctions) cannot be copied either, so
      // they are excluded: `@natalia/contracts` resolves from the sibling
      // copy, and anything else resolves up through the repository root.
      await cp(join(process.cwd(), "packages", pkg), target, {
        recursive: true,
        filter: (source) => !source.includes(`${sep}node_modules${sep}`),
      });
    }
  }
}

/**
 * The plugin SDK entry as a file URL for plugin test fixtures. Bare-specifier
 * resolution from a /tmp workspace is unreliable inside a test process that
 * has already resolved the specifier from the repo (bun caches resolution by
 * context), so fixtures import the SDK by absolute URL. A Windows drive path
 * must be a file URL: bun parses a raw `E:\...` import specifier as an
 * unix-style path and mangles the drive letter.
 */
export function pluginSdkImportPath(): string {
  return pathToFileURL(
    join(process.cwd(), "packages", "plugin", "src", "index.ts"),
  ).href;
}
