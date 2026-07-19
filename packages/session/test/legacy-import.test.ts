import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { expect, test } from "bun:test";
import { importLegacyGoSession, JsonSessionStore } from "../src";

test("imports legacy Go JSONL session messages with explicit unsupported warnings", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-import-"));
  const legacy = join(root, "legacy", "123");
  await mkdir(legacy, { recursive: true });
  await writeFile(
    join(legacy, "meta.json"),
    JSON.stringify({ id: "123", title: "Legacy title" }),
  );
  await writeFile(
    join(legacy, "context.jsonl"),
    `${JSON.stringify({ role: "user", content: "hello" })}\n${JSON.stringify({ role: "assistant", content: "hi" })}\n`,
  );
  await writeFile(join(legacy, "state.json"), JSON.stringify({ version: 1 }));
  await writeFile(join(legacy, "wire.jsonl"), "{}\n");

  const store = new JsonSessionStore(join(root, "ts-sessions"));
  const result = await importLegacyGoSession({
    legacyDir: legacy,
    targetStore: store,
  });
  expect(result.session.id).toBe("ses_import_123");
  expect(result.importedMessages).toBe(2);
  expect(result.warnings.join("\n")).toContain("wire.jsonl is not replayed");
  const persisted = await readFile(
    join(root, "ts-sessions", "ses_import_123.json"),
    "utf8",
  );
  expect(persisted).toContain("hello");
  expect(persisted).toContain("hi");
});

test("lists durable TS sessions newest first and skips corrupt records", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-list-"));
  const store = new JsonSessionStore(join(root, "sessions"));
  await store.save({
    id: "ses_old",
    title: "Old session",
    createdAt: "2025-01-01T00:00:00.000Z",
    events: [],
    cancelled: false,
    resumable: true,
  });
  await store.save({
    id: "ses_new",
    title: "New session",
    createdAt: "2026-01-01T00:00:00.000Z",
    events: [],
    cancelled: false,
    resumable: true,
  });
  await writeFile(join(root, "sessions", "broken.json"), "{");
  expect((await store.list()).map((session) => session.id)).toEqual([
    "ses_new",
    "ses_old",
  ]);
});
