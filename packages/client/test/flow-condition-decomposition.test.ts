import { expect, test } from "bun:test";
import { configV2Schema } from "@natalia/contracts";
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
  const config = configV2Schema.parse({
    version: 2,
    providers: {
      ready: { type: "openai-compatible", apiKey: "configured" },
      missing_key: { type: "anthropic" },
    },
    models: {
      usable: { provider: "ready", model: "usable-model" },
      unavailable: { provider: "missing_key", model: "unavailable-model" },
    },
  });
  expect(flowConditionModels(config)).toEqual([
    {
      modelID: "usable",
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
      modelID: "evaluator",
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
      modelID: "evaluator",
      objective: "Read",
      provider: provider([{ type: "tool_call", calls: [] }]),
    }),
  ).rejects.toThrow("forbidden tool call");
});
