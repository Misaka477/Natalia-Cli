import { createPdfPlugin, PDF_PLUGIN_ID } from "@natalia/tool-pdf";
import { ASK_PLUGIN_ID, createAskPlugin } from "@natalia/tool-ask";
import { createTodoPlugin, TODO_PLUGIN_ID } from "@natalia/tool-todo";
import { createSearchPlugin, SEARCH_PLUGIN_ID } from "@natalia/tool-search";
import { createFsReadPlugin, FS_READ_PLUGIN_ID } from "@natalia/tool-fs-read";
import {
  createFsWritePlugin,
  FS_WRITE_PLUGIN_ID,
} from "@natalia/tool-fs-write";
import { createWebPlugin, WEB_PLUGIN_ID } from "@natalia/tool-web";
import { createShellPlugin, SHELL_PLUGIN_ID } from "@natalia/tool-shell";
import { createAgentPlugin, AGENT_PLUGIN_ID } from "@natalia/tool-agent";
import {
  createTerminalPlugin,
  TERMINAL_PLUGIN_ID,
} from "@natalia/tool-terminal";
import { createSandboxPlugin, SANDBOX_PLUGIN_ID } from "@natalia/tool-sandbox";
import { createProcessPlugin, PROCESS_PLUGIN_ID } from "@natalia/tool-process";
import type { Plugin } from "@natalia/plugin";
import type { Skill } from "@natalia/skills";
import type { ToolExecutionContext, ToolRegistry } from "@natalia/tools";
import type {
  ConfigV3,
  MCPServerConfig,
  RuntimeEvent,
} from "@natalia/contracts";
import type { SandboxBackend } from "@natalia/contracts";
import type { NativeTerminalRegistry } from "@natalia/native-terminal";
import type { TaskModuleContext } from "../capabilities/task-module-tools";
import {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_ID,
} from "./task-module-plugin";
import {
  createRuntimeConfigPlugin,
  RUNTIME_CONFIG_PLUGIN_ID,
} from "./runtime-config-plugin";
import {
  createLocalToolsPlugin,
  LOCAL_TOOLS_PLUGIN_ID,
} from "./local-tools-plugin";
import { createWorkspacePlugin, WORKSPACE_PLUGIN_ID } from "./workspace-plugin";
import {
  createTerminalControllerPlugin,
  TERMINAL_PLUGIN_ID as TERMINAL_CONTROLLER_PLUGIN_ID,
} from "./terminal-controller-plugin";
import {
  createSandboxControllerPlugin,
  SANDBOX_PLUGIN_ID as SANDBOX_CONTROLLER_PLUGIN_ID,
} from "./sandbox-controller-plugin";
import {
  createMcpControllerPlugin,
  MCP_PLUGIN_ID,
} from "./mcp-controller-plugin";
import {
  createCheckpointControllerPlugin,
  CHECKPOINT_PLUGIN_ID,
} from "./checkpoint-controller-plugin";
import {
  createSubagentsControllerPlugin,
  SUBAGENTS_PLUGIN_ID,
} from "./subagents-controller-plugin";
import {
  createSessionStoreControllerPlugin,
  SESSION_STORE_PLUGIN_ID,
} from "./session-store-controller-plugin";
import { createTeamPlugin, TEAM_PLUGIN_ID } from "./team-plugin";
import {
  createToolPipelinePlugin,
  TOOL_PIPELINE_PLUGIN_ID,
} from "./tool-pipeline-plugin";
import {
  createCollaborationPlugin,
  COLLABORATION_PLUGIN_ID,
} from "./collaboration-plugin";
import {
  createProviderModelPlugin,
  PROVIDER_MODEL_PLUGIN_ID,
} from "./provider-model-plugin";
import type { ProviderModelControllerInput } from "../provider-model-controller";
import {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_PLUGIN_ID,
} from "./task-workflow-plugin";
import type { createTaskWorkflowController } from "../task-workflow-controller";
import {
  CONTEXT_LEDGER_PLUGIN_ID,
  createContextLedgerPlugin,
} from "./context-ledger-plugin";
import {
  createWorkLedgerPlugin,
  WORK_LEDGER_PLUGIN_ID,
} from "./work-ledger-plugin";
import type { createWorkLedgerController } from "../work-ledger-controller";
import {
  createGovernanceLedgerPlugin,
  GOVERNANCE_LEDGER_PLUGIN_ID,
} from "./governance-ledger-plugin";
import {
  createTurnOrchestrationPlugin,
  TURN_ORCHESTRATION_PLUGIN_ID,
} from "./turn-orchestration-plugin";
import type { TurnControllerInput } from "../turn-controller";
import { createRetryPlugin, RETRY_PLUGIN_ID } from "./retry-plugin";
import type { RetryRunnerOptions } from "@natalia/runtime";
import {
  ATTACHMENT_PLUGIN_ID,
  createAttachmentPlugin,
} from "./attachment-plugin";
import {
  createSkillsPlugin,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
} from "./skills-plugin";

export {
  AGENT_PLUGIN_ID,
  ASK_PLUGIN_ID,
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  PDF_PLUGIN_ID,
  PROCESS_PLUGIN_ID,
  SANDBOX_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
  TERMINAL_PLUGIN_ID,
  TODO_PLUGIN_ID,
  WEB_PLUGIN_ID,
};

export type BuiltinPluginEntry = {
  id: string;
  enabled: boolean;
  create(): Plugin;
};

export function builtinPluginCatalog(input: {
  agentEnabled: boolean;
  askEnabled: boolean;
  fsReadEnabled: boolean;
  fsWriteEnabled: boolean;
  pdfEnabled: boolean;
  processEnabled: boolean;
  sandboxEnabled: boolean;
  searchEnabled: boolean;
  shellEnabled: boolean;
  terminalEnabled: boolean;
  todoEnabled: boolean;
  webEnabled: boolean;
  skills?: {
    workspaceRoot: string;
    userRoot?: string;
    remoteURLs?: string[];
    onLoad?: (
      skill: Skill,
      output: string,
      context: ToolExecutionContext,
    ) => void;
  };
  /** Present only when the host runs inside a flow-module execution. */
  taskModule?: TaskModuleContext;
  /** The resolved runtime config, provided as the `runtime.config` service. */
  runtimeConfig?: ConfigV3;
  /** Out-of-tree tool families from configured `tools.paths`. */
  localTools?: {
    roots: string[];
    enabled?: Record<string, boolean>;
    trust?: {
      workspaceRoot: string;
      verify: (
        key: string,
        entryPath: string,
      ) => Promise<{ verified: boolean; expected?: string; actual?: string }>;
    };
    onError?: (id: string, error: unknown) => void;
    onChange?: (familyID: string, entryPath: string) => void;
  };
  /** Workspace observation, write lock and mutation attribution. */
  workspace?: {
    workspaceRoot: string;
    listPaths: () => Promise<string[]>;
  };
  /** Native terminal panes controller. */
  terminal?: {
    workspaceRoot: string;
    publish(event: RuntimeEvent): void;
    onPerformance(name: string, durationMs: number): void;
    runtimeID(): string;
    userRuntimeHome(): string | undefined;
    windowMode(): "auto" | "windowless" | "window";
    external?: NativeTerminalRegistry;
  };
  /** Sandbox controller. */
  sandbox?: {
    workspaceRoot: string;
    backend?(): SandboxBackend | undefined;
  };
  /** MCP controller. */
  mcp?: {
    servers(): Record<string, MCPServerConfig>;
    workspaceRoot: string;
    tools: ToolRegistry;
    enabled(): boolean;
    publish(event: RuntimeEvent): void;
  };
  /** Checkpoint controller factory. */
  checkpoint?: { workspaceRoot: string };
  /** Subagents controller. */
  subagents?: { workDir: string; sessionID?: () => string | undefined };
  /** Session store controller. */
  sessionStore?: {
    workspaceRoot: string;
    sessionID(): import("@natalia/contracts").SessionID;
    sessionDir?: string;
    useSqliteStore?: boolean;
    title?: string;
  };
  /** Team fan-out tools, gated on the host's extension switch. */
  team?: { enabled: boolean };
  /** The tool policy funnel (always on). */
  toolPipeline?: { enabled: boolean };
  /** The interactive approval/question waiter. */
  collaboration?: {
    waiter: import("../interactive-waiter").InteractiveWaiterDeps;
  };
  /** Provider selection, main agent loop and Live Work Chat lifecycle. */
  providerModel?: {
    enabled: boolean;
    controller: ProviderModelControllerInput;
  };
  taskWorkflow?: {
    enabled: boolean;
    controller: Parameters<typeof createTaskWorkflowController>[0];
  };
  contextLedger?: { enabled: boolean };
  workLedger?: {
    enabled: boolean;
    controller: Parameters<typeof createWorkLedgerController>[0];
  };
  governanceLedger?: { enabled: boolean };
  turnOrchestration?: {
    enabled: boolean;
    controller: TurnControllerInput;
  };
  retry?: {
    enabled: boolean;
    policy(): RetryRunnerOptions["policy"];
  };
  attachment?: { enabled: boolean; workspaceRoot: string };
}): BuiltinPluginEntry[] {
  return [
    {
      id: ASK_PLUGIN_ID,
      enabled: input.askEnabled,
      create: () => createAskPlugin(),
    },
    {
      id: TODO_PLUGIN_ID,
      enabled: input.todoEnabled,
      create: () => createTodoPlugin(),
    },
    {
      id: SEARCH_PLUGIN_ID,
      enabled: input.searchEnabled,
      create: () => createSearchPlugin(),
    },
    {
      id: FS_READ_PLUGIN_ID,
      enabled: input.fsReadEnabled,
      create: () => createFsReadPlugin(),
    },
    {
      id: FS_WRITE_PLUGIN_ID,
      enabled: input.fsWriteEnabled,
      create: () => createFsWritePlugin(),
    },
    {
      id: WEB_PLUGIN_ID,
      enabled: input.webEnabled,
      create: () => createWebPlugin(),
    },
    {
      id: SHELL_PLUGIN_ID,
      enabled: input.shellEnabled,
      create: () => createShellPlugin(),
    },
    {
      id: AGENT_PLUGIN_ID,
      enabled: input.agentEnabled,
      create: () => createAgentPlugin(),
    },
    {
      id: TERMINAL_PLUGIN_ID,
      enabled: input.terminalEnabled,
      create: () => createTerminalPlugin(),
    },
    {
      id: SANDBOX_PLUGIN_ID,
      enabled: input.sandboxEnabled,
      create: () => createSandboxPlugin(),
    },
    {
      id: PROCESS_PLUGIN_ID,
      enabled: input.processEnabled,
      create: () => createProcessPlugin(),
    },
    {
      id: SKILLS_PLUGIN_ID,
      enabled: input.skills !== undefined,
      create: () => {
        if (!input.skills) throw new Error("skills plugin is disabled");
        return createSkillsPlugin(input.skills);
      },
    },
    {
      id: PDF_PLUGIN_ID,
      enabled: input.pdfEnabled,
      create: () => createPdfPlugin(),
    },
    ...(input.taskModule
      ? [
          {
            id: TASK_MODULE_PLUGIN_ID,
            enabled: true,
            create: () => createTaskModulePlugin(input.taskModule!),
          },
        ]
      : []),
    ...(input.runtimeConfig
      ? [
          {
            id: RUNTIME_CONFIG_PLUGIN_ID,
            enabled: true,
            create: () => createRuntimeConfigPlugin(input.runtimeConfig!),
          },
        ]
      : []),
    ...(input.localTools
      ? [
          {
            id: LOCAL_TOOLS_PLUGIN_ID,
            enabled: true,
            create: () =>
              createLocalToolsPlugin({
                roots: input.localTools!.roots,
                enabled: input.localTools!.enabled,
                trust: input.localTools!.trust,
                onError: input.localTools!.onError,
                onChange: input.localTools!.onChange,
              }),
          },
        ]
      : []),
    ...(input.workspace
      ? [
          {
            id: WORKSPACE_PLUGIN_ID,
            enabled: true,
            create: () =>
              createWorkspacePlugin({
                workspaceRoot: input.workspace!.workspaceRoot,
                listPaths: input.workspace!.listPaths,
              }),
          },
        ]
      : []),
    ...(input.terminal
      ? [
          {
            id: TERMINAL_CONTROLLER_PLUGIN_ID,
            enabled: true,
            create: () => createTerminalControllerPlugin(input.terminal!),
          },
        ]
      : []),
    ...(input.sandbox
      ? [
          {
            id: SANDBOX_CONTROLLER_PLUGIN_ID,
            enabled: true,
            create: () => createSandboxControllerPlugin(input.sandbox!),
          },
        ]
      : []),
    ...(input.mcp
      ? [
          {
            id: MCP_PLUGIN_ID,
            enabled: true,
            create: () => createMcpControllerPlugin(input.mcp!),
          },
        ]
      : []),
    ...(input.checkpoint
      ? [
          {
            id: CHECKPOINT_PLUGIN_ID,
            enabled: true,
            create: () =>
              createCheckpointControllerPlugin({
                workspaceRoot: input.checkpoint!.workspaceRoot,
              }),
          },
        ]
      : []),
    ...(input.subagents
      ? [
          {
            id: SUBAGENTS_PLUGIN_ID,
            enabled: true,
            create: () =>
              createSubagentsControllerPlugin({
                workDir: input.subagents!.workDir,
                sessionID: input.subagents!.sessionID,
              }),
          },
        ]
      : []),
    ...(input.attachment
      ? [
          {
            id: ATTACHMENT_PLUGIN_ID,
            enabled: input.attachment.enabled,
            create: () => createAttachmentPlugin(input.attachment!),
          },
        ]
      : []),
    ...(input.sessionStore
      ? [
          {
            id: SESSION_STORE_PLUGIN_ID,
            enabled: true,
            create: () =>
              createSessionStoreControllerPlugin({
                workspaceRoot: input.sessionStore!.workspaceRoot,
                sessionID: input.sessionStore!.sessionID,
                sessionDir: input.sessionStore!.sessionDir,
                useSqliteStore: input.sessionStore!.useSqliteStore,
                title: input.sessionStore!.title,
              }),
          },
        ]
      : []),
    ...(input.team
      ? [
          {
            id: TEAM_PLUGIN_ID,
            enabled: input.team.enabled,
            create: () => createTeamPlugin({ enabled: input.team!.enabled }),
          },
        ]
      : []),
    ...(input.toolPipeline
      ? [
          {
            id: TOOL_PIPELINE_PLUGIN_ID,
            enabled: input.toolPipeline.enabled,
            create: () => createToolPipelinePlugin(),
          },
        ]
      : []),
    ...(input.collaboration
      ? [
          {
            id: COLLABORATION_PLUGIN_ID,
            enabled: true,
            create: () =>
              createCollaborationPlugin({
                waiter: input.collaboration!.waiter,
              }),
          },
        ]
      : []),
    ...(input.retry
      ? [
          {
            id: RETRY_PLUGIN_ID,
            enabled: input.retry.enabled,
            create: () => createRetryPlugin({ policy: input.retry!.policy }),
          },
        ]
      : []),
    ...(input.providerModel
      ? [
          {
            id: PROVIDER_MODEL_PLUGIN_ID,
            enabled: input.providerModel.enabled,
            create: () =>
              createProviderModelPlugin(input.providerModel!.controller),
          },
        ]
      : []),
    ...(input.taskWorkflow
      ? [
          {
            id: TASK_WORKFLOW_PLUGIN_ID,
            enabled: input.taskWorkflow.enabled,
            create: () =>
              createTaskWorkflowPlugin(input.taskWorkflow!.controller),
          },
        ]
      : []),
    ...(input.contextLedger
      ? [
          {
            id: CONTEXT_LEDGER_PLUGIN_ID,
            enabled: input.contextLedger.enabled,
            create: () => createContextLedgerPlugin(),
          },
        ]
      : []),
    ...(input.workLedger
      ? [
          {
            id: WORK_LEDGER_PLUGIN_ID,
            enabled: input.workLedger.enabled,
            create: () => createWorkLedgerPlugin(input.workLedger!.controller),
          },
        ]
      : []),
    ...(input.governanceLedger
      ? [
          {
            id: GOVERNANCE_LEDGER_PLUGIN_ID,
            enabled: input.governanceLedger.enabled,
            create: () => createGovernanceLedgerPlugin(),
          },
        ]
      : []),
    ...(input.turnOrchestration
      ? [
          {
            id: TURN_ORCHESTRATION_PLUGIN_ID,
            enabled: input.turnOrchestration.enabled,
            create: () =>
              createTurnOrchestrationPlugin(
                input.turnOrchestration!.controller,
              ),
          },
        ]
      : []),
  ];
}
