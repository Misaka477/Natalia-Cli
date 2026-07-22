import { expect, test } from "bun:test";
import { FakeCompactor } from "@natalia/testing";
import {
  compactContext,
  compactionTrigger,
  ContextLedger,
  largeToolResultContext,
  preserveRecentWithToolPairs,
  providerError,
  recoverContextLimitOnce,
  resolveReservedOutputTokens,
  type Compactor,
  type ContextEntry,
} from "../src";

test("context accounting combines provider exact checkpoint with pending estimate", () => {
  const ledger = new ContextLedger();
  ledger.add({
    id: "sys",
    role: "system",
    content: "system prompt",
    tokens: 10,
  });
  ledger.add({
    id: "tool",
    role: "tool_result",
    content: "tool output",
    tokens: 20,
  });
  ledger.recordProviderUsage(100, 25);
  ledger.add({
    id: "dyn",
    role: "dynamic",
    content: "dynamic injection",
    tokens: 7,
  });
  ledger.addResource({
    kind: "agent",
    id: "agent-1",
    summary: "running subagent",
  });

  const status = ledger.status({
    max: 200,
    thresholdPercent: 85,
    reserved: 50,
  });
  expect(status.used).toBeGreaterThanOrEqual(132);
  expect(status.source).toBe("pending_estimate");
  expect(status.trigger).toBeUndefined();
  expect(ledger.snapshot().entries.map((entry) => entry.role)).toContain(
    "resource",
  );
});

test("reserved output resolver prioritizes provider, explicit, catalog and fallback formula", () => {
  expect(
    resolveReservedOutputTokens({
      contextWindow: 32000,
      configuredReserved: 1234,
    }).source,
  ).toBe("config");
  expect(
    resolveReservedOutputTokens({
      contextWindow: 32000,
      configuredReserved: "auto",
      providerOutputLimit: 4096,
    }).tokens,
  ).toBe(4096);
  expect(
    resolveReservedOutputTokens({
      contextWindow: 32000,
      configuredReserved: "auto",
      explicitMaxOutputTokens: 2048,
    }).source,
  ).toBe("explicit_output");
  expect(
    resolveReservedOutputTokens({
      contextWindow: 32000,
      configuredReserved: "auto",
      catalogOutputLimit: 8192,
    }).source,
  ).toBe("catalog");
  expect(
    resolveReservedOutputTokens({
      contextWindow: 32000,
      configuredReserved: "auto",
    }).tokens,
  ).toBe(8192);
  expect(
    resolveReservedOutputTokens({
      contextWindow: 200000,
      configuredReserved: "auto",
    }).tokens,
  ).toBe(50000);
});

test("compaction trigger uses ratio or reserved budget and respects disabled config", async () => {
  expect(
    compactionTrigger({
      used: 86,
      max: 100,
      thresholdPercent: 85,
      reserved: 1,
    }),
  ).toBe("ratio");
  expect(
    compactionTrigger({
      used: 70,
      max: 100,
      thresholdPercent: 85,
      reserved: 31,
    }),
  ).toBe("reserved");

  const ledger = ledgerWithMessages(10);
  const before = ledger.snapshot();
  const result = await compactContext(ledger, new FakeCompactor(), {
    id: "cmp_disabled",
    trigger: "ratio",
    enabled: false,
    maxTokens: 100,
    thresholdPercent: 85,
    reservedTokens: 10,
    preservedRecentMessages: 2,
  });
  expect(result).toEqual({ compacted: false, skipped: "disabled" });
  expect(ledger.snapshot()).toEqual(before);
});

test("manual compaction works while disabled and preserves tool-call/result pairing", async () => {
  const ledger = new ContextLedger();
  ledger.add({ id: "u1", role: "user", content: "old", tokens: 10 });
  ledger.add({
    id: "call",
    role: "tool_call",
    content: "call",
    pairID: "p1",
    tokens: 10,
  });
  ledger.add({
    id: "result",
    role: "tool_result",
    content: "result",
    pairID: "p1",
    tokens: 10,
  });
  ledger.add({ id: "a1", role: "assistant", content: "recent", tokens: 10 });
  const events: string[] = [];

  const result = await compactContext(
    ledger,
    new FakeCompactor([{ summary: "manual summary", tokens: 20 }]),
    {
      id: "cmp_manual",
      trigger: "manual",
      enabled: false,
      maxTokens: 1000,
      thresholdPercent: 85,
      reservedTokens: 100,
      preservedRecentMessages: 2,
      instruction: "keep tool evidence",
      onEvent: (event) => events.push(event.type),
    },
  );

  expect(result.compacted).toBe(true);
  expect(events).toContain("compaction.begin");
  expect(events).toContain("compaction.end");
  expect(ledger.snapshot().entries.map((entry) => entry.id)).toEqual([
    "cmp_manual:summary",
    "call",
    "result",
    "a1",
  ]);
});

test("compaction retains attachment metadata only for preserved user entries", async () => {
  const ledger = new ContextLedger();
  ledger.add({
    id: "old-user",
    role: "user",
    content: "old image",
    attachments: [
      {
        id: "att_old",
        path: ".natalia/attachments/att_old-image.png",
        filename: "old.png",
        mediaType: "image/png",
        byteLength: 8,
        sha256: "old",
      },
    ],
  });
  ledger.add({
    id: "recent-user",
    role: "user",
    content: "recent image",
    attachments: [
      {
        id: "att_recent",
        path: ".natalia/attachments/att_recent-image.png",
        filename: "recent.png",
        mediaType: "image/png",
        byteLength: 8,
        sha256: "recent",
      },
    ],
  });
  await compactContext(
    ledger,
    new FakeCompactor([{ summary: "summary", tokens: 10 }]),
    {
      id: "cmp_attachment",
      trigger: "manual",
      maxTokens: 1000,
      thresholdPercent: 85,
      reservedTokens: 100,
      preservedRecentMessages: 1,
    },
  );
  expect(
    ledger
      .snapshot()
      .entries.flatMap((entry) => entry.attachments ?? [])
      .map((attachment) => attachment.id),
  ).toEqual(["att_recent"]);
});

test("compaction failure is atomic and retry events use M9 policy", async () => {
  const ledger = ledgerWithMessages(5);
  const before = ledger.snapshot();
  const events: string[] = [];
  const compactor: Compactor = {
    async compact() {
      throw providerError({ kind: "timeout", message: "compaction timeout" });
    },
  };
  await expect(
    compactContext(ledger, compactor, {
      id: "cmp_fail",
      trigger: "ratio",
      maxTokens: 100,
      thresholdPercent: 85,
      reservedTokens: 10,
      preservedRecentMessages: 2,
      retry: { timer: async () => undefined, random: () => 0 },
      onEvent: (event) => events.push(event.type),
    }),
  ).rejects.toMatchObject({ kind: "timeout" });
  expect(ledger.snapshot()).toEqual(before);
  expect(events.filter((type) => type === "step.retry")).toHaveLength(2);
  expect(events).toContain("compaction.end");
});

test("context-limit recovery compacts once then retries original step without loop", async () => {
  const ledger = ledgerWithMessages(8);
  let calls = 0;
  const events: string[] = [];
  const value = await recoverContextLimitOnce({
    id: "turn_ctx",
    step: 2,
    ledger,
    compactor: new FakeCompactor([{ summary: "recovered", tokens: 50 }]),
    compact: {
      id: "cmp_ctx",
      maxTokens: 1000,
      thresholdPercent: 85,
      reservedTokens: 100,
      preservedRecentMessages: 2,
      retry: { timer: async () => undefined, random: () => 0 },
    },
    onEvent: (event) => events.push(event.type),
    async runStep() {
      calls += 1;
      if (calls === 1)
        throw providerError({ kind: "context_limit", message: "too long" });
      return "ok";
    },
  });
  expect(value).toBe("ok");
  expect(calls).toBe(2);
  expect(events).toContain("context.limit.recovery");
  expect(events).toContain("compaction.begin");
  expect(events).toContain("compaction.end");
});

test("resource reinjection, session restore and event replay remain deterministic", async () => {
  const ledger = ledgerWithMessages(4);
  ledger.addResource({
    kind: "workflow",
    id: "wf-1",
    summary: "pending workflow",
  });
  const restored = new ContextLedger();
  restored.restore(ledger.snapshot());
  await compactContext(
    restored,
    new FakeCompactor([{ summary: "with resources", tokens: 40 }]),
    {
      id: "cmp_restore",
      trigger: "manual",
      maxTokens: 1000,
      thresholdPercent: 85,
      reservedTokens: 100,
      preservedRecentMessages: 1,
    },
  );
  expect(
    restored
      .snapshot()
      .entries.some((entry) => entry.content.includes("workflow:wf-1")),
  ).toBe(true);
});

test("large tool result context representation separates artifact from UI text", () => {
  const entry = largeToolResultContext({
    id: "tool_big",
    role: "tool_result",
    content: "x".repeat(5000),
    artifactRef: "artifact://tool_big",
  });
  expect(entry.content.length).toBeLessThan(2500);
  expect(entry.content).toContain("artifact://tool_big");
  expect(entry.content).toContain("totalChars=5000");
});

function ledgerWithMessages(count: number) {
  const ledger = new ContextLedger();
  for (let index = 0; index < count; index++) {
    ledger.add({
      id: `m${index}`,
      role: index % 2 ? "assistant" : "user",
      content: `message ${index}`,
      tokens: 10,
    });
  }
  return ledger;
}

test("preserveRecentWithToolPairs restores missing paired call", () => {
  const entries: ContextEntry[] = [
    { id: "call", role: "tool_call", content: "call", pairID: "p" },
    { id: "middle", role: "assistant", content: "middle" },
    { id: "result", role: "tool_result", content: "result", pairID: "p" },
  ];
  expect(
    preserveRecentWithToolPairs(entries, 1).map((entry) => entry.id),
  ).toEqual(["call", "result"]);
});
