import type { ScheduledTaskOverview, ScheduledTaskRow } from "@natalia/client";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

export type ScheduledTaskAction = "problems" | "close";

/**
 * One row per task document. A task that would refuse to run is grouped apart
 * and says so in its own row, because a scheduled workspace that quietly stopped
 * being runnable is the failure this surface exists to catch.
 */
export function buildScheduledTaskOptions(
  overview: ScheduledTaskOverview,
): DialogSelectOption<string>[] {
  return [
    ...overview.tasks.map((task) => ({
      title: task.displayName,
      value: task.path,
      category: task.problems.length ? "Needs attention" : "Ready",
      description: scheduledTaskSummary(task),
      footer: task.problems.length
        ? `${task.problems.length} problem${task.problems.length > 1 ? "s" : ""}`
        : undefined,
    })),
    ...overview.unreadable.map((broken) => ({
      title: broken.path,
      value: broken.path,
      category: "Unreadable",
      description: broken.reason.replace(/\s+/gu, " ").trim(),
      disabled: true,
    })),
  ];
}

export function scheduledTaskSummary(task: ScheduledTaskRow) {
  const lastRun = task.lastRun
    ? `last ${task.lastRun.status}${task.lastRun.skipReason ? " (overlap)" : ""}`
    : "never run";
  return [
    task.schedule,
    task.permissionProfile,
    `${task.enabledModules} stage${task.enabledModules === 1 ? "" : "s"}`,
    lastRun,
    ...(task.consecutiveFailures
      ? [`${task.consecutiveFailures} failures in a row`]
      : []),
    ...(task.pendingAlertDeliveries
      ? [`${task.pendingAlertDeliveries} alerts pending`]
      : []),
  ].join(" · ");
}

/**
 * Read-only detail of one task. It never hides a problem behind a summary: the
 * reasons are listed verbatim so the operator can go fix the configuration.
 */
export function buildScheduledTaskDetail(
  task: ScheduledTaskRow,
): DialogSelectOption<ScheduledTaskAction>[] {
  return [
    { title: `Flow: ${task.flowID}`, value: "close" as ScheduledTaskAction },
    {
      title: `Profile: ${task.permissionProfile} · retry ${task.retry}`,
      value: "close" as ScheduledTaskAction,
    },
    {
      title: `Alerts: ${task.alertChannels.join(", ") || "none"}`,
      value: "close" as ScheduledTaskAction,
      description: task.pendingAlertDeliveries
        ? `${task.pendingAlertDeliveries} pending deliveries`
        : undefined,
    },
    ...(task.dataSource
      ? [
          {
            title: `Source: ${task.dataSource}`,
            value: "close" as ScheduledTaskAction,
          },
        ]
      : []),
    ...(task.issueTarget
      ? [
          {
            title: `Issues: ${task.issueTarget}`,
            value: "close" as ScheduledTaskAction,
          },
        ]
      : []),
    {
      title: task.lastRun
        ? `Last run: ${task.lastRun.status} at ${task.lastRun.startedAt}`
        : "Last run: never",
      value: "close" as ScheduledTaskAction,
      description: task.lastRun?.skipReason,
    },
    ...task.problems.map((problem) => ({
      title: `Problem: ${problem}`,
      value: "problems" as ScheduledTaskAction,
      category: "Needs attention",
    })),
  ];
}

export function DialogScheduledTasks(props: {
  overview: ScheduledTaskOverview;
}) {
  const dialog = useDialog();
  return (
    <DialogSelect
      title="Scheduled Tasks"
      placeholder="Search tasks"
      options={buildScheduledTaskOptions(props.overview)}
      emptyView={<text>No task documents under .natalia/tasks.</text>}
      onSelect={(option) => {
        const task = props.overview.tasks.find(
          (entry) => entry.path === option.value,
        );
        if (!task) return;
        dialog.push(() => (
          <DialogSelect
            title={`${task.displayName} · ${task.taskID}`}
            options={buildScheduledTaskDetail(task)}
            skipFilter
            onSelect={() => dialog.pop()}
          />
        ));
      }}
    />
  );
}
