import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  type GovernanceLedgerController,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import {
  projectedCanonicalTools,
  projectedWorkGraphNodes,
  projectedWorkGraphEdges,
  projectedMailboxMessages,
  projectedCollabMessages,
  projectedCompletions,
  projectedConstitutionRules,
  projectedDecisionRecords,
  projectedDriftFindings,
  projectedEvidenceRecords,
  projectedPlanDocs,
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
import { ensureSessionFullEvents } from "../session-full-events";
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
    | "collabMessages",
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
    }
  }
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
  async function intelligenceExec(sessionID?: string) {
    const exec = sessionID
      ? (ctx.ports
          .getExecutionBySession()
          .get(sessionID as import("@natalia/contracts").SessionID) ??
        (await ctx.ports.ensureExecution(
          sessionID as import("@natalia/contracts").SessionID,
        )))
      : ctx.ports.getActiveExec();
    if (exec) await ensureSessionFullEvents(ctx, exec);
    return exec;
  }
  async function intelligenceSession(sessionID?: string) {
    return (await intelligenceExec(sessionID))?.session;
  }
  return {
    async confirmedWorkspaceChanges(sessionID?: string) {
      await ctx.ports.getReady();
      const exec = await intelligenceExec(sessionID);
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
      const session = await intelligenceSession(sessionID);
      if (!session) return [];
      const instance = loadInstanceGovernance(
        resolveGovernanceRoot(ctx.state.pluginStoreRoot),
      );
      const rules = (await runSessionProjectionWithFallback(
        "constitutionRules",
        [...instance.events, ...session.events],
      )) as ReturnType<typeof projectedConstitutionRules>;
      return rules.map((r) => ({
        ruleID: r.ruleID,
        statement: r.statement,
        scope: r.scope,
        priority: r.priority,
        source: r.source,
        enforcement: r.enforcement,
        overridePolicy: r.overridePolicy,
      }));
    },
    async decisionRecords(sessionID?: string) {
      const session = await intelligenceSession(sessionID);
      if (!session) return [];
      const instance = loadInstanceGovernance(
        resolveGovernanceRoot(ctx.state.pluginStoreRoot),
      );
      const decisions = (await runSessionProjectionWithFallback(
        "decisionRecords",
        [...instance.events, ...session.events],
      )) as ReturnType<typeof projectedDecisionRecords>;
      return decisions.map((r) => ({
        decision: r.decision,
        rationale: r.rationale ?? [],
        alternatives: r.alternatives ?? [],
        consequences: r.consequences ?? [],
        status: r.status,
        linkedPlans: r.linkedPlans ?? [],
        linkedConstraints: r.linkedConstraints ?? [],
      }));
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
      },
      sessionID?: string,
    ) {
      const exec = await intelligenceExec(sessionID);
      if (!exec?.session) return { recorded: false as const };
      const event = requireGovernanceLedger().recordDecision({
        id: `decision:${Date.now().toString(36)}:${ctx.ports.nextDecisionSequence()}`,
        ...input,
      });
      if (event.status === "accepted")
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
    async evidenceRecords(sessionID?: string) {
      const session = await intelligenceSession(sessionID);
      if (!session) return [];
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
      const evidence = (await runSessionProjectionWithFallback(
        "evidenceRecords",
        session.events,
      )) as ReturnType<typeof projectedEvidenceRecords>;
      return evidence.map((r) => ({
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
      }));
    },
    async completions(sessionID?: string) {
      const session = await intelligenceSession(sessionID);
      if (!session) return [];
      return projectedCompletions(session.events).map((c) => ({
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
      const owner = await intelligenceExec(sessionID);
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
      const exec = await intelligenceExec(sessionID);
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
    async driftFindings(sessionID?: string) {
      const session = await intelligenceSession(sessionID);
      if (!session) return [];
      return projectedDriftFindings(session.events).map((f) => ({
        findingID: f.findingID,
        severity: f.severity,
        confidence: f.confidence,
        originalObjective: f.originalObjective,
        currentActivity: f.currentActivity,
        evidence: f.evidence,
        status: f.status,
      }));
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
      const exec = await intelligenceExec(sessionID);
      if (!exec?.session) return { opened: 0 as const };
      if (!input.objective.trim() || !input.currentActivity.trim())
        return { opened: 0 as const };
      const findings = requireWorkLedger().evaluateDrift({
        sessionID: exec.session.id,
        turnID: exec.activeTurnID,
        objective: input.objective,
        currentActivity: input.currentActivity,
        applicableConstraints: input.applicableConstraints ?? [],
        changes: input.changes ?? [],
        evidenceRefs: input.evidenceRefs ?? [],
      });
      for (const finding of findings)
        ctx.ports.publishForSession(exec, finding);
      return { opened: findings.length };
    },
    /**
     * Acknowledge a drift finding (P7 D3): the Main Agent explains it, the user
     * dismisses it, or the work corrects it. Only an open finding can transition.
     */
    async acknowledgeDriftFinding(
      input: {
        findingID: string;
        status: "explained" | "dismissed" | "corrected";
        rationale?: string;
      },
      sessionID?: string,
    ) {
      const exec = await intelligenceExec(sessionID);
      if (!exec?.session) return { acknowledged: false as const };
      if (!input.findingID.trim()) return { acknowledged: false as const };
      const finding = projectedDriftFindings(exec.session.events).find(
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
      const exec = await intelligenceExec(sessionID);
      const session = exec?.session;
      if (!session || !input.ruleID.trim() || !input.reason.trim())
        return {
          requested: false as const,
          reason: "invalid override request",
        };
      const rule = projectedConstitutionRules(session.events).find(
        (candidate) => candidate.ruleID === input.ruleID,
      );
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
    async registeredTools(sessionID?: string) {
      const session = await intelligenceSession(sessionID);
      const projected = session
        ? (await projectedCanonicalToolsWithFallback(session.events)).map(
            (t) => ({
              name: t.name,
              owner: t.owner,
              scope: t.scope,
              recovery: t.recovery,
              precedence: t.precedence,
              requiresApproval: t.requiresApproval,
            }),
          )
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
  };
}
