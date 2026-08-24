import { RuntimeRefusal } from "@natalia/contracts";
import {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type RuntimeServiceClient,
  type TaskWorkflowController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  | "taskOverview"
  | "flowOverview"
  | "documentCatalog"
  | "saveFlowDocument"
  | "deleteFlowDocument"
  | "saveTaskDocument"
  | "deleteTaskDocument"
  | "taskSchedule"
  | "taskUnschedule"
  | "taskPermissionPreview"
>;
export function createAutomationSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
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
    async saveFlowDocument(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().saveFlowDocument(input);
    },
    async taskPermissionPreview(input) {
      await ctx.ports.ensureReady();
      return requireTaskWorkflow().taskPermissionPreview(input);
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
