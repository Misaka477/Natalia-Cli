/**
 * The local-tools built-in plugin: out-of-tree tool families discovered in
 * configured `tools.paths`.
 *
 * A family is a package: a directory with a `natalia.tool.json` manifest naming
 * the entry, whose default export is the family. The plugin loads them through
 * the unified plugin lifecycle — its capability owns every contributed tool,
 * unloading releases them, and a disabled or absent plugin leaves no tools and
 * starts no watcher.
 *
 * The plugin also owns the hot-reload watcher (the "hot" half of HMR a
 * self-modifying agent needs) and exposes a `localTools.reload` service the
 * host calls to swap one family's tools after its change is promoted.
 */
import type { Plugin } from "@natalia/plugin";
import type { ToolFamily } from "@natalia/tools";
import {
  loadLocalToolFamilies,
  reloadLocalToolFamily,
  watchLocalToolFamilies,
  type LocalToolFamilyOptions,
} from "../capabilities/local-tool-families";

export const LOCAL_TOOLS_PLUGIN_ID = "natalia-local-tools";
export const LOCAL_TOOLS_RELOAD_SERVICE = "localTools.reload";

export function createLocalToolsPlugin(input: {
  roots: string[];
  enabled?: Record<string, boolean>;
  trust?: LocalToolFamilyOptions["trust"];
  onError?: (id: string, error: unknown) => void;
  /** Called when a watched family entry changes on disk; the host decides what
   * a change means (trusted → reload, untrusted → report). */
  onChange?: (familyID: string, entryPath: string) => void;
}): Plugin {
  const familyDisposers = new Map<string, () => void>();
  let closeWatcher: (() => Promise<void>) | undefined;

  return {
    manifest: {
      apiVersion: 2,
      id: LOCAL_TOOLS_PLUGIN_ID,
      version: "1.0.0",
      name: "Local Tools",
      description: "Out-of-tree tool families discovered in configured paths.",
      entry: "natalia:local-tools",
      scope: "workspace",
      provides: [LOCAL_TOOLS_RELOAD_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["tools", "services"],
    },
    async setup(api) {
      const registerFamily = (family: ToolFamily) => {
        const disposers = family.tools.map((tool) => api.tools.register(tool));
        familyDisposers.set(family.id, () => {
          for (const dispose of disposers) dispose();
        });
      };
      const loaded = await loadLocalToolFamilies({
        roots: input.roots,
        enabled: input.enabled,
        trust: input.trust,
        onError: input.onError,
      });
      for (const family of loaded) registerFamily(family);

      api.services.provide(
        LOCAL_TOOLS_RELOAD_SERVICE,
        async (familyID: string): Promise<ToolFamily> => {
          const family = await reloadLocalToolFamily({
            roots: input.roots,
            familyID,
            enabled: input.enabled,
            trust: input.trust,
            onError: input.onError,
          });
          familyDisposers.get(familyID)?.();
          familyDisposers.delete(familyID);
          registerFamily(family);
          return family;
        },
      );

      if (input.roots.length)
        closeWatcher = await watchLocalToolFamilies({
          roots: input.roots,
          onChange: (familyID, entryPath) =>
            input.onChange?.(familyID, entryPath),
        });
    },
    dispose() {
      familyDisposers.clear();
      const watcher = closeWatcher;
      closeWatcher = undefined;
      void watcher?.();
    },
  };
}
