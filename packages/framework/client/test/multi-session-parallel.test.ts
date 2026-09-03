import { expect, test } from "bun:test";
import { createOfficialRuntimeClient, officialPluginWorkspace } from "./plugin-test-helpers";

test("two sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const createdA = await client.sessionNew?.();
  const createdB = await client.sessionNew?.();
  const first = client.submitAndWait?.({
    text: "first session",
    sessionID: createdA?.sessionID,
  });
  const second = client.submitAndWait?.({
    text: "second session",
    sessionID: createdB?.sessionID,
  });
  const [a, b] = await Promise.all([first, second]);
  expect(a?.id).toBeTruthy();
  expect(b?.id).toBeTruthy();
  await client.dispose?.();
});

test("ten sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-10");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const sessions = [];
  for (let i = 0; i < 10; i++) {
    const created = await client.sessionNew?.();
    if (created?.sessionID) sessions.push(created.sessionID);
  }
  const tasks = sessions.map((sessionID, index) =>
    client.submitAndWait?.({
      text: `session ${index}`,
      sessionID,
    }),
  );
  const results = await Promise.all(tasks);
  expect(results.length).toBe(10);
  for (const result of results) expect(result?.id).toBeTruthy();
  await client.dispose?.();
});

test("twenty sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-20");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const sessions = [];
  for (let i = 0; i < 20; i++) {
    const created = await client.sessionNew?.();
    if (created?.sessionID) sessions.push(created.sessionID);
  }
  const tasks = sessions.map((sessionID, index) =>
    client.submitAndWait?.({
      text: `session ${index}`,
      sessionID,
    }),
  );
  const results = await Promise.all(tasks);
  expect(results.length).toBe(20);
  for (const result of results) expect(result?.id).toBeTruthy();
  await client.dispose?.();
});

test("fifty sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-50");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const sessions = [];
  for (let i = 0; i < 50; i++) {
    const created = await client.sessionNew?.();
    if (created?.sessionID) sessions.push(created.sessionID);
  }
  const tasks = sessions.map((sessionID, index) =>
    client.submitAndWait?.({
      text: `session ${index}`,
      sessionID,
    }),
  );
  const results = await Promise.all(tasks);
  expect(results.length).toBe(50);
  for (const result of results) expect(result?.id).toBeTruthy();
  await client.dispose?.();
});

test("hundred sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-100");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const sessions = [];
  for (let i = 0; i < 100; i++) {
    const created = await client.sessionNew?.();
    if (created?.sessionID) sessions.push(created.sessionID);
  }
  const tasks = sessions.map((sessionID, index) =>
    client.submitAndWait?.({
      text: `session ${index}`,
      sessionID,
    }),
  );
  const results = await Promise.all(tasks);
  expect(results.length).toBe(100);
  for (const result of results) expect(result?.id).toBeTruthy();
  await client.dispose?.();
});

test("two sessions chat concurrently without cross-channel mixing", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-chat");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "chat reply" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const createdA = await client.sessionNew?.();
  const createdB = await client.sessionNew?.();
  const a = await client.chatSubmit?.({
    text: "chat a",
    channel: "navi",
    sessionID: createdA?.sessionID,
  });
  const b = await client.chatSubmit?.({
    text: "chat b",
    channel: "navi",
    sessionID: createdB?.sessionID,
  });
  expect(a?.messageID).toBeTruthy();
  expect(b?.messageID).toBeTruthy();
  const rowsA = await client.chatMessages?.("navi", createdA?.sessionID);
  const rowsB = await client.chatMessages?.("navi", createdB?.sessionID);
  expect(rowsA?.some((row) => row.text.includes("chat a"))).toBe(true);
  expect(rowsB?.some((row) => row.text.includes("chat b"))).toBe(true);
  expect(rowsA?.some((row) => row.text.includes("chat b"))).toBe(false);
  expect(rowsB?.some((row) => row.text.includes("chat a"))).toBe(false);
  await client.dispose?.();
});

test("two sessions mailbox messages do not leak across sessions", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-mailbox");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const createdA = await client.sessionNew?.();
  const createdB = await client.sessionNew?.();
  await client.mailboxSend?.({
    intent: "request_report",
    text: "mailbox for A",
    sessionID: createdA?.sessionID,
  });
  await client.mailboxSend?.({
    intent: "request_report",
    text: "mailbox for B",
    sessionID: createdB?.sessionID,
  });
  const rowsA = await client.mailboxList?.(createdA?.sessionID);
  const rowsB = await client.mailboxList?.(createdB?.sessionID);
  expect(rowsA?.some((row) => row.text.includes("mailbox for A"))).toBe(true);
  expect(rowsB?.some((row) => row.text.includes("mailbox for B"))).toBe(true);
  expect(rowsA?.some((row) => row.text.includes("mailbox for B"))).toBe(false);
  expect(rowsB?.some((row) => row.text.includes("mailbox for A"))).toBe(false);
  await client.dispose?.();
});

test("two sessions runtimeStatus resolve independently", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-status");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const createdA = await client.sessionNew?.();
  const createdB = await client.sessionNew?.();
  await client.submitAndWait?.({ text: "a", sessionID: createdA?.sessionID });
  await client.submitAndWait?.({ text: "b", sessionID: createdB?.sessionID });
  const statusA = await client.runtimeStatus?.(createdA?.sessionID);
  const statusB = await client.runtimeStatus?.(createdB?.sessionID);
  expect(statusA).toBeTruthy();
  expect(statusB).toBeTruthy();
  await client.dispose?.();
});

test("two sessions diagnostics resolve independently", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-diag");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const createdA = await client.sessionNew?.();
  const createdB = await client.sessionNew?.();
  const diagA = await client.diagnostics?.(100, createdA?.sessionID);
  const diagB = await client.diagnostics?.(100, createdB?.sessionID);
  expect(Array.isArray(diagA)).toBe(true);
  expect(Array.isArray(diagB)).toBe(true);
  await client.dispose?.();
});

test("two hundred sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-200");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const sessions = [];
  for (let i = 0; i < 200; i++) {
    const created = await client.sessionNew?.();
    if (created?.sessionID) sessions.push(created.sessionID);
  }
  const tasks = sessions.map((sessionID, index) =>
    client.submitAndWait?.({
      text: `session ${index}`,
      sessionID,
    }),
  );
  const results = await Promise.all(tasks);
  expect(results.length).toBe(200);
  for (const result of results) expect(result?.id).toBeTruthy();
  await client.dispose?.();
});

test("five hundred sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel-500");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const sessions = [];
  for (let i = 0; i < 500; i++) {
    const created = await client.sessionNew?.();
    if (created?.sessionID) sessions.push(created.sessionID);
  }
  const tasks = sessions.map((sessionID, index) =>
    client.submitAndWait?.({
      text: `session ${index}`,
      sessionID,
    }),
  );
  const results = await Promise.all(tasks);
  expect(results.length).toBe(500);
  for (const result of results) expect(result?.id).toBeTruthy();
  await client.dispose?.();
});
