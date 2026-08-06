export { checkpointDisplayLine } from "./checkpoint-display";
export {
  parseBashCommandRule,
  parseBashSimpleCommand,
  type BashCommandParseResult,
  type BashCommandRule,
} from "./bash-command-policy";
export { compactionDisplayLine } from "./compaction-display";
export { createFakeBackend } from "./fixture";
export { createRealRuntimeClient, EGRESS_ADVISORY } from "./real-runtime";
export {
  flowOverview,
  scheduledTaskOverview,
  type FlowOverview,
  type FlowRow,
  type FlowStageRow,
  type ScheduledTaskOverview,
  type ScheduledTaskRow,
} from "./task-overview";
export {
  assertConfigApplied,
  assertTaskReferences,
  newHeadlessExecution,
  plainRuntimeEvent,
  runTask,
  taskPermissionPreview,
  taskRetryMaxAttempts,
  type HeadlessExecution,
  type TaskRunResult,
} from "./task-controller";
export {
  effectiveFlowPermissions,
  effectiveModulePermissions,
  type EffectiveFlowPermissions,
  type EffectiveModulePermissions,
} from "./effective-policy";
export {
  loadTaskDocument,
  newScheduledTaskID,
  saveTaskDocument,
} from "./task-document";
export type { RealRuntimeClientOptions } from "./real-runtime";
export { providerErrorHint, retryDisplayLine } from "./retry-display";
export {
  cleanupUnreferencedAttachments,
  referencedAttachmentsForSessions,
} from "./attachments";
export {
  findWorkspaceFiles,
  globWorkspaceFiles,
  invalidateWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  watchWorkspaceFiles,
} from "./workspace-files";
export {
  attachRuntimeClientWorker,
  createWorkerRuntimeClient,
  type RuntimeWorkerPort,
} from "./worker";
export {
  createToolPolicyHookLayer,
  type ToolPolicy,
  type ToolPolicyHookLayer,
  type ToolHooks,
  type ToolHookEvent,
  type ToolHookResult,
} from "./tool-policy";
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
