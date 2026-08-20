import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  configV3Schema,
  parseModelRef,
  type ConfigV3,
} from "@natalia/contracts";
import { globalConfigHome } from "@natalia/platform";
import { parseConfigText, saveConfigOverlayFile } from "./file";
import { readFile } from "node:fs/promises";

export type ConfigScope =
  | "defaults"
  | "global"
  | "project"
  | "local"
  | "environment";

export type ConfigWriteScope = "global" | "project";

export const GLOBAL_MODEL_CONFIG_KEYS = [
  "providers",
  "catalog",
  "modelOverrides",
  "defaultModel",
] as const satisfies readonly (keyof ConfigV3)[];

type GlobalModelConfigKey = (typeof GLOBAL_MODEL_CONFIG_KEYS)[number];
const globalModelConfigKeys = new Set<keyof ConfigV3>(GLOBAL_MODEL_CONFIG_KEYS);

export type ConfigPatch = {
  [Key in keyof ConfigV3]?: ConfigV3[Key] extends Array<unknown>
    ? ConfigV3[Key]
    : ConfigV3[Key] extends Record<string, unknown>
      ? ConfigPatchValue<ConfigV3[Key]>
      : ConfigV3[Key];
};

type ConfigPatchValue<Value extends Record<string, unknown>> = {
  [Key in keyof Value]?: Value[Key] extends Array<unknown>
    ? Value[Key]
    : Value[Key] extends Record<string, unknown>
      ? ConfigPatchValue<Value[Key]>
      : Value[Key];
};

/** Produces a minimal overlay, including undefined markers for removed map entries. */
export function configPatch(base: ConfigV3, next: ConfigV3): ConfigPatch {
  const patch = diffValue(base, next) as ConfigPatch;
  const records = {
    providers: recordPatch(base.providers, next.providers),
    permissionProfiles: recordPatch(
      base.permissionProfiles,
      next.permissionProfiles,
    ),
    modes: recordPatch(base.modes, next.modes),
    agents: recordPatch(base.agents, next.agents),
    mcpServers: recordPatch(base.mcpServers, next.mcpServers),
    issueTargets: recordPatch(base.issueTargets, next.issueTargets),
    dataSources: recordPatch(base.dataSources, next.dataSources),
    alertChannels: recordPatch(base.alertChannels, next.alertChannels),
    pluginPackages: recordPatch(base.plugins.packages, next.plugins.packages),
  };
  for (const [key, value] of Object.entries(records)) {
    if (key === "pluginPackages") {
      if (Object.keys(value).length) {
        patch.plugins ??= {};
        patch.plugins.packages = value as never;
      } else if (patch.plugins) delete patch.plugins.packages;
      continue;
    }
    if (Object.keys(value).length)
      patch[key as keyof ConfigPatch] = value as never;
    else delete patch[key as keyof ConfigPatch];
  }
  // `catalog` and `modelOverrides` stay as diffValue produced them: nested
  // records whose partial diffs deep-merge cleanly onto the persisted overlay.
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
  config: ConfigV3;
  sources: ConfigSource[];
  projectConfigPath: string;
};

/**
 * Path of the per-user global config overlay. The POSIX location is unchanged;
 * Windows resolves it under the roaming application data root.
 */
export function defaultGlobalConfigPath(
  input: { os?: NodeJS.Platform; env?: NodeJS.ProcessEnv } = {},
): string {
  return resolve(globalConfigHome(input), "natalia-cli", "config.json");
}

function configFailureReason(error: unknown): string {
  const issues = (
    error as { issues?: Array<{ path?: unknown[]; message?: string }> }
  ).issues;
  if (Array.isArray(issues) && issues.length) {
    const first = issues[0]!;
    const path = (first.path ?? []).join(".");
    return `${path ? `${path}: ` : ""}${first.message ?? "invalid value"}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}`;
  }
  return error instanceof Error ? error.message : "parse_error";
}

export async function resolveConfig(input: {
  workspaceRoot: string;
  globalPath?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<ResolvedConfig> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const projectConfigPath = resolve(workspaceRoot, ".natalia", "config.json");
  const globalPath = input.globalPath ?? defaultGlobalConfigPath();
  let config = configV3Schema.parse({ version: 3 });
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
      const overlay = raw as ConfigPatch;
      const ignored =
        scope === "project" ? presentGlobalModelConfigKeys(overlay) : [];
      config = mergeConfig(
        config,
        scope === "project" ? withoutGlobalModelConfig(overlay) : overlay,
      );
      sources.push({
        scope,
        path,
        applied: true,
        diagnostic: ignored.length
          ? `ignored global-only settings: ${ignored.join(", ")}`
          : undefined,
      });
    } catch (error) {
      // The reason has to travel with the source: an ignored configuration file
      // silently drops whatever the operator believed was in effect, including
      // permission profiles and command rules.
      sources.push({
        scope,
        path,
        applied: false,
        diagnostic: `invalid_config: ${configFailureReason(error)}`,
      });
    }
  }
  const environment = input.environment ?? process.env;
  const model = environment.NATALIA_MODEL;
  if (model) {
    // A transient default model ref only: the catalog is never mutated by the
    // environment, so an uncommitted provider key disappears when the env is
    // cleared.
    config = configV3Schema.parse({
      ...config,
      defaultModel: parseModelRef(model),
    });
    sources.push({
      scope: "environment",
      applied: true,
      diagnostic: "NATALIA_MODEL",
    });
  }
  return { config, sources, projectConfigPath };
}

function mergeConfig(base: ConfigV3, overlay: ConfigPatch): ConfigV3 {
  return configV3Schema.parse({
    version: 3,
    runtime: { ...base.runtime, ...overlay.runtime },
    sandbox: { ...base.sandbox, ...overlay.sandbox },
    team: { ...base.team, ...overlay.team },
    context: { ...base.context, ...overlay.context },
    checkpoint: { ...base.checkpoint, ...overlay.checkpoint },
    providers: deepMergeObject(base.providers, overlay.providers),
    catalog: deepMergeObject(base.catalog, overlay.catalog),
    modelOverrides: deepMergeObject(
      base.modelOverrides,
      overlay.modelOverrides,
    ),
    defaultModel:
      overlay.defaultModel === undefined
        ? base.defaultModel
        : (deepMergeObject(
            base.defaultModel,
            overlay.defaultModel,
          ) as ConfigV3["defaultModel"]),
    permissionProfiles: mergeRecord(
      base.permissionProfiles,
      overlay.permissionProfiles as Record<
        string,
        ConfigV3["permissionProfiles"][string] | undefined
      >,
    ),
    defaultPermission: overlay.defaultPermission ?? base.defaultPermission,
    modes: mergeRecord(
      base.modes,
      overlay.modes as Record<string, ConfigV3["modes"][string] | undefined>,
    ),
    defaultMode: overlay.defaultMode ?? base.defaultMode,
    agents: mergeRecord(
      base.agents,
      overlay.agents as Record<string, ConfigV3["agents"][string] | undefined>,
    ),
    defaultAgent: overlay.defaultAgent ?? base.defaultAgent,
    mcpServers: mergeRecord(
      base.mcpServers,
      overlay.mcpServers as Record<
        string,
        ConfigV3["mcpServers"][string] | undefined
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
      settings: { ...base.plugins.settings, ...overlay.plugins?.settings },
      packages: mergeRecord(
        base.plugins.packages,
        overlay.plugins?.packages as Record<
          string,
          ConfigV3["plugins"]["packages"][string] | undefined
        >,
      ),
    },
    tools: {
      enabled: { ...base.tools.enabled, ...overlay.tools?.enabled },
      paths: overlay.tools?.paths ?? base.tools.paths,
    },
    workspace: { ...base.workspace, ...overlay.workspace },
    instructions: { ...base.instructions, ...overlay.instructions },
    webSearch: { ...base.webSearch, ...overlay.webSearch },
    browser: { ...base.browser, ...overlay.browser },
    network: { ...base.network, ...overlay.network },
    security: { ...base.security, ...overlay.security },
    issueTargets: mergeRecord(
      base.issueTargets,
      overlay.issueTargets as Record<
        string,
        ConfigV3["issueTargets"][string] | undefined
      >,
    ),
    dataSources: mergeRecord(
      base.dataSources,
      overlay.dataSources as Record<
        string,
        ConfigV3["dataSources"][string] | undefined
      >,
    ),
    alertChannels: mergeRecord(
      base.alertChannels,
      overlay.alertChannels as Record<
        string,
        ConfigV3["alertChannels"][string] | undefined
      >,
    ),
    experimental: { ...base.experimental, ...overlay.experimental },
  });
}

/** Recursively merges plain objects; arrays, scalars and null replace. */
function deepMergeObject(base: unknown, overlay: unknown): unknown {
  if (overlay === undefined) return base;
  if (base === undefined) return overlay;
  if (Array.isArray(base) || Array.isArray(overlay)) return overlay;
  const baseIsObject = typeof base === "object" && base !== null;
  const overlayIsObject = typeof overlay === "object" && overlay !== null;
  if (!baseIsObject || !overlayIsObject) return overlay;
  const result: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(
    overlay as Record<string, unknown>,
  )) {
    if (value === undefined) delete result[key];
    else result[key] = deepMergeObject(result[key], value);
  }
  return result;
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
  options: { globalPath?: string } = {},
): Promise<ConfigV3> {
  return await updateConfigAtScope(workspaceRoot, patch, "project", options);
}

async function updateProjectConfig(
  workspaceRoot: string,
  patch: ConfigPatch,
  globalPath?: string,
): Promise<ConfigV3> {
  const { config, projectConfigPath } = await resolveConfig({
    workspaceRoot,
    globalPath,
  });
  const projectPatch = withoutGlobalModelConfig(patch);
  const persisted = await loadOverlay(projectConfigPath);
  const overlay = mergeOverlay(
    persisted,
    projectPatch as Record<string, unknown>,
  );
  if (Object.keys(projectPatch).length)
    await saveConfigOverlayFile(projectConfigPath, overlay);
  return mergeConfig(config, projectPatch);
}

export async function updateGlobalConfig(
  patch: ConfigPatch,
  globalPath?: string,
): Promise<ConfigV3> {
  const path = globalPath ?? defaultGlobalConfigPath();
  const base = mergeConfig(
    configV3Schema.parse({ version: 3 }),
    (await loadOverlay(path)) as ConfigPatch,
  );
  const next = mergeConfig(base, patch);
  const overlay = mergeOverlay(
    await loadOverlay(path),
    patch as Record<string, unknown>,
  );
  await saveConfigOverlayFile(path, overlay);
  return next;
}

/** Moves legacy project model settings into the authoritative global overlay. */
export async function migrateProjectModelConfigToGlobal(
  workspaceRoot: string,
  options: { globalPath?: string } = {},
): Promise<{ migrated: GlobalModelConfigKey[]; config: ConfigV3 }> {
  const projectConfigPath = resolve(workspaceRoot, ".natalia", "config.json");
  const project = await loadOverlay(projectConfigPath);
  const migrated = presentGlobalModelConfigKeys(project);
  if (!migrated.length)
    return {
      migrated,
      config: (
        await resolveConfig({
          workspaceRoot,
          globalPath: options.globalPath,
        })
      ).config,
    };

  const globalPath = options.globalPath ?? defaultGlobalConfigPath();
  const globalBase = mergeConfig(
    configV3Schema.parse({ version: 3 }),
    (await loadOverlay(globalPath)) as ConfigPatch,
  );
  const effective = mergeConfig(
    globalBase,
    onlyGlobalModelConfig(project as ConfigPatch),
  );
  const globalPatch = Object.fromEntries(
    migrated.map((key) => [key, effective[key]]),
  ) as ConfigPatch;
  await updateGlobalConfig(globalPatch, globalPath);

  for (const key of migrated) delete project[key];
  await saveConfigOverlayFile(projectConfigPath, project);
  return {
    migrated,
    config: (
      await resolveConfig({
        workspaceRoot,
        globalPath,
      })
    ).config,
  };
}

async function loadOverlay(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = parseConfigText(await readFile(path, "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function mergeOverlay(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete result[key];
      continue;
    }
    const current = result[key];
    if (
      current &&
      value &&
      typeof current === "object" &&
      typeof value === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(value)
    ) {
      result[key] = mergeOverlay(
        current as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }
    result[key] = value;
  }
  return result;
}

/** Writes validated config through the selected durable scope. */
export async function updateConfigAtScope(
  workspaceRoot: string,
  patch: ConfigPatch,
  scope: ConfigWriteScope = "project",
  options: { globalPath?: string } = {},
): Promise<ConfigV3> {
  if (scope === "global")
    return await updateGlobalConfig(patch, options.globalPath);
  const globalPatch = onlyGlobalModelConfig(patch);
  if (Object.keys(globalPatch).length)
    await updateGlobalConfig(globalPatch, options.globalPath);
  await updateProjectConfig(workspaceRoot, patch, options.globalPath);
  return (
    await resolveConfig({ workspaceRoot, globalPath: options.globalPath })
  ).config;
}

function presentGlobalModelConfigKeys(
  patch: ConfigPatch | Record<string, unknown>,
): GlobalModelConfigKey[] {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [];
  return GLOBAL_MODEL_CONFIG_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(patch, key),
  );
}

function withoutGlobalModelConfig(patch: ConfigPatch): ConfigPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(
      ([key]) => !globalModelConfigKeys.has(key as keyof ConfigV3),
    ),
  ) as ConfigPatch;
}

function onlyGlobalModelConfig(patch: ConfigPatch): ConfigPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) =>
      globalModelConfigKeys.has(key as keyof ConfigV3),
    ),
  ) as ConfigPatch;
}
