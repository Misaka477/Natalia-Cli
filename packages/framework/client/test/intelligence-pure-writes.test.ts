import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import { createIntelligenceSurface } from "../src/runtime/engineering-intelligence/intelligence";
import type { RuntimeContext } from "../src/runtime/context";
import type { SessionExecutionState } from "../src/runtime/session-execution-state";
import { sessionFactStateFromEvents } from "@natalia/session";

/**
 * Pure intelligence writes must not pull the full journal: they only need the
 * live execution (session id / active turn) and the ledgers. The fake service
 * deliberately has no `loadFullAsync`, so any accidental
 * `ensureSessionFullEvents()` would throw.
 */
function harness() {
  const published: RuntimeEvent[] = [];
  let decisionSequence = 0;
  const exec = {
    session: { id: "ses_pure_writes", events: [] },
    activeTurnID: "turn_1",
  } as unknown as SessionExecutionState;

  const ledger = {
    recordDecision: (input: { id: string; decision: string }) => ({
      type: "decision.recorded",
      id: input.id,
      decision: input.decision,
      status: "proposed",
    }),
    decisionNode: (input: {
      decisionID: string;
      decision: string;
      sessionID: string;
    }) => ({
      type: "workgraph.node_added",
      id: `wg:decision:${input.decisionID}`,
      nodeID: `wg:decision:${input.decisionID}`,
      kind: "decision",
      summary: input.decision,
      sessionID: input.sessionID,
    }),
    evaluateDrift: () => [],
    buildCompletionRecorded: (input: { id: string; taskID: string }) => ({
      type: "completion.recorded",
      id: input.id,
      taskID: input.taskID,
      objective: "objective",
      changeSummary: "summary",
      validations: [],
    }),
    completionValidationEdge: () => ({
      type: "workgraph.edge_added",
      id: "wg:edge:1",
      fromNodeID: "wg:change:1",
      toNodeID: "wg:completion:1",
      kind: "validated_by",
    }),
  };

  const ctx = {
    state: { pluginStoreRoot: "/tmp/natalia-pure-writes" },
    ports: {
      getExecutionBySession: () => new Map([["ses_pure_writes", exec]]),
      getActiveExec: () => exec,
      resolveService: () => ledger,
      publishForSession: (_exec: unknown, event: RuntimeEvent) => {
        published.push(event);
      },
      nextDecisionSequence: () => (decisionSequence += 1),
      nextCompletionSequence: () => 1,
      getWorkspaceRoot: () => "/tmp",
    },
  } as unknown as RuntimeContext;

  return {
    surface: createIntelligenceSurface(ctx, {}),
    published,
  };
}

test("recordDecision records without loading full history", async () => {
  const { surface, published } = harness();
  const result = await surface.recordDecision!(
    { decision: "Use the shared session window" },
    "ses_pure_writes",
  );
  expect(result).toEqual({ recorded: true });
  expect(published.filter((e) => e.type === "decision.recorded")).toHaveLength(
    1,
  );
  expect(
    published.filter(
      (e) => e.type === "workgraph.node_added" && e.kind === "decision",
    ),
  ).toHaveLength(1);
});

test("evaluateDrift records without loading full history", async () => {
  const { surface } = harness();
  const result = await surface.evaluateDrift!(
    { objective: "ship", currentActivity: "testing" },
    "ses_pure_writes",
  );
  expect(result).toEqual({ opened: 0 });
});

test("recordCompletion records without loading full history", async () => {
  const { surface, published } = harness();
  const result = await surface.recordCompletion!(
    {
      taskID: "task_1",
      objective: "ship",
      changeSummary: "did the thing",
    },
    "ses_pure_writes",
  );
  expect(result.recorded).toBe(true);
  expect(
    published.filter((e) => e.type === "completion.recorded"),
  ).toHaveLength(1);
});

test("acknowledgeDriftFinding reads a complete hot state without a full load", async () => {
  const published: RuntimeEvent[] = [];
  const earlier: RuntimeEvent = {
    type: "drift.finding_opened",
    id: "drift:1",
    findingID: "DF-1",
    severity: "warning",
    confidence: 0.5,
    originalObjective: "objective",
    currentActivity: "activity",
    evidence: [],
    applicableConstraints: [],
    contractVersion: 2,
  };
  const exec = {
    // A tail-only base: folding the journal here would miss the finding.
    session: { id: "ses_hot_state", events: [] },
    factState: sessionFactStateFromEvents([earlier]),
    factStateComplete: true,
  } as unknown as SessionExecutionState;
  const ctx = {
    state: { pluginStoreRoot: "/tmp/natalia-hot-state" },
    ports: {
      getExecutionBySession: () => new Map([["ses_hot_state", exec]]),
      getActiveExec: () => exec,
      resolveService: () => ({
        buildDriftFindingUpdate: (input: {
          id: string;
          findingID: string;
          status: string;
          rationale?: string;
        }) => ({
          type: "drift.finding_updated",
          id: input.id,
          findingID: input.findingID,
          status: input.status,
          ...(input.rationale ? { rationale: input.rationale } : {}),
        }),
      }),
      publishForSession: (_exec: unknown, event: RuntimeEvent) => {
        published.push(event);
      },
    },
  } as unknown as RuntimeContext;
  const surface = createIntelligenceSurface(ctx, {});
  const result = await surface.acknowledgeDriftFinding!(
    { findingID: "DF-1", status: "explained" },
    "ses_hot_state",
  );
  expect(result).toEqual({ acknowledged: true });
  expect(
    published.filter((e) => e.type === "drift.finding_updated"),
  ).toHaveLength(1);
});
