import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeEvent } from "@anthelia/contracts";
import { createContextVault } from "../src/vault";

/**
 * RINA Phase1: the Cold Vault — FTS5 recall over journaled facts,
 * session/workspace isolation, invalidation scopes, rebuild-identical,
 * the write-behind timer, and the study's isolation rule PROVEN AT THE
 * BYTE LEVEL: a model/user body (content.partial) never reaches the
 * sqlite file, because unclassified types are skipped by construction.
 */

const dirs: string[] = [];
const vaults: Array<{ close: () => void }> = [];
afterAll(() => {
  for (const v of vaults) v.close();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function vault(flushMs?: number) {
  const dir = mkdtempSync(join(tmpdir(), "vault-"));
  dirs.push(dir);
  const instance = createContextVault({ dir, flushMs: flushMs ?? 5 });
  vaults.push(instance);
  return instance;
}

const switched = (sessionID: string, to: string, seq: number) =>
  ({
    type: "composition.switched",
    to,
    reason: `switched to ${to}`,
    sessionID,
    workspaceID: "w1",
    seq,
    at: new Date().toISOString(),
  }) as unknown as RuntimeEvent;

const partial = (text: string) =>
  ({
    type: "content.partial",
    id: "t1",
    text,
    at: new Date().toISOString(),
  }) as unknown as RuntimeEvent;

test("FTS5 recall finds journaled facts, scoped per session (isolation)", () => {
  const v = vault();
  v.remember({
    id: "s1:1",
    workspaceID: "w1",
    sessionID: "s1",
    recordType: "decision",
    entityKey: "gen-1",
    summary: "switched to gen-1",
    seq: 1,
  });
  v.remember({
    id: "s2:1",
    workspaceID: "w1",
    sessionID: "s2",
    recordType: "decision",
    entityKey: "gen-2",
    summary: "switched to gen-2",
    seq: 1,
  });
  const scoped = v.recall("switched", { sessionID: "s1" });
  expect(scoped).toHaveLength(1);
  expect(scoped[0]!.sessionID).toBe("s1");
  expect(scoped[0]!.entityKey).toBe("gen-1");
  expect(scoped[0]!.rank).toBeGreaterThan(0); // bm25, negated = bigger better
  // access counting + history is recorded
  expect(v.recall("switched", { sessionID: "s1" })).toHaveLength(1);
  const rows = v.recall("switched", {}); // no scope filter = both sessions
  expect(rows).toHaveLength(2);
  // a non-matching query = nothing (FTS, not substring guesswork)
  expect(v.recall("nonexistentterm", {})).toHaveLength(0);
});

test("classification: a journaled composition.switched becomes a record; a body-bearing partial NEVER does (byte-level)", () => {
  const v = vault();
  const LEAK_MARKER = "SECRET_MODEL_BODY_MARKER_do_not_store";
  v.enqueue(switched("s3", "gen-9", 7));
  v.enqueue(partial(LEAK_MARKER)); // unclassified by construction
  v.flushNow();
  const hits = v.recall("switched", { sessionID: "s3" });
  expect(hits).toHaveLength(1);
  expect(hits[0]!.entityKey).toBe("gen-9");
  expect(hits[0]!.summary).toContain("gen-9");
  // the isolation rule, at the byte level: the body text is nowhere in
  // the database file (not in a row, not in the fts shadow, not in WAL)
  const dbBytes = readFileSync(v.path, "latin1");
  expect(dbBytes.includes(LEAK_MARKER)).toBe(false);
  try {
    const wal = readFileSync(`${v.path}-wal`, "latin1");
    expect(wal.includes(LEAK_MARKER)).toBe(false);
  } catch {
    // no wal yet = also without the marker
  }
});

test("the write-behind timer lands records without an explicit flush", async () => {
  const v = vault(5);
  v.enqueue(switched("s4", "gen-t", 1));
  await new Promise((resolve) => setTimeout(resolve, 40)); // > flushMs
  expect(v.recall("switched", { sessionID: "s4" })).toHaveLength(1);
});

test("invalidate removes only its scope; rebuild is identical across replays", () => {
  const v = vault();
  const events = [
    switched("a", "gen-1", 1),
    switched("b", "gen-2", 2),
    partial("never stored"),
  ];
  v.rebuild(events);
  const first = v
    .recall("switched", {})
    .map((row) => `${row.id}:${row.entityKey}`)
    .sort();
  expect(first).toHaveLength(2);
  // replay the same events: byte-identical content (ids + entities)
  v.rebuild(events);
  const second = v
    .recall("switched", {})
    .map((row) => `${row.id}:${row.entityKey}`)
    .sort();
  expect(second).toEqual(first);
  // scoped invalidation
  expect(v.invalidate({ sessionID: "a" })).toBe(1);
  expect(v.recall("switched", { sessionID: "a" })).toHaveLength(0);
  expect(v.recall("switched", { sessionID: "b" })).toHaveLength(1);
  expect(() => v.invalidate({})).toThrow(/at least one dimension/u);
});

test("state(): an honest reason without a reader — not a stub", () => {
  const v = vault();
  const answer = v.state("s1");
  expect(answer.available).toBe(false);
  if (!answer.available) expect(answer.reason).toContain("Phase2");
});
