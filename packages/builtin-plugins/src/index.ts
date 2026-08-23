import {
  AGENT_PLUGIN_ID,
  ASK_PLUGIN_ID,
  builtinPdfPluginEntry,
  builtinToolPluginCatalog,
  FS_WRITE_PLUGIN_ID,
  FS_READ_PLUGIN_ID,
  PDF_PLUGIN_ID,
  PROCESS_PLUGIN_ID,
  SANDBOX_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  TERMINAL_PLUGIN_ID,
  TODO_PLUGIN_ID,
  WEB_PLUGIN_ID,
} from "@natalia/builtin-tool-plugins";
import type { Plugin } from "@natalia/plugin";
import type {
  ProviderModelControllerInput,
  SkillMetadata,
} from "@natalia/runtime-services";
import type { ToolExecutionContext } from "@natalia/tools";
import type {
  ConfigV3,
  MCPServerConfig,
  RuntimeEvent,
} from "@natalia/contracts";
import type { SandboxBackend } from "@natalia/contracts";
import {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_ID,
} from "@natalia/task-module-plugin";
import type { TaskModuleContext } from "@natalia/workflow";
import {
  createRuntimeConfigPlugin,
  RUNTIME_CONFIG_PLUGIN_ID,
} from "@natalia/runtime-config-plugin";
import {
  createLocalToolsPlugin,
  LOCAL_TOOLS_PLUGIN_ID,
} from "@natalia/local-tools-plugin";
import {
  createWorkspacePlugin,
  WORKSPACE_PLUGIN_ID,
} from "@natalia/workspace-plugin";
import {
  createTerminalControllerPlugin,
  TERMINAL_PLUGIN_ID as TERMINAL_CONTROLLER_PLUGIN_ID,
  type TerminalControllerPluginInput,
} from "@natalia/terminal-plugin";
import {
  createSandboxControllerPlugin,
  SANDBOX_PLUGIN_ID as SANDBOX_CONTROLLER_PLUGIN_ID,
} from "@natalia/sandbox-plugin";
import { createMcpPlugin, MCP_PLUGIN_ID } from "@natalia/mcp-plugin";
import {
  createCheckpointControllerPlugin,
  CHECKPOINT_PLUGIN_ID,
} from "@natalia/checkpoint-plugin";
import {
  createSubagentsControllerPlugin,
  SUBAGENTS_PLUGIN_ID,
} from "@natalia/subagents-plugin";
import {
  createSessionStoreControllerPlugin,
  SESSION_STORE_PLUGIN_ID,
} from "@natalia/session-store-plugin";
import { createTeamPlugin, TEAM_PLUGIN_ID } from "@natalia/team-plugin";
import {
  createToolPipelinePlugin,
  TOOL_PIPELINE_PLUGIN_ID,
} from "@natalia/tool-pipeline-plugin";
import {
  createCollaborationPlugin,
  COLLABORATION_PLUGIN_ID,
} from "@natalia/collaboration-plugin";
import {
  createProviderModelPlugin,
  PROVIDER_MODEL_PLUGIN_ID,
} from "@natalia/provider-model-plugin";
import {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_PLUGIN_ID,
  type createTaskWorkflowController,
} from "@natalia/task-workflow-plugin";
import {
  CONTEXT_LEDGER_PLUGIN_ID,
  createContextLedgerPlugin,
} from "@natalia/context-ledger-plugin";
import {
  createWorkLedgerController,
  createWorkLedgerPlugin,
  WORK_LEDGER_PLUGIN_ID,
} from "@natalia/work-ledger-plugin";
import {
  createGovernanceLedgerPlugin,
  GOVERNANCE_LEDGER_PLUGIN_ID,
} from "@natalia/governance-ledger-plugin";
import {
  createTurnOrchestrationPlugin,
  TURN_ORCHESTRATION_PLUGIN_ID,
} from "@natalia/turn-orchestration-plugin";
import { createRetryPlugin, RETRY_PLUGIN_ID } from "@natalia/retry-plugin";
import type { RetryRunnerOptions } from "@natalia/runtime";
import type {
  InteractiveWaiterDeps,
  TurnControllerInput,
} from "@natalia/runtime-services";
import {
  ATTACHMENT_PLUGIN_ID,
  createAttachmentPlugin,
} from "@natalia/attachment-plugin";
import {
  COMPACTION_PLUGIN_ID,
  createCompactionPlugin,
} from "@natalia/compaction-plugin";
import {
  createSkillsPlugin,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
} from "@natalia/skills-plugin";
import {
  createRuntimeUiPlugin,
  RUNTIME_UI_PLUGIN_ID,
  type RuntimeUiPluginInput,
} from "@natalia/runtime-ui-plugin";
import type { BuiltinPluginCatalogInput } from "./catalog-input";
import { describeDefault, type DefaultPluginEntry } from "./default-entry";
import {
  checkpointPluginEntry,
  compactionPluginEntry,
  localToolsPluginEntry,
  mcpPluginEntry,
  providerModelPluginEntry,
  sandboxPluginEntry,
  skillsPluginEntry,
  teamPluginEntry,
  terminalPluginEntry,
  workspacePluginEntry,
} from "./catalog-entries";

export type { BuiltinPluginCatalogInput } from "./catalog-input";
export type { DefaultPluginEntry } from "./default-entry";
export {
  checkpointPluginEntry,
  compactionPluginEntry,
  localToolsPluginEntry,
  mcpPluginEntry,
  providerModelPluginEntry,
  sandboxPluginEntry,
  skillsPluginEntry,
  teamPluginEntry,
  terminalPluginEntry,
  workspacePluginEntry,
} from "./catalog-entries";
export { builtinPluginCatalog } from "./catalog";

export {
  AGENT_PLUGIN_ID,
  ASK_PLUGIN_ID,
  ATTACHMENT_PLUGIN_ID,
  builtinPdfPluginEntry,
  builtinToolPluginCatalog,
  CHECKPOINT_PLUGIN_ID,
  COLLABORATION_PLUGIN_ID,
  COMPACTION_PLUGIN_ID,
  CONTEXT_LEDGER_PLUGIN_ID,
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  GOVERNANCE_LEDGER_PLUGIN_ID,
  LOCAL_TOOLS_PLUGIN_ID,
  PDF_PLUGIN_ID,
  PROCESS_PLUGIN_ID,
  PROVIDER_MODEL_PLUGIN_ID,
  RETRY_PLUGIN_ID,
  RUNTIME_UI_PLUGIN_ID,
  RUNTIME_CONFIG_PLUGIN_ID,
  SANDBOX_PLUGIN_ID,
  SANDBOX_CONTROLLER_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SESSION_STORE_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
  SUBAGENTS_PLUGIN_ID,
  TASK_MODULE_PLUGIN_ID,
  TASK_WORKFLOW_PLUGIN_ID,
  TEAM_PLUGIN_ID,
  TERMINAL_PLUGIN_ID,
  TERMINAL_CONTROLLER_PLUGIN_ID,
  TODO_PLUGIN_ID,
  TOOL_PIPELINE_PLUGIN_ID,
  TURN_ORCHESTRATION_PLUGIN_ID,
  WEB_PLUGIN_ID,
  WORK_LEDGER_PLUGIN_ID,
  WORKSPACE_PLUGIN_ID,
};
export { MCP_PLUGIN_ID };

export type BuiltinFeatureGates = {
  askEnabled: boolean;
  todoEnabled: boolean;
  searchEnabled: boolean;
  fsReadEnabled: boolean;
  fsWriteEnabled: boolean;
  webEnabled: boolean;
  shellEnabled: boolean;
  agentEnabled: boolean;
  terminalEnabled: boolean;
  sandboxEnabled: boolean;
  processEnabled: boolean;
  pdfEnabled: boolean;
};

export function computeBuiltinFeatureGates(input: {
  config: ConfigV3 | undefined;
  hasCustomTools: boolean;
}): BuiltinFeatureGates {
  const { config, hasCustomTools } = input;
  const builtins = !hasCustomTools;
  const tool = (name: keyof NonNullable<ConfigV3["tools"]["enabled"]>) =>
    builtins && config?.tools?.enabled?.[name] !== false;
  const plugin = (id: string) => config?.plugins?.enabled?.[id] !== false;

  return {
    askEnabled: tool("ask") && plugin(ASK_PLUGIN_ID),
    todoEnabled: tool("todo") && plugin(TODO_PLUGIN_ID),
    searchEnabled: tool("search") && plugin(SEARCH_PLUGIN_ID),
    fsReadEnabled: tool("fs") && plugin(FS_READ_PLUGIN_ID),
    fsWriteEnabled: tool("fs") && plugin(FS_WRITE_PLUGIN_ID),
    webEnabled: tool("web") && plugin(WEB_PLUGIN_ID),
    shellEnabled: tool("shell") && plugin(SHELL_PLUGIN_ID),
    agentEnabled: tool("agent") && plugin(AGENT_PLUGIN_ID),
    terminalEnabled: tool("terminal") && plugin(TERMINAL_PLUGIN_ID),
    sandboxEnabled: tool("sandbox") && plugin(SANDBOX_PLUGIN_ID),
    processEnabled: tool("process") && plugin(PROCESS_PLUGIN_ID),
    pdfEnabled: plugin(PDF_PLUGIN_ID),
  };
}
