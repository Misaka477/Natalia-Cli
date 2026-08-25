import type { MCPServerConfig, RuntimeEvent } from "@natalia/contracts";
import type {
  ProviderModelControllerInput,
  SkillMetadata,
  TerminalControllerInput,
} from "@natalia/runtime-services";
import type { ToolExecutionContext } from "@natalia/tools";
import type { createTaskWorkflowController } from "@natalia/plugin-task-workflow";
import type { TaskModuleContext } from "@natalia/workflow";

export type RuntimePluginCatalogInput = {
  askEnabled: boolean;
  fsReadEnabled: boolean;
  fsWriteEnabled: boolean;
  pdfEnabled: boolean;
  processEnabled: boolean;
  searchEnabled: boolean;
  shellEnabled: boolean;
  terminalEnabled: boolean;
  todoEnabled: boolean;
  webEnabled: boolean;
  terminal?: TerminalControllerInput;
  skills?: {
    workspaceRoot: string;
    userRoot?: string;
    remoteURLs?: string[];
    onLoad?: (
      skill: SkillMetadata,
      output: string,
      context: ToolExecutionContext,
    ) => void;
    commandSession?: Parameters<
      typeof import("@natalia/plugin-skills").createSkillsPlugin
    >[0]["commandSession"];
  };
  taskModule?: TaskModuleContext;
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
  mcp?: {
    servers(): Record<string, MCPServerConfig>;
    workspaceRoot: string;
    enabled(): boolean;
    publish(event: RuntimeEvent): void;
    identity?: unknown;
  };
  team?: { enabled: boolean };
  taskWorkflow?: {
    enabled: boolean;
    controller: Parameters<typeof createTaskWorkflowController>[0];
  };
};
