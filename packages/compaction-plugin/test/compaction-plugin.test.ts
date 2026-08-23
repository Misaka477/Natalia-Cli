import { expect, test } from "bun:test";
import {
  createContextLedgerFactory,
  createContextLedgerPlugin,
} from "@natalia/context-ledger-plugin";
import { createPluginRegistry } from "@natalia/plugin";
import { createRetryPlugin } from "@natalia/retry-plugin";
import {
  COMPACTION_SERVICE,
  CONTEXT_LEDGER_FACTORY_SERVICE,
  type CompactionService,
} from "@natalia/runtime-services";
import { COMPACTION_PLUGIN_ID, createCompactionPlugin } from "../src";

test("compaction plugin requires retry and context-ledger plugins", () => {
  const manifest = createCompactionPlugin().manifest;
  if (manifest.apiVersion !== 2) throw new Error("expected plugin manifest v2");
  const dependencies = manifest.dependencies;
  expect(dependencies.map((dependency) => dependency.id).sort()).toEqual([
    "natalia-context-ledger",
    "natalia-retry",
  ]);
  expect(manifest.requires).toEqual([
    "retry.service",
    CONTEXT_LEDGER_FACTORY_SERVICE,
  ]);
});

test("compaction service is owned and removed with its plugin", async () => {
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

  await registry.load(createRetryPlugin({ policy: () => undefined }));
  await registry.load(createContextLedgerPlugin());
  await registry.load(createCompactionPlugin());
  expect(services.get(COMPACTION_SERVICE)).toBeDefined();
  await registry.unload(COMPACTION_PLUGIN_ID);
  expect(services.has(COMPACTION_SERVICE)).toBe(false);
});

test("compaction skips provider work below the configured threshold", async () => {
  let service: CompactionService | undefined;
  await createCompactionPlugin().setup({
    services: {
      get(name: string) {
        if (name === "retry.service") return { policy: () => undefined };
        if (name === CONTEXT_LEDGER_FACTORY_SERVICE) return {};
        return undefined;
      },
      provide(_name: string, value: unknown) {
        service = value as CompactionService;
        return () => undefined;
      },
    },
  } as never);
  let providerCalls = 0;
  const outcome = await service!.compactBeforeProviderStep({
    compactionID: "compact-1",
    ledger: createContextLedgerFactory().create(),
    provider: {
      provider: "fixture",
      model: "fixture",
      async *stream() {
        providerCalls += 1;
      },
    },
    budget: { max: 1000, thresholdPercent: 80, reserved: 100 },
    preservedRecentMessages: 4,
    instruction: "",
    usedTokens: 10,
    enabled: true,
  });
  expect(outcome).toEqual({ compacted: false, skipped: "nothing_to_compact" });
  expect(providerCalls).toBe(0);
});
