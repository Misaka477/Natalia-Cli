/**
 * Turn-boundary settlement and workspace observation — runtime/collaboration/
 * boundary module.
 *
 * A finished turn is the safe point for mailbox settlement (acknowledge the
 * already-delivered batch, deliver the queued batch), plan promotion (activate
 * the queued-next plan), and workspace observation reconcile (graph external
 * edits and drift-check them against the active plan). Reads live state through
 * `RuntimeContext` at call time.
 */
import {
  projectedMailboxMessages,
  sessionFactMailboxMessages,
} from "@natalia/session";
import { buildMailboxStatus } from "@natalia/runtime-services";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_FILES_SERVICE,
  type WorkLedgerController,
  type WorkspaceFilesController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";
import { activePlanForExec } from "./plan-doc-runtime";
import {
  projectedConstitutionRules,
  projectedEvidenceRecords,
  projectedWorkContracts,
} from "@natalia/session";
import {
  injectFindingIntoMainAgent,
  injectProseQuestion,
} from "../drift-inject";
import {
  deriveDriftBehaviorSignals,
  proseRelevanceQuestion,
} from "@natalia/work-ledger";

/**
 * Minimal constitution-rule path matching (EI §8.1 a/p/c wiring): a rule
 * applies when any of its `appliesTo.paths` patterns matches the changed
 * path. `*` matches within a segment, `**` matches across segments; a bare
 * directory pattern matches everything under it. The B5 evaluator rewrite
 * carries the matcher forward.
 */
function globPathMatch(pattern: string, path: string): boolean {
  const normalizedPattern = pattern.replace(/\\/gu, "/").replace(/^\.\//u, "");
  const normalizedPath = path.replace(/\\/gu, "/").replace(/^\.\//u, "");
  // Escape regex metacharacters, then expand `**/`, `**` and `*`.
  const GLOBSTAR = "\u0000";
  const source = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*\//gu, GLOBSTAR)
    .replace(/\*\*/gu, ".*")
    .replace(/\*/gu, "[^/]*");
  const regex = new RegExp(`^${source.split(GLOBSTAR).join("(?:.*/)?")}$`, "u");
  if (regex.test(normalizedPath)) return true;
  // A directory pattern ("src/") also matches everything under it.
  return (
    normalizedPattern.endsWith("/") &&
    normalizedPath.startsWith(normalizedPattern)
  );
}

export function createCollaborationBoundary(ctx: RuntimeContext) {
  function mailboxMessagesFor(exec?: SessionExecutionState) {
    // The hot state is complete even when session.events is a fast-attach tail.
    if (exec?.factStateComplete === true && exec.factState)
      return sessionFactMailboxMessages(exec.factState);
    const snapshot = exec?.collabSnapshot;
    if (
      snapshot &&
      snapshot.eventCount ===
        (exec?.eventCount ?? exec?.session.events.length ?? -1)
    )
      return snapshot.mailboxMessages;
    return projectedMailboxMessages(exec?.session.events ?? []);
  }

  return {
    settleMailboxAtBoundary,
    acknowledgeDeliveredMailboxAtBoundary,
    deliverQueuedMailboxAtBoundary,
    takeLiveUserMessages,
    reconcileWorkspaceObservation,
  };

  /**
   * P8 C3: settle the mailbox at the turn boundary. Already-delivered messages
   * (injected into the turn that just finished) are acknowledged so they stop
   * re-injecting. Queued messages are also delivered here as a fallback if a
   * live step did not already take them. A cancelled/aborted turn is NOT a
   * settlement.
   */
  function settleMailboxAtBoundary(exec?: SessionExecutionState) {
    acknowledgeDeliveredMailboxAtBoundary(exec);
    deliverQueuedMailboxAtBoundary(exec);
  }

  /**
   * Acknowledge every message that is still `delivered` (it was injected into
   * the turn that just finished, so the main agent has seen it). Acknowledged
   * messages no longer re-inject as ordinary tagged user messages.
   */
  function acknowledgeDeliveredMailboxAtBoundary(exec?: SessionExecutionState) {
    const { publishForSession, nextMailboxSequence } = ctx.ports;
    const target = exec;
    if (!target?.session) return;
    const delivered = mailboxMessagesFor(target).filter(
      (message) => message.status === "delivered",
    );
    if (!delivered.length) return;
    const at = new Date().toISOString();
    for (const message of delivered)
      publishForSession(
        target,
        buildMailboxStatus({
          id: `${message.messageID}:acknowledged:${nextMailboxSequence()}`,
          messageID: message.messageID,
          status: "acknowledged",
          at,
        }),
      );
  }

  /**
   * The safe-boundary delivery half of the mailbox: every queued message moves
   * to `delivered` at the safe point. The projection drives this — only
   * messages still `queued` are delivered, so deferred/superseded messages are
   * left alone, and a message that was already delivered is untouched.
   */
  function deliverQueuedMailboxAtBoundary(exec?: SessionExecutionState) {
    const { publishForSession, nextMailboxSequence } = ctx.ports;
    const target = exec;
    if (!target?.session) return;
    const queued = mailboxMessagesFor(target).filter(
      (message) => message.status === "queued",
    );
    if (!queued.length) return;
    const at = new Date().toISOString();
    for (const message of queued)
      publishForSession(
        target,
        buildMailboxStatus({
          id: `${message.messageID}:delivered:${nextMailboxSequence()}`,
          messageID: message.messageID,
          status: "delivered",
          at,
        }),
      );
  }

  function takeLiveUserMessages(exec?: SessionExecutionState) {
    const target = exec;
    if (!target?.session) return [];
    deliverQueuedMailboxAtBoundary(target);
    const injected = target.injectedMailboxIDs;
    const fresh = mailboxMessagesFor(target).filter(
      (message) =>
        message.status === "delivered" && !injected.has(message.messageID),
    );
    const messages: Array<{ source: "user" | "navi"; text: string }> = [];
    for (const message of fresh) {
      injected.add(message.messageID);
      const tag = message.source === "system" ? "[Navi]" : "[user]";
      messages.push({
        source: message.source === "system" ? "navi" : "user",
        text: `${tag} ${message.text}`,
      });
    }
    return messages;
  }

  /**
   * WG4: reconcile the watcher hints against the current workspace, graph any
   * confirmed external changes as isolated nodes, and run them through the
   * DriftEvaluator against the active plan (Phase 4 + Phase 5). This is both the
   * `confirmedWorkspaceChanges()` read surface and the turn-end automatic
   * reconcile — a finished turn reconciles so external edits are discovered,
   * graphed and drift-checked without an explicit call.
   */
  function reconcileWorkspaceObservation(exec?: SessionExecutionState): Promise<
    Array<{
      id: string;
      workspaceRoot: string;
      path: string;
      operation: "added" | "modified" | "deleted" | "renamed";
      origin:
        | "tool"
        | "sandbox_merge"
        | "checkpoint_rollback"
        | "external"
        | "unknown";
      attribution: "attributed" | "unattributed" | "indeterminate";
      correlation: {
        sessionID?: string;
        episodeID?: string;
        turnID?: string;
        callID?: string;
        operationID?: string;
      };
      health: "healthy" | "degraded" | "unavailable";
      at: string;
    }>
  > {
    return (async () => {
      if (ctx.ports.isDisposed()) return [];
      const { publishForSession } = ctx.ports;
      const workLedgerController =
        ctx.ports.resolveService<WorkLedgerController>(
          WORK_LEDGER_CONTROLLER_SERVICE,
        );
      if (!workLedgerController)
        throw new Error("work ledger unavailable (natalia-work-ledger)");
      const workspaceFilesController =
        ctx.ports.resolveService<WorkspaceFilesController>(
          WORKSPACE_FILES_SERVICE,
        );
      const target = exec;
      if (!target?.session || ctx.ports.isDisposed()) return [];
      let confirmed: Awaited<
        ReturnType<NonNullable<typeof workspaceFilesController>["reconcile"]>
      > = [];
      try {
        confirmed = (await workspaceFilesController?.reconcile()) ?? [];
      } catch (error) {
        if (ctx.ports.isDisposed()) return [];
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return [];
        throw error;
      }
      for (const change of confirmed) {
        if (change.attribution === "attributed") continue;
        publishForSession(
          target,
          workLedgerController.externalWorkspaceChangeNode({
            confirmedChangeID: change.id,
            path: change.path,
            sessionID: target.session.id,
          }),
        );
      }
      const activePlan = activePlanForExec(ctx, target);
      const objective = activePlan?.title ?? "";
      // EI Phase 2 机制 2: the L4 behaviour signals (no-progress window, failure
      // loop) run every turn-end, even when there were no workspace changes.
      const behavior = deriveDriftBehaviorSignals(target.session.events);
      if (confirmed.length) {
        // EI §8.1: the evaluator needs the R's evidence and constraint keys
        // (a/p/c — attribution/plan/constitution) so validated work is not
        // judged as drift. Wire the session's recorded evidence and the
        // constitution rules that apply to the changed paths.
        const evidenceRefs = projectedEvidenceRecords(
          target.session.events,
        ).map((record) => record.id);
        const applicableConstraints = projectedConstitutionRules(
          target.session.events,
        )
          .filter((rule) =>
            rule.appliesTo?.paths?.some((pattern) =>
              confirmed.some((change) => globPathMatch(pattern, change.path)),
            ),
          )
          .map((rule) => rule.ruleID);
        // EI Phase 2: the same matched rules, carrying enforcement, so a deny
        // hit opens a high constitution_conflict finding.
        const constitutionHits = projectedConstitutionRules(target.session.events)
          .filter((rule) =>
            rule.appliesTo?.paths?.some((pattern) =>
              confirmed.some((change) => globPathMatch(pattern, change.path)),
            ),
          )
          .map((rule) => ({
            ruleID: rule.ruleID,
            enforcement: rule.enforcement ?? "warn",
          }));
        // EI §8.6: the R is the accepted WorkContract — the evaluator judges
        // against the user-tier commitment when one exists.
        const contract = projectedWorkContracts(target.session.events).find(
          (candidate) => candidate.status === "current",
        );
        const driftSignal = {
          sessionID: target.session.id,
          turnID: target.activeTurnID,
          objective,
          currentActivity: confirmed
            .map((change) => `${change.operation}:${change.path}`)
            .join(", "),
          applicableConstraints,
          changes: confirmed.map((change) => ({
            path: change.path,
            action: change.operation,
          })),
          evidenceRefs,
          recentActions: behavior.recentActions,
          recentFailures: behavior.recentFailures,
          constitutionHits,
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
        };
        const findings = workLedgerController.evaluateDrift(driftSignal);
        for (const finding of findings) {
          publishForSession(target, finding);
          // EI §3.5 / Phase 2 B3: a warning/high finding is auto-injected into
          // the Main Agent's next step as an internal input, so the next
          // provider request must drift_acknowledge (explain/dispute), correct
          // the work, or detour_declare. advisory findings are noise-level and
          // are NOT injected. The text carries only the findingID, severity and
          // rule summary — never chain-of-thought.
          injectFindingIntoMainAgent(ctx, target, finding);
        }
        // EI Phase 2 判/问分离: with no accepted contract, a prose-relevance
        // mismatch is a 问 (ask), not a finding — inject it instead of opening
        // the false-positive-prone objective_activity_mismatch finding.
        const proseQuestion = proseRelevanceQuestion(driftSignal);
        if (proseQuestion)
          injectProseQuestion(ctx, target, proseQuestion, target.activeTurnID);
      } else {
        // No workspace changes this turn: still evaluate the behaviour signals so
        // a spinning or stuck agent opens a no-progress / failure-loop finding.
        const behaviorFindings = workLedgerController.evaluateBehaviorDrift({
          sessionID: target.session.id,
          turnID: target.activeTurnID,
          objective,
          currentActivity: "",
          applicableConstraints: [],
          changes: [],
          evidenceRefs: [],
          recentActions: behavior.recentActions,
          recentFailures: behavior.recentFailures,
        });
        for (const finding of behaviorFindings) {
          publishForSession(target, finding);
          injectFindingIntoMainAgent(ctx, target, finding);
        }
      }
      return confirmed;
    })();
  }
}
