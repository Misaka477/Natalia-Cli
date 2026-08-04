import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NataliaTaskStateStore } from "../src";

test("task state store records attempts and advances waterline only after final success", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-state-"));
  const store = await NataliaTaskStateStore.open(root);
  const started = store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as import("@natalia/contracts").SessionID,
    at: "2026-08-01T00:00:00.000Z",
  });
  expect(started).toMatchObject({ started: true });
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 1,
    status: "failed",
    retry: true,
    reason: "temporary network failure",
    at: "2026-08-01T00:01:00.000Z",
  });
  expect(store.getInvocation("inv_1")).toMatchObject({ status: "retrying" });
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.recordAttempt({
    invocationID: "inv_1",
    attempt: 2,
    episodeID: "epi_2" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_2" as import("@natalia/contracts").SessionID,
    at: "2026-08-01T00:02:00.000Z",
  });
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 2,
    status: "succeeded",
    retry: false,
    at: "2026-08-01T00:03:00.000Z",
  });
  expect(store.getInvocation("inv_1")).toMatchObject({
    status: "succeeded",
    waterlineAdvanced: true,
  });
  expect(store.getWaterline("task_1")).toMatchObject({
    invocationID: "inv_1",
  });
  store.close();
});

test("active invocation skips an overlap and terminal non-success does not advance waterline", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-overlap-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_active",
    taskID: "task_1",
    episodeID: "epi_active" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_active" as import("@natalia/contracts").SessionID,
  });
  const skipped = store.startInvocation({
    invocationID: "inv_skipped",
    taskID: "task_1",
    episodeID: "epi_skipped" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_skipped" as import("@natalia/contracts").SessionID,
  });
  expect(skipped).toMatchObject({
    started: false,
    invocation: { status: "skipped_due_to_overlap", waterlineAdvanced: false },
  });
  store.completeAttempt({
    invocationID: "inv_active",
    attempt: 1,
    status: "blocked",
    retry: false,
  });
  expect(store.getInvocation("inv_active")).toMatchObject({
    status: "blocked",
    waterlineAdvanced: false,
  });
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.close();
});

test("task state store rejects invalid attempt transitions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-transition-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as import("@natalia/contracts").SessionID,
  });
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 1,
    status: "cancelled",
    retry: false,
  });
  expect(() =>
    store.completeAttempt({
      invocationID: "inv_1",
      attempt: 1,
      status: "failed",
      retry: false,
    }),
  ).toThrow("already terminal");
  expect(() =>
    store.recordAttempt({
      invocationID: "inv_1",
      attempt: 2,
      episodeID: "epi_2" as import("@natalia/contracts").EpisodeID,
      sessionID: "ses_2" as import("@natalia/contracts").SessionID,
    }),
  ).toThrow("not retrying");
  store.close();
});

test("module lifecycle records an audited claim and evaluator completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-lifecycle-"));
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
    conditionIDs: ["minimum-1", "minimum-2"],
  });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:glob:1",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [
        { id: "minimum-1", status: "satisfied" },
        { id: "minimum-2", status: "partial" },
      ],
      evidenceRefs: ["tool:glob:1"],
      gaps: ["Inspect generated output"],
      recommendedAction: "Read the generated output.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    outcome: "incomplete",
    data: { gaps: ["Inspect generated output"] },
  });
  expect(store.moduleEvents("inv_1", 1).map((event) => event.kind)).toEqual([
    "flow.module_activated",
    "flow.module_claimed",
    "flow.module_evaluated",
    "flow.module_continued",
  ]);
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [
        { id: "minimum-1", status: "satisfied" },
        { id: "minimum-2", status: "satisfied" },
      ],
      evidenceRefs: ["tool:glob:1"],
      gaps: [],
      recommendedAction: "Complete the module.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    outcome: "complete",
  });
  expect(store.moduleEvents("inv_1", 1).at(-1)).toMatchObject({
    kind: "flow.module_completed",
  });
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.close();
});

test("module claims reject missing conditions, foreign evidence, and inactive modules", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-claim-"));
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
    conditionIDs: ["c1"],
  });
  const base = {
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [] as Array<{
        id: string;
        status: "missing" | "partial" | "satisfied";
      }>,
      evidenceRefs: [] as string[],
      gaps: [],
      recommendedAction: "Continue.",
    },
  };
  expect(() => store.claimModule(base)).toThrow(
    "include each declared condition",
  );
  expect(() =>
    store.claimModule({
      ...base,
      claim: {
        ...base.claim,
        conditionStatuses: [{ id: "c1", status: "satisfied" }],
        evidenceRefs: ["tool:foreign:1"],
      },
    }),
  ).toThrow("unknown attempt evidence");
  expect(() =>
    store.claimModule({
      ...base,
      attempt: 2,
      claim: {
        ...base.claim,
        conditionStatuses: [{ id: "c1", status: "satisfied" }],
      },
    }),
  ).toThrow("not found");
  store.close();
});

test("module plan advances only after the prior module is explicitly completed", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-plan-"));
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
        moduleID: "read",
        moduleType: "read_search",
        conditionIDs: [],
      },
      {
        flowID: "flow_1",
        moduleID: "report",
        moduleType: "report_output",
        conditionIDs: [],
      },
    ],
  });
  expect(
    store.activateNextModule({ invocationID: "inv_1", attempt: 1 }),
  ).toMatchObject({ moduleID: "read" });
  expect(() =>
    store.activateNextModule({ invocationID: "inv_1", attempt: 1 }),
  ).toThrow("another flow module is active");
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [],
      evidenceRefs: [],
      gaps: [],
      recommendedAction: "Evaluate.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    outcome: "complete",
  });
  expect(
    store.activateNextModule({ invocationID: "inv_1", attempt: 1 }),
  ).toMatchObject({ moduleID: "report", moduleType: "report_output" });
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.close();
});

test("blocked or stalled module plans cannot advance", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-plan-blocked-"));
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
        moduleID: "read",
        moduleType: "read_search",
        conditionIDs: [],
      },
      {
        flowID: "flow_1",
        moduleID: "report",
        moduleType: "report_output",
        conditionIDs: [],
      },
    ],
  });
  store.activateNextModule({ invocationID: "inv_1", attempt: 1 });
  store.stallModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    reason: "no progress",
  });
  expect(() =>
    store.activateNextModule({ invocationID: "inv_1", attempt: 1 }),
  ).toThrow("prior modules complete");
  store.close();
});
