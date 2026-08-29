import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { updateConfigAtScope } from "@natalia/config";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  "permissionList" | "permissionSave" | "permissionDelete"
>;
export function createManagementSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async permissionList() {
      await ctx.ports.getReady();
      const config = ctx.ports.getTsRuntimeConfig();
      if (!config) return { default: "ask", profiles: [] };
      return {
        default: config.defaultAgentMode,
        profiles: Object.entries(config.agentModes).map(
          ([name, profile]) => ({ name, ...profile }),
        ),
      };
    },
    async permissionSave(input) {
      await ctx.ports.getReady();
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          permissionProfiles: { [input.name]: input.profile },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      const result = await ctx.ports.applyConfigFromDisk();
      return {
        saved: true,
        applied: result.applied,
        reason: result.reason,
      };
    },
    async permissionDelete(name) {
      await ctx.ports.getReady();
      const config = ctx.ports.getTsRuntimeConfig();
      if (config && config.defaultAgentMode === name)
        return {
          deleted: false,
          reason: `permission profile is the active default: ${name}`,
        };
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          permissionProfiles: { [name]: undefined },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { deleted: true };
    },
  };
}
