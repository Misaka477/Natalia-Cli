import { render } from "solid-js/web";
import { defineUiPlugin, type UiPlugin } from "@natalia/ui-host";
import { McpSettings } from "./extension-settings";
import { SkillsSettings } from "./skills-settings";

export function createMcpSettingsUiPlugin(): UiPlugin {
  return defineUiPlugin({
    id: "natalia.ui.mcp-settings",
    name: "MCP Settings UI",
    version: "1.0.0",
    description: "MCP server management for the settings panel.",
    panels: [
      {
        id: "mcp-settings",
        title: "MCP",
        region: "settings",
        group: "扩展",
        mount(ctx, container) {
          container.replaceChildren();
          const dispose = render(
            () => (
              <McpSettings
                runtime={ctx.runtime}
                projection={ctx.projection}
              />
            ),
            container,
          );
          return () => dispose();
        },
      },
    ],
    mount() {
      return undefined;
    },
  });
}

export function createSkillsSettingsUiPlugin(): UiPlugin {
  return defineUiPlugin({
    id: "natalia.ui.skills-settings",
    name: "Skills Settings UI",
    version: "1.0.0",
    description: "Skill management for the settings panel.",
    panels: [
      {
        id: "skills-settings",
        title: "Skills",
        region: "settings",
        group: "扩展",
        mount(ctx, container) {
          container.replaceChildren();
          const dispose = render(
            () => (
              <SkillsSettings
                runtime={ctx.runtime}
                events={ctx.events}
              />
            ),
            container,
          );
          return () => dispose();
        },
      },
    ],
    mount() {
      return undefined;
    },
  });
}
