import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  SESSION_STORE_PLUGIN_ID,
} from "@natalia/session-store-plugin";
import {
  createTurnOrchestrationPlugin,
  TURN_CONTROLLER_SERVICE,
  TURN_ORCHESTRATION_PLUGIN_ID,
  type TurnController,
  type TurnControllerInput,
} from "../src";

function controllerInput(): TurnControllerInput {
  return {
    session: () => undefined,
    activeAbort: () => undefined,
    sessionFor: () => undefined,
    activeAbortFor: () => undefined,
    persist: async (fn) => await fn(),
    saveInbox: async () => undefined,
    flush: async () => undefined,
    runCommand: async () => false,
    runTurn: async () => undefined,
  };
}

test("turn controller service is dependency-bound and disposed on unload", async () => {
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
    contribute: () => (kind, name, value) => {
      if (kind === "services") services.set(name, value);
      return () => services.delete(name);
    },
    service: <T>(name: string) => services.get(name) as T | undefined,
  });
  const plugin = createTurnOrchestrationPlugin(controllerInput());

  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    id: TURN_ORCHESTRATION_PLUGIN_ID,
    scope: "workspace",
    provides: [TURN_CONTROLLER_SERVICE],
    requires: [SESSION_STORE_CONTROLLER_SERVICE],
    dependencies: [
      {
        id: SESSION_STORE_PLUGIN_ID,
        spec: ">=1.0.0",
        optional: false,
        peer: false,
      },
    ],
  });
  expect(services.has(TURN_CONTROLLER_SERVICE)).toBe(false);
  await expect(registry.loadBuiltin(plugin)).rejects.toThrow(
    "plugin dependency unresolved",
  );

  await registry.loadBuiltin({
    manifest: {
      apiVersion: 2,
      id: SESSION_STORE_PLUGIN_ID,
      version: "1.0.0",
      name: "Session Store",
      description: "Test session store dependency.",
      entry: "natalia:test-session-store",
      scope: "workspace",
      provides: [SESSION_STORE_CONTROLLER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(SESSION_STORE_CONTROLLER_SERVICE, {});
    },
  });
  await registry.loadBuiltin(plugin);
  const controller = services.get(TURN_CONTROLLER_SERVICE) as TurnController;
  expect(controller).toBeDefined();

  await registry.unload(TURN_ORCHESTRATION_PLUGIN_ID);
  expect(services.has(TURN_CONTROLLER_SERVICE)).toBe(false);
  await expect(controller.admit("ses_test", "msg_1", "hello")).rejects.toThrow(
    "turn orchestration controller disposed",
  );
});
