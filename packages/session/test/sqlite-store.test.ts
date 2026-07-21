import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { SqliteSessionStore } from "../src";

test("SQLite session history uses stable sequence cursors", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-history-"));
  const store = new SqliteSessionStore(join(root, "sessions.db"));
  store.create("ses_history", "History");
  for (const id of ["one", "two", "three"]) {
    store.appendEvent("ses_history", {
      type: "turn.submitted",
      id,
      text: id,
      byteLength: id.length,
      lineCount: 1,
      sha256: "test",
    });
  }
  const first = store.loadEventPage("ses_history", { limit: 2 });
  expect(first.events.map((item) => item.seq)).toEqual([1, 2]);
  expect(first.hasMore).toBe(true);
  const second = store.loadEventPage("ses_history", { after: first.events[1]!.seq, limit: 2 });
  expect(second.events.map((item) => item.seq)).toEqual([3]);
  expect(second.hasMore).toBe(false);
  store.close();
});

test("SQLite context epoch tracks checkpoint baseline sequence", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-context-epoch-"));
  const store = new SqliteSessionStore(join(root, "sessions.db"));
  store.create("ses_epoch", "Epoch");
  store.appendEvent("ses_epoch", {
    type: "context.checkpoint",
    id: "epoch_one",
    snapshot: {
      entries: [{ id: "user", role: "user", content: "hello" }],
      resources: [],
      journalOffset: 1,
      step: 1,
      tokenEstimate: 2,
      compactionGeneration: 0,
    },
  });
  store.appendEvent("ses_epoch", {
    type: "turn.finished",
    id: "turn_one",
    stopReason: "done",
  });
  expect(store.loadContextEpoch("ses_epoch")).toEqual({
    baselineSeq: 1,
    snapshot: {
      entries: [{ id: "user", role: "user", content: "hello" }],
      resources: [],
      journalOffset: 1,
      step: 1,
      tokenEstimate: 2,
      compactionGeneration: 0,
    },
  });
  store.close();
});
