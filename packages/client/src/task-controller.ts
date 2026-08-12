import { resolve } from "node:path";
import { agentsFromConfig } from "@natalia/agent";
import type { ResolvedConfig } from "@natalia/config";
import type { CapabilityRegistryView } from "@natalia/capability";
import type {
  ConfigV2,
  EpisodeID,
  EvaluatorResult,
  NataliaFlowDocument,
  NataliaTaskDocument,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import { providerForModel } from "@natalia/runtime";
import {
  channelsForTaskAlertEvent,
  deliverPendingTaskAlerts,
  evaluateAndRecordModule,
  createIssueTarget,
  findingFingerprint,
  reconcileFinding,
  readDataSourceSince,
  taskAlertEventKindForStatus,
  taskAlertSubscriptions,
  NataliaDocumentStore,
  type ContributedNataliaDocuments,
  NataliaTaskAlertQueue,
  NataliaTaskStateStore,
  NataliaUnattendedStateStore,
  type EvaluatorModuleContext,
  type NataliaPlannedFlowModule,
  type NataliaTaskAlertEventKind,
  type NataliaTaskAttemptStatus,
  type NataliaTaskInvocation,
  type NataliaTaskInvocationStatus,
} from "@natalia/workflow";
import { effectiveFlowPermissions } from "./effective-policy";
import { assertTaskReferences } from "./task-preflight";
import { workflowContributionsProjection } from "./workflow-contributions";
import {
  createRealRuntimeClient,
  type RealRuntimeClientOptions,
} from "./real-runtime";

/**
 * Unattended task controller.
 *
 * It owns one task invocation from start to a durable terminal state: the linear
 * module plan, each module's own runtime episode, the evaluator, the retry
 * budget, the alert queue and the cross-execution watermark. It lives here
 * rather than in the CLI so a resident executor can run exactly the same
 * controller instead of a second implementation with its own subtle differences.
 */

/**
 * An unattended task must never run under a configuration the operator believes
 * is active but the runtime silently ignored: a rejected file drops permission
 * profiles, command rules and channel credentials with it.
 */
export function assertConfigApplied(resolved: ResolvedConfig) {
  const rejected = resolved.sources.filter(
    (source) =>
      !source.applied && source.diagnostic?.startsWith("invalid_config"),
  );
  if (rejected.length)
    throw new Error(
      `configuration was rejected and is not in effect: ${rejected
        .map(
          (source) => `${source.path ?? source.scope} (${source.diagnostic})`,
        )
        .join(", ")}`,
    );
  return resolved.config;
}

/**
 * Effective permissions each stage of the task's flow would get. It is a preview
 * for the operator, not a boundary: the runtime recomputes every layer before it
 * executes anything.
 */
export function taskPermissionPreview(input: {
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  config: ConfigV2;
}) {
  const preview = effectiveFlowPermissions({
    profile: input.config.permissionProfiles[input.task.permissionProfile],
    flow: input.flow,
    taskCapabilities: {
      reportIssue: Boolean(input.task.issueTarget),
      readDataSource: Boolean(input.task.dataSource),
    },
  });
  return {
    taskID: input.task.taskID,
    permissionProfile: input.task.permissionProfile,
    ...preview,
  };
}

export async function taskPermissionPreviewForDocument(input: {
  workspaceRoot: string;
  path: string;
  config: ConfigV2;
  contributedDocuments?: ContributedNataliaDocuments;
}) {
  const documents = new NataliaDocumentStore(
    input.workspaceRoot,
    input.contributedDocuments,
  );
  const task = await documents.loadTaskDocument(input.path);
  const flow = await documents.resolveTaskFlow(task);
  return taskPermissionPreview({ task, flow, config: input.config });
}

export type TaskRunResult = {
  invocationID: string;
  status: NataliaTaskInvocationStatus;
  waterlineAdvanced: boolean;
  /** Non-zero when the outcome should fail a scheduled run. */
  exitCode: number;
};

/**
 * Resolves a task and its flow at invocation time, including capability-owned
 * virtual documents. Projecting on every call makes scope unload authoritative:
 * a document that disappeared cannot start a new invocation from a stale index.
 */
export async function runTaskFromDocument(input: {
  workspaceRoot: string;
  path?: string;
  taskID?: string;
  capabilityRegistry?: CapabilityRegistryView;
  contributedDocuments?: ContributedNataliaDocuments;
  config: ConfigV2;
  json: boolean;
  emit: (line: string) => void;
  signal?: AbortSignal;
}): Promise<TaskRunResult> {
  if (Boolean(input.path) === Boolean(input.taskID))
    throw new Error("task execution requires exactly one path or taskID");
  const projection = input.contributedDocuments
    ? { documents: input.contributedDocuments, diagnostics: [] }
    : input.capabilityRegistry
      ? workflowContributionsProjection(input.capabilityRegistry)
      : { documents: {}, diagnostics: [] };
  for (const message of projection.diagnostics)
    input.emit(
      JSON.stringify({ type: "diagnostic", level: "warning", message }),
    );
  const documents = new NataliaDocumentStore(
    input.workspaceRoot,
    projection.documents,
  );
  const task = input.taskID
    ? await documents.loadTaskByID(input.taskID)
    : await documents.loadTask(input.path!);
  const flow = await documents.resolveTaskFlow(task);
  assertTaskReferences({ task, config: input.config });
  return runTask({
    workspaceRoot: input.workspaceRoot,
    task,
    flow,
    config: input.config,
    json: input.json,
    emit: input.emit,
    signal: input.signal,
  });
}

export type ModuleCompletionOperations = {
  tools: Map<string, RuntimeEvent & { type: "tool.update" }>;
  terminals: Map<string, RuntimeEvent & { type: "terminal.update" }>;
  approvals: Set<string>;
};

export function newModuleCompletionOperations(): ModuleCompletionOperations {
  return { tools: new Map(), terminals: new Map(), approvals: new Set() };
}

export function trackModuleCompletionOperation(
  operations: ModuleCompletionOperations,
  event: RuntimeEvent,
) {
  if (event.type === "tool.update") {
    const id = event.callID ?? event.id;
    if (
      [
        "receiving_arguments",
        "queued",
        "awaiting_approval",
        "running",
      ].includes(event.status)
    )
      operations.tools.set(id, event);
    else operations.tools.delete(id);
    return;
  }
  if (event.type === "terminal.update") {
    if (["starting", "running", "awaiting_approval"].includes(event.status))
      operations.terminals.set(event.id, event);
    else operations.terminals.delete(event.id);
    return;
  }
  if (event.type === "approval.request") operations.approvals.add(event.id);
  if (event.type === "approval.response") operations.approvals.delete(event.id);
  if (event.type === "terminal.approval") {
    if (event.state === "awaiting") operations.approvals.add(event.approvalID);
    else operations.approvals.delete(event.approvalID);
  }
}

export function moduleCompletionOperationProblem(
  operations: ModuleCompletionOperations,
) {
  const pending = [
    ...[...operations.tools.entries()].map(
      ([id, event]) => `tool ${event.name} (${id}) is ${event.status}`,
    ),
    ...[...operations.terminals.entries()].map(
      ([id, event]) => `terminal ${id} is ${event.status}`,
    ),
    ...[...operations.approvals].map(
      (id) => `approval ${id} is awaiting a response`,
    ),
  ];
  return pending.length ? pending.join("; ") : undefined;
}

/**
 * Runs one task invocation to a durable terminal state.
 *
 * Output is emitted rather than printed so the same controller can serve a
 * one-shot command and a resident executor without either of them owning stdout.
 */
export async function runTask(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  config: ConfigV2;
  json: boolean;
  emit: (line: string) => void;
  signal?: AbortSignal;
}): Promise<TaskRunResult> {
  input.signal?.throwIfAborted();
  const config = input.config;
  let exitCode = 0;
  const profile = config.permissionProfiles[input.task.permissionProfile];
  if (!profile)
    throw new Error(
      `task permission profile not found: ${input.task.permissionProfile}`,
    );
  if (profile.approval !== "auto")
    throw new Error(
      `task permission profile must use auto approval: ${input.task.permissionProfile}`,
    );
  const modules = input.flow.modules.filter((entry) => entry.enabled);
  if (!modules.length)
    throw new Error(`task flow has no enabled modules: ${input.flow.flowID}`);
  const executionSelection = taskExecutionProvider(config);
  if (input.task.evaluator && !executionSelection)
    throw new Error(
      "task execution model is unavailable in the resolved config",
    );
  const state = await NataliaTaskStateStore.open(
    input.workspaceRoot,
    (event) => {
      // Module-level lifecycle (claimed/evaluated/completed/blocked/...) is
      // otherwise only visible in tasks.db; stream it so the TUI can render
      // the arbitration instead of looking stalled.
      const data = event.data as {
        moduleType?: string;
        outcome?: "complete" | "incomplete" | "blocked";
        reason?: string;
      };
      input.emit(
        JSON.stringify({
          type: "flow.module_event",
          kind: event.kind,
          moduleID: event.moduleID,
          moduleType: data.moduleType,
          outcome: data.outcome,
          reason: data.reason,
        }),
      );
    },
  );
  // The alert queue is a separate durable store on purpose: a saturated or
  // broken notification queue must never rewrite the task's terminal truth.
  const alerts = await NataliaTaskAlertQueue.open(input.workspaceRoot);
  const alertSubscriptions = taskAlertSubscriptions(input.task.alerts);
  const alertChannelsFor = (eventKind: NataliaTaskAlertEventKind) =>
    channelsForTaskAlertEvent(alertSubscriptions, eventKind);
  const controllerExecution = newHeadlessExecution();
  const invocationID = `inv_${crypto.randomUUID().replace(/-/gu, "")}`;
  const started = state.startInvocation({
    invocationID,
    taskID: input.task.taskID,
    episodeID: controllerExecution.episodeID,
    sessionID: controllerExecution.sessionID,
  });
  if (!started.started) {
    input.emit(
      JSON.stringify({
        type: "task.invocation",
        invocationID,
        taskID: input.task.taskID,
        status: "skipped_due_to_overlap",
        reason: started.invocation.skipReason,
      }),
    );
    // The overlap contract requires the skip itself to be notifiable; it is a
    // durable terminal invocation state, not an intermediate retry.
    enqueueTaskAlert({
      alerts,
      task: input.task,
      invocation: started.invocation,
      attempt: 0,
      episodeID: controllerExecution.episodeID,
      reason: started.invocation.skipReason,
      json: input.json,
      emit: input.emit,
      eventKind: "skipped_due_to_overlap",
      channels: alertChannelsFor("skipped_due_to_overlap"),
    });
    alerts.close();
    state.close();
    return {
      invocationID,
      status: started.invocation.status,
      waterlineAdvanced: false,
      exitCode: 0,
    };
  }
  enqueueTaskAlert({
    alerts,
    task: input.task,
    invocation: started.invocation,
    attempt: started.attempt.attempt,
    episodeID: started.attempt.episodeID,
    json: input.json,
    emit: input.emit,
    eventKind: "task_started",
    channels: alertChannelsFor("task_started"),
  });
  const maxAttempts = taskRetryMaxAttempts(input.task.retry);
  const reportIssue = taskIssueReporter({
    workspaceRoot: input.workspaceRoot,
    task: input.task,
    config,
  });
  const readDataSource = taskDataSourceReader({
    workspaceRoot: input.workspaceRoot,
    task: input.task,
    config,
    invocationID,
  });
  let attempt = started.attempt.attempt;
  let attemptEpisodeID = started.attempt.episodeID;
  let result: NataliaTaskInvocation | undefined;
  try {
    while (true) {
      input.signal?.throwIfAborted();
      // Every attempt reinitializes the module plan under the attempt's own
      // controller episode/session. The controller advances the linear plan
      // one module at a time, each module runs under its own fresh headless
      // episode, and the batch only reports success after every enabled module
      // completed under evaluator control. A blocked, failed, cancelled, or
      // stalled module stops the batch.
      state.initializeModulePlan({
        invocationID,
        attempt,
        modules: modules.map((module) => ({
          flowID: input.flow.flowID,
          moduleID: module.id,
          moduleType: module.type,
          conditionIDs: [
            ...module.minimumConditions.map((condition) => condition.id),
            ...module.idealConditions.map((condition) => condition.id),
          ],
        })),
      });
      let lastOutcome: TaskModuleRunOutcome | undefined;
      let moduleRuns = 0;
      while (true) {
        input.signal?.throwIfAborted();
        const moduleExecution = newHeadlessExecution();
        const module = state.activateNextModule({
          invocationID,
          attempt,
          episodeID: moduleExecution.episodeID,
          sessionID: moduleExecution.sessionID,
        });
        if (!module) break;
        moduleRuns += 1;
        lastOutcome = await runTaskModule({
          workspaceRoot: input.workspaceRoot,
          task: input.task,
          flow: input.flow,
          config,
          state,
          invocationID,
          attempt,
          executionProvider: executionSelection!,
          execution: moduleExecution,
          module,
          reportIssue,
          readDataSource,
          json: input.json,
          emit: input.emit,
          signal: input.signal,
        });
        if (lastOutcome.outcome !== "complete") break;
      }
      if (moduleRuns === 0)
        throw new Error("task module plan has no activatable module");
      const allCompleted = state.allModulesCompleted(invocationID, attempt);
      const status: Exclude<NataliaTaskAttemptStatus, "running"> = allCompleted
        ? "succeeded"
        : lastOutcome && lastOutcome.outcome !== "complete"
          ? lastOutcome.outcome
          : "stalled";
      const reason = allCompleted
        ? "all enabled modules completed under evaluator control"
        : (lastOutcome?.reason ??
          "module plan did not complete under evaluator control");
      if (taskStatusRetryable(status) && attempt < maxAttempts) {
        state.completeAttempt({
          invocationID,
          attempt,
          status,
          retry: true,
          reason,
        });
        // A retried attempt is not a task outcome, so these are only announced
        // to a channel that explicitly asked for them; the default subscription
        // stays silent until the task is actually finished.
        const retrying = state.getInvocation(invocationID)!;
        for (const eventKind of ["attempt_failed", "retry_scheduled"] as const)
          enqueueTaskAlert({
            alerts,
            task: input.task,
            invocation: retrying,
            attempt,
            episodeID: attemptEpisodeID,
            reason,
            json: input.json,
            emit: input.emit,
            eventKind,
            channels: alertChannelsFor(eventKind),
          });
        attempt += 1;
        const controllerExecution = newHeadlessExecution();
        state.recordAttempt({
          invocationID,
          attempt,
          episodeID: controllerExecution.episodeID,
          sessionID: controllerExecution.sessionID,
        });
        attemptEpisodeID = controllerExecution.episodeID;
        continue;
      }
      state.completeAttempt({
        invocationID,
        attempt,
        status,
        retry: false,
        reason,
      });
      result = state.getInvocation(invocationID)!;
      input.emit(
        input.json
          ? JSON.stringify({
              type: "task.invocation",
              ...result,
              // The invocation row has no reason column; the terminal reason
              // lives on the last attempt. Carrying it here is what lets a
              // client tell the user why the run ended instead of showing a
              // bare status.
              reason,
            })
          : `task ${input.task.taskID}: ${result.status}${reason ? ` — ${reason}` : ""}`,
      );
      // The task's own terminal state is already durable at this point, so an
      // alert enqueue failure is reported and never changes the task result.
      enqueueTaskAlert({
        alerts,
        task: input.task,
        invocation: result,
        attempt,
        episodeID: attemptEpisodeID,
        reason,
        json: input.json,
        emit: input.emit,
        eventKind: taskAlertEventKindForStatus(result.status)!,
        channels: alertChannelsFor(taskAlertEventKindForStatus(result.status)!),
      });
      await drainTaskAlerts({
        alerts,
        config,
        json: input.json,
        emit: input.emit,
      });
      await settleUnattendedState({
        workspaceRoot: input.workspaceRoot,
        invocation: result,
        json: input.json,
        emit: input.emit,
      });
      if (status !== "succeeded" && status !== "stalled") exitCode = 1;
      break;
    }
  } catch (error) {
    if (!input.signal?.aborted) throw error;
    const active = state.getInvocation(invocationID);
    if (active?.status === "running" || active?.status === "retrying") {
      state.cancelInvocation({
        invocationID,
        reason:
          input.signal.reason instanceof Error
            ? input.signal.reason.message
            : String(input.signal.reason ?? "workflow execution cancelled"),
      });
    }
    result = state.getInvocation(invocationID)!;
    input.emit(
      input.json
        ? JSON.stringify({
            type: "task.invocation",
            ...result,
            reason:
              input.signal.reason instanceof Error
                ? input.signal.reason.message
                : String(input.signal.reason ?? "workflow execution cancelled"),
          })
        : `task ${input.task.taskID}: cancelled`,
    );
    await settleUnattendedState({
      workspaceRoot: input.workspaceRoot,
      invocation: result,
      json: input.json,
      emit: input.emit,
    });
    exitCode = 1;
  } finally {
    alerts.close();
    state.close();
  }
  return {
    invocationID,
    status: result?.status ?? "running",
    waterlineAdvanced: Boolean(result?.waterlineAdvanced),
    exitCode,
  };
}

/**
 * Delivers what the queue owes. The task has already reached a durable terminal
 * state, so a failing channel can only leave a visible pending or failed
 * delivery behind: it never changes or reruns the task.
 */
async function drainTaskAlerts(input: {
  alerts: NataliaTaskAlertQueue;
  config: ConfigV2;
  json: boolean;
  emit: (line: string) => void;
}) {
  try {
    const outcomes = await deliverPendingTaskAlerts({
      queue: input.alerts,
      channels: input.config.alertChannels,
    });
    if (!outcomes.length) return;
    for (const outcome of outcomes)
      input.emit(
        input.json
          ? JSON.stringify({ type: "task.alert_delivery", ...outcome })
          : `alert ${outcome.channel}: ${outcome.result}${outcome.error ? ` (${outcome.error})` : ""}`,
      );
  } catch (error) {
    input.emit(
      JSON.stringify({
        type: "diagnostic",
        level: "warning",
        message: `task alert delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
}

/**
 * Cross-execution state is settled only after the invocation is terminal and
 * durable. A success promotes whatever position the execution staged; anything
 * else keeps the previous watermark so the next run reprocesses the same data
 * instead of skipping it.
 */
async function settleUnattendedState(input: {
  workspaceRoot: string;
  invocation: NataliaTaskInvocation;
  json: boolean;
  emit: (line: string) => void;
}) {
  try {
    const store = await NataliaUnattendedStateStore.open(
      input.workspaceRoot,
      input.invocation.taskID,
    );
    if (input.invocation.status === "succeeded")
      await store.commit({ invocationID: input.invocation.invocationID });
    else
      await store.recordFailure({
        invocationID: input.invocation.invocationID,
        status: input.invocation.status,
      });
    const state = store.state();
    const line = {
      type: "task.state",
      taskID: state.taskID,
      consecutiveFailures: state.consecutiveFailures,
      watermarks: Object.keys(state.watermarks).length,
      suppressed: Object.keys(state.suppressed).length,
    };
    if (input.json) input.emit(JSON.stringify(line));
  } catch (error) {
    // Failing to settle leaves the previous watermark in place, which only ever
    // reprocesses data; it must not rewrite the task's terminal result.
    input.emit(
      JSON.stringify({
        type: "diagnostic",
        level: "warning",
        message: `task state settlement failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
}

function enqueueTaskAlert(input: {
  alerts: NataliaTaskAlertQueue;
  task: NataliaTaskDocument;
  invocation: NataliaTaskInvocation;
  attempt: number;
  episodeID: EpisodeID;
  reason?: string;
  json: boolean;
  emit: (line: string) => void;
  channels: string[];
  eventKind: NataliaTaskAlertEventKind;
}) {
  const eventKind = input.eventKind;
  // A channel that did not subscribe to this event hears nothing, and an event
  // nobody subscribed to is not recorded at all.
  if (!input.channels.length) return;
  try {
    const enqueued = input.alerts.enqueue({
      taskID: input.invocation.taskID,
      invocationID: input.invocation.invocationID,
      attempt: input.attempt,
      episodeID: input.episodeID,
      eventKind,
      status: input.invocation.status,
      reason: input.reason,
      channels: input.channels,
    });
    const pressure = input.alerts.queuePressure();
    const line = {
      type: "task.alert",
      alertID: enqueued.alert.alertID,
      eventKind,
      status: input.invocation.status,
      attempt: input.attempt,
      enqueued: enqueued.enqueued,
      channels: enqueued.deliveries.length,
      pendingDeliveries: pressure.pending,
    };
    input.emit(
      input.json
        ? JSON.stringify(line)
        : `alert ${eventKind}: ${enqueued.deliveries.length} channel(s) queued`,
    );
    if (pressure.overLimit)
      input.emit(
        JSON.stringify({
          type: "diagnostic",
          level: "warning",
          message: `task alert delivery queue is above its bound: ${pressure.pending} pending of ${pressure.limit}`,
        }),
      );
  } catch (error) {
    input.emit(
      JSON.stringify({
        type: "diagnostic",
        level: "warning",
        message: `task alert enqueue failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
}

/**
 * Binds the configured issue target credential on the controller side. The
 * returned reporter is the only path from a module to the forge: the token stays
 * in configuration and in this closure, so it never reaches a prompt, a tool
 * argument, a command line, the journal or the model context.
 */
function taskIssueReporter(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  config: ConfigV2;
}) {
  if (!input.task.issueTarget) return undefined;
  const configured = input.config.issueTargets[input.task.issueTarget];
  if (!configured)
    throw new Error(`task issue target not found: ${input.task.issueTarget}`);
  if (!configured.enabled)
    throw new Error(`task issue target is disabled: ${input.task.issueTarget}`);
  if (!configured.token)
    throw new Error(
      `task issue target has no token configured: ${input.task.issueTarget}`,
    );
  const target = createIssueTarget({
    kind: configured.kind,
    baseURL: configured.baseURL,
    owner: configured.owner,
    repo: configured.repo,
    token: configured.token,
    label: configured.label || undefined,
  });
  return async (finding: {
    fingerprintParts: string[];
    title: string;
    body: string;
    labels?: string[];
  }) => {
    const state = await NataliaUnattendedStateStore.open(
      input.workspaceRoot,
      input.task.taskID,
    );
    const result = await reconcileFinding({
      target,
      state,
      finding: {
        fingerprint: findingFingerprint(finding.fingerprintParts),
        title: finding.title,
        body: finding.body,
        labels: finding.labels,
      },
    });
    return {
      action: result.action,
      fingerprint: result.fingerprint,
      repository: target.repository,
      ...("issue" in result
        ? { issue: result.issue.number, url: result.issue.url }
        : { reason: result.reason }),
    };
  };
}

/**
 * Binds the configured append-only source on the controller side. The reader
 * stages the next position for this invocation only; it becomes the durable
 * watermark when the whole task succeeds, so a failed run reprocesses the same
 * content instead of skipping it.
 */
function taskDataSourceReader(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  config: ConfigV2;
  invocationID: string;
}) {
  if (!input.task.dataSource) return undefined;
  const configured = input.config.dataSources[input.task.dataSource];
  if (!configured)
    throw new Error(`task data source not found: ${input.task.dataSource}`);
  if (!configured.enabled)
    throw new Error(`task data source is disabled: ${input.task.dataSource}`);
  const source = {
    name: input.task.dataSource,
    path: configured.path,
    kind: configured.kind,
    maxBytes: configured.maxBytes,
    ...(configured.timestampField
      ? { timestampField: configured.timestampField }
      : {}),
  };
  return async (request: { maxBytes?: number }) => {
    const state = await NataliaUnattendedStateStore.open(
      input.workspaceRoot,
      input.task.taskID,
    );
    const read = await readDataSourceSince({
      source,
      position: state.watermark(source.name)?.position,
      maxBytes: request.maxBytes,
      workspaceRoot: input.workspaceRoot,
    });
    // Staging is not committing: the watermark only moves if the whole task
    // succeeds, so a failed run reads the same content again.
    if (read.position)
      await state.stagePosition({
        invocationID: input.invocationID,
        source: source.name,
        kind: source.kind,
        position: read.position,
      });
    return { ...read };
  };
}

export function taskRetryMaxAttempts(
  retry: NataliaTaskDocument["retry"],
): number {
  if (retry === "once") return 2;
  if (retry === "twice") return 3;
  if (retry === "three_times") return 4;
  return 1;
}

function taskStatusRetryable(
  status: Exclude<NataliaTaskAttemptStatus, "running">,
): boolean {
  return status === "failed" || status === "blocked" || status === "stalled";
}

type TaskModuleRunOutcome =
  | { outcome: "complete"; reason: string }
  | { outcome: "blocked" | "failed" | "cancelled" | "stalled"; reason: string };

/**
 * A fresh module runs in a brand-new episode, so the base task prompt — which
 * describes the whole flow — would otherwise make the model re-run earlier
 * modules (the classic "module 2 redoes module 1" trap). The active module's
 * instructions, conditions and IDs are injected by the runtime system prompt;
 * here we only scope the instruction to the current module.
 */
function moduleRunPrompt(input: {
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  module: NataliaPlannedFlowModule;
}): string {
  // A bare slash command (e.g. `/doctor`) is handled by the runtime's command
  // short-circuit on exact match; wrapping it would break the match and send
  // the task into a real turn that needs a provider. Module context is only
  // meaningful for prompt-driven tasks.
  if (/^\s*\/\S*\s*$/u.test(input.task.prompt)) return input.task.prompt;
  const total = input.flow.modules.length;
  const ordinal = input.flow.modules.findIndex(
    (entry) => entry.id === input.module.moduleID,
  );
  const position =
    ordinal >= 0 && total > 1 ? ` (module ${ordinal + 1} of ${total})` : "";
  return `${input.task.prompt}

Current active module: ${input.module.moduleID}${position}, type ${input.module.moduleType}.
Work only on this module's instructions and completion conditions, which are in your system context. Earlier modules in the flow are already complete — do not redo their work.`;
}

async function runTaskModule(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  config: ConfigV2;
  state: NataliaTaskStateStore;
  invocationID: string;
  attempt: number;
  executionProvider: string;
  execution: HeadlessExecution;
  module: NataliaPlannedFlowModule;
  reportIssue?: NonNullable<
    RealRuntimeClientOptions["taskModuleContext"]
  >["reportIssue"];
  readDataSource?: NonNullable<
    RealRuntimeClientOptions["taskModuleContext"]
  >["readDataSource"];
  json: boolean;
  emit: (line: string) => void;
  signal?: AbortSignal;
}): Promise<TaskModuleRunOutcome> {
  const definition = input.flow.modules.find(
    (entry) => entry.id === input.module.moduleID,
  );
  const taskModuleContext: NonNullable<
    RealRuntimeClientOptions["taskModuleContext"]
  > = {
    store: input.state,
    invocationID: input.invocationID,
    attempt: input.attempt,
    flowID: input.flow.flowID,
    moduleID: input.module.moduleID,
    moduleType: input.module.moduleType,
    moduleInstructions: definition?.instructions ?? "",
    moduleConditions: definition
      ? [
          ...definition.minimumConditions.map((condition) => ({
            id: condition.id,
            text: condition.text,
            kind: "minimum" as const,
          })),
          ...definition.idealConditions.map((condition) => ({
            id: condition.id,
            text: condition.text,
            kind: "ideal" as const,
          })),
        ]
      : undefined,
    moduleCommandRules: definition?.commandRules,
    moduleInteractivePrograms: definition?.interactivePrograms,
    moduleExtensions: definition?.extensions,
    modulePermissions: definition?.permissions,
    reportIssue: input.reportIssue,
    readDataSource: input.readDataSource,
  };
  const client = createRealRuntimeClient({
    ...input.execution,
    workspaceRoot: input.workspaceRoot,
    permissionProfile: input.task.permissionProfile,
    taskModuleContext,
  });
  const cancel = () =>
    client.cancel(
      input.signal?.reason instanceof Error
        ? input.signal.reason.message
        : "workflow execution cancelled",
    );
  let stopReason: Extract<
    RuntimeEvent,
    { type: "turn.finished" }
  >["stopReason"] = "error";
  const evaluatorContext = createEvaluatorContext(
    input.flow.flowID,
    input.module,
  );
  const completionOperations = newModuleCompletionOperations();
  try {
    input.signal?.addEventListener("abort", cancel, { once: true });
    input.signal?.throwIfAborted();
    client.start((event) => {
      if (event.type === "turn.finished") stopReason = event.stopReason;
      collectEvaluatorContext(evaluatorContext, event);
      trackModuleCompletionOperation(completionOperations, event);
      if (input.json) input.emit(JSON.stringify(event));
      else {
        const line = plainRuntimeEvent(event);
        if (line) input.emit(line);
      }
    });
    await client.submit(moduleRunPrompt(input));
    let evaluatorOutcome:
      | Awaited<ReturnType<typeof evaluateClaimedTaskModule>>
      | { outcome: "stalled" }
      | undefined;
    let continuationProgress = {
      conditionStatuses: new Map<string, "missing" | "partial" | "satisfied">(),
      evidenceRefs: new Set<string>(),
    };
    while (
      hasUnevaluatedModuleClaim(
        input.state,
        input.invocationID,
        input.attempt,
        input.module.moduleID,
      )
    ) {
      const operationProblem =
        moduleCompletionOperationProblem(completionOperations);
      evaluatorContext.pendingOperations = operationProblem
        ? [operationProblem]
        : [];
      evaluatorOutcome = evaluatorContext.policyDenied
        ? blockClaimedTaskModule(
            input.state,
            input.invocationID,
            input.attempt,
            evaluatorContext,
            "module policy denial prevents evaluator completion",
          )
        : input.task.evaluator
          ? await evaluateClaimedTaskModule({
              task: input.task,
              config: input.config,
              state: input.state,
              invocationID: input.invocationID,
              attempt: input.attempt,
              executionProvider: input.executionProvider,
              context: evaluatorContext,
              onStreamEvent: (chunk) => {
                if (chunk.text && input.json)
                  input.emit(
                    JSON.stringify({
                      type: "flow.evaluator",
                      moduleID: evaluatorContext.moduleID,
                      phase: chunk.type === "thinking" ? "thinking" : "content",
                      text: chunk.text,
                    }),
                  );
              },
              signal: input.signal,
            })
          : (input.state.stallModule({
              invocationID: input.invocationID,
              attempt: input.attempt,
              flowID: evaluatorContext.flowID,
              moduleID: evaluatorContext.moduleID,
              reason:
                "module claim requires an evaluator before the controller can complete it",
            }),
            { outcome: "stalled" as const });
      if (!evaluatorOutcome || evaluatorOutcome.outcome !== "incomplete") break;
      const progress = moduleContinuationProgress({
        result: evaluatorOutcome.result,
        previous: continuationProgress,
        evidenceRefs: input.state.moduleEvidenceRefs({
          invocationID: input.invocationID,
          attempt: input.attempt,
          flowID: input.flow.flowID,
          moduleID: input.module.moduleID,
        }),
      });
      if (!progress.made) {
        evaluatorOutcome = { outcome: "stalled" };
        input.state.stallModule({
          invocationID: input.invocationID,
          attempt: input.attempt,
          flowID: input.flow.flowID,
          moduleID: input.module.moduleID,
          reason:
            "evaluator incomplete without new evidence or condition improvement",
        });
        break;
      }
      continuationProgress = progress.next;
      taskModuleContext.moduleContinuation = evaluatorContinuation(
        evaluatorOutcome.result,
      );
      await client.submit("Continue the active flow module.");
    }
    if (evaluatorOutcome?.outcome === "complete")
      return {
        outcome: "complete",
        reason: "evaluator completed the module under evaluator control",
      };
    const terminalStatus =
      evaluatorOutcome?.outcome === "blocked"
        ? "blocked"
        : taskTurnTerminalStatus(stopReason);
    if (terminalStatus === "stalled" && evaluatorOutcome === undefined)
      input.state.stallModule({
        invocationID: input.invocationID,
        attempt: input.attempt,
        flowID: input.flow.flowID,
        moduleID: input.module.moduleID,
        reason:
          "turn finished before the completion controller received a module claim",
      });
    const outcome =
      evaluatorOutcome?.outcome === "blocked" ? "blocked" : terminalStatus;
    return {
      outcome,
      reason: evaluatorOutcome
        ? `evaluator ${evaluatorOutcome.outcome}; runtime turn finished: ${stopReason}`
        : `runtime turn finished: ${stopReason}`,
    };
  } finally {
    input.signal?.removeEventListener("abort", cancel);
    await client.dispose?.();
  }
}

function hasUnevaluatedModuleClaim(
  state: NataliaTaskStateStore,
  invocationID: string,
  attempt: number,
  moduleID: string,
) {
  const events = state.moduleEvents(invocationID, attempt);
  const lastClaim = events.findLastIndex(
    (event) =>
      event.kind === "flow.module_claimed" && event.moduleID === moduleID,
  );
  const lastEvaluation = events.findLastIndex(
    (event) =>
      event.kind === "flow.module_evaluated" && event.moduleID === moduleID,
  );
  return lastClaim > lastEvaluation;
}

function evaluatorContinuation(result: EvaluatorResult) {
  return JSON.stringify({
    conditions: result.conditions.map(({ id, status }) => ({ id, status })),
    gaps: result.gaps,
    forbiddenRepeats: result.forbiddenRepeats,
    recommendedActions: result.recommendedActions,
    idealOutcome: result.idealOutcome,
  });
}

function moduleContinuationProgress(input: {
  result: EvaluatorResult;
  previous: {
    conditionStatuses: Map<string, "missing" | "partial" | "satisfied">;
    evidenceRefs: Set<string>;
  };
  evidenceRefs: string[];
}) {
  const rank = { missing: 0, partial: 1, satisfied: 2 } as const;
  const conditionStatuses = new Map(
    input.result.conditions.map((condition) => [
      condition.id,
      condition.status,
    ]),
  );
  const evidenceRefs = new Set(input.evidenceRefs);
  const improvedCondition = input.result.conditions.some(
    (condition) =>
      rank[condition.status] >
      rank[input.previous.conditionStatuses.get(condition.id) ?? "missing"],
  );
  const newEvidence = input.evidenceRefs.some(
    (ref) => !input.previous.evidenceRefs.has(ref),
  );
  return {
    made: improvedCondition || newEvidence,
    next: { conditionStatuses, evidenceRefs },
  };
}

function taskExecutionProvider(config: ConfigV2) {
  const agent = agentsFromConfig(config).default();
  const modelID = agent?.model ?? config.defaultModel;
  const provider = providerForModel(config, modelID, agent?.variant);
  const providerKey = config.models[modelID]?.provider;
  return provider && providerKey ? providerKey : undefined;
}

function createEvaluatorContext(
  flowID: string,
  module: {
    moduleID: string;
    conditionIDs: string[];
  },
): EvaluatorModuleContext & { policyDenied: boolean } {
  return {
    flowID,
    moduleID: module.moduleID,
    conditionIDs: [...module.conditionIDs],
    messages: [],
    toolRecords: [],
    terminalOutput: [],
    executionRecords: [],
    policyDenied: false,
  };
}

function collectEvaluatorContext(
  context: EvaluatorModuleContext & { policyDenied: boolean },
  event: RuntimeEvent,
) {
  if (event.type === "turn.submitted" || event.type === "content.delta") {
    context.messages.push(event.text);
    return;
  }
  if (event.type === "tool.update" && event.status === "succeeded") {
    // The completion-claim tool is control traffic, not work evidence: its
    // calls are never recorded by the evidence store, so showing the ref to
    // the evaluator invites it to cite something that can never validate.
    if (event.name === "flow_module_complete") return;
    context.toolRecords.push(
      `${event.callID ? `tool:${event.callID} ` : ""}${event.name}: ${event.result ?? event.summary}`,
    );
    return;
  }
  if (event.type === "terminal.update") {
    context.terminalOutput.push(`${event.id}: ${event.tail}`);
    return;
  }
  if (event.type === "terminal.action" && event.redacted) {
    context.secureInput = true;
    return;
  }
  if (
    event.type === "policy.decision" &&
    (event.decision === "deny" || event.decision === "rejected")
  )
    context.policyDenied = true;
  if (
    event.type === "policy.decision" ||
    event.type === "diagnostic" ||
    event.type === "turn.finished"
  )
    context.executionRecords.push(JSON.stringify(event));
}

async function evaluateClaimedTaskModule(input: {
  task: NataliaTaskDocument;
  config: ConfigV2;
  state: NataliaTaskStateStore;
  invocationID: string;
  attempt: number;
  executionProvider: string;
  context: EvaluatorModuleContext & { policyDenied: boolean };
  onStreamEvent?: (chunk: { type: string; text: string }) => void;
  signal?: AbortSignal;
}) {
  if (!input.task.evaluator) return undefined;
  const model = input.config.models[input.task.evaluator.model];
  const providerConfig = input.config.providers[input.task.evaluator.provider];
  if (
    !model ||
    !providerConfig ||
    model.provider !== input.task.evaluator.provider
  ) {
    input.state.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: input.context.flowID,
      moduleID: input.context.moduleID,
      outcome: "blocked",
      data: {
        reason:
          "task evaluator selection is unavailable in the resolved config",
      },
    });
    return {
      outcome: "blocked" as const,
      reason: "task evaluator selection is unavailable in the resolved config",
    };
  }
  const provider = providerForModel(input.config, input.task.evaluator.model);
  if (!provider) {
    input.state.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: input.context.flowID,
      moduleID: input.context.moduleID,
      outcome: "blocked",
      data: { reason: "task evaluator provider is unavailable" },
    });
    return {
      outcome: "blocked" as const,
      reason: "task evaluator provider is unavailable",
    };
  }
  const consent = input.task.evaluatorConsent;
  if (consent && consent.provider !== input.task.evaluator.provider) {
    input.state.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: input.context.flowID,
      moduleID: input.context.moduleID,
      outcome: "blocked",
      data: {
        reason: "task evaluator consent does not match evaluator provider",
      },
    });
    return {
      outcome: "blocked" as const,
      reason: "task evaluator consent does not match evaluator provider",
    };
  }
  const result = await evaluateAndRecordModule({
    store: input.state,
    invocationID: input.invocationID,
    attempt: input.attempt,
    executionProvider: input.executionProvider,
    selection: { provider: provider.provider, model: provider.model },
    consent: consent
      ? { provider: consent.provider, confirmedAt: consent.confirmedAt }
      : undefined,
    provider,
    providerIdentity: input.task.evaluator.provider,
    context: input.context,
    onStreamEvent: input.onStreamEvent,
    signal: input.signal,
  });
  return result;
}

function blockClaimedTaskModule(
  state: NataliaTaskStateStore,
  invocationID: string,
  attempt: number,
  context: EvaluatorModuleContext,
  reason: string,
) {
  state.evaluateModule({
    invocationID,
    attempt,
    flowID: context.flowID,
    moduleID: context.moduleID,
    outcome: "blocked",
    data: { reason },
  });
  return { outcome: "blocked" as const, reason };
}

export type HeadlessExecution = {
  episodeID: EpisodeID;
  sessionID: SessionID;
  title: string;
  useSqliteStore: boolean;
};

export function newHeadlessExecution(): HeadlessExecution {
  const episodeID =
    `epi_${crypto.randomUUID().replace(/-/gu, "")}` as EpisodeID;
  return {
    episodeID,
    sessionID: `ses_${episodeID.slice("epi_".length)}` as SessionID,
    title: `Natalia unattended episode ${episodeID}`,
    useSqliteStore: true,
  };
}

function taskTurnTerminalStatus(
  stopReason: Extract<RuntimeEvent, { type: "turn.finished" }>["stopReason"],
): "failed" | "cancelled" | "stalled" {
  if (stopReason === "cancelled") return "cancelled";
  if (stopReason === "error") return "failed";
  return "stalled";
}

export function plainRuntimeEvent(event: RuntimeEvent) {
  if (event.type === "diagnostic") return `${event.level}: ${event.message}`;
  if (event.type === "turn.finished")
    return `turn finished: ${event.stopReason}`;
  if (event.type === "checkpoint.created") return `checkpoint ${event.id}`;
  if (event.type === "rollback.end")
    return `rollback ${event.checkpointID} done`;
  return undefined;
}
