import type { UiPlugin } from "@natalia/ui-host";
import { createFileEditorPlugin } from "@natalia/plugin-file-editor";

export type UiPluginRegistryEntry = {
  id: string;
  name: string;
  version: string;
  create: () => UiPlugin;
};

/**
 * Host-level UI plugins that are not contributed by an installed runtime
 * plugin package. Feature panels contributed by plugins are loaded dynamically
 * through the plugin catalog / /plugins/<id>/ui.js path.
 */
export const UI_PLUGIN_REGISTRY: UiPluginRegistryEntry[] = [
  {
    id: "natalia.ui.file-editor",
    name: "File Editor",
    version: "1.0.0",
    create: createFileEditorPlugin,
  },
];
