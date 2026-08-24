import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { MCP_SERVICE, type McpService } from "@natalia/runtime-services";
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
      const mcp = ctx.ports.resolveService<McpService>(MCP_SERVICE);
      return (
        (await mcp?.catalog()) ?? {
          prompts: [],
          resources: [],
        }
      );
    },
    async getMcpPrompt(server, name, arguments_) {
      const mcp = ctx.ports.resolveService<McpService>(MCP_SERVICE);
      if (!mcp) throw new Error(`MCP server is not connected: ${server}`);
      return await mcp.getPrompt(server, name, arguments_);
    },
    async readMcpResource(server, uri) {
      const mcp = ctx.ports.resolveService<McpService>(MCP_SERVICE);
      if (!mcp) throw new Error(`MCP server is not connected: ${server}`);
      return await mcp.readResource(server, uri);
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
