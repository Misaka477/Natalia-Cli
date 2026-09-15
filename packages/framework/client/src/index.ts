export { checkpointDisplayLine } from "./checkpoint-display";
export {
  parseBashCommandRule,
  parseBashSimpleCommand,
  type BashCommandParseResult,
  type BashCommandRule,
} from "@natalia/tools";
export { compactionDisplayLine } from "./compaction-display";
export { createFakeBackend } from "./fixture";
export {
  createUiAdapterHost,
  type UiAdapterHost,
  type UiAdapterHostOptions,
} from "./ui-host";
export { createRealRuntimeClient, EGRESS_ADVISORY } from "./runtime/main";
export {
  SessionWindow,
  type SessionWindowLoader,
  type SessionWindowOpenState,
  type SessionWindowOptions,
  type SessionWindowPage,
  type SessionWindowSnapshot,
} from "./runtime/session-window";
export type { RuntimeServiceClient } from "@natalia/runtime-services";
export {
  classifyPermissionFamily,
  PERMISSION_FAMILIES,
  type PermissionFamily,
} from "@natalia/contracts";
export { assertConfigApplied } from "@natalia/config";
export type { RealRuntimeClientOptions } from "./runtime/options";
export { CapabilityHost } from "@natalia/capability";
export {
  toolFamilyCapabilityID,
  type ToolFamilyLoadOutcome,
} from "./capabilities/tool-family-capabilities";
export { providerErrorHint, retryDisplayLine } from "./retry-display";
export {
  findWorkspaceFiles,
  globWorkspaceFiles,
  invalidateWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  watchWorkspaceFiles,
} from "@natalia/platform";
export {
  attachRuntimeClientWorker,
  createWorkerRuntimeClient,
  handleWorkerRequest,
  WORKER_ROUTE_MEMBERS,
  type RuntimeWorkerPort,
  type WorkerRuntimeClient,
} from "./worker";
export {
  createToolPolicyHookLayer,
  type ToolPolicy,
  type ToolPolicyHookLayer,
  type ToolHooks,
  type ToolHookEvent,
  type ToolHookResult,
} from "@natalia/tools";
export type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
export type TransportKind =
  | "local-fixture"
  | "worker"
  | "rpc"
  | "stdio"
  | "daemon";

export type RuntimeTransportDescriptor = {
  kind: TransportKind;
  description: string;
  stable: boolean;
};

export const runtimeTransports: RuntimeTransportDescriptor[] = [
  {
    kind: "local-fixture",
    description: "in-process fixture runtime for frontend smoke",
    stable: true,
  },
  {
    kind: "worker",
    description:
      "MessagePort/Worker runtime transport through RuntimeClient contracts",
    stable: true,
  },
  {
    kind: "rpc",
    description: "future local RPC runtime transport",
    stable: false,
  },
  {
    kind: "stdio",
    description: "future automation stdio transport",
    stable: false,
  },
  {
    kind: "daemon",
    description: "future long-running daemon transport",
    stable: false,
  },
];

export {
  createWorkspaceManager,
  createWorkspaceRuntimeClient,
} from "./workspace-manager";
export type {
  WorkspaceManager,
  WorkspaceRuntime,
  WorkspaceManagerOptions,
} from "./workspace-manager";
