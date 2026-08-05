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

test("task state store retries a blocked attempt under fresh module episodes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-retry-blocked-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_retry",
    taskID: "task_1",
    episodeID: "epi_attempt_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_attempt_1" as import("@natalia/contracts").SessionID,
  });
  const plan = [
    {
      flowID: "flow_1",
      moduleID: "read",
      moduleType: "read_search" as const,
      conditionIDs: ["c1"],
    },
  ];
  store.initializeModulePlan({
    invocationID: "inv_retry",
    attempt: 1,
    modules: plan,
  });
  store.activateNextModule({
    invocationID: "inv_retry",
    attempt: 1,
    episodeID: "epi_read_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_read_1" as import("@natalia/contracts").SessionID,
  });
  store.recordModuleEvidence({
    invocationID: "inv_retry",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read_evidence",
  });
  store.claimModule({
    invocationID: "inv_retry",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: [],
      gaps: [],
      recommendedAction: "Evaluate.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_retry",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    outcome: "blocked",
  });
  store.completeAttempt({
    invocationID: "inv_retry",
    attempt: 1,
    status: "blocked",
    retry: true,
    reason: "first attempt blocked",
  });
  expect(store.getInvocation("inv_retry")).toMatchObject({
    status: "retrying",
    waterlineAdvanced: false,
  });
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.recordAttempt({
    invocationID: "inv_retry",
    attempt: 2,
    episodeID: "epi_attempt_2" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_attempt_2" as import("@natalia/contracts").SessionID,
  });
  store.initializeModulePlan({
    invocationID: "inv_retry",
    attempt: 2,
    modules: plan,
  });
  store.activateNextModule({
    invocationID: "inv_retry",
    attempt: 2,
    episodeID: "epi_read_2" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_read_2" as import("@natalia/contracts").SessionID,
  });
  store.recordModuleEvidence({
    invocationID: "inv_retry",
    attempt: 2,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read_evidence",
  });
  store.claimModule({
    invocationID: "inv_retry",
    attempt: 2,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: [],
      gaps: [],
      recommendedAction: "Evaluate.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_retry",
    attempt: 2,
    flowID: "flow_1",
    moduleID: "read",
    outcome: "complete",
  });
  expect(store.allModulesCompleted("inv_retry", 2)).toBe(true);
  store.completeAttempt({
    invocationID: "inv_retry",
    attempt: 2,
    status: "succeeded",
    retry: false,
  });
  expect(store.getInvocation("inv_retry")).toMatchObject({
    status: "succeeded",
    waterlineAdvanced: true,
  });
  expect(store.getWaterline("task_1")).toMatchObject({
    invocationID: "inv_retry",
  });
  const activated1 = store
    .moduleEvents("inv_retry", 1)
    .filter((event) => event.kind === "flow.module_activated");
  const activated2 = store
    .moduleEvents("inv_retry", 2)
    .filter((event) => event.kind === "flow.module_activated");
  expect(activated1[0]?.data.episodeID).toBe("epi_read_1");
  expect(activated2[0]?.data.episodeID).toBe("epi_read_2");
  expect(activated1[0]?.data.sessionID).not.toBe(activated2[0]?.data.sessionID);
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
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read_evidence",
  });
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

test("module activation durably records its isolated runtime episode", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-episode-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_attempt" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_attempt" as import("@natalia/contracts").SessionID,
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
    ],
  });
  store.activateNextModule({
    invocationID: "inv_1",
    attempt: 1,
    episodeID: "epi_module" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_module" as import("@natalia/contracts").SessionID,
  });
  expect(store.moduleEvents("inv_1", 1)[0]).toMatchObject({
    kind: "flow.module_activated",
    data: { episodeID: "epi_module", sessionID: "ses_module" },
  });
  store.close();
});

test("module plan reports completion only after every module completes under distinct sessions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-batch-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_attempt" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_attempt" as import("@natalia/contracts").SessionID,
  });
  store.initializeModulePlan({
    invocationID: "inv_1",
    attempt: 1,
    modules: [
      {
        flowID: "flow_1",
        moduleID: "read",
        moduleType: "read_search",
        conditionIDs: ["c1"],
      },
      {
        flowID: "flow_1",
        moduleID: "report",
        moduleType: "report_output",
        conditionIDs: ["c2"],
      },
    ],
  });
  expect(store.allModulesCompleted("inv_1", 1)).toBe(false);
  expect(
    store.activateNextModule({
      invocationID: "inv_1",
      attempt: 1,
      episodeID: "epi_read" as import("@natalia/contracts").EpisodeID,
      sessionID: "ses_read" as import("@natalia/contracts").SessionID,
    }),
  ).toMatchObject({ moduleID: "read" });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read_evidence",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
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
  expect(store.allModulesCompleted("inv_1", 1)).toBe(false);
  expect(
    store.activateNextModule({
      invocationID: "inv_1",
      attempt: 1,
      episodeID: "epi_report" as import("@natalia/contracts").EpisodeID,
      sessionID: "ses_report" as import("@natalia/contracts").SessionID,
    }),
  ).toMatchObject({ moduleID: "report" });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    ref: "tool:report_evidence",
    tool: "report_issue",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "report",
      conditionStatuses: [{ id: "c2", status: "satisfied" }],
      evidenceRefs: [],
      gaps: [],
      recommendedAction: "Evaluate.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    outcome: "complete",
  });
  expect(store.allModulesCompleted("inv_1", 1)).toBe(true);
  const activated = store
    .moduleEvents("inv_1", 1)
    .filter((event) => event.kind === "flow.module_activated");
  expect(activated.map((event) => event.moduleID)).toEqual(["read", "report"]);
  expect(activated.map((event) => event.data.episodeID)).toEqual([
    "epi_read",
    "epi_report",
  ]);
  expect(activated.map((event) => event.data.sessionID)).toEqual([
    "ses_read",
    "ses_report",
  ]);
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 1,
    status: "succeeded",
    retry: false,
  });
  expect(store.getInvocation("inv_1")).toMatchObject({
    status: "succeeded",
    waterlineAdvanced: true,
  });
  expect(store.getWaterline("task_1")).toMatchObject({ invocationID: "inv_1" });
  store.close();
});

test("blocked or incomplete module plans never report completion or advance", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-batch-blocked-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_1",
    taskID: "task_1",
    episodeID: "epi_attempt" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_attempt" as import("@natalia/contracts").SessionID,
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
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read_evidence",
  });
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
    outcome: "blocked",
  });
  expect(store.allModulesCompleted("inv_1", 1)).toBe(false);
  expect(() =>
    store.activateNextModule({ invocationID: "inv_1", attempt: 1 }),
  ).toThrow("prior modules complete");
  store.completeAttempt({
    invocationID: "inv_1",
    attempt: 1,
    status: "blocked",
    retry: false,
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
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read_evidence",
  });
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

test("module evidence refs remain scoped to the active attempt module", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-module-evidence-refs-"));
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
    conditionIDs: [],
  });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:read_1",
  });
  expect(
    store.moduleEvidenceRefs({
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "read",
    }),
  ).toEqual(["tool:read_1"]);
  expect(() =>
    store.moduleEvidenceRefs({
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "other",
    }),
  ).toThrow("not active");
  store.close();
});

test("task state store exposes read-only invocation and attempt history", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-history-"));
  const store = await NataliaTaskStateStore.open(root);
  store.startInvocation({
    invocationID: "inv_first",
    taskID: "task_1",
    episodeID: "epi_1" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_1" as import("@natalia/contracts").SessionID,
    at: "2026-08-01T00:00:00.000Z",
  });
  store.completeAttempt({
    invocationID: "inv_first",
    attempt: 1,
    status: "blocked",
    retry: true,
    reason: "module blocked",
    at: "2026-08-01T00:01:00.000Z",
  });
  store.recordAttempt({
    invocationID: "inv_first",
    attempt: 2,
    episodeID: "epi_2" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_2" as import("@natalia/contracts").SessionID,
    at: "2026-08-01T00:02:00.000Z",
  });
  store.completeAttempt({
    invocationID: "inv_first",
    attempt: 2,
    status: "succeeded",
    retry: false,
    at: "2026-08-01T00:03:00.000Z",
  });
  const overlapped = store.startInvocation({
    invocationID: "inv_second",
    taskID: "task_1",
    episodeID: "epi_3" as import("@natalia/contracts").EpisodeID,
    sessionID: "ses_3" as import("@natalia/contracts").SessionID,
    at: "2026-08-02T00:00:00.000Z",
  });
  expect(overlapped.started).toBe(true);
  const invocations = store.invocations("task_1");
  expect(invocations.map((invocation) => invocation.invocationID)).toEqual([
    "inv_second",
    "inv_first",
  ]);
  expect(store.invocations("task_1", 1)).toHaveLength(1);
  expect(store.invocations("task_other")).toEqual([]);
  expect(
    store
      .attempts("inv_first")
      .map((attempt) => [
        attempt.attempt,
        attempt.status,
        attempt.episodeID,
        attempt.reason,
      ]),
  ).toEqual([
    [1, "blocked", "epi_1", "module blocked"],
    [2, "succeeded", "epi_2", undefined],
  ]);
  store.close();
});

test("a module with no successful tool call can never be completed", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-empty-module-"));
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
    moduleID: "report",
    conditionIDs: ["c1"],
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "report",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: [],
      gaps: [],
      recommendedAction: "Evaluate the claim.",
    },
  });
  // The platform floor is independent of the user's conditions and of the
  // evaluator: nothing happened in this stage, so it cannot be complete.
  expect(() =>
    store.evaluateModule({
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "report",
      outcome: "complete",
    }),
  ).toThrow("cannot complete without recorded evidence");
  // The stage can still be blocked or continued, and it never completed.
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    outcome: "blocked",
  });
  expect(
    store.moduleEvents("inv_1", 1).map((event) => event.kind),
  ).not.toContain("flow.module_completed");
  expect(store.allModulesCompleted("inv_1", 1)).toBe(false);
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.close();
});

test("a reporting stage needs evidence from the reporting tool itself", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-report-floor-"));
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
  // Reading a file inside a reporting stage is real work, so the generic
  // "something succeeded" floor is satisfied - but nothing left the machine.
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    ref: "tool:call_read",
    tool: "read_file",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "report",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: ["tool:call_read"],
      gaps: [],
      recommendedAction: "Evaluate the claim.",
    },
  });
  expect(() =>
    store.evaluateModule({
      invocationID: "inv_1",
      attempt: 1,
      flowID: "flow_1",
      moduleID: "report",
      outcome: "complete",
    }),
  ).toThrow("cannot complete without evidence from report_issue");
  // The stage can still be blocked, and it never completed.
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    outcome: "blocked",
  });
  expect(
    store.moduleEvents("inv_1", 1).map((event) => event.kind),
  ).not.toContain("flow.module_completed");
  expect(store.allModulesCompleted("inv_1", 1)).toBe(false);
  expect(store.getWaterline("task_1")).toBeUndefined();
  store.close();
});

test("a reporting stage completes once the reporting tool succeeded", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-report-ok-"));
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
    ref: "tool:call_read",
    tool: "read_file",
  });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    ref: "tool:call_issue",
    tool: "report_issue",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "report",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: ["tool:call_issue"],
      gaps: [],
      recommendedAction: "Evaluate the claim.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "report",
    outcome: "complete",
  });
  expect(store.allModulesCompleted("inv_1", 1)).toBe(true);
  store.close();
});

test("a stage of another type is not asked for reporting evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-task-read-floor-"));
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
        conditionIDs: ["c1"],
      },
    ],
  });
  store.activateNextModule({ invocationID: "inv_1", attempt: 1 });
  store.recordModuleEvidence({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    ref: "tool:call_read",
    tool: "read_file",
  });
  store.claimModule({
    invocationID: "inv_1",
    attempt: 1,
    claim: {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [{ id: "c1", status: "satisfied" }],
      evidenceRefs: ["tool:call_read"],
      gaps: [],
      recommendedAction: "Evaluate the claim.",
    },
  });
  store.evaluateModule({
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    outcome: "complete",
  });
  expect(store.allModulesCompleted("inv_1", 1)).toBe(true);
  store.close();
});
