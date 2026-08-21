import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createMcpControllerPlugin,
  MCP_CONTROLLER_SERVICE,
  MCP_PLUGIN_ID,
  type McpController,
} from "../src/builtin-plugins/mcp-controller-plugin";
import { createMcpController } from "../src/mcp-controller";

const SERVER = String.raw`
import readline from "node:readline";
const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (!("id" in message)) return;
  let result = {};
  if (message.method === "initialize") {
    result = {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "fixture", version: "1" },
    };
  } else if (message.method === "tools/list") {
    result = {
      tools: [{ name: "echo", description: "echo", inputSchema: { type: "object" } }],
    };
  }
  console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
});
`;

test("MCP controller reload is a no-op when the extension is disabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mcp-controller-"));
  const events: Array<{ type: string }> = [];
  const controller = createMcpController({
    servers: () => ({}),
    workspaceRoot: root,
    tools: createToolRegistry([]),
    enabled: () => false,
    publish: (event) => events.push(event),
  });
  await controller.reload();
  expect(controller.access).toHaveLength(0);
  await controller.close();
  expect(events).toHaveLength(0);
});

test("MCP plugin unload owns connection and tool teardown", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mcp-plugin-"));
  const tools = createToolRegistry([]);
  let controller: McpController | undefined;
  const registry = createPluginRegistry({
    tools,
    contribute: async () => (kind, name, payload) => {
      if (kind === "services" && name === MCP_CONTROLLER_SERVICE)
        controller = payload as McpController;
      return () => undefined;
    },
  });
  await registry.loadBuiltin(
    createMcpControllerPlugin({
      servers: () => ({
        fixture: {
          type: "stdio",
          command: process.execPath,
          args: ["-e", SERVER],
          headers: {},
          environment: {},
          allowedTools: [],
          excludedTools: [],
          readOnly: true,
          enabled: true,
          timeoutSec: 5,
        },
      }),
      workspaceRoot: root,
      tools,
      enabled: () => true,
      publish: () => undefined,
    }),
  );
  expect(controller).toBeDefined();
  await controller?.reload();
  expect(tools.get("mcp_fixture_echo")).toBeDefined();
  expect(controller?.access).toHaveLength(1);

  await registry.unload(MCP_PLUGIN_ID);
  expect(tools.get("mcp_fixture_echo")).toBeUndefined();
  expect(controller?.access).toHaveLength(0);
});
