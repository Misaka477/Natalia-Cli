import { readdir } from "node:fs/promises";
import type {
  ConfigV2,
  FlowOverview,
  FlowRow,
  FlowStageRow,
  NataliaTaskDocument,
  ScheduledTaskOverview,
  ScheduledTaskRow,
} from "@natalia/contracts";
export type {
  FlowOverview,
  FlowRow,
  FlowStageRow,
  ScheduledTaskOverview,
  ScheduledTaskRow,
} from "@natalia/contracts";
import {
  taskAlertSubscriptions,
  NataliaDocumentStore,
  NataliaTaskAlertQueue,
  NataliaTaskStateStore,
  NataliaUnattendedStateStore,
} from "@natalia/workflow";
import { effectiveFlowPermissions } from "./effective-policy";
import { nextSystemdRun } from "./systemd-adapter";

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
  readNextRun?: typeof nextSystemdRun;
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
        task = await documents.loadTaskDocument(entry);
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
      const subscriptions = taskAlertSubscriptions(task.alerts);
      for (const { channel } of subscriptions) {
        const configured = input.config.alertChannels[channel];
        if (!configured) problems.push(`alert channel not found: ${channel}`);
        else if (!configured.enabled)
          problems.push(`alert channel is disabled: ${channel}`);
      }
      if (task.evaluator && !input.config.models[task.evaluator.model])
        problems.push(`evaluator model not found: ${task.evaluator.model}`);
      if (
        task.systemd?.timerUnit &&
        task.systemd.generatedCalendar &&
        task.systemd.generatedCalendar !== task.systemd.calendar
      )
        problems.push("timer calendar changed; update timer");
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
      const nextRun = task.systemd?.timerUnit
        ? await (input.readNextRun ?? nextSystemdRun)({
            timerUnit: task.systemd.timerUnit,
            scope: task.systemd.scope,
          })
        : undefined;
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
        alertChannels: subscriptions.map(
          (subscription) => subscription.channel,
        ),
        alertEvents: subscriptions.flatMap((subscription) =>
          subscription.on.map((kind) => `${subscription.channel}:${kind}`),
        ),
        ...(task.issueTarget ? { issueTarget: task.issueTarget } : {}),
        ...(task.dataSource ? { dataSource: task.dataSource } : {}),
        ...(task.systemd
          ? {
              systemd: {
                calendar: task.systemd.calendar,
                scope: task.systemd.scope,
                ...(task.systemd.timerUnit
                  ? { timerUnit: task.systemd.timerUnit }
                  : {}),
                ...(task.systemd.generatedCalendar
                  ? { generatedCalendar: task.systemd.generatedCalendar }
                  : {}),
                ...(nextRun ? { nextRun } : {}),
              },
            }
          : {}),
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
      const reference = task?.flow.flowID ?? task?.flow.path;
      if (!task || !reference) continue;
      taskFlows.set(reference, [
        ...(taskFlows.get(reference) ?? []),
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
      interactivePrograms: module.interactivePrograms?.allowAny
        ? "any"
        : (module.interactivePrograms?.allow.length ?? 0),
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
      usedBy: [
        ...(taskFlows.get(flow.flowID) ?? []),
        ...(taskFlows.get(`.natalia/flows/${entry}`) ?? []),
      ],
      problems,
    });
  }
  return { flows, unreadable };
}
