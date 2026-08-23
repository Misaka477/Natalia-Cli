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

const builtinToolPluginIDs: ReadonlySet<string> = new Set([
  ASK_PLUGIN_ID,
  TODO_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  WEB_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  AGENT_PLUGIN_ID,
  TERMINAL_PLUGIN_ID,
  SANDBOX_PLUGIN_ID,
  PROCESS_PLUGIN_ID,
  PDF_PLUGIN_ID,
  LOCAL_TOOLS_PLUGIN_ID,
  TEAM_PLUGIN_ID,
]);

const staticBuiltinPluginIDs: ReadonlySet<string> = new Set([
  TASK_MODULE_PLUGIN_ID,
  RUNTIME_CONFIG_PLUGIN_ID,
  SUBAGENTS_PLUGIN_ID,
  ATTACHMENT_PLUGIN_ID,
  SESSION_STORE_PLUGIN_ID,
  TOOL_PIPELINE_PLUGIN_ID,
  COLLABORATION_PLUGIN_ID,
  RETRY_PLUGIN_ID,
  CONTEXT_LEDGER_PLUGIN_ID,
  RUNTIME_UI_PLUGIN_ID,
  TASK_WORKFLOW_PLUGIN_ID,
  WORK_LEDGER_PLUGIN_ID,
  GOVERNANCE_LEDGER_PLUGIN_ID,
  TURN_ORCHESTRATION_PLUGIN_ID,
]);

export function isBuiltinToolPlugin(id: string): boolean {
  return builtinToolPluginIDs.has(id);
}

/** Whether a built-in's settings participate in the static catalog fingerprint. */
export function isStaticBuiltinPlugin(id: string): boolean {
  return staticBuiltinPluginIDs.has(id);
}

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
  extensionEnabled(name: "skills" | "mcp" | "plugins"): boolean;
}): BuiltinFeatureGates {
  const { config, hasCustomTools, extensionEnabled } = input;
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
    pdfEnabled: extensionEnabled("plugins") && plugin(PDF_PLUGIN_ID),
  };
}

export type BuiltinPluginEntry = {
  id: string;
  enabled: boolean;
  /** Stable owner-defined identity for desired-state reconciliation. */
  fingerprint: string;
  create(): Plugin;
};

type BuiltinPluginDefinition = Omit<BuiltinPluginEntry, "fingerprint">;

function describeBuiltin(
  definition: BuiltinPluginDefinition,
  identity: unknown = definition.enabled,
): BuiltinPluginEntry {
  return {
    ...definition,
    fingerprint: stableFingerprint(identity),
  };
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(normalizeIdentity(value));
}

function normalizeIdentity(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "function") return "[function]";
  if (Array.isArray(value)) return value.map(normalizeIdentity);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeIdentity(child)]),
    );
  return value;
}

export type BuiltinPluginCatalogInput = {
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
      skill: SkillMetadata,
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
    external?: TerminalControllerPluginInput["external"];
    identity?: unknown;
  };
  /** Sandbox controller. */
  sandbox?: {
    workspaceRoot: string;
    backend?(): SandboxBackend | undefined;
    identity?: unknown;
  };
  /** MCP controller. */
  mcp?: {
    servers(): Record<string, MCPServerConfig>;
    workspaceRoot: string;
    enabled(): boolean;
    publish(event: RuntimeEvent): void;
    identity?: unknown;
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
    waiter: InteractiveWaiterDeps;
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
  compaction?: { enabled: boolean };
  runtimeUi?: {
    enabled: boolean;
    controller: RuntimeUiPluginInput;
  };
};

export function builtinPluginCatalog(
  input: BuiltinPluginCatalogInput,
): BuiltinPluginEntry[] {
  return [
    ...builtinToolPluginCatalog(input).map((entry) => describeBuiltin(entry)),
    skillsPluginEntry(input.skills),
    describeBuiltin(builtinPdfPluginEntry(input.pdfEnabled)),
    ...(input.taskModule
      ? [
          describeBuiltin(
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
          describeBuiltin(
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
          describeBuiltin(
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
          describeBuiltin(
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
          describeBuiltin(
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
            input.sessionStore,
          ),
        ]
      : []),
    teamPluginEntry(input.team?.enabled === true),
    ...(input.toolPipeline
      ? [
          describeBuiltin(
            {
              id: TOOL_PIPELINE_PLUGIN_ID,
              enabled: input.toolPipeline.enabled,
              create: () => createToolPipelinePlugin(),
            },
            input.toolPipeline,
          ),
        ]
      : []),
    ...(input.collaboration
      ? [
          describeBuiltin(
            {
              id: COLLABORATION_PLUGIN_ID,
              enabled: true,
              create: () =>
                createCollaborationPlugin({
                  waiter: input.collaboration!.waiter,
                }),
            },
            input.collaboration,
          ),
        ]
      : []),
    ...(input.retry
      ? [
          describeBuiltin(
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
          describeBuiltin(
            {
              id: CONTEXT_LEDGER_PLUGIN_ID,
              enabled: input.contextLedger.enabled,
              create: () => createContextLedgerPlugin(),
            },
            input.contextLedger,
          ),
        ]
      : []),
    compactionPluginEntry(input.compaction),
    ...(input.runtimeUi
      ? [
          describeBuiltin(
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
          describeBuiltin(
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
          describeBuiltin(
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
          describeBuiltin(
            {
              id: GOVERNANCE_LEDGER_PLUGIN_ID,
              enabled: input.governanceLedger.enabled,
              create: () => createGovernanceLedgerPlugin(),
            },
            input.governanceLedger,
          ),
        ]
      : []),
    ...(input.turnOrchestration
      ? [
          describeBuiltin(
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

export function localToolsPluginEntry(
  input: Parameters<typeof builtinPluginCatalog>[0]["localTools"],
): BuiltinPluginEntry {
  return describeBuiltin(
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
  input: Parameters<typeof builtinPluginCatalog>[0]["workspace"],
): BuiltinPluginEntry {
  return describeBuiltin(
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
  input: Parameters<typeof builtinPluginCatalog>[0]["providerModel"],
): BuiltinPluginEntry {
  return describeBuiltin(
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
  input: Parameters<typeof builtinPluginCatalog>[0]["compaction"],
): BuiltinPluginEntry {
  return describeBuiltin(
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

export function skillsPluginEntry(
  input: Parameters<typeof builtinPluginCatalog>[0]["skills"],
): BuiltinPluginEntry {
  return describeBuiltin(
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
  input: Parameters<typeof builtinPluginCatalog>[0]["checkpoint"],
): BuiltinPluginEntry {
  return describeBuiltin(
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
  input: Parameters<typeof builtinPluginCatalog>[0]["sandbox"],
): BuiltinPluginEntry {
  return describeBuiltin(
    {
      id: SANDBOX_CONTROLLER_PLUGIN_ID,
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
  input: Parameters<typeof builtinPluginCatalog>[0]["terminal"],
): BuiltinPluginEntry {
  return describeBuiltin(
    {
      id: TERMINAL_CONTROLLER_PLUGIN_ID,
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

export function mcpPluginEntry(
  input: Parameters<typeof builtinPluginCatalog>[0]["mcp"],
): BuiltinPluginEntry {
  return describeBuiltin(
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

export function teamPluginEntry(enabled: boolean): BuiltinPluginEntry {
  return describeBuiltin(
    {
      id: TEAM_PLUGIN_ID,
      enabled,
      create: () => createTeamPlugin(),
    },
    enabled,
  );
}
