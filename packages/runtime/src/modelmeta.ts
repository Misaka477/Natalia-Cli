import { keyIdentity } from "@natalia/config";

export type ContextWindowSource =
  | "config"
  | "provider_metadata"
  | "provider_detail"
  | "known_catalog"
  | "fallback";

export type ContextWindowConfidence = "high" | "medium" | "low";

export type ContextWindowResolution = {
  tokens: number;
  source: ContextWindowSource;
  confidence: ContextWindowConfidence;
  detectedAt: string;
  expiresAt: string;
  ttlMs: number;
  diagnostic: string;
};

export type ModelMetadataProvider = {
  listModels?(): Promise<
    Array<{ id: string; contextWindow?: number; inputTokenLimit?: number }>
  >;
  modelDetail?(
    model: string,
  ): Promise<{ contextWindow?: number; inputTokenLimit?: number } | undefined>;
};

export type ResolveContextInput = {
  provider: string;
  model: string;
  baseURL?: string;
  apiKey?: string;
  explicitContextWindow?: number | "auto";
  providerAdapter?: ModelMetadataProvider;
  now?: Date;
  ttlMs?: number;
};

type CacheEntry = ContextWindowResolution;

export class ContextWindowResolver {
  private cache = new Map<string, CacheEntry>();

  async resolve(input: ResolveContextInput): Promise<ContextWindowResolution> {
    const now = input.now ?? new Date();
    const ttlMs = input.ttlMs ?? 24 * 60 * 60 * 1000;
    if (typeof input.explicitContextWindow === "number") {
      return resolution(
        input.explicitContextWindow,
        "config",
        "high",
        now,
        ttlMs,
        "explicit config context_window",
      );
    }

    const cacheKey = this.cacheKey(input);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.parse(cached.expiresAt) > now.getTime()) return cached;

    const fromModels = await this.fromProviderMetadata(input, now, ttlMs);
    if (fromModels) {
      this.cache.set(cacheKey, fromModels);
      return fromModels;
    }

    const detail = await input.providerAdapter
      ?.modelDetail?.(input.model)
      .catch(() => undefined);
    const detailTokens = detail?.contextWindow ?? detail?.inputTokenLimit;
    if (detailTokens && detailTokens > 0) {
      const result = resolution(
        detailTokens,
        "provider_detail",
        "high",
        now,
        ttlMs,
        "provider model detail context window",
      );
      this.cache.set(cacheKey, result);
      return result;
    }

    const known = knownModelContextWindow(input.model);
    if (known) {
      const result = resolution(
        known,
        "known_catalog",
        "medium",
        now,
        ttlMs,
        "known-model catalog fallback",
      );
      this.cache.set(cacheKey, result);
      return result;
    }

    const fallback = resolution(
      32_000,
      "fallback",
      "low",
      now,
      ttlMs,
      "conservative fallback; provider metadata unavailable",
    );
    this.cache.set(cacheKey, fallback);
    return fallback;
  }

  cacheKey(
    input: Pick<
      ResolveContextInput,
      "provider" | "model" | "baseURL" | "apiKey"
    >,
  ) {
    return [
      input.provider,
      input.baseURL ?? "default",
      input.model,
      keyIdentity(input.apiKey),
    ].join("|");
  }

  private async fromProviderMetadata(
    input: ResolveContextInput,
    now: Date,
    ttlMs: number,
  ) {
    const models = await input.providerAdapter
      ?.listModels?.()
      .catch(() => undefined);
    const item = models?.find((candidate) => candidate.id === input.model);
    const tokens = item?.contextWindow ?? item?.inputTokenLimit;
    if (!tokens || tokens <= 0) return undefined;
    return resolution(
      tokens,
      "provider_metadata",
      "high",
      now,
      ttlMs,
      "provider /models metadata context window",
    );
  }
}

export function knownModelContextWindow(model: string) {
  const normalized = model.toLowerCase();
  if (normalized.includes("gpt-5.5")) return 200_000;
  if (normalized.includes("gpt-4.1")) return 1_000_000;
  if (normalized.includes("claude") && normalized.includes("opus"))
    return 200_000;
  if (normalized.includes("gemini") && normalized.includes("1.5"))
    return 1_000_000;
  return undefined;
}

function resolution(
  tokens: number,
  source: ContextWindowSource,
  confidence: ContextWindowConfidence,
  now: Date,
  ttlMs: number,
  diagnostic: string,
): ContextWindowResolution {
  return {
    tokens,
    source,
    confidence,
    detectedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    ttlMs,
    diagnostic,
  };
}
