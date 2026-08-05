import {
  createRealRuntimeClient,
  type RealRuntimeClientOptions,
} from "@natalia/client";
import type {
  EpisodeID,
  EvaluatorResult,
  NataliaFlowDocument,
  NataliaTaskDocument,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import { resolveConfig } from "@natalia/config";
import { agentsFromConfig } from "@natalia/agent";
import { userStateHome } from "@natalia/platform";
import {
  evaluateAndRecordModule,
  NataliaDocumentStore,
  NataliaTaskAlertQueue,
  NataliaTaskStateStore,
  NataliaUnattendedStateStore,
  taskAlertEventKindForStatus,
  type EvaluatorModuleContext,
  type NataliaTaskAttemptStatus,
  type NataliaPlannedFlowModule,
  type NataliaTaskInvocation,
} from "@natalia/workflow";
import { providerForModel } from "@natalia/runtime";
import {
  createRuntimeDaemonStore,
  createRuntimeHttpServer,
  createRecordedFetch,
  readCassette,
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
} from "@natalia/transport";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

import {
  deleteLocalSession,
  duplicateLocalSession,
  exportLocalSessionMetadata,
  importLocalSessionMetadata,
  doctorReport,
  listLocalSessions,
  plainStatus,
  renameLocalSession,
  setLocalSessionPinned,
  sessionTable,
  promptArguments,
  workspaceFilesystemCommand,
  attachTerminalReadOnly,
  attachTerminalWithControl,
  externalTerminalLaunchCommand,
  launchExternalTerminal,
  showLocalSession,
  startupDiagnostics,
} from "./index";

const argv = process.argv.slice(2);
const configPath =
  process.env.NATALIA_CONFIG ?? `${process.cwd()}/.natalia/config.json`;
const subcommand = argv[0];

switch (subcommand) {
  case "serve":
  case "--serve": {
    const port = Number(
      valueAfter(argv, subcommand === "--serve" ? "--serve" : "serve", 1) ??
        "8787",
    );
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error("serve requires a valid port");
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port,
      token: process.env.NATALIA_TRANSPORT_TOKEN,
    });
    console.log(
      JSON.stringify({
        url: server.url,
        auth: process.env.NATALIA_TRANSPORT_TOKEN
          ? "bearer required"
          : "disabled",
      }),
    );
    await waitSignal();
    server.stop(true);
    break;
  }

  case "daemon":
  case "--daemon-serve": {
    const store = createRuntimeDaemonStore({
      dir: valueAfter(argv, "--daemon-dir") ?? daemonDir(),
    });
    const port = Number(
      valueAfter(
        argv,
        subcommand === "--daemon-serve" ? "--daemon-serve" : "daemon",
        1,
      ) ?? "8787",
    );
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error("daemon requires a valid port");
    const token = await daemonToken(store);
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port,
      token,
    });
    await registerRuntimeDaemon(store, {
      url: server.url,
      pid: process.pid,
      transport: "http",
    });
    console.log(JSON.stringify({ url: server.url }));
    await waitSignal();
    server.stop(true);
    break;
  }

  case "daemon-status":
  case "--daemon-status": {
    console.log(
      JSON.stringify(
        await runtimeDaemonStatus(
          createRuntimeDaemonStore({ dir: daemonDir() }),
        ),
        null,
        2,
      ),
    );
    break;
  }

  case "daemon-stop":
  case "--daemon-stop": {
    console.log(
      JSON.stringify(
        await stopRuntimeDaemon(createRuntimeDaemonStore({ dir: daemonDir() })),
        null,
        2,
      ),
    );
    break;
  }

  case "run":
  case "--once": {
    const permissionProfile = valueAfter(argv, "--permission");
    if (argv.includes("--permission") && !permissionProfile)
      throw new Error("--permission requires a profile name");
    const { text: prompt, attachments } = promptArguments(
      withoutRunOption(argv.slice(1), "--permission"),
    );
    if (!prompt) throw new Error("run requires a prompt");
    await runOnce(
      prompt,
      argv.includes("--json"),
      attachments,
      permissionProfile,
    );
    break;
  }

  case "eval":
  case "--stdio": {
    const execution = newHeadlessExecution();
    const client = createRealRuntimeClient(execution);
    let failed = false;
    try {
      client.start((event) => {
        if (event.type === "turn.finished" && event.stopReason === "error")
          failed = true;
        console.log(JSON.stringify(event));
      });
      const input = await Bun.stdin.text();
      for (const line of input.split(/\r?\n/u)) {
        if (!line.trim()) continue;
        const request = JSON.parse(line) as {
          prompt?: string;
          delivery?: "steer" | "queue";
          attachments?: string[];
          cancel?: string;
          pause?: string;
          resume?: boolean;
        };
        if (request.cancel) client.cancel(request.cancel);
        if (request.pause) client.pause?.(request.pause);
        if (request.resume) client.resume?.();
        if (
          request.prompt &&
          request.delivery === "queue" &&
          client.submitInput
        )
          await client.submitInput({
            text: request.prompt,
            delivery: "queue",
            attachments: request.attachments,
          });
        else if (
          request.prompt &&
          request.attachments?.length &&
          client.submitInput
        )
          await client.submitInput({
            text: request.prompt,
            attachments: request.attachments,
          });
        else if (request.prompt) await client.submit(request.prompt);
      }
    } finally {
      // Without this the workspace watcher keeps the loop alive and the
      // process never exits after the work is done.
      await client.dispose?.();
    }
    if (failed) process.exitCode = 1;
    break;
  }

  case "task": {
    const action = argv[1];
    const taskPath = argv[2];
    if (
      !taskPath ||
      (action !== "validate" && action !== "run" && action !== "status")
    )
      throw new Error(
        "task requires 'validate', 'run' or 'status' followed by a task path",
      );
    const workspaceRoot = resolve(
      valueAfter(argv, "--workspace") ?? process.cwd(),
    );
    const store = new NataliaDocumentStore(workspaceRoot);
    const task = await store.loadTask(taskPath);
    const flow = await store.resolveTaskFlow(task);
    if (action === "run") {
      await runTaskOnce({
        workspaceRoot,
        task,
        flow,
        json: argv.includes("--json"),
      });
      break;
    }
    if (action === "status") {
      const report = await taskStatusReport({ workspaceRoot, task, flow });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(report, null, 2)
          : taskStatusLines(report).join("\n"),
      );
      break;
    }
    const result = {
      taskID: task.taskID,
      displayName: task.displayName,
      permissionProfile: task.permissionProfile,
      flowID: flow.flowID,
      flowDisplayName: flow.displayName,
      modules: flow.modules.filter((module) => module.enabled).length,
      status: "valid",
    };
    console.log(
      argv.includes("--json")
        ? JSON.stringify(result)
        : `task ${result.taskID}: valid\nflow ${result.flowID}: ${result.modules} enabled modules`,
    );
    break;
  }

  case "diagnose":
  case "--diagnostics": {
    console.log(JSON.stringify(await startupDiagnostics(configPath), null, 2));
    break;
  }

  case "status": {
    console.log(JSON.stringify(await plainStatus(configPath), null, 2));
    break;
  }

  case "doctor": {
    const report = await doctorReport({
      configPath,
      workspaceRoot: valueAfter(argv, "--workspace"),
    });
    console.log(
      argv.includes("--json")
        ? JSON.stringify(report, null, 2)
        : [
            `config: ${report.configPath}`,
            `migration: ${report.migration}`,
            `default model: ${report.defaultModel.modelID} (${report.defaultModel.selected ? "selected" : (report.defaultModel.reason ?? "unavailable")})`,
            `sessions: ${report.sessions.count} (${report.sessions.pendingInputs} pending inputs)`,
          ].join("\n"),
    );
    break;
  }

  case "session": {
    const action = argv[1] ?? "list";
    const workspaceRoot = valueAfter(argv, "--workspace");
    if (action === "list") {
      const sessions = await listLocalSessions(workspaceRoot);
      console.log(
        argv.includes("--json")
          ? JSON.stringify(sessions, null, 2)
          : sessionTable(sessions),
      );
      break;
    }
    if (action === "delete") {
      const id = argv[2];
      if (!id) throw new Error("session delete requires an ID");
      console.log(
        JSON.stringify(await deleteLocalSession(id, workspaceRoot), null, 2),
      );
      break;
    }
    if (action === "show") {
      const id = argv[2];
      if (!id) throw new Error("session show requires an ID");
      const result = await showLocalSession(id, workspaceRoot);
      console.log(
        argv.includes("--json")
          ? JSON.stringify(result, null, 2)
          : [
              `id: ${result.id}`,
              `title: ${result.title}`,
              `events: ${result.events}`,
              `pending inputs: ${result.pendingInputs}`,
              `pinned: ${result.pinned ? "yes" : "no"}`,
              `resumable: ${result.resumable ? "yes" : "no"}`,
            ].join("\n"),
      );
      break;
    }
    if (action === "rename") {
      const id = argv[2];
      const workspaceIndex = argv.indexOf("--workspace");
      const title = argv
        .slice(3, workspaceIndex >= 0 ? workspaceIndex : undefined)
        .join(" ");
      if (!id || !title)
        throw new Error("session rename requires an ID and title");
      console.log(
        JSON.stringify(
          await renameLocalSession(id, title, workspaceRoot),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "pin" || action === "unpin") {
      const id = argv[2];
      if (!id) throw new Error(`session ${action} requires an ID`);
      console.log(
        JSON.stringify(
          await setLocalSessionPinned(id, action === "pin", workspaceRoot),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "duplicate") {
      const id = argv[2];
      if (!id) throw new Error("session duplicate requires an ID");
      console.log(
        JSON.stringify(
          await duplicateLocalSession(id, {
            title: valueAfter(argv, "--title"),
            newID: valueAfter(argv, "--id"),
            workspaceRoot,
          }),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "export") {
      const id = argv[2];
      if (!id) throw new Error("session export requires an ID");
      console.log(
        JSON.stringify(
          await exportLocalSessionMetadata(id, workspaceRoot),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "import") {
      const raw = argv[2];
      if (!raw)
        throw new Error("session import requires a metadata JSON value");
      const bundle = JSON.parse(raw) as import("./index").SessionMetadataBundle;
      console.log(
        JSON.stringify(
          await importLocalSessionMetadata(bundle, {
            workspaceRoot,
            id: valueAfter(argv, "--id"),
            title: valueAfter(argv, "--title"),
          }),
          null,
          2,
        ),
      );
      break;
    }
    throw new Error(`unknown session action: ${action}`);
  }

  case "terminal": {
    const action = argv[1];
    const id = argv[2];
    if (!id || (action !== "attach" && action !== "open"))
      throw new Error("terminal requires attach <id> or open <id>");
    const store = createRuntimeDaemonStore({
      dir: valueAfter(argv, "--daemon-dir") ?? daemonDir(),
    });
    const directURL = process.env.NATALIA_TERMINAL_URL;
    const directToken = process.env.NATALIA_TERMINAL_TOKEN;
    const status = directURL ? undefined : await runtimeDaemonStatus(store);
    if (!directURL && status?.state !== "running")
      throw new Error(
        "terminal attach requires a running Natalia daemon or NATALIA_TERMINAL_URL bridge",
      );
    if (action === "open") {
      const command = externalTerminalLaunchCommand({
        id,
        executable: [process.execPath, process.argv[1]!],
        preferred: valueAfter(argv, "--terminal"),
        takeControl: argv.includes("--take-control"),
        secureInput: argv.includes("--secure-input"),
      });
      if (!command)
        throw new Error(
          "no supported external terminal found; configure --terminal or use terminal attach inside a terminal",
        );
      console.log(
        JSON.stringify({
          id,
          pid: launchExternalTerminal({ command }),
          command,
        }),
      );
      break;
    }
    let url: string;
    let token: string | undefined;
    if (directURL) {
      url = directURL;
      token = directToken;
    } else {
      if (status?.state !== "running")
        throw new Error("Natalia daemon registration is unavailable");
      url = status.registration.url;
      token = (await readFile(status.registration.tokenFile, "utf8")).trim();
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      const attach = argv.includes("--take-control")
        ? attachTerminalWithControl
        : attachTerminalReadOnly;
      await attach({
        id,
        url,
        token,
        signal: controller.signal,
        sensitive: argv.includes("--secure-input"),
      });
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
    break;
  }

  case "fs": {
    const action = argv[1] as "list" | "read" | "glob" | "search" | undefined;
    if (!action || !["list", "read", "glob", "search"].includes(action))
      throw new Error("fs requires list, read, glob, or search");
    const positional = argv.filter(
      (value, index) =>
        index > 1 &&
        !value.startsWith("--") &&
        argv[index - 1] !== "--workspace" &&
        argv[index - 1] !== "--path" &&
        argv[index - 1] !== "--include" &&
        argv[index - 1] !== "--limit",
    );
    console.log(
      JSON.stringify(
        await workspaceFilesystemCommand({
          action,
          workspaceRoot: valueAfter(argv, "--workspace"),
          path:
            valueAfter(argv, "--path") ??
            (action === "read" ? positional[0] : undefined),
          pattern: action === "glob" ? positional[0] : undefined,
          query: action === "search" ? positional[0] : undefined,
          include: valueAfter(argv, "--include"),
          offset: valueAfter(argv, "--offset")
            ? Number(valueAfter(argv, "--offset"))
            : undefined,
          limit: valueAfter(argv, "--limit")
            ? Number(valueAfter(argv, "--limit"))
            : undefined,
        }),
        null,
        2,
      ),
    );
    break;
  }

  case "record": {
    const cassettePath = argv[1];
    if (!cassettePath) throw new Error("record requires a cassette path");
    const record = createRecordedFetch({ mode: "record", cassettePath });
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port: Number(argv[2] ?? "8787"),
    });
    globalThis.fetch = record as typeof globalThis.fetch;
    console.log(JSON.stringify({ url: server.url, cassette: cassettePath }));
    await waitSignal();
    server.stop(true);
    break;
  }

  case "replay": {
    const cassettePath = argv[1];
    if (!cassettePath) throw new Error("replay requires a cassette path");
    const replay = createRecordedFetch({ mode: "replay", cassettePath });
    const cassette = await readCassette(cassettePath);
    console.log(`replaying ${cassette.interactions.length} recorded requests`);
    for (const entry of cassette.interactions) {
      const response = await replay(entry.request.url, entry.request);
      console.log(
        `${entry.request.method} ${entry.request.url} -> ${response.status}`,
      );
    }
    break;
  }

  default: {
    if (!subcommand || subcommand.startsWith("--")) {
      // Legacy flat mode for backward compat
      if (
        subcommand === "--once" ||
        subcommand === "--stdio" ||
        subcommand === "--diagnostics"
      ) {
        console.error("use 'natalia <subcommand>' instead of 'natalia <flag>'");
        process.exit(1);
      }
    }
    console.log(JSON.stringify(await plainStatus(configPath), null, 2));
    break;
  }
}

async function runOnce(
  prompt: string,
  json: boolean,
  attachments: string[] = [],
  permissionProfile?: string,
) {
  const client = createRealRuntimeClient({
    ...newHeadlessExecution(),
    permissionProfile,
  });
  let text = "";
  let failed = false;
  try {
    client.start((event) => {
      if (event.type === "turn.finished" && event.stopReason === "error")
        failed = true;
      if (json) {
        console.log(JSON.stringify(event));
        return;
      }
      if (event.type === "content.delta") text += event.text;
      const line = plainRuntimeEvent(event);
      if (line) console.log(line);
    });
    if (attachments.length && client.submitInput)
      await client.submitInput({ text: prompt, attachments });
    else await client.submit(prompt);
    if (!json && text) console.log(text);
  } finally {
    // The turn is finished here, but the runtime still holds the workspace
    // watcher, plugins, MCP connections and terminals. Releasing them is what
    // lets a one-shot run actually exit, which is what a scheduler needs.
    await client.dispose?.();
  }
  if (failed) process.exitCode = 1;
}

async function runTaskOnce(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  json: boolean;
}) {
  const config = (await resolveConfig({ workspaceRoot: input.workspaceRoot }))
    .config;
  const profile = config.permissionProfiles[input.task.permissionProfile];
  if (!profile)
    throw new Error(
      `task permission profile not found: ${input.task.permissionProfile}`,
    );
  if (profile.approval !== "auto")
    throw new Error(
      `task permission profile must use auto approval: ${input.task.permissionProfile}`,
    );
  const modules = input.flow.modules.filter((entry) => entry.enabled);
  if (!modules.length)
    throw new Error(`task flow has no enabled modules: ${input.flow.flowID}`);
  const executionSelection = taskExecutionProvider(config);
  if (input.task.evaluator && !executionSelection)
    throw new Error(
      "task execution model is unavailable in the resolved config",
    );
  const state = await NataliaTaskStateStore.open(input.workspaceRoot);
  // The alert queue is a separate durable store on purpose: a saturated or
  // broken notification queue must never rewrite the task's terminal truth.
  const alerts = await NataliaTaskAlertQueue.open(input.workspaceRoot);
  const controllerExecution = newHeadlessExecution();
  const invocationID = `inv_${crypto.randomUUID().replace(/-/gu, "")}`;
  const started = state.startInvocation({
    invocationID,
    taskID: input.task.taskID,
    episodeID: controllerExecution.episodeID,
    sessionID: controllerExecution.sessionID,
  });
  if (!started.started) {
    console.log(
      JSON.stringify({
        invocationID,
        taskID: input.task.taskID,
        status: "skipped_due_to_overlap",
        reason: started.invocation.skipReason,
      }),
    );
    // The overlap contract requires the skip itself to be notifiable; it is a
    // durable terminal invocation state, not an intermediate retry.
    enqueueTaskAlert({
      alerts,
      task: input.task,
      invocation: started.invocation,
      attempt: 0,
      episodeID: controllerExecution.episodeID,
      reason: started.invocation.skipReason,
      json: input.json,
    });
    alerts.close();
    state.close();
    return;
  }
  const maxAttempts = taskRetryMaxAttempts(input.task.retry);
  let attempt = started.attempt.attempt;
  let attemptEpisodeID = started.attempt.episodeID;
  let result: NataliaTaskInvocation | undefined;
  try {
    while (true) {
      // Every attempt reinitializes the module plan under the attempt's own
      // controller episode/session. The controller advances the linear plan
      // one module at a time, each module runs under its own fresh headless
      // episode, and the batch only reports success after every enabled module
      // completed under evaluator control. A blocked, failed, cancelled, or
      // stalled module stops the batch.
      state.initializeModulePlan({
        invocationID,
        attempt,
        modules: modules.map((module) => ({
          flowID: input.flow.flowID,
          moduleID: module.id,
          moduleType: module.type,
          conditionIDs: [
            ...module.minimumConditions.map((condition) => condition.id),
            ...module.idealConditions.map((condition) => condition.id),
          ],
        })),
      });
      let lastOutcome: TaskModuleRunOutcome | undefined;
      let moduleRuns = 0;
      while (true) {
        const moduleExecution = newHeadlessExecution();
        const module = state.activateNextModule({
          invocationID,
          attempt,
          episodeID: moduleExecution.episodeID,
          sessionID: moduleExecution.sessionID,
        });
        if (!module) break;
        moduleRuns += 1;
        lastOutcome = await runTaskModule({
          workspaceRoot: input.workspaceRoot,
          task: input.task,
          flow: input.flow,
          config,
          state,
          invocationID,
          attempt,
          executionProvider: executionSelection!,
          execution: moduleExecution,
          module,
          json: input.json,
        });
        if (lastOutcome.outcome !== "complete") break;
      }
      if (moduleRuns === 0)
        throw new Error("task module plan has no activatable module");
      const allCompleted = state.allModulesCompleted(invocationID, attempt);
      const status: Exclude<NataliaTaskAttemptStatus, "running"> = allCompleted
        ? "succeeded"
        : lastOutcome && lastOutcome.outcome !== "complete"
          ? lastOutcome.outcome
          : "stalled";
      const reason = allCompleted
        ? "all enabled modules completed under evaluator control"
        : (lastOutcome?.reason ??
          "module plan did not complete under evaluator control");
      if (taskStatusRetryable(status) && attempt < maxAttempts) {
        state.completeAttempt({
          invocationID,
          attempt,
          status,
          retry: true,
          reason,
        });
        attempt += 1;
        const controllerExecution = newHeadlessExecution();
        state.recordAttempt({
          invocationID,
          attempt,
          episodeID: controllerExecution.episodeID,
          sessionID: controllerExecution.sessionID,
        });
        attemptEpisodeID = controllerExecution.episodeID;
        // An intermediate retry attempt is not a task outcome, so nothing is
        // enqueued here: the invocation is durable `retrying`, not terminal.
        continue;
      }
      state.completeAttempt({
        invocationID,
        attempt,
        status,
        retry: false,
        reason,
      });
      result = state.getInvocation(invocationID)!;
      console.log(
        input.json
          ? JSON.stringify({ type: "task.invocation", ...result })
          : `task ${input.task.taskID}: ${result.status}`,
      );
      // The task's own terminal state is already durable at this point, so an
      // alert enqueue failure is reported and never changes the task result.
      enqueueTaskAlert({
        alerts,
        task: input.task,
        invocation: result,
        attempt,
        episodeID: attemptEpisodeID,
        reason,
        json: input.json,
      });
      await settleUnattendedState({
        workspaceRoot: input.workspaceRoot,
        invocation: result,
        json: input.json,
      });
      if (status !== "succeeded" && status !== "stalled") process.exitCode = 1;
      break;
    }
  } finally {
    alerts.close();
    state.close();
  }
}

/**
 * Read-only history for one task. It opens the durable stores, reports what
 * actually happened, and never creates an invocation, episode, session,
 * approval or alert.
 */
async function taskStatusReport(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
}) {
  const state = await NataliaTaskStateStore.open(input.workspaceRoot);
  const alerts = await NataliaTaskAlertQueue.open(input.workspaceRoot);
  const crossExecution = await NataliaUnattendedStateStore.open(
    input.workspaceRoot,
    input.task.taskID,
  );
  try {
    const invocations = state.invocations(input.task.taskID);
    const persisted = crossExecution.state();
    return {
      taskID: input.task.taskID,
      displayName: input.task.displayName,
      schedule: input.task.schedule,
      permissionProfile: input.task.permissionProfile,
      flowID: input.flow.flowID,
      enabledModules: input.flow.modules.filter((module) => module.enabled)
        .length,
      retry: input.task.retry,
      alertChannels: input.task.alerts,
      waterline: state.getWaterline(input.task.taskID),
      invocations: invocations.map((invocation) => ({
        ...invocation,
        attempts: state.attempts(invocation.invocationID).map((attempt) => ({
          attempt: attempt.attempt,
          status: attempt.status,
          episodeID: attempt.episodeID,
          sessionID: attempt.sessionID,
          reason: attempt.reason,
        })),
      })),
      crossExecutionState: {
        path: crossExecution.path,
        consecutiveFailures: persisted.consecutiveFailures,
        watermarks: Object.values(persisted.watermarks),
        fingerprints: Object.keys(persisted.fingerprints).length,
        suppressed: Object.keys(persisted.suppressed).length,
        lastResult: persisted.lastResult,
      },
      alerts: {
        queue: alerts.queuePressure(),
        entries: alerts.alerts(input.task.taskID).map((alert) => ({
          ...alert,
          deliveries: alerts.deliveries(alert.alertID).map((delivery) => ({
            channel: delivery.channel,
            state: delivery.state,
            attempts: delivery.attempts,
            lastError: delivery.lastError,
          })),
        })),
      },
    };
  } finally {
    alerts.close();
    state.close();
  }
}

function taskStatusLines(report: Awaited<ReturnType<typeof taskStatusReport>>) {
  const lines = [
    `task ${report.taskID}: ${report.displayName}`,
    `schedule: ${report.schedule}`,
    `flow ${report.flowID}: ${report.enabledModules} enabled modules`,
    `profile: ${report.permissionProfile} (retry ${report.retry})`,
    `waterline: ${report.waterline ? `${report.waterline.invocationID} at ${report.waterline.advancedAt}` : "not advanced"}`,
    `consecutive failures: ${report.crossExecutionState.consecutiveFailures}`,
    `watermarks: ${report.crossExecutionState.watermarks.length}, fingerprints: ${report.crossExecutionState.fingerprints}, suppressed: ${report.crossExecutionState.suppressed}`,
    `alerts: ${report.alerts.entries.length} (${report.alerts.queue.pending} pending deliveries)`,
  ];
  for (const invocation of report.invocations)
    lines.push(
      `  ${invocation.startedAt} ${invocation.invocationID} ${invocation.status}${invocation.skipReason ? ` (${invocation.skipReason})` : ""} attempts=${invocation.attempts.length}`,
    );
  return lines;
}

/**
 * Cross-execution state is settled only after the invocation is terminal and
 * durable. A success promotes whatever position the execution staged; anything
 * else keeps the previous watermark so the next run reprocesses the same data
 * instead of skipping it.
 */
async function settleUnattendedState(input: {
  workspaceRoot: string;
  invocation: NataliaTaskInvocation;
  json: boolean;
}) {
  try {
    const store = await NataliaUnattendedStateStore.open(
      input.workspaceRoot,
      input.invocation.taskID,
    );
    if (input.invocation.status === "succeeded")
      await store.commit({ invocationID: input.invocation.invocationID });
    else
      await store.recordFailure({
        invocationID: input.invocation.invocationID,
        status: input.invocation.status,
      });
    const state = store.state();
    const line = {
      type: "task.state",
      taskID: state.taskID,
      consecutiveFailures: state.consecutiveFailures,
      watermarks: Object.keys(state.watermarks).length,
      suppressed: Object.keys(state.suppressed).length,
    };
    if (input.json) console.log(JSON.stringify(line));
  } catch (error) {
    // Failing to settle leaves the previous watermark in place, which only ever
    // reprocesses data; it must not rewrite the task's terminal result.
    console.log(
      JSON.stringify({
        type: "diagnostic",
        level: "warning",
        message: `task state settlement failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
}

function enqueueTaskAlert(input: {
  alerts: NataliaTaskAlertQueue;
  task: NataliaTaskDocument;
  invocation: NataliaTaskInvocation;
  attempt: number;
  episodeID: EpisodeID;
  reason?: string;
  json: boolean;
}) {
  const eventKind = taskAlertEventKindForStatus(input.invocation.status);
  if (!eventKind) return;
  try {
    const enqueued = input.alerts.enqueue({
      taskID: input.invocation.taskID,
      invocationID: input.invocation.invocationID,
      attempt: input.attempt,
      episodeID: input.episodeID,
      eventKind,
      status: input.invocation.status,
      reason: input.reason,
      channels: input.task.alerts,
    });
    const pressure = input.alerts.queuePressure();
    const line = {
      type: "task.alert",
      alertID: enqueued.alert.alertID,
      eventKind,
      status: input.invocation.status,
      attempt: input.attempt,
      enqueued: enqueued.enqueued,
      channels: enqueued.deliveries.length,
      pendingDeliveries: pressure.pending,
    };
    console.log(
      input.json
        ? JSON.stringify(line)
        : `alert ${eventKind}: ${enqueued.deliveries.length} channel(s) queued`,
    );
    if (pressure.overLimit)
      console.log(
        JSON.stringify({
          type: "diagnostic",
          level: "warning",
          message: `task alert delivery queue is above its bound: ${pressure.pending} pending of ${pressure.limit}`,
        }),
      );
  } catch (error) {
    console.log(
      JSON.stringify({
        type: "diagnostic",
        level: "warning",
        message: `task alert enqueue failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
}

function taskRetryMaxAttempts(retry: NataliaTaskDocument["retry"]): number {
  if (retry === "once") return 2;
  if (retry === "twice") return 3;
  if (retry === "three_times") return 4;
  return 1;
}

function taskStatusRetryable(
  status: Exclude<NataliaTaskAttemptStatus, "running">,
): boolean {
  return status === "failed" || status === "blocked" || status === "stalled";
}

type TaskModuleRunOutcome =
  | { outcome: "complete"; reason: string }
  | { outcome: "blocked" | "failed" | "cancelled" | "stalled"; reason: string };

async function runTaskModule(input: {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  config: Awaited<ReturnType<typeof resolveConfig>>["config"];
  state: NataliaTaskStateStore;
  invocationID: string;
  attempt: number;
  executionProvider: string;
  execution: HeadlessExecution;
  module: NataliaPlannedFlowModule;
  json: boolean;
}): Promise<TaskModuleRunOutcome> {
  const taskModuleContext: NonNullable<
    RealRuntimeClientOptions["taskModuleContext"]
  > = {
    store: input.state,
    invocationID: input.invocationID,
    attempt: input.attempt,
    flowID: input.flow.flowID,
    moduleID: input.module.moduleID,
    moduleType: input.module.moduleType,
    moduleInstructions:
      input.flow.modules.find((entry) => entry.id === input.module.moduleID)
        ?.instructions ?? "",
    moduleCommandRules: input.flow.modules.find(
      (entry) => entry.id === input.module.moduleID,
    )?.commandRules,
  };
  const client = createRealRuntimeClient({
    ...input.execution,
    workspaceRoot: input.workspaceRoot,
    permissionProfile: input.task.permissionProfile,
    taskModuleContext,
  });
  let stopReason: Extract<
    RuntimeEvent,
    { type: "turn.finished" }
  >["stopReason"] = "error";
  const evaluatorContext = createEvaluatorContext(
    input.flow.flowID,
    input.module,
  );
  try {
    client.start((event) => {
      if (event.type === "turn.finished") stopReason = event.stopReason;
      collectEvaluatorContext(evaluatorContext, event);
      if (input.json) console.log(JSON.stringify(event));
      else {
        const line = plainRuntimeEvent(event);
        if (line) console.log(line);
      }
    });
    await client.submit(input.task.prompt);
    let evaluatorOutcome:
      | Awaited<ReturnType<typeof evaluateClaimedTaskModule>>
      | { outcome: "stalled" }
      | undefined;
    let continuationProgress = {
      conditionStatuses: new Map<string, "missing" | "partial" | "satisfied">(),
      evidenceRefs: new Set<string>(),
    };
    while (
      hasUnevaluatedModuleClaim(
        input.state,
        input.invocationID,
        input.attempt,
        input.module.moduleID,
      )
    ) {
      evaluatorOutcome = evaluatorContext.policyDenied
        ? blockClaimedTaskModule(
            input.state,
            input.invocationID,
            input.attempt,
            evaluatorContext,
            "module policy denial prevents evaluator completion",
          )
        : input.task.evaluator
          ? await evaluateClaimedTaskModule({
              task: input.task,
              config: input.config,
              state: input.state,
              invocationID: input.invocationID,
              attempt: input.attempt,
              executionProvider: input.executionProvider,
              context: evaluatorContext,
            })
          : (input.state.stallModule({
              invocationID: input.invocationID,
              attempt: input.attempt,
              flowID: evaluatorContext.flowID,
              moduleID: evaluatorContext.moduleID,
              reason:
                "module claim requires an evaluator before the controller can complete it",
            }),
            { outcome: "stalled" as const });
      if (!evaluatorOutcome || evaluatorOutcome.outcome !== "incomplete") break;
      const progress = moduleContinuationProgress({
        result: evaluatorOutcome.result,
        previous: continuationProgress,
        evidenceRefs: input.state.moduleEvidenceRefs({
          invocationID: input.invocationID,
          attempt: input.attempt,
          flowID: input.flow.flowID,
          moduleID: input.module.moduleID,
        }),
      });
      if (!progress.made) {
        evaluatorOutcome = { outcome: "stalled" };
        input.state.stallModule({
          invocationID: input.invocationID,
          attempt: input.attempt,
          flowID: input.flow.flowID,
          moduleID: input.module.moduleID,
          reason:
            "evaluator incomplete without new evidence or condition improvement",
        });
        break;
      }
      continuationProgress = progress.next;
      taskModuleContext.moduleContinuation = evaluatorContinuation(
        evaluatorOutcome.result,
      );
      await client.submit("Continue the active flow module.");
    }
    if (evaluatorOutcome?.outcome === "complete")
      return {
        outcome: "complete",
        reason: "evaluator completed the module under evaluator control",
      };
    const terminalStatus =
      evaluatorOutcome?.outcome === "blocked"
        ? "blocked"
        : taskTurnTerminalStatus(stopReason);
    if (terminalStatus === "stalled" && evaluatorOutcome === undefined)
      input.state.stallModule({
        invocationID: input.invocationID,
        attempt: input.attempt,
        flowID: input.flow.flowID,
        moduleID: input.module.moduleID,
        reason:
          "turn finished before the completion controller received a module claim",
      });
    const outcome =
      evaluatorOutcome?.outcome === "blocked" ? "blocked" : terminalStatus;
    return {
      outcome,
      reason: evaluatorOutcome
        ? `evaluator ${evaluatorOutcome.outcome}; runtime turn finished: ${stopReason}`
        : `runtime turn finished: ${stopReason}`,
    };
  } finally {
    await client.dispose?.();
  }
}

function hasUnevaluatedModuleClaim(
  state: NataliaTaskStateStore,
  invocationID: string,
  attempt: number,
  moduleID: string,
) {
  const events = state.moduleEvents(invocationID, attempt);
  const lastClaim = events.findLastIndex(
    (event) =>
      event.kind === "flow.module_claimed" && event.moduleID === moduleID,
  );
  const lastEvaluation = events.findLastIndex(
    (event) =>
      event.kind === "flow.module_evaluated" && event.moduleID === moduleID,
  );
  return lastClaim > lastEvaluation;
}

function evaluatorContinuation(result: EvaluatorResult) {
  return JSON.stringify({
    conditions: result.conditions.map(({ id, status }) => ({ id, status })),
    gaps: result.gaps,
    forbiddenRepeats: result.forbiddenRepeats,
    recommendedActions: result.recommendedActions,
    idealOutcome: result.idealOutcome,
  });
}

function moduleContinuationProgress(input: {
  result: EvaluatorResult;
  previous: {
    conditionStatuses: Map<string, "missing" | "partial" | "satisfied">;
    evidenceRefs: Set<string>;
  };
  evidenceRefs: string[];
}) {
  const rank = { missing: 0, partial: 1, satisfied: 2 } as const;
  const conditionStatuses = new Map(
    input.result.conditions.map((condition) => [
      condition.id,
      condition.status,
    ]),
  );
  const evidenceRefs = new Set(input.evidenceRefs);
  const improvedCondition = input.result.conditions.some(
    (condition) =>
      rank[condition.status] >
      rank[input.previous.conditionStatuses.get(condition.id) ?? "missing"],
  );
  const newEvidence = input.evidenceRefs.some(
    (ref) => !input.previous.evidenceRefs.has(ref),
  );
  return {
    made: improvedCondition || newEvidence,
    next: { conditionStatuses, evidenceRefs },
  };
}

function taskExecutionProvider(
  config: Awaited<ReturnType<typeof resolveConfig>>["config"],
) {
  const agent = agentsFromConfig(config).default();
  const modelID = agent?.model ?? config.defaultModel;
  const provider = providerForModel(config, modelID, agent?.variant);
  const providerKey = config.models[modelID]?.provider;
  return provider && providerKey ? providerKey : undefined;
}

function createEvaluatorContext(
  flowID: string,
  module: {
    moduleID: string;
    conditionIDs: string[];
  },
): EvaluatorModuleContext & { policyDenied: boolean } {
  return {
    flowID,
    moduleID: module.moduleID,
    conditionIDs: [...module.conditionIDs],
    messages: [],
    toolRecords: [],
    terminalOutput: [],
    executionRecords: [],
    policyDenied: false,
  };
}

function collectEvaluatorContext(
  context: EvaluatorModuleContext & { policyDenied: boolean },
  event: RuntimeEvent,
) {
  if (event.type === "turn.submitted" || event.type === "content.delta") {
    context.messages.push(event.text);
    return;
  }
  if (event.type === "tool.update" && event.status === "succeeded") {
    context.toolRecords.push(
      `${event.callID ? `tool:${event.callID} ` : ""}${event.name}: ${event.result ?? event.summary}`,
    );
    return;
  }
  if (event.type === "terminal.update") {
    context.terminalOutput.push(`${event.id}: ${event.tail}`);
    return;
  }
  if (event.type === "terminal.action" && event.redacted) {
    context.secureInput = true;
    return;
  }
  if (
    event.type === "policy.decision" &&
    (event.decision === "deny" || event.decision === "rejected")
  )
    context.policyDenied = true;
  if (
    event.type === "policy.decision" ||
    event.type === "diagnostic" ||
    event.type === "turn.finished"
  )
    context.executionRecords.push(JSON.stringify(event));
}

async function evaluateClaimedTaskModule(input: {
  task: NataliaTaskDocument;
  config: Awaited<ReturnType<typeof resolveConfig>>["config"];
  state: NataliaTaskStateStore;
  invocationID: string;
  attempt: number;
  executionProvider: string;
  context: EvaluatorModuleContext & { policyDenied: boolean };
}) {
  if (!input.task.evaluator) return undefined;
  const model = input.config.models[input.task.evaluator.model];
  const providerConfig = input.config.providers[input.task.evaluator.provider];
  if (
    !model ||
    !providerConfig ||
    model.provider !== input.task.evaluator.provider
  ) {
    input.state.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: input.context.flowID,
      moduleID: input.context.moduleID,
      outcome: "blocked",
      data: {
        reason:
          "task evaluator selection is unavailable in the resolved config",
      },
    });
    return {
      outcome: "blocked" as const,
      reason: "task evaluator selection is unavailable in the resolved config",
    };
  }
  const provider = providerForModel(input.config, input.task.evaluator.model);
  if (!provider) {
    input.state.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: input.context.flowID,
      moduleID: input.context.moduleID,
      outcome: "blocked",
      data: { reason: "task evaluator provider is unavailable" },
    });
    return {
      outcome: "blocked" as const,
      reason: "task evaluator provider is unavailable",
    };
  }
  const consent = input.task.evaluatorConsent;
  if (consent && consent.provider !== input.task.evaluator.provider) {
    input.state.evaluateModule({
      invocationID: input.invocationID,
      attempt: input.attempt,
      flowID: input.context.flowID,
      moduleID: input.context.moduleID,
      outcome: "blocked",
      data: {
        reason: "task evaluator consent does not match evaluator provider",
      },
    });
    return {
      outcome: "blocked" as const,
      reason: "task evaluator consent does not match evaluator provider",
    };
  }
  const result = await evaluateAndRecordModule({
    store: input.state,
    invocationID: input.invocationID,
    attempt: input.attempt,
    executionProvider: input.executionProvider,
    selection: { provider: provider.provider, model: provider.model },
    consent: consent
      ? { provider: consent.provider, confirmedAt: consent.confirmedAt }
      : undefined,
    provider,
    providerIdentity: input.task.evaluator.provider,
    context: input.context,
  });
  return result;
}

function blockClaimedTaskModule(
  state: NataliaTaskStateStore,
  invocationID: string,
  attempt: number,
  context: EvaluatorModuleContext,
  reason: string,
) {
  state.evaluateModule({
    invocationID,
    attempt,
    flowID: context.flowID,
    moduleID: context.moduleID,
    outcome: "blocked",
    data: { reason },
  });
  return { outcome: "blocked" as const, reason };
}

type HeadlessExecution = {
  episodeID: EpisodeID;
  sessionID: SessionID;
  title: string;
  useSqliteStore: boolean;
};

function newHeadlessExecution(): HeadlessExecution {
  const episodeID =
    `epi_${crypto.randomUUID().replace(/-/gu, "")}` as EpisodeID;
  return {
    episodeID,
    sessionID: `ses_${episodeID.slice("epi_".length)}` as SessionID,
    title: `Natalia unattended episode ${episodeID}`,
    useSqliteStore: true,
  };
}

function taskTurnTerminalStatus(
  stopReason: Extract<RuntimeEvent, { type: "turn.finished" }>["stopReason"],
): "failed" | "cancelled" | "stalled" {
  if (stopReason === "cancelled") return "cancelled";
  if (stopReason === "error") return "failed";
  return "stalled";
}

function plainRuntimeEvent(event: RuntimeEvent) {
  if (event.type === "diagnostic") return `${event.level}: ${event.message}`;
  if (event.type === "turn.finished")
    return `turn finished: ${event.stopReason}`;
  if (event.type === "checkpoint.created") return `checkpoint ${event.id}`;
  if (event.type === "rollback.end")
    return `rollback ${event.checkpointID} done`;
  return undefined;
}

function valueAfter(argv: string[], flag: string, offset = 0) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1 + offset] : undefined;
}

function withoutRunOption(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  if (index < 0) return argv;
  return [...argv.slice(0, index), ...argv.slice(index + 2)];
}

function daemonDir() {
  return resolve(userStateHome(), "natalia-cli", "daemon");
}

function waitSignal() {
  return new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}
