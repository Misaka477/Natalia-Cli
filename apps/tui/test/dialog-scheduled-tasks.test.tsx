import { expect, test } from "bun:test";
import { createSignal, onMount } from "solid-js";
import { createMockKeys, createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { ScheduledTaskOverview, ScheduledTaskRow } from "@natalia/client";
import {
  buildScheduledTaskDetail,
  buildScheduledTaskOptions,
  DialogScheduledTasks,
  readTaskRunOutcome,
  scheduledTaskSummary,
  taskRunCommand,
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
          workspaceRoot="/tmp/natalia-demo"
          runTask={extra.runTask}
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
    dispose() {
      disposeKeymap();
      setup.renderer.destroy();
    },
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
    consecutiveFailures: 0,
    pendingAlertDeliveries: 0,
    problems: [],
    ...overrides,
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
