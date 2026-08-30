import { defineUiPlugin, type UiPlugin } from "@natalia/ui-host";

export const BROWSER_PLUGIN_ID = "natalia.ui.browser";

/**
 * Optional browser UI plugin. The shell only shows the browser tab when this
 * plugin is loaded/enabled, mirroring file editor and terminal plugins.
 */
export function createBrowserPlugin(): UiPlugin {
  return defineUiPlugin({
    id: BROWSER_PLUGIN_ID,
    name: "Browser",
    version: "1.0.0",
    description: "Embedded browser panel shared by human and model.",
    panels: [
      {
        id: "browser",
        title: "浏览器",
        region: "side",
      },
    ],
    mount() {
      return undefined;
    },
  });
}

export default createBrowserPlugin;
