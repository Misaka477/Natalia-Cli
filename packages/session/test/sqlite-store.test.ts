import { mkdtemp } from "node:fs/promises";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import type { SessionID } from "@natalia/contracts";
import { SqliteSessionStore } from "../src";
import { createSessionRecord } from "../src";

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
  const second = store.loadEventPage("ses_history", {
    after: first.events[1]!.seq,
    limit: 2,
  });
  expect(second.events.map((item) => item.seq)).toEqual([3]);
  expect(second.hasMore).toBe(false);
  store.close();
});

test("SQLite message pages use turn cursors without loading unrelated history", () => {
  const path = join(tmpdir(), `natalia-message-page-${crypto.randomUUID()}.db`);
  const store = new SqliteSessionStore(path);
  const sessionID = "ses_message_page" as const;
  try {
    store.create(sessionID, "Message page");
    for (const id of ["turn_one", "turn_two", "turn_three"]) {
      store.appendEvents(sessionID, [
        {
          type: "turn.submitted",
          id,
          text: id,
          byteLength: id.length,
          lineCount: 1,
          sha256: "fixture",
        },
        { type: "content.done", id, text: `${id} response` },
        { type: "turn.finished", id, stopReason: "done" },
      ]);
    }
    const first = store.loadMessagePage(sessionID, { order: "asc", limit: 2 });
    expect(first.data.map((message) => message.id)).toEqual([
      "turn_one",
      "turn_two",
    ]);
    expect(first.data[0]?.rows.map((row) => row.kind)).toEqual([
      "user",
      "assistant",
      "system",
    ]);
    expect(first.cursor.next).toEqual(expect.any(String));

    const next = store.loadMessagePage(sessionID, {
      cursor: first.cursor.next,
    });
    expect(next.data.map((message) => message.id)).toEqual(["turn_three"]);
    expect(next.cursor.previous).toEqual(expect.any(String));

    const previous = store.loadMessagePage(sessionID, {
      cursor: next.cursor.previous,
      limit: 2,
    });
    expect(previous.data.map((message) => message.id)).toEqual([
      "turn_one",
      "turn_two",
    ]);

    const latest = store.loadMessagePage(sessionID, { limit: 2 });
    expect(latest.data.map((message) => message.id)).toEqual([
      "turn_three",
      "turn_two",
    ]);
    const older = store.loadMessagePage(sessionID, {
      cursor: latest.cursor.next,
      limit: 2,
    });
    expect(older.data.map((message) => message.id)).toEqual(["turn_one"]);
  } finally {
    store.close();
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
  }
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

test("SQLite recovery projection tracks durable control state and backfills history", () => {
  const path = join(tmpdir(), `natalia-recovery-${crypto.randomUUID()}.db`);
  const store = new SqliteSessionStore(path);
  const sessionID = "ses_recovery" as const;
  try {
    store.create(sessionID, "Recovery");
    store.appendEvents(sessionID, [
      {
        type: "agent.selection",
        name: "reviewer",
        pending: false,
      },
      { type: "model.selection", modelID: "model-a", variant: "fast" },
      {
        type: "turn.submitted",
        id: "turn_active",
        text: "active",
        byteLength: 6,
        lineCount: 1,
        sha256: "fixture",
        attachments: [
          {
            id: "attachment_one",
            path: "/tmp/one.txt",
            filename: "one.txt",
            mediaType: "text/plain",
            byteLength: 1,
            sha256: "fixture",
          },
        ],
      },
      {
        type: "approval.request",
        id: "turn_active:approval",
        title: "Approve",
        preview: "fixture",
      },
      {
        type: "question.request",
        id: "turn_active:question",
        title: "Question",
        questions: [],
      },
    ]);
    const projection = store.loadRecoveryProjection(sessionID);
    expect(projection.activeTurnIDs).toEqual(["turn_active"]);
    expect(projection.approvals).toHaveLength(1);
    expect(projection.questions).toHaveLength(1);
    expect(projection.selectedAgent).toBe("reviewer");
    expect(projection.selectedModel).toEqual({
      modelID: "model-a",
      variant: "fast",
    });
    expect(projection.attachments.get("turn_active")?.[0]?.filename).toBe(
      "one.txt",
    );

    store.appendEvents(sessionID, [
      {
        type: "approval.response",
        id: "turn_active:approval",
        decision: "once",
      },
      { type: "question.response", id: "turn_active:question", answers: [] },
      { type: "turn.finished", id: "turn_active", stopReason: "done" },
    ]);
    const settled = store.loadRecoveryProjection(sessionID);
    expect(settled.activeTurnIDs).toEqual([]);
    expect(settled.approvals).toEqual([]);
    expect(settled.questions).toEqual([]);
  } finally {
    store.close();
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
  }
});

test("SQLite recovery projection keeps the latest bounded diagnostics", () => {
  const path = join(tmpdir(), `natalia-diagnostics-${crypto.randomUUID()}.db`);
  const store = new SqliteSessionStore(path);
  const sessionID = "ses_diagnostics" as const;
  try {
    store.create(sessionID, "Diagnostics");
    store.appendEvents(
      sessionID,
      Array.from({ length: 505 }, (_, index) => ({
        type: "diagnostic" as const,
        level: "info" as const,
        message: `diagnostic ${index}`,
        at: "2026-07-25T00:00:00.000Z",
      })),
    );
    const diagnostics = store.loadRecoveryProjection(sessionID).diagnostics;
    expect(diagnostics).toHaveLength(500);
    expect(diagnostics[0]?.message).toBe("diagnostic 5");
    expect(diagnostics.at(-1)?.message).toBe("diagnostic 504");
  } finally {
    store.close();
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
  }
});

test("SQLite attachment references include history and pending input attachments", () => {
  const path = join(tmpdir(), `natalia-attachments-${crypto.randomUUID()}.db`);
  const store = new SqliteSessionStore(path);
  const session = createSessionRecord("ses_attachments", "Attachments");
  const historyAttachment = {
    id: "att_history",
    path: ".natalia/attachments/att_history-history.txt",
    filename: "history.txt",
    mediaType: "text/plain" as const,
    byteLength: 1,
    sha256: "history",
  };
  const inputAttachment = {
    id: "att_input",
    path: ".natalia/attachments/att_input-input.txt",
    filename: "input.txt",
    mediaType: "text/plain" as const,
    byteLength: 1,
    sha256: "input",
  };
  session.events.push({
    type: "turn.submitted",
    id: "turn_history",
    text: "history",
    byteLength: 7,
    lineCount: 1,
    sha256: "fixture",
    attachments: [historyAttachment],
  });
  session.inbox = [
    {
      id: "turn_input",
      sessionID: session.id,
      text: "input",
      attachments: [inputAttachment],
      delivery: "queue",
      admittedAt: "2026-07-25T00:00:00.000Z",
      admittedSeq: 1,
    },
  ];
  try {
    store.replace(session);
    expect(
      store.referencedAttachments().map((attachment) => attachment.id),
    ).toEqual(expect.arrayContaining(["att_history", "att_input"]));
  } finally {
    store.close();
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
  }
});

test("SQLite session replacement preserves duplicate history and metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-replace-"));
  const store = new SqliteSessionStore(join(root, "sessions.db"));
  const session = createSessionRecord("ses_copy", "Copy");
  session.metadata = {
    pinned: true,
    lastAccessedAt: "2026-07-22T00:00:00.000Z",
  };
  session.events.push({
    type: "turn.submitted",
    id: "turn_copy",
    text: "hello",
    byteLength: 5,
    lineCount: 1,
    sha256: "test",
  });
  store.replace(session);
  expect(store.get("ses_copy")?.pinned).toBe(true);
  expect(store.eventCount("ses_copy")).toBe(1);
  store.updateMetadata("ses_copy", { pinned: false });
  expect(store.get("ses_copy")?.pinned).toBe(false);
  store.delete("ses_copy");
  expect(store.get("ses_copy")).toBeUndefined();
  expect(store.loadEvents("ses_copy")).toEqual([]);
  expect(store.loadContextEpoch("ses_copy")).toBeUndefined();
  store.close();
});

test("SQLite session records retain inbox through duplicate and fork", () => {
  const root = join(tmpdir(), `natalia-sqlite-inbox-${crypto.randomUUID()}.db`);
  const store = new SqliteSessionStore(root);
  const session = createSessionRecord("ses_inbox", "Inbox");
  session.events.push(
    {
      type: "turn.submitted",
      id: "turn_one",
      text: "one",
      byteLength: 3,
      lineCount: 1,
      sha256: "fixture",
    },
    {
      type: "turn.submitted",
      id: "turn_two",
      text: "two",
      byteLength: 3,
      lineCount: 1,
      sha256: "fixture",
    },
  );
  session.inbox = [
    {
      id: "turn_one",
      sessionID: session.id,
      text: "one",
      delivery: "steer",
      admittedAt: "2026-07-25T00:00:00.000Z",
      admittedSeq: 1,
      promotedAt: "2026-07-25T00:00:01.000Z",
      promotedSeq: 1,
    },
    {
      id: "turn_two",
      sessionID: session.id,
      text: "two",
      delivery: "queue",
      admittedAt: "2026-07-25T00:00:02.000Z",
      admittedSeq: 2,
    },
  ];
  try {
    store.replace(session);
    expect(store.pendingInputCount(session.id)).toBe(1);
    expect(store.duplicate(session.id, "ses_inbox_copy").inbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionID: "ses_inbox_copy" }),
      ]),
    );
    expect(store.fork(session.id, "turn_two", "ses_inbox_fork").inbox).toEqual([
      expect.objectContaining({ id: "turn_one", sessionID: "ses_inbox_fork" }),
    ]);
  } finally {
    store.close();
    rmSync(root, { force: true, recursive: true });
    rmSync(`${root}-wal`, { force: true });
    rmSync(`${root}-shm`, { force: true });
  }
});

test("SQLite enforces session foreign keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-foreign-keys-"));
  const store = new SqliteSessionStore(join(root, "sessions.db"));
  expect(() =>
    store.appendEvent("ses_missing", {
      type: "turn.finished",
      id: "turn_missing",
      stopReason: "done",
    }),
  ).toThrow();
  store.close();
});

test("SQLite batches async durable appends and flushes settlement barriers", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-async-batch-"));
  const store = new SqliteSessionStore(join(root, "sessions.db"));
  const sessionID = "ses_async_batch" as SessionID;
  try {
    store.create(sessionID, "async batch");
    store.enqueueEvent(sessionID, {
      type: "turn.submitted",
      id: "turn_async",
      text: "hello",
      byteLength: 5,
      lineCount: 1,
      sha256: "test",
    });
    store.enqueueEvent(sessionID, {
      type: "status.update",
      status: "working",
    });
    await store.flushPendingWrites(sessionID);
    expect(store.loadEvents(sessionID).map((event) => event.type)).toEqual([
      "turn.submitted",
      "status.update",
    ]);
    await store.appendEventAsync(sessionID, {
      type: "turn.finished",
      id: "turn_async",
      stopReason: "done",
    });
    expect(store.loadRecoveryProjection(sessionID).activeTurnIDs).toEqual([]);
    expect(store.loadEvents(sessionID)).toHaveLength(3);
  } finally {
    store.close();
    rmSync(root, { force: true, recursive: true });
    rmSync(`${root}-wal`, { force: true });
    rmSync(`${root}-shm`, { force: true });
  }
});

test("SQLite close flushes queued async durable appends", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-close-flush-"));
  const path = join(root, "sessions.db");
  const sessionID = "ses_close_flush" as SessionID;
  const store = new SqliteSessionStore(path);
  store.create(sessionID, "close flush");
  store.enqueueEvent(sessionID, {
    type: "turn.submitted",
    id: "turn_close",
    text: "persist me",
    byteLength: 10,
    lineCount: 1,
    sha256: "test",
  });
  store.close();
  const reopened = new SqliteSessionStore(path);
  try {
    expect(reopened.loadEvents(sessionID)).toEqual([
      expect.objectContaining({ type: "turn.submitted", id: "turn_close" }),
    ]);
  } finally {
    reopened.close();
    rmSync(root, { force: true, recursive: true });
    rmSync(`${root}-wal`, { force: true });
    rmSync(`${root}-shm`, { force: true });
  }
});

test("SQLite batch barriers survive reopen without waiting for the timer", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-barrier-reopen-"));
  const path = join(root, "sessions.db");
  const sessionID = "ses_barrier_reopen" as SessionID;
  const store = new SqliteSessionStore(path);
  store.create(sessionID, "barrier reopen");
  store.enqueueEvent(sessionID, {
    type: "turn.submitted",
    id: "turn_barrier",
    text: "durable before settlement",
    byteLength: 25,
    lineCount: 1,
    sha256: "test",
  });
  store.enqueueEvent(sessionID, {
    type: "turn.finished",
    id: "turn_barrier",
    stopReason: "done",
  });
  await store.flushPendingWrites(sessionID);
  store.close();
  const reopened = new SqliteSessionStore(path);
  try {
    expect(reopened.loadEvents(sessionID).map((event) => event.type)).toEqual([
      "turn.submitted",
      "turn.finished",
    ]);
    expect(reopened.loadRecoveryProjection(sessionID).activeTurnIDs).toEqual(
      [],
    );
  } finally {
    reopened.close();
    rmSync(root, { force: true, recursive: true });
  }
});

test("SQLite passive checkpoint preserves event reads", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sqlite-checkpoint-"));
  const store = new SqliteSessionStore(join(root, "sessions.db"));
  try {
    store.create("ses_checkpoint", "checkpoint");
    store.appendEvent("ses_checkpoint", {
      type: "diagnostic",
      level: "info",
      message: "checkpoint me",
      at: "2026-07-25T00:00:00.000Z",
    });
    expect(store.checkpoint()).toMatchObject({ busy: expect.any(Number) });
    expect(store.eventCount("ses_checkpoint")).toBe(1);
  } finally {
    store.close();
    rmSync(root, { force: true, recursive: true });
  }
});
