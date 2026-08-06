import { expect, test } from "bun:test";
import { createSignal, onMount } from "solid-js";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import {
  configV2Schema,
  type ConfigV2,
  type NataliaTaskDocument,
  type NataliaTaskDocumentInput,
} from "@natalia/contracts";
import type {
  FlowOverview,
  ScheduledTaskOverview,
  ScheduledTaskRow,
} from "@natalia/client";
import {
  buildScheduledTaskDetail,
  buildScheduledTaskOptions,
  buildTaskPermissionPreviewOptions,
  DialogScheduledTasks,
  readTaskRunOutcome,
  scheduledTaskSummary,
  taskDocumentForEditor,
  taskRunCommand,
  workflowRunCommand,
  type ScheduledTaskPermissionPreview,
  type TaskRunOutcome,
} from "../src/component/DialogScheduledTasks";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

/**
 * The dialog is presented by the provider's own stack, so the harness pushes it
 * the way the settings menu does instead of rendering it as a child.
 */
async function mountScheduledTasks(
  overview: ScheduledTaskOverview,
  extra: Partial<{
    runTask: (taskPath: string) => Promise<TaskRunOutcome>;
    next: ScheduledTaskOverview;
    notify: (outcome: TaskRunOutcome) => void;
    flows: FlowOverview;
    config: ConfigV2;
    loadTask: (path: string) => Promise<NataliaTaskDocument>;
    saveTask: (
      document: NataliaTaskDocumentInput,
      path: string,
    ) => Promise<void>;
    deleteTask: (path: string) => Promise<void>;
    previewPermissions: (
      path: string,
    ) => Promise<ScheduledTaskPermissionPreview>;
    previewCalendar: (calendar: string) => Promise<{ next: string[] }>;
    configureSystemd: (input: {
      path: string;
      calendar: string;
      scope: "user" | "system";
    }) => Promise<{ commands: string[] }>;
    removeSystemd: (path: string) => Promise<{ commands: string[] }>;
  }> = {},
) {
  const setup = await createTestRenderer({ width: 160, height: 36 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  // The caller owns the overview, the way the settings menu does.
  const [current, setCurrent] = createSignal(overview);
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => (
        <DialogScheduledTasks
          overview={current()}
          flows={extra.flows}
          config={extra.config}
          workspaceRoot="/tmp/natalia-demo"
          runTask={extra.runTask}
          loadTask={extra.loadTask}
          saveTask={extra.saveTask}
          deleteTask={extra.deleteTask}
          previewPermissions={extra.previewPermissions}
          previewCalendar={
            extra.previewCalendar ??
            (async () => ({
              next: ["first run", "second run", "third run"],
            }))
          }
          configureSystemd={extra.configureSystemd}
          removeSystemd={extra.removeSystemd}
          notify={extra.notify}
          reload={async () => {
            if (extra.next) setCurrent(extra.next);
          }}
        />
      )),
    );
    return null;
  }
  await render(
    () => (
      <KeymapProvider keymap={keymap}>
        <DialogProvider>
          <Harness />
        </DialogProvider>
      </KeymapProvider>
    ),
    setup.renderer,
  );
  await setup.renderOnce();
  const keys = createMockKeys(setup.renderer, { kittyKeyboard: true });
  return {
    frame: () => setup.captureCharFrame(),
    /** Activates the highlighted row the way a person pressing Enter does. */
    async selectFirst() {
      keys.pressEnter();
      await Bun.sleep(30);
      await setup.renderOnce();
    },
    async down() {
      keys.pressArrow("down");
      await Bun.sleep(15);
      await setup.renderOnce();
    },
    async right() {
      keys.pressArrow("right");
      await Bun.sleep(15);
      await setup.renderOnce();
    },
    async typeAndSubmit(text: string) {
      await keys.typeText(text);
      keys.pressEnter();
      await Bun.sleep(30);
      await setup.renderOnce();
    },
    dispose() {
      disposeKeymap();
      setup.renderer.destroy();
    },
  };
}

function editorConfig(): ConfigV2 {
  return configV2Schema.parse({
    version: 2,
    permissionProfiles: {
      unattended: { approval: "auto", description: "Task profile" },
    },
    alertChannels: {
      journal: { kind: "journal" },
    },
    issueTargets: {
      project_issues: {
        kind: "gitea",
        baseURL: "https://forge.example.test",
        owner: "team",
        repo: "project",
      },
    },
    dataSources: {
      audit_stream: { path: "audit.jsonl", kind: "offset" },
    },
  });
}

function editorFlows(): FlowOverview {
  return {
    flows: [
      {
        flowID: "flow_review",
        displayName: "Review flow",
        path: "review.yaml",
        stages: [],
        enabledStages: 1,
        usedBy: [],
        problems: [],
      },
    ],
    unreadable: [],
  };
}

function row(overrides: Partial<ScheduledTaskRow> = {}): ScheduledTaskRow {
  return {
    taskID: "task_nightly",
    displayName: "Nightly log triage",
    path: "nightly.yaml",
    schedule: "daily 02:15",
    permissionProfile: "unattended_read",
    flowID: "flow_log_triage",
    enabledModules: 3,
    retry: "once",
    alertChannels: ["journal"],
    alertEvents: ["journal:ultimately_failed", "journal:blocked_by_policy"],
    consecutiveFailures: 0,
    pendingAlertDeliveries: 0,
    problems: [],
    ...overrides,
  };
}

function permissionPreview(): ScheduledTaskPermissionPreview {
  return {
    taskID: "task_nightly",
    permissionProfile: "unattended_read",
    flowID: "flow_log_triage",
    blocked: [
      {
        moduleID: "read_source",
        reason: "profile denies the required shell capability",
      },
    ],
    modules: [
      {
        moduleID: "read_source",
        moduleType: "read_search",
        displayName: "Read source",
        enabled: true,
        tools: {
          allowed: ["read_file", "read_data_source", "flow_module_complete"],
          denied: ["run_shell"],
        },
        commandRules: {
          profile: { mode: "whitelist", commands: ["git status"] },
          module: { mode: "whitelist", commands: ["git status --short"] },
        },
        interactivePrograms: ["vim"],
        extensions: { skills: false, mcp: false, plugins: false },
        profilePathRules: {
          read: ["allow **"],
          write: ["deny secrets/**"],
        },
        pathRules: {
          read: ["allow src/**", "deny secrets/**"],
          write: ["deny **"],
        },
        blocked: "profile denies the required shell capability",
      },
    ],
  };
}

test("a ready task summarizes its cadence, profile, stages and last result", () => {
  expect(scheduledTaskSummary(row())).toBe("daily 02:15 · never run");
  expect(
    scheduledTaskSummary(
      row({
        enabledModules: 1,
        consecutiveFailures: 2,
        pendingAlertDeliveries: 1,
        lastRun: {
          invocationID: "inv_1",
          status: "stalled",
          startedAt: "2026-08-05T02:15:00.000Z",
        },
      }),
    ),
  ).toBe("daily 02:15 · last stalled · 2 failures in a row");
  // An overlapping trigger is a skip, not a result of doing the work.
  expect(
    scheduledTaskSummary(
      row({
        lastRun: {
          invocationID: "inv_2",
          status: "skipped_due_to_overlap",
          startedAt: "2026-08-05T02:15:00.000Z",
          skipReason: "inv_1 is still running",
        },
      }),
    ),
  ).toContain("last skipped (overlap)");
});

test("a generated timer shows its next run and must be removed before task deletion", () => {
  const detail = buildScheduledTaskDetail(
    row({
      systemd: {
        calendar: "*-*-* 02:15:00",
        scope: "user",
        timerUnit: "natalia-task-task_nightly.timer",
        nextRun: "2026-08-07T02:15:00.000Z",
      },
    }),
  );
  expect(detail.map((entry) => entry.title)).toContain(
    "Timer: natalia-task-task_nightly.timer",
  );
  expect(detail.map((entry) => entry.title)).toContain(
    "Next run: 2026-08-07T02:15:00.000Z",
  );
  expect(detail.find((entry) => entry.value === "delete")).toMatchObject({
    disabled: true,
  });
  expect(detail.find((entry) => entry.value === "removeTimer")).toBeDefined();
});

test("the editor builds a versioned task document without deriving identity from its name", () => {
  expect(
    taskDocumentForEditor({
      taskID: "task_immutable",
      displayName: "Renamed every week ",
      schedule: " daily 02:15 ",
      prompt: " Review the selected flow. ",
      flowID: "flow_review",
      flowPath: ".natalia/flows/review.yaml",
      permissionProfile: "unattended",
      retry: "once",
      alerts: ["journal", "ops"],
    }),
  ).toEqual({
    kind: "natalia-task",
    version: 1,
    taskID: "task_immutable",
    displayName: "Renamed every week",
    schedule: "daily 02:15",
    prompt: "Review the selected flow.",
    permissionProfile: "unattended",
    flow: { flowID: "flow_review", path: ".natalia/flows/review.yaml" },
    retry: "once",
    alerts: ["journal", "ops"],
  });
});

test("a task that would refuse to run is grouped apart and counted", () => {
  const options = buildScheduledTaskOptions({
    tasks: [
      row(),
      row({
        taskID: "task_broken",
        displayName: "Broken",
        path: "broken.yaml",
        problems: [
          "alert channel not found: absent",
          "report: the report_output module has no usable tool",
        ],
      }),
    ],
    unreadable: [{ path: "torn.yaml", reason: "natalia flow not found:\n  x" }],
  });
  expect(options.map((option) => [option.category, option.title])).toEqual([
    ["Ready", "Nightly log triage"],
    ["Needs attention", "Broken"],
    ["Unreadable", "torn.yaml"],
  ]);
  expect(options[1]!.footer).toBe("2 problems");
  // Alert pressure uses the footer too, where it is not competing for width.
  expect(
    buildScheduledTaskOptions({
      tasks: [row({ pendingAlertDeliveries: 3 })],
      unreadable: [],
    })[0]!.footer,
  ).toBe("3 alerts pending");
  // An unreadable document cannot be opened, and its reason stays on one line.
  expect(options[2]).toMatchObject({
    disabled: true,
    description: "natalia flow not found: x",
  });
});

test("the task list exposes example installation as an in-product action", () => {
  expect(
    buildScheduledTaskOptions(
      { tasks: [], unreadable: [] },
      { canInstallExamples: true },
    ),
  ).toContainEqual({
    title: "Install example tasks",
    value: "$examples",
    category: "Action",
    description: "Add code quality, log triage, and release notes",
  });
});

test("the detail view lists every problem verbatim instead of a summary", () => {
  const detail = buildScheduledTaskDetail(
    row({
      dataSource: "app_log",
      issueTarget: "project_issues",
      problems: ["permission profile must use auto approval: interactive"],
      lastRun: {
        invocationID: "inv_1",
        status: "succeeded",
        startedAt: "2026-08-05T02:15:00.000Z",
      },
    }),
  );
  expect(detail.map((entry) => entry.title)).toEqual([
    // A task with a problem cannot be run from here at all.
    "Run now (blocked)",
    "Edit task",
    "Install timer",
    "Delete task",
    "Preview effective permissions",
    "Flow: flow_log_triage",
    "Profile: unattended_read · retry once",
    "Alerts: journal",
    "Source: app_log",
    "Issues: project_issues",
    "Last run: succeeded at 2026-08-05T02:15:00.000Z",
    "Problem: permission profile must use auto approval: interactive",
  ]);
  expect(detail.at(-1)!.category).toBe("Needs attention");
  expect(detail[0]).toMatchObject({ value: "run", disabled: true });
  // With nothing wrong the same action is offered normally.
  expect(buildScheduledTaskDetail(row())[0]).toMatchObject({
    title: "Run now",
    value: "run",
    disabled: false,
  });
});

test("task permission preview shows task capabilities and every policy layer", () => {
  const options = buildTaskPermissionPreviewOptions(permissionPreview());
  expect(options.map((option) => option.title)).toEqual([
    "Profile: unattended_read",
    "1. Read source",
    "Allowed: read_file, read_data_source, flow_module_complete",
    "Denied: run_shell",
    "Profile commands (whitelist): git status",
    "Module commands (whitelist): git status --short",
    "Extensions: skills=off, mcp=off, plugins=off",
    "Interactive programs: vim",
    "Profile read paths: allow **",
    "Profile write paths: deny secrets/**",
    "Read paths: allow src/**, deny secrets/**",
    "Write paths: deny **",
  ]);
  expect(options[1]).toMatchObject({
    category: "Blocked",
    description: "profile denies the required shell capability",
  });
});

test("the scheduled tasks dialog renders the tasks and their problems", async () => {
  const overview: ScheduledTaskOverview = {
    tasks: [
      row(),
      row({
        taskID: "task_broken",
        displayName: "Weekly review",
        path: "weekly.yaml",
        problems: ["alert channel not found: absent"],
      }),
    ],
    unreadable: [],
  };
  const mounted = await mountScheduledTasks(overview);
  try {
    const frame = mounted.frame();
    expect(frame).toContain("Scheduled Tasks");
    expect(frame).toContain("Nightly log triage");
    expect(frame).toContain("Weekly review");
    // The operator must be able to see that one task is not runnable without
    // opening it.
    expect(frame).toContain("Needs attention");
    expect(frame).toContain("1 problem");
  } finally {
    mounted.dispose();
  }
});

test("a long task problem opens in a wrapped detail view", async () => {
  const problem =
    "flow reference must stay under .natalia/flows: log-triage.yaml and this deliberately long suffix must remain visible";
  const mounted = await mountScheduledTasks({
    tasks: [row({ problems: [problem] })],
    unreadable: [],
  });
  try {
    await mounted.selectFirst();
    for (let index = 0; index < 7; index++) await mounted.down();
    await mounted.selectFirst();
    const frame = mounted.frame();
    expect(frame).toContain("Task problems");
    expect(frame).toContain("flow reference must stay under .natalia/flows");
    expect(frame).toContain("remain visible");
  } finally {
    mounted.dispose();
  }
});

test("the task detail opens the complete effective permission preview", async () => {
  const calls: string[] = [];
  const mounted = await mountScheduledTasks(
    { tasks: [row()], unreadable: [] },
    {
      previewPermissions: async (path) => {
        calls.push(path);
        return permissionPreview();
      },
    },
  );
  try {
    await mounted.selectFirst();
    await mounted.down();
    await mounted.down();
    await mounted.down();
    await mounted.selectFirst();
    expect(calls).toEqual(["nightly.yaml"]);
    expect(mounted.frame()).toContain("Effective Permissions");
    expect(mounted.frame()).toContain("read_data_source");
    for (let index = 0; index < 11; index++) await mounted.down();
    expect(mounted.frame()).toContain("Workspace path scope");
    expect(mounted.frame()).toContain("deny secrets/**");
  } finally {
    mounted.dispose();
  }
});

test("an empty workspace says so, aligned with the rest of the dialog", async () => {
  const mounted = await mountScheduledTasks({ tasks: [], unreadable: [] });
  try {
    const frame = mounted.frame();
    expect(frame).toContain("No task documents");
    // DialogSelect owns the inset. An empty state that hangs off the dialog's
    // left edge is what a workspace without tasks used to look like, in every
    // dialog that passes its own empty view.
    const indent = (needle: string) => {
      const line = frame
        .split("\n")
        .find((candidate) => candidate.includes(needle))!;
      return line.length - line.trimStart().length;
    };
    expect(indent("No task documents")).toBe(indent("Scheduled Tasks"));
  } finally {
    mounted.dispose();
  }
});

test("a manual run uses the same command a timer would", () => {
  expect(
    taskRunCommand({
      execPath: "/usr/bin/bun",
      taskPath: "nightly.yaml",
      workspaceRoot: "/srv/workspace",
      cliEntry: "/opt/natalia/apps/cli/src/main.ts",
    }),
  ).toEqual([
    "/usr/bin/bun",
    "/opt/natalia/apps/cli/src/main.ts",
    "task",
    "run",
    "nightly.yaml",
    "--workspace",
    "/srv/workspace",
    "--json",
  ]);
  // Without a source checkout the installed command is used instead.
  expect(
    taskRunCommand({
      execPath: "/usr/bin/bun",
      taskPath: "nightly.yaml",
      workspaceRoot: "/srv/workspace",
    })[0],
  ).toBe("natalia-ts");
});

test("workflow run commands distinguish direct flow runs", () => {
  expect(
    workflowRunCommand({
      kind: "flow",
      execPath: "/usr/bin/bun",
      cliEntry: "/repo/apps/cli/src/main.ts",
      path: "review.yaml",
      workspaceRoot: "/workspace",
    }),
  ).toEqual([
    "/usr/bin/bun",
    "/repo/apps/cli/src/main.ts",
    "flow",
    "run",
    "review.yaml",
    "--workspace",
    "/workspace",
    "--json",
  ]);
});

test("the run result comes from the task's own terminal status", () => {
  const run = (status: string) =>
    readTaskRunOutcome({
      exitCode: 0,
      stdout: `{"type":"session.created"}\n{"type":"task.invocation","status":"${status}"}\n`,
      stderr: "",
    });
  expect(run("succeeded")).toMatchObject({
    ok: true,
    message: "Task succeeded",
  });
  // An overlap skip is not a failure, and a stalled run is not a success.
  expect(run("skipped_due_to_overlap")).toMatchObject({
    ok: true,
    message: "Skipped: the previous run is still going",
  });
  expect(run("stalled")).toMatchObject({ ok: false, message: "Task stalled" });
  expect(run("blocked")).toMatchObject({ ok: false, message: "Task blocked" });
  // A run that never reported a status is a failure with the reason it printed.
  expect(
    readTaskRunOutcome({
      exitCode: 1,
      stdout: "",
      stderr: "error: task permission profile not found: absent\n",
    }),
  ).toEqual({
    ok: false,
    message: "error: task permission profile not found: absent",
  });
});

test("running a task from the detail view reports and refreshes", async () => {
  const ran: string[] = [];
  const notices: TaskRunOutcome[] = [];
  const after: ScheduledTaskOverview = {
    tasks: [
      row({
        lastRun: {
          invocationID: "inv_2",
          status: "succeeded",
          startedAt: "2026-08-06T09:00:00.000Z",
        },
      }),
    ],
    unreadable: [],
  };
  const mounted = await mountScheduledTasks(
    { tasks: [row()], unreadable: [] },
    {
      runTask: async (taskPath) => {
        ran.push(taskPath);
        return { ok: true, status: "succeeded", message: "Task succeeded" };
      },
      next: after,
      notify: (outcome) => notices.push(outcome),
    },
  );
  try {
    expect(mounted.frame()).toContain("never run");
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Run now");
    await mounted.selectFirst();
    expect(ran).toEqual(["nightly.yaml"]);
    // The operator is told it started and how it ended, and the list then shows
    // the new result instead of the stale one.
    expect(notices.map((notice) => notice.message)).toEqual([
      "Running Nightly log triage…",
      "Task succeeded",
    ]);
    expect(mounted.frame()).toContain("last succeeded");
  } finally {
    mounted.dispose();
  }
});

test("a task can be created through the keyboard wizard and returns to the refreshed list", async () => {
  const saved: Array<{ document: NataliaTaskDocumentInput; path: string }> = [];
  const notices: TaskRunOutcome[] = [];
  const after: ScheduledTaskOverview = {
    tasks: [
      row({
        taskID: "task_created",
        displayName: "Weekly dependency review",
        path: "task_created.yaml",
        flowID: "flow_review",
        permissionProfile: "unattended",
        schedule: "weekly Mon 03:00",
        retry: "none",
      }),
    ],
    unreadable: [],
  };
  const mounted = await mountScheduledTasks(
    { tasks: [], unreadable: [] },
    {
      flows: editorFlows(),
      config: editorConfig(),
      loadTask: async () => {
        throw new Error("not used while creating");
      },
      saveTask: async (document, path) => {
        saved.push({ document, path });
      },
      next: after,
      notify: (outcome) => notices.push(outcome),
    },
  );
  try {
    expect(mounted.frame()).toContain("Create task");
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Task name");
    await mounted.typeAndSubmit("Weekly dependency review");
    expect(mounted.frame()).toContain("Choose flow");
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Choose permission profile");
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Schedule");
    await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Weekday");
    await mounted.selectFirst();
    await mounted.typeAndSubmit("03:00");
    expect(mounted.frame()).toContain("Next three runs");
    expect(mounted.frame()).toContain("third run");
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Task instructions");
    await mounted.typeAndSubmit(
      "Review dependency updates and write the configured output.",
    );
    expect(mounted.frame()).toContain("Save task");
    // Alerts is the eighth summary row. Adding a channel writes the bare form,
    // whose conservative event policy is normalized by the shared runtime.
    for (let index = 0; index < 7; index++) await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Add journal");
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Alerts: journal");
    for (let index = 0; index < 8; index++) await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Issue target");
    await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Issue target: project_issues");
    for (let index = 0; index < 9; index++) await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Data source");
    await mounted.down();
    await mounted.selectFirst();
    await mounted.selectFirst();

    expect(saved).toHaveLength(1);
    expect(saved[0]!.path).toMatch(/^task_[a-f0-9]{32}\.yaml$/u);
    expect(saved[0]!.document).toMatchObject({
      kind: "natalia-task",
      taskID: expect.stringMatching(/^task_[a-f0-9]{32}$/u),
      displayName: "Weekly dependency review",
      schedule: "weekly Mon 03:00",
      permissionProfile: "unattended",
      flow: {
        flowID: "flow_review",
        path: ".natalia/flows/review.yaml",
      },
      retry: "none",
      alerts: ["journal"],
      issueTarget: "project_issues",
      dataSource: "audit_stream",
      systemd: {
        calendar: "Mon *-*-* 03:00:00",
        scope: "user",
      },
    });
    expect(notices).toEqual([
      { ok: true, message: "Saved Weekly dependency review" },
    ]);
    expect(mounted.frame()).toContain("Weekly dependency review");
  } finally {
    mounted.dispose();
  }
});

test("editing preserves task identity and structured alert subscriptions", async () => {
  const saved: Array<{ document: NataliaTaskDocumentInput; path: string }> = [];
  const task: NataliaTaskDocument = {
    kind: "natalia-task",
    version: 1,
    taskID: "task_stable",
    displayName: "Existing review",
    schedule: "daily 01:00",
    prompt: "Review the selected workspace slice.",
    permissionProfile: "unattended",
    flow: {
      flowID: "flow_review",
      path: ".natalia/flows/review.yaml",
    },
    retry: "once",
    alerts: [
      {
        channel: "ops",
        on: ["attempt_failed", "succeeded"],
      },
    ],
    issueTarget: "project_issues",
    dataSource: "audit_stream",
    evaluator: { provider: "local", model: "evaluator" },
    evaluatorConsent: {
      provider: "local",
      confirmedAt: "2026-08-06T00:00:00.000Z",
    },
    systemd: {
      calendar: "*-*-* 01:00:00",
      scope: "user",
      timerUnit: "natalia-task-task_stable.timer",
      generatedCalendar: "*-*-* 01:00:00",
    },
  };
  const mounted = await mountScheduledTasks(
    {
      tasks: [
        row({
          taskID: task.taskID,
          displayName: task.displayName,
          path: "existing.yaml",
          flowID: "flow_review",
          permissionProfile: "unattended",
        }),
      ],
      unreadable: [],
    },
    {
      flows: editorFlows(),
      config: editorConfig(),
      loadTask: async () => task,
      saveTask: async (document, path) => {
        saved.push({ document, path });
      },
      next: {
        tasks: [
          row({
            taskID: task.taskID,
            displayName: task.displayName,
            path: "existing.yaml",
            flowID: "flow_review",
            permissionProfile: "unattended",
          }),
        ],
        unreadable: [],
      },
    },
  );
  try {
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Edit task");
    await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Existing review · task editor");
    for (let index = 0; index < 6; index++) await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Retry policy");
    await mounted.down();
    await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Retry: twice");
    await mounted.selectFirst();
    expect(saved).toEqual([
      {
        path: "existing.yaml",
        document: expect.objectContaining({
          taskID: "task_stable",
          retry: "twice",
          alerts: [
            {
              channel: "ops",
              on: ["attempt_failed", "succeeded"],
            },
          ],
          issueTarget: "project_issues",
          dataSource: "audit_stream",
          evaluator: { provider: "local", model: "evaluator" },
          evaluatorConsent: {
            provider: "local",
            confirmedAt: "2026-08-06T00:00:00.000Z",
          },
          systemd: {
            calendar: "*-*-* 01:00:00",
            scope: "user",
            timerUnit: "natalia-task-task_stable.timer",
            generatedCalendar: "*-*-* 01:00:00",
          },
        }),
      },
    ]);
    expect(mounted.frame()).toContain("Scheduled Tasks");
    expect(mounted.frame()).toContain("Existing review");
  } finally {
    mounted.dispose();
  }
});

test("deleting a task requires confirmation and returns to the refreshed list", async () => {
  const deleted: string[] = [];
  const notices: TaskRunOutcome[] = [];
  const mounted = await mountScheduledTasks(
    { tasks: [row()], unreadable: [] },
    {
      deleteTask: async (path) => {
        deleted.push(path);
      },
      next: { tasks: [], unreadable: [] },
      notify: (outcome) => notices.push(outcome),
    },
  );
  try {
    await mounted.selectFirst();
    await mounted.down();
    await mounted.down();
    await mounted.selectFirst();
    expect(mounted.frame()).toContain("Delete task definition?");
    expect(mounted.frame()).toContain("Execution");
    expect(mounted.frame()).toContain("history and audit state will remain");
    expect(deleted).toEqual([]);
    await mounted.right();
    await mounted.selectFirst();
    expect(deleted).toEqual(["nightly.yaml"]);
    expect(notices).toEqual([
      { ok: true, message: "Deleted Nightly log triage" },
    ]);
    expect(mounted.frame()).toContain("No task documents");
  } finally {
    mounted.dispose();
  }
});

test("a user timer can be updated and removed from the task detail", async () => {
  const configured: unknown[] = [];
  const removed: string[] = [];
  const notices: TaskRunOutcome[] = [];
  const scheduled = row({
    systemd: {
      calendar: "*-*-* 02:15:00",
      scope: "user",
      timerUnit: "natalia-task-task_nightly.timer",
      nextRun: "2026-08-07T02:15:00.000Z",
    },
  });
  const mounted = await mountScheduledTasks(
    { tasks: [scheduled], unreadable: [] },
    {
      configureSystemd: async (input) => {
        configured.push(input);
        return { commands: [] };
      },
      removeSystemd: async (path) => {
        removed.push(path);
        return { commands: [] };
      },
      next: { tasks: [scheduled], unreadable: [] },
      notify: (outcome) => notices.push(outcome),
    },
  );
  try {
    await mounted.selectFirst();
    await mounted.down();
    await mounted.down();
    await mounted.selectFirst();
    expect(configured).toEqual([
      {
        path: "nightly.yaml",
        calendar: "*-*-* 02:15:00",
        scope: "user",
      },
    ]);
    expect(notices.at(-1)).toEqual({
      ok: true,
      message: "Installed timer for Nightly log triage",
    });

    await mounted.selectFirst();
    await mounted.down();
    await mounted.down();
    await mounted.down();
    await mounted.selectFirst();
    expect(removed).toEqual(["nightly.yaml"]);
    expect(notices.at(-1)).toEqual({
      ok: true,
      message: "Removed timer for Nightly log triage",
    });
  } finally {
    mounted.dispose();
  }
});

test("system timer installation shows sudo commands instead of executing them", async () => {
  const scheduled = row({
    systemd: {
      calendar: "Mon *-*-* 03:00:00",
      scope: "system",
      timerUnit: "natalia-task-task_nightly.timer",
    },
  });
  const mounted = await mountScheduledTasks(
    { tasks: [scheduled], unreadable: [] },
    {
      configureSystemd: async () => ({
        commands: [
          "sudo install -m 0644 generated.service /etc/systemd/system/task.service",
          "sudo systemctl enable --now natalia-task-task_nightly.timer",
        ],
      }),
      next: { tasks: [scheduled], unreadable: [] },
    },
  );
  try {
    await mounted.selectFirst();
    await mounted.down();
    await mounted.down();
    await mounted.selectFirst();
    const frame = mounted.frame();
    expect(frame).toContain("Install system timer");
    expect(frame).toContain("Natalia will not invoke sudo");
    expect(frame).toContain("sudo systemctl enable --now");
  } finally {
    mounted.dispose();
  }
});
