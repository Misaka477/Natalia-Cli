import { ATTACHMENT_PLUGIN_MANIFEST } from "@natalia/attachment-plugin";
import { CHECKPOINT_PLUGIN_MANIFEST } from "@natalia/checkpoint-plugin";
import { COLLABORATION_PLUGIN_MANIFEST } from "@natalia/collaboration-plugin";
import { COMPACTION_PLUGIN_MANIFEST } from "@natalia/compaction-plugin";
import { CONTEXT_LEDGER_PLUGIN_MANIFEST } from "@natalia/context-ledger-plugin";
import { GOVERNANCE_LEDGER_PLUGIN_MANIFEST } from "@natalia/governance-ledger-plugin";
import { LOCAL_TOOLS_PLUGIN_MANIFEST } from "@natalia/local-tools-plugin";
import { MCP_PLUGIN_MANIFEST } from "@natalia/mcp-plugin";
import { PROVIDER_MODEL_PLUGIN_MANIFEST } from "@natalia/provider-model-plugin";
import { RETRY_PLUGIN_MANIFEST } from "@natalia/retry-plugin";
import { RUNTIME_CONFIG_PLUGIN_MANIFEST } from "@natalia/runtime-config-plugin";
import { RUNTIME_UI_PLUGIN_MANIFEST } from "@natalia/runtime-ui-plugin";
import { SANDBOX_PLUGIN_MANIFEST } from "@natalia/sandbox-plugin";
import { SESSION_STORE_PLUGIN_MANIFEST } from "@natalia/session-store-plugin";
import { SKILLS_PLUGIN_MANIFEST } from "@natalia/skills-plugin";
import { SUBAGENTS_PLUGIN_MANIFEST } from "@natalia/subagents-plugin";
import { TASK_MODULE_PLUGIN_MANIFEST } from "@natalia/task-module-plugin";
import { TASK_WORKFLOW_PLUGIN_MANIFEST } from "@natalia/task-workflow-plugin";
import { TEAM_PLUGIN_MANIFEST } from "@natalia/team-plugin";
import { TERMINAL_PLUGIN_MANIFEST } from "@natalia/terminal-plugin";
import { TOOL_PIPELINE_PLUGIN_MANIFEST } from "@natalia/tool-pipeline-plugin";
import { TURN_ORCHESTRATION_PLUGIN_MANIFEST } from "@natalia/turn-orchestration-plugin";
import { WORK_LEDGER_PLUGIN_MANIFEST } from "@natalia/work-ledger-plugin";
import { WORKSPACE_PLUGIN_MANIFEST } from "@natalia/workspace-plugin";
import type { PluginManifest } from "@natalia/plugin";

const productPluginManifests = [
  ATTACHMENT_PLUGIN_MANIFEST,
  CHECKPOINT_PLUGIN_MANIFEST,
  COLLABORATION_PLUGIN_MANIFEST,
  COMPACTION_PLUGIN_MANIFEST,
  CONTEXT_LEDGER_PLUGIN_MANIFEST,
  GOVERNANCE_LEDGER_PLUGIN_MANIFEST,
  LOCAL_TOOLS_PLUGIN_MANIFEST,
  MCP_PLUGIN_MANIFEST,
  PROVIDER_MODEL_PLUGIN_MANIFEST,
  RETRY_PLUGIN_MANIFEST,
  RUNTIME_CONFIG_PLUGIN_MANIFEST,
  RUNTIME_UI_PLUGIN_MANIFEST,
  SANDBOX_PLUGIN_MANIFEST,
  SESSION_STORE_PLUGIN_MANIFEST,
  SKILLS_PLUGIN_MANIFEST,
  SUBAGENTS_PLUGIN_MANIFEST,
  TASK_MODULE_PLUGIN_MANIFEST,
  TASK_WORKFLOW_PLUGIN_MANIFEST,
  TEAM_PLUGIN_MANIFEST,
  TERMINAL_PLUGIN_MANIFEST,
  TOOL_PIPELINE_PLUGIN_MANIFEST,
  TURN_ORCHESTRATION_PLUGIN_MANIFEST,
  WORK_LEDGER_PLUGIN_MANIFEST,
  WORKSPACE_PLUGIN_MANIFEST,
] as const;

export const PRODUCT_PLUGIN_MANIFESTS: Readonly<
  Record<string, PluginManifest>
> = Object.fromEntries(
  productPluginManifests.map((manifest) => [manifest.id, manifest]),
);
