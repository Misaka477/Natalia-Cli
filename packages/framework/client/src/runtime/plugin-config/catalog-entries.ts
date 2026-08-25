import {
  createLocalToolsPlugin,
  LOCAL_TOOLS_PLUGIN_ID,
} from "@natalia/plugin-local-tools";
import { createMcpPlugin, MCP_PLUGIN_ID } from "@natalia/plugin-mcp";
import { createSkillsPlugin, SKILLS_PLUGIN_ID } from "@natalia/plugin-skills";
import { createTeamPlugin, TEAM_PLUGIN_ID } from "@natalia/plugin-team";
import type { RuntimePluginCatalogInput } from "./catalog-input";
import type { DesiredPluginEntry } from "@natalia/plugin";
import { describePlugin } from "./desired-entry";

type Input = RuntimePluginCatalogInput;

export function localToolsPluginEntry(
  input: Input["localTools"],
): DesiredPluginEntry {
  return describePlugin(
    {
      id: LOCAL_TOOLS_PLUGIN_ID,
      enabled: input !== undefined,
      create: () => {
        if (!input) throw new Error("local tools plugin is disabled");
        return createLocalToolsPlugin(input);
      },
    },
    input,
  );
}

export function skillsPluginEntry(input: Input["skills"]): DesiredPluginEntry {
  return describePlugin(
    {
      id: SKILLS_PLUGIN_ID,
      enabled: input !== undefined,
      create: () => {
        if (!input) throw new Error("skills plugin is disabled");
        return createSkillsPlugin(input);
      },
    },
    input,
  );
}

export function mcpPluginEntry(input: Input["mcp"]): DesiredPluginEntry {
  return describePlugin(
    {
      id: MCP_PLUGIN_ID,
      enabled: input !== undefined,
      create: () => {
        if (!input) throw new Error("MCP plugin is disabled");
        const { identity: _identity, ...pluginInput } = input;
        return createMcpPlugin(pluginInput);
      },
    },
    input,
  );
}

export function teamPluginEntry(enabled: boolean): DesiredPluginEntry {
  return describePlugin(
    { id: TEAM_PLUGIN_ID, enabled, create: () => createTeamPlugin() },
    enabled,
  );
}
