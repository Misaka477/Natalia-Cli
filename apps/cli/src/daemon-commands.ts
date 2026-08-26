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
  type RuntimeServiceClient,
} from "@natalia/client";
import { createWorkflowSchedulerHost } from "@natalia/workflow-scheduler";
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
import { pluginStoreRoot } from "./official-plugins";
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
import { createHttpTransportHost } from "./transport-host";
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

export async function handleDaemonCommands(argv: string[]) {
  const subcommand = argv[0];
  if (
    !new Set([
      "daemon",
      "--daemon-serve",
      "daemon-status",
      "--daemon-status",
      "daemon-stop",
      "--daemon-stop",
    ]).has(subcommand ?? "")
  )
    return false;
  const configPath =
    process.env.NATALIA_CONFIG ?? `${process.cwd()}/.natalia/config.json`;
  switch (subcommand) {
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
      const token = await daemonToken(store);
      const maxConcurrentTasks = Number(
        valueAfter(argv, "--max-concurrent-tasks") ?? "1",
      );
      if (!Number.isInteger(maxConcurrentTasks) || maxConcurrentTasks <= 0)
        throw new Error("daemon requires a positive --max-concurrent-tasks");
      const taskSchedulerHost = createWorkflowSchedulerHost({
        globalConcurrency: maxConcurrentTasks,
        workspaceConcurrency: 1,
        queueTimeoutMs: Number(
          valueAfter(argv, "--queue-timeout-ms") ?? "300000",
        ),
      });
      const taskScheduler = taskSchedulerHost.scheduler;
      const workspaceHosts = new Map<
        string,
        Promise<{
          capabilities: CapabilityHost;
          executions: CapabilityExecutionHost;
          runtime: RuntimeServiceClient;
        }>
      >();
      try {
        const workspaceHost = async (workspaceRoot: string) => {
          const root = resolve(workspaceRoot);
          const existing = workspaceHosts.get(root);
          if (existing) return existing;
          const created = (async () => {
            const capabilities = new CapabilityHost({ workspaceRoot: root });
            const runtime = createRealRuntimeClient({
              workspaceRoot: root,
              pluginStoreRoot: pluginStoreRoot(),
              capabilityHost: capabilities,
            });
            return {
              capabilities,
              runtime,
              executions: new CapabilityExecutionHost(capabilities, {
                scheduler: taskScheduler,
                resolveService: (serviceID) => runtime.service(serviceID),
              }),
            };
          })();
          workspaceHosts.set(root, created);
          return await created;
        };
        const client = createRealRuntimeClient({
          pluginStoreRoot: pluginStoreRoot(),
        });
        const transport = createHttpTransportHost({
          client,
          port,
          token,
          taskExecution: true,
          // Delivery reuses the very same controller a one-shot run uses, so the
          // resident path cannot drift from it or bypass its policy.
          startTask: async (request) => {
            const workspaceRoot = resolve(
              request.workspaceRoot ?? process.cwd(),
            );
            const config = assertConfigApplied(
              await resolveConfig({ workspaceRoot }),
            );
            return await (
              await workspaceHost(workspaceRoot)
            ).executions.runTask({
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
      } finally {
        await taskSchedulerHost.close();
        for (const hostPromise of workspaceHosts.values()) {
          const host = await hostPromise;
          await host.runtime.dispose?.();
          host.capabilities.dispose();
        }
      }
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
          await stopRuntimeDaemon(
            createRuntimeDaemonStore({ dir: daemonDir() }),
          ),
          null,
          2,
        ),
      );
      break;
    }
  }
  return true;
}
