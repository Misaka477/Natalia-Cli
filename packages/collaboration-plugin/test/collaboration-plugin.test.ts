import { expect, test } from "bun:test";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import { createPluginRegistry } from "@natalia/plugin";
import {
  COLLABORATION_WAITER_SERVICE,
  type InteractiveWaiter,
} from "@natalia/runtime-services";
import { createWorkLedgerController } from "@natalia/work-ledger-plugin";
import { ToolRegistry } from "@natalia/tools";
import { createCollaborationPlugin, COLLABORATION_PLUGIN_ID } from "../src";

test("collaboration service and tools exist only while the plugin is loaded", async () => {
  const services = new Map<string, unknown>();
  const contributions = new Map<string, unknown>();
  const events: RuntimeEvent[] = [];
  const tools = new ToolRegistry();
  const registry = createPluginRegistry({
    tools,
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        contributions.set(`${kind}:${name}`, value);
        return () => {
          services.delete(name);
          contributions.delete(`${kind}:${name}`);
        };
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
    tools: {
      events: () => events,
      publish: (_sessionID, event) => events.push(event),
      redact: (text) => text,
      nextMailboxSequence: () => 1,
      nextCollabSequence: () => 1,
      requestWake: () => undefined,
      maxAutoRounds: () => 3,
    },
  });

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: COLLABORATION_PLUGIN_ID,
    provides: [COLLABORATION_WAITER_SERVICE],
    requires: [],
    dependencies: [],
    integrationPoints: ["services", "tools"],
  });
  expect(services.has(COLLABORATION_WAITER_SERVICE)).toBe(false);
  expect(tools.size).toBe(0);

  await registry.load(plugin);
  const waiter = services.get(
    COLLABORATION_WAITER_SERVICE,
  ) as InteractiveWaiter;
  expect(waiter.hasPendingWaiters()).toBe(false);
  const toolNames = [
    "mailbox_acknowledge",
    "collab_respond",
    "collab_inbox",
    "collab_chat",
    "collab_ask",
  ];
  expect([...tools.keys()].sort()).toEqual([...toolNames].sort());
  for (const name of toolNames)
    expect(contributions.has(`tools:${name}`)).toBe(true);

  await registry.unload(COLLABORATION_PLUGIN_ID);
  expect(services.has(COLLABORATION_WAITER_SERVICE)).toBe(false);
  expect(tools.size).toBe(0);
  for (const name of toolNames)
    expect(contributions.has(`tools:${name}`)).toBe(false);
});
