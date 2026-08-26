export {
  createMcpPlugin,
  MCP_PLUGIN_ID,
  MCP_PLUGIN_MANIFEST,
} from "./mcp-controller-plugin";
import type { MCPServerConfig, RuntimeEvent } from "@natalia/contracts";
import type { Plugin, PluginAPI } from "@natalia/plugin";
import { createMcpPlugin, MCP_PLUGIN_MANIFEST } from "./mcp-controller-plugin";

export const MCP_INPUT_SERVICE = "mcp.input";
export type McpRuntimeInput = {
  servers(): Record<string, MCPServerConfig>;
  workspaceRoot: string;
  enabled(): boolean;
  publish(event: RuntimeEvent): void;
};

let mcpInstance: Plugin | undefined;
const mcpPlugin: Plugin = {
  manifest: {
    ...MCP_PLUGIN_MANIFEST,
    entry: "index.js",
    requires: [MCP_INPUT_SERVICE],
  },
  async setup(api: PluginAPI) {
    const input = api.services.get<McpRuntimeInput>(MCP_INPUT_SERVICE);
    if (!input)
      throw new Error(`missing runtime service: ${MCP_INPUT_SERVICE}`);
    mcpInstance = createMcpPlugin(input);
    await mcpInstance.setup(api);
  },
  async dispose() {
    await mcpInstance?.dispose?.();
    mcpInstance = undefined;
  },
};

export default mcpPlugin;
