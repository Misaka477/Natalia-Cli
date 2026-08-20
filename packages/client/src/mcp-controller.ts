import type { RuntimeEvent } from "@natalia/contracts";
import { loadNativeMCPTools } from "@natalia/mcp";
import type { ToolRegistry } from "@natalia/tools";
import type { MCPServerConfig } from "@natalia/contracts";

/**
 * The MCP resource controller — fourth cut of the resource controllers
 * split (mainline plan §15). It owns the native MCP connections: loading the
 * configured servers at startup and reconnecting them when
 * `mcp.server.add`/`mcp.server.remove` change the config, so a config change
 * takes effect without a restart. Per-server status and diagnostics are
 * published; the old connections are closed before the new ones open.
 *
 * Multi-session shape (plan §41.9): `servers()` is an accessor over the
 * runtime's current config, and the module holds no session state.
 */
export function createMcpController(input: {
  servers(): Record<string, MCPServerConfig>;
  workspaceRoot: string;
  tools: ToolRegistry;
  enabled(): boolean;
  publish(event: RuntimeEvent): void;
}) {
  const cleanup: Array<() => Promise<void>> = [];
  const access: Array<{
    catalog(): Promise<import("@natalia/contracts").MCPCatalogSnapshot>;
    getPrompt(
      server: string,
      name: string,
      arguments_?: Record<string, string>,
    ): Promise<unknown>;
    readResource(server: string, uri: string): Promise<unknown>;
  }> = [];

  async function reload() {
    if (!input.enabled()) return;
    await Promise.all(cleanup.splice(0).map((close) => close()));
    access.length = 0;
    const nativeMCP = await loadNativeMCPTools({
      registry: input.tools,
      servers: input.servers(),
      workspaceRoot: input.workspaceRoot,
      onDiagnostic: (server, message) =>
        input.publish({
          type: "diagnostic",
          level: "info",
          owner: `mcp:${server}`,
          message,
        }),
    });
    cleanup.push(nativeMCP.close);
    access.push(nativeMCP);
    for (const [server, status] of Object.entries(nativeMCP.statuses))
      input.publish({ type: "mcp.status", server, ...status });
    if (nativeMCP.loaded)
      input.publish({
        type: "diagnostic",
        level: "info",
        owner: "mcp",
        message: `Loaded ${nativeMCP.loaded} native MCP tool(s) from TS config.`,
      });
  }

  async function close() {
    await Promise.all(cleanup.splice(0).map((close) => close()));
    access.length = 0;
  }

  return { reload, close, access };
}

export type McpController = ReturnType<typeof createMcpController>;
export type McpAccess = McpController["access"];
