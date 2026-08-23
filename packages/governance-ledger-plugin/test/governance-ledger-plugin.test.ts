import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  type GovernanceLedgerController,
} from "@natalia/runtime-services";
import { WORK_LEDGER_PLUGIN_ID } from "@natalia/work-ledger-plugin";
import {
  createGovernanceLedgerPlugin,
  GOVERNANCE_LEDGER_PLUGIN_ID,
} from "../src";

test("governance ledger service is dependency-bound and removed on unload", async () => {
  const services = new Map<string, unknown>();
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
  const plugin = createGovernanceLedgerPlugin();

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: GOVERNANCE_LEDGER_PLUGIN_ID,
    provides: [GOVERNANCE_LEDGER_CONTROLLER_SERVICE],
    requires: [WORK_LEDGER_CONTROLLER_SERVICE],
    dependencies: [
      {
        id: WORK_LEDGER_PLUGIN_ID,
        spec: ">=1.0.0",
        optional: false,
        peer: false,
      },
    ],
  });
  expect(services.has(GOVERNANCE_LEDGER_CONTROLLER_SERVICE)).toBe(false);
  await expect(registry.loadBuiltin(plugin)).rejects.toThrow(
    "plugin dependency unresolved",
  );

  await registry.loadBuiltin({
    manifest: {
      apiVersion: 2,
      id: WORK_LEDGER_PLUGIN_ID,
      version: "1.0.0",
      name: "Work Ledger",
      description: "Test work ledger dependency.",
      entry: "natalia:test-work-ledger",
      scope: "workspace",
      provides: [WORK_LEDGER_CONTROLLER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(WORK_LEDGER_CONTROLLER_SERVICE, {});
    },
  });
  await registry.loadBuiltin(plugin);
  const controller = services.get(
    GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  ) as GovernanceLedgerController;
  expect(
    controller.recordDecision({ id: "decision:1", decision: "ship" }),
  ).toMatchObject({ type: "decision.recorded", status: "accepted" });

  await registry.unload(GOVERNANCE_LEDGER_PLUGIN_ID);
  expect(services.has(GOVERNANCE_LEDGER_CONTROLLER_SERVICE)).toBe(false);
});
