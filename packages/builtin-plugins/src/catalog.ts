import {
  builtinPdfPluginEntry,
  builtinToolPluginCatalog,
} from "@natalia/builtin-tool-plugins";
import {
  createAttachmentPlugin,
  ATTACHMENT_PLUGIN_ID,
} from "@natalia/attachment-plugin";
import {
  createCollaborationPlugin,
  COLLABORATION_PLUGIN_ID,
} from "@natalia/collaboration-plugin";
import {
  createContextLedgerPlugin,
  CONTEXT_LEDGER_PLUGIN_ID,
} from "@natalia/context-ledger-plugin";
import {
  createGovernanceLedgerPlugin,
  GOVERNANCE_LEDGER_PLUGIN_ID,
} from "@natalia/governance-ledger-plugin";
import { createRetryPlugin, RETRY_PLUGIN_ID } from "@natalia/retry-plugin";
import {
  createRuntimeConfigPlugin,
  RUNTIME_CONFIG_PLUGIN_ID,
} from "@natalia/runtime-config-plugin";
import {
  createRuntimeUiPlugin,
  RUNTIME_UI_PLUGIN_ID,
} from "@natalia/runtime-ui-plugin";
import {
  createSessionStoreControllerPlugin,
  SESSION_STORE_PLUGIN_ID,
} from "@natalia/session-store-plugin";
import {
  createSubagentsControllerPlugin,
  SUBAGENTS_PLUGIN_ID,
} from "@natalia/subagents-plugin";
import {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_ID,
} from "@natalia/task-module-plugin";
import {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_PLUGIN_ID,
} from "@natalia/task-workflow-plugin";
import {
  createToolPipelinePlugin,
  TOOL_PIPELINE_PLUGIN_ID,
} from "@natalia/tool-pipeline-plugin";
import {
  createTurnOrchestrationPlugin,
  TURN_ORCHESTRATION_PLUGIN_ID,
} from "@natalia/turn-orchestration-plugin";
import {
  createWorkLedgerPlugin,
  WORK_LEDGER_PLUGIN_ID,
} from "@natalia/work-ledger-plugin";
import type { BuiltinPluginCatalogInput } from "./catalog-input";
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
import { describeDefault, type DefaultPluginEntry } from "./default-entry";

export function builtinPluginCatalog(
  input: BuiltinPluginCatalogInput,
): DefaultPluginEntry[] {
  return [
    ...builtinToolPluginCatalog(input).map((entry) => describeDefault(entry)),
    skillsPluginEntry(input.skills),
    describeDefault(builtinPdfPluginEntry(input.pdfEnabled)),
    ...(input.taskModule
      ? [
          describeDefault(
            {
              id: TASK_MODULE_PLUGIN_ID,
              enabled: true,
              create: () => createTaskModulePlugin(input.taskModule!),
            },
            input.taskModule,
          ),
        ]
      : []),
    ...(input.runtimeConfig
      ? [
          describeDefault(
            {
              id: RUNTIME_CONFIG_PLUGIN_ID,
              enabled: true,
              create: () => createRuntimeConfigPlugin(input.runtimeConfig!),
            },
            input.runtimeConfig,
          ),
        ]
      : []),
    localToolsPluginEntry(input.localTools),
    workspacePluginEntry(input.workspace),
    terminalPluginEntry(input.terminal),
    sandboxPluginEntry(input.sandbox),
    mcpPluginEntry(input.mcp),
    checkpointPluginEntry(input.checkpoint),
    ...(input.subagents
      ? [
          describeDefault(
            {
              id: SUBAGENTS_PLUGIN_ID,
              enabled: true,
              create: () =>
                createSubagentsControllerPlugin({
                  workDir: input.subagents!.workDir,
                  sessionID: input.subagents!.sessionID,
                }),
            },
            input.subagents,
          ),
        ]
      : []),
    ...(input.attachment
      ? [
          describeDefault(
            {
              id: ATTACHMENT_PLUGIN_ID,
              enabled: input.attachment.enabled,
              create: () => createAttachmentPlugin(input.attachment!),
            },
            input.attachment,
          ),
        ]
      : []),
    ...(input.sessionStore
      ? [
          describeDefault(
            {
              id: SESSION_STORE_PLUGIN_ID,
              enabled: true,
              create: () =>
                createSessionStoreControllerPlugin(input.sessionStore!),
            },
            input.sessionStore,
          ),
        ]
      : []),
    teamPluginEntry(input.team?.enabled === true),
    ...(input.toolPipeline
      ? [
          describeDefault(
            {
              id: TOOL_PIPELINE_PLUGIN_ID,
              enabled: input.toolPipeline.enabled,
              create: createToolPipelinePlugin,
            },
            input.toolPipeline,
          ),
        ]
      : []),
    ...(input.collaboration
      ? [
          describeDefault(
            {
              id: COLLABORATION_PLUGIN_ID,
              enabled: true,
              create: () => createCollaborationPlugin(input.collaboration!),
            },
            input.collaboration,
          ),
        ]
      : []),
    ...(input.retry
      ? [
          describeDefault(
            {
              id: RETRY_PLUGIN_ID,
              enabled: input.retry.enabled,
              create: () => createRetryPlugin({ policy: input.retry!.policy }),
            },
            input.retry,
          ),
        ]
      : []),
    ...(input.contextLedger
      ? [
          describeDefault(
            {
              id: CONTEXT_LEDGER_PLUGIN_ID,
              enabled: input.contextLedger.enabled,
              create: createContextLedgerPlugin,
            },
            input.contextLedger,
          ),
        ]
      : []),
    compactionPluginEntry(input.compaction),
    ...(input.runtimeUi
      ? [
          describeDefault(
            {
              id: RUNTIME_UI_PLUGIN_ID,
              enabled: input.runtimeUi.enabled,
              create: () => createRuntimeUiPlugin(input.runtimeUi!.controller),
            },
            input.runtimeUi,
          ),
        ]
      : []),
    providerModelPluginEntry(input.providerModel),
    ...(input.taskWorkflow
      ? [
          describeDefault(
            {
              id: TASK_WORKFLOW_PLUGIN_ID,
              enabled: input.taskWorkflow.enabled,
              create: () =>
                createTaskWorkflowPlugin(input.taskWorkflow!.controller),
            },
            input.taskWorkflow,
          ),
        ]
      : []),
    ...(input.workLedger
      ? [
          describeDefault(
            {
              id: WORK_LEDGER_PLUGIN_ID,
              enabled: input.workLedger.enabled,
              create: () =>
                createWorkLedgerPlugin(input.workLedger!.controller),
            },
            input.workLedger,
          ),
        ]
      : []),
    ...(input.governanceLedger
      ? [
          describeDefault(
            {
              id: GOVERNANCE_LEDGER_PLUGIN_ID,
              enabled: input.governanceLedger.enabled,
              create: createGovernanceLedgerPlugin,
            },
            input.governanceLedger,
          ),
        ]
      : []),
    ...(input.turnOrchestration
      ? [
          describeDefault(
            {
              id: TURN_ORCHESTRATION_PLUGIN_ID,
              enabled: input.turnOrchestration.enabled,
              create: () =>
                createTurnOrchestrationPlugin(
                  input.turnOrchestration!.controller,
                ),
            },
            input.turnOrchestration,
          ),
        ]
      : []),
  ];
}
