import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAttachmentService } from "@natalia/attachment-plugin";
import type { SessionID } from "@natalia/contracts";
import { createPluginRegistry } from "@natalia/plugin";
import {
  ATTACHMENT_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import {
  JsonSessionStore,
  SqliteSessionStore,
  createSessionRecord,
} from "@natalia/session";
import {
  createLocalSessionService,
  createSessionStoreControllerPlugin,
  SESSION_STORE_PLUGIN_ID,
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

test("session store service is dependency-bound and closes on unload", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-session-store-plugin-"));
  const services = new Map<string, unknown>();
  services.set(ATTACHMENT_SERVICE, createAttachmentService(root));
  const registry = createPluginRegistry({
    tools: {
      set() {},
      get() {
        return undefined;
      },
      delete() {},
    } as never,
    allowed: ["services"],
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createSessionStoreControllerPlugin({
    workspaceRoot: root,
    sessionID: () => "ses_host" as SessionID,
    useSqliteStore: true,
  });

  expect(plugin.manifest).toMatchObject({
    id: SESSION_STORE_PLUGIN_ID,
    provides: [SESSION_STORE_CONTROLLER_SERVICE],
    requires: [ATTACHMENT_SERVICE],
  });
  expect(plugin.manifest.apiVersion).toBe(2);
  if (plugin.manifest.apiVersion !== 2)
    throw new Error("session store plugin must use manifest API v2");
  expect(plugin.manifest.dependencies).toEqual([
    {
      id: "natalia-attachment",
      spec: ">=1.0.0",
      optional: false,
      peer: false,
    },
  ]);
  expect(services.has(SESSION_STORE_CONTROLLER_SERVICE)).toBe(false);

  await expect(registry.loadBuiltin(plugin)).rejects.toThrow(
    "plugin dependency unresolved",
  );
  await registry.loadBuiltin({
    manifest: {
      apiVersion: 2,
      id: "natalia-attachment",
      version: "1.0.0",
      name: "Attachment",
      description: "Test attachment dependency.",
      entry: "natalia:test-attachment",
      scope: "workspace",
      provides: [ATTACHMENT_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(
        ATTACHMENT_SERVICE,
        services.get(ATTACHMENT_SERVICE),
      );
    },
  });
  await registry.loadBuiltin(plugin);
  const controller = services.get(
    SESSION_STORE_CONTROLLER_SERVICE,
  ) as SessionStoreController;
  expect(controller).toBeDefined();
  await controller.init();
  expect(controller.status()).toEqual({ initialized: true, mode: "sqlite" });

  await registry.unload(SESSION_STORE_PLUGIN_ID);
  expect(services.has(SESSION_STORE_CONTROLLER_SERVICE)).toBe(false);
  expect(controller.status()).toEqual({ initialized: false, mode: "sqlite" });
});
