import {
  assertConfigApplied,
  assertTaskReferences,
  configureTaskSystemd,
  scheduledTaskOverview,
  type ScheduledTaskOverview,
  createRealRuntimeClient,
  EGRESS_ADVISORY,
  newHeadlessExecution,
  plainRuntimeEvent,
  manualFlowTask,
  runTask,
  runTaskFromDocument,
  CapabilityExecutionHost,
  CapabilityHost,
  removeTaskSystemd,
  taskPermissionPreview,
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type RuntimeServiceClient,
  type TaskWorkflowService,
} from "@natalia/client";
import {
  createWorkflowExecutionStoreService,
  createWorkflowStoreService,
} from "@natalia/task-workflow-plugin";
import { createWorkflowSchedulerPluginHost } from "@natalia/workflow-scheduler-plugin";
import type {
  EpisodeID,
  EvaluatorResult,
  NataliaFlowDocument,
  NataliaTaskDocument,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import { resolveConfig } from "@natalia/config";
import { agentsFromConfig } from "@natalia/agent";
import { userStateHome } from "@natalia/platform";
import {
  createIssueTarget,
  deliverPendingTaskAlerts,
  evaluateAndRecordModule,
  findingFingerprint,
  readDataSourceSince,
  reconcileFinding,
  taskAlertEventKindForStatus,
  type EvaluatorModuleContext,
  type NataliaTaskAttemptStatus,
  type NataliaPlannedFlowModule,
  type NataliaTaskInvocation,
} from "@natalia/workflow";
import { providerForModel } from "@natalia/runtime";
import { createRecordedFetch, readCassette } from "@natalia/transport";
import {
  createRuntimeDaemonStore,
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
} from "@natalia/transport/host";
import {
  createHttpTransportPluginHost,
  TRANSPORT_PLUGIN_ID,
} from "./transport-plugin";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  deleteLocalSession,
  duplicateLocalSession,
  exportLocalSessionMetadata,
  importLocalSessionMetadata,
  doctorReport,
  listLocalSessions,
  plainStatus,
  renameLocalSession,
  setLocalSessionPinned,
  sessionTable,
  promptArguments,
  toolFamilyCatalogue,
  trustList,
  trustRemove,
  workspaceFilesystemCommand,
  showLocalSession,
  startupDiagnostics,
  localWorkGraph,
  workGraphLines,
} from "./index";
import { daemonDir } from "./command-helpers";
export function taskListLines(overview: ScheduledTaskOverview) {
  if (!overview.tasks.length && !overview.unreadable.length)
    return ["no task documents under .natalia/tasks"];
  const lines: string[] = [];
  for (const task of overview.tasks) {
    lines.push(
      `${task.problems.length ? "!" : " "} ${task.taskID}  ${task.displayName}`,
      `    schedule: ${task.schedule}  profile: ${task.permissionProfile}  retry: ${task.retry}`,
      `    flow ${task.flowID}: ${task.enabledModules} enabled stages`,
      `    last run: ${
        task.lastRun
          ? `${task.lastRun.status} at ${task.lastRun.startedAt}${task.lastRun.skipReason ? ` (${task.lastRun.skipReason})` : ""}`
          : "never"
      }`,
    );
    if (task.consecutiveFailures)
      lines.push(`    consecutive failures: ${task.consecutiveFailures}`);
    if (task.pendingAlertDeliveries)
      lines.push(
        `    pending alert deliveries: ${task.pendingAlertDeliveries}`,
      );
    if (task.systemd)
      lines.push(
        `    timer: ${task.systemd.timerUnit ?? "not generated"} (${task.systemd.scope})`,
        `    next run: ${task.systemd.nextRun ?? "not active"}`,
      );
    for (const problem of task.problems) lines.push(`    problem: ${problem}`);
  }
  for (const broken of overview.unreadable)
    lines.push(`! ${broken.path}: ${broken.reason}`);
  return lines;
}

export function taskPreviewLines(
  preview: ReturnType<typeof taskPermissionPreview>,
) {
  const lines = [
    `task ${preview.taskID} under profile ${preview.permissionProfile}`,
    `flow ${preview.flowID}`,
  ];
  for (const module of preview.modules) {
    lines.push(
      `  ${module.enabled ? "" : "(disabled) "}${module.moduleID} [${module.moduleType}] ${module.displayName}`,
      `    tools: ${module.tools.allowed.join(", ") || "none"}`,
    );
    if (module.tools.denied.length)
      lines.push(`    denied: ${module.tools.denied.join(", ")}`);
    if (module.commandRules.profile)
      lines.push(
        `    profile commands (${module.commandRules.profile.mode}): ${module.commandRules.profile.commands.join(", ") || "none"}`,
      );
    if (module.commandRules.module)
      lines.push(
        `    module commands (${module.commandRules.module.mode}): ${module.commandRules.module.commands.join(", ") || "none"}`,
      );
    if (
      module.interactivePrograms === "any" ||
      module.interactivePrograms.length
    )
      lines.push(
        `    interactive programs: ${
          module.interactivePrograms === "any"
            ? "any"
            : module.interactivePrograms.join(", ")
        }`,
      );
    if (module.blocked) lines.push(`    BLOCKED: ${module.blocked}`);
  }
  if (preview.blocked.length)
    lines.push(
      `blocked stages: ${preview.blocked.map((entry) => entry.moduleID).join(", ")}`,
    );
  return lines;
}

/**
 * Read-only history for one task. It opens the durable stores, reports what
 * actually happened, and never creates an invocation, episode, session,
 * approval or alert.
 */
export async function taskStatusReport(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
}) {
  const stores = createWorkflowExecutionStoreService(input.workspaceRoot);
  const state = await stores.openTaskState();
  const alerts = await stores.openAlertQueue();
  const crossExecution = await stores.openUnattendedState(input.task.taskID);
  try {
    const invocations = state.invocations(input.task.taskID);
    const persisted = crossExecution.state();
    return {
      taskID: input.task.taskID,
      displayName: input.task.displayName,
      schedule: input.task.schedule,
      permissionProfile: input.task.permissionProfile,
      flowID: input.flow.flowID,
      enabledModules: input.flow.modules.filter((module) => module.enabled)
        .length,
      retry: input.task.retry,
      alertChannels: input.task.alerts,
      issueTarget: input.task.issueTarget,
      dataSource: input.task.dataSource,
      waterline: state.getWaterline(input.task.taskID),
      invocations: invocations.map((invocation) => ({
        ...invocation,
        attempts: state.attempts(invocation.invocationID).map((attempt) => ({
          attempt: attempt.attempt,
          status: attempt.status,
          episodeID: attempt.episodeID,
          sessionID: attempt.sessionID,
          reason: attempt.reason,
        })),
      })),
      crossExecutionState: {
        path: crossExecution.path,
        consecutiveFailures: persisted.consecutiveFailures,
        watermarks: Object.values(persisted.watermarks),
        fingerprints: Object.keys(persisted.fingerprints).length,
        suppressed: Object.keys(persisted.suppressed).length,
        lastResult: persisted.lastResult,
      },
      alerts: {
        queue: alerts.queuePressure(),
        entries: alerts.alerts(input.task.taskID).map((alert) => ({
          ...alert,
          deliveries: alerts.deliveries(alert.alertID).map((delivery) => ({
            channel: delivery.channel,
            state: delivery.state,
            attempts: delivery.attempts,
            lastError: delivery.lastError,
          })),
        })),
      },
    };
  } finally {
    alerts.close();
    state.close();
  }
}

export function taskStatusLines(
  report: Awaited<ReturnType<typeof taskStatusReport>>,
) {
  const lines = [
    `task ${report.taskID}: ${report.displayName}`,
    `schedule: ${report.schedule}`,
    `flow ${report.flowID}: ${report.enabledModules} enabled modules`,
    `profile: ${report.permissionProfile} (retry ${report.retry})`,
    `waterline: ${report.waterline ? `${report.waterline.invocationID} at ${report.waterline.advancedAt}` : "not advanced"}`,
    `consecutive failures: ${report.crossExecutionState.consecutiveFailures}`,
    `watermarks: ${report.crossExecutionState.watermarks.length}, fingerprints: ${report.crossExecutionState.fingerprints}, suppressed: ${report.crossExecutionState.suppressed}`,
    `alerts: ${report.alerts.entries.length} (${report.alerts.queue.pending} pending deliveries)`,
  ];
  for (const invocation of report.invocations)
    lines.push(
      `  ${invocation.startedAt} ${invocation.invocationID} ${invocation.status}${invocation.skipReason ? ` (${invocation.skipReason})` : ""} attempts=${invocation.attempts.length}`,
    );
  return lines;
}
/** Submits a task to the resident executor and mirrors its outcome. */
export async function submitTaskToDaemon(input: {
  taskPath: string;
  workspaceRoot: string;
  json: boolean;
}) {
  const store = createRuntimeDaemonStore({ dir: daemonDir() });
  const status = await runtimeDaemonStatus(store);
  if (status.state !== "running")
    throw new Error(
      `task submit requires a running Natalia daemon (${status.state})`,
    );
  const token = await daemonToken(store);
  const response = await fetch(
    new URL("/tasks/run", status.registration.url).href,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        taskPath: input.taskPath,
        workspaceRoot: input.workspaceRoot,
        json: input.json,
      }),
    },
  );
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      `task delivery failed: ${String(payload.error ?? response.status)}`,
    );
  for (const line of (payload.output as string[] | undefined) ?? [])
    console.log(line);
  return payload as unknown as { exitCode: number };
}
