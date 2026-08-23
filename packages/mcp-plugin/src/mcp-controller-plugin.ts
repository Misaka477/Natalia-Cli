/**
 * The MCP controller built-in plugin.
 *
 * Previously a visibility-only record; the controller now lives on the unified
 * plugin lifecycle. The plugin constructs it in `setup()` and provides it as the
 * `mcp.service` operational service, so a disabled or absent plugin opens no MCP
 * connections and loads no MCP tools.
 */
import type { Plugin } from "@natalia/plugin";
import type { MCPServerConfig, RuntimeEvent } from "@natalia/contracts";
import { createMcpController } from "./mcp-controller";
import { MCP_SERVICE } from "@natalia/runtime-services";

export const MCP_PLUGIN_ID = "natalia-mcp";

export function createMcpPlugin(input: {
  servers(): Record<string, MCPServerConfig>;
  workspaceRoot: string;
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
      provides: [MCP_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["tools", "services"],
    },
    setup(api) {
      controller = createMcpController({
        ...input,
        tools: { register: (tool) => api.tools.register(tool) },
      });
      api.services.provide(MCP_SERVICE, controller);
    },
    async dispose() {
      await controller?.close();
      controller = undefined;
    },
  };
}
