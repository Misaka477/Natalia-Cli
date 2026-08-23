export { checkpointDisplayLine } from "./checkpoint-display";
export {
  parseBashCommandRule,
  parseBashSimpleCommand,
  type BashCommandParseResult,
  type BashCommandRule,
} from "@natalia/tools";
export { compactionDisplayLine } from "./compaction-display";
export {
  installExampleDocuments,
  type ExampleDocumentInstallResult,
} from "./example-documents";
export {
  workflowDocumentCatalog,
  type WorkflowDocumentChoice,
} from "@natalia/workflow";
export { createFakeBackend } from "./fixture";
export { createRealRuntimeClient, EGRESS_ADVISORY } from "./runtime/main";
export type { RuntimeServiceClient } from "@natalia/runtime-services";
export {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type TaskWorkflowService,
} from "@natalia/runtime-services";
export {
  classifyPermissionFamily,
  PERMISSION_FAMILIES,
  type PermissionFamily,
} from "@natalia/contracts";
export {
  flowOverview,
  scheduledTaskOverview,
  type FlowOverview,
  type FlowRow,
  type FlowStageRow,
  type ScheduledTaskOverview,
  type ScheduledTaskRow,
} from "@natalia/workflow";
export {
  deleteFlowDocument,
  loadFlowDocument,
  manualFlowTask,
  newFlowID,
  saveFlowDocument,
} from "@natalia/workflow";
export {
  decomposeFlowConditions,
  defaultExecutionProviderID,
  flowConditionModels,
  parseFlowConditionDecomposition,
  type FlowConditionModel,
} from "./flow-condition-decomposition";
export {
  runTask,
  runTaskFromDocument,
  taskPermissionPreviewForDocument,
  type TaskRunResult,
} from "./task-controller";
export {
  newHeadlessExecution,
  plainRuntimeEvent,
  taskPermissionPreview,
  taskRetryMaxAttempts,
  type HeadlessExecution,
} from "@natalia/workflow";
export { assertConfigApplied } from "@natalia/config";
export { assertTaskReferences } from "@natalia/workflow";
export {
  effectiveFlowPermissions,
  effectiveModulePermissions,
  type EffectiveFlowPermissions,
  type EffectiveModulePermissions,
} from "@natalia/workflow";
export {
  configWithoutPermissionProfile,
  grantablePermissionTools,
  parseToolAllowList,
  permissionProfileRemovalProblem,
  permissionProfileUsage,
  type PermissionProfileUsage,
  type ToolAllowListEdit,
} from "./permission-profile";
export {
  deleteTaskDocument,
  configureTaskSystemd,
  loadTaskDocument,
  newScheduledTaskID,
  removeTaskSystemd,
  saveTaskDocument,
} from "@natalia/workflow";
export {
  generateTaskUnits,
  installUserTaskUnits,
  nextSystemdRun,
  previewSystemdCalendar,
  removeUserTaskUnits,
  runSystemctl,
  systemInstallCommands,
  systemRemoveCommands,
  type GeneratedTaskUnits,
  type SystemdCommandResult,
  type SystemdCalendarPreview,
  type SystemdCommandRunner,
  writeGeneratedTaskUnits,
} from "@natalia/workflow";
export type { RealRuntimeClientOptions } from "./runtime/options";
export {
  workflowContributionsProjection,
  type WorkflowContributionsProjection,
} from "@natalia/workflow";
export type {
  WorkflowExecutionEvent,
  WorkflowExecutionHandle,
  WorkflowExecutionStatus,
} from "@natalia/workflow";
export {
  CapabilityExecutionHost,
  type CapabilityTaskExecutionRequest,
} from "./capability-execution-host";
export { CapabilityHost } from "@natalia/capability";
export {
  builtinToolFamilies,
  migratedBuiltinToolFamilies,
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
  WORKER_CONTROL_METHODS,
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
