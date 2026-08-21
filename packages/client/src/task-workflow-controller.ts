import type { CapabilityRegistryView } from "@natalia/capability";
import { resolveConfig } from "@natalia/config";
import { RuntimeRefusal, type RuntimeClient } from "@natalia/contracts";
import { NataliaDocumentStore } from "@natalia/workflow";
import { assertConfigApplied, taskPermissionPreview } from "./task-controller";
import { assertTaskReferences } from "./task-preflight";
import {
  deleteFlowDocument as deleteFlowDocumentFile,
  saveFlowDocument as saveFlowDocumentFile,
} from "./flow-document";
import {
  configureTaskSystemd,
  deleteTaskDocument,
  removeTaskSystemd,
  saveTaskDocument,
} from "./task-document";
import {
  flowOverview as flowOverviewForWorkspace,
  scheduledTaskOverview,
} from "./task-overview";
import { workflowContributionsProjection } from "./workflow-contributions";
import { workflowDocumentCatalog } from "./workflow-document-catalog";

type Method<K extends keyof RuntimeClient> = NonNullable<RuntimeClient[K]>;

export type TaskWorkflowController = {
  taskOverview: Method<"taskOverview">;
  flowOverview: Method<"flowOverview">;
  documentCatalog: Method<"documentCatalog">;
  saveFlowDocument: Method<"saveFlowDocument">;
  taskPermissionPreview: Method<"taskPermissionPreview">;
  deleteFlowDocument: Method<"deleteFlowDocument">;
  saveTaskDocument: Method<"saveTaskDocument">;
  deleteTaskDocument: Method<"deleteTaskDocument">;
  taskSchedule: Method<"taskSchedule">;
  taskUnschedule: Method<"taskUnschedule">;
};

export function createTaskWorkflowController(input: {
  workspaceRoot: string;
  globalConfigPath?: string;
  runtimeConfig(): import("@natalia/contracts").ConfigV3 | undefined;
  capabilityViews(): CapabilityRegistryView[];
  publishDiagnostic(message: string): void;
}): TaskWorkflowController {
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

  return {
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
      const permissions = taskPermissionPreview({ task, flow, config });
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
        executable: process.execPath,
        cliEntry: process.argv[1],
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
}
