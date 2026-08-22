export { checkpointDisplayLine } from "./checkpoint-display";
export {
  parseBashCommandRule,
  parseBashSimpleCommand,
  type BashCommandParseResult,
  type BashCommandRule,
} from "./bash-command-policy";
export { compactionDisplayLine } from "./compaction-display";
export {
  installExampleDocuments,
  type ExampleDocumentInstallResult,
} from "./example-documents";
export {
  workflowDocumentCatalog,
  type WorkflowDocumentChoice,
} from "./workflow-document-catalog";
export { createFakeBackend } from "./fixture";
export { createRealRuntimeClient, EGRESS_ADVISORY } from "./real-runtime";
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
} from "./task-overview";
export {
  deleteFlowDocument,
  loadFlowDocument,
  manualFlowTask,
  newFlowID,
  saveFlowDocument,
} from "@natalia/task-workflow-plugin";
export {
  decomposeFlowConditions,
  defaultExecutionProviderID,
  flowConditionModels,
  parseFlowConditionDecomposition,
  type FlowConditionModel,
} from "./flow-condition-decomposition";
export {
  newHeadlessExecution,
  plainRuntimeEvent,
  runTask,
  runTaskFromDocument,
  taskPermissionPreview,
  taskPermissionPreviewForDocument,
  taskRetryMaxAttempts,
  type HeadlessExecution,
  type TaskRunResult,
} from "./task-controller";
export {
  assertConfigApplied,
  assertTaskReferences,
} from "@natalia/task-workflow-plugin";
export {
  effectiveFlowPermissions,
  effectiveModulePermissions,
  type EffectiveFlowPermissions,
  type EffectiveModulePermissions,
} from "./effective-policy";
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
} from "@natalia/task-workflow-plugin";
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
} from "@natalia/task-workflow-plugin";
export type { RealRuntimeClientOptions } from "./real-runtime";
export {
  workflowContributionsProjection,
  type WorkflowContributionsProjection,
} from "@natalia/task-workflow-plugin";
export {
  WorkflowExecutionRefusal,
  WorkflowExecutionScheduler,
  type WorkflowExecutionEvent,
  type WorkflowExecutionHandle,
  type WorkflowExecutionStatus,
  createWorkflowSchedulerPluginHost,
  WORKFLOW_SCHEDULER_PLUGIN_ID,
  WORKFLOW_SCHEDULER_SERVICE,
} from "@natalia/workflow-scheduler-plugin";
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
export {
  reviewPRs,
  runFanOut,
  validateOwnershipMap,
  type FanOutPR,
  type FanOutTask,
  type PRReviewDecision,
  type PRReviewOutcome,
} from "./fan-out";
export { providerErrorHint, retryDisplayLine } from "./retry-display";
export {
  findWorkspaceFiles,
  globWorkspaceFiles,
  invalidateWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  watchWorkspaceFiles,
} from "@natalia/workspace-plugin";
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
