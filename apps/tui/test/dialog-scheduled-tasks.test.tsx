import { expect, test } from "bun:test";
import { onMount } from "solid-js";
import { createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import { KeymapProvider } from "@opentui/keymap/solid";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import type { ScheduledTaskOverview, ScheduledTaskRow } from "@natalia/client";
import {
  buildScheduledTaskDetail,
  buildScheduledTaskOptions,
  DialogScheduledTasks,
  scheduledTaskSummary,
} from "../src/component/DialogScheduledTasks";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

/**
 * The dialog is presented by the provider's own stack, so the harness pushes it
 * the way the settings menu does instead of rendering it as a child.
 */
async function mountScheduledTasks(overview: ScheduledTaskOverview) {
  const setup = await createTestRenderer({ width: 100, height: 28 });
  const keymap = createDefaultOpenTuiKeymap(setup.renderer);
  const disposeKeymap = registerNataliaKeymap(keymap, setup.renderer);
  function Harness() {
    const dialog = useDialog();
    onMount(() =>
      dialog.push(() => <DialogScheduledTasks overview={overview} />),
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
  return {
    frame: () => setup.captureCharFrame(),
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
  expect(scheduledTaskSummary(row())).toBe(
    "daily 02:15 · unattended_read · 3 stages · never run",
  );
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
  ).toBe(
    "daily 02:15 · unattended_read · 1 stage · last stalled · 2 failures in a row · 1 alerts pending",
  );
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
  ).toContain("last skipped_due_to_overlap (overlap)");
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
    "Flow: flow_log_triage",
    "Profile: unattended_read · retry once",
    "Alerts: journal",
    "Source: app_log",
    "Issues: project_issues",
    "Last run: succeeded at 2026-08-05T02:15:00.000Z",
    "Problem: permission profile must use auto approval: interactive",
  ]);
  expect(detail.at(-1)!.category).toBe("Needs attention");
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

test("an empty workspace says so instead of rendering an empty list", async () => {
  const mounted = await mountScheduledTasks({ tasks: [], unreadable: [] });
  try {
    expect(mounted.frame()).toContain("No task documents");
  } finally {
    mounted.dispose();
  }
});
