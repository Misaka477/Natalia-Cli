import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  type GovernanceLedgerController,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { SessionFactState } from "@natalia/session";
import {
  projectedCanonicalTools,
  projectedWorkGraphNodes,
  projectedWorkGraphEdges,
  projectedMailboxMessages,
  projectedCollabMessages,
  projectedCompletions,
  projectedConstitutionRules,
  projectedRuntimeNotices,
  projectedWorkContracts,
  projectedDecisionRecords,
  projectedDriftFindings,
  projectedEvidenceRecords,
  projectedPlanDocs,
  sessionFactConstitutionRules,
  sessionFactCompletions,
  sessionFactDecisionRecords,
  sessionFactDriftFindings,
  sessionFactEvidenceRecords,
} from "@natalia/session";
import type { PlanLifecycleState } from "@natalia/runtime-services";
import type { EpisodeID } from "@natalia/contracts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  appendInstanceEvent,
  loadInstanceGovernance,
  resolveGovernanceRoot,
} from "@natalia/governance-ledger";
import type { RuntimeContext } from "../context";
import { requestAuditAfterCompletion } from "../audit-request";
import { ensureCompleteSessionFactState } from "../session-full-events";
import {
  ensureSessionEventWindow,
  sessionWindowEvents,
} from "../session-event-window";
import { redactToolOutput } from "./redaction";
import { runValidationCommand } from "./validation";

/**
 * The `ClientSurfaceOptions` the engineering-intelligence surface shares with
 * the other client surfaces. Declared here (instead of importing the
 * client-surface copy) so the runtime feature stays self-contained; the shape
 * is the subset of runtime client options consumed by this feature.
 */
type ClientSurfaceOptions = {
  episodeID?: EpisodeID;
  globalConfigPath?: string;
};

type Surface = Pick<
  RuntimeServiceClient,
  | "constitutionRules"
  | "decisionRecords"
  | "recordDecision"
  | "evidenceRecords"
  | "recordValidation"
  | "completions"
  | "recordCompletion"
  | "driftFindings"
  | "evaluateDrift"
  | "acknowledgeDriftFinding"
  | "confirmedWorkspaceChanges"
  | "registeredTools"
  | "requestOverride"
  | "approveOverride"
  | "updateConstitutionRule"
  | "removeConstitutionRule"
  | "notices"
>;
async function projectedCanonicalToolsWithFallback(
  events: import("@natalia/contracts").RuntimeEvent[],
) {
  try {
    const { projectedCanonicalToolsInWorker } = await import(
      "../session-project-client"
    );
    const result = (await projectedCanonicalToolsInWorker(events)) as Array<{
      name: string;
      owner: string;
      scope: string;
      recovery: string;
      precedence: number;
      requiresApproval: boolean;
    }>;
    return result;
  } catch {
    return projectedCanonicalTools(events);
  }
}

async function runSessionProjectionWithFallback(
  name:
    | "planDocs"
    | "evidenceRecords"
    | "constitutionRules"
    | "decisionRecords"
    | "workGraphNodes"
    | "workGraphEdges"
    | "mailboxMessages"
    | "collabMessages"
    | "notices",
  events: import("@natalia/contracts").RuntimeEvent[],
) {
  try {
    const { runSessionProjectionInWorker } = await import(
      "../session-project-client"
    );
    return await runSessionProjectionInWorker(name, events);
  } catch {
    switch (name) {
      case "planDocs":
        return projectedPlanDocs(events);
      case "evidenceRecords":
        return projectedEvidenceRecords(events);
      case "constitutionRules":
        return projectedConstitutionRules(events);
      case "decisionRecords":
        return projectedDecisionRecords(events);
      case "workGraphNodes":
        return projectedWorkGraphNodes(events);
      case "workGraphEdges":
        return projectedWorkGraphEdges(events);
      case "mailboxMessages":
        return projectedMailboxMessages(events);
      case "collabMessages":
        return projectedCollabMessages(events);
      case "notices":
        return projectedRuntimeNotices(events);
    }
  }
}

/**
 * B6 read-surface helper: fold the session's hot fact state (O(1) over the
 * live window) instead of rescanning the full journal when it is complete;
 * fall back to the projected-events path for a tail-only attach. Returns the
 * fact-state slice and whether it was used.
 */
function readFactSlice<T>(
  exec: { factStateComplete?: boolean; factState?: SessionFactState },
  select: (state: SessionFactState) => T[],
  fallback: () => T[],
): T[] {
  if (exec.factStateComplete === true && exec.factState)
    return select(exec.factState);
  return fallback();
}

/** Pagination for a read surface: cursor is an offset, limit bounded. */
function paginate<T>(items: T[], limit?: number, cursor?: string): T[] {
  if (limit === undefined && cursor === undefined) return items;
  const offset = cursor ? Number(cursor) : 0;
  if (!Number.isFinite(offset) || offset < 0) return items;
  const size = limit ?? items.length;
  return items.slice(offset, offset + Math.max(size, 1));
}

/** The external decision view: the journal fact plus its data scope. */
function decisionView(
  record: ReturnType<typeof projectedDecisionRecords>[number],
  scope: "session" | "workspace",
) {
  return {
    id: record.id,
    scope,
    decision: record.decision,
    rationale: record.rationale ?? [],
    alternatives: record.alternatives ?? [],
    consequences: record.consequences ?? [],
    status: record.status,
    linkedPlans: record.linkedPlans ?? [],
    linkedConstraints: record.linkedConstraints ?? [],
  };
}

/**
 * True when the rule is release-scope runtime self-protection (EI §3.8 P-1.c):
 * it cannot be edited or removed by any UI action, only bypassed through the
 * explicit override path.
 */
async function isReleaseRule(
  ctx: import("../context").RuntimeContext,
  exec: {
    session: { events: import("@natalia/contracts").RuntimeEvent[] };
    factStateComplete?: boolean;
    factState?: import("@natalia/session").SessionFactState;
  },
  ruleID: string,
): Promise<boolean> {
  await ensureCompleteSessionFactState(ctx as never, exec as never);
  const rules =
    exec.factStateComplete === true && exec.factState
      ? sessionFactConstitutionRules(exec.factState)
      : projectedConstitutionRules(exec.session.events);
  return rules.some(
    (rule) => rule.ruleID === ruleID && rule.scope === "release",
  );
}

export function createIntelligenceSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  function requireGovernanceLedger() {
    const ledger = ctx.ports.resolveService<GovernanceLedgerController>(
      GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error(
        "governance ledger unavailable (natalia-governance-ledger)",
      );
    return ledger;
  }
  function requireWorkLedger() {
    const ledger = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    return ledger;
  }
  async function intelligenceExecWindow(sessionID?: string) {
    // `start()` only kicks composition off in the background. Intelligence
    // reads may be the first routed calls on a workspace proxy, so every
    // surface must wait for the session-store before ensureExecution runs.
    await ctx.ports.getReady();
    const exec = sessionID
      ? (ctx.ports
          .getExecutionBySession()
          .get(sessionID as import("@natalia/contracts").SessionID) ??
        (await ctx.ports.ensureExecution(
          sessionID as import("@natalia/contracts").SessionID,
        )))
      : ctx.ports.getActiveExec();
    return exec;
  }

  /**
   * Read surfaces must see the same history the writer saw. Fast attach keeps
   * only a tail; complete the fact state before reading so a finding opened
   * outside the current window is still returned after it is updated.
   */
  async function completeIntelligenceExec(sessionID?: string) {
    const exec = await intelligenceExecWindow(sessionID);
    if (exec?.session) await ensureCompleteSessionFactState(ctx, exec);
    return exec;
  }
  return {
    async confirmedWorkspaceChanges(sessionID?: string) {
      await ctx.ports.getReady();
      const exec = await intelligenceExecWindow(sessionID);
      const reconciled = exec
        ? await ctx.ports.reconcileWorkspaceObservation(exec)
        : [];
      // Merge best-effort workspace mutation log so newly recorded tool writes
      // are visible even when observation data has not been reconciled yet.
      try {
        const logPath = resolve(
          ctx.ports.getWorkspaceRoot(),
          ".natalia",
          "workspace-mutations.json",
        );
        const rows = JSON.parse(await readFile(logPath, "utf8")) as Array<{
          sessionID?: string;
          path: string;
          operation: "add" | "modify" | "delete" | "rename";
        }>;
        const seen = new Set(reconciled.map((change) => change.path));
        const merged = [...reconciled];
        for (const row of rows) {
          if (sessionID && row.sessionID !== sessionID) continue;
          if (seen.has(row.path)) continue;
          seen.add(row.path);
          merged.push({
            id: `mutation:${row.path}`,
            workspaceRoot: ctx.ports.getWorkspaceRoot(),
            path: row.path,
            operation:
              row.operation === "add"
                ? "added"
                : row.operation === "delete"
                  ? "deleted"
                  : row.operation === "rename"
                    ? "renamed"
                    : "modified",
            origin: "tool",
            attribution: row.sessionID ? "attributed" : "unattributed",
            correlation: row.sessionID ? { sessionID: row.sessionID } : {},
            health: "healthy",
            at: new Date().toISOString(),
          });
        }
        return merged;
      } catch {
        return reconciled;
      }
    },
    async constitutionRules(sessionID?: string) {
      const exec = await completeIntelligenceExec(sessionID);
      if (!exec?.session) return [];
      const instance = loadInstanceGovernance(
        resolveGovernanceRoot(ctx.state.pluginStoreRoot),
      );
      const rules = (await runSessionProjectionWithFallback(
        "constitutionRules",
        [...instance.events, ...exec.session.events],
      )) as ReturnType<typeof projectedConstitutionRules>;
      return rules.map((r) => ({
        ruleID: r.ruleID,
        statement: r.statement,
        scope: r.scope,
        priority: r.priority,
        source: r.source,
        enforcement: r.enforcement,
        overridePolicy: r.overridePolicy,
        ...(r.appliesTo ? { appliesTo: r.appliesTo } : {}),
      }));
    },
    async decisionRecords(
      input?:
        | string
        | { sessionID?: string; scope?: "session" | "workspace" | "all" },
    ) {
      const sessionID =
        typeof input === "string" ? input : input?.sessionID;
      const scope =
        typeof input === "string" ? "session" : (input?.scope ?? "session");
      const exec = await completeIntelligenceExec(sessionID);
      if (!exec?.session) return [];
      // Session decisions are the default. Legacy facts without a scope are
      // session-scoped; workspace facts carry an explicit scope and must be
      // requested through scope workspace/all.
      const sessionRecords = readFactSlice(
        exec,
        sessionFactDecisionRecords,
        () => projectedDecisionRecords(exec.session.events),
      )
        .filter((record) => record.scope !== "workspace")
        .map((record) => decisionView(record, "session"));
      if (scope === "session") return sessionRecords;
      const instance = loadInstanceGovernance(
        resolveGovernanceRoot(ctx.state.pluginStoreRoot),
      );
      // Instance records are workspace-tier. A legacy instance event without an
      // explicit scope is workspace-scoped by construction.
      const workspaceRecords = projectedDecisionRecords(instance.events)
        .filter((record) => record.scope !== "session")
        .map((record) => decisionView(record, "workspace"));
      if (scope === "workspace") return workspaceRecords;
      const seen = new Set<string>();
      const merged: ReturnType<typeof decisionView>[] = [];
      for (const record of [...workspaceRecords, ...sessionRecords]) {
        if (seen.has(record.id)) continue;
        seen.add(record.id);
        merged.push(record);
      }
      return merged;
    },
    /**
     * The `decision.recorded` production writer. Decisions are durable facts —
     * a decision text and rationale may reach the journal — so this is the
     * surface the Chat/override loop (CST3) records through. The event
     * constructor in `constitution-ledger.ts` keeps the secret-safe boundary:
     * decision text and rationale are prose, never tool output or file content.
     */
    async recordDecision(
      input: {
        decision: string;
        rationale?: string[];
        alternatives?: {
          option: string;
          rejectedReason?: string;
        }[];
        consequences?: string[];
        linkedPlans?: string[];
        linkedConstraints?: string[];
        scope?: "session" | "workspace";
      },
      sessionID?: string,
    ) {
      const exec = await intelligenceExecWindow(sessionID);
      if (!exec?.session) return { recorded: false as const };
      const { scope: requestedScope, ...decisionInput } = input;
      const scope = requestedScope === "workspace" ? "workspace" : "session";
      const event = requireGovernanceLedger().recordDecision({
        id: `decision:${Date.now().toString(36)}:${ctx.ports.nextDecisionSequence()}`,
        ...decisionInput,
        ...(scope === "workspace" ? { scope } : {}),
      });
      // Workspace promotion is explicit opt-in; the default session decision
      // never reaches the shared instance file and therefore cannot leak into
      // another session's governance panel.
      if (scope === "workspace" && event.status === "accepted")
        appendInstanceEvent(
          resolveGovernanceRoot(ctx.state.pluginStoreRoot),
          "decisions.jsonl",
          event,
        );
      ctx.ports.publishForSession(exec, event);
      // CST4 Work Graph linkage: the decision is a `decision` node in the graph.
      ctx.ports.publishForSession(
        exec,
        requireWorkLedger().decisionNode({
          decisionID: event.id,
          decision: event.decision,
          sessionID: exec.session.id,
        }),
      );
      return { recorded: true as const };
    },
    async evidenceRecords(
      input?: { sessionID?: string; limit?: number; cursor?: string },
      sessionID?: string,
    ) {
      const resolvedSessionID = input?.sessionID ?? sessionID;
      const exec = await completeIntelligenceExec(resolvedSessionID);
      if (!exec?.session) return [];
      // P2 E3: the effective status of each evidence record is driven by the
      // workspace-level lifecycle of the plan whose task it belongs to (a
      // projection policy — the journal keeps the recorded status; the query
      // answers what it means now). Plan documents are workspace-level, so
      // evidence can resolve even when the plan was created in another session.
      const plans = ctx.ports.planDocRuntime.planDocSnapshot();
      const planStateForTask = new Map<string, string>();
      for (const plan of plans) {
        planStateForTask.set(plan.planID, plan.status);
      }
      // B6: the hot fact state is authoritative after the complete-history
      // check above; the projected-events path is the fallback for a
      // tail-only attach.
      const evidence = readFactSlice(
        exec,
        sessionFactEvidenceRecords,
        () => projectedEvidenceRecords(exec.session.events),
      ) as ReturnType<typeof projectedEvidenceRecords>;
      return paginate(
        evidence.map((r) => ({
          taskID: r.taskID,
          objective: r.objective,
          status: r.status,
          effectiveStatus:
            r.taskID && planStateForTask.has(r.taskID)
              ? requireGovernanceLedger().evidenceStatusForPlanState(
                  planStateForTask.get(r.taskID)! as PlanLifecycleState,
                  r.status,
                )
              : r.status,
          changes: r.changes ?? [],
          validations: r.validations ?? [],
          knownGaps: r.knownGaps ?? [],
        })),
        input?.limit,
        input?.cursor,
      );
    },
    async completions(
      input?: { sessionID?: string; limit?: number; cursor?: string },
      sessionID?: string,
    ) {
      const resolvedSessionID = input?.sessionID ?? sessionID;
      const exec = await completeIntelligenceExec(resolvedSessionID);
      if (!exec?.session) return [];
      const completions = readFactSlice(
        exec,
        sessionFactCompletions,
        () => projectedCompletions(exec.session.events),
      );
      return paginate(
        completions.map((c) => ({
          completionID: c.id,
          taskID: c.taskID,
          objective: c.objective,
          changeSummary: c.changeSummary,
          ...(c.behaviorImpact ? { behaviorImpact: c.behaviorImpact } : {}),
          validations: c.validations,
          ...(c.humanValidation ? { humanValidation: c.humanValidation } : {}),
          knownGaps: c.knownGaps ?? [],
          externalSideEffects: c.externalSideEffects ?? [],
          ...(c.rollbackState ? { rollbackState: c.rollbackState } : {}),
          evidenceIDs: c.evidenceIDs ?? [],
          recordedAt: c.recordedAt,
        })),
        input?.limit,
        input?.cursor,
      );
    },
    /**
     * The `evidence.recorded` production writer (E2 起步): runs a validation
     * command against the workspace, redacts secrets and truncates the summary,
     * then records the outcome as a durable evidence fact. This is the
     * validation-runner adapter — the command runs with the workspace as cwd,
     * bounded output and a timeout, and only the command, outcome, bounded safe
     * summary and duration reach the journal. Raw output never does.
     */
    async recordValidation(
      input: {
        taskID: string;
        objective: string;
        command: string;
        timeoutSec?: number;
        knownGaps?: string[];
      },
      sessionID?: string,
    ) {
      const owner = await intelligenceExecWindow(sessionID);
      if (!owner) return { recorded: false as const };
      if (
        typeof input.taskID !== "string" ||
        input.taskID.trim().length === 0 ||
        typeof input.objective !== "string" ||
        input.objective.trim().length === 0 ||
        typeof input.command !== "string" ||
        input.command.trim().length === 0
      )
        return { recorded: false as const };
      const startedAt = performance.now();
      let result: "passed" | "failed" | "skipped" = "failed";
      let safeSummary = "validation command did not run";
      try {
        const run = await runValidationCommand(
          input.command,
          ctx.ports.getWorkspaceRoot(),
          input.timeoutSec ?? 120,
        );
        result = run.exitCode === 0 ? "passed" : "failed";
        safeSummary = run.safeSummary;
      } catch (error) {
        safeSummary = `validation runner failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      const outcome = requireGovernanceLedger().boundValidationOutcome({
        command: redactToolOutput(input.command, true),
        result,
        safeSummary,
        durationMs: performance.now() - startedAt,
      });
      const event = requireGovernanceLedger().buildEvidenceRecorded({
        id: `evidence:${Date.now().toString(36)}:${ctx.ports.nextEvidenceSequence()}`,
        taskID: input.taskID,
        objective: input.objective,
        status: result === "passed" ? "validated" : "failed",
        validations: [outcome],
        knownGaps: input.knownGaps,
      });
      ctx.ports.publishForSession(owner, event);
      return {
        recorded: true as const,
        result,
        safeSummary: outcome.safeSummary,
      };
    },
    /**
     * Record a completion card (P2 E4): the fixed report structure (§5) that
     * answers "is it really done, what evidence is missing". The card is safe
     * prose — changeSummary is a summary, never a diff or file content — and a
     * `validated_by` Work Graph edge connects each completed change to the card.
     */
    async recordCompletion(
      input: {
        taskID: string;
        objective: string;
        changeSummary: string;
        behaviorImpact?: string;
        validations?: Array<{
          command: string;
          result: "passed" | "failed" | "skipped";
          safeSummary: string;
        }>;
        humanValidation?: string;
        knownGaps?: string[];
        externalSideEffects?: string[];
        rollbackState?: "clean" | "available" | "none" | "needs_promotion";
        evidenceIDs?: string[];
        changePaths?: string[];
      },
      sessionID?: string,
    ) {
      const exec = await intelligenceExecWindow(sessionID);
      if (!exec?.session) return { recorded: false as const };
      if (
        !input.taskID.trim() ||
        !input.objective.trim() ||
        !input.changeSummary.trim()
      )
        return { recorded: false as const };
      const recordedAt = new Date().toISOString();
      const completionID = `completion:${Date.now().toString(36)}:${ctx.ports.nextCompletionSequence()}`;
      const event = requireGovernanceLedger().buildCompletionRecorded({
        id: completionID,
        taskID: input.taskID,
        objective: input.objective,
        changeSummary: redactToolOutput(input.changeSummary, true),
        ...(input.behaviorImpact
          ? { behaviorImpact: redactToolOutput(input.behaviorImpact, true) }
          : {}),
        validations: (input.validations ?? []).map((validation) =>
          requireGovernanceLedger().boundValidationOutcome({
            command: redactToolOutput(validation.command, true),
            result: validation.result,
            safeSummary: validation.safeSummary,
          }),
        ),
        ...(input.humanValidation
          ? { humanValidation: redactToolOutput(input.humanValidation, true) }
          : {}),
        knownGaps: input.knownGaps,
        externalSideEffects: input.externalSideEffects,
        rollbackState: input.rollbackState,
        evidenceIDs: input.evidenceIDs,
        recordedAt,
      });
      ctx.ports.publishForSession(exec, event);
      // EI §3.9: completion.recorded is one of the two explicit audit triggers
      // (the other is awaiting_audit/auditing).
      requestAuditAfterCompletion(ctx, exec, event);
      // P2 E4 Work Graph integration: each completed change is validated by the
      // card through a `validated_by` edge.
      for (const path of input.changePaths ?? [])
        ctx.ports.publishForSession(
          exec,
          requireWorkLedger().completionValidationEdge({
            changeID: event.taskID,
            path,
            completionID,
          }),
        );
      return { recorded: true as const, completionID };
    },
    async driftFindings(
      input?: { sessionID?: string; limit?: number; cursor?: string },
      sessionID?: string,
    ) {
      const resolvedSessionID = input?.sessionID ?? sessionID;
      const exec = await completeIntelligenceExec(resolvedSessionID);
      if (!exec?.session) return [];
      const findings = readFactSlice(
        exec,
        sessionFactDriftFindings,
        () => projectedDriftFindings(exec.session.events),
      );
      return paginate(
        findings.map((f) => ({
          findingID: f.findingID,
          severity: f.severity,
          confidence: f.confidence,
          originalObjective: f.originalObjective,
          currentActivity: f.currentActivity,
          evidence: f.evidence,
          applicableConstraints: f.applicableConstraints,
          status: f.status,
          contractVersion: f.contractVersion,
          ruleHits: f.ruleHits,
          ...(f.planID ? { planID: f.planID } : {}),
          ...(f.rationale ? { rationale: f.rationale } : {}),
        })),
        input?.limit,
        input?.cursor,
      );
    },
    /**
     * Run the DriftEvaluator against safe signals and publish any findings it
     * opens. The evaluator is the only production writer of
     * `drift.finding_opened` (§56.9); it has no write power — a finding only
     * escalates to an approval/Chat/mailbox prompt, never a cancellation.
     * Already-open findings are not reopened.
     */
    async evaluateDrift(
      input: {
        objective: string;
        currentActivity: string;
        applicableConstraints?: string[];
        changes?: Array<{
          path?: string;
          action?: string;
          target?: string;
          summary?: string;
        }>;
        evidenceRefs?: string[];
      },
      sessionID?: string,
    ) {
      const exec = await intelligenceExecWindow(sessionID);
      if (!exec?.session) return { opened: 0 as const };
      if (!input.objective.trim() || !input.currentActivity.trim())
        return { opened: 0 as const };
      // EI §8.6: the R is the accepted WorkContract. The evaluator judges
      // against it when one exists; without it (no contract or a stale
      // draft) it produces at most the advisory unverifiable finding.
      const contract = projectedWorkContracts(exec.session.events).find(
        (candidate) => candidate.status === "current",
      );
      const findings = requireWorkLedger().evaluateDrift({
        sessionID: exec.session.id,
        turnID: exec.activeTurnID,
        objective: input.objective,
        currentActivity: input.currentActivity,
        applicableConstraints: input.applicableConstraints ?? [],
        changes: input.changes ?? [],
        evidenceRefs: input.evidenceRefs ?? [],
        ...(contract
          ? {
              contract: {
                planID: contract.planID,
                ...(contract.scope ? { scope: contract.scope } : {}),
                ...(contract.verification
                  ? { verification: contract.verification }
                  : {}),
                ...(contract.constraints
                  ? { constraints: contract.constraints }
                  : {}),
              },
            }
          : {}),
      });
      for (const finding of findings)
        ctx.ports.publishForSession(exec, finding);
      return { opened: findings.length };
    },
    /**
     * Acknowledge a drift finding (P7 D3 / EI §8.6): the Main Agent explains
     * it, disputes it, or declares a sanctioned detour; the user dismisses it
     * or the work corrects it. Only an open finding can transition.
     */
    async acknowledgeDriftFinding(
      input: {
        findingID: string;
        status:
          | "explained"
          | "disputed"
          | "dismissed"
          | "corrected"
          | "detour_declared";
        rationale?: string;
      },
      sessionID?: string,
    ) {
      const exec = await intelligenceExecWindow(sessionID);
      if (!exec?.session) return { acknowledged: false as const };
      if (!input.findingID.trim()) return { acknowledged: false as const };
      // A finding may have been opened long before the current window, so use
      // the hot state when it is complete; a fast-attach tail completes it from
      // paged history before we look.
      await ensureCompleteSessionFactState(ctx, exec);
      const findings =
        exec.factStateComplete === true && exec.factState
          ? sessionFactDriftFindings(exec.factState)
          : projectedDriftFindings(exec.session.events);
      const finding = findings.find(
        (candidate) =>
          candidate.findingID === input.findingID &&
          candidate.status === "open",
      );
      if (!finding) return { acknowledged: false as const };
      ctx.ports.publishForSession(
        exec,
        requireWorkLedger().buildDriftFindingUpdate({
          id: `drift:${Date.now().toString(36)}:${input.findingID}`,
          findingID: input.findingID,
          status: input.status,
          rationale: input.rationale,
        }),
      );
      return { acknowledged: true as const };
    },
    async requestOverride(
      input: {
        ruleID: string;
        reason: string;
        paths?: string[];
        taskID?: string;
        expiresAt?: string;
      },
      sessionID?: string,
    ) {
      await ctx.ports.getReady();
      const exec = await intelligenceExecWindow(sessionID);
      const session = exec?.session;
      if (!session || !input.ruleID.trim() || !input.reason.trim())
        return {
          requested: false as const,
          reason: "invalid override request",
        };
      // A rule may predate the current window, so use the hot state when it is
      // complete; a fast-attach tail completes it from paged history first.
      await ensureCompleteSessionFactState(ctx, exec);
      const rules =
        exec.factStateComplete === true && exec.factState
          ? sessionFactConstitutionRules(exec.factState)
          : projectedConstitutionRules(session.events);
      const rule = rules.find((candidate) => candidate.ruleID === input.ruleID);
      if (!rule) return { requested: false as const, reason: "unknown rule" };
      if (rule.overridePolicy === "forbidden")
        return { requested: false as const, reason: "override forbidden" };
      const requestID = `override:${input.ruleID}:${ctx.ports.nextDecisionSequence()}`;
      const response = await ctx.ports.getInteractive().requirePlanAcceptance({
        approvalID: requestID,
        planID: input.ruleID,
        title: `Override ${input.ruleID}`,
        preview: `Allow ${input.ruleID} (${input.reason})`,
        detail: input.reason,
        scope: "constitution_override",
      });
      if (!response || response.decision === "reject")
        return { requested: false as const, requestID, reason: "rejected" };
      const granted = {
        type: "constitution.override_granted" as const,
        id: requestID,
        ruleID: input.ruleID,
        reason: input.reason,
        approvedBy: "user" as const,
        ...(input.paths?.length ? { paths: input.paths } : {}),
        ...(input.taskID ? { taskID: input.taskID } : {}),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      };
      appendInstanceEvent(
        resolveGovernanceRoot(ctx.state.pluginStoreRoot),
        "decisions.jsonl",
        granted,
      );
      ctx.ports.publishForSession(exec, granted);
      return { requested: true as const, requestID };
    },
    async approveOverride(input: {
      requestID: string;
      decision: "once" | "reject";
    }) {
      const outcome = ctx.ports.getInteractive().respondApproval({
        requestID: input.requestID,
        decision: input.decision,
      });
      return { approved: outcome.accepted && input.decision === "once" };
    },
    /**
     * Update a constitution rule (EI §3.8 P-1.c, user-owned): disable or
     * re-enable a hard rule. `enabled:false` is a reversible update; the
     * durable tombstone is removeConstitutionRule.
     */
    async updateConstitutionRule(
      input: { ruleID: string; enabled?: boolean },
      sessionID?: string,
    ) {
      const exec = await intelligenceExecWindow(sessionID);
      if (!exec?.session || !input.ruleID.trim())
        return { updated: false as const };
      // Runtime self-protection: release-scope rules cannot be edited by a UI
      // action either (EI §3.8 P-1.c).
      if (await isReleaseRule(ctx, exec, input.ruleID))
        return { updated: false as const };
      const governanceLedger = requireGovernanceLedger();
      if (!governanceLedger) return { updated: false as const };
      ctx.ports.publishForSession(
        exec,
        governanceLedger.buildConstitutionRuleEnabledChange({
          id: `constitution:update:${Date.now().toString(36)}:${ctx.ports.nextDecisionSequence()}`,
          ruleID: input.ruleID,
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        }),
      );
      return { updated: true as const };
    },
    /**
     * Remove a constitution rule (EI §3.8 P-1.c, user-owned): an append-only
     * tombstone — the journal keeps the rule's full history, the effective
     * set drops it. The caller confirms before this is invoked.
     */
    async removeConstitutionRule(
      input: { ruleID: string },
      sessionID?: string,
    ) {
      const exec = await intelligenceExecWindow(sessionID);
      if (!exec?.session || !input.ruleID.trim())
        return { removed: false as const };
      // Runtime self-protection: release-scope rules are never removable.
      if (await isReleaseRule(ctx, exec, input.ruleID))
        return { removed: false as const };
      const governanceLedger = requireGovernanceLedger();
      if (!governanceLedger) return { removed: false as const };
      ctx.ports.publishForSession(
        exec,
        governanceLedger.buildConstitutionRuleRemoved({
          id: `constitution:removed:${Date.now().toString(36)}:${ctx.ports.nextDecisionSequence()}`,
          ruleID: input.ruleID,
          removedAt: new Date().toISOString(),
        }),
      );
      return { removed: true as const };
    },
    async registeredTools(sessionID?: string) {
      await ctx.ports.getReady();
      const exec = await intelligenceExecWindow(sessionID);
      const window = exec
        ? await ensureSessionEventWindow(ctx, exec)
        : undefined;
      const events = window
        ? sessionWindowEvents(exec!, window)
        : (exec?.session.events ?? []);
      const projected = events.length
        ? (await projectedCanonicalToolsWithFallback(events)).map((t) => ({
            name: t.name,
            owner: t.owner,
            scope: t.scope,
            recovery: t.recovery,
            precedence: t.precedence,
            requiresApproval: t.requiresApproval,
          }))
        : [];
      // The live tool registry is the authoritative list of currently loaded
      // tools. Some plugin tools are registered before their projection events
      // are persisted into the session, so merge them into the reported set.
      const live = [...ctx.state.tools.values()].map((tool) => ({
        name: tool.name,
        owner:
          ctx.state.capabilityRegistry.ownerOf("tools", tool.name) ?? "kernel",
        scope: "session" as const,
        recovery: "none" as const,
        precedence: 0,
        requiresApproval: tool.requiresApproval,
      }));
      const merged = new Map<string, (typeof projected)[number]>();
      for (const tool of [...live, ...projected]) merged.set(tool.name, tool);
      return [...merged.values()];
    },
    async notices(sessionID?: string) {
      const exec = await completeIntelligenceExec(sessionID);
      if (!exec?.session) return [];
      return (await runSessionProjectionWithFallback(
        "notices",
        exec.session.events,
      )) as import("@natalia/contracts").RuntimeProjectedNotice[];
    },
  };
}
