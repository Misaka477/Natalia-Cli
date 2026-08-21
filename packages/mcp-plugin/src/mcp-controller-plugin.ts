/**
 * The MCP controller built-in plugin.
 *
 * Previously a visibility-only record; the controller now lives on the unified
 * plugin lifecycle. The plugin constructs it in `setup()` and provides it as the
 * `mcp.controller` service, so a disabled or absent plugin opens no MCP
 * connections and loads no MCP tools.
 */
import type { Plugin } from "@natalia/plugin";
import type { MCPServerConfig, RuntimeEvent } from "@natalia/contracts";
import type { ToolRegistry } from "@natalia/tools";
import { createMcpController } from "./mcp-controller";

export type { McpAccess, McpController } from "./mcp-controller";

export const MCP_PLUGIN_ID = "natalia-mcp";
export const MCP_CONTROLLER_SERVICE = "mcp.controller";

export function createMcpControllerPlugin(input: {
  servers(): Record<string, MCPServerConfig>;
  workspaceRoot: string;
  tools: ToolRegistry;
  enabled(): boolean;
  publish(event: RuntimeEvent): void;
}): Plugin {
  let controller: ReturnType<typeof createMcpController> | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: MCP_PLUGIN_ID,
      version: "1.0.0",
      name: "MCP Server",
      description: "Native MCP connections and their tools.",
      entry: "natalia:mcp",
      scope: "session",
      provides: [MCP_CONTROLLER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      controller = createMcpController(input);
      api.services.provide(MCP_CONTROLLER_SERVICE, controller);
    },
    async dispose() {
      await controller?.close();
      controller = undefined;
    },
  };
}
