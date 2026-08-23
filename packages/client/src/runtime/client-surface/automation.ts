import type { RuntimeServiceClient } from "@natalia/runtime-services";
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
  return {
    async taskOverview() {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().taskOverview();
    },
    async flowOverview() {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().flowOverview();
    },
    async documentCatalog() {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().documentCatalog();
    },
    async saveFlowDocument(input) {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().saveFlowDocument(input);
    },
    async taskPermissionPreview(input) {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().taskPermissionPreview(input);
    },
    async deleteFlowDocument(input) {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().deleteFlowDocument(input);
    },
    async saveTaskDocument(input) {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().saveTaskDocument(input);
    },
    async deleteTaskDocument(input) {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().deleteTaskDocument(input);
    },
    async taskSchedule(input) {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().taskSchedule(input);
    },
    async taskUnschedule(input) {
      await ctx.ports.ensureReady();
      return ctx.ports.requireTaskWorkflow().taskUnschedule(input);
    },
  };
}
