/**
 * Out-of-tree tool family loading (the 分发层's local half).
 *
 * A family is a package: a directory with a `natalia.tool.json` manifest naming
 * the entry, and the entry's default export is the family — either the
 * `ToolFamily` itself or a factory returning it, so a family can be written the
 * same way a `packages/tool-*` package is. Loaded families join the built-ins
 * through the same capability kernel, owning their tools the same way; nothing
 * about an out-of-tree family is special-cased once loaded.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolFamily } from "@natalia/tools";

export const TOOL_FAMILY_MANIFEST = "natalia.tool.json";

export type LocalToolFamilyManifest = {
  /** Relative entry, like a plugin's `entry`. */
  entry: string;
};

/** The discovered family packages under a root, in stable order. */
export async function discoverLocalToolFamilies(root: string) {
  const dir = resolve(root);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const directories = [
    dir,
    ...entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name)),
  ];
  const discovered: Array<{ manifest: LocalToolFamilyManifest; path: string }> =
    [];
  for (const directory of directories) {
    const path = join(directory, TOOL_FAMILY_MANIFEST);
    try {
      discovered.push({
        manifest: JSON.parse(
          await readFile(path, "utf8"),
        ) as LocalToolFamilyManifest,
        path,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return discovered;
}

/**
 * Loads the out-of-tree families declared by `tools.paths`, applying the same
 * `tools.enabled` filter the built-ins get. A family whose entry cannot be
 * imported, or whose default export is not a family, is skipped with its error
 * reported — a broken package must not take the rest of the catalogue down.
 *
 * When `trust` is provided, each family's entry is verified against the trust
 * database: a changed or replaced package is reported (not loaded silently) so
 * the operator hears that the bytes differ from what was installed.
 */
export async function loadLocalToolFamilies(input: {
  roots: string[];
  enabled?: Record<string, boolean>;
  onError?: (id: string, error: unknown) => void;
  trust?: {
    workspaceRoot: string;
    verify: (
      key: string,
      entryPath: string,
    ) => Promise<{ verified: boolean; expected?: string; actual?: string }>;
  };
}): Promise<ToolFamily[]> {
  const families: ToolFamily[] = [];
  for (const root of input.roots) {
    const discovered = await discoverLocalToolFamilies(root);
    for (const { manifest, path } of discovered) {
      const entryPath = resolve(path, "..", manifest.entry);
      try {
        if (input.trust) {
          const verified = await input.trust.verify(
            keyForPath(path),
            entryPath,
          );
          if (verified.expected && !verified.verified) {
            input.onError?.(
              path,
              new Error("package changed since install (fingerprint mismatch)"),
            );
            continue;
          }
        }
        const module = (await import(pathToFileURL(entryPath).href)) as {
          default?: unknown;
        };
        const exported = module.default;
        const family =
          typeof exported === "function"
            ? (exported as () => ToolFamily)()
            : (exported as ToolFamily | undefined);
        if (!family || typeof family.id !== "string") {
          input.onError?.(
            path,
            new Error(`tool family entry has no default export: ${entryPath}`),
          );
          continue;
        }
        if (input.enabled?.[family.id] === false) continue;
        families.push(family);
      } catch (error) {
        input.onError?.(path, error);
      }
    }
  }
  return families;
}

/**
 * The trust-record key for a family package. The family id is only known after
 * import, so a package is keyed by its resolved directory path.
 */
function keyForPath(manifestPath: string) {
  return resolve(manifestPath, "..");
}
