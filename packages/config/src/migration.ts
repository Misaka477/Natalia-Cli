import { configV2Schema, type ConfigV2 } from "@natalia/contracts";

export type MigrationSummary = {
  fromVersion: number;
  toVersion: 2;
  changed: string[];
  warnings: string[];
  backupPath?: string;
};

export type MigrationResult = {
  config: ConfigV2;
  summary: MigrationSummary;
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

  throw new Error("only Config v2 JSON configuration is supported");
}

export function migrationSummaryText(summary: MigrationSummary) {
  const lines = [
    `config migration: ${summary.fromVersion} -> v${summary.toVersion}`,
    ...summary.changed.map((item) => `changed: ${item}`),
    ...summary.warnings.map((item) => `warning: ${item}`),
    summary.backupPath ? `backup: ${summary.backupPath}` : undefined,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}
