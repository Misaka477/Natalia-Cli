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
  const secure = buildRedactedEvaluatorContext({
    flowID: "flow_1",
    moduleID: "read",
    conditionIDs: [],
    messages: ["raw secret"],
    toolRecords: [],
    terminalOutput: [],
    executionRecords: [],
    pendingOperations: ["terminal pane_1 is running"],
    secureInput: true,
  });
  expect(secure.messages).toEqual(["[secure input omitted]"]);
  expect(secure.pendingOperations).toEqual(["terminal pane_1 is running"]);
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

test("evaluator complete records module completion without task success", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-complete-"));
  const store = await claimedModuleStore(root);
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream() {
      yield {
        type: "content",
        text: JSON.stringify({
          schemaVersion: 1,
          outcome: "complete",
          conditions: [
            {
              id: "c1",
              status: "satisfied",
              reason: "read evidence is present",
              evidenceRefs: ["tool:1"],
            },
            {
              id: "c2",
              status: "satisfied",
              reason: "module baseline is met",
              evidenceRefs: [],
            },
          ],
          gaps: [],
          forbiddenRepeats: [],
          recommendedActions: [],
          idealOutcome: "satisfied",
        }),
      };
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
  ).resolves.toMatchObject({ outcome: "complete" });
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_completed",
  });
  expect(store.getInvocation("inv_1")).toMatchObject({
    status: "running",
    waterlineAdvanced: false,
  });
  store.close();
});

test("evaluator evidence refs must belong to the claimed module attempt", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-evidence-"));
  const store = await claimedModuleStore(root);
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream() {
      yield {
        type: "content",
        text: result.replace('"tool:1"', '"tool:other-attempt"'),
      };
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
  ).resolves.toMatchObject({
    outcome: "blocked",
    reason: expect.stringContaining("unknown attempt evidence"),
  });
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_blocked",
  });
  store.close();
});

test("evaluator blocks cross-provider calls without consent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-blocked-"));
  const store = await claimedModuleStore(root);
  let requested = false;
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream() {
      requested = true;
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
  expect(requested).toBe(false);
  store.close();
});

test("evaluator permits cross-provider calls with matching config-provider consent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-consent-"));
  const store = await claimedModuleStore(root);
  let requested = false;
  const provider: StreamingProvider = {
    provider: "judge-adapter",
    model: "judge-1",
    async *stream() {
      requested = true;
      yield { type: "content", text: result };
      yield { type: "done" };
    },
  };
  await expect(
    evaluateAndRecordModule({
      store,
      invocationID: "inv_1",
      attempt: 1,
      executionProvider: "execution-provider-key",
      selection: { provider: "judge-adapter", model: "judge-1" },
      consent: {
        provider: "evaluator-provider-key",
        confirmedAt: "2026-08-05T00:00:00.000Z",
      },
      provider,
      providerIdentity: "evaluator-provider-key",
      context: evaluatorContext(),
    }),
  ).resolves.toMatchObject({ outcome: "incomplete" });
  expect(requested).toBe(true);
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_continued",
  });
  store.close();
});

test("evaluator provider exceptions block the claimed module", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-throw-"));
  const store = await claimedModuleStore(root);
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream() {
      throw new Error("quota exhausted");
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
  ).resolves.toMatchObject({
    outcome: "blocked",
    reason: expect.stringContaining("quota exhausted"),
  });
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_blocked",
  });
  store.close();
});

test("a reporting stage that never reported is blocked, and says why", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-floor-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as import("@natalia/contracts").SessionID,
  });
  store.initializeModulePlan({
    invocationID: "inv_1",
    attempt: 1,
    modules: [
      {
        flowID: "flow_1",
        moduleID: "report",
        moduleType: "report_output",
        conditionIDs: ["c1"],
      },
    ],
  });
  store.activateNextModule({ invocationID: "inv_1", attempt: 1 });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    ref: "tool:1",
    tool: "read_file",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "report",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: ["tool:1"],
      gaps: [],
      recommendedAction: "Evaluate.",
    },
  });
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream() {
      yield {
        type: "content",
        text: JSON.stringify({
          schemaVersion: 1,
          outcome: "complete",
          conditions: [
            {
              id: "c1",
              status: "satisfied",
              reason: "the model says the finding was filed",
              evidenceRefs: ["tool:1"],
            },
          ],
          gaps: [],
          forbiddenRepeats: [],
          recommendedActions: [],
          idealOutcome: "satisfied",
        }),
      };
      yield { type: "done" };
    },
  };
  // The evaluator answered validly and said complete. The platform floor still
  // wins, and the recorded reason must not send an operator hunting for an
  // evaluator problem that does not exist.
  await expect(
    evaluateAndRecordModule({
      store,
      invocationID: "inv_1",
      attempt: 1,
      executionProvider: "judge",
      selection: { provider: "judge", model: "judge-1" },
      provider,
      context: {
        flowID: "flow_1",
        moduleID: "report",
        conditionIDs: ["c1"],
        messages: [],
        toolRecords: [],
        terminalOutput: [],
        executionRecords: [],
      },
    }),
  ).resolves.toMatchObject({
    outcome: "blocked",
    reason: expect.stringContaining("platform completion floor"),
  });
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_blocked",
  });
  expect(
    store.moduleEvents("inv_1", 1).map((event) => event.kind),
  ).not.toContain("flow.module_completed");
  expect(store.allModulesCompleted("inv_1", 1)).toBe(false);
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.close();
});

test("unresolved module operations block before the evaluator provider is called", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-evaluator-pending-"));
  const store = await claimedModuleStore(root);
  let called = false;
  const provider: StreamingProvider = {
    provider: "judge",
    model: "judge-1",
    async *stream() {
      called = true;
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
      context: {
        ...evaluatorContext(),
        pendingOperations: [
          "tool read_file (call_1) is running",
          "approval approval_1 is awaiting a response",
        ],
      },
    }),
  ).resolves.toEqual({
    outcome: "blocked",
    reason:
      "platform completion floor found unresolved operations: tool read_file (call_1) is running; approval approval_1 is awaiting a response",
  });
  expect(called).toBe(false);
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_blocked",
  });
  expect(
    store.moduleEvents("inv_1", 1).map((event) => event.kind),
  ).not.toContain("flow.module_completed");
  expect(store.allModulesCompleted("inv_1", 1)).toBe(false);
  expect(store.getWaterline("task_1")).toBeUndefined();
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
