import { expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfigV2, saveConfigFile } from "@natalia/config";
import {
  JsonSessionStore,
  SqliteSessionStore,
  createSessionRecord,
} from "@natalia/session";
import type { RuntimeClient } from "@natalia/contracts";
import { createRuntimeHttpServer } from "@natalia/transport/host";
import {
  deleteLocalSession,
  duplicateLocalSession,
  exportLocalSessionMetadata,
  importLocalSessionMetadata,
  doctorReport,
  listLocalSessions,
  parseAttachmentFlags,
  promptArguments,
  renameLocalSession,
  setLocalSessionPinned,
  sessionTable,
  showLocalSession,
  localWorkGraph,
  workGraphLines,
  workspaceFilesystemCommand,
} from "../src";

test("CLI Work Graph reader projects only safe nodes and edges", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-workgraph-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const session = createSessionRecord("ses_cli_graph", "Graph");
  session.events.push(
    {
      type: "workgraph.node_added",
      id: "node",
      nodeID: "wg:change:turn:file.ts",
      kind: "workspace_change",
      summary: "write_file changed",
      target: "file.ts",
      sessionID: "ses_cli_graph",
    },
    {
      type: "workgraph.edge_added",
      id: "edge",
      sourceID: "wg:tool:turn:call",
      targetID: "wg:change:turn:file.ts",
      kind: "modified",
    },
    {
      type: "tool.update",
      id: "call",
      name: "write_file",
      status: "succeeded",
      summary: "write_file succeeded",
      result: "SECRETFILEBODY",
    },
  );
  await store.save(session);
  const graph = await localWorkGraph("ses_cli_graph", root);
  expect(graph.nodes).toHaveLength(1);
  expect(graph.edges).toHaveLength(1);
  expect(JSON.stringify(graph)).not.toContain("SECRETFILEBODY");
  expect(workGraphLines(graph)).toContain(
    "  modified: wg:tool:turn:call -> wg:change:turn:file.ts",
  );
});

test("CLI task validate resolves a workspace task and flow without running it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the changed files\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Review changes.\npermissionProfile: unattended\nflow:\n  flowID: flow_review\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "nightly.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).toBe(0);
  expect(JSON.parse(new TextDecoder().decode(child.stdout))).toMatchObject({
    status: "valid",
    taskID: "task_nightly",
    flowID: "flow_review",
    modules: 1,
    references: {
      permissionProfile: { key: "unattended", approval: "auto" },
    },
  });
});

test("CLI task validate fails closed for a missing flow", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-missing-"));
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "tasks", "missing.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_missing\ndisplayName: Missing\nschedule: daily 01:00\nprompt: Review changes.\npermissionProfile: unattended\nflow:\n  flowID: flow_missing\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "missing.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain(
    "natalia flow not found",
  );
});

test("CLI flow run requires the profile configured on the flow", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-flow-run-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({ version: 2 }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\ndirectRun:\n  permissionProfile: missing\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "flow",
      "run",
      "review.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain(
    "flow manual run profile not found: missing",
  );
});

test("CLI task run creates a task-scoped episode but never treats turn completion as success", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-run-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
      alertChannels: {
        journal: { kind: "journal" },
        "webhook:ops": { kind: "journal" },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nalerts:\n  - journal\n  - webhook:ops\nflow:\n  flowID: flow_review\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "run-id",
      "task_nightly",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).toBe(0);
  const output = new TextDecoder()
    .decode(child.stdout)
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const invocation = output.find((event) => event.type === "task.invocation");
  expect(invocation).toMatchObject({
    taskID: "task_nightly",
    status: "stalled",
    waterlineAdvanced: false,
  });
  expect(output.some((event) => event.type === "session.created")).toBe(true);
  expect(output.find((event) => event.type === "task.alert")).toMatchObject({
    eventKind: "ultimately_failed",
    status: "stalled",
    attempt: 1,
    enqueued: true,
    channels: 2,
  });
  const alerts = await (
    await import("@natalia/workflow")
  ).NataliaTaskAlertQueue.open(root);
  const queued = alerts.alerts("task_nightly");
  expect(queued).toHaveLength(1);
  expect(queued[0]).toMatchObject({
    invocationID: invocation!.invocationID as string,
    attempt: 1,
    eventKind: "ultimately_failed",
    status: "stalled",
  });
  expect(
    alerts
      .deliveries(queued[0]!.alertID)
      .map((delivery) => [delivery.channel, delivery.state]),
  ).toEqual([
    ["journal", "delivered"],
    ["webhook:ops", "delivered"],
  ]);
  alerts.close();
  expect(output.find((event) => event.type === "task.state")).toMatchObject({
    taskID: "task_nightly",
    consecutiveFailures: 1,
    watermarks: 0,
  });
  // A second unsuccessful run accumulates the failure count and still refuses
  // to advance any cross-execution watermark.
  const second = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "run",
      "nightly.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(second.exitCode).toBe(0);
  const secondOutput = new TextDecoder()
    .decode(second.stdout)
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(
    secondOutput.find((event) => event.type === "task.state"),
  ).toMatchObject({ consecutiveFailures: 2, watermarks: 0 });
  const crossExecutionState = JSON.parse(
    await readFile(
      join(root, ".natalia", "unattended", "task_nightly", "state.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  expect(crossExecutionState).toMatchObject({
    version: 1,
    taskID: "task_nightly",
    consecutiveFailures: 2,
    watermarks: {},
    pending: {},
  });
  expect(crossExecutionState.lastResult).toMatchObject({ status: "stalled" });
});

test("CLI task status reports history without creating an execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-status-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n  - id: report\n    type: report_output\n    displayName: Report\n    enabled: false\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nretry: once\nalerts:\n  - journal\nflow:\n  flowID: flow_review\n",
  );
  const runStatus = () =>
    Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "status",
        "nightly.yaml",
        "--workspace",
        root,
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
  const empty = runStatus();
  expect(empty.exitCode).toBe(0);
  expect(
    JSON.parse(new TextDecoder().decode(empty.stdout)) as Record<
      string,
      unknown
    >,
  ).toMatchObject({
    taskID: "task_nightly",
    flowID: "flow_review",
    enabledModules: 1,
    retry: "once",
    alertChannels: ["journal"],
    invocations: [],
    crossExecutionState: { consecutiveFailures: 0, watermarks: [] },
    alerts: { entries: [] },
  });
  const run = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "run",
      "nightly.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(run.exitCode).toBe(0);
  const after = runStatus();
  const report = JSON.parse(new TextDecoder().decode(after.stdout)) as {
    invocations: Array<Record<string, unknown>>;
    alerts: { entries: Array<Record<string, unknown>> };
    crossExecutionState: Record<string, unknown>;
    waterline?: unknown;
  };
  expect(report.invocations).toHaveLength(1);
  expect(report.invocations[0]).toMatchObject({
    status: "stalled",
    waterlineAdvanced: false,
  });
  expect(
    (report.invocations[0]!.attempts as Array<Record<string, unknown>>)[0],
  ).toMatchObject({ attempt: 1, status: "stalled" });
  expect(report.alerts.entries).toHaveLength(1);
  expect(report.alerts.entries[0]).toMatchObject({
    eventKind: "ultimately_failed",
    status: "stalled",
  });
  expect(report.crossExecutionState).toMatchObject({
    consecutiveFailures: 1,
  });
  expect(report.waterline).toBeUndefined();
  // Reading the status must not add another invocation or alert.
  const again = JSON.parse(new TextDecoder().decode(runStatus().stdout)) as {
    invocations: unknown[];
    alerts: { entries: unknown[] };
    crossExecutionState: { consecutiveFailures: number };
  };
  expect(again.invocations).toHaveLength(1);
  expect(again.alerts.entries).toHaveLength(1);
  expect(again.crossExecutionState.consecutiveFailures).toBe(1);
});

test("CLI task run enqueues an overlap alert and never runs a second invocation", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-overlap-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nalerts:\n  - journal\nflow:\n  flowID: flow_review\n",
  );
  const workflow = await import("@natalia/workflow");
  const seeded = await workflow.NataliaTaskStateStore.open(root);
  seeded.startInvocation({
    invocationID: "inv_already_running",
    taskID: "task_nightly",
    episodeID: "epi_running" as never,
    sessionID: "ses_running" as never,
  });
  seeded.close();
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "run",
      "nightly.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).toBe(0);
  const output = new TextDecoder()
    .decode(child.stdout)
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const skipped = output.find(
    (event) => event.status === "skipped_due_to_overlap",
  )!;
  expect(skipped.reason).toContain("inv_already_running");
  // The overlapping trigger must not create a runtime session at all.
  expect(output.some((event) => event.type === "session.created")).toBe(false);
  expect(output.find((event) => event.type === "task.alert")).toMatchObject({
    eventKind: "skipped_due_to_overlap",
    status: "skipped_due_to_overlap",
    attempt: 0,
    channels: 1,
  });
  const alerts = await workflow.NataliaTaskAlertQueue.open(root);
  expect(
    alerts
      .alerts("task_nightly")
      .map((alert) => [alert.invocationID, alert.eventKind, alert.attempt]),
  ).toEqual([[skipped.invocationID as string, "skipped_due_to_overlap", 0]]);
  alerts.close();
  // A skipped trigger is not an execution, so it must not touch the
  // cross-execution state of the task that is still running.
  expect(output.some((event) => event.type === "task.state")).toBe(false);
  expect(
    await readFile(
      join(root, ".natalia", "unattended", "task_nightly", "state.json"),
      "utf8",
    ).catch((error: NodeJS.ErrnoException) => error.code),
  ).toBe("ENOENT");
});

test("CLI task run evaluates a claimed module without advancing task success", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-evaluator-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(join(root, "README.md"), "real module evidence\n");
  let evaluatorPayload = "";
  const executionSystemPrompts: string[] = [];
  let executionRequests = 0;
  let continuationClaimed = false;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        tools?: unknown[];
        messages: Array<{ content: string }>;
      };
      const evaluator = body.model === "evaluator-model";
      if (!evaluator)
        executionSystemPrompts.push(body.messages[0]?.content ?? "");
      const readArguments = JSON.stringify({ path: "README.md" });
      const claimArguments = JSON.stringify({
        flowID: "flow_review",
        moduleID: "read",
        conditionStatuses: [{ id: "c1", status: "satisfied" }],
        evidenceRefs: ["tool:read_1"],
        gaps: [],
        recommendedAction: "Evaluate the read evidence.",
      });
      const toolCall = (id: string, name: string, arguments_: string) =>
        [
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, id, function: { name, arguments: arguments_ } },
                  ],
                },
              },
            ],
          })}`,
          "",
          'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
          "",
          "data: [DONE]",
          "",
        ].join("\n");
      const response = evaluator
        ? (() => {
            evaluatorPayload = body.messages.at(-1)!.content;
            return [
              `data: ${JSON.stringify({
                choices: [
                  {
                    delta: {
                      content: JSON.stringify({
                        schemaVersion: 1,
                        outcome: "incomplete",
                        conditions: [
                          {
                            id: "c1",
                            status: "satisfied",
                            reason: "read evidence is present",
                            evidenceRefs: ["tool:read_1"],
                          },
                        ],
                        gaps: ["report output is still missing"],
                        forbiddenRepeats: [],
                        recommendedActions: ["produce the report"],
                        idealOutcome: "partial",
                      }),
                    },
                  },
                ],
              })}`,
              "",
              "data: [DONE]",
              "",
            ].join("\n");
          })()
        : executionRequests++ === 0
          ? toolCall("read_1", "read_file", readArguments)
          : executionRequests === 2
            ? toolCall("claim_1", "flow_module_complete", claimArguments)
            : body.messages[0]?.content.includes(
                  "<active_flow_module_continuation>",
                ) && !continuationClaimed
              ? ((continuationClaimed = true),
                toolCall("claim_2", "flow_module_complete", claimArguments))
              : "data: [DONE]\n\n";
      return new Response(response, {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai-compatible",
            apiKey: "test-key",
            baseURL: server.url,
            enabled: true,
            customHeaders: {},
          },
        },
        models: {
          execution: {
            provider: "local",
            model: "execution-model",
            enabled: true,
            capabilities: {
              toolCall: true,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
          evaluator: {
            provider: "local",
            model: "evaluator-model",
            enabled: true,
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
        },
        defaultModel: "execution",
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "review.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    instructions: Read only the source evidence.\n    minimumConditions:\n      - id: c1\n        text: Read the source evidence\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: token=raw-task-secret Read the source.\npermissionProfile: unattended\nflow:\n  flowID: flow_review\nevaluator:\n  provider: local\n  model: evaluator\n",
    );
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "run",
        "nightly.yaml",
        "--workspace",
        root,
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    await child.exited;
    expect(child.exitCode).toBe(0);
    const output = (await new Response(child.stdout).text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(
      output.find((event) => event.type === "task.invocation"),
    ).toMatchObject({
      taskID: "task_nightly",
      status: "stalled",
      waterlineAdvanced: false,
    });
    expect(evaluatorPayload).toContain('"redacted":true');
    expect(evaluatorPayload).not.toContain("raw-task-secret");
    expect(evaluatorPayload).toContain("tool:read_1");
    expect(executionSystemPrompts[0]).toContain(
      "<active_flow_module_instructions>",
    );
    expect(executionSystemPrompts[0]).toContain(
      "Read only the source evidence.",
    );
    const continuationPrompt = executionSystemPrompts.find((prompt) =>
      prompt.includes("<active_flow_module_continuation>"),
    );
    expect(continuationPrompt).toContain("report output is still missing");
    expect(continuationPrompt).toContain("produce the report");
    const state = await (
      await import("@natalia/workflow")
    ).NataliaTaskStateStore.open(root);
    const invocation = output.find(
      (event) => event.type === "task.invocation",
    )!;
    expect(state.moduleEvents(invocation.invocationID as string, 1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "flow.module_claimed" }),
        expect.objectContaining({ kind: "flow.module_continued" }),
        expect.objectContaining({ kind: "flow.module_stalled" }),
      ]),
    );
    state.close();
  } finally {
    server.stop(true);
  }
});

test("CLI task run completes a two-module flow under distinct episodes and advances the waterline", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-batch-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(join(root, "README.md"), "real module evidence\n");
  const evaluatorPayloads: string[] = [];
  const executionSystemPrompts: string[] = [];
  let readRequests = 0;
  let reportRequests = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const evaluator = body.model === "evaluator-model";
      const stream = (text: string) =>
        new Response(text, {
          headers: { "content-type": "text/event-stream" },
        });
      if (evaluator) {
        evaluatorPayloads.push(body.messages.at(-1)!.content);
        const context = JSON.parse(body.messages.at(-1)!.content) as {
          moduleID: string;
        };
        const conditionID = context.moduleID === "read" ? "c1" : "c2";
        return stream(
          [
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    content: JSON.stringify({
                      schemaVersion: 1,
                      outcome: "complete",
                      conditions: [
                        {
                          id: conditionID,
                          status: "satisfied",
                          reason: "module evidence is present",
                          evidenceRefs:
                            conditionID === "c1"
                              ? ["tool:read_1"]
                              : ["tool:report_read"],
                        },
                      ],
                      gaps: [],
                      forbiddenRepeats: [],
                      recommendedActions: [],
                      idealOutcome: "satisfied",
                    }),
                  },
                },
              ],
            })}`,
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      }
      executionSystemPrompts.push(body.messages[0]?.content ?? "");
      const system = body.messages[0]?.content ?? "";
      const toolCall = (id: string, name: string, arguments_: string) =>
        stream(
          [
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id,
                        function: { name, arguments: arguments_ },
                      },
                    ],
                  },
                },
              ],
            })}`,
            "",
            'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      const readClaim = JSON.stringify({
        flowID: "flow_review",
        moduleID: "read",
        conditionStatuses: [{ id: "c1", status: "satisfied" }],
        evidenceRefs: ["tool:read_1"],
        gaps: [],
        recommendedAction: "Evaluate the read evidence.",
      });
      const reportClaim = JSON.stringify({
        flowID: "flow_review",
        moduleID: "report",
        conditionStatuses: [{ id: "c2", status: "satisfied" }],
        evidenceRefs: ["tool:report_read"],
        gaps: [],
        recommendedAction: "Evaluate the report evidence.",
      });
      if (system.includes("Read only the source evidence.")) {
        readRequests += 1;
        if (readRequests === 1)
          return toolCall(
            "read_1",
            "read_file",
            JSON.stringify({ path: "README.md" }),
          );
        if (readRequests === 2)
          return toolCall("read_claim", "flow_module_complete", readClaim);
        return stream("data: [DONE]\n\n");
      }
      if (system.includes("Produce the final report.")) {
        reportRequests += 1;
        // The second stage has to do real work too: a stage where no tool ever
        // succeeded cannot be completed.
        if (reportRequests === 1)
          return toolCall(
            "report_read",
            "read_file",
            JSON.stringify({ path: "README.md" }),
          );
        if (reportRequests === 2)
          return toolCall("report_claim", "flow_module_complete", reportClaim);
        return stream("data: [DONE]\n\n");
      }
      return stream("data: [DONE]\n\n");
    },
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai-compatible",
            apiKey: "test-key",
            baseURL: server.url,
            enabled: true,
            customHeaders: {},
          },
        },
        models: {
          execution: {
            provider: "local",
            model: "execution-model",
            enabled: true,
            capabilities: {
              toolCall: true,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
          evaluator: {
            provider: "local",
            model: "evaluator-model",
            enabled: true,
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
        },
        defaultModel: "execution",
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "review.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    instructions: Read only the source evidence.\n    minimumConditions:\n      - id: c1\n        text: Read the source evidence\n  - id: report\n    type: read_search\n    displayName: Report\n    instructions: Produce the final report.\n    minimumConditions:\n      - id: c2\n        text: Produce the final report\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Review the source and produce the report.\npermissionProfile: unattended\nflow:\n  flowID: flow_review\nevaluator:\n  provider: local\n  model: evaluator\n",
    );
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "run",
        "nightly.yaml",
        "--workspace",
        root,
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    await child.exited;
    expect(child.exitCode).toBe(0);
    const output = (await new Response(child.stdout).text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const invocation = output.find(
      (event) => event.type === "task.invocation",
    )!;
    expect(invocation).toMatchObject({
      taskID: "task_nightly",
      status: "succeeded",
      waterlineAdvanced: true,
    });
    const invocationID = invocation.invocationID as string;
    const sessionIDs = new Set(
      output
        .filter((event) => event.type === "session.created")
        .map((event) => event.sessionID as string),
    );
    expect(sessionIDs.size).toBeGreaterThanOrEqual(2);
    expect(
      output.filter((event) => event.type === "session.created").length,
    ).toBeGreaterThanOrEqual(2);
    const state = await (
      await import("@natalia/workflow")
    ).NataliaTaskStateStore.open(root);
    const activated = state
      .moduleEvents(invocationID, 1)
      .filter((event) => event.kind === "flow.module_activated");
    expect(activated.map((event) => event.moduleID)).toEqual([
      "read",
      "report",
    ]);
    expect(new Set(activated.map((event) => event.data.episodeID)).size).toBe(
      2,
    );
    expect(new Set(activated.map((event) => event.data.sessionID)).size).toBe(
      2,
    );
    expect(state.allModulesCompleted(invocationID, 1)).toBe(true);
    expect(state.getWaterline("task_nightly")).toMatchObject({ invocationID });
    expect(
      evaluatorPayloads.map(
        (payload) => (JSON.parse(payload) as { moduleID: string }).moduleID,
      ),
    ).toEqual(["read", "report"]);
    expect(
      executionSystemPrompts.filter((prompt) =>
        prompt.includes("<active_flow_module_instructions>"),
      ).length,
    ).toBeGreaterThanOrEqual(2);
    state.close();
  } finally {
    server.stop(true);
  }
});

test("CLI task run stops the module batch when an evaluator blocks the first module", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-batch-block-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(join(root, "README.md"), "real module evidence\n");
  let readRequests = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const stream = (text: string) =>
        new Response(text, {
          headers: { "content-type": "text/event-stream" },
        });
      if (body.model === "evaluator-model") {
        return stream(
          [
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    content: JSON.stringify({
                      schemaVersion: 1,
                      outcome: "blocked",
                      conditions: [
                        {
                          id: "c1",
                          status: "satisfied",
                          reason: "module evidence is present",
                          evidenceRefs: ["tool:read_1"],
                        },
                      ],
                      gaps: [],
                      forbiddenRepeats: [],
                      recommendedActions: [],
                      idealOutcome: "partial",
                    }),
                  },
                },
              ],
            })}`,
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      }
      const system = body.messages[0]?.content ?? "";
      const toolCall = (id: string, name: string, arguments_: string) =>
        stream(
          [
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id,
                        function: { name, arguments: arguments_ },
                      },
                    ],
                  },
                },
              ],
            })}`,
            "",
            'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      if (system.includes("Read only the source evidence.")) {
        readRequests += 1;
        if (readRequests === 1)
          return toolCall(
            "read_1",
            "read_file",
            JSON.stringify({ path: "README.md" }),
          );
        if (readRequests === 2)
          return toolCall(
            "read_claim",
            "flow_module_complete",
            JSON.stringify({
              flowID: "flow_review",
              moduleID: "read",
              conditionStatuses: [{ id: "c1", status: "satisfied" }],
              evidenceRefs: ["tool:read_1"],
              gaps: [],
              recommendedAction: "Evaluate the read evidence.",
            }),
          );
        return stream("data: [DONE]\n\n");
      }
      return stream("data: [DONE]\n\n");
    },
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai-compatible",
            apiKey: "test-key",
            baseURL: server.url,
            enabled: true,
            customHeaders: {},
          },
        },
        models: {
          execution: {
            provider: "local",
            model: "execution-model",
            enabled: true,
            capabilities: {
              toolCall: true,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
          evaluator: {
            provider: "local",
            model: "evaluator-model",
            enabled: true,
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
        },
        defaultModel: "execution",
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "review.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    instructions: Read only the source evidence.\n    minimumConditions:\n      - id: c1\n        text: Read the source evidence\n  - id: report\n    type: report_output\n    displayName: Report\n    instructions: Produce the final report.\n    minimumConditions:\n      - id: c2\n        text: Produce the final report\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Review the source and produce the report.\npermissionProfile: unattended\nflow:\n  flowID: flow_review\nevaluator:\n  provider: local\n  model: evaluator\n",
    );
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "run",
        "nightly.yaml",
        "--workspace",
        root,
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    await child.exited;
    expect(child.exitCode).toBe(1);
    const output = (await new Response(child.stdout).text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const invocation = output.find(
      (event) => event.type === "task.invocation",
    )!;
    expect(invocation).toMatchObject({
      taskID: "task_nightly",
      status: "blocked",
      waterlineAdvanced: false,
    });
    const state = await (
      await import("@natalia/workflow")
    ).NataliaTaskStateStore.open(root);
    const invocationID = invocation.invocationID as string;
    const activated = state
      .moduleEvents(invocationID, 1)
      .filter((event) => event.kind === "flow.module_activated");
    expect(activated.map((event) => event.moduleID)).toEqual(["read"]);
    expect(state.allModulesCompleted(invocationID, 1)).toBe(false);
    expect(state.getWaterline("task_nightly")).toBeUndefined();
    state.close();
  } finally {
    server.stop(true);
  }
});

test("CLI task run retries a blocked first attempt then succeeds under fresh module episodes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-retry-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(join(root, "README.md"), "real module evidence\n");
  let readRequests = 0;
  let evaluatorRequests = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      const stream = (text: string) =>
        new Response(text, {
          headers: { "content-type": "text/event-stream" },
        });
      if (body.model === "evaluator-model") {
        evaluatorRequests += 1;
        const blocked = evaluatorRequests === 1;
        return stream(
          [
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    content: JSON.stringify({
                      schemaVersion: 1,
                      outcome: blocked ? "blocked" : "complete",
                      conditions: [
                        {
                          id: "c1",
                          status: "satisfied",
                          reason: "module evidence is present",
                          evidenceRefs: ["tool:read_1"],
                        },
                      ],
                      gaps: [],
                      forbiddenRepeats: [],
                      recommendedActions: [],
                      idealOutcome: "satisfied",
                    }),
                  },
                },
              ],
            })}`,
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      }
      const system = body.messages[0]?.content ?? "";
      const toolCall = (id: string, name: string, arguments_: string) =>
        stream(
          [
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id,
                        function: { name, arguments: arguments_ },
                      },
                    ],
                  },
                },
              ],
            })}`,
            "",
            'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      const finalText = (text: string) =>
        stream(
          [
            `data: ${JSON.stringify({
              choices: [{ delta: { content: text } }],
            })}`,
            "",
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      if (system.includes("Read only the source evidence.")) {
        readRequests += 1;
        const phase = (readRequests - 1) % 3;
        if (phase === 0)
          return toolCall(
            "read_1",
            "read_file",
            JSON.stringify({ path: "README.md" }),
          );
        if (phase === 1)
          return toolCall(
            "read_claim",
            "flow_module_complete",
            JSON.stringify({
              flowID: "flow_review",
              moduleID: "read",
              conditionStatuses: [{ id: "c1", status: "satisfied" }],
              evidenceRefs: ["tool:read_1"],
              gaps: [],
              recommendedAction: "Evaluate the read evidence.",
            }),
          );
        return finalText("Source read and module claimed.");
      }
      return finalText("Done.");
    },
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai-compatible",
            apiKey: "test-key",
            baseURL: server.url,
            enabled: true,
            customHeaders: {},
          },
        },
        models: {
          execution: {
            provider: "local",
            model: "execution-model",
            enabled: true,
            capabilities: {
              toolCall: true,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
          evaluator: {
            provider: "local",
            model: "evaluator-model",
            enabled: true,
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
        },
        defaultModel: "execution",
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "review.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    instructions: Read only the source evidence.\n    minimumConditions:\n      - id: c1\n        text: Read the source evidence\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Review the source and produce the report.\npermissionProfile: unattended\nretry: once\nalerts:\n  - channel: journal\n    on:\n      - succeeded\n      - attempt_failed\nflow:\n  flowID: flow_review\nevaluator:\n  provider: local\n  model: evaluator\n",
    );
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "run",
        "nightly.yaml",
        "--workspace",
        root,
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    await child.exited;
    expect(child.exitCode).toBe(0);
    const output = (await new Response(child.stdout).text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const invocation = output.find(
      (event) => event.type === "task.invocation",
    )!;
    expect(invocation).toMatchObject({
      taskID: "task_nightly",
      status: "succeeded",
      waterlineAdvanced: true,
    });
    const state = await (
      await import("@natalia/workflow")
    ).NataliaTaskStateStore.open(root);
    const invocationID = invocation.invocationID as string;
    const attempt1Events = state.moduleEvents(invocationID, 1);
    const attempt2Events = state.moduleEvents(invocationID, 2);
    const activated1 = attempt1Events.filter(
      (event) => event.kind === "flow.module_activated",
    );
    const activated2 = attempt2Events.filter(
      (event) => event.kind === "flow.module_activated",
    );
    expect(activated1.map((event) => event.moduleID)).toEqual(["read"]);
    expect(activated2.map((event) => event.moduleID)).toEqual(["read"]);
    expect(activated1[0]?.data.episodeID).not.toBe(
      activated2[0]?.data.episodeID,
    );
    expect(activated1[0]?.data.sessionID).not.toBe(
      activated2[0]?.data.sessionID,
    );
    expect(attempt1Events.map((event) => event.kind)).toContain(
      "flow.module_blocked",
    );
    expect(attempt2Events.map((event) => event.kind)).toContain(
      "flow.module_completed",
    );
    expect(state.allModulesCompleted(invocationID, 2)).toBe(true);
    expect(state.getWaterline("task_nightly")).toMatchObject({ invocationID });
    state.close();
    // The blocked first attempt is an intermediate retry, not a task outcome:
    // this task subscribed to both, so the retried attempt is announced and so is
    // the eventual success. A bare channel name would have produced neither.
    const alerts = await (
      await import("@natalia/workflow")
    ).NataliaTaskAlertQueue.open(root);
    expect(
      alerts
        .alerts("task_nightly")
        .map((alert) => [alert.attempt, alert.eventKind, alert.status]),
    ).toEqual([
      [1, "attempt_failed", "retrying"],
      [2, "succeeded", "succeeded"],
    ]);
    expect(output.filter((event) => event.type === "task.alert")).toHaveLength(
      2,
    );
    alerts.close();
    // The final success resets the consecutive failure count even though the
    // first attempt was blocked.
    expect(output.find((event) => event.type === "task.state")).toMatchObject({
      taskID: "task_nightly",
      consecutiveFailures: 0,
    });
    const crossExecutionState = JSON.parse(
      await readFile(
        join(root, ".natalia", "unattended", "task_nightly", "state.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(crossExecutionState.lastResult).toMatchObject({
      status: "succeeded",
    });
  } finally {
    server.stop(true);
  }
});

test("CLI task run rejects non-auto profiles before creating execution state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-approval-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        attended: { approval: "ask", description: "Attended" },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "attended.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_attended\ndisplayName: Attended\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: attended\nflow:\n  flowID: flow_review\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "run",
      "attended.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain(
    "must use auto approval",
  );
});

test("CLI session helpers list and delete local durable sessions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-sessions-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_cli" as import("@natalia/contracts").SessionID,
    "CLI session",
  );
  record.events.push({ type: "diagnostic", level: "info", message: "saved" });
  record.inbox = [
    {
      id: "input",
      sessionID: record.id,
      text: "pending",
      delivery: "queue",
      admittedAt: "2026-01-01T00:00:00.000Z",
      admittedSeq: 1,
    },
  ];
  await store.save(record);
  expect(await listLocalSessions(root)).toMatchObject([
    { id: "ses_cli", events: 1, pendingInputs: 1 },
  ]);
  expect(sessionTable(await listLocalSessions(root))).toContain("CLI session");
  expect(await deleteLocalSession("ses_cli", root)).toEqual({
    id: "ses_cli",
    deleted: true,
    removedAttachments: 0,
  });
  expect(await listLocalSessions(root)).toEqual([]);
});

test("CLI session helpers list and show SQLite-backed unattended episodes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-sqlite-sessions-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  const store = new SqliteSessionStore(join(root, ".natalia", "sessions.db"));
  const id = "ses_unattended_episode" as import("@natalia/contracts").SessionID;
  store.create(id, "Natalia unattended episode epi_unattended_episode");
  store.appendEvents(id, [
    {
      type: "turn.submitted",
      id: "turn",
      text: "/doctor",
      byteLength: 7,
      lineCount: 1,
      sha256: "doctor",
      episodeID: "epi_unattended_episode",
    },
    {
      type: "turn.finished",
      id: "turn",
      stopReason: "done",
      episodeID: "epi_unattended_episode",
    },
  ]);
  store.close();

  expect(await listLocalSessions(root)).toContainEqual(
    expect.objectContaining({ id, events: 2 }),
  );
  expect(await showLocalSession(id, root)).toMatchObject({
    id,
    events: 2,
    pendingInputs: 0,
  });
});

test("CLI session metadata export/import omits event and attachment contents", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-session-bundle-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_bundle" as import("@natalia/contracts").SessionID,
    "Bundle source",
  );
  record.metadata = { pinned: true };
  record.events.push({
    type: "content.delta",
    id: "turn",
    text: "private content",
  });
  await store.save(record);
  const bundle = await exportLocalSessionMetadata("ses_bundle", root);
  expect(JSON.stringify(bundle)).not.toContain("private content");
  expect(bundle).toMatchObject({
    version: 1,
    source: { id: "ses_bundle" },
    pinned: true,
  });
  expect(
    await importLocalSessionMetadata(bundle, {
      workspaceRoot: root,
      id: "ses_bundle_import",
    }),
  ).toEqual({
    id: "ses_bundle_import",
    title: "Bundle source",
    importedFrom: "ses_bundle",
  });
  expect(await showLocalSession("ses_bundle_import", root)).toMatchObject({
    events: 0,
    pinned: true,
  });
});

test("CLI session delete reclaims an attachment orphaned by the removed session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-delete-attachment-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_attachment" as import("@natalia/contracts").SessionID,
    "Attachment session",
  );
  record.events.push({
    type: "turn.submitted",
    id: "turn",
    text: "inspect",
    byteLength: 7,
    lineCount: 1,
    sha256: "turn",
    attachments: [
      {
        id: "att_cli",
        path: ".natalia/attachments/att_cli-image.png",
        filename: "image.png",
        mediaType: "image/png",
        byteLength: 8,
        sha256: "attachment",
      },
    ],
  });
  await store.save(record);
  const attachmentRoot = join(root, ".natalia", "attachments");
  await mkdir(attachmentRoot, { recursive: true });
  await writeFile(
    join(attachmentRoot, "att_cli-image.png"),
    "orphan after delete",
  );
  expect(await deleteLocalSession("ses_attachment", root)).toMatchObject({
    deleted: true,
    removedAttachments: 1,
  });
  expect(
    await Bun.file(join(attachmentRoot, "att_cli-image.png")).exists(),
  ).toBe(false);
});

test("CLI run attachment flags preserve prompt text and validate values", () => {
  expect(
    promptArguments([
      "inspect",
      "this",
      "--attach",
      "image.png",
      "--attach",
      "notes.md",
    ]),
  ).toEqual({ text: "inspect this", attachments: ["image.png", "notes.md"] });
  expect(
    promptArguments(["inspect", "--json", "--attach", "image.png"]),
  ).toEqual({ text: "inspect", attachments: ["image.png"] });
  expect(() => parseAttachmentFlags(["--attach"])).toThrow(
    "--attach requires a workspace-relative path",
  );
  expect(() => parseAttachmentFlags(["--attach", "--json"])).toThrow(
    "--attach requires a workspace-relative path",
  );
});

test("CLI filesystem commands share protected workspace APIs", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-filesystem-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "main.ts"), "const answer = 42\n");
  expect(
    await workspaceFilesystemCommand({ action: "list", workspaceRoot: root }),
  ).toEqual({
    entries: [{ path: "src/", type: "directory" }],
    truncated: false,
  });
  expect(
    await workspaceFilesystemCommand({
      action: "read",
      workspaceRoot: root,
      path: "src/main.ts",
      offset: 1,
      limit: 1,
    }),
  ).toMatchObject({ offset: 1, truncated: false });
  expect(
    await workspaceFilesystemCommand({
      action: "glob",
      workspaceRoot: root,
      pattern: "**/*.ts",
    }),
  ).toEqual([{ path: "src/main.ts", type: "file" }]);
  expect(
    await workspaceFilesystemCommand({
      action: "search",
      workspaceRoot: root,
      query: "answer",
    }),
  ).toEqual([{ path: "src/main.ts", line: 1, text: "const answer = 42" }]);
  await expect(
    workspaceFilesystemCommand({
      action: "read",
      workspaceRoot: root,
      path: "../outside",
    }),
  ).rejects.toThrow("workspace path must remain inside workspace");
});

test("CLI session helpers expose safe metadata and local mutations", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-session-actions-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_actions" as import("@natalia/contracts").SessionID,
    "Initial title",
  );
  record.events.push({
    type: "content.delta",
    id: "turn",
    text: "private event detail",
  });
  await store.save(record);
  expect(await showLocalSession("ses_actions", root)).toMatchObject({
    id: "ses_actions",
    title: "Initial title",
    events: 1,
  });
  expect(await renameLocalSession("ses_actions", "Renamed", root)).toEqual({
    id: "ses_actions",
    title: "Renamed",
  });
  expect(await setLocalSessionPinned("ses_actions", true, root)).toEqual({
    id: "ses_actions",
    pinned: true,
  });
  expect(
    await duplicateLocalSession("ses_actions", {
      newID: "ses_copy",
      title: "Copy",
      workspaceRoot: root,
    }),
  ).toEqual({ id: "ses_copy", title: "Copy", duplicatedFrom: "ses_actions" });
  expect(
    (await listLocalSessions(root)).map((session) => session.id).sort(),
  ).toEqual(["ses_actions", "ses_copy"]);
});

test("CLI doctor reports safe config/model/session availability", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-doctor-"));
  const config = defaultConfigV2();
  config.providers.local = {
    type: "openai",
    apiKey: "local-key",
    enabled: true,
    customHeaders: {},
  };
  config.models.local = {
    provider: "local",
    model: "model",
    enabled: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      thinking: true,
      imageInput: false,
      videoInput: false,
      pdfInput: false,
    },
    contextWindow: "auto",
    maxOutputTokens: null,
    temperature: null,
    topP: null,
    reasoningEffort: null,
    thinkingEnabled: true,
    stream: true,
    requestTimeoutSec: null,
    variants: {},
  };
  config.defaultModel = "local";
  const path = join(root, "config.json");
  await saveConfigFile(config, path);
  expect(
    await doctorReport({ configPath: path, workspaceRoot: root }),
  ).toMatchObject({
    defaultModel: { selected: true },
    sessions: { count: 0 },
    sources: [
      { scope: "defaults", applied: true },
      { scope: "global", path, applied: true },
      {
        scope: "project",
        path: join(root, ".natalia", "config.json"),
        applied: false,
        diagnostic: "missing",
      },
    ],
  });
});

test("CLI doctor states that shell and terminal egress is not bounded here", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-doctor-egress-"));
  const path = join(root, "config.json");
  await saveConfigFile(defaultConfigV2(), path);
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "doctor",
      "--workspace",
      root,
    ],
    {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NATALIA_CONFIG: path },
    },
  );
  expect(child.exitCode).toBe(0);
  const output = new TextDecoder().decode(child.stdout);
  expect(output).toContain(
    "the application-layer host allowlist only covers fetch-style tools",
  );
  expect(output).toContain("run_shell and native terminal input");
  expect(output).toContain("firewall or container network");
});

test("CLI task run files one issue for a finding and updates it the next night", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-issue-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  const botToken = "gitea-bot-token-must-not-leak";
  type ForgeIssue = {
    number: number;
    title: string;
    body: string;
    state: string;
    labels: string[];
  };
  const issues: ForgeIssue[] = [];
  const forgeAuthorizations: string[] = [];
  const forge = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      forgeAuthorizations.push(request.headers.get("authorization") ?? "");
      const prefix = "/api/v1/repos/natalia/logs/issues";
      if (!url.pathname.startsWith(prefix))
        return Response.json({ message: "not found" }, { status: 404 });
      if (request.method === "GET")
        return Response.json(
          issues.map((issue) => ({
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            html_url: `${url.origin}/natalia/logs/issues/${issue.number}`,
          })),
        );
      const body = (await request.json()) as Record<string, unknown>;
      if (request.method === "POST") {
        const issue: ForgeIssue = {
          number: issues.length + 1,
          title: String(body.title ?? ""),
          body: String(body.body ?? ""),
          state: "open",
          labels: (body.labels as string[] | undefined) ?? [],
        };
        issues.push(issue);
        return Response.json({
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          html_url: `${url.origin}/natalia/logs/issues/${issue.number}`,
        });
      }
      const number = Number(url.pathname.slice(`${prefix}/`.length));
      const issue = issues.find((entry) => entry.number === number)!;
      issue.title = String(body.title ?? issue.title);
      issue.body = String(body.body ?? issue.body);
      return Response.json({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        html_url: `${url.origin}/natalia/logs/issues/${issue.number}`,
      });
    },
  });
  let reportRequests = 0;
  const provider = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        messages: Array<{ content: string; role: string }>;
      };
      const stream = (text: string) =>
        new Response(text, {
          headers: { "content-type": "text/event-stream" },
        });
      const sse = (payload: unknown, finish: string) =>
        stream(
          [
            `data: ${JSON.stringify(payload)}`,
            "",
            `data: {"choices":[{"delta":{},"finish_reason":"${finish}"}]}`,
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
        );
      if (body.model === "evaluator-model")
        return sse(
          {
            choices: [
              {
                delta: {
                  content: JSON.stringify({
                    schemaVersion: 1,
                    outcome: "complete",
                    conditions: [
                      {
                        id: "c1",
                        status: "satisfied",
                        reason: "the finding was reconciled",
                        evidenceRefs: ["tool:report_1"],
                      },
                    ],
                    gaps: [],
                    forbiddenRepeats: [],
                    recommendedActions: [],
                    idealOutcome: "satisfied",
                  }),
                },
              },
            ],
          },
          "stop",
        );
      reportRequests += 1;
      const phase = (reportRequests - 1) % 3;
      if (phase === 0)
        return sse(
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "report_1",
                      function: {
                        name: "report_issue",
                        arguments: JSON.stringify({
                          fingerprintParts: ["null pointer", "src/auth.ts"],
                          title: "Null pointer in the auth path",
                          body: `Night ${issues.length + 1}: still failing.`,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          },
          "tool_calls",
        );
      if (phase === 1)
        return sse(
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "report_claim",
                      function: {
                        name: "flow_module_complete",
                        arguments: JSON.stringify({
                          flowID: "flow_scan",
                          moduleID: "report",
                          conditionStatuses: [
                            { id: "c1", status: "satisfied" },
                          ],
                          evidenceRefs: ["tool:report_1"],
                          gaps: [],
                          recommendedAction: "Evaluate the reconciliation.",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          },
          "tool_calls",
        );
      return sse(
        { choices: [{ delta: { content: "Finding reconciled." } }] },
        "stop",
      );
    },
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai-compatible",
            apiKey: "test-key",
            baseURL: provider.url,
            enabled: true,
            customHeaders: {},
          },
        },
        models: {
          execution: {
            provider: "local",
            model: "execution-model",
            enabled: true,
            capabilities: {
              toolCall: true,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
          evaluator: {
            provider: "local",
            model: "evaluator-model",
            enabled: true,
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
        },
        defaultModel: "execution",
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
        issueTargets: {
          logs: {
            kind: "gitea",
            baseURL: forge.url,
            owner: "natalia",
            repo: "logs",
            token: botToken,
            label: "natalia",
          },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "scan.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_scan\ndisplayName: Scan\nmodules:\n  - id: report\n    type: report_output\n    displayName: Report\n    instructions: Report the finding to the configured issue target.\n    minimumConditions:\n      - id: c1\n        text: File or update the finding\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Report the nightly finding.\npermissionProfile: unattended\nissueTarget: logs\nflow:\n  flowID: flow_scan\nevaluator:\n  provider: local\n  model: evaluator\n",
    );
    // The forge and provider are served in this process, so the child must run
    // asynchronously: a synchronous spawn would block the event loop that has
    // to answer its requests.
    const runTask = async () => {
      const child = Bun.spawn(
        [
          process.execPath,
          join(import.meta.dir, "..", "src", "main.ts"),
          "task",
          "run",
          "nightly.yaml",
          "--workspace",
          root,
          "--json",
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      const stdout = await new Response(child.stdout).text();
      const stderr = await new Response(child.stderr).text();
      await child.exited;
      return { child, stdout, stderr };
    };
    const first = await runTask();
    expect(first.child.exitCode).toBe(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.body).toContain("natalia-fingerprint:");
    expect(issues[0]!.labels).toContain("natalia");
    // The credential never appears in the event stream, the tool output or the
    // durable state; only the forge request headers carry it.
    expect(first.stdout).not.toContain(botToken);
    expect(first.stderr).not.toContain(botToken);
    expect(
      forgeAuthorizations.every((value) => value === `token ${botToken}`),
    ).toBe(true);
    const second = await runTask();
    expect(second.child.exitCode).toBe(0);
    // Two nights, one issue.
    expect(issues).toHaveLength(1);
    expect(issues[0]!.body).toContain("Night 2");
    const workflow = await import("@natalia/workflow");
    const state = await workflow.NataliaUnattendedStateStore.open(
      root,
      "task_nightly",
    );
    const persisted = state.state();
    expect(Object.values(persisted.fingerprints)).toEqual([
      expect.objectContaining({ issue: "natalia/logs#1" }),
    ]);
    expect(JSON.stringify(persisted)).not.toContain(botToken);
    expect(
      await readFile(
        join(root, ".natalia", "unattended", "task_nightly", "state.json"),
        "utf8",
      ),
    ).not.toContain(botToken);
    const taskState = await workflow.NataliaTaskStateStore.open(root);
    expect(taskState.getWaterline("task_nightly")).toBeDefined();
    taskState.close();
  } finally {
    provider.stop(true);
    forge.stop(true);
  }
});

test("CLI task run consumes only new log content and never skips it after a failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-log-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  const logPath = join(root, "app.log");
  await writeFile(logPath, "night one error\n");
  const logReads: string[] = [];
  let evaluatorOutcome = "complete";
  const provider = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        messages: Array<{ content: string; role: string; toolName?: string }>;
      };
      const sse = (payload: unknown, finish: string) =>
        new Response(
          [
            `data: ${JSON.stringify(payload)}`,
            "",
            `data: {"choices":[{"delta":{},"finish_reason":"${finish}"}]}`,
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (body.model === "evaluator-model")
        return sse(
          {
            choices: [
              {
                delta: {
                  content: JSON.stringify({
                    schemaVersion: 1,
                    outcome: evaluatorOutcome,
                    conditions: [
                      {
                        id: "c1",
                        status:
                          evaluatorOutcome === "complete"
                            ? "satisfied"
                            : "missing",
                        reason: "log scan evidence",
                        evidenceRefs:
                          evaluatorOutcome === "complete" ? ["tool:log_1"] : [],
                      },
                    ],
                    gaps: [],
                    forbiddenRepeats: [],
                    recommendedActions: [],
                    idealOutcome: "satisfied",
                  }),
                },
              },
            ],
          },
          "stop",
        );
      const toolMessages = body.messages.filter(
        (message) => message.role === "tool",
      );
      if (!toolMessages.length)
        return sse(
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "log_1",
                      function: {
                        name: "read_data_source",
                        arguments: "{}",
                      },
                    },
                  ],
                },
              },
            ],
          },
          "tool_calls",
        );
      if (toolMessages.length === 1) {
        logReads.push(String(toolMessages[0]!.content));
        return sse(
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "log_claim",
                      function: {
                        name: "flow_module_complete",
                        arguments: JSON.stringify({
                          flowID: "flow_scan",
                          moduleID: "scan",
                          conditionStatuses: [
                            { id: "c1", status: "satisfied" },
                          ],
                          evidenceRefs: ["tool:log_1"],
                          gaps: [],
                          recommendedAction: "Evaluate the log scan.",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          },
          "tool_calls",
        );
      }
      return sse({ choices: [{ delta: { content: "Scanned." } }] }, "stop");
    },
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai-compatible",
            apiKey: "test-key",
            baseURL: provider.url,
            enabled: true,
            customHeaders: {},
          },
        },
        models: {
          execution: {
            provider: "local",
            model: "execution-model",
            enabled: true,
            capabilities: {
              toolCall: true,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
          evaluator: {
            provider: "local",
            model: "evaluator-model",
            enabled: true,
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
              imageInput: false,
              videoInput: false,
              pdfInput: false,
            },
            contextWindow: "auto",
            maxOutputTokens: null,
            temperature: null,
            topP: null,
            reasoningEffort: null,
            thinkingEnabled: false,
            stream: true,
            requestTimeoutSec: null,
            variants: {},
          },
        },
        defaultModel: "execution",
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
        dataSources: {
          app: { path: "app.log", kind: "offset", maxBytes: 4096 },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "scan.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_scan\ndisplayName: Scan\nmodules:\n  - id: scan\n    type: read_search\n    displayName: Scan\n    instructions: Read the new log content.\n    minimumConditions:\n      - id: c1\n        text: Read the new log content\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Scan the log.\npermissionProfile: unattended\ndataSource: app\nflow:\n  flowID: flow_scan\nevaluator:\n  provider: local\n  model: evaluator\n",
    );
    const runTask = async () => {
      const child = Bun.spawn(
        [
          process.execPath,
          join(import.meta.dir, "..", "src", "main.ts"),
          "task",
          "run",
          "nightly.yaml",
          "--workspace",
          root,
          "--json",
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      const stdout = await new Response(child.stdout).text();
      await child.exited;
      return { child, stdout };
    };
    const workflow = await import("@natalia/workflow");
    const first = await runTask();
    expect(first.child.exitCode).toBe(0);
    expect(JSON.parse(logReads[0]!)).toMatchObject({
      from: 0,
      to: 16,
      content: "night one error\n",
    });
    const afterFirst = await workflow.NataliaUnattendedStateStore.open(
      root,
      "task_nightly",
    );
    expect(afterFirst.watermark("app")).toMatchObject({
      kind: "offset",
      position: "16",
    });

    // Second night: only the appended line is consumed.
    await writeFile(logPath, "night one error\nnight two error\n");
    const second = await runTask();
    expect(second.child.exitCode).toBe(0);
    expect(JSON.parse(logReads[1]!)).toMatchObject({
      from: 16,
      to: 32,
      content: "night two error\n",
    });

    // Third night fails: the watermark must not advance, so the same content is
    // reprocessed on the next run instead of being skipped.
    evaluatorOutcome = "incomplete";
    await writeFile(
      logPath,
      "night one error\nnight two error\nnight three error\n",
    );
    const third = await runTask();
    expect(third.child.exitCode).toBe(0);
    expect(JSON.parse(logReads[2]!)).toMatchObject({ from: 32 });
    const afterFailure = await workflow.NataliaUnattendedStateStore.open(
      root,
      "task_nightly",
    );
    expect(afterFailure.watermark("app")).toMatchObject({ position: "32" });
    expect(afterFailure.state().pending).toEqual({});
    expect(afterFailure.consecutiveFailures()).toBe(1);
    evaluatorOutcome = "complete";
    const fourth = await runTask();
    expect(fourth.child.exitCode).toBe(0);
    expect(JSON.parse(logReads[3]!)).toMatchObject({
      from: 32,
      content: "night three error\n",
    });
    const afterRecovery = await workflow.NataliaUnattendedStateStore.open(
      root,
      "task_nightly",
    );
    expect(afterRecovery.watermark("app")).toMatchObject({ position: "50" });
    expect(afterRecovery.consecutiveFailures()).toBe(0);
  } finally {
    provider.stop(true);
  }
});

test("CLI task run follows a timestamp watermark through a rotation and a failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-ts-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  const logPath = join(root, "app.jsonl");
  const line = (at: string, message: string) =>
    `${JSON.stringify({ at, message })}\n`;
  await writeFile(
    logPath,
    line("2026-08-05T01:00:00.000Z", "one") +
      line("2026-08-05T02:00:00.000Z", "two"),
  );
  const reads: string[] = [];
  let evaluatorOutcome = "complete";
  const provider = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        messages: Array<{ content: string; role: string }>;
      };
      const sse = (payload: unknown, finish: string) =>
        new Response(
          [
            `data: ${JSON.stringify(payload)}`,
            "",
            `data: {"choices":[{"delta":{},"finish_reason":"${finish}"}]}`,
            "",
            "data: [DONE]",
            "",
          ].join("\n"),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (body.model === "evaluator-model")
        return sse(
          {
            choices: [
              {
                delta: {
                  content: JSON.stringify({
                    schemaVersion: 1,
                    outcome: evaluatorOutcome,
                    conditions: [
                      {
                        id: "c1",
                        status:
                          evaluatorOutcome === "complete"
                            ? "satisfied"
                            : "missing",
                        reason: "scan evidence",
                        evidenceRefs:
                          evaluatorOutcome === "complete" ? ["tool:log_1"] : [],
                      },
                    ],
                    gaps: [],
                    forbiddenRepeats: [],
                    recommendedActions: [],
                    idealOutcome: "satisfied",
                  }),
                },
              },
            ],
          },
          "stop",
        );
      const toolMessages = body.messages.filter(
        (message) => message.role === "tool",
      );
      if (!toolMessages.length)
        return sse(
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "log_1",
                      function: { name: "read_data_source", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
          },
          "tool_calls",
        );
      if (toolMessages.length === 1) {
        reads.push(String(toolMessages[0]!.content));
        return sse(
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "log_claim",
                      function: {
                        name: "flow_module_complete",
                        arguments: JSON.stringify({
                          flowID: "flow_scan",
                          moduleID: "scan",
                          conditionStatuses: [
                            { id: "c1", status: "satisfied" },
                          ],
                          evidenceRefs: ["tool:log_1"],
                          gaps: [],
                          recommendedAction: "Evaluate the scan.",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          },
          "tool_calls",
        );
      }
      return sse({ choices: [{ delta: { content: "Scanned." } }] }, "stop");
    },
  });
  const model = (name: string) => ({
    provider: "local",
    model: name,
    enabled: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      thinking: false,
      imageInput: false,
      videoInput: false,
      pdfInput: false,
    },
    contextWindow: "auto" as const,
    maxOutputTokens: null,
    temperature: null,
    topP: null,
    reasoningEffort: null,
    thinkingEnabled: false,
    stream: true,
    requestTimeoutSec: null,
    variants: {},
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai-compatible",
            apiKey: "test-key",
            baseURL: provider.url,
            enabled: true,
            customHeaders: {},
          },
        },
        models: {
          execution: model("execution-model"),
          evaluator: model("evaluator-model"),
        },
        defaultModel: "execution",
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
        dataSources: {
          app: {
            path: "app.jsonl",
            kind: "timestamp",
            timestampField: "at",
            maxBytes: 4096,
          },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "scan.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_scan\ndisplayName: Scan\nmodules:\n  - id: scan\n    type: read_search\n    displayName: Scan\n    instructions: Read the new entries.\n    minimumConditions:\n      - id: c1\n        text: Read the new entries\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Scan the entries.\npermissionProfile: unattended\ndataSource: app\nflow:\n  flowID: flow_scan\nevaluator:\n  provider: local\n  model: evaluator\n",
    );
    const runTask = async () => {
      const child = Bun.spawn(
        [
          process.execPath,
          join(import.meta.dir, "..", "src", "main.ts"),
          "task",
          "run",
          "nightly.yaml",
          "--workspace",
          root,
          "--json",
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      const stdout = await new Response(child.stdout).text();
      await child.exited;
      return { child, stdout };
    };
    const workflow = await import("@natalia/workflow");
    const openState = () =>
      workflow.NataliaUnattendedStateStore.open(root, "task_nightly");

    expect((await runTask()).child.exitCode).toBe(0);
    expect(JSON.parse(reads[0]!)).toMatchObject({
      kind: "timestamp",
      position: "2026-08-05T02:00:00.000Z",
    });
    expect((await openState()).watermark("app")).toMatchObject({
      kind: "timestamp",
      position: "2026-08-05T02:00:00.000Z",
    });

    // Rotation: the file is replaced by a shorter one, which is what a byte
    // offset cannot survive. The entries carry their own time, so the old ones
    // are simply behind the watermark.
    evaluatorOutcome = "incomplete";
    await writeFile(
      logPath,
      line("2026-08-05T02:00:00.000Z", "two") +
        line("2026-08-05T03:00:00.000Z", "three"),
    );
    expect((await runTask()).child.exitCode).toBe(0);
    expect(JSON.parse(reads[1]!).content).toContain("three");
    // The run failed, so the watermark stays put and the same entries are read
    // again next time rather than being skipped.
    const afterFailure = await openState();
    expect(afterFailure.watermark("app")).toMatchObject({
      position: "2026-08-05T02:00:00.000Z",
    });
    expect(afterFailure.state().pending).toEqual({});
    expect(afterFailure.consecutiveFailures()).toBe(1);

    evaluatorOutcome = "complete";
    expect((await runTask()).child.exitCode).toBe(0);
    expect(JSON.parse(reads[2]!).content).toContain("three");
    const afterRecovery = await openState();
    expect(afterRecovery.watermark("app")).toMatchObject({
      position: "2026-08-05T03:00:00.000Z",
    });
    expect(afterRecovery.consecutiveFailures()).toBe(0);
  } finally {
    provider.stop(true);
  }
});

test("CLI task validate rejects a timestamp source without a field name", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-ts-field-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
      dataSources: { app: { path: "app.jsonl", kind: "timestamp" } },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "scan.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_scan\ndisplayName: Scan\nmodules:\n  - id: scan\n    type: read_search\n    displayName: Scan\n    minimumConditions:\n      - id: c1\n        text: Read the new entries\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Scan.\npermissionProfile: unattended\ndataSource: app\nflow:\n  flowID: flow_scan\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "nightly.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain("timestampField");
});

test("the shipped unattended examples validate against their example config", async () => {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const examples = join(repoRoot, "deploy", "examples");
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-examples-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  // The example config declares the profiles, the data source and the issue
  // target the example tasks reference. The evaluator model is deployment
  // specific, so it is added here the way an operator would.
  const config = JSON.parse(
    await readFile(join(examples, "config.json"), "utf8"),
  ) as Record<string, unknown>;
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      ...config,
      models: {
        evaluator: {
          provider: "local",
          model: "evaluator-model",
          enabled: true,
          capabilities: {
            toolCall: false,
            reasoning: false,
            thinking: false,
            imageInput: false,
            videoInput: false,
            pdfInput: false,
          },
          contextWindow: "auto",
          maxOutputTokens: null,
          temperature: null,
          topP: null,
          reasoningEffort: null,
          thinkingEnabled: false,
          stream: true,
          requestTimeoutSec: null,
          variants: {},
        },
      },
      providers: {
        local: {
          type: "openai-compatible",
          apiKey: "test-key",
          baseURL: "http://127.0.0.1:1",
          enabled: true,
          customHeaders: {},
        },
      },
      defaultModel: "evaluator",
    }),
  );
  for (const flow of [
    "log-triage.yaml",
    "code-quality.yaml",
    "release-notes.yaml",
  ])
    await writeFile(
      join(root, ".natalia", "flows", flow),
      await readFile(join(examples, "flows", flow), "utf8"),
    );
  const cases = [
    {
      file: "nightly-log-triage.yaml",
      taskID: "task_nightly_log_triage",
      flowID: "flow_log_triage",
      modules: 3,
      references: {
        permissionProfile: { key: "unattended_read", approval: "auto" },
        issueTarget: { key: "project_issues" },
        dataSource: { key: "app_log" },
        alertChannels: [{ key: "journal" }],
      },
    },
    {
      file: "nightly-code-quality.yaml",
      taskID: "task_nightly_code_quality",
      flowID: "flow_code_quality",
      modules: 3,
      references: {
        permissionProfile: { key: "unattended_review", approval: "auto" },
        issueTarget: { key: "project_issues" },
        alertChannels: [{ key: "journal" }],
      },
    },
    {
      // A task that resumes nothing and reports nothing externally: both
      // references are optional, and the job is a write rather than a scan.
      file: "release-notes.yaml",
      taskID: "task_release_notes",
      flowID: "flow_release_notes",
      modules: 3,
      references: {
        permissionProfile: { key: "unattended_author", approval: "auto" },
        alertChannels: [{ key: "journal" }],
      },
    },
  ];
  for (const example of cases) {
    await writeFile(
      join(root, ".natalia", "tasks", example.file),
      await readFile(join(examples, "tasks", example.file), "utf8"),
    );
    const child = Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "validate",
        example.file,
        "--workspace",
        root,
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    expect(new TextDecoder().decode(child.stderr)).toBe("");
    expect(child.exitCode).toBe(0);
    expect(
      JSON.parse(new TextDecoder().decode(child.stdout)) as Record<
        string,
        unknown
      >,
    ).toMatchObject({
      status: "valid",
      taskID: example.taskID,
      flowID: example.flowID,
      modules: example.modules,
      references: example.references,
    });
    // The shipped profiles must actually let every stage of the shipped flows
    // work, otherwise the samples are parseable but not runnable.
    const preview = Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "preview",
        example.file,
        "--workspace",
        root,
        "--json",
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    expect(new TextDecoder().decode(preview.stderr)).toBe("");
    expect(preview.exitCode).toBe(0);
    expect(
      (
        JSON.parse(new TextDecoder().decode(preview.stdout)) as {
          blocked: unknown[];
        }
      ).blocked,
    ).toEqual([]);
  }
});

test("the shipped example profiles only name tools a capability bundle can grant", async () => {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const config = JSON.parse(
    await readFile(join(repoRoot, "deploy", "examples", "config.json"), "utf8"),
  ) as {
    permissionProfiles: Record<
      string,
      { permissions?: { tools?: { allow?: string[] } } }
    >;
  };
  const { isKnownModuleTool } = await import("@natalia/workflow");
  const named = Object.entries(config.permissionProfiles).flatMap(
    ([profile, entry]) =>
      (entry.permissions?.tools?.allow ?? []).map((tool) => ({
        profile,
        tool,
      })),
  );
  expect(named.length).toBeGreaterThan(0);
  // A tool rename that misses the samples leaves them parseable and even
  // previewable, while the run is denied at two in the morning: the profile
  // grants a name no bundle can hand out, and withholds the real one.
  expect(named.filter((entry) => !isKnownModuleTool(entry.tool))).toEqual([]);
});

test("task validate fails closed on a dangling configuration reference", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-dangling-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
        interactive: { approval: "ask", description: "Interactive" },
      },
      issueTargets: {
        retired: {
          kind: "gitea",
          baseURL: "https://forge.example",
          owner: "natalia",
          repo: "app",
          token: "t",
          enabled: false,
        },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
  );
  const validate = (file: string) => {
    const child = Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "validate",
        file,
        "--workspace",
        root,
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    return {
      exitCode: child.exitCode,
      stderr: new TextDecoder().decode(child.stderr),
    };
  };
  const task = (extra: string) =>
    `kind: natalia-task\nversion: 1\ntaskID: task_x\ndisplayName: X\nschedule: daily 01:00\nprompt: Do it.\n${extra}flow:\n  flowID: flow_review\n`;
  await writeFile(
    join(root, ".natalia", "tasks", "missing-profile.yaml"),
    task("permissionProfile: absent\n"),
  );
  expect(validate("missing-profile.yaml").stderr).toContain(
    "permission profile not found",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "interactive.yaml"),
    task("permissionProfile: interactive\n"),
  );
  expect(validate("interactive.yaml").stderr).toContain(
    "must use auto approval",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "missing-source.yaml"),
    task("permissionProfile: unattended\ndataSource: absent\n"),
  );
  expect(validate("missing-source.yaml").stderr).toContain(
    "data source not found",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "disabled-target.yaml"),
    task("permissionProfile: unattended\nissueTarget: retired\n"),
  );
  expect(validate("disabled-target.yaml").stderr).toContain(
    "issue target is disabled",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "missing-evaluator.yaml"),
    task(
      "permissionProfile: unattended\nevaluator:\n  provider: local\n  model: absent\n",
    ),
  );
  expect(validate("missing-evaluator.yaml").stderr).toContain(
    "evaluator model not found",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "missing-channel.yaml"),
    task("permissionProfile: unattended\nalerts:\n  - absent\n"),
  );
  expect(validate("missing-channel.yaml").stderr).toContain(
    "alert channel not found",
  );
  for (const file of [
    "missing-profile.yaml",
    "interactive.yaml",
    "missing-source.yaml",
    "disabled-target.yaml",
    "missing-evaluator.yaml",
    "missing-channel.yaml",
  ])
    expect(validate(file).exitCode).not.toBe(0);
});

test("the resident executor units depend on the executor and stay task-free", async () => {
  const systemd = join(import.meta.dir, "..", "..", "..", "deploy", "systemd");
  const daemon = await readFile(
    join(systemd, "natalia-daemon.service"),
    "utf8",
  );
  // The executor unit carries the port and the concurrency bound and nothing
  // task specific, so one executor serves every task document.
  expect(daemon).toContain("daemon 8787 --max-concurrent-tasks 1");
  expect(daemon).toContain("Restart=on-failure");
  expect(daemon).toContain("NoNewPrivileges=yes");
  expect(daemon).not.toMatch(/task run|task submit|--prompt|token|apiKey/iu);
  const service = await readFile(
    join(systemd, "natalia-task-log-triage-submit.service"),
    "utf8",
  );
  // A delivery that cannot reach the executor must fail, not be recorded as a
  // successful triage run.
  expect(service).toContain("Requires=natalia-daemon.service");
  expect(service).toContain("After=natalia-daemon.service");
  expect(service).toContain(
    "task submit .natalia/tasks/nightly-log-triage.yaml --json",
  );
  expect(service).not.toMatch(/--prompt|token|apiKey|password/iu);
  const timer = await readFile(
    join(systemd, "natalia-task-log-triage-submit.timer"),
    "utf8",
  );
  expect(timer).toContain("OnCalendar=*-*-* 02:15:00");
  expect(timer).toContain("Persistent=true");
  expect(timer).toContain("Unit=natalia-task-log-triage-submit.service");
});

test("the shipped task units name only the task document", async () => {
  const systemd = join(import.meta.dir, "..", "..", "..", "deploy", "systemd");
  for (const [unit, taskFile, calendar] of [
    [
      "natalia-task-log-triage",
      ".natalia/tasks/nightly-log-triage.yaml",
      "OnCalendar=*-*-* 02:15:00",
    ],
    [
      "natalia-task-code-quality",
      ".natalia/tasks/nightly-code-quality.yaml",
      "OnCalendar=Sun *-*-* 03:30:00",
    ],
  ] as const) {
    const service = await readFile(join(systemd, `${unit}.service`), "utf8");
    const timer = await readFile(join(systemd, `${unit}.timer`), "utf8");
    expect(service).toContain(`task run ${taskFile}`);
    expect(service).toContain("Type=oneshot");
    // The task document owns the prompt, the flow, the profile and the alert
    // policy, so none of it may leak into the unit or the command line, and no
    // credential may either.
    expect(service).not.toMatch(
      /--permission|--prompt|token|apiKey|password/iu,
    );
    expect(service).toContain("NoNewPrivileges=yes");
    expect(timer).toContain(calendar);
    // A missed run must be caught up, and the watermark is what keeps a catch-up
    // run from reporting the same content twice.
    expect(timer).toContain("Persistent=true");
    expect(timer).toContain(`Unit=${unit}.service`);
  }
});

test("CLI task timer generates reviewable system units and writes back the unit identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-systemd-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the workspace\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "review.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_review\ndisplayName: Review\nschedule: daily 02:15\nprompt: Do not put this prompt in a unit.\npermissionProfile: unattended\nflow:\n  flowID: flow_review\nsystemd:\n  calendar: '*-*-* 02:15:00'\n  scope: system\n",
  );
  const bin = join(root, "bin");
  await mkdir(bin);
  const analyze = join(bin, "systemd-analyze");
  await writeFile(
    analyze,
    "#!/bin/sh\nprintf '%s\\n' 'Normalized form: *-*-* 02:15:00' 'Next elapse: Fri 2026-08-07 02:15:00 CST' 'Iteration #2: Sat 2026-08-08 02:15:00 CST' 'Iteration #3: Sun 2026-08-09 02:15:00 CST'\n",
  );
  await chmod(analyze, 0o755);
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "timer",
      "review.yaml",
      "--workspace",
      root,
    ],
    {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
    },
  );
  expect(child.exitCode).toBe(0);
  expect(new TextDecoder().decode(child.stdout)).toContain(
    "sudo systemctl enable --now natalia-task-task_review.timer",
  );
  const service = await readFile(
    join(root, ".natalia", "systemd", "natalia-task-task_review.service"),
    "utf8",
  );
  expect(service).toContain('"task" "run-id" "task_review"');
  expect(service).not.toContain("Do not put this prompt");
  const saved = await readFile(
    join(root, ".natalia", "tasks", "review.yaml"),
    "utf8",
  );
  expect(saved).toContain("timerUnit: natalia-task-task_review.timer");
  expect(saved).toContain('generatedCalendar: "*-*-* 02:15:00"');
});

test("CLI task run delivers the terminal alert to a configured webhook", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-alert-delivery-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  const webhookToken = "ops-webhook-token-must-not-leak";
  const received: Array<{ auth: string; body: Record<string, unknown> }> = [];
  let respondWith = 204;
  const hook = Bun.serve({
    port: 0,
    async fetch(request) {
      received.push({
        auth: request.headers.get("authorization") ?? "",
        body: (await request.json()) as Record<string, unknown>,
      });
      return new Response("", { status: respondWith });
    },
  });
  try {
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        permissionProfiles: {
          unattended: { approval: "auto", description: "Task profile" },
        },
        alertChannels: {
          journal: { kind: "journal" },
          ops: { kind: "webhook", url: hook.url.href, token: webhookToken },
        },
      }),
    );
    await writeFile(
      join(root, ".natalia", "flows", "review.yaml"),
      "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
    );
    await writeFile(
      join(root, ".natalia", "tasks", "nightly.yaml"),
      "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nalerts:\n  - journal\n  - ops\nflow:\n  flowID: flow_review\n",
    );
    const runTask = async () => {
      const child = Bun.spawn(
        [
          process.execPath,
          join(import.meta.dir, "..", "src", "main.ts"),
          "task",
          "run",
          "nightly.yaml",
          "--workspace",
          root,
          "--json",
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      const stdout = await new Response(child.stdout).text();
      await child.exited;
      return {
        child,
        stdout,
        events: stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as Record<string, unknown>),
      };
    };
    const first = await runTask();
    expect(first.child.exitCode).toBe(0);
    expect(received).toHaveLength(1);
    expect(received[0]!.auth).toBe(`Bearer ${webhookToken}`);
    expect(received[0]!.body).toMatchObject({
      taskID: "task_nightly",
      eventKind: "ultimately_failed",
      status: "stalled",
    });
    // The delivered payload is the alert record only.
    expect(Object.keys(received[0]!.body).sort()).toEqual([
      "alertID",
      "attempt",
      "createdAt",
      "eventKind",
      "invocationID",
      "reason",
      "status",
      "taskID",
    ]);
    expect(first.stdout).not.toContain(webhookToken);
    expect(
      first.events
        .filter((event) => event.type === "task.alert_delivery")
        .map((event) => [event.channel, event.result])
        .sort(),
    ).toEqual([
      ["journal", "delivered"],
      ["ops", "delivered"],
    ]);

    // A webhook outage must not change the task result: the invocation is still
    // terminal and the delivery is left visibly pending.
    respondWith = 503;
    const second = await runTask();
    expect(second.child.exitCode).toBe(0);
    expect(
      second.events.find((event) => event.type === "task.invocation"),
    ).toMatchObject({ status: "stalled" });
    expect(
      second.events.find(
        (event) =>
          event.type === "task.alert_delivery" && event.channel === "ops",
      ),
    ).toMatchObject({ result: "retrying", attempts: 1 });
    const workflow = await import("@natalia/workflow");
    const queue = await workflow.NataliaTaskAlertQueue.open(root);
    expect(queue.queuePressure()).toMatchObject({ pending: 1, delivered: 3 });
    queue.close();
  } finally {
    hook.stop(true);
  }
});

test("a task refuses to run under a configuration that was silently ignored", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-bad-config-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  // The profile itself is fine, but one field elsewhere is malformed, so the
  // whole file is rejected and the command rules the operator wrote would
  // silently not apply.
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: {
          approval: "auto",
          description: "Task profile",
          commandRules: {
            mode: "whitelist",
            rules: [{ commands: "git diff" }],
          },
        },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nflow:\n  flowID: flow_review\n",
  );
  for (const action of ["validate", "run"]) {
    const child = Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        action,
        "nightly.yaml",
        "--workspace",
        root,
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    expect(child.exitCode).not.toBe(0);
    const stderr = new TextDecoder().decode(child.stderr);
    expect(stderr).toContain("configuration was rejected and is not in effect");
    expect(stderr).toContain("commandRules");
  }
  // Nothing was executed, so no invocation exists.
  const workflow = await import("@natalia/workflow");
  const state = await workflow.NataliaTaskStateStore.open(root);
  expect(state.invocations("task_nightly")).toEqual([]);
  state.close();
});

test("a flow stage with no minimum completion condition is rejected", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-conditionless-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "vague.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_vague\ndisplayName: Vague\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n  - id: vague\n    type: read_search\n    displayName: Vague\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "vague.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_vague\ndisplayName: Vague\nschedule: daily 01:00\nprompt: Do it.\npermissionProfile: unattended\nflow:\n  flowID: flow_vague\n",
  );
  const validate = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "vague.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(validate.exitCode).not.toBe(0);
  // Without a minimum condition the evaluator has nothing to verify, so the
  // stage could be "completed" by an empty claim.
  expect(new TextDecoder().decode(validate.stderr)).toContain(
    "without a minimum completion condition: vague",
  );
});

test("CLI task preview shows the effective permissions of each stage", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-preview-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: {
          approval: "auto",
          description: "Task profile",
          permissions: {
            tools: {
              allow: ["read_file", "glob", "grep", "run_shell", "report_issue"],
            },
          },
          commandRules: {
            mode: "whitelist",
            rules: [{ command: "npm run typecheck" }],
          },
        },
      },
      issueTargets: {
        forge: {
          kind: "gitea",
          baseURL: "https://forge.example",
          owner: "n",
          repo: "app",
          token: "t",
        },
      },
      alertChannels: { journal: { kind: "journal" } },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "mixed.yaml"),
    [
      "kind: natalia-flow",
      "version: 1",
      "flowID: flow_mixed",
      "displayName: Mixed",
      "modules:",
      "  - id: read",
      "    type: read_search",
      "    displayName: Read",
      "  - id: gate",
      "    type: shell_command",
      "    displayName: Gate",
      "    commandRules:",
      "      mode: whitelist",
      "      rules:",
      "        - command: npm run typecheck",
      "  - id: report",
      "    type: report_output",
      "    displayName: Report",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(root, ".natalia", "tasks", "mixed.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_mixed\ndisplayName: Mixed\nschedule: daily 01:00\nprompt: Do it.\npermissionProfile: unattended\nissueTarget: forge\nalerts:\n  - journal\nflow:\n  flowID: flow_mixed\n",
  );
  const preview = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "preview",
      "mixed.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(preview.exitCode).toBe(0);
  const report = JSON.parse(new TextDecoder().decode(preview.stdout)) as {
    modules: Array<{
      moduleID: string;
      tools: { allowed: string[]; denied: string[] };
      commandRules: Record<string, { mode: string; commands: string[] }>;
      blocked?: string;
    }>;
    blocked: unknown[];
  };
  expect(report.blocked).toEqual([]);
  const [read, gate, reportStage] = report.modules;
  expect(read!.tools.allowed.sort()).toEqual([
    "flow_module_complete",
    "glob",
    "grep",
    "read_file",
  ]);
  expect(gate!.tools.allowed).toContain("run_shell");
  expect(gate!.commandRules).toEqual({
    profile: { mode: "whitelist", commands: ["npm run typecheck"] },
    module: { mode: "whitelist", commands: ["npm run typecheck"] },
  });
  // The reporting stage only works because the task configures an issue target.
  expect(reportStage!.tools.allowed).toContain("report_issue");
});

test("a flow stage that the profile cannot run is rejected before it is scheduled", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-blocked-stage-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        readonly_tasks: {
          approval: "auto",
          description: "Reads only",
          permissions: { tools: { allow: ["read_file", "glob", "grep"] } },
        },
      },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "needs-terminal.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_terminal\ndisplayName: Terminal\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n  - id: term\n    type: terminal\n    displayName: Terminal\n    minimumConditions:\n      - id: c2\n        text: Check the working tree\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "needs-terminal.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_terminal\ndisplayName: Terminal\nschedule: daily 01:00\nprompt: Do it.\npermissionProfile: readonly_tasks\nflow:\n  flowID: flow_terminal\n",
  );
  const validate = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "needs-terminal.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(validate.exitCode).not.toBe(0);
  const stderr = new TextDecoder().decode(validate.stderr);
  // Discovering this at 02:00 by burning the retry budget is the worst way to
  // learn that a stage can never satisfy its conditions.
  expect(stderr).toContain("cannot complete under readonly_tasks");
  expect(stderr).toContain("term");
  const preview = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "preview",
      "needs-terminal.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(preview.exitCode).not.toBe(0);
  const text = new TextDecoder().decode(preview.stdout);
  expect(text).toContain("BLOCKED");
  expect(text).toContain("blocked stages: term");
  // The disabled variant of the same flow is fine, because a disabled stage
  // never runs.
  await writeFile(
    join(root, ".natalia", "flows", "needs-terminal.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_terminal\ndisplayName: Terminal\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n  - id: term\n    type: terminal\n    displayName: Terminal\n    enabled: false\n",
  );
  const revalidated = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "needs-terminal.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(revalidated.exitCode).toBe(0);
});

test("task submit carries the task to the resident executor and mirrors it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-submit-"));
  const daemonHome = await mkdtemp(join(tmpdir(), "natalia-cli-daemon-home-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await mkdir(join(daemonHome, "natalia-cli", "daemon"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nflow:\n  flowID: flow_review\n",
  );
  const requests: Array<{ auth: string; body: Record<string, unknown> }> = [];
  let respond: () => Response = () =>
    Response.json({
      invocationID: "inv_1",
      status: "stalled",
      waterlineAdvanced: false,
      exitCode: 0,
      output: [
        '{"type":"task.invocation","taskID":"task_nightly","status":"stalled"}',
        '{"type":"task.state","taskID":"task_nightly","consecutiveFailures":1}',
      ],
    });
  const executor = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname !== "/tasks/run")
        return Response.json({ error: "not found" }, { status: 404 });
      requests.push({
        auth: request.headers.get("authorization") ?? "",
        body: (await request.json()) as Record<string, unknown>,
      });
      return respond();
    },
  });
  try {
    await writeFile(
      join(daemonHome, "natalia-cli", "daemon", "token"),
      "resident-token\n",
      { mode: 0o600 },
    );
    await writeFile(
      join(daemonHome, "natalia-cli", "daemon", "daemon.json"),
      JSON.stringify({
        version: "0.0.0-ts7",
        url: executor.url.href,
        pid: process.pid,
        tokenFile: join(daemonHome, "natalia-cli", "daemon", "token"),
        transport: "http",
        createdAt: new Date().toISOString(),
      }),
    );
    // The executor is served in this process, so the client must run
    // asynchronously: a synchronous spawn would block the loop that answers it.
    const submit = async (extra: string[] = []) => {
      const child = Bun.spawn(
        [
          process.execPath,
          join(import.meta.dir, "..", "src", "main.ts"),
          "task",
          "submit",
          "nightly.yaml",
          "--workspace",
          root,
          ...extra,
        ],
        {
          cwd: root,
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, XDG_STATE_HOME: daemonHome },
        },
      );
      const stdout = await new Response(child.stdout).text();
      const stderr = await new Response(child.stderr).text();
      await child.exited;
      return { exitCode: child.exitCode, stdout, stderr };
    };
    const delivered = await submit(["--json"]);
    expect(delivered.stderr).toBe("");
    expect(delivered.exitCode).toBe(0);
    // The submitting client prints exactly what the controller emitted inside the
    // resident executor, so a timer sees the same stream either way.
    expect(delivered.stdout.trim().split("\n")).toEqual([
      '{"type":"task.invocation","taskID":"task_nightly","status":"stalled"}',
      '{"type":"task.state","taskID":"task_nightly","consecutiveFailures":1}',
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.auth).toBe("Bearer resident-token");
    expect(requests[0]!.body).toEqual({
      taskPath: "nightly.yaml",
      workspaceRoot: root,
      json: true,
    });
    // A failing outcome inside the executor has to fail the submitting process
    // too, otherwise a timer records a success.
    respond = () =>
      Response.json({
        invocationID: "inv_2",
        status: "blocked",
        waterlineAdvanced: false,
        exitCode: 1,
        output: ['{"type":"task.invocation","status":"blocked"}'],
      });
    expect((await submit(["--json"])).exitCode).toBe(1);
    // A definition error surfaces as a failure with the executor's reason.
    respond = () =>
      Response.json(
        { error: "task issue target not found: forge" },
        { status: 422 },
      );
    const rejected = await submit();
    expect(rejected.exitCode).not.toBe(0);
    expect(rejected.stderr).toContain("task issue target not found: forge");
  } finally {
    executor.stop(true);
  }
});

test("task submit fails closed when no resident executor is running", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-submit-absent-"));
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nflow:\n  flowID: flow_review\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "submit",
      "nightly.yaml",
      "--workspace",
      root,
    ],
    {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        XDG_STATE_HOME: await mkdtemp(join(tmpdir(), "natalia-empty-daemon-")),
      },
    },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain(
    "requires a running Natalia daemon",
  );
});

test("CLI task list shows every task and fails when one is broken", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-list-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
      alertChannels: { journal: { kind: "journal" } },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n",
  );
  const task = (id: string, extra = "") =>
    `kind: natalia-task\nversion: 1\ntaskID: ${id}\ndisplayName: ${id}\nschedule: daily 01:00\nprompt: Do it.\npermissionProfile: unattended\nalerts:\n  - journal\n${extra}flow:\n  flowID: flow_review\n`;
  await writeFile(
    join(root, ".natalia", "tasks", "ready.yaml"),
    task("task_ready"),
  );
  const list = (extra: string[] = []) =>
    Bun.spawnSync(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "main.ts"),
        "task",
        "list",
        "--workspace",
        root,
        ...extra,
      ],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
  const ready = list(["--json"]);
  expect(ready.exitCode).toBe(0);
  const overview = JSON.parse(new TextDecoder().decode(ready.stdout)) as {
    tasks: Array<Record<string, unknown>>;
    unreadable: unknown[];
  };
  expect(overview.unreadable).toEqual([]);
  expect(overview.tasks).toHaveLength(1);
  expect(overview.tasks[0]).toMatchObject({
    taskID: "task_ready",
    schedule: "daily 01:00",
    enabledModules: 1,
    problems: [],
  });
  const plain = list();
  expect(new TextDecoder().decode(plain.stdout)).toContain("last run: never");

  // A task whose channel does not exist is listed, marked, and fails the exit
  // code: a scheduled workspace must not rot silently.
  await writeFile(
    join(root, ".natalia", "tasks", "broken.yaml"),
    task("task_broken").replace("  - journal", "  - absent"),
  );
  const broken = list();
  expect(broken.exitCode).toBe(1);
  const text = new TextDecoder().decode(broken.stdout);
  expect(text).toContain("task_ready");
  expect(text).toContain("problem: alert channel not found: absent");
});

test("a bare alert channel stays silent on success and on a retried attempt", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-alert-default-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      permissionProfiles: {
        unattended: { approval: "auto", description: "Task profile" },
      },
      alertChannels: { journal: { kind: "journal" } },
    }),
  );
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n    minimumConditions:\n      - id: c1\n        text: Read the sources\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: /doctor\npermissionProfile: unattended\nalerts:\n  - journal\nflow:\n  flowID: flow_review\n",
  );
  const validate = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "nightly.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(validate.exitCode).toBe(0);
  // The preflight reports what each channel actually subscribed to, so the
  // policy is visible without running the task.
  expect(
    JSON.parse(new TextDecoder().decode(validate.stdout)) as {
      references: { alertChannels: Array<{ key: string; on: string[] }> };
    },
  ).toMatchObject({
    references: {
      alertChannels: [
        {
          key: "journal",
          on: [
            "ultimately_failed",
            "blocked_by_policy",
            "skipped_due_to_overlap",
          ],
        },
      ],
    },
  });
  const run = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "run",
      "nightly.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(run.exitCode).toBe(0);
  const events = new TextDecoder()
    .decode(run.stdout)
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  // This run stalls, which the default subscription does want to hear about.
  expect(events.find((event) => event.type === "task.alert")).toMatchObject({
    eventKind: "ultimately_failed",
    channels: 1,
  });
  const workflow = await import("@natalia/workflow");
  const alerts = await workflow.NataliaTaskAlertQueue.open(root);
  expect(alerts.alerts("task_nightly").map((alert) => alert.eventKind)).toEqual(
    ["ultimately_failed"],
  );
  // Nothing announced the start of the run.
  expect(
    alerts
      .alerts("task_nightly")
      .some((alert) => alert.eventKind === "task_started"),
  ).toBe(false);
  alerts.close();
});

test("CLI tool list reports the built-in families", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-tools-list-"));
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "tool",
      "list",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).toBe(0);
  const catalogue = JSON.parse(
    new TextDecoder().decode(child.stdout),
  ) as Array<{ id: string; tools: string[] }>;
  expect(catalogue.map((family) => family.id)).toContain("fs");
  expect(catalogue.map((family) => family.id)).toContain("todo");
  expect(catalogue.find((family) => family.id === "fs")?.tools).toContain(
    "read_file",
  );
});

test("CLI install and uninstall flip tools.enabled in the workspace config", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-tools-toggle-"));
  const uninstall = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "uninstall",
      "todo",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(uninstall.exitCode).toBe(0);
  expect(JSON.parse(new TextDecoder().decode(uninstall.stdout))).toMatchObject({
    uninstalled: true,
  });
  const afterUninstall = JSON.parse(
    await readFile(join(root, ".natalia", "config.json"), "utf8"),
  ) as { tools?: { enabled?: Record<string, boolean> } };
  expect(afterUninstall.tools?.enabled?.todo).toBe(false);

  const install = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "install",
      "todo",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(install.exitCode).toBe(0);
  const afterInstall = JSON.parse(
    await readFile(join(root, ".natalia", "config.json"), "utf8"),
  ) as { tools?: { enabled?: Record<string, boolean> } };
  expect(afterInstall.tools?.enabled?.todo).toBe(true);
});

test("CLI install refuses an unknown family", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-tools-unknown-"));
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "install",
      "not.a.family",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain(
    "unknown tool family",
  );
});

test("CLI install <dir> records trust and enables an out-of-tree family", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-install-dir-"));
  const familyDir = join(root, "extra.family");
  await mkdir(familyDir, { recursive: true });
  await writeFile(
    join(familyDir, "natalia.tool.json"),
    JSON.stringify({ entry: "index.ts" }),
  );
  await writeFile(
    join(familyDir, "index.ts"),
    `import type { ToolFamily } from "@natalia/tools";
export default (): ToolFamily => ({
  id: "extra.family", name: "Extra", version: "1.0.0",
  description: "Out-of-tree family", scope: "session",
  tools: [{ name: "extra_run", description: "Run", requiresApproval: false,
    parameters: { type: "object", properties: {} }, async execute() { return "ok"; } }],
});
`,
  );
  const install = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "install",
      "extra.family",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(install.exitCode).toBe(0);
  expect(JSON.parse(new TextDecoder().decode(install.stdout))).toMatchObject({
    installed: true,
    familyID: "extra.family",
  });

  // The trust record exists and the config enables the family.
  const trust = JSON.parse(
    await readFile(join(root, ".natalia", "trust.json"), "utf8"),
  ) as Record<string, { source: string; fingerprint?: string }>;
  const record = Object.values(trust)[0];
  expect(record?.source).toContain("extra.family");
  expect(record?.fingerprint).toBeString();
  const config = JSON.parse(
    await readFile(join(root, ".natalia", "config.json"), "utf8"),
  ) as { tools?: { enabled?: Record<string, boolean>; paths?: string[] } };
  expect(config.tools?.enabled?.["extra.family"]).toBe(true);

  const list = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "trust",
      "list",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(list.exitCode).toBe(0);
  expect(new TextDecoder().decode(list.stdout)).toContain("extra.family");
});
