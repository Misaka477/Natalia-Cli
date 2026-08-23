import {
  createCheckpointControllerPlugin,
  CHECKPOINT_PLUGIN_ID,
} from "@natalia/checkpoint-plugin";
import {
  COMPACTION_PLUGIN_ID,
  createCompactionPlugin,
} from "@natalia/compaction-plugin";
import {
  createLocalToolsPlugin,
  LOCAL_TOOLS_PLUGIN_ID,
} from "@natalia/local-tools-plugin";
import { createMcpPlugin, MCP_PLUGIN_ID } from "@natalia/mcp-plugin";
import {
  createProviderModelPlugin,
  PROVIDER_MODEL_PLUGIN_ID,
} from "@natalia/provider-model-plugin";
import {
  createSandboxControllerPlugin,
  SANDBOX_PLUGIN_ID,
} from "@natalia/sandbox-plugin";
import { createSkillsPlugin, SKILLS_PLUGIN_ID } from "@natalia/skills-plugin";
import { createTeamPlugin, TEAM_PLUGIN_ID } from "@natalia/team-plugin";
import {
  createTerminalControllerPlugin,
  TERMINAL_PLUGIN_ID,
} from "@natalia/terminal-plugin";
import {
  createWorkspacePlugin,
  WORKSPACE_PLUGIN_ID,
} from "@natalia/workspace-plugin";
import type { BuiltinPluginCatalogInput } from "./catalog-input";
import { describeDefault, type DefaultPluginEntry } from "./default-entry";

type Input = BuiltinPluginCatalogInput;

export function localToolsPluginEntry(
  input: Input["localTools"],
): DefaultPluginEntry {
  return describeDefault(
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

export function workspacePluginEntry(
  input: Input["workspace"],
): DefaultPluginEntry {
  return describeDefault(
    {
      id: WORKSPACE_PLUGIN_ID,
      enabled: input !== undefined,
      create: () => {
        if (!input) throw new Error("workspace plugin is disabled");
        return createWorkspacePlugin(input);
      },
    },
    input,
  );
}

export function providerModelPluginEntry(
  input: Input["providerModel"],
): DefaultPluginEntry {
  return describeDefault(
    {
      id: PROVIDER_MODEL_PLUGIN_ID,
      enabled: input?.enabled === true,
      create: () => {
        if (!input) throw new Error("provider-model plugin is disabled");
        return createProviderModelPlugin(input.controller);
      },
    },
    input,
  );
}

export function compactionPluginEntry(
  input: Input["compaction"],
): DefaultPluginEntry {
  return describeDefault(
    {
      id: COMPACTION_PLUGIN_ID,
      enabled: input?.enabled === true,
      create: () => {
        if (!input) throw new Error("compaction plugin is disabled");
        return createCompactionPlugin();
      },
    },
    input,
  );
}

export function skillsPluginEntry(input: Input["skills"]): DefaultPluginEntry {
  return describeDefault(
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

export function checkpointPluginEntry(
  input: Input["checkpoint"],
): DefaultPluginEntry {
  return describeDefault(
    {
      id: CHECKPOINT_PLUGIN_ID,
      enabled: input !== undefined,
      create: () => {
        if (!input) throw new Error("checkpoint plugin is disabled");
        return createCheckpointControllerPlugin(input);
      },
    },
    input,
  );
}

export function sandboxPluginEntry(
  input: Input["sandbox"],
): DefaultPluginEntry {
  return describeDefault(
    {
      id: SANDBOX_PLUGIN_ID,
      enabled: input !== undefined,
      create: () => {
        if (!input) throw new Error("sandbox plugin is disabled");
        const { identity: _identity, ...pluginInput } = input;
        return createSandboxControllerPlugin(pluginInput);
      },
    },
    input,
  );
}

export function terminalPluginEntry(
  input: Input["terminal"],
): DefaultPluginEntry {
  return describeDefault(
    {
      id: TERMINAL_PLUGIN_ID,
      enabled: input !== undefined,
      create: () => {
        if (!input) throw new Error("terminal plugin is disabled");
        const { identity: _identity, ...pluginInput } = input;
        return createTerminalControllerPlugin(pluginInput);
      },
    },
    input,
  );
}

export function mcpPluginEntry(input: Input["mcp"]): DefaultPluginEntry {
  return describeDefault(
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

export function teamPluginEntry(enabled: boolean): DefaultPluginEntry {
  return describeDefault(
    { id: TEAM_PLUGIN_ID, enabled, create: () => createTeamPlugin() },
    enabled,
  );
}
