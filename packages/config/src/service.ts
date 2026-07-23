import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { configV2Schema, type ConfigV2 } from "@natalia/contracts";
import { parseConfigText, saveConfigFile } from "./file";
import { readFile } from "node:fs/promises";

export type ConfigScope =
  | "defaults"
  | "global"
  | "project"
  | "local"
  | "environment";

export type ConfigWriteScope = "global" | "project";

export type ConfigPatch = {
  [Key in keyof ConfigV2]?: ConfigV2[Key] extends Array<unknown>
    ? ConfigV2[Key]
    : ConfigV2[Key] extends Record<string, unknown>
      ? ConfigPatchValue<ConfigV2[Key]>
      : ConfigV2[Key];
};

type ConfigPatchValue<Value extends Record<string, unknown>> = {
  [Key in keyof Value]?: Value[Key] extends Array<unknown>
    ? Value[Key]
    : Value[Key] extends Record<string, unknown>
      ? ConfigPatchValue<Value[Key]>
      : Value[Key];
};

/** Produces a minimal overlay, including undefined markers for removed map entries. */
export function configPatch(base: ConfigV2, next: ConfigV2): ConfigPatch {
  const patch = diffValue(base, next) as ConfigPatch;
  const records = {
    providers: recordPatch(base.providers, next.providers),
    models: recordPatch(base.models, next.models),
    permissionProfiles: recordPatch(
      base.permissionProfiles,
      next.permissionProfiles,
    ),
    modes: recordPatch(base.modes, next.modes),
    agents: recordPatch(base.agents, next.agents),
    mcpServers: recordPatch(base.mcpServers, next.mcpServers),
  };
  for (const [key, value] of Object.entries(records))
    if (Object.keys(value).length)
      patch[key as keyof ConfigPatch] = value as never;
    else delete patch[key as keyof ConfigPatch];
  return patch;
}

function recordPatch<Value>(
  base: Record<string, Value>,
  next: Record<string, Value>,
) {
  const patch: Record<string, Value | undefined> = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
    if (!(key in next)) patch[key] = undefined;
    else if (!(key in base) || !deepEqual(base[key], next[key]))
      patch[key] = next[key];
  }
  return patch;
}

function deepEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffValue(base: unknown, next: unknown): unknown {
  if (Object.is(base, next)) return {};
  if (
    !base ||
    !next ||
    Array.isArray(base) ||
    Array.isArray(next) ||
    typeof base !== "object" ||
    typeof next !== "object"
  )
    return next;
  const result: Record<string, unknown> = {};
  const baseRecord = base as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  for (const key of new Set([
    ...Object.keys(baseRecord),
    ...Object.keys(nextRecord),
  ])) {
    if (!(key in nextRecord)) {
      result[key] = undefined;
      continue;
    }
    if (!(key in baseRecord)) {
      result[key] = nextRecord[key];
      continue;
    }
    const value = diffValue(baseRecord[key], nextRecord[key]);
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length
    )
      result[key] = value;
  }
  return result;
}

export type ConfigSource = {
  scope: ConfigScope;
  path?: string;
  applied: boolean;
  diagnostic?: string;
};

export type ResolvedConfig = {
  config: ConfigV2;
  sources: ConfigSource[];
  projectConfigPath: string;
};

export async function resolveConfig(input: {
  workspaceRoot: string;
  globalPath?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<ResolvedConfig> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const projectConfigPath = resolve(workspaceRoot, ".natalia", "config.json");
  const globalPath =
    input.globalPath ??
    resolve(process.env.HOME ?? "", ".config", "natalia-cli", "config.json");
  let config = configV2Schema.parse({ version: 2 });
  const sources: ConfigSource[] = [{ scope: "defaults", applied: true }];
  for (const [scope, path] of [
    ["global", globalPath],
    ["project", projectConfigPath],
  ] as const) {
    if (!existsSync(path)) {
      sources.push({ scope, path, applied: false, diagnostic: "missing" });
      continue;
    }
    try {
      const raw = parseConfigText(await readFile(path, "utf8"));
      config = mergeConfig(config, raw as Partial<ConfigV2>);
      sources.push({ scope, path, applied: true });
    } catch (error) {
      sources.push({
        scope,
        path,
        applied: false,
        diagnostic: `invalid_config: ${error instanceof Error ? error.name : "parse_error"}`,
      });
    }
  }
  const environment = input.environment ?? process.env;
  const model = environment.NATALIA_MODEL;
  if (model) {
    config = configV2Schema.parse({
      ...config,
      models: {
        ...config.models,
        [config.defaultModel]: {
          ...config.models[config.defaultModel]!,
          model,
        },
      },
    });
    sources.push({
      scope: "environment",
      applied: true,
      diagnostic: "NATALIA_MODEL",
    });
  }
  return { config, sources, projectConfigPath };
}

function mergeConfig(base: ConfigV2, overlay: ConfigPatch): ConfigV2 {
  return configV2Schema.parse({
    ...base,
    ...overlay,
    runtime: { ...base.runtime, ...overlay.runtime },
    context: { ...base.context, ...overlay.context },
    checkpoint: { ...base.checkpoint, ...overlay.checkpoint },
    providers: mergeRecord(
      base.providers,
      overlay.providers as Record<
        string,
        ConfigV2["providers"][string] | undefined
      >,
    ),
    models: mergeRecord(
      base.models,
      overlay.models as Record<string, ConfigV2["models"][string] | undefined>,
    ),
    permissionProfiles: mergeRecord(
      base.permissionProfiles,
      overlay.permissionProfiles as Record<
        string,
        ConfigV2["permissionProfiles"][string] | undefined
      >,
    ),
    modes: mergeRecord(
      base.modes,
      overlay.modes as Record<string, ConfigV2["modes"][string] | undefined>,
    ),
    agents: mergeRecord(
      base.agents,
      overlay.agents as Record<string, ConfigV2["agents"][string] | undefined>,
    ),
    mcpServers: mergeRecord(
      base.mcpServers,
      overlay.mcpServers as Record<
        string,
        ConfigV2["mcpServers"][string] | undefined
      >,
    ),
    skills: { ...base.skills, ...overlay.skills },
    plugins: {
      enabled: { ...base.plugins.enabled, ...overlay.plugins?.enabled },
      paths: overlay.plugins?.paths ?? base.plugins.paths,
      capabilities: {
        ...base.plugins.capabilities,
        ...overlay.plugins?.capabilities,
      },
      readOnly: { ...base.plugins.readOnly, ...overlay.plugins?.readOnly },
    },
    workspace: { ...base.workspace, ...overlay.workspace },
    instructions: { ...base.instructions, ...overlay.instructions },
    webSearch: { ...base.webSearch, ...overlay.webSearch },
    browser: { ...base.browser, ...overlay.browser },
    network: { ...base.network, ...overlay.network },
    security: { ...base.security, ...overlay.security },
    experimental: { ...base.experimental, ...overlay.experimental },
  });
}

function mergeRecord<Value>(
  base: Record<string, Value>,
  overlay: Record<string, Value | undefined> | undefined,
) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay ?? {})) {
    if (value === undefined) delete result[key];
    else result[key] = value;
  }
  return result;
}

export async function updateConfig(
  workspaceRoot: string,
  patch: ConfigPatch,
): Promise<ConfigV2> {
  const { config, projectConfigPath } = await resolveConfig({ workspaceRoot });
  const next = mergeConfig(config, patch);
  await saveConfigFile(next, projectConfigPath);
  return next;
}

export async function updateGlobalConfig(
  patch: ConfigPatch,
  globalPath?: string,
): Promise<ConfigV2> {
  const path =
    globalPath ??
    resolve(process.env.HOME ?? "", ".config", "natalia-cli", "config.json");
  let base: ConfigV2;
  try {
    const raw = parseConfigText(await readFile(path, "utf8"));
    base = configV2Schema.parse(raw);
  } catch {
    base = configV2Schema.parse({ version: 2 });
  }
  const next = mergeConfig(base, patch);
  await saveConfigFile(next, path);
  return next;
}

/** Writes validated config through the selected durable scope. */
export async function updateConfigAtScope(
  workspaceRoot: string,
  patch: ConfigPatch,
  scope: ConfigWriteScope = "project",
): Promise<ConfigV2> {
  if (scope === "global") return await updateGlobalConfig(patch);
  return await updateConfig(workspaceRoot, patch);
}
