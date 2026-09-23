import { expect, test } from "bun:test";
import {
  COMPOSITION_PROFILE_SCHEMA,
  type CompositionProfile,
} from "@natalia/composition";
import { effectiveConfinementMode } from "../src/runtime/tool-execution/execute-context";

/**
 * The composition-default file-effect mode (P3 base profile): the
 * `anthelia.sandbox` row wins, the legacy config key is its fallback
 * (retire the row with `disabled: true` to hand the key back), the
 * schema default closes the chain — and a hand-built profile cannot
 * smuggle an illegal mode past the membership guard.
 */

const profile = (rows: CompositionProfile["rows"]): CompositionProfile => ({
  schema: COMPOSITION_PROFILE_SCHEMA,
  rows,
});
const row = (config: Record<string, unknown>, disabled?: boolean) => ({
  id: "anthelia.sandbox",
  ...(disabled === undefined ? {} : { disabled }),
  config,
  origin: { layer: "base" as const, file: "/app/composition.base.json" },
});

test("the composition row wins over the legacy config key", () => {
  expect(
    effectiveConfinementMode({
      profile: profile([row({ mode: "read-only" })]),
      configMode: "danger-full-access",
    }),
  ).toBe("read-only");
});

test("a retired row (disabled) hands the key back to legacy config", () => {
  expect(
    effectiveConfinementMode({
      profile: profile([row({ mode: "read-only" }, true)]),
      configMode: "danger-full-access",
    }),
  ).toBe("danger-full-access");
});

test("no profile: the legacy config key, then the schema default", () => {
  expect(effectiveConfinementMode({ configMode: "read-only" })).toBe(
    "read-only",
  );
  expect(effectiveConfinementMode({})).toBe("workspace-write");
  expect(effectiveConfinementMode({})).toBe("workspace-write");
});

test("membership guard: garbage in either source falls through to the chain's next legal value", () => {
  expect(
    effectiveConfinementMode({
      profile: profile([row({ mode: "sideways" })]),
      configMode: "also-bad",
    }),
  ).toBe("workspace-write");
  expect(
    effectiveConfinementMode({
      profile: profile([row({ mode: "sideways" })]),
      configMode: "read-only",
    }),
  ).toBe("read-only");
  expect(
    effectiveConfinementMode({
      profile: profile([row({})]),
      configMode: undefined,
    }),
  ).toBe("workspace-write");
});
