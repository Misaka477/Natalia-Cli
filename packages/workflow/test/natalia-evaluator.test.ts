import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StreamingProvider } from "@natalia/runtime";
import {
  buildRedactedEvaluatorContext,
  evaluateAndRecordModule,
  NataliaTaskStateStore,
  parseEvaluatorResult,
} from "../src";

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

test("evaluator result records incomplete outcome from redacted context", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-run-"));
  const store = await claimedModuleStore(root);
  let requestText = "";
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream(request) {
      requestText = request.messages[1]!.content;
      yield { type: "content", text: result };
      yield { type: "done" };
    },
  };
  await expect(
    evaluateAndRecordModule({
      store,
      invocationID: "inv_1",
      attempt: 1,
      executionProvider: "judge",
      selection: { provider: "judge", model: "judge-1" },
      provider,
      context: evaluatorContext(),
    }),
  ).resolves.toMatchObject({ outcome: "incomplete" });
  expect(requestText).not.toContain("super-secret");
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_continued",
  });
  store.close();
});

test("evaluator blocks cross-provider calls without consent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-blocked-"));
  const store = await claimedModuleStore(root);
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream() {
      yield { type: "content", text: "not evaluator json" };
      yield { type: "done" };
    },
  };
  await expect(
    evaluateAndRecordModule({
      store,
      invocationID: "inv_1",
      attempt: 1,
      executionProvider: "executor",
      selection: { provider: "judge", model: "judge-1" },
      provider,
      context: evaluatorContext(),
    }),
  ).resolves.toMatchObject({
    outcome: "blocked",
    reason: expect.stringContaining("consent"),
  });
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_blocked",
  });
  store.close();
});

async function claimedModuleStore(root: string) {
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as import("@natalia/contracts").SessionID,
  });
  store.activateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: ["c1", "c2"],
  });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:1",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [
        { id: "c1", status: "satisfied" },
        { id: "c2", status: "partial" },
      ],
      evidenceRefs: ["tool:1"],
      gaps: [],
      recommendedAction: "Evaluate.",
    },
  });
  return store;
}

function evaluatorContext() {
  return {
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: ["c1", "c2"],
    messages: ["token=super-secret"],
    toolRecords: [],
    terminalOutput: [],
    executionRecords: [],
  };
}
