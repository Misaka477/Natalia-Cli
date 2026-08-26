import type { CapabilityHost, CapabilityRegistry } from "@natalia/capability";
import type { EpisodeID, SessionID } from "@natalia/contracts";
import type {
  TerminalControllerInput,
  ToolHooks,
  ToolPolicy,
} from "@natalia/runtime-services";
import type { StreamingProvider } from "@natalia/runtime";
import type { ToolRegistry } from "@natalia/tools";
import type { TaskModuleContext } from "@natalia/workflow";

export type RealRuntimeClientOptions = {
  sessionID?: SessionID;
  episodeID?: EpisodeID;
  title?: string;
  workspaceRoot?: string;
  /** Natalia instance plugin store. Hosts resolve this once; workspaces never own it. */
  pluginStoreRoot?: string;
  /** Override the user-level config path, primarily for isolated hosts/tests. */
  globalConfigPath?: string;
  sessionDir?: string;
  useSqliteStore?: boolean;
  provider?: StreamingProvider;
  tools?: ToolRegistry;
  permissionProfile?: string;
  permissionMode?: "ask" | "auto" | "read_only";
  toolPolicy?: ToolPolicy;
  hooks?: ToolHooks;
  nativeTerminal?: TerminalControllerInput["external"];
  taskModuleContext?: TaskModuleContext;
  /** Host-owned registry shared with task delivery and other capability consumers. */
  capabilityRegistry?: CapabilityRegistry;
  /** Preferred host-owned capability lifetime; survives runtime config reloads. */
  capabilityHost?: CapabilityHost;
};
