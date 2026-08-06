import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  ConfigV2,
  NataliaTaskDocument,
  NataliaTaskDocumentInput,
} from "@natalia/contracts";
import {
  newScheduledTaskID,
  type FlowOverview,
  type ScheduledTaskOverview,
  type ScheduledTaskRow,
} from "@natalia/client";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { DialogSelect, type DialogSelectOption } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";
import { darkTheme } from "../theme/theme";

export type ScheduledTaskAction =
  | "run"
  | "edit"
  | "delete"
  | "problems"
  | "close";

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
  options: { canCreate?: boolean } = {},
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
    ...(options.canCreate
      ? [
          {
            title: "Create task",
            value: "$create",
            category: "Action",
            description: "Define a new unattended task",
          },
        ]
      : []),
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
      title: "Edit task",
      value: "edit" as ScheduledTaskAction,
      category: "Action",
      description:
        "Change the definition; runtime checks still run before execution",
    },
    {
      title: "Delete task",
      value: "delete" as ScheduledTaskAction,
      category: "Action",
      description:
        "Removes the definition; execution history and audit state remain",
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

export function taskDocumentForEditor(input: {
  taskID: string;
  displayName: string;
  schedule: string;
  prompt: string;
  flowID: string;
  flowPath: string;
  permissionProfile: string;
  retry: NataliaTaskDocument["retry"];
  alerts: NataliaTaskDocument["alerts"];
  issueTarget?: string;
  dataSource?: string;
  evaluator?: NataliaTaskDocument["evaluator"];
  evaluatorConsent?: NataliaTaskDocument["evaluatorConsent"];
}): NataliaTaskDocumentInput {
  return {
    kind: "natalia-task",
    version: 1,
    taskID: input.taskID,
    displayName: input.displayName.trim(),
    schedule: input.schedule.trim(),
    prompt: input.prompt.trim(),
    permissionProfile: input.permissionProfile,
    flow: {
      flowID: input.flowID,
      path: taskFlowDocumentPath(input.flowPath),
    },
    retry: input.retry,
    alerts: input.alerts,
    ...(input.issueTarget ? { issueTarget: input.issueTarget } : {}),
    ...(input.dataSource ? { dataSource: input.dataSource } : {}),
    ...(input.evaluator ? { evaluator: input.evaluator } : {}),
    ...(input.evaluatorConsent
      ? { evaluatorConsent: input.evaluatorConsent }
      : {}),
  };
}

type TaskEditorDraft = {
  path: string;
  taskID: string;
  displayName: string;
  schedule: string;
  prompt: string;
  flowID: string;
  flowPath: string;
  permissionProfile: string;
  retry: NataliaTaskDocument["retry"];
  alerts: NataliaTaskDocument["alerts"];
  issueTarget?: string;
  dataSource?: string;
  evaluator?: NataliaTaskDocument["evaluator"];
  evaluatorConsent?: NataliaTaskDocument["evaluatorConsent"];
};

function draftFromTask(input: { path: string; task: NataliaTaskDocument }) {
  return {
    path: input.path,
    taskID: input.task.taskID,
    displayName: input.task.displayName,
    schedule: input.task.schedule,
    prompt: input.task.prompt,
    flowID: input.task.flow.flowID ?? "",
    flowPath: input.task.flow.path ?? "",
    permissionProfile: input.task.permissionProfile,
    retry: input.task.retry,
    alerts: input.task.alerts,
    ...(input.task.issueTarget ? { issueTarget: input.task.issueTarget } : {}),
    ...(input.task.dataSource ? { dataSource: input.task.dataSource } : {}),
    ...(input.task.evaluator ? { evaluator: input.task.evaluator } : {}),
    ...(input.task.evaluatorConsent
      ? { evaluatorConsent: input.task.evaluatorConsent }
      : {}),
  } satisfies TaskEditorDraft;
}

function newTaskDraft() {
  const taskID = newScheduledTaskID();
  return {
    path: `${taskID}.yaml`,
    taskID,
    displayName: "",
    schedule: "",
    prompt: "",
    flowID: "",
    flowPath: "",
    permissionProfile: "",
    retry: "none",
    alerts: [],
  } satisfies TaskEditorDraft;
}

function taskEditorFlowOptions(flows: FlowOverview) {
  return flows.flows.map((flow) => ({
    title: flow.displayName,
    value: flow.path,
    description: `${flow.flowID} · ${flow.enabledStages} enabled stage${flow.enabledStages === 1 ? "" : "s"}`,
    footer: flow.problems.length
      ? `${flow.problems.length} problem${flow.problems.length === 1 ? "" : "s"}`
      : undefined,
  }));
}

function taskFlowDocumentPath(path: string) {
  return path.startsWith(".natalia/flows/") ? path : `.natalia/flows/${path}`;
}

function TaskProblemDetail(props: { task: ScheduledTaskRow }) {
  const dialog = useDialog();
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.text}>Task problems</text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <text fg={darkTheme.muted} wrapMode="word">
        {props.task.displayName}
      </text>
      {props.task.problems.map((problem) => (
        <text fg={darkTheme.danger} wrapMode="word">
          {problem}
        </text>
      ))}
    </box>
  );
}

function taskEditorProfileOptions(config: ConfigV2) {
  return Object.entries(config.permissionProfiles).map(([key, profile]) => ({
    title: key,
    value: key,
    description: profile.description || `approval: ${profile.approval}`,
    footer:
      profile.approval !== "auto"
        ? "Unattended tasks require auto approval"
        : undefined,
  }));
}

function TaskEditor(props: {
  draft: TaskEditorDraft;
  editor?:
    | "summary"
    | "name"
    | "flow"
    | "profile"
    | "schedule"
    | "prompt"
    | "retry"
    | "alerts"
    | "issueTarget"
    | "dataSource";
  flows: FlowOverview;
  config: ConfigV2;
  save: (document: NataliaTaskDocumentInput, path: string) => Promise<void>;
  reload: () => Promise<void>;
  notify: (outcome: TaskRunOutcome) => void;
}) {
  const dialog = useDialog();
  const editor = props.editor ?? "summary";
  const advance = (
    next: TaskEditorDraft,
    nextEditor: typeof editor = "summary",
  ) => {
    dialog.pop();
    dialog.push(() => (
      <TaskEditor {...props} draft={next} editor={nextEditor} />
    ));
  };
  const flowOptions = taskEditorFlowOptions(props.flows);
  const profileOptions = taskEditorProfileOptions(props.config);
  if (!props.draft.displayName || editor === "name")
    return (
      <DialogPrompt
        title="Task name"
        value={props.draft.displayName}
        placeholder="Nightly review"
        validate={(value) =>
          !value.trim() ? "A task name is required" : undefined
        }
        onConfirm={(value) => advance({ ...props.draft, displayName: value })}
      />
    );
  if (!props.draft.flowPath || editor === "flow")
    return (
      <DialogSelect
        title="Choose flow"
        placeholder="Search flows"
        options={flowOptions}
        emptyView={
          <text>No runnable flow documents under .natalia/flows.</text>
        }
        onSelect={(option) => {
          const flow = props.flows.flows.find(
            (entry) => entry.path === option.value,
          );
          if (flow)
            advance({
              ...props.draft,
              flowID: flow.flowID,
              flowPath: taskFlowDocumentPath(flow.path),
            });
        }}
      />
    );
  if (!props.draft.permissionProfile || editor === "profile")
    return (
      <DialogSelect
        title="Choose permission profile"
        placeholder="Search profiles"
        options={profileOptions}
        emptyView={
          <text>No auto-approval permission profiles are configured.</text>
        }
        onSelect={(option) =>
          advance({ ...props.draft, permissionProfile: option.value })
        }
      />
    );
  if (!props.draft.schedule || editor === "schedule")
    return (
      <DialogPrompt
        title="Schedule"
        value={props.draft.schedule}
        placeholder="daily 02:15"
        validate={(value) =>
          !value.trim() ? "A schedule is required" : undefined
        }
        onConfirm={(value) => advance({ ...props.draft, schedule: value })}
      />
    );
  if (!props.draft.prompt || editor === "prompt")
    return (
      <DialogPrompt
        title="Task instructions"
        value={props.draft.prompt}
        placeholder="Describe what this task should achieve."
        validate={(value) =>
          !value.trim() ? "Task instructions are required" : undefined
        }
        onConfirm={(value) => advance({ ...props.draft, prompt: value })}
      />
    );
  if (editor === "retry")
    return (
      <DialogSelect
        title="Retry policy"
        options={(["none", "once", "twice", "three_times"] as const).map(
          (retry) => ({ title: retry.replace(/_/gu, " "), value: retry }),
        )}
        onSelect={(retry) => advance({ ...props.draft, retry: retry.value })}
      />
    );
  if (editor === "alerts") {
    const selected = new Map(
      props.draft.alerts.map((alert) => [
        typeof alert === "string" ? alert : alert.channel,
        alert,
      ]),
    );
    const channels = [
      ...new Set([
        ...Object.keys(props.config.alertChannels),
        ...selected.keys(),
      ]),
    ].sort();
    return (
      <DialogSelect
        title="Alert channels"
        placeholder="Search channels"
        options={channels.map((channel) => {
          const subscription = selected.get(channel);
          return {
            title: subscription ? `Remove ${channel}` : `Add ${channel}`,
            value: channel,
            category: subscription ? "Selected" : "Available",
            description:
              typeof subscription === "object"
                ? subscription.on.join(", ")
                : subscription
                  ? "Conservative default events"
                  : props.config.alertChannels[channel]
                    ? undefined
                    : "Channel is not configured; saving is allowed but the task needs attention",
          };
        })}
        emptyView={<text>No alert channels are configured.</text>}
        onSelect={(option) => {
          const next = selected.has(option.value)
            ? props.draft.alerts.filter(
                (alert) =>
                  (typeof alert === "string" ? alert : alert.channel) !==
                  option.value,
              )
            : [...props.draft.alerts, option.value];
          advance({ ...props.draft, alerts: next });
        }}
      />
    );
  }
  if (editor === "issueTarget" || editor === "dataSource") {
    const configured =
      editor === "issueTarget"
        ? props.config.issueTargets
        : props.config.dataSources;
    const current =
      editor === "issueTarget"
        ? props.draft.issueTarget
        : props.draft.dataSource;
    return (
      <DialogSelect
        title={editor === "issueTarget" ? "Issue target" : "Data source"}
        placeholder="Search configured references"
        options={[
          {
            title: "None",
            value: "$none",
            category: current ? "Available" : "Selected",
          },
          ...Object.entries(configured).map(([key, value]) => ({
            title: key,
            value: key,
            category: current === key ? "Selected" : "Available",
            description: value.enabled
              ? undefined
              : "Disabled; saving is allowed but the task needs attention",
          })),
        ]}
        onSelect={(option) =>
          advance({
            ...props.draft,
            [editor]: option.value === "$none" ? undefined : option.value,
          })
        }
      />
    );
  }
  return (
    <DialogSelect
      title={`${props.draft.displayName} · task editor`}
      skipFilter
      options={[
        {
          title: "Save task",
          value: "save",
          category: "Action",
          description:
            "Saves the definition; unresolved references appear as Needs attention",
        },
        {
          title: `Name: ${props.draft.displayName}`,
          value: "name",
          category: "Definition",
        },
        {
          title: `Flow: ${props.draft.flowID}`,
          value: "flow",
          category: "Definition",
        },
        {
          title: `Profile: ${props.draft.permissionProfile}`,
          value: "profile",
          category: "Definition",
        },
        { title: `Schedule: ${props.draft.schedule}`, value: "schedule" },
        {
          title: "Instructions",
          value: "prompt",
          description: props.draft.prompt,
        },
        {
          title: `Retry: ${props.draft.retry.replace(/_/gu, " ")}`,
          value: "retry",
        },
        {
          title: `Alerts: ${
            props.draft.alerts
              .map((alert) =>
                typeof alert === "string" ? alert : alert.channel,
              )
              .join(", ") || "none"
          }`,
          value: "alerts",
        },
        {
          title: `Issue target: ${props.draft.issueTarget ?? "none"}`,
          value: "issueTarget",
        },
        {
          title: `Data source: ${props.draft.dataSource ?? "none"}`,
          value: "dataSource",
        },
      ]}
      onSelect={async (option) => {
        if (option.value === "save") {
          try {
            await props.save(
              taskDocumentForEditor(props.draft),
              props.draft.path,
            );
            await props.reload();
            props.notify({
              ok: true,
              message: `Saved ${props.draft.displayName}`,
            });
            dialog.pop();
          } catch (error) {
            props.notify({
              ok: false,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          return;
        }
        if (
          option.value === "name" ||
          option.value === "flow" ||
          option.value === "profile" ||
          option.value === "schedule" ||
          option.value === "prompt" ||
          option.value === "retry" ||
          option.value === "alerts" ||
          option.value === "issueTarget" ||
          option.value === "dataSource"
        )
          advance(props.draft, option.value);
      }}
    />
  );
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
  flows?: FlowOverview;
  config?: ConfigV2;
  workspaceRoot: string;
  /** Refreshes the caller's overview after a task ran. */
  reload?: () => Promise<void>;
  loadTask?: (path: string) => Promise<NataliaTaskDocument>;
  saveTask?: (
    document: NataliaTaskDocumentInput,
    path: string,
  ) => Promise<void>;
  deleteTask?: (path: string) => Promise<void>;
  runTask?: (taskPath: string) => Promise<TaskRunOutcome>;
  notify?: (outcome: TaskRunOutcome) => void;
}) {
  const dialog = useDialog();
  const canEdit = Boolean(
    props.flows &&
      props.config &&
      props.loadTask &&
      props.saveTask &&
      props.reload,
  );
  return (
    <DialogSelect
      title="Scheduled Tasks"
      placeholder="Search tasks"
      options={buildScheduledTaskOptions(props.overview, {
        canCreate: canEdit,
      })}
      emptyView={<text>No task documents under .natalia/tasks.</text>}
      onSelect={(option) => {
        if (option.value === "$create") {
          if (
            !props.flows ||
            !props.config ||
            !props.saveTask ||
            !props.reload
          ) {
            props.notify?.({
              ok: false,
              message: "Task editing is not available in this workspace",
            });
            return;
          }
          dialog.push(() => (
            <TaskEditor
              draft={newTaskDraft()}
              flows={props.flows!}
              config={props.config!}
              save={props.saveTask!}
              reload={props.reload!}
              notify={(outcome) => props.notify?.(outcome)}
            />
          ));
          return;
        }
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
              if (detail.value === "edit") {
                if (
                  !props.flows ||
                  !props.config ||
                  !props.loadTask ||
                  !props.saveTask ||
                  !props.reload
                ) {
                  props.notify?.({
                    ok: false,
                    message: "Task editing is not available in this workspace",
                  });
                  return;
                }
                try {
                  const document = await props.loadTask(task.path);
                  dialog.pop();
                  dialog.push(() => (
                    <TaskEditor
                      draft={draftFromTask({ path: task.path, task: document })}
                      flows={props.flows!}
                      config={props.config!}
                      save={props.saveTask!}
                      reload={props.reload!}
                      notify={(outcome) => props.notify?.(outcome)}
                    />
                  ));
                } catch (error) {
                  props.notify?.({
                    ok: false,
                    message:
                      error instanceof Error ? error.message : String(error),
                  });
                }
                return;
              }
              if (detail.value === "delete") {
                if (!props.deleteTask || !props.reload) {
                  props.notify?.({
                    ok: false,
                    message: "Task deletion is not available in this workspace",
                  });
                  return;
                }
                dialog.push(() => (
                  <DialogConfirm
                    title="Delete task definition?"
                    message={`Delete ${task.displayName} (${task.path})? Execution history and audit state will remain.`}
                    label="keep task"
                    defaultChoice="cancel"
                    onConfirm={() => {
                      void (async () => {
                        try {
                          await props.deleteTask!(task.path);
                          await props.reload!();
                          dialog.pop();
                          props.notify?.({
                            ok: true,
                            message: `Deleted ${task.displayName}`,
                          });
                        } catch (error) {
                          props.notify?.({
                            ok: false,
                            message:
                              error instanceof Error
                                ? error.message
                                : String(error),
                          });
                        }
                      })();
                    }}
                  />
                ));
                return;
              }
              if (detail.value === "problems") {
                dialog.push(() => <TaskProblemDetail task={task} />);
                return;
              }
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
