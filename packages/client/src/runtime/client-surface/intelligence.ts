import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  projectedCanonicalTools,
  projectedCompletions,
  projectedConstitutionRules,
  projectedDecisionRecords,
  projectedDriftFindings,
  projectedEvidenceRecords,
  projectedPlans,
} from "@natalia/session";
import type { PlanLifecycleState } from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
import { redactToolOutput, runValidationCommand } from "./helpers";
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
>;
export function createIntelligenceSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async confirmedWorkspaceChanges() {
      await ctx.ports.getReady();
      if (!ctx.ports.getSession()) return [];
      return ctx.ports.reconcileWorkspaceObservation(ctx.ports.getActiveExec());
    },
    async constitutionRules() {
      if (!ctx.ports.getSession()) return [];
      return projectedConstitutionRules(ctx.ports.getSession()!.events).map(
        (r) => ({
          ruleID: r.ruleID,
          statement: r.statement,
          scope: r.scope,
          priority: r.priority,
          source: r.source,
          enforcement: r.enforcement,
          overridePolicy: r.overridePolicy,
        }),
      );
    },
    async decisionRecords() {
      if (!ctx.ports.getSession()) return [];
      return projectedDecisionRecords(ctx.ports.getSession()!.events).map(
        (r) => ({
          decision: r.decision,
          rationale: r.rationale ?? [],
          alternatives: r.alternatives ?? [],
          consequences: r.consequences ?? [],
          status: r.status,
          linkedPlans: r.linkedPlans ?? [],
          linkedConstraints: r.linkedConstraints ?? [],
        }),
      );
    },
    /**
     * The `decision.recorded` production writer. Decisions are durable facts —
     * a decision text and rationale may reach the journal — so this is the
     * surface the Chat/override loop (CST3) records through. The event
     * constructor in `constitution-ledger.ts` keeps the secret-safe boundary:
     * decision text and rationale are prose, never tool output or file content.
     */
    async recordDecision(input: {
      decision: string;
      rationale?: string[];
      alternatives?: {
        option: string;
        rejectedReason?: string;
      }[];
      consequences?: string[];
      linkedPlans?: string[];
      linkedConstraints?: string[];
    }) {
      if (!ctx.ports.getSession()) return { recorded: false as const };
      const event = ctx.ports.getGovernanceLedgerController().recordDecision({
        id: `decision:${Date.now().toString(36)}:${ctx.ports.nextDecisionSequence()}`,
        ...input,
      });
      ctx.ports.publishForSession(ctx.ports.getActiveExec(), event);
      // CST4 Work Graph linkage: the decision is a `decision` node in the graph.
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().decisionNode({
          decisionID: event.id,
          decision: event.decision,
          sessionID: ctx.ports.getSessionID(),
        }),
      );
      return { recorded: true as const };
    },
    async evidenceRecords() {
      if (!ctx.ports.getSession()) return [];
      // P2 E3: the effective status of each evidence record is driven by the
      // lifecycle of the plan whose task it belongs to (a projection policy —
      // the journal keeps the recorded status; the query answers what it means
      // now).
      const plans = projectedPlans(ctx.ports.getSession()!.events);
      const planStateForTask = new Map<string, string>();
      for (const plan of plans) {
        if (plan.taskID) planStateForTask.set(plan.taskID, plan.status);
      }
      return projectedEvidenceRecords(ctx.ports.getSession()!.events).map(
        (r) => ({
          taskID: r.taskID,
          objective: r.objective,
          status: r.status,
          effectiveStatus:
            r.taskID && planStateForTask.has(r.taskID)
              ? ctx.ports
                  .getGovernanceLedgerController()
                  .evidenceStatusForPlanState(
                    planStateForTask.get(r.taskID)! as PlanLifecycleState,
                    r.status,
                  )
              : r.status,
          changes: r.changes ?? [],
          validations: r.validations ?? [],
          knownGaps: r.knownGaps ?? [],
        }),
      );
    },
    async completions() {
      if (!ctx.ports.getSession()) return [];
      return projectedCompletions(ctx.ports.getSession()!.events).map((c) => ({
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
      }));
    },
    /**
     * The `evidence.recorded` production writer (E2 起步): runs a validation
     * command against the workspace, redacts secrets and truncates the summary,
     * then records the outcome as a durable evidence fact. This is the
     * validation-runner adapter — the command runs with the workspace as cwd,
     * bounded output and a timeout, and only the command, outcome, bounded safe
     * summary and duration reach the journal. Raw output never does.
     */
    async recordValidation(input: {
      taskID: string;
      objective: string;
      command: string;
      timeoutSec?: number;
      knownGaps?: string[];
    }) {
      const owner = ctx.ports.getActiveExec();
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
      const outcome = ctx.ports
        .getGovernanceLedgerController()
        .boundValidationOutcome({
          command: redactToolOutput(input.command, true),
          result,
          safeSummary,
          durationMs: performance.now() - startedAt,
        });
      const event = ctx.ports
        .getGovernanceLedgerController()
        .buildEvidenceRecorded({
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
    async recordCompletion(input: {
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
    }) {
      if (!ctx.ports.getSession()) return { recorded: false as const };
      if (
        !input.taskID.trim() ||
        !input.objective.trim() ||
        !input.changeSummary.trim()
      )
        return { recorded: false as const };
      const recordedAt = new Date().toISOString();
      const completionID = `completion:${Date.now().toString(36)}:${ctx.ports.nextCompletionSequence()}`;
      const event = ctx.ports
        .getGovernanceLedgerController()
        .buildCompletionRecorded({
          id: completionID,
          taskID: input.taskID,
          objective: input.objective,
          changeSummary: redactToolOutput(input.changeSummary, true),
          ...(input.behaviorImpact
            ? { behaviorImpact: redactToolOutput(input.behaviorImpact, true) }
            : {}),
          validations: (input.validations ?? []).map((validation) =>
            ctx.ports.getGovernanceLedgerController().boundValidationOutcome({
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
      ctx.ports.publishForSession(ctx.ports.getActiveExec(), event);
      // P2 E4 Work Graph integration: each completed change is validated by the
      // card through a `validated_by` edge.
      for (const path of input.changePaths ?? [])
        ctx.ports.publishForSession(
          ctx.ports.getActiveExec(),
          ctx.ports.getWorkLedgerController().completionValidationEdge({
            changeID: event.taskID,
            path,
            completionID,
          }),
        );
      return { recorded: true as const, completionID };
    },
    async driftFindings() {
      if (!ctx.ports.getSession()) return [];
      return projectedDriftFindings(ctx.ports.getSession()!.events).map(
        (f) => ({
          findingID: f.findingID,
          severity: f.severity,
          confidence: f.confidence,
          originalObjective: f.originalObjective,
          currentActivity: f.currentActivity,
          evidence: f.evidence,
          status: f.status,
        }),
      );
    },
    /**
     * Run the DriftEvaluator against safe signals and publish any findings it
     * opens. The evaluator is the only production writer of
     * `drift.finding_opened` (§56.9); it has no write power — a finding only
     * escalates to an approval/Chat/mailbox prompt, never a cancellation.
     * Already-open findings are not reopened.
     */
    async evaluateDrift(input: {
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
    }) {
      if (!ctx.ports.getSession()) return { opened: 0 as const };
      if (!input.objective.trim() || !input.currentActivity.trim())
        return { opened: 0 as const };
      const findings = ctx.ports.getWorkLedgerController().evaluateDrift({
        sessionID: ctx.ports.getSessionID(),
        turnID: ctx.ports.getActiveExec()?.activeTurnID,
        objective: input.objective,
        currentActivity: input.currentActivity,
        applicableConstraints: input.applicableConstraints ?? [],
        changes: input.changes ?? [],
        evidenceRefs: input.evidenceRefs ?? [],
      });
      for (const finding of findings)
        ctx.ports.publishForSession(ctx.ports.getActiveExec(), finding);
      return { opened: findings.length };
    },
    /**
     * Acknowledge a drift finding (P7 D3): the Main Agent explains it, the user
     * dismisses it, or the work corrects it. Only an open finding can transition.
     */
    async acknowledgeDriftFinding(input: {
      findingID: string;
      status: "explained" | "dismissed" | "corrected";
      rationale?: string;
    }) {
      if (!ctx.ports.getSession()) return { acknowledged: false as const };
      if (!input.findingID.trim()) return { acknowledged: false as const };
      const finding = projectedDriftFindings(
        ctx.ports.getSession()!.events,
      ).find(
        (candidate) =>
          candidate.findingID === input.findingID &&
          candidate.status === "open",
      );
      if (!finding) return { acknowledged: false as const };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().buildDriftFindingUpdate({
          id: `drift:${Date.now().toString(36)}:${input.findingID}`,
          findingID: input.findingID,
          status: input.status,
          rationale: input.rationale,
        }),
      );
      return { acknowledged: true as const };
    },
    async registeredTools() {
      if (!ctx.ports.getSession()) return [];
      return projectedCanonicalTools(ctx.ports.getSession()!.events).map(
        (t) => ({
          name: t.name,
          owner: t.owner,
          scope: t.scope,
          recovery: t.recovery,
          precedence: t.precedence,
          requiresApproval: t.requiresApproval,
        }),
      );
    },
  };
}
