import { expect, test } from "bun:test";
import { createTestContext } from "@anthelia/runtime-services";
import { createResponseCache, rinaResponseCache } from "@anthelia/rina";
import type { RuntimeContext } from "@anthelia/substrate";
import { createSettingsSurface } from "../src/runtime/session-execution/settings";

/**
 * The response cache's runtime face (rina Phase 4): the host reads the
 * state and flips the live process's opt-in — the restart-free toggle
 * beside the composition row's boot-time one. A bare runtime (no cache
 * service) answers its own off state rather than inventing one.
 */

function ctxWith(input?: { cache?: boolean }): RuntimeContext {
  const cache = createResponseCache({ enabled: false });
  return {
    ports: { getReady: async () => {} },
    state: {
      serviceDirectory: createTestContext(
        input?.cache ? [rinaResponseCache.mock(cache)] : [],
      ),
    },
  } as unknown as RuntimeContext;
}

test("the face reads and flips the live cache, and reports the metrics", async () => {
  const cache = createResponseCache({ enabled: false });
  const ctx = {
    ports: { getReady: async () => {} },
    state: {
      serviceDirectory: createTestContext([rinaResponseCache.mock(cache)]),
    },
  } as unknown as RuntimeContext;
  const surface = createSettingsSurface(ctx, {});
  // The read: off, no traffic yet.
  expect(await surface.responseCache!()).toEqual({
    enabled: false,
    hits: 0,
    misses: 0,
    entries: 0,
  });
  // The flip: the answer's state is the new truth; the store/list behind
  // it now behaves as enabled (the profile row's reader is untouched —
  // this is the live process's switch).
  expect(await surface.responseCache!({ enabled: true })).toMatchObject({
    enabled: true,
  });
  const key = cache.key({
    provider: "anthropic",
    model: "claude-test",
    role: "navi",
    sessionID: "ses_a",
    messages: [{ role: "user", content: "status?" }],
  });
  // A miss before the store, then the hit — both counted (the study's
  // metrics make the hit rate observable).
  expect(cache.lookup(key)).toBeUndefined();
  cache.store(key, { text: "ok", at: "now" });
  expect(cache.lookup(key)?.text).toBe("ok");
  expect(await surface.responseCache!()).toMatchObject({
    enabled: true,
    misses: 1,
    hits: 1,
    entries: 1,
  });
  // And back off: the live switch is symmetric.
  expect(await surface.responseCache!({ enabled: false })).toMatchObject({
    enabled: false,
  });
});

test("a bare runtime answers off, never a guess", async () => {
  const surface = createSettingsSurface(ctxWith(), {});
  expect(await surface.responseCache!()).toEqual({
    enabled: false,
    hits: 0,
    misses: 0,
    entries: 0,
  });
  // A flip against a bare runtime is a no-op value: the answer stays the
  // honest off state.
  expect(await surface.responseCache!({ enabled: true })).toMatchObject({
    enabled: false,
  });
});
