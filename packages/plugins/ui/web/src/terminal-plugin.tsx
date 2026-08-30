import { defineUiPlugin, type UiPlugin } from "@natalia/ui-host";

export const TERMINAL_PLUGIN_ID = "natalia.ui.terminal";

/**
 * Optional terminal UI plugin. The main shell only shows the terminal tab when
 * this plugin is loaded/enabled, mirroring the file editor panel behavior.
 */
export function createTerminalPlugin(): UiPlugin {
  return defineUiPlugin({
    id: TERMINAL_PLUGIN_ID,
    name: "Terminal",
    version: "1.0.0",
    description: "Interactive terminal panel shared by humans and the model.",
    panels: [
      {
        id: "terminal",
        title: "终端",
        region: "side",
      },
    ],
    mount() {
      // The main shell renders TerminalPane itself when the plugin is present.
      return undefined;
    },
  });
}

export default createTerminalPlugin;
