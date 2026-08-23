import { expect, test } from "bun:test";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import { createPluginRegistry } from "@natalia/plugin";
import {
  COLLABORATION_WAITER_SERVICE,
  type InteractiveWaiter,
} from "@natalia/runtime-services";
import { createWorkLedgerController } from "@natalia/work-ledger-plugin";
import { createCollaborationPlugin, COLLABORATION_PLUGIN_ID } from "../src";

test("collaboration waiter exists only while the plugin is loaded", async () => {
  const services = new Map<string, unknown>();
  const events: RuntimeEvent[] = [];
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
  const plugin = createCollaborationPlugin({
    waiter: {
      publish: (event) => events.push(event),
      publishForSession: (_session, event) => events.push(event),
      sessionID: () => "ses_test" as SessionID,
      sessionIDForTurn: () => "ses_test" as SessionID,
      permissionMode: () => "ask",
      abortSignal: () => undefined,
      activeTurnID: () => undefined,
      isPending: () => false,
      workLedger: () =>
        createWorkLedgerController({ openFindingIDs: () => new Set() }),
    },
  });

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: COLLABORATION_PLUGIN_ID,
    provides: [COLLABORATION_WAITER_SERVICE],
    requires: [],
    dependencies: [],
  });
  expect(services.has(COLLABORATION_WAITER_SERVICE)).toBe(false);

  await registry.loadBuiltin(plugin);
  const waiter = services.get(
    COLLABORATION_WAITER_SERVICE,
  ) as InteractiveWaiter;
  expect(waiter.hasPendingWaiters()).toBe(false);

  await registry.unload(COLLABORATION_PLUGIN_ID);
  expect(services.has(COLLABORATION_WAITER_SERVICE)).toBe(false);
});
