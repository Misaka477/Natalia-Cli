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
