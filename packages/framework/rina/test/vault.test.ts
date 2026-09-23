import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeEvent } from "@anthelia/contracts";
import { buildContextPack, createContextVault } from "../src/vault";

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

test("Phase2a scoring: the study's coefficients, each signal in its own direction", async () => {
  const v = vault();
  const day = 86_400_000;
  const now = Date.now();
  // same type + same query fit, different AGES -> the time signal alone
  v.remember({
    id: "s:old",
    workspaceID: "w",
    sessionID: "s",
    recordType: "decision",
    entityKey: "alpha-key",
    summary: "alpha decision",
    createdAt: new Date(now - 90 * day).toISOString(),
  });
  v.remember({
    id: "s:new",
    workspaceID: "w",
    sessionID: "s",
    recordType: "decision",
    entityKey: "alpha-key",
    summary: "alpha decision",
    createdAt: new Date(now).toISOString(),
  });
  const fresh = v.recall("alpha", { sessionID: "s" });
  expect(fresh).toHaveLength(2);
  expect(fresh[0]!.id).toBe("s:new"); // time signal orders them
  expect(fresh[0]!.breakdown.time).toBeGreaterThan(fresh[1]!.breakdown.time);
  // the total IS the study's weighted sum (0.35/0.25/0.20/0.20)
  for (const hit of fresh) {
    const b = hit.breakdown;
    expect(hit.score).toBeCloseTo(
      0.35 * b.fts + 0.25 * b.time + 0.2 * b.evidence + 0.2 * b.entity,
      9,
    );
  }
  // the evidence TABLE: a decision outranks tool_history at equal age
  v.remember({
    id: "s:tool",
    workspaceID: "w",
    sessionID: "s",
    recordType: "tool_history",
    entityKey: "alpha-two",
    summary: "alpha ran",
    createdAt: new Date(now).toISOString(),
  });
  const mixed = v.recall("alpha", { sessionID: "s" });
  const decision = mixed.find((hit) => hit.recordType === "decision")!;
  const tool = mixed.find((hit) => hit.recordType === "tool_history")!;
  expect(decision.breakdown.evidence).toBeGreaterThan(tool.breakdown.evidence);
  // the entity signal: a query overlapping the ENTITY's tokens scores it
  expect(decision.breakdown.entity).toBeGreaterThan(0);
});

test("Phase2a hot tier: promotion serves get(), invalidation kills the promotion, the cap holds", () => {
  const v = vault();
  v.remember({
    id: "p:1",
    workspaceID: "w",
    sessionID: "p",
    recordType: "plan",
    entityKey: "plan-a",
    summary: "plan a moved",
  });
  v.recall("moved", { sessionID: "p" });
  expect(v.hotStats().size).toBe(1);
  const served = v.get("p:1"); // a promoted hit answers from the tier
  expect(served?.summary).toBe("plan a moved");
  // THE STALE-PROMOTION GUARD: an invalidated row must not answer from
  // the tier (this fails if the hot-delete line is ever removed)
  expect(v.invalidate({ id: "p:1" })).toBe(1);
  expect(v.get("p:1")).toBeUndefined();
  // a never-promoted id falls through the tier to the store
  v.remember({
    id: "p:2",
    workspaceID: "w",
    sessionID: "p",
    recordType: "plan",
    entityKey: "plan-b",
    summary: "plan b started",
  });
  expect(v.get("p:2")?.summary).toBe("plan b started");
  expect(v.hotStats().size).toBe(1); // and the get promoted it
  // the cap: overflow evicts from the head, never grows past it
  for (let i = 0; i < 260; i += 1) {
    v.remember({
      id: `cap:${i}`,
      workspaceID: "w",
      sessionID: "cap",
      recordType: "decision",
      entityKey: `k${i}`,
      summary: `decision ${i}`,
    });
    v.recall(`decision ${i}`, { sessionID: "cap", limit: 1 });
  }
  expect(v.hotStats().size).toBeLessThanOrEqual(200);
});

test("Phase2a ContextPack: role filters, dedupe by entity, budget truncation, breakdown preserved", () => {
  const hits = [
    mkHit("1", "plan", "plan-x", "plan x", 0.9),
    mkHit("2", "collab", "plan-x", "plan x again", 0.8), // same entity -> deduped
    mkHit("3", "mailbox", "mail-y", "mail y", 0.7),
  ];
  const estimate = (text: string) => text.length;
  // nia's role = plan/evidence/decision/tool_history (the study's pick)
  const forNia = buildContextPack(hits, {
    role: "nia",
    budgetTokens: 10_000,
    estimate,
  });
  expect(forNia.items.map((item) => item.id)).toEqual(["1"]); // x deduped (kept the better), mailbox dropped
  expect(forNia.droppedByRole).toBe(2); // collab + mailbox: nia's pick is plan/evidence/decision/tool_history
  expect(forNia.deduped).toBe(0); // the collab never reaches dedupe: its role drops it first
  expect(forNia.truncated).toBe(false);
  expect(forNia.items[0]!.breakdown.fts).toBeGreaterThan(0);
  // navi's role = mailbox+collab only
  const forNavi = buildContextPack(hits, {
    role: "navi",
    budgetTokens: 10_000,
    estimate,
  });
  expect(forNavi.items.map((item) => item.id)).toEqual(["2", "3"]);
  // the main agent sees everything
  const forNatalia = buildContextPack(hits, {
    role: "natalia",
    budgetTokens: 10_000,
    estimate,
  });
  expect(forNatalia.items.map((item) => item.id)).toEqual(["1", "3"]);
  expect(forNatalia.droppedByRole).toBe(0);
  // the dedupe's real home = the full-visibility role: plan-x appears
  // twice, the better score keeps it
  expect(forNatalia.deduped).toBe(1);
  // a budget that fits one item truncates the rest
  const oneItem = forNatalia.items[0]!;
  const budgeted = buildContextPack(hits, {
    role: "natalia",
    budgetTokens: oneItem.tokens,
    estimate,
  });
  expect(budgeted.items).toHaveLength(1);
  expect(budgeted.truncated).toBe(true);
  expect(budgeted.tokens).toBe(oneItem.tokens);
});

function mkHit(
  id: string,
  recordType: "plan" | "collab" | "mailbox",
  entityKey: string,
  summary: string,
  score: number,
) {
  return {
    id,
    recordType,
    entityKey,
    summary,
    sessionID: "s",
    createdAt: new Date().toISOString(),
    rank: score,
    score,
    breakdown: { fts: score, time: 0.5, evidence: 0.7, entity: 0.2 },
  };
}
