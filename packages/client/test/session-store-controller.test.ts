import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionStoreController } from "../src/session-store-controller";
import { createAttachmentService } from "../src/attachment-service";

test("session store: create is idempotent, archive marks, export dumps", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-store-"));
  const controller = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => "ses_host" as const,
    attachments: createAttachmentService(root),
  });
  await controller.init();

  const created = await controller.create({ id: "ses_a", title: "A" });
  expect(created).toEqual({ sessionID: "ses_a", created: true });
  const replay = await controller.create({ id: "ses_a" });
  expect(replay.created).toBe(false);

  const archived = await controller.archive("ses_a");
  expect(archived.archived).toBe(true);
  const exported = await controller.export("ses_a");
  expect(exported.title).toBe("A");
  expect(exported.archived).toBe(true);

  const list = await controller.list();
  expect(list.some((summary) => summary.id === "ses_a")).toBe(true);

  const removed = await controller.delete("ses_a");
  expect(removed.removedAttachments).toBe(0);
  const after = await controller.list();
  expect(after.some((summary) => summary.id === "ses_a")).toBe(false);

  const missing = await controller
    .archive("ses_unknown")
    .catch((error: unknown) => error);
  expect((missing as Error).message).toContain("session not found");

  await controller.close();
});

test("session store: the active session refuses deletion", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-store-2-"));
  const controller = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => "ses_active" as const,
    attachments: createAttachmentService(root),
  });
  await controller.init();
  const refused = await controller
    .delete("ses_active")
    .catch((error: unknown) => error);
  expect((refused as Error).message).toContain(
    "cannot delete the active runtime session",
  );
  await controller.close();
});

test("session store: JSON summaries project the pending human terminal", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-store-pending-"));
  const controller = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => "ses_host" as const,
    attachments: createAttachmentService(root),
  });
  await controller.init();
  try {
    await controller.create({ id: "ses_wait", title: "Waiting" });
    const store = controller.json();
    const record = await store.load("ses_wait" as const);
    record!.metadata = {
      pendingHumanTerminal: {
        terminalID: "tty_wait",
        reason: "needs the sudo password",
        since: "2026-08-12T00:00:00.000Z",
      },
    };
    await store.save(record!);

    const summary = (await controller.list()).find(
      (entry) => entry.id === "ses_wait",
    );
    expect(summary?.pendingHumanTerminal).toMatchObject({
      terminalID: "tty_wait",
      reason: "needs the sudo password",
      since: "2026-08-12T00:00:00.000Z",
    });

    delete record!.metadata!.pendingHumanTerminal;
    await store.save(record!);
    const after = await controller.list();
    expect(
      after.find((entry) => entry.id === "ses_wait")?.pendingHumanTerminal,
    ).toBeUndefined();
  } finally {
    await controller.close();
  }
});

test("session store: SQLite summaries project the pending human terminal", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-session-store-pending-db"),
  );
  const controller = createSessionStoreController({
    workspaceRoot: root,
    sessionID: () => "ses_host" as const,
    useSqliteStore: true,
    attachments: createAttachmentService(root),
  });
  await controller.init();
  try {
    const store = controller.sqlite()!;
    store.create("ses_wait_sqlite", "Waiting");
    store.updateMetadata("ses_wait_sqlite", {
      pendingHumanTerminal: {
        terminalID: "tty_wait_sqlite",
        reason: "needs the sudo password",
        since: "2026-08-12T00:00:00.000Z",
      },
    });

    const summary = (await controller.list()).find(
      (entry) => entry.id === "ses_wait_sqlite",
    );
    expect(summary?.pendingHumanTerminal).toMatchObject({
      terminalID: "tty_wait_sqlite",
      reason: "needs the sudo password",
    });

    store.updateMetadata("ses_wait_sqlite", {
      pendingHumanTerminal: undefined,
    });
    const after = await controller.list();
    expect(
      after.find((entry) => entry.id === "ses_wait_sqlite")
        ?.pendingHumanTerminal,
    ).toBeUndefined();
  } finally {
    await controller.close();
  }
});
