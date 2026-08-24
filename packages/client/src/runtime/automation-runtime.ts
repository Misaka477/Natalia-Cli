import { RuntimeRefusal } from "@natalia/contracts";
import {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type RuntimeServiceClient,
  type TaskWorkflowController,
} from "@natalia/runtime-services";
import {
  loadFlowDocument as loadFlowDocumentForWorkspace,
  loadTaskDocument as loadTaskDocumentForWorkspace,
  previewSystemdCalendar as previewSystemdCalendarForWorkspace,
} from "@natalia/workflow";
import { installExampleDocuments } from "../example-documents";
import { decomposeFlowConditions } from "../flow-condition-decomposition";
import type { RuntimeContext } from "./context";
type Surface = Pick<
  RuntimeServiceClient,
  | "taskOverview"
  | "flowOverview"
  | "documentCatalog"
  | "loadFlowDocument"
  | "loadTaskDocument"
  | "installExampleDocuments"
  | "saveFlowDocument"
  | "deleteFlowDocument"
  | "saveTaskDocument"
  | "deleteTaskDocument"
  | "taskSchedule"
  | "taskUnschedule"
  | "taskPermissionPreview"
  | "taskPermissionPreviewDocument"
  | "previewSystemdCalendar"
  | "permissionProfileUsage"
  | "decomposeFlowConditions"
>;
export function createAutomationRuntime(ctx: RuntimeContext): Surface {
  function requireTaskWorkflow() {
    const controller = ctx.ports.resolveService<TaskWorkflowController>(
      TASK_WORKFLOW_CONTROLLER_SERVICE,
    );
    if (!controller)
      throw new RuntimeRefusal("Task/workflow plugin is disabled.");
    return controller;
  }
  return {
    async taskOverview() {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().taskOverview();
    },
    async flowOverview() {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().flowOverview();
    },
    async documentCatalog() {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().documentCatalog();
    },
    async loadFlowDocument(input) {
      await ctx.ports.ensureReady();
      return loadFlowDocumentForWorkspace({
        workspaceRoot: ctx.state.workspaceRoot,
        path: input.path,
      });
    },
    async loadTaskDocument(input) {
      await ctx.ports.ensureReady();
      return loadTaskDocumentForWorkspace({
        workspaceRoot: ctx.state.workspaceRoot,
        path: input.path,
      });
    },
    async installExampleDocuments(input) {
      await ctx.ports.ensureReady();
      return installExampleDocuments({
        workspaceRoot: ctx.state.workspaceRoot,
        includeTasks: input?.includeTasks,
      });
    },
    async previewSystemdCalendar(input) {
      await ctx.ports.ensureReady();
      return previewSystemdCalendarForWorkspace(input.calendar);
    },
    async permissionProfileUsage() {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().permissionProfileUsage({
        workspaceRoot: ctx.state.workspaceRoot,
      });
    },
    async decomposeFlowConditions(input) {
      await ctx.ports.ensureReady();
      return decomposeFlowConditions({
        config: ctx.state.tsRuntimeConfig,
        modelID: input.modelID,
        objective: input.objective,
      });
    },
    async saveFlowDocument(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().saveFlowDocument(input);
    },
    async taskPermissionPreview(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().taskPermissionPreview(input);
    },
    async taskPermissionPreviewDocument(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().taskPermissionPreviewDocument(input);
    },
    async deleteFlowDocument(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().deleteFlowDocument(input);
    },
    async saveTaskDocument(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().saveTaskDocument(input);
    },
    async deleteTaskDocument(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().deleteTaskDocument(input);
    },
    async taskSchedule(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().taskSchedule(input);
    },
    async taskUnschedule(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().taskUnschedule(input);
    },
  };
}
