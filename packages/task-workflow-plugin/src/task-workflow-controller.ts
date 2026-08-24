import type { CapabilityRegistryView } from "@natalia/capability";
import { assertConfigApplied, resolveConfig } from "@natalia/config";
import { RuntimeRefusal, type RuntimeClient } from "@natalia/contracts";
import {
  assertTaskReferences,
  configureTaskSystemd,
  deleteFlowDocument as deleteFlowDocumentFile,
  deleteTaskDocument,
  flowOverview as flowOverviewForWorkspace,
  NataliaDocumentStore,
  manualFlowTask,
  removeTaskSystemd,
  saveFlowDocument as saveFlowDocumentFile,
  saveTaskDocument,
  scheduledTaskOverview,
  workflowDocumentCatalog,
  type ResolveFlowPermissions,
} from "@natalia/workflow";
import { workflowContributionsProjection } from "@natalia/workflow";
import type { TaskWorkflowService } from "@natalia/runtime-services";
import {
  runTask,
  runTaskFromDocument,
  taskPermissionPreviewForDocument,
  type TaskRuntimeClientFactory,
} from "./task-execution-service";
import {
  newHeadlessExecution,
  plainRuntimeEvent,
  taskPermissionPreview,
  taskRetryMaxAttempts,
} from "@natalia/workflow";
import { createWorkflowStoreService } from "./workflow-store-service";
import { runCapabilityTask } from "./capability-execution-service";

type Method<K extends keyof RuntimeClient> = NonNullable<RuntimeClient[K]>;

export function createTaskWorkflowController(input: {
  workspaceRoot: string;
  globalConfigPath?: string;
  runtimeConfig(): import("@natalia/contracts").ConfigV3 | undefined;
  capabilityViews(): CapabilityRegistryView[];
  publishDiagnostic(message: string): void;
  resolveFlowPermissions: ResolveFlowPermissions;
  createRuntimeClient: TaskRuntimeClientFactory;
}): TaskWorkflowService {
  const publishedDiagnostics = new Set<string>();

  function contributedDocuments() {
    const projections = input
      .capabilityViews()
      .map((view) => workflowContributionsProjection(view));
    for (const message of projections.flatMap((entry) => entry.diagnostics)) {
      if (publishedDiagnostics.has(message)) continue;
      publishedDiagnostics.add(message);
      input.publishDiagnostic(message);
    }
    return Object.assign({}, ...projections.map((entry) => entry.documents));
  }

  const service: TaskWorkflowService = {
    async runCommand(kind, path, signal) {
      const config =
        input.runtimeConfig() ??
        assertConfigApplied(
          await resolveConfig({
            workspaceRoot: input.workspaceRoot,
            globalPath: input.globalConfigPath,
          }),
        );
      const documents = createWorkflowStoreService({
        workspaceRoot: input.workspaceRoot,
        contributedDocuments: contributedDocuments(),
      });
      const output: string[] = [];
      const emit = (line: string) => output.push(line);
      const result =
        kind === "task"
          ? await service.runTaskFromDocument({
              workspaceRoot: input.workspaceRoot,
              path,
              config,
              json: false,
              emit,
              signal,
            })
          : await (async () => {
              const flow = await documents.loadFlow(path);
              return await service.runTask({
                workspaceRoot: input.workspaceRoot,
                task: manualFlowTask(flow, config),
                flow,
                config,
                json: false,
                emit,
                signal,
              });
            })();
      return [
        ...output,
        `${kind} ${path}: ${result.status} (exit ${result.exitCode})`,
      ].join("\n");
    },
    runTask: (request) =>
      runTask({ ...request, createRuntimeClient: input.createRuntimeClient }),
    runTaskFromDocument: (request) =>
      runTaskFromDocument({
        ...request,
        contributedDocuments:
          request.contributedDocuments ?? contributedDocuments(),
        createRuntimeClient: input.createRuntimeClient,
      }),
    taskPermissionPreviewFor: taskPermissionPreview,
    taskPermissionPreviewForDocument,
    async permissionProfileUsage(request) {
      if (!request)
        throw new RuntimeRefusal(
          "permissionProfileUsage requires a workspaceRoot",
        );
      const documents = createWorkflowStoreService(request);
      const usage: Record<string, string[]> = {};
      for (const { task } of await documents.taskDocuments())
        usage[task.permissionProfile] = [
          ...(usage[task.permissionProfile] ?? []),
          task.taskID,
        ];
      return usage;
    },
    newHeadlessExecution,
    plainRuntimeEvent,
    taskRetryMaxAttempts,
    runCapabilityTask: (request) =>
      runCapabilityTask({
        ...request,
        runTaskFromDocument: (task) => service.runTaskFromDocument(task),
      }),
    async taskOverview() {
      const config =
        input.runtimeConfig() ??
        (
          await resolveConfig({
            workspaceRoot: input.workspaceRoot,
            globalPath: input.globalConfigPath,
          })
        ).config;
      return scheduledTaskOverview({
        workspaceRoot: input.workspaceRoot,
        config,
        contributedDocuments: contributedDocuments(),
        resolveFlowPermissions: input.resolveFlowPermissions,
      });
    },
    async flowOverview() {
      return flowOverviewForWorkspace({
        workspaceRoot: input.workspaceRoot,
        contributedDocuments: contributedDocuments(),
      });
    },
    async documentCatalog() {
      return workflowDocumentCatalog(
        input.workspaceRoot,
        input.runtimeConfig(),
        contributedDocuments(),
        input.resolveFlowPermissions,
      );
    },
    async saveFlowDocument(request) {
      if (request.path?.startsWith("cap:"))
        throw new RuntimeRefusal(
          "contributed document paths are read-only and cannot be saved",
        );
      const documents = new NataliaDocumentStore(input.workspaceRoot);
      const resolved = request.path ?? `${request.document.flowID}.yaml`;
      const existed = await documents
        .loadFlow(`.natalia/flows/${resolved}`)
        .then(
          () => true,
          () => false,
        );
      await saveFlowDocumentFile({
        workspaceRoot: input.workspaceRoot,
        path: request.path,
        document: request.document,
      });
      return {
        path: resolved,
        flowID: request.document.flowID,
        created: !existed,
        updated: existed,
      };
    },
    async taskPermissionPreview(request) {
      const config = assertConfigApplied(
        await resolveConfig({
          workspaceRoot: input.workspaceRoot,
          globalPath: input.globalConfigPath,
        }),
      );
      const path = request.path;
      if (
        !path ||
        path.startsWith("/") ||
        path.includes("..") ||
        path.includes("\\")
      )
        throw new RuntimeRefusal(
          "task document path must stay under .natalia/tasks as a relative file name",
        );
      const documents = new NataliaDocumentStore(
        input.workspaceRoot,
        contributedDocuments(),
      );
      const task = await documents.loadTaskDocument(path);
      const flow = await documents.resolveTaskFlow(task);
      const problems: string[] = [];
      try {
        assertTaskReferences({ task, config });
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
      const permissions = input.resolveFlowPermissions({
        profile: config.permissionProfiles[task.permissionProfile],
        flow,
        taskCapabilities: {
          reportIssue: Boolean(task.issueTarget),
          readDataSource: Boolean(task.dataSource),
        },
      });
      for (const entry of permissions.blocked)
        problems.push(`${entry.moduleID}: ${entry.reason}`);
      const conditionless = flow.modules
        .filter((module) => module.enabled && !module.minimumConditions.length)
        .map((module) => module.id);
      for (const moduleID of conditionless)
        problems.push(`${moduleID}: stage has no minimum completion condition`);
      return {
        taskID: task.taskID,
        displayName: task.displayName,
        permissionProfile: task.permissionProfile,
        flowID: flow.flowID,
        flowDisplayName: flow.displayName,
        enabledModules: flow.modules.filter((module) => module.enabled).length,
        blocked: permissions.blocked,
        conditionlessModules: conditionless,
        problems,
        valid: problems.length === 0,
      };
    },
    async taskPermissionPreviewDocument(request) {
      const config =
        input.runtimeConfig() ??
        assertConfigApplied(
          await resolveConfig({
            workspaceRoot: input.workspaceRoot,
            globalPath: input.globalConfigPath,
          }),
        );
      return service.taskPermissionPreviewForDocument({
        workspaceRoot: input.workspaceRoot,
        path: request.path,
        config,
      });
    },
    async deleteFlowDocument(request) {
      if (request.path.startsWith("cap:"))
        throw new RuntimeRefusal(
          "contributed document paths are read-only and cannot be deleted",
        );
      const existed = await new NataliaDocumentStore(input.workspaceRoot)
        .loadFlow(`.natalia/flows/${request.path}`)
        .then(
          () => true,
          () => false,
        );
      if (!existed)
        return { path: request.path, deleted: false, alreadyDeleted: true };
      await deleteFlowDocumentFile({
        workspaceRoot: input.workspaceRoot,
        path: request.path,
      });
      return { path: request.path, deleted: true, alreadyDeleted: false };
    },
    async saveTaskDocument(request) {
      if (request.path?.startsWith("cap:"))
        throw new RuntimeRefusal(
          "contributed document paths are read-only and cannot be saved",
        );
      const resolved = request.path ?? `${request.document.taskID}.yaml`;
      const existed = await new NataliaDocumentStore(input.workspaceRoot)
        .loadTask(resolved)
        .then(
          () => true,
          () => false,
        );
      await saveTaskDocument({
        workspaceRoot: input.workspaceRoot,
        path: request.path,
        document: request.document,
      });
      return {
        path: resolved,
        taskID: request.document.taskID,
        created: !existed,
        updated: existed,
      };
    },
    async deleteTaskDocument(request) {
      const existed = await new NataliaDocumentStore(input.workspaceRoot)
        .loadTask(request.path)
        .then(
          () => true,
          () => false,
        );
      if (!existed)
        return { path: request.path, deleted: false, alreadyDeleted: true };
      await deleteTaskDocument({
        workspaceRoot: input.workspaceRoot,
        path: request.path,
      });
      return { path: request.path, deleted: true, alreadyDeleted: false };
    },
    async taskSchedule(request) {
      const result = await configureTaskSystemd({
        workspaceRoot: input.workspaceRoot,
        path: request.path,
        calendar: request.calendar,
        scope: request.scope,
        executable: request.executable ?? process.execPath,
        // When the caller names the executable it also owns the entry: omitting
        // it means "no entry" (for example an installed `natalia-ts` command).
        // Without a caller override the host's own entry keeps daemon timers
        // pointing at the running binary.
        ...(request.cliEntry !== undefined
          ? { cliEntry: request.cliEntry }
          : request.executable !== undefined
            ? {}
            : process.argv[1]
              ? { cliEntry: process.argv[1] }
              : {}),
      });
      const task = await new NataliaDocumentStore(
        input.workspaceRoot,
      ).loadTaskDocument(request.path);
      return {
        path: request.path,
        taskID: task.taskID,
        timerUnit: result.units.timerUnit,
        scope: request.scope,
        normalizedCalendar: result.preview.normalized,
        next: result.preview.next,
        commands: result.commands,
      };
    },
    async taskUnschedule(request) {
      const task = await new NataliaDocumentStore(
        input.workspaceRoot,
      ).loadTaskDocument(request.path);
      const removed = Boolean(task.systemd?.timerUnit);
      const result = await removeTaskSystemd({
        workspaceRoot: input.workspaceRoot,
        path: request.path,
      });
      return { path: request.path, removed, commands: result.commands };
    },
  };
  return service;
}
