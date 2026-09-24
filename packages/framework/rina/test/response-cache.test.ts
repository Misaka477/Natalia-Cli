import { expect, test } from "bun:test";
import {
  createResponseCache,
  responseCacheKey,
  type ResponseCacheKeyInput,
} from "../src/response-cache";

/**
 * RINA Phase 4's first cut (the study: "independent, default-off; the key
 * must carry stateRevision / contextEpoch; metrics and non-main-path
 * exact match first"). The service is the contract: a stable isolated
 * key, an opt-in switch that clears on disable, bounded eviction, and
 * metrics that make the hit rate observable.
 */

const request = (
  over?: Partial<ResponseCacheKeyInput>,
): ResponseCacheKeyInput => ({
  provider: "anthropic",
  model: "claude-test",
  role: "navi",
  sessionID: "ses_a",
  system: "you are navi",
  messages: [{ role: "user", content: "status?" }],
  tools: [{ name: "collab_respond" }],
  ...over,
});

test("the key is stable, and partitions on every part of the identity", () => {
  const base = responseCacheKey(request());
  expect(responseCacheKey(request())).toBe(base);
  // The study's isolation rule: a key is never shared across sessions.
  expect(responseCacheKey(request({ sessionID: "ses_b" }))).not.toBe(base);
  // Provider/model/role: a different answerer answers differently.
  expect(responseCacheKey(request({ provider: "openai" }))).not.toBe(base);
  expect(responseCacheKey(request({ model: "other" }))).not.toBe(base);
  expect(responseCacheKey(request({ role: "nia" }))).not.toBe(base);
  // The request identity: system, messages, tools.
  expect(responseCacheKey(request({ system: "you are nia" }))).not.toBe(base);
  expect(
    responseCacheKey(
      request({ messages: [{ role: "user", content: "other?" }] }),
    ),
  ).not.toBe(base);
  expect(responseCacheKey(request({ tools: [] }))).not.toBe(base);
  // The state partition rides the identity: the live context block is part
  // of the messages, so a state that changed the answer changed the key.
  expect(
    responseCacheKey(
      request({
        messages: [
          { role: "user", content: "status?" },
          { role: "user", content: "(live context: new fact)" },
        ],
      }),
    ),
  ).not.toBe(base);
});

test("default-off: nothing is stored, nothing is served, nothing throws", () => {
  const cache = createResponseCache();
  expect(cache.enabled()).toBe(false);
  cache.store("k", { text: "answer", at: "now" });
  expect(cache.lookup("k")).toBeUndefined();
  expect(cache.stats()).toMatchObject({ entries: 0, hits: 0, misses: 0 });
});

test("enabled: the exact match serves, the metrics count, disable clears", () => {
  const cache = createResponseCache();
  cache.setEnabled(true);
  const key = cache.key(request());
  cache.lookup(key); // the miss is counted
  cache.store(key, { text: "all green", at: "now" });
  const hit = cache.lookup(key);
  expect(hit?.text).toBe("all green");
  expect(cache.stats()).toMatchObject({
    hits: 1,
    misses: 1,
    entries: 1,
    charsServed: "all green".length,
  });
  // A different key misses.
  cache.lookup(
    cache.key(request({ messages: [{ role: "user", content: "x" }] })),
  );
  expect(cache.stats().misses).toBe(2);
  // Disabling clears: the next process's opt-in starts empty rather than
  // serving entries stored before the switch was thrown.
  cache.setEnabled(false);
  expect(cache.lookup(key)).toBeUndefined();
  cache.setEnabled(true);
  expect(cache.lookup(key)).toBeUndefined();
});

test("the bounds are a bound, not a TTL: the cap evicts the oldest", () => {
  const cache = createResponseCache({ maxEntries: 2 });
  cache.setEnabled(true);
  const keys = ["a", "b", "c"].map((suffix) =>
    cache.key(request({ messages: [{ role: "user", content: suffix }] })),
  );
  cache.store(keys[0]!, { text: "first", at: "now" });
  cache.store(keys[1]!, { text: "second", at: "now" });
  // A hit refreshes recency, so the next eviction drops the untouched one.
  expect(cache.lookup(keys[0]!)?.text).toBe("first");
  cache.store(keys[2]!, { text: "third", at: "now" });
  expect(cache.stats().entries).toBe(2);
  expect(cache.stats().evictions).toBe(1);
  expect(cache.lookup(keys[1]!)).toBeUndefined();
  expect(cache.lookup(keys[0]!)?.text).toBe("first");
  expect(cache.lookup(keys[2]!)?.text).toBe("third");
  // clear() is the rebuild path.
  cache.clear();
  expect(cache.stats().entries).toBe(0);
});
