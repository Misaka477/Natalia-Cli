import { retryDisplayLine } from "@natalia/client";
import { loadConfigFile, migrationSummaryText } from "@natalia/config";
import type { RuntimeEvent } from "@natalia/contracts";
import { ContextWindowResolver } from "@natalia/runtime";

export type StartupDiagnostics = {
  configPath: string;
  migrationSummary: string;
  tty: boolean;
  automation: boolean;
};

export async function startupDiagnostics(
  configPath: string,
  tty = Boolean(process.stdout.isTTY),
): Promise<StartupDiagnostics> {
  const loaded = await loadConfigFile(configPath);
  return {
    configPath,
    migrationSummary: migrationSummaryText(loaded.summary),
    tty,
    automation: !tty,
  };
}

export async function plainStatus(configPath: string) {
  const loaded = await loadConfigFile(configPath);
  const model = loaded.config.models[loaded.config.defaultModel];
  if (!model)
    throw new Error(`missing default model: ${loaded.config.defaultModel}`);
  const resolver = new ContextWindowResolver();
  const resolved = await resolver.resolve({
    provider: model.provider,
    model: model.model,
    explicitContextWindow: model.contextWindow,
  });
  return {
    mode: process.stdout.isTTY ? "tty" : "plain",
    model: model.model,
    provider: model.provider,
    contextWindow: resolved,
  };
}

export function plainEventLine(event: RuntimeEvent) {
  return retryDisplayLine(event) ?? event.type;
}
