import { expect, test } from "bun:test";
import {
  TokenMeter,
  estimateMeterMessage,
  estimateTokenText,
  requestHeaderKey,
} from "../src/token-meter";

test("token meter estimates messages with a stable fixed heuristic", () => {
  const meter = new TokenMeter();
  expect(estimateMeterMessage({ role: "user", content: "hello world" })).toBe(
    4 + 3,
  );
  expect(
    meter.estimateRequest({
      system: "system",
      tools: [{ name: "shell" }],
      messages: [{ role: "user", content: "hello" }],
    }),
  ).toBeGreaterThan(0);
});

test("provider usage is reused only when the canonical header still matches", () => {
  const meter = new TokenMeter();
  const messages = [{ role: "user" as const, content: "hello" }];
  meter.observeSurface("main", messages);
  meter.recordUsage(
    "main",
    { inputTokens: 10_000, outputTokens: 200 },
    {
      headerKey: JSON.stringify({ system: "sys", tools: [] }),
      surfaceTokens: meter.estimateMessages(messages),
    },
  );

  const matching = meter.measureRequest("main", {
    system: "sys",
    tools: [],
    messages,
    contextWindow: 100_000,
  });
  expect(matching.source).toBe("provider_usage");
  expect(matching.totalTokens).toBe(10_200);

  const changedHeader = meter.measureRequest("main", {
    system: "different system",
    tools: [],
    messages,
    contextWindow: 100_000,
  });
  expect(changedHeader.source).toBe("estimate");
  expect(changedHeader.totalTokens).toBeLessThan(10_200);
  expect(changedHeader.totalTokens).toBeGreaterThan(0);
});

test("projected tokens carry the provider sample across surface growth", () => {
  const meter = new TokenMeter();
  const base = [{ role: "user" as const, content: "a".repeat(400) }];
  meter.observeSurface("navi", base);
  meter.recordUsage(
    "navi",
    { inputTokens: 500, outputTokens: 50 },
    { headerKey: "header", surfaceTokens: meter.estimateMessages(base) },
  );

  meter.observeSurface("navi", [
    ...base,
    { role: "assistant" as const, content: "b".repeat(4_000) },
  ]);
  const projected = meter.project("navi");
  expect(projected.pressureTokens).toBe(500);
  expect(projected.projectedTokens).toBeGreaterThan(1_000);
  expect(projected.contextWindow).toBeUndefined();
  meter.setContextWindow("navi", 8_000);
  expect(meter.project("navi").contextWindow).toBe(8_000);
});

test("a smaller provider sample never hides a larger current request", () => {
  const meter = new TokenMeter();
  const messages = [{ role: "user" as const, content: "x".repeat(4_000) }];
  meter.observeSurface("main", messages);
  meter.recordUsage(
    "main",
    { inputTokens: 10, outputTokens: 1 },
    { headerKey: "same", surfaceTokens: meter.estimateMessages(messages) },
  );
  const measured = meter.measureRequest("main", {
    system: "",
    tools: [],
    messages,
  });
  expect(measured.source).toBe("estimate");
  expect(measured.totalTokens).toBeGreaterThanOrEqual(measured.messageTokens);
});

test("three-bucket measurement keeps system, tools and messages additive", () => {
  const meter = new TokenMeter();
  const messages = [
    { role: "user" as const, content: "a".repeat(400) },
    { role: "assistant" as const, content: "b".repeat(400) },
  ];
  const withTools = meter.measureRequest("main", {
    system: "s".repeat(200),
    tools: [{ name: "shell", parameters: { type: "object" } }],
    messages,
  });
  expect(withTools.systemTokens).toBe(estimateTokenText("s".repeat(200)));
  expect(withTools.toolsTokens).toBeGreaterThan(0);
  expect(withTools.messageTokens).toBeGreaterThan(0);
  expect(withTools.headerTokens).toBe(
    withTools.systemTokens + withTools.toolsTokens,
  );
  expect(withTools.totalTokens).toBe(
    withTools.headerTokens + withTools.messageTokens,
  );
  // The system prompt is never also counted inside the message surface.
  expect(withTools.messageTokens).toBe(meter.estimateMessages(messages));
});

test("recordUsage and measureRequest share one header key per envelope", () => {
  const meter = new TokenMeter();
  const messages = [{ role: "user" as const, content: "hello" }];
  const tools = [{ name: "shell", parameters: { type: "object" } }];
  meter.recordUsage(
    "main",
    { inputTokens: 10_000, outputTokens: 200 },
    {
      headerKey: requestHeaderKey({ system: "sys", tools }),
      surfaceTokens: meter.estimateMessages(messages),
    },
  );
  // Same system + tools header reuses the provider anchor.
  const reused = meter.measureRequest("main", {
    system: "sys",
    tools,
    messages,
    contextWindow: 100_000,
  });
  expect(reused.source).toBe("provider_usage");
  expect(reused.totalTokens).toBe(10_200);
  expect(reused.toolsTokens).toBeGreaterThan(0);
  // A different tool set invalidates the anchor even with the same system.
  const changedTools = meter.measureRequest("main", {
    system: "sys",
    tools: [{ name: "other", parameters: { type: "object" } }],
    messages,
    contextWindow: 100_000,
  });
  expect(changedTools.source).toBe("estimate");
});
