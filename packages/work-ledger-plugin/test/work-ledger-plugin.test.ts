import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import { createWorkLedgerPlugin, WORK_LEDGER_PLUGIN_ID } from "../src";

test("work ledger service exists only while the plugin is loaded", async () => {
  const services = new Map<string, unknown>();
  const registry = createPluginRegistry({
    tools: {
      set() {},
      get() {
        return undefined;
      },
      delete() {},
    } as never,
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createWorkLedgerPlugin({
    openFindingIDs: () => new Set(),
  });

  expect(plugin.manifest).toMatchObject({
    id: WORK_LEDGER_PLUGIN_ID,
    provides: [WORK_LEDGER_CONTROLLER_SERVICE],
    requires: [],
  });
  expect(services.has(WORK_LEDGER_CONTROLLER_SERVICE)).toBe(false);

  await registry.load(plugin);
  const controller = services.get(
    WORK_LEDGER_CONTROLLER_SERVICE,
  ) as WorkLedgerController;
  expect(controller).toBeDefined();
  expect(
    controller.agentActionNode({
      turnID: "turn_1",
      sessionID: "ses_1" as never,
    }),
  ).toMatchObject({ kind: "agent_action", turnID: "turn_1" });

  await registry.unload(WORK_LEDGER_PLUGIN_ID);
  expect(services.has(WORK_LEDGER_CONTROLLER_SERVICE)).toBe(false);
});
