import type {
  ConfigV3,
  MCPServerConfig,
  RuntimeEvent,
  SandboxBackend,
} from "@natalia/contracts";
import type { CollaborationPluginInput } from "@natalia/collaboration-plugin";
import type { RetryRunnerOptions } from "@natalia/runtime";
import type {
  ProviderModelControllerInput,
  SkillMetadata,
  TurnControllerInput,
} from "@natalia/runtime-services";
import type { TerminalControllerPluginInput } from "@natalia/terminal-plugin";
import type { ToolExecutionContext } from "@natalia/tools";
import type { RuntimeUiPluginInput } from "@natalia/runtime-ui-plugin";
import type { createTaskWorkflowController } from "@natalia/task-workflow-plugin";
import type { createWorkLedgerController } from "@natalia/work-ledger-plugin";
import type { TaskModuleContext } from "@natalia/workflow";

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
  taskModule?: TaskModuleContext;
  runtimeConfig?: ConfigV3;
  localTools?: {
    roots: string[];
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
  workspace?: { workspaceRoot: string; listPaths: () => Promise<string[]> };
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
  sandbox?: {
    workspaceRoot: string;
    backend?(): SandboxBackend | undefined;
    identity?: unknown;
  };
  mcp?: {
    servers(): Record<string, MCPServerConfig>;
    workspaceRoot: string;
    enabled(): boolean;
    publish(event: RuntimeEvent): void;
    identity?: unknown;
  };
  checkpoint?: { workspaceRoot: string };
  subagents?: { workDir: string; sessionID?: () => string | undefined };
  sessionStore?: {
    workspaceRoot: string;
    sessionID(): import("@natalia/contracts").SessionID;
    sessionDir?: string;
    useSqliteStore?: boolean;
    title?: string;
  };
  team?: { enabled: boolean };
  toolPipeline?: { enabled: boolean };
  collaboration?: CollaborationPluginInput;
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
  turnOrchestration?: { enabled: boolean; controller: TurnControllerInput };
  retry?: { enabled: boolean; policy(): RetryRunnerOptions["policy"] };
  attachment?: { enabled: boolean; workspaceRoot: string };
  compaction?: { enabled: boolean };
  runtimeUi?: { enabled: boolean; controller: RuntimeUiPluginInput };
};
