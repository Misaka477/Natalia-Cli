import {
  resolveTuiConfig,
  saveTuiConfig,
  tuiConfigSchema,
  type TuiConfig,
  type TuiConfigPatch,
  type TuiConfigWriteScope,
} from "./config";

export type TuiPreferences = TuiConfig;
export const defaultTuiPreferences: TuiPreferences = tuiConfigSchema.parse({});

export async function loadTuiPreferences(workspaceRoot: string) {
  return (await resolveTuiConfig(workspaceRoot)).config;
}

export async function saveTuiPreferences(
  workspaceRoot: string,
  preferences: TuiConfigPatch,
  scope: TuiConfigWriteScope = "project",
) {
  await saveTuiConfig(workspaceRoot, preferences, scope);
}

export function tuiPreferencePatch(
  previous: TuiPreferences,
  next: TuiPreferences,
): TuiConfigPatch {
  const patch: TuiConfigPatch = {};
  for (const key of Object.keys(next) as Array<keyof TuiPreferences>) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
      patch[key] = next[key] as never;
  }
  return patch;
}
