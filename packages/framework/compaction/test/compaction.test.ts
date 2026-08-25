import { expect, test } from "bun:test";
import { createContextLedgerFactory } from "@natalia/context-ledger";
import { createRetryService } from "@natalia/retry";
import type { CompactionService } from "@natalia/runtime-services";
import { createCompactionService } from "../src";

test("compaction service is constructed from retry and context-ledger dependencies", () => {
  const retry = createRetryService({ policy: () => undefined });
  const contextLedgerFactory = createContextLedgerFactory();
  const service = createCompactionService({ retry });
  expect(service).toBeDefined();
  expect(contextLedgerFactory.create()).toBeDefined();
});

test("compaction skips provider work below the configured threshold", async () => {
  const retry = createRetryService({ policy: () => undefined });
  const service: CompactionService = createCompactionService({ retry });
  let providerCalls = 0;
  const outcome = await service.compactBeforeProviderStep({
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
