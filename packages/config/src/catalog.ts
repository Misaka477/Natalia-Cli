import { configV2Schema, type ConfigV2 } from "@natalia/contracts";
import { evaluatePolicy } from "./policy";

export interface CatalogModel {
  id: string;
  provider: string;
}

export interface CatalogProvider {
  id: string;
  name: string;
  type: string;
  configured: boolean;
  models: CatalogModel[];
}

export function buildModelCatalog(config: ConfigV2): CatalogProvider[] {
  return Object.entries(config.providers ?? {})
    .filter(([id]) =>
      evaluatePolicy(config.experimental.policies, "provider.use", id, "allow") === "allow",
    )
    .map(([id, cfg]) => ({
      id,
      name: id,
      type: cfg.type,
      configured: Boolean(cfg.apiKey),
      models: Object.entries(config.models ?? {})
        .filter(([, model]) => model.provider === id)
        .map(([, model]) => ({
          id: model.model,
          provider: id,
        })),
    }));
}

export async function discoverProviderModels(
  type: string,
  baseURL: string,
  apiKey: string,
): Promise<string[]> {
  const base = baseURL.trim().replace(/\/+$/u, "");
  if (!base) throw new Error("Provider base URL is required for model discovery");
  if (!apiKey.trim()) throw new Error("Provider API key is required for model discovery");

  const anthropic = type === "anthropic";
  const gemini = type === "gemini";
  const url = gemini
    ? `${base}/models`
    : `${base.endsWith("/v1") ? base : `${base}/v1`}/models`;
  const response = await fetch(url, {
    headers: anthropic
      ? {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        }
      : gemini
        ? { "x-goog-api-key": apiKey }
        : { authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      `Model discovery failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: unknown }>;
    models?: Array<{ id?: unknown; name?: unknown }>;
  };
  const values = gemini
    ? (payload.models ?? []).map((model) => model.name ?? model.id)
    : payload.data
      ? payload.data.map((model) => model.id)
      : (payload.models ?? []).map((model) => model.id ?? model.name);
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))]
    .map((value) => (gemini ? value.replace(/^models\//u, "") : value))
    .sort((left, right) => left.localeCompare(right));
}

export function configureDiscoveredProviderModel(
  config: ConfigV2,
  input: {
    providerID: string;
    providerType: string;
    apiKey: string;
    baseURL: string;
    modelID: string;
    discoveredModels: string[];
  },
): ConfigV2 {
  const providerID = input.providerID.trim();
  const baseURL = input.baseURL.trim().replace(/\/+$/u, "");
  const modelID = input.modelID.trim();
  if (!providerID) throw new Error("Provider ID is required");
  if (!input.apiKey.trim()) throw new Error("Provider API key is required");
  if (!baseURL) throw new Error("Provider base URL is required");
  if (!input.discoveredModels.includes(modelID)) {
    throw new Error(`Model was not returned by provider: ${modelID}`);
  }

  const modelKey = `${providerID}_${modelID.replace(/[^a-zA-Z0-9_-]/gu, "_")}`;
  return configV2Schema.parse({
    ...config,
    providers: {
      ...config.providers,
      [providerID]: {
        type: input.providerType,
        apiKey: input.apiKey.trim(),
        baseURL,
        customHeaders: {},
      },
    },
    models: {
      ...config.models,
      [modelKey]: {
        model: modelID,
        provider: providerID,
        contextWindow: "auto",
        temperature: null,
        topP: null,
        reasoningEffort: null,
        thinkingEnabled: true,
        stream: true,
        requestTimeoutSec: null,
      },
    },
    defaultModel: modelKey,
  });
}
