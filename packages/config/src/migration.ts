import { configV2Schema, type ConfigV2 } from "@natalia/contracts";
import { redactSecret } from "./path";

export type MigrationSummary = {
  fromVersion: number | "legacy";
  toVersion: 2;
  changed: string[];
  warnings: string[];
  backupPath?: string;
};

export type MigrationResult = {
  config: ConfigV2;
  summary: MigrationSummary;
};

type LegacyProfile = {
  provider?: string;
  model?: string;
  max_context?: number;
  max_tokens?: number;
  max_steps?: number;
  timeout_sec?: number;
};

type LegacyConfig = {
  version?: number;
  default_profile?: string;
  providers?: Record<
    string,
    { type?: string; base_url?: string; api_key?: string }
  >;
  profiles?: Record<string, LegacyProfile>;
};

export function defaultConfigV2(): ConfigV2 {
  return configV2Schema.parse({
    version: 2,
    runtime: {},
    context: {},
    defaultModel: "",
    models: {},
    providers: {},
  });
}

export function migrateConfig(input: unknown): MigrationResult {
  const parsed = configV2Schema.safeParse(input);
  if (parsed.success) {
    return {
      config: parsed.data,
      summary: {
        fromVersion: 2,
        toVersion: 2,
        changed: [],
        warnings: [],
      },
    };
  }

  const legacy = (input ?? {}) as LegacyConfig;
  const summary: MigrationSummary = {
    fromVersion: legacy.version ?? "legacy",
    toVersion: 2,
    changed: [],
    warnings: [],
  };
  const providers: ConfigV2["providers"] = {};
  for (const [name, provider] of Object.entries(legacy.providers ?? {})) {
    providers[name] = {
      type: provider.type ?? name,
      enabled: true,
      baseURL: provider.base_url,
      apiKey: provider.api_key,
      customHeaders: {},
    };
  }
  if (Object.keys(providers).length) summary.changed.push("providers migrated");

  const profileName =
    legacy.default_profile ??
    Object.keys(legacy.profiles ?? {})[0] ??
    "default";
  const profile = legacy.profiles?.[profileName] ?? {};
  const modelName = profileName || "default";
  const maxOutputTokens = resolveLegacyMaxOutputTokens(profile, summary);
  const config = configV2Schema.parse({
    version: 2,
    runtime: {
      maxStepsPerTurn:
        profile.max_steps && profile.max_steps > 0 ? profile.max_steps : 1000,
      timeouts: {
        requestSec:
          profile.timeout_sec && profile.timeout_sec > 0
            ? profile.timeout_sec
            : 120,
        streamIdleSec:
          profile.timeout_sec && profile.timeout_sec > 0
            ? profile.timeout_sec
            : 120,
        turnSec: null,
      },
      maxAttemptsPerStep: 3,
    },
    context: {
      autoDetectWindow: true,
      compactionEnabled: true,
      compactionThresholdPercent: 85,
      reservedOutputTokens: "auto",
      preservedRecentMessages: 2,
    },
    defaultModel: modelName,
    models: {
      [modelName]: {
        provider: profile.provider ?? "openai",
        model: profile.model ?? "gpt-5.5",
        contextWindow:
          profile.max_context && profile.max_context > 0
            ? profile.max_context
            : "auto",
        maxOutputTokens,
      },
    },
    providers,
  });
  if (!profile.max_steps || profile.max_steps <= 0)
    summary.changed.push("profile.max_steps defaulted to 1000");
  if (!profile.timeout_sec || profile.timeout_sec <= 0)
    summary.changed.push("profile.timeout_sec defaulted to 120");
  if (profile.max_context && profile.max_context > 0)
    summary.changed.push("profile.max_context moved to model.contextWindow");
  return { config, summary };
}

export function migrationSummaryText(summary: MigrationSummary) {
  const lines = [
    `config migration: ${summary.fromVersion} -> v${summary.toVersion}`,
    ...summary.changed.map((item) => `changed: ${item}`),
    ...summary.warnings.map((item) => `warning: ${item}`),
    summary.backupPath ? `backup: ${summary.backupPath}` : undefined,
  ].filter(Boolean) as string[];
  return redactSecret(lines.join("\n"));
}

function resolveLegacyMaxOutputTokens(
  profile: LegacyProfile,
  summary: MigrationSummary,
) {
  if (profile.max_tokens === undefined || profile.max_tokens === null)
    return null;
  if (profile.max_tokens <= 0) {
    summary.changed.push("profile.max_tokens=0 treated as omitted, not 8192");
    return null;
  }
  summary.changed.push(
    "profile.max_tokens preserved as explicit model.maxOutputTokens",
  );
  if (profile.max_tokens === 8192) {
    summary.warnings.push(
      "legacy max_tokens=8192 preserved because explicit defaults cannot be safely guessed",
    );
  }
  return profile.max_tokens;
}
