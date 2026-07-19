import { discoverLegacyProviderConfig } from "@natalia/config";
import type { RuntimeTool, ToolRegistry } from "@natalia/tools";

export type MCPTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type StdioMCPClientOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export type HttpMCPClientOptions = {
  url: string;
  token?: string;
  fetch?: typeof fetch;
};

export class StdioMCPClient {
  private process: ReturnType<typeof Bun.spawn>;
  private stdin: Exclude<
    ReturnType<typeof Bun.spawn>["stdin"],
    number | undefined
  >;
  private nextID = 1;
  private pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();

  private constructor(process: ReturnType<typeof Bun.spawn>) {
    this.process = process;
    if (!process.stdin || typeof process.stdin === "number")
      throw new Error("MCP process stdin is not writable");
    this.stdin = process.stdin;
    void this.readLoop();
  }

  static async connect(options: StdioMCPClientOptions) {
    const process = Bun.spawn([options.command, ...(options.args ?? [])], {
      cwd: options.cwd,
      env: options.env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const client = new StdioMCPClient(process);
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "natalia-ts", version: "0.0.0-ts7" },
    });
    await client.notify("notifications/initialized", {});
    return client;
  }

  async listTools() {
    const result = (await this.request("tools/list", {})) as {
      tools?: MCPTool[];
    };
    return result.tools ?? [];
  }

  async callTool(name: string, arguments_: Record<string, unknown>) {
    return await this.request("tools/call", { name, arguments: arguments_ });
  }

  async close() {
    this.stdin.end();
    this.process.kill("SIGTERM");
  }

  private async request(method: string, params: Record<string, unknown>) {
    const id = this.nextID++;
    const result = new Promise<unknown>((resolve, reject) =>
      this.pending.set(id, { resolve, reject }),
    );
    await this.write({ jsonrpc: "2.0", id, method, params });
    return await result;
  }

  private async notify(method: string, params: Record<string, unknown>) {
    await this.write({ jsonrpc: "2.0", method, params });
  }

  private async write(value: Record<string, unknown>) {
    this.stdin.write(`${JSON.stringify(value)}\n`);
  }

  private async readLoop() {
    const stdout = this.process.stdout;
    if (!stdout || typeof stdout === "number")
      throw new Error("MCP process stdout is not readable");
    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) this.handleLine(line);
    }
    for (const pending of this.pending.values())
      pending.reject(new Error("MCP server closed"));
    this.pending.clear();
  }

  private handleLine(line: string) {
    if (!line.trim()) return;
    const message = JSON.parse(line) as {
      id?: number;
      result?: unknown;
      error?: { message?: string };
    };
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error)
      pending.reject(new Error(message.error.message ?? "MCP error"));
    else pending.resolve(message.result);
  }
}

export class HttpMCPClient {
  private nextID = 1;
  private readonly fetchImpl: typeof fetch;

  private constructor(private readonly options: HttpMCPClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  static async connect(options: HttpMCPClientOptions) {
    const client = new HttpMCPClient(options);
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "natalia-ts", version: "0.0.0-ts7" },
    });
    return client;
  }

  async listTools() {
    const result = (await this.request("tools/list", {})) as {
      tools?: MCPTool[];
    };
    return result.tools ?? [];
  }

  async callTool(name: string, arguments_: Record<string, unknown>) {
    return await this.request("tools/call", { name, arguments: arguments_ });
  }

  private async request(method: string, params: Record<string, unknown>) {
    const id = this.nextID++;
    const response = await this.fetchImpl(this.options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.token
          ? { authorization: `Bearer ${this.options.token}` }
          : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    if (!response.ok)
      throw new Error(`MCP HTTP request failed: ${response.status}`);
    const message = (await response.json()) as {
      id?: number;
      result?: unknown;
      error?: { message?: string };
    };
    if (message.id !== id) throw new Error("MCP HTTP response ID mismatch");
    if (message.error)
      throw new Error(message.error.message ?? "MCP HTTP error");
    return message.result;
  }
}

type MCPToolClient = Pick<StdioMCPClient, "callTool">;

export function mcpToolToRuntimeTool(
  client: MCPToolClient,
  tool: MCPTool,
  input: { serverName?: string; readOnly?: boolean } = {},
): RuntimeTool {
  const prefix = input.serverName ? `mcp_${input.serverName}_` : "mcp_";
  return {
    name: `${prefix}${tool.name}`,
    description:
      tool.description ??
      `MCP tool ${input.serverName ?? "server"}/${tool.name}`,
    requiresApproval: !input.readOnly,
    parameters: tool.inputSchema as RuntimeTool["parameters"],
    async execute(input) {
      return JSON.stringify(
        await client.callTool(tool.name, requireArguments(input)),
      );
    },
  };
}

export async function loadNativeMCPTools(input: {
  registry: ToolRegistry;
  servers: Record<
    string,
    {
      type: "stdio" | "http";
      command?: string;
      args: string[];
      url?: string;
      headers: Record<string, string>;
      environment: Record<string, string>;
      cwd?: string;
      allowedTools: string[];
      excludedTools: string[];
      readOnly: boolean;
      enabled: boolean;
    }
  >;
  workspaceRoot: string;
  onDiagnostic?: (message: string) => void;
}) {
  let loaded = 0;
  const diagnostics: string[] = [];
  for (const [name, server] of Object.entries(input.servers)) {
    if (!server.enabled) continue;
    try {
      const client: StdioMCPClient | HttpMCPClient =
        server.type === "http"
          ? await HttpMCPClient.connect({ url: server.url ?? "" })
          : await StdioMCPClient.connect({
              command: server.command ?? "",
              args: server.args,
              cwd: server.cwd ?? input.workspaceRoot,
              env: cleanEnv({ ...process.env, ...server.environment }),
            });
      for (const tool of await client.listTools()) {
        if (
          server.allowedTools.length &&
          !server.allowedTools.includes(tool.name)
        )
          continue;
        if (server.excludedTools.includes(tool.name)) continue;
        input.registry.set(
          `mcp_${name}_${tool.name}`,
          mcpToolToRuntimeTool(client, tool, {
            serverName: name,
            readOnly: server.readOnly,
          }),
        );
        loaded++;
      }
      diagnostics.push(`TS config MCP ${name} loaded`);
    } catch (error) {
      diagnostics.push(
        `TS config MCP ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  for (const diagnostic of diagnostics) input.onDiagnostic?.(diagnostic);
  return { loaded, diagnostics };
}

export async function loadLegacyMCPTools(input: {
  registry: ToolRegistry;
  configPath?: string;
  workspaceRoot: string;
  onDiagnostic?: (message: string) => void;
}) {
  const discovery = await discoverLegacyProviderConfig({
    configPath: input.configPath,
  });
  if (discovery.status !== "found") return { loaded: 0, diagnostics: [] };
  const diagnostics: string[] = [];
  let loaded = 0;
  const active = discovery.config.activeMCPServers.length
    ? discovery.config.activeMCPServers
    : Object.keys(discovery.config.mcpServers);
  for (const serverName of active) {
    const server = discovery.config.mcpServers[serverName];
    if (!server) {
      diagnostics.push(
        `MCP server ${serverName} is referenced but not configured`,
      );
      continue;
    }
    try {
      const client = await StdioMCPClient.connect({
        command: server.command,
        args: server.args,
        cwd: input.workspaceRoot,
        env: cleanEnv({ ...process.env, ...server.env }),
      });
      for (const tool of await client.listTools()) {
        if (
          server.allowedTools.length &&
          !server.allowedTools.includes(tool.name)
        )
          continue;
        input.registry.set(
          `mcp_${serverName}_${tool.name}`,
          mcpToolToRuntimeTool(client, tool, {
            serverName,
            readOnly: server.readOnly,
          }),
        );
        loaded++;
      }
      diagnostics.push(`MCP server ${serverName} loaded ${loaded} tool(s)`);
    } catch (error) {
      diagnostics.push(
        `MCP server ${serverName} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  for (const diagnostic of diagnostics) input.onDiagnostic?.(diagnostic);
  return { loaded, diagnostics };
}

function cleanEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function requireArguments(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("MCP tool arguments must be an object");
  return input as Record<string, unknown>;
}
