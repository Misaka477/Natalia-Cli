import { expect, test } from "bun:test";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createToolRegistry } from "@natalia/tools";
import {
  HttpMCPClient,
  loadLegacyMCPTools,
  mcpToolToRuntimeTool,
  StdioMCPClient,
} from "../src";

const SERVER = String.raw`
import json, sys
for line in sys.stdin:
  message = json.loads(line)
  if "id" not in message:
    continue
  method = message["method"]
  if method == "initialize":
    result = {"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"fixture","version":"1"}}
  elif method == "tools/list":
    result = {"tools":[{"name":"echo","description":"echo","inputSchema":{"type":"object"}}]}
  elif method == "tools/call":
    result = {"content":[{"type":"text","text":message["params"]["arguments"]["value"]}]}
  else:
    result = {}
  print(json.dumps({"jsonrpc":"2.0","id":message["id"],"result":result}), flush=True)
`;

test("native stdio MCP client initializes, lists and calls tools", async () => {
  const client = await StdioMCPClient.connect({
    command: "python3",
    args: ["-u", "-c", SERVER],
  });
  expect((await client.listTools()).map((tool) => tool.name)).toEqual(["echo"]);
  expect(await client.callTool("echo", { value: "mcp-ok" })).toEqual({
    content: [{ type: "text", text: "mcp-ok" }],
  });
  const tool = mcpToolToRuntimeTool(client, (await client.listTools())[0]!);
  expect(
    await tool.execute({ value: "wrapped" }, { workspaceRoot: process.cwd() }),
  ).toContain("wrapped");
  await client.close();
});

test("loads active legacy Go mcp_servers into the native TS tool registry", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mcp-config-"));
  const configPath = join(root, "config.yaml");
  const serverPath = join(root, "fixture-mcp.py");
  await writeFile(serverPath, SERVER);
  await chmod(serverPath, 0o700);
  await writeFile(
    configPath,
    [
      "default_profile: default",
      "providers:",
      "  p:",
      "    base_url: https://example.invalid/v1",
      "    api_key: test-key",
      "profiles:",
      "  default:",
      "    provider: p",
      "    model: test-model",
      "    mcp_servers: [fixture]",
      "mcp_servers:",
      "  fixture:",
      "    command: python3",
      `    args: [${serverPath}]`,
      "    allowed_tools: [echo]",
      "    read_only: true",
      "",
    ].join("\n"),
  );
  const registry = createToolRegistry([]);
  const result = await loadLegacyMCPTools({
    registry,
    configPath,
    workspaceRoot: root,
  });
  expect(result.loaded).toBe(1);
  const tool = registry.get("mcp_fixture_echo")!;
  expect(tool.requiresApproval).toBe(false);
  expect(
    await tool.execute({ value: "legacy-mcp-ok" }, { workspaceRoot: root }),
  ).toContain("legacy-mcp-ok");
});

test("native HTTP MCP client authenticates and calls a remote MCP endpoint", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      expect(request.headers.get("authorization")).toBe("Bearer local-token");
      const message = (await request.json()) as {
        id: number;
        method: string;
        params: { arguments?: { value?: string } };
      };
      const result =
        message.method === "tools/list"
          ? {
              tools: [{ name: "remote_echo", inputSchema: { type: "object" } }],
            }
          : message.method === "tools/call"
            ? {
                content: [
                  { type: "text", text: message.params.arguments?.value },
                ],
              }
            : {};
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    },
  });
  try {
    const client = await HttpMCPClient.connect({
      url: server.url.toString(),
      token: "local-token",
    });
    expect((await client.listTools()).map((tool) => tool.name)).toEqual([
      "remote_echo",
    ]);
    expect(await client.callTool("remote_echo", { value: "http-ok" })).toEqual({
      content: [{ type: "text", text: "http-ok" }],
    });
  } finally {
    server.stop(true);
  }
});
