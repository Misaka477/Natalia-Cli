import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  findWorkspaceFiles,
  globWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
} from "@natalia/platform";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  | "workspaceFiles"
  | "workspaceSearch"
  | "workspaceList"
  | "workspaceRead"
  | "workspaceGlob"
>;
export function createWorkspaceSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async workspaceFiles(input) {
      await ctx.ports.getReady();
      return await findWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceSearch(input) {
      await ctx.ports.getReady();
      return await searchWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceList(input) {
      await ctx.ports.getReady();
      return await listWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceRead(input) {
      await ctx.ports.getReady();
      return await readWorkspaceFile({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
    async workspaceGlob(input) {
      await ctx.ports.getReady();
      return await globWorkspaceFiles({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
  };
}
