import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAttachmentService } from "@natalia/attachments";
import type { SessionID } from "@natalia/contracts";
import {
  JsonSessionStore,
  SqliteSessionStore,
  createSessionRecord,
} from "@natalia/session";
import {
  createLocalSessionService,
  createSessionStoreController,
} from "../src";

test("local session service preserves offline JSON and SQLite visibility", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-local-session-service-"));
  const json = new JsonSessionStore(join(root, ".natalia", "sessions"));
  await json.save(createSessionRecord("ses_json" as SessionID, "JSON"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  const sqlite = new SqliteSessionStore(join(root, ".natalia", "sessions.db"));
  sqlite.create("ses_sqlite" as SessionID, "SQLite");
  sqlite.close();

  const sessions = createLocalSessionService(root);
  expect((await sessions.list()).map((session) => session.id).sort()).toEqual([
    "ses_json",
    "ses_sqlite",
  ]);
  expect(await sessions.show("ses_sqlite")).toMatchObject({
    id: "ses_sqlite",
    title: "SQLite",
  });
  expect(await sessions.rename("ses_json", "Renamed")).toEqual({
    id: "ses_json",
    title: "Renamed",
  });
});

test("session store controller initializes sqlite mode and lists sessions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-store-"));
  const controller = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => "ses_host" as SessionID,
    useSqliteStore: true,
    attachments: createAttachmentService(root),
  });

  await controller.init();
  expect(controller.status()).toEqual({ initialized: true, mode: "sqlite" });
  const listing = await controller.list();
  expect(listing.some((session) => session.id === "ses_host")).toBe(true);
  await controller.close();
  expect(controller.status()).toEqual({ initialized: false, mode: "sqlite" });
});

test("sqlite init preserves existing active JSON session history", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-session-store-active-json-"),
  );
  const json = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const legacy = createSessionRecord(
    "ses_active_json" as SessionID,
    "Active JSON",
  );
  legacy.events.push({
    type: "turn.finished",
    id: "turn_json",
    sessionID: "ses_active_json",
  } as never);
  await json.save(legacy);
  const controller = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => "ses_active_json" as SessionID,
    useSqliteStore: true,
    attachments: createAttachmentService(root),
  });

  await controller.init();
  const listing = await controller.list();
  expect(
    listing.find((session) => session.id === "ses_active_json"),
  ).toMatchObject({
    id: "ses_active_json",
    title: "Active JSON",
    events: 1,
  });
  await controller.close();
});

test("session store controller archives and restores a session without deleting it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-archive-"));
  const controller = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => "ses_host" as SessionID,
    useSqliteStore: true,
    attachments: createAttachmentService(root),
  });

  await controller.init();
  await controller.create({ id: "ses_archive", title: "Archive me" });

  const archived = await controller.archive("ses_archive");
  expect(archived).toEqual({ id: "ses_archive", archived: true });

  const listing = await controller.list();
  expect(
    listing.find((session) => session.id === "ses_archive")?.archived,
  ).toBe(true);

  const restored = await controller.restore("ses_archive");
  expect(restored).toEqual({ id: "ses_archive", archived: false });

  const after = await controller.list();
  expect(after.find((session) => session.id === "ses_archive")?.archived).toBe(
    false,
  );

  await controller.close();
});
