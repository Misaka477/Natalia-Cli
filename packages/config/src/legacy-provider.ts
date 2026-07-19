import { readFile } from "node:fs/promises";
import { defaultConfigPath } from "./path";

export type LegacyProviderConfig = {
  providerName: string;
  model: string;
  baseURL: string;
  apiKey: string;
  configPath: string;
  authHeader?: string;
  customHeaders: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoningEffort?: string;
  thinkingEnabled?: boolean;
  timeoutSec?: number;
  maxSteps?: number;
  workDir?: string;
  autoApprove?: string;
  mcpServers: Record<string, LegacyMCPServerConfig>;
  activeMCPServers: string[];
};

export type LegacyMCPServerConfig = {
  command: string;
  args: string[];
  env: Record<string, string>;
  timeoutSec?: number;
  allowedTools: string[];
  readOnly: boolean;
};

export type LegacyProviderDiscovery =
  | { status: "found"; config: LegacyProviderConfig }
  | { status: "missing"; configPath: string }
  | { status: "invalid"; configPath: string; message: string };

type LegacyProvider = {
  base_url?: string;
  api_key?: string;
  auth_header?: string;
  custom_headers?: Record<string, string>;
};
type LegacyProfile = {
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  reasoning_effort?: string;
  thinking_enabled?: boolean;
  timeout_sec?: number;
  max_steps?: number;
  work_dir?: string;
  auto_approve?: string;
  mcp_servers?: string[];
};
type LegacyMCPServer = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout_sec?: number;
  allowed_tools?: string[];
  read_only?: boolean;
};

export async function discoverLegacyProviderConfig(
  input: {
    configPath?: string;
    home?: string;
  } = {},
): Promise<LegacyProviderDiscovery> {
  const configPath = input.configPath ?? defaultConfigPath(input.home);
  let source: string;
  try {
    source = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { status: "missing", configPath };
    return {
      status: "invalid",
      configPath,
      message: "legacy config could not be read",
    };
  }

  try {
    const parsed = parseLegacyProviderYaml(source);
    const profileName = parsed.default_profile;
    if (!profileName) throw new Error("default_profile is not configured");
    const profile = parsed.profiles[profileName];
    if (!profile?.provider)
      throw new Error("active profile provider is not configured");
    if (!profile.model)
      throw new Error("active profile model is not configured");
    const provider = parsed.providers[profile.provider];
    if (!provider?.base_url)
      throw new Error("active provider base_url is not configured");
    if (!provider.api_key)
      throw new Error("active provider api_key is not configured");
    return {
      status: "found",
      config: {
        providerName: profile.provider,
        model: profile.model,
        baseURL: provider.base_url,
        apiKey: provider.api_key,
        configPath,
        authHeader: provider.auth_header,
        customHeaders: provider.custom_headers ?? {},
        temperature: profile.temperature,
        maxTokens: profile.max_tokens,
        topP: profile.top_p,
        reasoningEffort: profile.reasoning_effort,
        thinkingEnabled: profile.thinking_enabled,
        timeoutSec: profile.timeout_sec,
        maxSteps: profile.max_steps,
        workDir: profile.work_dir,
        autoApprove: profile.auto_approve,
        mcpServers: Object.fromEntries(
          Object.entries(parsed.mcpServers).flatMap(([name, server]) =>
            server.command
              ? [
                  [
                    name,
                    {
                      command: server.command,
                      args: server.args ?? [],
                      env: server.env ?? {},
                      timeoutSec: server.timeout_sec,
                      allowedTools: server.allowed_tools ?? [],
                      readOnly: server.read_only === true,
                    } satisfies LegacyMCPServerConfig,
                  ],
                ]
              : [],
          ),
        ),
        activeMCPServers: profile.mcp_servers ?? [],
      },
    };
  } catch (error) {
    return {
      status: "invalid",
      configPath,
      message:
        error instanceof Error
          ? `legacy config is not usable: ${error.message}`
          : "legacy config is not usable",
    };
  }
}

function parseLegacyProviderYaml(source: string) {
  const result: {
    default_profile?: string;
    providers: Record<string, LegacyProvider>;
    profiles: Record<string, LegacyProfile>;
    mcpServers: Record<string, LegacyMCPServer>;
  } = { providers: {}, profiles: {}, mcpServers: {} };
  let section: "providers" | "profiles" | "mcp_servers" | undefined;
  let sectionIndent = 0;
  let entryIndent = 0;
  let current: Record<string, unknown> | undefined;

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+#.*$/u, "");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const top = /^\s*([^:#][^:]*):\s*(.*?)\s*$/u.exec(line);
    if (top && indent === 0) {
      section =
        top[1] === "providers" ||
        top[1] === "profiles" ||
        top[1] === "mcp_servers"
          ? top[1]
          : undefined;
      sectionIndent = indent;
      current = undefined;
      if (top[1] === "default_profile")
        result.default_profile = scalarString(top[2]);
      continue;
    }
    const entry = /^\s*([^:#][^:]*):\s*$/u.exec(line);
    if (section && entry && indent > sectionIndent) {
      current = {};
      entryIndent = indent;
      section === "mcp_servers"
        ? (result.mcpServers[scalarString(entry[1])] =
            current as LegacyMCPServer)
        : (result[section][scalarString(entry[1])] = current as LegacyProvider &
            LegacyProfile);
      continue;
    }
    const value = /^\s*([A-Za-z0-9_-]+):\s*(.*?)\s*$/u.exec(line);
    if (current && value && indent > entryIndent)
      current[value[1]] = scalar(value[2]);
  }
  return result;
}

function scalar(value: string): unknown {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    return trimmed.slice(1, -1);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]"))
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => scalarString(item.trim()))
      .filter(Boolean);
  if (/^-?\d+(?:\.\d+)?$/u.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function scalarString(value: string) {
  const parsed = scalar(value);
  return typeof parsed === "string" ? parsed : String(parsed);
}
