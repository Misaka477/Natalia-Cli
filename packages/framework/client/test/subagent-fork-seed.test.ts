import { expect, test } from "bun:test";
import type { ContextEntry } from "@anthelia/runtime";
import {
  forkSeedEntries,
  isSeedRole,
} from "../src/runtime/initialize/subagent-fork-seed";

function entry(
  id: string,
  role: ContextEntry["role"],
  extra: Partial<ContextEntry> = {},
): ContextEntry {
  return { id, role, content: id, ...extra };
}

const conversation: ContextEntry[] = [
  entry("system", "system"),
  entry("u1", "user"),
  entry("a1", "assistant"),
  entry("c1", "tool_call", { pairID: "p1" }),
  entry("r1", "tool_result", { pairID: "p1" }),
  entry("u2", "user"),
  entry("a2", "assistant"),
  entry("c2", "tool_call", { pairID: "p2" }),
  entry("r2", "tool_result", { pairID: "p2" }),
  entry("u3", "user"),
  entry("a3", "assistant"),
  entry("c3", "tool_call", { pairID: "p3" }),
];

test("the seed is everything before the parent's last user message", () => {
  // The last user message opens the turn the parent may still be inside, so the
  // in-flight work is excluded rather than shown to the child unanswered.
  expect(forkSeedEntries(conversation).map((e) => e.id)).toEqual([
    "fork:u1",
    "fork:a1",
    "fork:c1",
    "fork:r1",
    "fork:u2",
    "fork:a2",
    "fork:c2",
    "fork:r2",
  ]);
});

test("a trailing unpaired tool call is trimmed", () => {
  // Carrying it would ask the child to answer for work it never did.
  const seed = forkSeedEntries(conversation);
  expect(seed.at(-1)!.role).toBe("tool_result");
  expect(seed.some((e) => e.role === "tool_call" && !e.pairID)).toBe(false);
});

test("a leading orphaned tool result is trimmed", () => {
  const orphaned: ContextEntry[] = [
    entry("system", "system"),
    entry("r0", "tool_result", { pairID: "p0" }),
    entry("u1", "user"),
    entry("a1", "assistant"),
    entry("u2", "user"),
  ];

  // A provider rejects a conversation that opens with a tool result.
  expect(forkSeedEntries(orphaned).map((e) => e.id)).toEqual([
    "fork:u1",
    "fork:a1",
  ]);
});

test("the parent's system prompt never reaches the child", () => {
  const seed = forkSeedEntries(conversation);
  expect(seed.some((e) => e.role === "system")).toBe(false);
});

test("runtime notices and resources stay with the parent", () => {
  // What the parent was told is not what the child should be told.
  const withRuntime: ContextEntry[] = [
    entry("system", "system"),
    entry("u1", "user"),
    entry("settled:a1:0", "dynamic"),
    entry("res", "resource", { content: "a resource" }),
    entry("a1", "assistant"),
    entry("u2", "user"),
  ];
  const seed = forkSeedEntries(withRuntime);
  expect(seed.map((e) => e.id)).toEqual(["fork:u1", "fork:a1"]);
});

test("a compaction summary carries into the seed, because it is the history", () => {
  const compacted: ContextEntry[] = [
    entry("system", "system"),
    entry("summary", "summary"),
    entry("u1", "user"),
    entry("a1", "assistant"),
    entry("u2", "user"),
  ];
  expect(forkSeedEntries(compacted).map((e) => e.id)).toEqual([
    "fork:summary",
    "fork:u1",
    "fork:a1",
  ]);
});

test("seeded ids are re-keyed so they cannot collide with the child's own", () => {
  // The ledger rejects a duplicate id, and a fork that failed to seed would
  // silently start the child with nothing.
  const seed = forkSeedEntries(conversation);
  expect(seed.every((e) => e.id.startsWith("fork:"))).toBe(true);
  expect(seed.some((e) => e.id === "system" || e.id === "task")).toBe(false);
});

test("re-keying preserves tool pairing, which keys on pairID", () => {
  const seed = forkSeedEntries(conversation);
  const calls = seed.filter((e) => e.role === "tool_call");
  const results = seed.filter((e) => e.role === "tool_result");
  expect(calls).toHaveLength(2);
  expect(results).toHaveLength(2);
  for (const call of calls)
    expect(results.some((r) => r.pairID === call.pairID)).toBe(true);
});

test("a conversation with no completed turn seeds nothing", () => {
  expect(
    forkSeedEntries([entry("system", "system"), entry("u1", "user")]),
  ).toEqual([]);
  expect(
    forkSeedEntries([entry("system", "system"), entry("a1", "assistant")]),
  ).toEqual([]);
  expect(forkSeedEntries([])).toEqual([]);
});

test("only seed roles carry over", () => {
  expect(isSeedRole("user")).toBe(true);
  expect(isSeedRole("assistant")).toBe(true);
  expect(isSeedRole("tool_call")).toBe(true);
  expect(isSeedRole("tool_result")).toBe(true);
  expect(isSeedRole("summary")).toBe(true);
  expect(isSeedRole("system")).toBe(false);
  expect(isSeedRole("resource")).toBe(false);
  expect(isSeedRole("dynamic")).toBe(false);
});
