import { expect, test } from "bun:test";
import { configV3Schema } from "@natalia/contracts";
import type { StreamingProvider } from "@natalia/runtime";
import {
  decomposeFlowConditions,
  flowConditionModels,
  parseFlowConditionDecomposition,
} from "../src";

function provider(
  chunks: Array<
    { type: "content"; text: string } | { type: "tool_call"; calls: [] }
  >,
): StreamingProvider {
  return {
    provider: "openai-compatible",
    model: "evaluator-model",
    async *stream() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

test("condition decomposition accepts only strict unique schema JSON", () => {
  expect(
    parseFlowConditionDecomposition(
      JSON.stringify({
        schemaVersion: 1,
        conditions: [
          { text: "Read every changed file" },
          { text: "  Record   each finding  " },
        ],
      }),
    ),
  ).toEqual({
    schemaVersion: 1,
    conditions: [
      { text: "Read every changed file" },
      { text: "Record each finding" },
    ],
  });
  expect(() => parseFlowConditionDecomposition("```json\n{}\n```")).toThrow(
    "valid schema JSON",
  );
  expect(() =>
    parseFlowConditionDecomposition(
      JSON.stringify({
        schemaVersion: 1,
        conditions: [{ text: "Read" }],
        explanation: "extra",
      }),
    ),
  ).toThrow("Unrecognized key");
  expect(() =>
    parseFlowConditionDecomposition(
      JSON.stringify({
        schemaVersion: 1,
        conditions: [{ text: "Read" }, { text: " Read " }],
      }),
    ),
  ).toThrow("duplicate conditions");
});

test("condition model choices contain only resolvable configured providers", () => {
  const config = configV3Schema.parse({
    version: 3,
    providers: {
      ready: {
        name: "Ready",
        driver: "openai-compatible",
        enabled: true,
        connection: { apiKey: "configured" },
      },
      missing_key: {
        name: "Missing key",
        driver: "anthropic",
        enabled: true,
        connection: {},
      },
    },
    catalog: {
      providers: {
        ready: { models: { "usable-model": { name: "usable-model" } } },
        missing_key: {
          models: { "unavailable-model": { name: "unavailable-model" } },
        },
      },
    },
  });
  expect(flowConditionModels(config)).toEqual([
    {
      modelID: "ready/usable-model",
      providerID: "ready",
      model: "usable-model",
    },
  ]);
});

test("condition decomposition sends only the objective and forbids tools", async () => {
  const requests: unknown[] = [];
  const model = provider([
    {
      type: "content",
      text: JSON.stringify({
        schemaVersion: 1,
        conditions: [{ text: "Read the source" }, { text: "Record evidence" }],
      }),
    },
  ]);
  model.stream = async function* (request) {
    requests.push(request);
    yield {
      type: "content",
      text: JSON.stringify({
        schemaVersion: 1,
        conditions: [{ text: "Read the source" }, { text: "Record evidence" }],
      }),
    };
  };
  await expect(
    decomposeFlowConditions({
      modelID: "openai-compatible/evaluator-model",
      objective: "Read the source and record evidence",
      provider: model,
    }),
  ).resolves.toEqual({
    schemaVersion: 1,
    conditions: [{ text: "Read the source" }, { text: "Record evidence" }],
  });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    messages: [
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "Read the source and record evidence" },
    ],
  });
  await expect(
    decomposeFlowConditions({
      modelID: "openai-compatible/evaluator-model",
      objective: "Read",
      provider: provider([{ type: "tool_call", calls: [] }]),
    }),
  ).rejects.toThrow("forbidden tool call");
});
