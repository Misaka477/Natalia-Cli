import {
  assertConfigApplied,
  assertTaskReferences,
  configureTaskSystemd,
  scheduledTaskOverview,
  type ScheduledTaskOverview,
  createRealRuntimeClient,
  EGRESS_ADVISORY,
  newHeadlessExecution,
  plainRuntimeEvent,
  manualFlowTask,
  runTask,
  runTaskFromDocument,
  CapabilityExecutionHost,
  createWorkflowSchedulerPluginHost,
  CapabilityHost,
  removeTaskSystemd,
  taskPermissionPreview,
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
  createIssueTarget,
  deliverPendingTaskAlerts,
  evaluateAndRecordModule,
  findingFingerprint,
  readDataSourceSince,
  NataliaDocumentStore,
  NataliaTaskAlertQueue,
  NataliaTaskStateStore,
  NataliaUnattendedStateStore,
  reconcileFinding,
  taskAlertEventKindForStatus,
  type EvaluatorModuleContext,
  type NataliaTaskAttemptStatus,
  type NataliaPlannedFlowModule,
  type NataliaTaskInvocation,
} from "@natalia/workflow";
import { providerForModel } from "@natalia/runtime";
import { createRecordedFetch, readCassette } from "@natalia/transport";
import {
  createRuntimeDaemonStore,
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
} from "@natalia/transport/host";
import {
  createHttpTransportPluginHost,
  TRANSPORT_PLUGIN_ID,
} from "./transport-plugin";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  deleteLocalSession,
  duplicateLocalSession,
  exportLocalSessionMetadata,
  importLocalSessionMetadata,
  doctorReport,
  installOutOfTreeToolFamily,
  installRegistryToolFamily,
  installToolFamily,
  listLocalSessions,
  plainStatus,
  renameLocalSession,
  setLocalSessionPinned,
  sessionTable,
  promptArguments,
  toolFamilyCatalogue,
  trustList,
  trustRemove,
  uninstallToolFamily,
  workspaceFilesystemCommand,
  showLocalSession,
  startupDiagnostics,
  localWorkGraph,
  workGraphLines,
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
    const transportIsEnabled = await transportEnabled();
    const client = createRealRuntimeClient();
    const transport = await createHttpTransportPluginHost({
      client,
      port,
      token: process.env.NATALIA_TRANSPORT_TOKEN,
      enabled: transportIsEnabled,
    });
    const { server } = transport;
    console.log(
      JSON.stringify({
        url: server.url,
        auth: process.env.NATALIA_TRANSPORT_TOKEN
          ? "bearer required"
          : "disabled",
      }),
    );
    await waitSignal();
    await transport.close();
    // Without dispose the initialized runtime keeps its native input broker
    // socket and watcher handles, so a SIGTERM'd server process never exits
    // (observed zombie daemon holding the port).
    await client.dispose?.();
    break;
  }

  case "daemon":
  case "--daemon-serve": {
    const store = createRuntimeDaemonStore({
      dir: valueAfter(argv, "--daemon-dir") ?? daemonDir(),
    });
    // The port is the first argument after the subcommand. It used to be read one
    // position further along, so neither form could actually choose a port.
    const requestedPort = valueAfter(argv, subcommand);
    const port = Number(requestedPort ?? "8787");
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw new Error("daemon requires a valid port");
    const transportIsEnabled = await transportEnabled();
    const token = await daemonToken(store);
    const maxConcurrentTasks = Number(
      valueAfter(argv, "--max-concurrent-tasks") ?? "1",
    );
    if (!Number.isInteger(maxConcurrentTasks) || maxConcurrentTasks <= 0)
      throw new Error("daemon requires a positive --max-concurrent-tasks");
    const taskSchedulerHost = await createWorkflowSchedulerPluginHost({
      globalConcurrency: maxConcurrentTasks,
      workspaceConcurrency: 1,
      queueTimeoutMs: Number(
        valueAfter(argv, "--queue-timeout-ms") ?? "300000",
      ),
    });
    const taskScheduler = taskSchedulerHost.scheduler;
    const workspaceHosts = new Map<
      string,
      { capabilities: CapabilityHost; executions: CapabilityExecutionHost }
    >();
    const workspaceHost = (workspaceRoot: string) => {
      const root = resolve(workspaceRoot);
      const existing = workspaceHosts.get(root);
      if (existing) return existing;
      const capabilities = new CapabilityHost({ workspaceRoot: root });
      const created = {
        capabilities,
        executions: new CapabilityExecutionHost(capabilities, {
          scheduler: taskScheduler,
        }),
      };
      workspaceHosts.set(root, created);
      return created;
    };
    const client = createRealRuntimeClient();
    const transport = await createHttpTransportPluginHost({
      client,
      port,
      token,
      enabled: transportIsEnabled,
      taskExecution: true,
      // Delivery reuses the very same controller a one-shot run uses, so the
      // resident path cannot drift from it or bypass its policy.
      startTask: async (request) => {
        const workspaceRoot = resolve(request.workspaceRoot ?? process.cwd());
        const config = assertConfigApplied(
          await resolveConfig({ workspaceRoot }),
        );
        return workspaceHost(workspaceRoot).executions.runTask({
          workspaceRoot,
          path: request.taskPath,
          taskID: request.taskID,
          idempotencyKey: request.idempotencyKey,
          idempotencyFingerprint: JSON.stringify(request),
          config,
          json: request.json !== false,
          requestedBy: { transport: "http" },
        });
      },
    });
    const { server } = transport;
    await registerRuntimeDaemon(store, {
      url: server.url,
      pid: process.pid,
      transport: "http",
    });
    console.log(JSON.stringify({ url: server.url }));
    await waitSignal();
    await transport.close();
    // The daemon must dispose the runtime it started: the native input broker
    // socket and the workspace watcher keep the process alive otherwise, and
    // a daemon that survives SIGTERM holds its port forever (the zombie-daemon
    // defect this closes). The smoke that delivers tasks also depends on this
    // instead of its SIGKILL fallback.
    await client.dispose?.();
    await taskSchedulerHost.close();
    for (const host of workspaceHosts.values()) host.capabilities.dispose();
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
    if (action === "list") {
      const workspaceRoot = resolve(
        valueAfter(argv, "--workspace") ?? process.cwd(),
      );
      const overview = await scheduledTaskOverview({
        workspaceRoot,
        config: assertConfigApplied(await resolveConfig({ workspaceRoot })),
      });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(overview, null, 2)
          : taskListLines(overview).join("\n"),
      );
      // A broken entry must be visible in the exit code too, or a scheduled
      // workspace can rot without anyone noticing.
      if (
        overview.unreadable.length ||
        overview.tasks.some((task) => task.problems.length)
      )
        process.exitCode = 1;
      break;
    }
    if (
      !taskPath ||
      (action !== "validate" &&
        action !== "run" &&
        action !== "run-id" &&
        action !== "timer" &&
        action !== "timer-remove" &&
        action !== "status" &&
        action !== "preview" &&
        action !== "submit")
    )
      throw new Error(
        "task requires 'list', or 'validate', 'run', 'run-id', 'status', 'preview', 'submit', 'timer' or 'timer-remove' followed by a task path or ID",
      );
    const workspaceRoot = resolve(
      valueAfter(argv, "--workspace") ?? process.cwd(),
    );
    const store = new NataliaDocumentStore(workspaceRoot);
    const task =
      action === "run-id"
        ? await store.loadTaskByID(taskPath)
        : action === "timer" || action === "timer-remove"
          ? await store.loadTaskDocument(taskPath)
          : await store.loadTask(taskPath);
    if (action === "timer-remove") {
      const result = await removeTaskSystemd({ workspaceRoot, path: taskPath });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(result)
          : result.commands.length
            ? result.commands.join("\n")
            : `removed timer metadata for ${task.taskID}`,
      );
      break;
    }
    if (action === "timer") {
      if (!task.systemd)
        throw new Error(
          `task ${task.taskID} has no explicit systemd calendar; edit its schedule first`,
        );
      const timerConfig = assertConfigApplied(
        await resolveConfig({ workspaceRoot }),
      );
      const row = (
        await scheduledTaskOverview({ workspaceRoot, config: timerConfig })
      ).tasks.find((entry) => entry.path === taskPath);
      if (!row) throw new Error(`task not found in overview: ${taskPath}`);
      if (row.problems.length)
        throw new Error(
          `task timer cannot be installed while the task needs attention: ${row.problems.join("; ")}`,
        );
      const result = await configureTaskSystemd({
        workspaceRoot,
        path: taskPath,
        calendar: task.systemd.calendar,
        scope: task.systemd.scope,
        executable: "natalia-ts",
      });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(result)
          : result.commands.length
            ? result.commands.join("\n")
            : `installed ${result.units.timerUnit}`,
      );
      break;
    }
    const flow = await store.resolveTaskFlow(task);
    if (action === "run" || action === "run-id") {
      const runConfig = assertConfigApplied(
        await resolveConfig({ workspaceRoot }),
      );
      const result = await runTask({
        workspaceRoot,
        task,
        flow,
        config: runConfig,
        json: argv.includes("--json"),
        emit: (line) => console.log(line),
      });
      if (result.exitCode) process.exitCode = result.exitCode;
      break;
    }
    if (action === "submit") {
      const submitted = await submitTaskToDaemon({
        taskPath,
        workspaceRoot,
        json: argv.includes("--json"),
      });
      if (submitted.exitCode) process.exitCode = submitted.exitCode;
      break;
    }
    if (action === "preview") {
      const preview = taskPermissionPreview({
        task,
        flow,
        config: assertConfigApplied(await resolveConfig({ workspaceRoot })),
      });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(preview, null, 2)
          : taskPreviewLines(preview).join("\n"),
      );
      if (preview.blocked.length) process.exitCode = 1;
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
    const validateConfig = assertConfigApplied(
      await resolveConfig({ workspaceRoot }),
    );
    const references = assertTaskReferences({
      task,
      config: validateConfig,
    });
    const permissions = taskPermissionPreview({
      task,
      flow,
      config: validateConfig,
    });
    // A stage with no minimum condition gives the evaluator nothing to verify, so
    // it could be "completed" by an empty claim. That is a vacuous stage, not a
    // configured one.
    const conditionless = flow.modules.filter(
      (module) => module.enabled && !module.minimumConditions.length,
    );
    if (conditionless.length)
      throw new Error(
        `task flow has stages without a minimum completion condition: ${conditionless
          .map((module) => module.id)
          .join(", ")}`,
      );
    if (permissions.blocked.length)
      throw new Error(
        `task flow cannot complete under ${task.permissionProfile}: ${permissions.blocked
          .map((entry) => `${entry.moduleID}: ${entry.reason}`)
          .join("; ")}`,
      );
    const result = {
      taskID: task.taskID,
      displayName: task.displayName,
      permissionProfile: task.permissionProfile,
      flowID: flow.flowID,
      flowDisplayName: flow.displayName,
      modules: flow.modules.filter((module) => module.enabled).length,
      references,
      status: "valid",
    };
    console.log(
      argv.includes("--json")
        ? JSON.stringify(result)
        : `task ${result.taskID}: valid\nflow ${result.flowID}: ${result.modules} enabled modules`,
    );
    break;
  }

  case "flow": {
    const action = argv[1];
    const flowPath = argv[2];
    if (action !== "run" || !flowPath)
      throw new Error("flow requires 'run' followed by a flow path");
    const workspaceRoot = resolve(
      valueAfter(argv, "--workspace") ?? process.cwd(),
    );
    const documents = new NataliaDocumentStore(workspaceRoot);
    const flow = await documents.loadFlow(
      flowPath.startsWith(".natalia/")
        ? flowPath
        : `.natalia/flows/${flowPath}`,
    );
    const config = assertConfigApplied(await resolveConfig({ workspaceRoot }));
    const result = await runTask({
      workspaceRoot,
      task: manualFlowTask(flow, config),
      flow,
      config,
      json: argv.includes("--json"),
      emit: (line) => console.log(line),
    });
    if (result.exitCode) process.exitCode = result.exitCode;
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

  case "workgraph": {
    const action = argv[1] ?? "list";
    const sessionID = argv[2];
    if (action !== "list" || !sessionID)
      throw new Error("workgraph list requires a session ID");
    const graph = await localWorkGraph(
      sessionID,
      valueAfter(argv, "--workspace") ?? process.cwd(),
    );
    console.log(
      argv.includes("--json")
        ? JSON.stringify(graph, null, 2)
        : workGraphLines(graph).join("\n"),
    );
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
            `default model: ${report.defaultModel.key} (${report.defaultModel.selected ? "selected" : (report.defaultModel.reason ?? "unavailable")})`,
            `sessions: ${report.sessions.count} (${report.sessions.pendingInputs} pending inputs)`,
            EGRESS_ADVISORY,
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
    const transportIsEnabled = await transportEnabled();
    const record = createRecordedFetch({ mode: "record", cassettePath });
    const client = createRealRuntimeClient();
    const transport = await createHttpTransportPluginHost({
      client,
      port: Number(argv[2] ?? "8787"),
      enabled: transportIsEnabled,
    });
    const { server } = transport;
    globalThis.fetch = record as typeof globalThis.fetch;
    console.log(JSON.stringify({ url: server.url, cassette: cassettePath }));
    await waitSignal();
    await transport.close();
    await client.dispose?.();
    break;
  }

  case "install": {
    const target = argv[1];
    if (!target)
      throw new Error("install requires a tool family id or a directory");
    const workspaceRoot = valueAfter(argv, "--workspace") ?? process.cwd();
    // A directory installs an out-of-tree family package and records its trust;
    // anything else is a built-in family id.
    const dir = resolve(workspaceRoot, target);
    if (existsSync(resolve(dir, "natalia.tool.json"))) {
      console.log(
        JSON.stringify(
          await installOutOfTreeToolFamily({ workspaceRoot, dir: target }),
          null,
          2,
        ),
      );
      break;
    }
    const builtin = toolFamilyCatalogue().find(
      (family) => family.id === target,
    );
    if (!builtin && /[@/]|\.(tgz|tar\.gz)$|^[a-z0-9-]+@/iu.test(target)) {
      // A registry package spec: forward to the package manager.
      console.log(
        JSON.stringify(
          await installRegistryToolFamily({ workspaceRoot, spec: target }),
          null,
          2,
        ),
      );
      break;
    }
    console.log(
      JSON.stringify(
        await installToolFamily({ workspaceRoot, familyID: target }),
        null,
        2,
      ),
    );
    break;
  }

  case "trust": {
    const action = argv[1] as "list" | "remove" | undefined;
    const workspaceRoot = valueAfter(argv, "--workspace") ?? process.cwd();
    if (action === "list") {
      console.log(JSON.stringify(await trustList(workspaceRoot), null, 2));
      break;
    }
    if (action === "remove") {
      const key = argv[2];
      if (!key) throw new Error("trust remove requires a key");
      console.log(
        JSON.stringify(await trustRemove(workspaceRoot, key), null, 2),
      );
      break;
    }
    throw new Error("trust requires list or remove");
  }

  case "uninstall": {
    const familyID = argv[1];
    if (!familyID) throw new Error("uninstall requires a tool family id");
    console.log(
      JSON.stringify(
        await uninstallToolFamily({
          workspaceRoot: valueAfter(argv, "--workspace") ?? process.cwd(),
          familyID,
        }),
        null,
        2,
      ),
    );
    break;
  }

  case "tool": {
    const action = argv[1] as "list" | undefined;
    if (action !== "list") throw new Error("tool requires list");
    console.log(JSON.stringify(toolFamilyCatalogue(), null, 2));
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

function taskListLines(overview: ScheduledTaskOverview) {
  if (!overview.tasks.length && !overview.unreadable.length)
    return ["no task documents under .natalia/tasks"];
  const lines: string[] = [];
  for (const task of overview.tasks) {
    lines.push(
      `${task.problems.length ? "!" : " "} ${task.taskID}  ${task.displayName}`,
      `    schedule: ${task.schedule}  profile: ${task.permissionProfile}  retry: ${task.retry}`,
      `    flow ${task.flowID}: ${task.enabledModules} enabled stages`,
      `    last run: ${
        task.lastRun
          ? `${task.lastRun.status} at ${task.lastRun.startedAt}${task.lastRun.skipReason ? ` (${task.lastRun.skipReason})` : ""}`
          : "never"
      }`,
    );
    if (task.consecutiveFailures)
      lines.push(`    consecutive failures: ${task.consecutiveFailures}`);
    if (task.pendingAlertDeliveries)
      lines.push(
        `    pending alert deliveries: ${task.pendingAlertDeliveries}`,
      );
    if (task.systemd)
      lines.push(
        `    timer: ${task.systemd.timerUnit ?? "not generated"} (${task.systemd.scope})`,
        `    next run: ${task.systemd.nextRun ?? "not active"}`,
      );
    for (const problem of task.problems) lines.push(`    problem: ${problem}`);
  }
  for (const broken of overview.unreadable)
    lines.push(`! ${broken.path}: ${broken.reason}`);
  return lines;
}

function taskPreviewLines(preview: ReturnType<typeof taskPermissionPreview>) {
  const lines = [
    `task ${preview.taskID} under profile ${preview.permissionProfile}`,
    `flow ${preview.flowID}`,
  ];
  for (const module of preview.modules) {
    lines.push(
      `  ${module.enabled ? "" : "(disabled) "}${module.moduleID} [${module.moduleType}] ${module.displayName}`,
      `    tools: ${module.tools.allowed.join(", ") || "none"}`,
    );
    if (module.tools.denied.length)
      lines.push(`    denied: ${module.tools.denied.join(", ")}`);
    if (module.commandRules.profile)
      lines.push(
        `    profile commands (${module.commandRules.profile.mode}): ${module.commandRules.profile.commands.join(", ") || "none"}`,
      );
    if (module.commandRules.module)
      lines.push(
        `    module commands (${module.commandRules.module.mode}): ${module.commandRules.module.commands.join(", ") || "none"}`,
      );
    if (
      module.interactivePrograms === "any" ||
      module.interactivePrograms.length
    )
      lines.push(
        `    interactive programs: ${
          module.interactivePrograms === "any"
            ? "any"
            : module.interactivePrograms.join(", ")
        }`,
      );
    if (module.blocked) lines.push(`    BLOCKED: ${module.blocked}`);
  }
  if (preview.blocked.length)
    lines.push(
      `blocked stages: ${preview.blocked.map((entry) => entry.moduleID).join(", ")}`,
    );
  return lines;
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
      issueTarget: input.task.issueTarget,
      dataSource: input.task.dataSource,
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

function valueAfter(argv: string[], flag: string, offset = 0) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1 + offset] : undefined;
}

function withoutRunOption(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  if (index < 0) return argv;
  return [...argv.slice(0, index), ...argv.slice(index + 2)];
}

/** Submits a task to the resident executor and mirrors its outcome. */
async function submitTaskToDaemon(input: {
  taskPath: string;
  workspaceRoot: string;
  json: boolean;
}) {
  const store = createRuntimeDaemonStore({ dir: daemonDir() });
  const status = await runtimeDaemonStatus(store);
  if (status.state !== "running")
    throw new Error(
      `task submit requires a running Natalia daemon (${status.state})`,
    );
  const token = await daemonToken(store);
  const response = await fetch(
    new URL("/tasks/run", status.registration.url).href,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        taskPath: input.taskPath,
        workspaceRoot: input.workspaceRoot,
        json: input.json,
      }),
    },
  );
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      `task delivery failed: ${String(payload.error ?? response.status)}`,
    );
  for (const line of (payload.output as string[] | undefined) ?? [])
    console.log(line);
  return payload as unknown as { exitCode: number };
}

function daemonDir() {
  return resolve(userStateHome(), "natalia-cli", "daemon");
}

async function transportEnabled() {
  const resolved = await resolveConfig({
    workspaceRoot: process.cwd(),
    ...(process.env.NATALIA_CONFIG
      ? { globalPath: process.env.NATALIA_CONFIG }
      : {}),
  });
  return resolved.config.plugins.enabled[TRANSPORT_PLUGIN_ID] !== false;
}

function waitSignal() {
  return new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}
