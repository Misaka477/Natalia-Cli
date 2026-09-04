import type { UiPlugin } from "@natalia/ui-host";
import { createFileEditorPlugin } from "@natalia/plugin-file-editor";
import { createTerminalPlugin } from "@natalia/plugin-web-ui";

export type UiPluginRegistryEntry = {
  id: string;
  name: string;
  version: string;
  create: () => UiPlugin;
};

export const UI_PLUGIN_REGISTRY: UiPluginRegistryEntry[] = [
  {
    id: "natalia.ui.file-editor",
    name: "File Editor",
    version: "1.0.0",
    create: createFileEditorPlugin,
  },
  {
    id: "natalia.ui.terminal",
    name: "Terminal",
    version: "1.0.0",
    create: createTerminalPlugin,
  },
];
