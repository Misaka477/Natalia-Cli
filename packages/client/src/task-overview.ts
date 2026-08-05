import { readdir } from "node:fs/promises";
import type { ConfigV2, NataliaTaskDocument } from "@natalia/contracts";
import {
  NataliaDocumentStore,
  NataliaTaskAlertQueue,
  NataliaTaskStateStore,
  NataliaUnattendedStateStore,
} from "@natalia/workflow";
import { effectiveFlowPermissions } from "./effective-policy";

export type ScheduledTaskRow = {
  taskID: string;
  displayName: string;
  path: string;
  /** The task's own human-readable cadence. The real schedule belongs to the scheduler. */
  schedule: string;
  permissionProfile: string;
  flowID: string;
  enabledModules: number;
  retry: NataliaTaskDocument["retry"];
  alertChannels: string[];
  issueTarget?: string;
  dataSource?: string;
  lastRun?: {
    invocationID: string;
    status: string;
    startedAt: string;
    endedAt?: string;
    skipReason?: string;
  };
  consecutiveFailures: number;
  pendingAlertDeliveries: number;
  /** Reasons this task would refuse to run right now, empty when it is ready. */
  problems: string[];
};

export type FlowStageRow = {
  moduleID: string;
  moduleType: string;
  displayName: string;
  enabled: boolean;
  minimumConditions: number;
  idealConditions: number;
  hasInstructions: boolean;
  commandRules?: { mode: string; commands: number };
  interactivePrograms: number;
};

export type FlowRow = {
  flowID: string;
  displayName: string;
  path: string;
  stages: FlowStageRow[];
  enabledStages: number;
  /** Tasks in this workspace that run this flow. */
  usedBy: string[];
  problems: string[];
};

export type FlowOverview = {
  flows: FlowRow[];
  unreadable: Array<{ path: string; reason: string }>;
};

export type ScheduledTaskOverview = {
  tasks: ScheduledTaskRow[];
  /** Task documents that could not be read at all. */
  unreadable: Array<{ path: string; reason: string }>;
};

/**
 * Everything a scheduled-task surface needs about every task in a workspace: how
 * it is configured, what happened last time, and whether it would refuse to run.
 *
 * It reports problems instead of throwing, because a list has to stay usable when
 * one of its entries is broken; a caller that is about to run a task still
 * performs the fail-closed preflight.
 */
export async function scheduledTaskOverview(input: {
  workspaceRoot: string;
  config: ConfigV2;
}): Promise<ScheduledTaskOverview> {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  let entries: string[] = [];
  try {
    entries = (await readdir(documents.tasksDir)).filter((entry) =>
      /\.ya?ml$/iu.test(entry),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const state = await NataliaTaskStateStore.open(input.workspaceRoot);
  const alerts = await NataliaTaskAlertQueue.open(input.workspaceRoot);
  try {
    const tasks: ScheduledTaskRow[] = [];
    const unreadable: Array<{ path: string; reason: string }> = [];
    for (const entry of entries.sort()) {
      let task: NataliaTaskDocument;
      try {
        task = await documents.loadTask(entry);
      } catch (error) {
        unreadable.push({
          path: entry,
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      const problems: string[] = [];
      const flow = await documents.resolveTaskFlow(task).catch((error) => {
        problems.push(error instanceof Error ? error.message : String(error));
        return undefined;
      });
      const profile = input.config.permissionProfiles[task.permissionProfile];
      if (!profile)
        problems.push(
          `permission profile not found: ${task.permissionProfile}`,
        );
      else if (profile.approval !== "auto")
        problems.push(
          `permission profile must use auto approval: ${task.permissionProfile}`,
        );
      for (const [kind, key, entryConfig] of [
        [
          "issue target",
          task.issueTarget,
          task.issueTarget
            ? input.config.issueTargets[task.issueTarget]
            : undefined,
        ],
        [
          "data source",
          task.dataSource,
          task.dataSource
            ? input.config.dataSources[task.dataSource]
            : undefined,
        ],
      ] as const) {
        if (!key) continue;
        if (!entryConfig) problems.push(`${kind} not found: ${key}`);
        else if (!entryConfig.enabled)
          problems.push(`${kind} is disabled: ${key}`);
      }
      for (const channel of task.alerts) {
        const configured = input.config.alertChannels[channel];
        if (!configured) problems.push(`alert channel not found: ${channel}`);
        else if (!configured.enabled)
          problems.push(`alert channel is disabled: ${channel}`);
      }
      if (task.evaluator && !input.config.models[task.evaluator.model])
        problems.push(`evaluator model not found: ${task.evaluator.model}`);
      if (flow) {
        for (const module of flow.modules)
          if (module.enabled && !module.minimumConditions.length)
            problems.push(
              `stage has no minimum completion condition: ${module.id}`,
            );
        for (const blocked of effectiveFlowPermissions({
          profile,
          flow,
          taskCapabilities: {
            reportIssue: Boolean(task.issueTarget),
            readDataSource: Boolean(task.dataSource),
          },
        }).blocked)
          problems.push(`${blocked.moduleID}: ${blocked.reason}`);
      }
      const crossExecution = await NataliaUnattendedStateStore.open(
        input.workspaceRoot,
        task.taskID,
      ).catch(() => undefined);
      const lastRun = state.invocations(task.taskID, 1)[0];
      tasks.push({
        taskID: task.taskID,
        displayName: task.displayName,
        path: entry,
        schedule: task.schedule,
        permissionProfile: task.permissionProfile,
        flowID: flow?.flowID ?? task.flow.flowID ?? "",
        enabledModules:
          flow?.modules.filter((module) => module.enabled).length ?? 0,
        retry: task.retry,
        alertChannels: task.alerts,
        ...(task.issueTarget ? { issueTarget: task.issueTarget } : {}),
        ...(task.dataSource ? { dataSource: task.dataSource } : {}),
        ...(lastRun
          ? {
              lastRun: {
                invocationID: lastRun.invocationID,
                status: lastRun.status,
                startedAt: lastRun.startedAt,
                ...(lastRun.endedAt ? { endedAt: lastRun.endedAt } : {}),
                ...(lastRun.skipReason
                  ? { skipReason: lastRun.skipReason }
                  : {}),
              },
            }
          : {}),
        consecutiveFailures: crossExecution?.consecutiveFailures() ?? 0,
        pendingAlertDeliveries: alerts
          .alerts(task.taskID)
          .flatMap((alert) => alerts.deliveries(alert.alertID))
          .filter((delivery) => delivery.state === "pending").length,
        problems,
      });
    }
    return { tasks, unreadable };
  } finally {
    alerts.close();
    state.close();
  }
}

/**
 * Every flow in the workspace, its stages, and which tasks run it.
 *
 * Like the task overview it reports problems per entry instead of throwing: a
 * flow that no task can complete has to stay visible and explain itself.
 */
export async function flowOverview(input: {
  workspaceRoot: string;
}): Promise<FlowOverview> {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  let entries: string[] = [];
  try {
    entries = (await readdir(documents.flowsDir)).filter((entry) =>
      /\.ya?ml$/iu.test(entry),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const taskFlows = new Map<string, string[]>();
  try {
    for (const entry of await readdir(documents.tasksDir)) {
      if (!/\.ya?ml$/iu.test(entry)) continue;
      const task = await documents.loadTask(entry).catch(() => undefined);
      if (!task?.flow.flowID) continue;
      taskFlows.set(task.flow.flowID, [
        ...(taskFlows.get(task.flow.flowID) ?? []),
        task.taskID,
      ]);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const flows: FlowRow[] = [];
  const unreadable: Array<{ path: string; reason: string }> = [];
  for (const entry of entries.sort()) {
    const flow = await documents
      .loadFlow(`.natalia/flows/${entry}`)
      .catch((error: unknown) => {
        unreadable.push({
          path: entry,
          reason: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      });
    if (!flow) continue;
    const stages: FlowStageRow[] = flow.modules.map((module) => ({
      moduleID: module.id,
      moduleType: module.type,
      displayName: module.displayName,
      enabled: module.enabled,
      minimumConditions: module.minimumConditions.length,
      idealConditions: module.idealConditions.length,
      hasInstructions: Boolean(module.instructions.trim()),
      ...(module.commandRules
        ? {
            commandRules: {
              mode: module.commandRules.mode,
              commands: module.commandRules.rules.length,
            },
          }
        : {}),
      interactivePrograms: module.interactivePrograms?.allow.length ?? 0,
    }));
    const problems: string[] = [];
    if (!stages.some((stage) => stage.enabled))
      problems.push("no stage is enabled, so the flow can never complete");
    for (const stage of stages)
      if (stage.enabled && !stage.minimumConditions)
        problems.push(
          `stage has no minimum completion condition: ${stage.moduleID}`,
        );
    flows.push({
      flowID: flow.flowID,
      displayName: flow.displayName,
      path: entry,
      stages,
      enabledStages: stages.filter((stage) => stage.enabled).length,
      usedBy: taskFlows.get(flow.flowID) ?? [],
      problems,
    });
  }
  return { flows, unreadable };
}
