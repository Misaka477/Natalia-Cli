import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configV2Schema, type ConfigV2 } from "@natalia/contracts";
import { NataliaTaskStateStore } from "@natalia/workflow";
import { flowOverview, scheduledTaskOverview } from "../src";

const READY_FLOW =
  "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n";

function config(overrides: Record<string, unknown> = {}): ConfigV2 {
  return configV2Schema.parse({
    version: 2,
    permissionProfiles: {
      unattended: { approval: "auto", description: "Task profile" },
      interactive: { approval: "ask", description: "Interactive" },
    },
    alertChannels: { journal: { kind: "journal" } },
    ...overrides,
  });
}

async function workspace(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(join(root, ".natalia", "flows", "review.yaml"), READY_FLOW);
  return root;
}

function taskYAML(extra = "") {
  return `kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Do it.\npermissionProfile: unattended\nalerts:\n  - journal\n${extra}flow:\n  flowID: flow_review\n`;
}

test("an empty workspace has no scheduled tasks and no problems", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-overview-empty-"));
  expect(
    await scheduledTaskOverview({ workspaceRoot: root, config: config() }),
  ).toEqual({ tasks: [], unreadable: [] });
});

test("a ready task is listed with its configuration and no problems", async () => {
  const root = await workspace("natalia-overview-ready-");
  await writeFile(join(root, ".natalia", "tasks", "nightly.yaml"), taskYAML());
  const overview = await scheduledTaskOverview({
    workspaceRoot: root,
    config: config(),
  });
  expect(overview.unreadable).toEqual([]);
  expect(overview.tasks).toHaveLength(1);
  expect(overview.tasks[0]).toMatchObject({
    taskID: "task_nightly",
    displayName: "Nightly",
    path: "nightly.yaml",
    schedule: "daily 01:00",
    permissionProfile: "unattended",
    flowID: "flow_review",
    enabledModules: 1,
    retry: "none",
    alertChannels: ["journal"],
    consecutiveFailures: 0,
    pendingAlertDeliveries: 0,
    problems: [],
  });
  expect(overview.tasks[0]!.lastRun).toBeUndefined();
});

test("the last run and failure count come from durable state", async () => {
  const root = await workspace("natalia-overview-history-");
  await writeFile(join(root, ".natalia", "tasks", "nightly.yaml"), taskYAML());
  const state = await NataliaTaskStateStore.open(root);
  state.startInvocation({
    invocationID: "inv_1",
    taskID: "task_nightly",
    episodeID: "epi_1" as never,
    sessionID: "ses_1" as never,
    at: "2026-08-01T01:00:00.000Z",
  });
  state.completeAttempt({
    invocationID: "inv_1",
    attempt: 1,
    status: "blocked",
    retry: false,
    reason: "module blocked",
    at: "2026-08-01T01:05:00.000Z",
  });
  state.close();
  const overview = await scheduledTaskOverview({
    workspaceRoot: root,
    config: config(),
  });
  expect(overview.tasks[0]!.lastRun).toMatchObject({
    invocationID: "inv_1",
    status: "blocked",
    startedAt: "2026-08-01T01:00:00.000Z",
  });
});

test("every kind of broken reference is reported per task, not thrown", async () => {
  const root = await workspace("natalia-overview-problems-");
  await writeFile(
    join(root, ".natalia", "tasks", "a-missing-profile.yaml"),
    taskYAML().replace(
      "permissionProfile: unattended",
      "permissionProfile: absent",
    ),
  );
  await writeFile(
    join(root, ".natalia", "tasks", "b-interactive.yaml"),
    taskYAML().replace(
      "permissionProfile: unattended",
      "permissionProfile: interactive",
    ),
  );
  await writeFile(
    join(root, ".natalia", "tasks", "c-missing-channel.yaml"),
    taskYAML().replace("  - journal", "  - absent"),
  );
  await writeFile(
    join(root, ".natalia", "tasks", "d-missing-target.yaml"),
    taskYAML("issueTarget: absent\n"),
  );
  const overview = await scheduledTaskOverview({
    workspaceRoot: root,
    config: config(),
  });
  expect(overview.tasks).toHaveLength(4);
  expect(overview.tasks.map((task) => task.problems[0])).toEqual([
    "permission profile not found: absent",
    "permission profile must use auto approval: interactive",
    "alert channel not found: absent",
    "issue target not found: absent",
  ]);
});

test("a stage the profile cannot run and a conditionless stage are reported", async () => {
  const root = await workspace("natalia-overview-blocked-");
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: term\n    type: terminal\n    displayName: Terminal\n    minimumConditions:\n      - id: c1\n        text: Check the tree\n  - id: vague\n    type: read_search\n    displayName: Vague\n",
  );
  await writeFile(join(root, ".natalia", "tasks", "nightly.yaml"), taskYAML());
  const overview = await scheduledTaskOverview({
    workspaceRoot: root,
    config: config({
      permissionProfiles: {
        unattended: {
          approval: "auto",
          description: "Reads only",
          permissions: { tools: { allow: ["read_file", "glob", "grep"] } },
        },
      },
    }),
  });
  expect(overview.tasks[0]!.problems).toEqual([
    "stage has no minimum completion condition: vague",
    expect.stringContaining("term: the terminal module has no usable tool"),
  ]);
});

test("an unreadable task document does not hide the rest of the list", async () => {
  const root = await workspace("natalia-overview-unreadable-");
  await writeFile(join(root, ".natalia", "tasks", "good.yaml"), taskYAML());
  await writeFile(
    join(root, ".natalia", "tasks", "broken.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: \n",
  );
  const overview = await scheduledTaskOverview({
    workspaceRoot: root,
    config: config(),
  });
  expect(overview.tasks.map((task) => task.taskID)).toEqual(["task_nightly"]);
  expect(overview.unreadable).toHaveLength(1);
  expect(overview.unreadable[0]!.path).toBe("broken.yaml");
});

test("a task whose flow is missing is listed with the reason", async () => {
  const root = await workspace("natalia-overview-flowless-");
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    taskYAML().replace("flowID: flow_review", "flowID: flow_absent"),
  );
  const overview = await scheduledTaskOverview({
    workspaceRoot: root,
    config: config(),
  });
  expect(overview.unreadable).toEqual([]);
  expect(overview.tasks).toHaveLength(1);
  expect(overview.tasks[0]).toMatchObject({
    taskID: "task_nightly",
    enabledModules: 0,
    problems: [expect.stringContaining("natalia flow not found")],
  });
});

test("the flow overview reports stages, who uses them, and what is wrong", async () => {
  const root = await workspace("natalia-flow-overview-");
  await writeFile(
    join(root, ".natalia", "flows", "empty.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_empty\ndisplayName: Empty\nmodules:\n  - id: off\n    type: read_search\n    displayName: Off\n    enabled: false\n    minimumConditions:\n      - id: c1\n        text: Read\n",
  );
  await writeFile(
    join(root, ".natalia", "flows", "vague.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_vague\ndisplayName: Vague\nmodules:\n  - id: gate\n    type: shell_command\n    displayName: Gate\n    commandRules:\n      mode: whitelist\n      rules:\n        - command: npm run test\n",
  );
  await writeFile(join(root, ".natalia", "tasks", "nightly.yaml"), taskYAML());
  const overview = await flowOverview({ workspaceRoot: root });
  const byID = new Map(overview.flows.map((flow) => [flow.flowID, flow]));
  expect(byID.get("flow_review")).toMatchObject({
    enabledStages: 1,
    usedBy: ["task_nightly"],
    problems: [],
  });
  // A flow with every stage disabled can never complete, and a flow nothing
  // references is reported as unused rather than silently fine.
  expect(byID.get("flow_empty")).toMatchObject({
    enabledStages: 0,
    usedBy: [],
    problems: ["no stage is enabled, so the flow can never complete"],
  });
  expect(byID.get("flow_vague")!.problems).toEqual([
    "stage has no minimum completion condition: gate",
  ]);
  expect(byID.get("flow_vague")!.stages[0]).toMatchObject({
    moduleType: "shell_command",
    commandRules: { mode: "whitelist", commands: 1 },
    hasInstructions: false,
  });
});
