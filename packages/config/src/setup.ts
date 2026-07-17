import type { ConfigV2 } from "@natalia/contracts";

export type SetupContextWindowResolution = {
  tokens: number;
  source: string;
  confidence: string;
  diagnostic: string;
};

export type SetupSnapshot = {
  provider: string;
  model: string;
  contextWindow: {
    tokens: number;
    source: string;
    confidence: string;
    diagnostic: string;
    manualOverrideAllowed: true;
  };
  outputLimit: {
    value: number | null;
    semantics: "omitted" | "explicit-positive";
  };
  secretFields: string[];
};

export function createSetupSnapshot(
  config: ConfigV2,
  modelName: string,
  resolution: SetupContextWindowResolution,
): SetupSnapshot {
  const model = config.models[modelName];
  if (!model) throw new Error(`unknown model config: ${modelName}`);
  return {
    provider: model.provider,
    model: model.model,
    contextWindow: {
      tokens: resolution.tokens,
      source: resolution.source,
      confidence: resolution.confidence,
      diagnostic: resolution.diagnostic,
      manualOverrideAllowed: true,
    },
    outputLimit: {
      value: model.maxOutputTokens ?? null,
      semantics: model.maxOutputTokens ? "explicit-positive" : "omitted",
    },
    secretFields: ["providers.*.apiKey"],
  };
}
