import {
  configV3Schema,
  modelRefKey,
  parseModelRef,
  type ConfigV3,
  type ModelCapabilities,
  type ModelLimits,
  type ModelOverride,
  type ModelRef,
  type ProviderRequestDefaults,
} from "@natalia/contracts";
import { evaluateModelPolicy, evaluatePolicy } from "./policy";

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  toolCall: true,
  reasoning: true,
  thinking: true,
  imageInput: false,
  pdfInput: false,
  videoInput: false,
};

export type CatalogProviderModel = {
  id: string;
  provider: string;
  name: string;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  status: "stable" | "experimental" | "deprecated";
  source: "discovery" | "manual";
};

export interface CatalogProvider {
  id: string;
  name: string;
  driver: string;
  configured: boolean;
  models: CatalogProviderModel[];
}

export function buildModelCatalog(config: ConfigV3): CatalogProvider[] {
  return Object.entries(config.providers ?? {})
    .filter(
      ([id, provider]) =>
        provider.enabled &&
        evaluatePolicy(
          config.experimental.policies,
          "provider.use",
          id,
          "allow",
        ) === "allow",
    )
    .map(([id, provider]) => ({
      id,
      name: provider.name,
      driver: provider.driver,
      configured: Boolean(provider.connection?.apiKey),
      models: catalogModelsForProvider(config, id),
    }));
}

function catalogModelsForProvider(
  config: ConfigV3,
  providerID: string,
): CatalogProviderModel[] {
  const catalogModels = config.catalog?.providers?.[providerID]?.models ?? {};
  const overrideKeys = Object.keys(config.modelOverrides ?? {}).filter((key) =>
    key.startsWith(`${providerID}/`),
  );
  const modelIDs = new Set([
    ...Object.keys(catalogModels),
    ...overrideKeys.map((key) => key.slice(providerID.length + 1)),
  ]);
  return [...modelIDs]
    .filter(
      (modelID) =>
        config.modelOverrides[
          modelRefKey({ provider: providerID, model: modelID })
        ]?.enabled !== false,
    )
    .filter(
      (modelID) =>
        evaluateModelPolicy(
          config.experimental.policies,
          providerID,
          modelID,
        ) === "allow",
    )
    .map((modelID) => {
      const catalogModel = catalogModels[modelID];
      const override =
        config.modelOverrides[
          modelRefKey({ provider: providerID, model: modelID })
        ];
      return {
        id: modelID,
        provider: providerID,
        name: override?.name ?? catalogModel?.name ?? modelID,
        capabilities: catalogModel?.capabilities ?? DEFAULT_CAPABILITIES,
        limits: catalogModel?.limits ?? { contextWindow: "auto" },
        status: catalogModel?.status ?? "stable",
        source: catalogModel?.source ?? "manual",
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function discoverProviderModels(
  driver: string,
  baseURL: string,
  apiKey: string,
): Promise<string[]> {
  const base = baseURL.trim().replace(/\/+$/u, "");
  if (!base)
    throw new Error("Provider base URL is required for model discovery");
  if (!apiKey.trim())
    throw new Error("Provider API key is required for model discovery");

  const anthropic = driver === "anthropic";
  const gemini = driver === "gemini";
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
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  ]
    .map((value) => (gemini ? value.replace(/^models\//u, "") : value))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Configures a provider and imports one or more models into the catalog.
 *
 * Discovery or manual import both land in `catalog.providers[providerID].models`;
 * model overrides are never touched, so existing user intent (enabled, name,
 * request tuning) survives re-import. A missing default model is set to the
 * first imported model; an existing default is preserved.
 */
export function configureProviderModels(
  config: ConfigV3,
  input: {
    providerID: string;
    providerName?: string;
    driver: string;
    baseURL?: string;
    apiKey?: string;
    authHeader?: string;
    requestDefaults?: Partial<ProviderRequestDefaults>;
    source: "discovery" | "manual";
    modelIDs: string[];
  },
): ConfigV3 {
  const providerID = input.providerID.trim();
  if (!providerID) throw new Error("Provider ID is required");
  if (!input.driver.trim()) throw new Error("Provider driver is required");
  if (input.source === "discovery" && !input.apiKey?.trim())
    throw new Error("Provider API key is required for discovery");
  const baseURL = input.baseURL?.trim().replace(/\/+$/u, "");
  const modelIDs = [
    ...new Set(input.modelIDs.map((id) => id.trim()).filter(Boolean)),
  ];
  if (!modelIDs.length) throw new Error("At least one model ID is required");

  const existing = config.providers[providerID];
  const existingModels = config.catalog?.providers?.[providerID]?.models ?? {};

  return configV3Schema.parse({
    ...config,
    providers: {
      ...config.providers,
      [providerID]: {
        name: input.providerName?.trim() || existing?.name || providerID,
        driver: input.driver,
        enabled: existing?.enabled ?? true,
        connection: {
          baseURL: baseURL || existing?.connection?.baseURL,
          apiKey: input.apiKey?.trim() || existing?.connection?.apiKey,
          authHeader:
            input.authHeader?.trim() || existing?.connection?.authHeader,
        },
        requestDefaults: {
          stream:
            input.requestDefaults?.stream ??
            existing?.requestDefaults?.stream ??
            true,
          headers: {
            ...(existing?.requestDefaults?.headers ?? {}),
            ...(input.requestDefaults?.headers ?? {}),
          },
          options: {
            ...(existing?.requestDefaults?.options ?? {}),
            ...(input.requestDefaults?.options ?? {}),
          },
        },
      },
    },
    catalog: {
      ...config.catalog,
      providers: {
        ...config.catalog?.providers,
        [providerID]: {
          models: {
            ...existingModels,
            ...Object.fromEntries(
              modelIDs
                .filter((modelID) => !(modelID in existingModels))
                .map((modelID) => [
                  modelID,
                  {
                    name: modelID,
                    capabilities: { ...DEFAULT_CAPABILITIES },
                    limits: { contextWindow: "auto" },
                    status: "stable",
                    source: input.source,
                  },
                ]),
            ),
          },
        },
      },
    },
    defaultModel: config.defaultModel ?? {
      provider: providerID,
      model: modelIDs[0]!,
    },
  });
}

export type EffectiveModel = {
  ref: ModelRef;
  key: string;
  providerID: string;
  providerName: string;
  driver: string;
  name: string;
  enabled: boolean;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  status: "stable" | "experimental" | "deprecated";
  source: "discovery" | "manual";
  override?: ModelOverride;
  requestDefaults: {
    temperature: number | null;
    topP: number | null;
    stream: boolean;
    thinkingEnabled: boolean;
    headers: Record<string, string>;
    options: Record<string, unknown>;
  };
};

/**
 * Resolves the effective model: catalog facts merged under user overrides and
 * the provider's connection-level request defaults. Returns undefined when the
 * provider is unknown.
 */
export function resolveEffectiveModel(
  config: ConfigV3,
  ref: ModelRef | string,
): EffectiveModel | undefined {
  const modelRef = typeof ref === "string" ? parseModelRef(ref) : ref;
  const provider = config.providers[modelRef.provider];
  if (!provider) return undefined;
  const key = modelRefKey(modelRef);
  const catalogModel =
    config.catalog?.providers?.[modelRef.provider]?.models?.[modelRef.model];
  const override = config.modelOverrides[key];
  if (!catalogModel && !override) return undefined;
  return {
    ref: modelRef,
    key,
    providerID: modelRef.provider,
    providerName: provider.name,
    driver: provider.driver,
    name: override?.name ?? catalogModel?.name ?? modelRef.model,
    enabled:
      override?.enabled !== undefined
        ? override.enabled
        : catalogModel !== undefined,
    capabilities: catalogModel?.capabilities ?? DEFAULT_CAPABILITIES,
    limits: catalogModel?.limits ?? { contextWindow: "auto" },
    status: catalogModel?.status ?? "stable",
    source: catalogModel?.source ?? "manual",
    override,
    requestDefaults: {
      temperature: override?.requestDefaults.temperature ?? null,
      topP: override?.requestDefaults.topP ?? null,
      stream:
        override?.requestDefaults.stream ?? provider.requestDefaults.stream,
      thinkingEnabled: override?.requestDefaults.thinkingEnabled ?? true,
      headers: {
        ...provider.requestDefaults.headers,
        ...override?.headers,
      },
      options: {
        ...provider.requestDefaults.options,
        ...override?.requestOptions,
      },
    },
  };
}
