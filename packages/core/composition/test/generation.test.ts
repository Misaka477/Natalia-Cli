import { expect, test } from "bun:test";
import { ObjectStore } from "@anthelia/object-store";
import {
  GENERATION_SCHEMA,
  type Generation,
  type RuntimeEvent,
} from "@anthelia/contracts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGeneration,
  deriveCompositionPointer,
  loadGeneration,
  parseGeneration,
  serializeGeneration,
  storeGeneration,
} from "../src/index";

function testStore(): { root: string; store: ObjectStore } {
  const root = mkdtempSync(join(tmpdir(), "natalia-composition-"));
  return { root, store: new ObjectStore(root) };
}

// Bun's sync mkdtemp keeps the helper honest across platforms.
import { mkdtempSync } from "node:fs";

const CONFIG = {
  version: 3,
  runtime: { terminal: { backend: "pty" as const } },
} as unknown as Generation["config"];

const CATALOG = [
  { id: "natalia-skills", enabled: true, fingerprint: "fp-skills" },
  { id: "natalia-team", enabled: false, fingerprint: "fp-team" },
];

test("serialize and parse round-trip a generation", () => {
  const generation = buildGeneration({
    config: CONFIG,
    catalog: CATALOG,
    policyRows: [],
  });
  const parsed = parseGeneration(serializeGeneration(generation));
  expect(parsed).toEqual(generation);
  expect(parsed.schema).toBe(GENERATION_SCHEMA);
});

test("the catalog is stored sorted, so entry order never changes the id", () => {
  const a = buildGeneration({
    config: CONFIG,
    catalog: CATALOG,
    policyRows: [],
  });
  const b = buildGeneration({
    config: CONFIG,
    catalog: [...CATALOG].reverse(),
    policyRows: [],
  });
  expect(serializeGeneration(a)).toBe(serializeGeneration(b));
});

test("storing identical content yields the identical id", async () => {
  const { root, store } = testStore();
  try {
    const a = buildGeneration({
      config: CONFIG,
      catalog: CATALOG,
      policyRows: [],
    });
    const b = buildGeneration({
      config: CONFIG,
      catalog: CATALOG,
      policyRows: [],
    });
    const first = await storeGeneration(store, a);
    const second = await storeGeneration(store, b);
    expect(first).toBe(second);
    const loaded = await loadGeneration(store, first);
    expect(loaded.plugins.map(({ id }) => id)).toEqual([
      "natalia-skills",
      "natalia-team",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a changed config is a different generation", async () => {
  const { root, store } = testStore();
  try {
    const first = await storeGeneration(
      store,
      buildGeneration({ config: CONFIG, catalog: CATALOG, policyRows: [] }),
    );
    const second = await storeGeneration(
      store,
      buildGeneration({
        config: {
          ...CONFIG,
          runtime: { terminal: { backend: "wezterm", windowMode: "auto" } },
        } as Generation["config"],
        catalog: CATALOG,
        policyRows: [],
      }),
    );
    expect(second).not.toBe(first);
    expect(await store.has(first)).toBe(true);
    expect(await store.has(second)).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("parseGeneration rejects a foreign schema", () => {
  expect(() =>
    parseGeneration(JSON.stringify({ schema: "other/1", plugins: [] })),
  ).toThrow(/unknown generation schema/);
});

test("the pointer derives from the last switch, previous from its from", () => {
  const pointer = deriveCompositionPointer([
    { type: "session.created" } as unknown as RuntimeEvent,
    switched("gen-a", undefined, "config.reload"),
    switched("gen-b", "gen-a", "config.reload"),
    switched("gen-c", "gen-b", "rollback"),
  ]);
  expect(pointer).toEqual({ current: "gen-c", previous: "gen-b" });
});

test("a proposal that never commits stays the candidate", () => {
  const pointer = deriveCompositionPointer([
    switched("gen-a", undefined, "config.reload"),
    proposed("gen-b", "agent.proposal"),
  ]);
  expect(pointer).toEqual({
    current: "gen-a",
    previous: undefined,
    candidate: "gen-b",
  });
});

test("a committed proposal stops being the candidate", () => {
  const pointer = deriveCompositionPointer([
    switched("gen-a", undefined, "config.reload"),
    proposed("gen-b", "agent.proposal"),
    switched("gen-b", "gen-a", "config.reload"),
  ]);
  expect(pointer.candidate).toBeUndefined();
  expect(pointer.current).toBe("gen-b");
});

test("the latest proposal wins as the candidate", () => {
  const pointer = deriveCompositionPointer([
    proposed("gen-x", "agent.proposal"),
    proposed("gen-y", "agent.proposal"),
  ]);
  expect(pointer.candidate).toBe("gen-y");
});

test("a stream without switches has no pointer", () => {
  expect(deriveCompositionPointer([])).toEqual({});
});

test("the first switch has no previous", () => {
  const pointer = deriveCompositionPointer([
    switched("gen-a", undefined, "config.reload"),
  ]);
  expect(pointer).toEqual({ current: "gen-a" });
});

function proposed(candidateID: string, reason: string): RuntimeEvent {
  return {
    type: "composition.proposed",
    candidateID,
    reason,
  } as unknown as RuntimeEvent;
}

function switched(
  to: string,
  from: string | undefined,
  reason: string,
): RuntimeEvent {
  return {
    type: "composition.switched",
    to,
    ...(from ? { from } : {}),
    reason,
  } as unknown as RuntimeEvent;
}
