export {
  createLocalToolsPlugin,
  LOCAL_TOOLS_PLUGIN_ID,
  LOCAL_TOOLS_PLUGIN_MANIFEST,
} from "./local-tools-plugin";
export {
  discoverLocalToolFamilies,
  loadLocalToolFamilies,
  reloadLocalToolFamily,
  TOOL_FAMILY_MANIFEST,
  watchLocalToolFamilies,
  type LocalToolFamilyManifest,
  type LocalToolFamilyOptions,
} from "./local-tool-families";
import type { Plugin, PluginAPI } from "@natalia/plugin";
import {
  createLocalToolsPlugin,
  LOCAL_TOOLS_PLUGIN_MANIFEST,
} from "./local-tools-plugin";
import type { LocalToolFamilyOptions } from "./local-tool-families";

export const LOCAL_TOOLS_INPUT_SERVICE = "localTools.input";
export type LocalToolsRuntimeInput = {
  roots: string[];
  trust?: LocalToolFamilyOptions["trust"];
  onError?: (id: string, error: unknown) => void;
  onChange?: (familyID: string, entryPath: string) => void;
};

export default function localToolsPlugin(): Plugin {
  let instance: Plugin | undefined;
  return {
    manifest: {
      ...LOCAL_TOOLS_PLUGIN_MANIFEST,
      entry: "index.js",
      requires: [LOCAL_TOOLS_INPUT_SERVICE],
    },
    async setup(api: PluginAPI) {
      const input = api.services.get<LocalToolsRuntimeInput>(
        LOCAL_TOOLS_INPUT_SERVICE,
      );
      if (!input)
        throw new Error(
          `missing runtime service: ${LOCAL_TOOLS_INPUT_SERVICE}`,
        );
      instance = createLocalToolsPlugin(input);
      await instance.setup(api);
    },
    async dispose() {
      await instance?.dispose?.();
      instance = undefined;
    },
  };
}
