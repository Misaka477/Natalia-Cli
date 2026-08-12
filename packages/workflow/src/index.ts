/**
 * `@natalia/workflow` is the durable task/flow fact layer, not a script
 * executor. The former standalone `WorkflowRuntime` / `JsonlWorkflowStore`
 * engine (and its `workflow_run` / `workflow_status` / `workflow_events` tool
 * surface) was removed: the real execution path is the task controller plus
 * `real-runtime`, so every tool call already passes through the canonical
 * policy/approval/audit pipeline. Reintroducing a second executor would
 * reintroduce the direct `spawn` back door it carried.
 */
export {
  parseNataliaDocumentJSON,
  parseNataliaDocumentYAML,
  validateNataliaDocument,
  type NataliaDocument,
} from "./natalia-documents";
export {
  NataliaDocumentStore,
  type ContributedNataliaDocuments,
} from "./natalia-document-store";
export {
  buildRedactedEvaluatorContext,
  evaluateAndRecordModule,
  parseEvaluatorResult,
  type EvaluatorConsent,
  type EvaluatorExecutionResult,
  type EvaluatorModuleContext,
  type EvaluatorSelection,
  type RedactedEvaluatorModuleContext,
} from "./natalia-evaluator";
export {
  isKnownModuleTool,
  knownModuleTools,
  moduleToolPolicy,
  type NataliaFlowModuleType,
  type NataliaModuleToolPolicy,
} from "./natalia-module-policy";
export {
  NataliaTaskStateStore,
  type NataliaTaskAttempt,
  type NataliaTaskAttemptStatus,
  type NataliaTaskInvocation,
  type NataliaTaskInvocationStatus,
  type NataliaFlowModuleClaim,
  type NataliaFlowModuleEvent,
  type NataliaFlowModuleEventKind,
  type NataliaFlowModuleStatus,
  type NataliaPlannedFlowModule,
  type StartTaskInvocationResult,
} from "./natalia-task-state-store";
export {
  NataliaTaskAlertQueue,
  TASK_ALERT_EVENT_KINDS,
  channelsForTaskAlertEvent,
  taskAlertEventKindForStatus,
  taskAlertSubscriptions,
  taskAlertID,
  type EnqueueTaskAlertResult,
  type NataliaTaskAlert,
  type NataliaTaskAlertDelivery,
  type NataliaTaskAlertDeliveryState,
  type NataliaTaskAlertEventKind,
  type NataliaTaskAlertSubscription,
  type TaskAlertPruneResult,
  type TaskAlertQueuePressure,
} from "./natalia-task-alert-queue";
export {
  NataliaUnattendedStateStore,
  type NataliaFingerprintRecord,
  type NataliaSuppressedFingerprint,
  type NataliaUnattendedState,
  type NataliaWatermark,
  type NataliaWatermarkKind,
} from "./natalia-unattended-state";
export {
  createIssueTarget,
  fingerprintFromBody,
  fingerprintMarker,
  findingFingerprint,
  issueBodyWithFingerprint,
  reconcileFinding,
  type NataliaIssueFinding,
  type NataliaIssueReconciliation,
  type NataliaIssueTarget,
  type NataliaIssueTargetConfig,
  type NataliaIssueTargetKind,
  type NataliaRemoteIssue,
} from "./natalia-issue-target";
export {
  deliverPendingTaskAlerts,
  type NataliaAlertChannel,
  type TaskAlertDeliveryOutcome,
} from "./natalia-task-alert-delivery";
export {
  readDataSourceSince,
  type NataliaDataSource,
  type NataliaDataSourceKind,
  type NataliaDataSourceRead,
} from "./natalia-data-source";
