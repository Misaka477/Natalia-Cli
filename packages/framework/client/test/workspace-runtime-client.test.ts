import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { JsonSessionStore, SqliteSessionStore, createSessionRecord } from "@natalia/session";
import {
  createWorkspaceManager,
  createWorkspaceRuntimeClient,
  type WorkspaceManager,
} from "../src/workspace-manager";
import {
  officialPluginWorkspace,
  officialPluginStoreRoot,
} from "./plugin-test-helpers";

function emptyManager(): WorkspaceManager {
  return {
    async list() {
      return [];
    },
    async add() {
      throw new Error("unused");
    },
    async remove() {
      return { removed: true };
    },
    async activate() {
      throw new Error("unused");
    },
    async load() {},
    async workspaceRoots() {
      return [];
    },
    async workspaceAdd() {
      throw new Error("unused");
    },
    async workspaceRemove() {
      return { removed: true };
    },
    async workspaceActivate() {
      throw new Error("unused");
    },
    get() {
      return undefined;
    },
    getActive() {
      return undefined;
    },
    async summaryFor() {
      throw new Error("unused");
    },
    async workspacePermissionGet() {
      throw new Error("unused");
    },
    async workspacePermissionSet() {
      throw new Error("unused");
    },
    async workspaceToolGet() {
      throw new Error("unused");
    },
    async workspaceSessionGet() {
      return undefined;
    },
    async workspaceSessionSet() {},
    async workspaceToolSet() {
      throw new Error("unused");
    },
    async dispose() {},
  };
}

test("workspace proxy throws when native terminal is used without an active workspace", async () => {
  const client = createWorkspaceRuntimeClient(emptyManager());
  await expect(
    client.nativeTerminalStart?.({ command: "bash" }),
  ).rejects.toThrow("no active workspace");
});

for (const useSqliteStore of [false, true]) {
  test(`workspace restores selected session and preserves selection on settings updates (${useSqliteStore ? "sqlite" : "json"})`, async () => {
    const root = await officialPluginWorkspace("workspace-restore");
    const previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
    process.env.NATALIA_WORKSPACES_FILE = join(root, "workspaces.json");
    const options = {
      pluginStoreRoot: officialPluginStoreRoot(root),
      globalConfigPath: join(root, "global-config.json"),
      useSqliteStore,
    };
    let manager = createWorkspaceManager(options);
    try {
      const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
      const old = createSessionRecord("ses_old", "Old pinned");
      old.metadata = { pinned: true, lastAccessedAt: "2026-01-01T00:00:00Z" };
      const recent = createSessionRecord("ses_recent", "Recent");
      recent.metadata = { lastAccessedAt: "2026-08-01T00:00:00Z" };
      recent.events.push(
        {
          type: "navi.chat.message.added",
          id: "navi_added",
          messageID: "navi_saved",
          role: "chat",
          text: "Navi restored",
          at: "2026-08-01T00:00:00Z",
        },
        {
          type: "nia.chat.message.added",
          id: "nia_added",
          messageID: "nia_saved",
          role: "chat",
          text: "Nia restored",
          at: "2026-08-01T00:00:00Z",
        },
      );
      await store.save(old);
      await store.save(recent);
      const settingsPath = join(root, ".natalia", "workspace-settings.json");
      await writeFile(
        settingsPath,
        JSON.stringify({ activeSessionID: old.id }),
      );
      let workspace = await manager.add({ path: root });
      const client = createWorkspaceRuntimeClient(manager);
      expect((await client.runtimeStatus?.())?.sessionID).toBe(old.id);
      await client.sessionAttach?.(recent.id);
      await Promise.all([
        manager.workspacePermissionSet(workspace.workspaceID, {
          permissionProfile: "default",
          approval: "ask",
        }),
        manager.workspaceToolSet(workspace.workspaceID, {
          enabledTools: [],
          disabledTools: ["bash"],
        }),
        manager.workspaceSessionSet(workspace.workspaceID, recent.id),
      ]);
      expect(
        JSON.parse(await readFile(settingsPath, "utf8")).activeSessionID,
      ).toBe(recent.id);
      const restored = manager.get(workspace.workspaceID)!.client;
      expect(
        (await restored.chatMessages?.("navi"))?.map((row) => row.text),
      ).toEqual(["Navi restored"]);
      expect(
        (await restored.chatMessages?.("nia"))?.map((row) => row.text),
      ).toEqual(["Nia restored"]);
      expect(
        JSON.parse(await readFile(settingsPath, "utf8")).toolSettings
          .disabledTools,
      ).toEqual(["bash"]);
      await expect(client.sessionAttach?.("ses_missing")).rejects.toThrow();
      expect(await manager.workspaceSessionGet(workspace.workspaceID)).toBe(
        recent.id,
      );
      await manager.dispose();
      manager = createWorkspaceManager(options);
      workspace = await manager.add({ path: root });
      expect(
        (await manager.get(workspace.workspaceID)?.client.runtimeStatus?.())
          ?.sessionID,
      ).toBe(recent.id);
    } finally {
      await manager.dispose();
      if (previousRegistry === undefined)
        delete process.env.NATALIA_WORKSPACES_FILE;
      else process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
    }
  });
}

test("workspace falls back to last access, ignores pins/archive/stale selection, then uses seed for an empty workspace", async () => {
  const root = await officialPluginWorkspace("workspace-recent");
  const previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
  process.env.NATALIA_WORKSPACES_FILE = join(root, "workspaces.json");
  const options = {
    pluginStoreRoot: officialPluginStoreRoot(root),
    globalConfigPath: join(root, "global-config.json"),
  };
  let manager = createWorkspaceManager(options);
  try {
    const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
    const seed =
      `ses_${createHash("sha256").update(root).digest("hex").slice(0, 12)}` as const;
    let workspace = await manager.add({ path: root });
    expect(
      (await manager.get(workspace.workspaceID)?.client.runtimeStatus?.())
        ?.sessionID,
    ).toBe(seed);
    await manager.dispose();
    await store.delete(seed as `ses_${string}`);
    const old = createSessionRecord("ses_old", "Pinned");
    old.metadata = { pinned: true, lastAccessedAt: "2026-01-01T00:00:00Z" };
    const recent = createSessionRecord("ses_recent", "Recent");
    recent.metadata = { lastAccessedAt: "2026-08-01T00:00:00Z" };
    const archived = createSessionRecord("ses_archived", "Archived");
    archived.metadata = {
      archived: true,
      lastAccessedAt: "2026-09-01T00:00:00Z",
    };
    await store.save(old);
    await store.save(recent);
    await store.save(archived);
    for (const settings of [{}, { activeSessionID: "ses_deleted" }]) {
      await writeFile(
        join(root, ".natalia", "workspace-settings.json"),
        JSON.stringify(settings),
      );
      manager = createWorkspaceManager(options);
      workspace = await manager.add({ path: root });
      expect(
        (await manager.get(workspace.workspaceID)?.client.runtimeStatus?.())
          ?.sessionID,
      ).toBe(recent.id);
      await manager.dispose();
    }
  } finally {
    await manager.dispose();
    if (previousRegistry === undefined)
      delete process.env.NATALIA_WORKSPACES_FILE;
    else process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
  }
});

test("SQLite restore uses last access instead of pins or deleted legacy JSON", async () => {
  const root = await officialPluginWorkspace("workspace-sqlite-recent");
  const previousRegistry = process.env.NATALIA_WORKSPACES_FILE;
  process.env.NATALIA_WORKSPACES_FILE = join(root, "workspaces.json");
  const manager = createWorkspaceManager({
    pluginStoreRoot: officialPluginStoreRoot(root),
    globalConfigPath: join(root, "global-config.json"),
    useSqliteStore: true,
  });
  try {
    const database = new SqliteSessionStore(join(root, ".natalia", "sessions.db"));
    database.create("ses_pinned", "Pinned");
    database.updateMetadata("ses_pinned", { pinned: true, lastAccessedAt: "2026-01-01T00:00:00Z" });
    database.create("ses_recent", "Recent");
    database.updateMetadata("ses_recent", { lastAccessedAt: "2026-08-01T00:00:00Z" });
    database.close();
    const legacy = createSessionRecord("ses_deleted", "Deleted JSON leftover");
    legacy.metadata = { lastAccessedAt: "2026-09-01T00:00:00Z" };
    await new JsonSessionStore(join(root, ".natalia", "sessions")).save(legacy);
    await writeFile(join(root, ".natalia", "workspace-settings.json"), JSON.stringify({ activeSessionID: legacy.id }));
    const workspace = await manager.add({ path: root });
    const client = manager.get(workspace.workspaceID)!.client;
    expect((await client.runtimeStatus?.())?.sessionID).toBe("ses_recent");
    expect((await client.sessionList?.())?.some((row) => row.id === legacy.id)).toBe(false);
  } finally {
    await manager.dispose();
    if (previousRegistry === undefined) delete process.env.NATALIA_WORKSPACES_FILE;
    else process.env.NATALIA_WORKSPACES_FILE = previousRegistry;
  }
});
