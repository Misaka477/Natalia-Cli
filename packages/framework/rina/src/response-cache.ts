import { createHash } from "node:crypto";

/**
 * RINA ResponseCache (rina-cache study Phase 4, first cut: "independent,
 * default-off; the key must carry stateRevision / contextEpoch; soft
 * delete / eviction / rebuild; metrics and non-main-path exact match
 * first").
 *
 * What it is: an opt-in exact-match cache for PROVIDER RESPONSES — the
 * identical request (model + role + system + messages + tools, over the
 * same session-state watermark) answers from the cache instead of calling
 * the API. It is NOT a CacheFabric kind: law 1 classifies only
 * deterministic work, and a sampled provider response is not one. Its
 * correctness rests on the key's identity, its safety on being
 * default-off — an operator who enables it accepts that the identical
 * request may answer with the earlier, identical request's response.
 *
 * The key's parts, and why each:
 *  - `model` / `provider` / `role`: a different model, endpoint or
 *    persona answers differently;
 *  - `sessionID`: the study's isolation rule — a key is never shared
 *    across sessions;
 *  - `systemHash` / `messagesHash` / `toolsHash`: the full request
 *    identity — the study's exact match, byte-level over the serialized
 *    request.
 *
 * The study's key requirement ("must carry stateRevision / contextEpoch")
 * maps onto the request identity for a turn: the turn's live context rides
 * INSIDE the messages (the runtime_context block), so the byte-level
 * identity is the state partition — a state that changed the answer
 * changed a message, and the key changed with it. A separate numeric
 * revision (a journal watermark, say) would be strictly worse: every
 * append changes it, so valid exact matches would be refused while the
 * message identity already carries every input the answer depends on.
 */

export type ResponseCacheKeyInput = {
  provider: string;
  model: string;
  role: string;
  /** The study's isolation rule: a key is never shared across sessions. */
  sessionID: string;
  system?: string;
  messages: unknown;
  tools?: unknown;
};

export type ResponseCacheValue = {
  /** The answer text the stream produced. */
  text: string;
  /** The provider usage the stream reported, when it did. */
  usage?: { inputTokens?: number; outputTokens?: number };
  at: string;
};

export type ResponseCacheStats = {
  enabled: boolean;
  hits: number;
  misses: number;
  evictions: number;
  entries: number;
  bytes: number;
  /** Characters of answer text served from cache instead of generated. */
  charsServed: number;
};

export interface ResponseCache {
  /** The default-off switch: absent means off, and off means untouched. */
  enabled(): boolean;
  setEnabled(next: boolean): void;
  /** The key: a stable digest over the request identity. */
  key(input: ResponseCacheKeyInput): string;
  /** The cached answer for this exact key, when present (and enabled). */
  lookup(key: string): ResponseCacheValue | undefined;
  store(key: string, value: ResponseCacheValue): void;
  /** The rebuild path: drop everything. */
  clear(): void;
  stats(): ResponseCacheStats;
}

export type ResponseCacheOptions = {
  /** Default false: the cache is opt-in, never ambient. */
  enabled?: boolean;
  /** Entry cap — a bound, not a TTL (the fabric's law: no guessing). */
  maxEntries?: number;
  /** Char budget over all answers — the eviction unit is the oldest entry. */
  maxChars?: number;
};

const DEFAULT_MAX_ENTRIES = 64;
const DEFAULT_MAX_CHARS = 256_000;

/** A stable digest: the same request always derives the same key. */
function digest(parts: unknown[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(JSON.stringify(part) ?? "null");
  return hash.digest("hex").slice(0, 32);
}

/**
 * The key: a stable digest over the request identity. A pure function —
 * a key must not depend on which cache instance asks for it.
 */
export function responseCacheKey(input: ResponseCacheKeyInput): string {
  return digest([
    input.sessionID,
    input.provider,
    input.model,
    input.role,
    input.system ?? "",
    input.messages,
    input.tools ?? null,
  ]);
}

export function createResponseCache(
  options: ResponseCacheOptions = {},
): ResponseCache {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  let enabled = options.enabled ?? false;
  const entries = new Map<string, ResponseCacheValue>();
  const stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    charsServed: 0,
  };

  function sizeOf(value: ResponseCacheValue): number {
    return value.text.length + 64;
  }

  function evictWhileOverBudget(): void {
    // Map order is insertion order: evict from the head (the oldest).
    let total = [...entries.values()].reduce(
      (sum, value) => sum + sizeOf(value),
      0,
    );
    while (entries.size > maxEntries || total > maxChars) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      const dropped = entries.get(oldest.value)!;
      entries.delete(oldest.value);
      total -= sizeOf(dropped);
      stats.evictions += 1;
    }
  }

  return {
    enabled: () => enabled,
    setEnabled(next) {
      // Disabling clears: a disabled cache must not serve stale entries
      // when it is turned back on in a later process.
      if (enabled && !next) entries.clear();
      enabled = next;
    },
    key: responseCacheKey,
    lookup(key) {
      if (!enabled) return undefined;
      const hit = entries.get(key);
      if (!hit) {
        stats.misses += 1;
        return undefined;
      }
      // A hit refreshes recency so the eviction order is access order.
      entries.delete(key);
      entries.set(key, hit);
      stats.hits += 1;
      stats.charsServed += hit.text.length;
      return hit;
    },
    store(key, value) {
      if (!enabled) return;
      entries.set(key, value);
      evictWhileOverBudget();
    },
    clear() {
      entries.clear();
    },
    stats() {
      return {
        enabled,
        hits: stats.hits,
        misses: stats.misses,
        evictions: stats.evictions,
        entries: entries.size,
        bytes: [...entries.values()].reduce(
          (sum, value) => sum + sizeOf(value),
          0,
        ),
        charsServed: stats.charsServed,
      };
    },
  };
}

/**
 * The cache's request view: what a provider call's identity is made of.
 * Structural (the messages/tools are hashed as opaque JSON) so the cache
 * stays free of a dependency on the provider contract — a key derivable
 * from any caller's own request shape.
 */
export type ResponseCacheRequest = {
  messages: unknown;
  tools?: unknown;
  provider: string;
  model: string;
  role: string;
  sessionID: string;
  system?: string;
};

/** Convenience: derive a key straight from a provider request. */
export function responseCacheKeyFor(request: ResponseCacheRequest): string {
  return responseCacheKey({
    sessionID: request.sessionID,
    provider: request.provider,
    model: request.model,
    role: request.role,
    system: request.system,
    messages: request.messages,
    tools: request.tools,
  });
}
