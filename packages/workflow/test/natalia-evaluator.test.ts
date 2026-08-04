import { expect, test } from "bun:test";
import { buildRedactedEvaluatorContext, parseEvaluatorResult } from "../src";

const result = JSON.stringify({
  schemaVersion: 1,
  outcome: "incomplete",
  conditions: [
    { id: "c1", status: "satisfied", reason: "read", evidenceRefs: ["tool:1"] },
    { id: "c2", status: "partial", reason: "needs report", evidenceRefs: [] },
  ],
  gaps: ["write report"],
  forbiddenRepeats: ["do not re-read"],
  recommendedActions: ["write report"],
  idealOutcome: "partial",
});

test("evaluator parser accepts only complete versioned condition JSON", () => {
  expect(parseEvaluatorResult(result, ["c1", "c2"])).toMatchObject({
    outcome: "incomplete",
  });
  expect(() => parseEvaluatorResult("not json", ["c1", "c2"])).toThrow(
    "valid schema JSON",
  );
  expect(() =>
    parseEvaluatorResult(
      result.replace(
        '"idealOutcome":"partial"',
        '"idealOutcome":"partial","note":"markdown"',
      ),
      ["c1", "c2"],
    ),
  ).toThrow("invalid evaluator result");
  expect(() => parseEvaluatorResult(result, ["c1"])).toThrow(
    "each declared condition",
  );
});

test("evaluator context redacts secrets and omits secure input", () => {
  const context = buildRedactedEvaluatorContext({
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: ["c1"],
    messages: ["token=super-secret", "ghp_abcdefghijklmnopqrstuvwxyz123456"],
    toolRecords: ["password: hunter2"],
    terminalOutput: ["api_key=abc"],
    executionRecords: ["safe"],
  });
  expect(JSON.stringify(context)).not.toContain("super-secret");
  expect(JSON.stringify(context)).not.toContain("hunter2");
  expect(context.redacted).toBe(true);
  expect(
    buildRedactedEvaluatorContext({
      flowID: "flow_1",
      moduleID: "read",
      conditionIDs: [],
      messages: ["raw secret"],
      toolRecords: [],
      terminalOutput: [],
      executionRecords: [],
      secureInput: true,
    }).messages,
  ).toEqual(["[secure input omitted]"]);
});
