/**
 * Out-of-tree tool family loading (the 分发层's local half).
 *
 * A family is a package: a directory with a `natalia.tool.json` manifest naming
 * the entry, and the entry's default export is the family — either the
 * `ToolFamily` itself or a factory returning it, so a family can be written the
 * same way a `packages/tool-*` package is. Loaded families join the built-ins
 * through the same capability kernel, owning their tools the same way; nothing
 * about an out-of-tree family is special-cased once loaded.
 *
 * `reloadLocalToolFamily` is the hot-reload a self-modifying agent needs: after
 * its change is promoted to the system slot, the entry is re-imported with a
 * cache-busting query and re-registered without a restart.
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

export type LocalToolFamilyOptions = {
  onError?: (id: string, error: unknown) => void;
  trust?: {
    workspaceRoot: string;
    verify: (
      key: string,
      entryPath: string,
    ) => Promise<{ verified: boolean; expected?: string; actual?: string }>;
  };
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
  trust?: LocalToolFamilyOptions["trust"];
}): Promise<ToolFamily[]> {
  const families: ToolFamily[] = [];
  for (const root of input.roots) {
    const discovered = await discoverLocalToolFamilies(root);
    for (const { manifest, path } of discovered) {
      const imported = await importLocalToolFamily(manifest, path, input);
      if (!imported) continue;
      if (input.enabled?.[imported.family.id] === false) continue;
      families.push(imported.family);
    }
  }
  return families;
}

/**
 * Re-imports one out-of-tree family with a cache-busting query — the hot
 * reload a self-modifying agent needs after its change is promoted: the entry
 * on disk is re-read and re-registered without a restart. The reload still
 * verifies the package against the trust database.
 */
export async function reloadLocalToolFamily(input: {
  roots: string[];
  familyID: string;
  enabled?: Record<string, boolean>;
  onError?: (id: string, error: unknown) => void;
  trust?: LocalToolFamilyOptions["trust"];
}): Promise<ToolFamily> {
  for (const root of input.roots) {
    const discovered = await discoverLocalToolFamilies(root);
    for (const { manifest, path } of discovered) {
      const imported = await importLocalToolFamily(manifest, path, input, {
        cacheBust: true,
      });
      if (imported?.family.id !== input.familyID) continue;
      if (input.enabled?.[input.familyID] === false)
        throw new Error(`tool family is disabled in config: ${input.familyID}`);
      return imported.family;
    }
  }
  throw new Error(`tool family not found: ${input.familyID}`);
}

async function importLocalToolFamily(
  manifest: LocalToolFamilyManifest,
  path: string,
  input: LocalToolFamilyOptions,
  options?: { cacheBust?: boolean },
): Promise<{ family: ToolFamily; entryPath: string } | undefined> {
  const entryPath = resolve(path, "..", manifest.entry);
  try {
    if (input.trust) {
      const verified = await input.trust.verify(keyForPath(path), entryPath);
      if (verified.expected && !verified.verified) {
        input.onError?.(
          path,
          new Error("package changed since install (fingerprint mismatch)"),
        );
        return undefined;
      }
    }
    const href = options?.cacheBust
      ? // Bun ignores query strings on file:// URLs, but a plain path with a
        // query is a fresh cache key — the hot reload must re-read the entry.
        `${entryPath}?reload=${Date.now()}`
      : pathToFileURL(entryPath).href;
    const module = (await import(href)) as { default?: unknown };
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
      return undefined;
    }
    return { family, entryPath };
  } catch (error) {
    input.onError?.(path, error);
    return undefined;
  }
}

/**
 * The trust-record key for a family package. The family id is only known after
 * import, so a package is keyed by its resolved directory path.
 */
function keyForPath(manifestPath: string) {
  return resolve(manifestPath, "..");
}

/**
 * Watches out-of-tree family entries and reports changes, debounced per family.
 *
 * This is the "hot" half of HMR: after the agent's change is promoted (and the
 * trust record re-pinned), the entry changes on disk and the watcher fires. The
 * caller decides what the change means — a trusted change is hot-reloaded, an
 * untrusted one is reported as an edit without promotion. `fs.watch` is used so
 * no polling is involved; returning `close` keeps the watcher's lifecycle in
 * the caller's hands.
 */
export async function watchLocalToolFamilies(input: {
  roots: string[];
  /** Called with the family id and its entry path when the entry changed. */
  onChange: (familyID: string, entryPath: string) => void;
  debounceMs?: number;
}): Promise<() => Promise<void>> {
  const debounceMs = input.debounceMs ?? 150;
  const { watch } = await import("node:fs");
  const entries: Array<{ familyID: string; dir: string; entryPath: string }> =
    [];
  for (const root of input.roots) {
    const discovered = await discoverLocalToolFamilies(root);
    for (const { manifest, path } of discovered) {
      const entryPath = resolve(path, "..", manifest.entry);
      // The id is only known after import; derive it once at watch time.
      const module = (await import(pathToFileURL(entryPath).href)) as {
        default?: unknown;
      };
      const exported = module.default;
      const family =
        typeof exported === "function"
          ? (exported as () => ToolFamily)()
          : (exported as ToolFamily | undefined);
      if (!family?.id) continue;
      entries.push({
        familyID: family.id,
        dir: resolve(path, ".."),
        entryPath,
      });
    }
  }
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers = entries.map(({ familyID, dir, entryPath }) =>
    watch(dir, (_event, filename) => {
      if (filename?.toString() !== entryPath.split("/").pop()) return;
      const existing = timers.get(familyID);
      if (existing) clearTimeout(existing);
      timers.set(
        familyID,
        setTimeout(() => {
          timers.delete(familyID);
          input.onChange(familyID, entryPath);
        }, debounceMs),
      );
    }),
  );
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    for (const watcher of watchers) watcher.close();
  };
}
