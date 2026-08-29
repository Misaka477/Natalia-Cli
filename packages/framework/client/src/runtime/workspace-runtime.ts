import {
  findWorkspaceFiles,
  globWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  writeWorkspaceFile,
} from "@natalia/platform";
import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";

type WorkspaceRuntime = Pick<
  RuntimeServiceClient,
  | "workspaceFiles"
  | "workspaceSearch"
  | "workspaceList"
  | "workspaceRead"
  | "workspaceGlob"
  | "workspaceWrite"
>;

export function createWorkspaceRuntime(ctx: RuntimeContext): WorkspaceRuntime {
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
    async workspaceWrite(input) {
      await ctx.ports.getReady();
      return await writeWorkspaceFile({
        workspaceRoot: ctx.ports.getWorkspaceRoot(),
        ...input,
      });
    },
  };
}
