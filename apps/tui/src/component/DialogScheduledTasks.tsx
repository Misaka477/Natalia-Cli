import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ScheduledTaskOverview, ScheduledTaskRow } from "@natalia/client";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

export type ScheduledTaskAction = "run" | "problems" | "close";

export type TaskRunOutcome = {
  ok: boolean;
  status?: string;
  message: string;
};

/**
 * A manual run goes through the same command a timer uses, in its own process.
 *
 * Running it inside the TUI would block the render loop for the whole task, and
 * a resident executor is not required here: paying a cold start once, for a run
 * a person just asked for, costs nothing and keeps this independent of whether a
 * daemon happens to be up.
 */
export function taskRunCommand(input: {
  execPath: string;
  taskPath: string;
  workspaceRoot: string;
  cliEntry?: string;
}) {
  return [
    ...(input.cliEntry ? [input.execPath, input.cliEntry] : ["natalia-ts"]),
    "task",
    "run",
    input.taskPath,
    "--workspace",
    input.workspaceRoot,
    "--json",
  ];
}

/** Source checkout layout, so a dev launch finds the CLI next to the TUI. */
export function resolveCliEntry(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  const override = env.NATALIA_CLI_ENTRY;
  if (override) return exists(override) ? override : undefined;
  const sibling = fileURLToPath(
    new URL("../../../cli/src/main.ts", import.meta.url),
  );
  return exists(sibling) ? sibling : undefined;
}

/**
 * Reads the terminal status out of the run's own event stream rather than
 * guessing from the exit code, so an overlap skip is reported as a skip and a
 * stalled run is not reported as a success.
 */
export function readTaskRunOutcome(input: {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}): TaskRunOutcome {
  const invocation = input.stdout
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    })
    .find((event) => event?.type === "task.invocation" || event?.status);
  const status =
    typeof invocation?.status === "string" ? invocation.status : undefined;
  if (!status)
    return {
      ok: false,
      message:
        input.stderr.trim().split("\n").at(-1) ??
        `the task run exited with code ${String(input.exitCode)}`,
    };
  if (status === "succeeded")
    return { ok: true, status, message: "Task succeeded" };
  if (status === "skipped_due_to_overlap")
    return {
      ok: true,
      status,
      message: "Skipped: the previous run is still going",
    };
  return { ok: false, status, message: `Task ${status.replace(/_/gu, " ")}` };
}

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
        : task.pendingAlertDeliveries
          ? `${task.pendingAlertDeliveries} alerts pending`
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

/**
 * A list row has about fifty columns inside the dialog, so it carries only what
 * decides whether the operator needs to look closer: the cadence and how the last
 * run ended. The profile, the stages and the alert state live in the detail view.
 */
export function scheduledTaskSummary(task: ScheduledTaskRow) {
  const lastRun = task.lastRun
    ? `last ${task.lastRun.skipReason ? "skipped (overlap)" : task.lastRun.status}`
    : "never run";
  return [
    task.schedule,
    lastRun,
    ...(task.consecutiveFailures
      ? [`${task.consecutiveFailures} failures in a row`]
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
    {
      title: task.problems.length ? "Run now (blocked)" : "Run now",
      value: "run" as ScheduledTaskAction,
      category: "Action",
      description: task.problems.length
        ? "Fix the problems below first: this task would refuse to run"
        : "Runs once in its own process, exactly like the timer does",
      disabled: task.problems.length > 0,
    },
    {
      title: `Flow: ${task.flowID}`,
      value: "close" as ScheduledTaskAction,
      category: "Definition",
    },
    {
      title: `Profile: ${task.permissionProfile} · retry ${task.retry}`,
      value: "close" as ScheduledTaskAction,
      category: "Definition",
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

/**
 * Runs one task in its own process and reports what its own event stream said.
 * The TUI stays responsive because nothing about the run happens on this thread.
 */
export async function runScheduledTaskProcess(input: {
  taskPath: string;
  workspaceRoot: string;
  env?: NodeJS.ProcessEnv;
}): Promise<TaskRunOutcome> {
  const cliEntry = resolveCliEntry(input.env);
  const command = taskRunCommand({
    execPath: process.execPath,
    taskPath: input.taskPath,
    workspaceRoot: input.workspaceRoot,
    cliEntry,
  });
  try {
    const child = Bun.spawn(command, {
      cwd: input.workspaceRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(child.stdout).text();
    const stderr = await new Response(child.stderr).text();
    await child.exited;
    return readTaskRunOutcome({ exitCode: child.exitCode, stdout, stderr });
  } catch (error) {
    return {
      ok: false,
      message: `could not start the task run: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * The dialog provider renders only the top of its stack, so opening the detail
 * view unmounts this component and closing it mounts a fresh one. The overview
 * therefore belongs to whoever pushes the dialog, not to a signal in here, or a
 * task's new result would be discarded the moment the detail view closes.
 */
export function DialogScheduledTasks(props: {
  overview: ScheduledTaskOverview;
  workspaceRoot: string;
  /** Refreshes the caller's overview after a task ran. */
  reload?: () => Promise<void>;
  runTask?: (taskPath: string) => Promise<TaskRunOutcome>;
  notify?: (outcome: TaskRunOutcome) => void;
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
            onSelect={async (detail) => {
              if (detail.value !== "run") {
                dialog.pop();
                return;
              }
              dialog.pop();
              props.notify?.({
                ok: true,
                message: `Running ${task.displayName}…`,
              });
              const outcome = await props.runTask?.(task.path);
              if (outcome) props.notify?.(outcome);
              await props.reload?.();
            }}
          />
        ));
      }}
    />
  );
}
