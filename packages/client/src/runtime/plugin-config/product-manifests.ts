import { LOCAL_TOOLS_PLUGIN_MANIFEST } from "@natalia/plugin-local-tools";
import { MCP_PLUGIN_MANIFEST } from "@natalia/plugin-mcp";
import { SKILLS_PLUGIN_MANIFEST } from "@natalia/plugin-skills";
import { TASK_MODULE_PLUGIN_MANIFEST } from "@natalia/plugin-task-module";
import { TASK_WORKFLOW_PLUGIN_MANIFEST } from "@natalia/plugin-task-workflow";
import { TEAM_PLUGIN_MANIFEST } from "@natalia/plugin-team";
import type { PluginManifest } from "@natalia/plugin";

const productPluginManifests = [
  LOCAL_TOOLS_PLUGIN_MANIFEST,
  MCP_PLUGIN_MANIFEST,
  SKILLS_PLUGIN_MANIFEST,
  TASK_MODULE_PLUGIN_MANIFEST,
  TASK_WORKFLOW_PLUGIN_MANIFEST,
  TEAM_PLUGIN_MANIFEST,
] as const;

export const PRODUCT_PLUGIN_MANIFESTS: Readonly<
  Record<string, PluginManifest>
> = Object.fromEntries(
  productPluginManifests.map((manifest) => [manifest.id, manifest]),
);
