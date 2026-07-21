import { expect, test } from "bun:test";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createToolRegistry } from "@natalia/tools";
import {
  HttpMCPClient,
  inspectMCPCatalog,
  loadLegacyMCPTools,
  loadNativeMCPTools,
  mcpToolToRuntimeTool,
  StdioMCPClient,
} from "../src";

const SERVER = String.raw`
import json, sys, time
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

test("MCP runtime tools surface server errors and preserve structured-only results", async () => {
  const failing = mcpToolToRuntimeTool(
    {
      async callTool() {
        return {
          isError: true,
          content: [{ type: "text", text: "bad input" }],
        };
      },
    },
    { name: "fail", inputSchema: { type: "object" } },
  );
  await expect(
    failing.execute({}, { workspaceRoot: process.cwd() }),
  ).rejects.toThrow("bad input");

  const structured = mcpToolToRuntimeTool(
    {
      async callTool() {
        return { content: [], structuredContent: { answer: "ok" } };
      },
    },
    { name: "structured", inputSchema: { type: "object" } },
  );
  expect(
    JSON.parse(await structured.execute({}, { workspaceRoot: process.cwd() })),
  ).toEqual({
    content: [{ type: "text", text: JSON.stringify({ answer: "ok" }) }],
  });
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

test("native HTTP MCP forwards configured static headers and request timeout", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      expect(request.headers.get("x-mcp-key")).toBe("local-key");
      const message = (await request.json()) as { id: number };
      return Response.json({ jsonrpc: "2.0", id: message.id, result: {} });
    },
  });
  try {
    await HttpMCPClient.connect({
      url: server.url.toString(),
      headers: { "x-mcp-key": "local-key" },
      timeoutMs: 1_000,
    });
  } finally {
    server.stop(true);
  }
});

test("MCP catalog paginates tools, prompts, and resources", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const message = (await request.json()) as {
        id: number;
        method: string;
        params: { cursor?: string };
      };
      const first = !message.params.cursor;
      const result =
        message.method === "initialize"
          ? {}
          : message.method === "tools/list"
            ? first
              ? {
                  tools: [{ name: "first", inputSchema: { type: "object" } }],
                  nextCursor: "tools-next",
                }
              : { tools: [{ name: "second", inputSchema: { type: "object" } }] }
            : message.method === "prompts/list"
              ? first
                ? { prompts: [{ name: "brief" }], nextCursor: "prompts-next" }
                : { prompts: [{ name: "detail" }] }
              : message.method === "resources/list"
                ? first
                  ? {
                      resources: [{ name: "guide", uri: "file:///guide" }],
                      nextCursor: "resources-next",
                    }
                  : { resources: [{ name: "notes", uri: "file:///notes" }] }
                : {};
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    },
  });
  try {
    const catalog = await inspectMCPCatalog(
      await HttpMCPClient.connect({ url: server.url.toString() }),
    );
    expect(catalog.tools.map((tool) => tool.name)).toEqual(["first", "second"]);
    expect(catalog.prompts.map((prompt) => prompt.name)).toEqual([
      "brief",
      "detail",
    ]);
    expect(catalog.resources.map((resource) => resource.uri)).toEqual([
      "file:///guide",
      "file:///notes",
    ]);
  } finally {
    server.stop(true);
  }
});

test("native MCP loader registers catalog-backed prompt and resource runtime tools", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const message = (await request.json()) as {
        id: number;
        method: string;
        params: {
          name?: string;
          uri?: string;
          arguments?: Record<string, string>;
        };
      };
      const result =
        message.method === "initialize"
          ? {}
          : message.method === "tools/list"
            ? { tools: [] }
            : message.method === "prompts/list"
              ? { prompts: [{ name: "review" }] }
              : message.method === "resources/list"
                ? { resources: [{ uri: "file:///guide", name: "guide" }] }
                : message.method === "prompts/get"
                  ? {
                      description: "review prompt",
                      messages: [
                        {
                          role: "user",
                          content: {
                            type: "text",
                            text: message.params.arguments?.scope ?? "all",
                          },
                        },
                      ],
                    }
                  : message.method === "resources/read"
                    ? {
                        contents: [
                          { uri: message.params.uri, text: "guide content" },
                        ],
                      }
                    : {};
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    },
  });
  try {
    const registry = createToolRegistry([]);
    const result = await loadNativeMCPTools({
      registry,
      workspaceRoot: process.cwd(),
      servers: {
        fixture: {
          type: "http",
          url: server.url.toString(),
          args: [],
          headers: {},
          environment: {},
          allowedTools: [],
          excludedTools: [],
          readOnly: true,
          enabled: true,
        },
      },
    });
    const prompt = registry.get("mcp_fixture_prompt_get");
    const resource = registry.get("mcp_fixture_resource_read");
    expect(prompt?.requiresApproval).toBe(false);
    expect(resource?.requiresApproval).toBe(false);
    expect(
      await prompt!.execute(
        { name: "review", arguments: { scope: "local" } },
        { workspaceRoot: process.cwd() },
      ),
    ).toContain("local");
    expect(
      await resource!.execute(
        { uri: "file:///guide" },
        { workspaceRoot: process.cwd() },
      ),
    ).toContain("guide content");
    await result.close();
  } finally {
    server.stop(true);
  }
});

test("MCP catalog rejects repeated pagination cursors", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const message = (await request.json()) as { id: number; method: string };
      const result =
        message.method === "initialize"
          ? {}
          : { tools: [], nextCursor: "repeat" };
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    },
  });
  try {
    const client = await HttpMCPClient.connect({ url: server.url.toString() });
    await expect(client.listTools()).rejects.toThrow("duplicate cursor");
  } finally {
    server.stop(true);
  }
});

test("stdio tool-list change refreshes only owned tool registrations", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mcp-refresh-"));
  const server = String.raw`
import json, sys, time
calls = 0
for line in sys.stdin:
  message = json.loads(line)
  if "id" not in message:
    continue
  if message["method"] == "initialize":
    result = {}
  elif message["method"] == "tools/list":
    calls += 1
    result = {"tools":[{"name": "old" if calls == 1 else "new", "inputSchema":{"type":"object"}}]}
    if calls == 1:
      print(json.dumps({"jsonrpc":"2.0","id":message["id"],"result":result}), flush=True)
      time.sleep(0.02)
      print(json.dumps({"jsonrpc":"2.0","method":"notifications/tools/list_changed","params":{}}), flush=True)
      continue
  else:
    result = {}
  print(json.dumps({"jsonrpc":"2.0","id":message["id"],"result":result}), flush=True)
`;
  const registry = createToolRegistry([]);
  const result = await loadNativeMCPTools({
    registry,
    workspaceRoot: root,
    servers: {
      fixture: {
        type: "stdio",
        command: "python3",
        args: ["-u", "-c", server],
        headers: {},
        environment: {},
        allowedTools: [],
        excludedTools: [],
        readOnly: true,
        enabled: true,
      },
    },
  });
  for (
    let attempt = 0;
    attempt < 50 && !registry.has("mcp_fixture_new");
    attempt++
  )
    await Bun.sleep(5);
  expect(registry.has("mcp_fixture_old")).toBe(false);
  expect(registry.has("mcp_fixture_new")).toBe(true);
  await result.close();
});

test("native MCP loader returns an idempotent lifecycle cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mcp-cleanup-"));
  const loader = await import("../src");
  const registry = createToolRegistry([]);
  const result = await loader.loadNativeMCPTools({
    registry,
    workspaceRoot: root,
    servers: {
      fixture: {
        type: "stdio",
        command: "python3",
        args: ["-u", "-c", SERVER],
        headers: {},
        environment: {},
        allowedTools: [],
        excludedTools: [],
        readOnly: true,
        enabled: true,
      },
    },
  });
  expect(result.loaded).toBe(1);
  expect(registry.has("mcp_fixture_echo")).toBe(true);
  await result.close();
  expect(registry.has("mcp_fixture_echo")).toBe(false);
  await result.close();
});

test("native MCP loader reports disabled, failed, and interactive-auth statuses without opening auth", async () => {
  const registry = createToolRegistry([]);
  const result = await loadNativeMCPTools({
    registry,
    workspaceRoot: process.cwd(),
    servers: {
      disabled: {
        type: "stdio",
        command: "python3",
        args: [],
        headers: {},
        environment: {},
        allowedTools: [],
        excludedTools: [],
        readOnly: true,
        enabled: false,
      },
      interactive: {
        type: "http",
        url: "https://example.invalid/mcp",
        args: [],
        headers: {},
        environment: {},
        allowedTools: [],
        excludedTools: [],
        readOnly: true,
        enabled: true,
        auth: { clientID: "not-used" },
      },
      failed: {
        type: "stdio",
        command: "definitely-not-installed",
        args: [],
        headers: {},
        environment: {},
        allowedTools: [],
        excludedTools: [],
        readOnly: true,
        enabled: true,
      },
    },
  });
  expect(result.statuses).toMatchObject({
    disabled: { status: "disabled", tools: 0 },
    interactive: { status: "unsupported_auth_flow", tools: 0 },
    failed: { status: "failed", tools: 0 },
  });
  expect(result.diagnostics.join("\n")).toContain(
    "requires interactive authentication",
  );
  await result.close();
});
