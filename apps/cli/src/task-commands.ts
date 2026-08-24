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
  CapabilityHost,
  removeTaskSystemd,
  taskPermissionPreview,
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type RuntimeServiceClient,
  type TaskWorkflowService,
} from "@natalia/client";
import {
  createWorkflowExecutionStoreService,
  createWorkflowStoreService,
} from "@natalia/plugin-task-workflow";
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
  trustList,
  trustRemove,
  workspaceFilesystemCommand,
  showLocalSession,
  startupDiagnostics,
  localWorkGraph,
  workGraphLines,
} from "./index";
import { valueAfter, daemonDir, waitSignal } from "./command-helpers";
import {
  taskListLines,
  taskPreviewLines,
  taskStatusLines,
  taskStatusReport,
  submitTaskToDaemon,
} from "./task-command-support";
export async function handleTaskCommands(argv: string[]) {
  const subcommand = argv[0];
  if (!new Set(["task", "flow"]).has(subcommand ?? "")) return false;
  const configPath =
    process.env.NATALIA_CONFIG ?? `${process.cwd()}/.natalia/config.json`;
  switch (subcommand) {
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
      const store = createWorkflowStoreService({ workspaceRoot });
      const task =
        action === "run-id"
          ? await store.loadTaskByID(taskPath)
          : action === "timer" || action === "timer-remove"
            ? await store.loadTaskDocument(taskPath)
            : await store.loadTask(taskPath);
      if (action === "timer-remove") {
        const result = await removeTaskSystemd({
          workspaceRoot,
          path: taskPath,
        });
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
      const documents = createWorkflowStoreService({ workspaceRoot });
      const flow = await documents.loadFlow(
        flowPath.startsWith(".natalia/")
          ? flowPath
          : `.natalia/flows/${flowPath}`,
      );
      const config = assertConfigApplied(
        await resolveConfig({ workspaceRoot }),
      );
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
  }
  return true;
}
