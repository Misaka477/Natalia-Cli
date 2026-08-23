import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import { RETRY_SERVICE, type RetryService } from "@natalia/runtime-services";
import { createRetryPlugin, RETRY_PLUGIN_ID } from "../src";

test("retry plugin owns its service and removes it on unload", async () => {
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

  await registry.loadBuiltin(createRetryPlugin({ policy: () => undefined }));
  expect(services.get(RETRY_SERVICE)).toBeDefined();
  await registry.unload(RETRY_PLUGIN_ID);
  expect(services.has(RETRY_SERVICE)).toBe(false);
});

test("retry service reads the current policy for every execution", async () => {
  let maxAttemptsPerStep = 1;
  let policyReads = 0;
  const plugin = createRetryPlugin({
    policy: () => {
      policyReads += 1;
      return { maxAttemptsPerStep };
    },
  });
  let service: RetryService | undefined;
  await plugin.setup({
    services: {
      provide(_name: string, value: unknown) {
        service = value as RetryService;
        return () => undefined;
      },
    },
  } as never);

  const context = {
    id: "turn-retry-policy",
    operation: "llm_step",
    step: 1,
  } as const;
  expect(
    await service!.run(context, async (attempt) => attempt.maxAttempts),
  ).toBe(1);
  maxAttemptsPerStep = 3;
  expect(
    await service!.run(context, async (attempt) => attempt.maxAttempts),
  ).toBe(3);
  expect(policyReads).toBe(2);
});
