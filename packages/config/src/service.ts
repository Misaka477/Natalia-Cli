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
    const raw = parseConfigText(await readFile(path, "utf8"));
    config = mergeConfig(config, raw as Partial<ConfigV2>);
    sources.push({ scope, path, applied: true });
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

function mergeConfig(base: ConfigV2, overlay: Partial<ConfigV2>): ConfigV2 {
  return configV2Schema.parse({
    ...base,
    ...overlay,
    runtime: { ...base.runtime, ...overlay.runtime },
    context: { ...base.context, ...overlay.context },
    checkpoint: { ...base.checkpoint, ...overlay.checkpoint },
    providers: { ...base.providers, ...overlay.providers },
    models: { ...base.models, ...overlay.models },
    permissionProfiles: {
      ...base.permissionProfiles,
      ...overlay.permissionProfiles,
    },
    modes: { ...base.modes, ...overlay.modes },
    mcpServers: { ...base.mcpServers, ...overlay.mcpServers },
    workspace: { ...base.workspace, ...overlay.workspace },
    instructions: { ...base.instructions, ...overlay.instructions },
    webSearch: { ...base.webSearch, ...overlay.webSearch },
    browser: { ...base.browser, ...overlay.browser },
    network: { ...base.network, ...overlay.network },
    security: { ...base.security, ...overlay.security },
    experimental: { ...base.experimental, ...overlay.experimental },
  });
}

export async function updateConfig(
  workspaceRoot: string,
  patch: Partial<ConfigV2>,
): Promise<ConfigV2> {
  const { config, projectConfigPath } = await resolveConfig({ workspaceRoot });
  const next = mergeConfig(config, patch);
  await saveConfigFile(next, projectConfigPath);
  return next;
}

export async function updateGlobalConfig(
  patch: Partial<ConfigV2>,
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
