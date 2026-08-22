import { expect, test } from "bun:test";
import {
  ATTACHMENT_PLUGIN_ID,
  ATTACHMENT_SERVICE,
} from "@natalia/attachment-plugin";
import {
  COMPACTION_PLUGIN_ID,
  COMPACTION_SERVICE,
} from "@natalia/compaction-plugin";
import { createPluginRegistry, type Plugin } from "@natalia/plugin";
import { RETRY_PLUGIN_ID, RETRY_SERVICE } from "@natalia/retry-plugin";
import {
  createProviderModelPlugin,
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  PROVIDER_MODEL_PLUGIN_ID,
  type ProviderModelController,
  type ProviderModelControllerInput,
} from "../src";

function servicePlugin(id: string, service: string): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id,
      version: "1.0.0",
      name: id,
      description: `Test dependency for ${service}.`,
      entry: `natalia:test:${id}`,
      scope: "workspace",
      provides: [service],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(service, {});
    },
  };
}

function controllerInput(
  onInitialize: () => void,
): ProviderModelControllerInput {
  return {
    initialize: onInitialize,
    runnerInput: () => {
      throw new Error("runner input should remain lazy");
    },
    chat: {
      available: () => false,
      publish() {},
      runBody: async () => undefined,
      wake: async () => undefined,
    },
  };
}

test("provider model service is dependency-bound and disposed on unload", async () => {
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
  let initialized = 0;
  const plugin = createProviderModelPlugin(
    controllerInput(() => {
      initialized += 1;
    }),
  );

  expect(plugin.manifest).toMatchObject({
    id: PROVIDER_MODEL_PLUGIN_ID,
    provides: [PROVIDER_MODEL_CONTROLLER_SERVICE],
    requires: [RETRY_SERVICE, ATTACHMENT_SERVICE, COMPACTION_SERVICE],
  });
  expect(services.has(PROVIDER_MODEL_CONTROLLER_SERVICE)).toBe(false);
  await expect(registry.loadBuiltin(plugin)).rejects.toThrow(
    "plugin dependency unresolved",
  );
  expect(initialized).toBe(0);

  await registry.loadBuiltin(servicePlugin(RETRY_PLUGIN_ID, RETRY_SERVICE));
  await registry.loadBuiltin(
    servicePlugin(ATTACHMENT_PLUGIN_ID, ATTACHMENT_SERVICE),
  );
  await registry.loadBuiltin(
    servicePlugin(COMPACTION_PLUGIN_ID, COMPACTION_SERVICE),
  );
  await registry.loadBuiltin(plugin);
  const controller = services.get(
    PROVIDER_MODEL_CONTROLLER_SERVICE,
  ) as ProviderModelController;
  expect(controller).toBeDefined();
  expect(initialized).toBe(1);

  await registry.unload(PROVIDER_MODEL_PLUGIN_ID);
  expect(services.has(PROVIDER_MODEL_CONTROLLER_SERVICE)).toBe(false);
  await expect(
    controller.runChatTurn({
      sessionID: "ses_test" as never,
      text: "hello",
      responseMessageID: "msg_1",
    }),
  ).rejects.toThrow("provider/model controller disposed");
});
