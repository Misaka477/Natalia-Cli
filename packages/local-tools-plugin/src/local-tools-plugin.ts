import type { Plugin } from "@natalia/plugin";
import type { ToolFamily } from "@natalia/tools";
import { LOCAL_TOOLS_RELOAD_SERVICE } from "@natalia/runtime-services";
import {
  loadLocalToolFamilies,
  reloadLocalToolFamily,
  watchLocalToolFamilies,
  type LocalToolFamilyOptions,
} from "./local-tool-families";

export const LOCAL_TOOLS_PLUGIN_ID = "natalia-local-tools";

export function createLocalToolsPlugin(input: {
  roots: string[];
  trust?: LocalToolFamilyOptions["trust"];
  onError?: (id: string, error: unknown) => void;
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
        familyDisposers.get(family.id)?.();
        const disposers = family.tools.map((tool) => api.tools.register(tool));
        familyDisposers.set(family.id, () => {
          for (const dispose of disposers) dispose();
        });
      };
      const loaded = await loadLocalToolFamilies(input);
      for (const family of loaded) registerFamily(family);

      api.services.provide(
        LOCAL_TOOLS_RELOAD_SERVICE,
        async (familyID: string): Promise<ToolFamily> => {
          const family = await reloadLocalToolFamily({ ...input, familyID });
          registerFamily(family);
          return family;
        },
      );

      if (input.roots.length)
        closeWatcher = await watchLocalToolFamilies({
          ...input,
          onChange: (familyID, entryPath) =>
            input.onChange?.(familyID, entryPath),
        });
    },
    async dispose() {
      familyDisposers.clear();
      const watcher = closeWatcher;
      closeWatcher = undefined;
      await watcher?.();
    },
  };
}
