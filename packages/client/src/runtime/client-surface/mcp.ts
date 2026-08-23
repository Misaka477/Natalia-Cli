import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { updateConfigAtScope } from "@natalia/config";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  | "mcpCatalog"
  | "getMcpPrompt"
  | "readMcpResource"
  | "mcpServerAdd"
  | "mcpServerRemove"
>;
export function createMcpSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async mcpCatalog() {
      return (
        (await ctx.ports.getMcpService()?.catalog()) ?? {
          prompts: [],
          resources: [],
        }
      );
    },
    async getMcpPrompt(server, name, arguments_) {
      if (!ctx.ports.getMcpService())
        throw new Error(`MCP server is not connected: ${server}`);
      return await ctx.ports
        .getMcpService()!
        .getPrompt(server, name, arguments_);
    },
    async readMcpResource(server, uri) {
      if (!ctx.ports.getMcpService())
        throw new Error(`MCP server is not connected: ${server}`);
      return await ctx.ports.getMcpService()!.readResource(server, uri);
    },
    async mcpServerAdd(input) {
      await ctx.ports.getReady();
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          mcpServers: { [input.name]: input.config },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { saved: true };
    },
    async mcpServerRemove(name) {
      await ctx.ports.getReady();
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        {
          mcpServers: { [name]: undefined },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await ctx.ports.applyConfigFromDisk();
      return { removed: true };
    },
  };
}
