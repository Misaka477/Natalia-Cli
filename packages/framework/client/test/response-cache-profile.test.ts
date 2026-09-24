import { expect, test } from "bun:test";
import {
  COMPOSITION_PROFILE_SCHEMA,
  type CompositionProfile,
} from "@anthelia/composition";
import { responseCacheEnabledFromProfile } from "../src/runtime/initialize/response-cache-profile";

/**
 * RINA Phase 4's opt-in row, read: absence and disabled are false (no
 * profile changes behavior until a drop-in says otherwise), an enabled
 * row is the operator's explicit acceptance, and a hand-built config
 * that does not fit the schema fails fast rather than defaulting.
 */

const base = (rows: CompositionProfile["rows"]): CompositionProfile => ({
  schema: COMPOSITION_PROFILE_SCHEMA,
  rows,
  hash: "test-hash",
});
const origin = { layer: "base" as const, file: "/app/composition.base.json" };
const row = (config: Record<string, unknown>, disabled?: boolean) => ({
  id: "anthelia.cache.response",
  ...(disabled === undefined ? {} : { disabled }),
  config,
  origin,
});

test("absence and disabled leave the cache off", () => {
  expect(responseCacheEnabledFromProfile(undefined)).toBe(false);
  expect(responseCacheEnabledFromProfile(base([]))).toBe(false);
  expect(
    responseCacheEnabledFromProfile(base([row({ enabled: true }, true)])),
  ).toBe(false);
});

test("an enabled row is the operator's opt-in; false is honored too", () => {
  expect(responseCacheEnabledFromProfile(base([row({ enabled: true })]))).toBe(
    true,
  );
  expect(responseCacheEnabledFromProfile(base([row({ enabled: false })]))).toBe(
    false,
  );
  // The schema's default fills an omitted key: a row that says nothing
  // is an explicit off, not an error.
  expect(responseCacheEnabledFromProfile(base([row({})])).valueOf()).toBe(
    false,
  );
});

test("a wrong-typed value fails fast here; unknown keys strip (the schema family's convention)", () => {
  // A non-boolean cannot be coerced into the switch — refusing is the
  // same fail-fast the loader's per-layer validation gives.
  expect(() =>
    responseCacheEnabledFromProfile(base([row({ enabled: "yes" })])),
  ).toThrow();
  // An unknown key is stripped by the schema family (the loader behaves
  // the same way): the row parses, the key is ignored, the default holds.
  expect(
    responseCacheEnabledFromProfile(base([row({ unknown: true })])).valueOf(),
  ).toBe(false);
});
