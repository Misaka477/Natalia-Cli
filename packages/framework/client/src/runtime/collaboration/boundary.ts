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
import { projectedMailboxMessages, projectedPlans } from "@natalia/session";
import { buildMailboxStatus } from "@natalia/runtime-services";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_FILES_SERVICE,
  type WorkLedgerController,
  type WorkspaceFilesController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";

export function createCollaborationBoundary(ctx: RuntimeContext) {
  return {
    settleMailboxAtBoundary,
    acknowledgeDeliveredMailboxAtBoundary,
    deliverQueuedMailboxAtBoundary,
    takeLiveUserMessages,
    activateQueuedPlanAtBoundary,
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
    const { getActiveExec, publishForSession, nextMailboxSequence } = ctx.ports;
    const target = exec ?? getActiveExec();
    if (!target?.session) return;
    const delivered = projectedMailboxMessages(target.session.events).filter(
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
    const { getActiveExec, publishForSession, nextMailboxSequence } = ctx.ports;
    const target = exec ?? getActiveExec();
    if (!target?.session) return;
    const queued = projectedMailboxMessages(target.session.events).filter(
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
    const target = exec ?? ctx.ports.getActiveExec();
    if (!target?.session) return [];
    deliverQueuedMailboxAtBoundary(target);
    const injected = target.injectedMailboxIDs;
    const fresh = projectedMailboxMessages(target.session.events).filter(
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
   * P8 C4: promotes the queued-next plan to active at the turn safe boundary.
   * §6.5: after the active plan reaches a safe finish, the accepted queued plan
   * activates and the next Main Agent turn carries it. Projection-driven: only
   * a plan still `queued_next_plan` is promoted, and one per boundary, so an
   * already-active plan is never re-activated.
   */
  function activateQueuedPlanAtBoundary(exec?: SessionExecutionState) {
    const { getActiveExec, publishForSession } = ctx.ports;
    const workLedgerController = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!workLedgerController)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    const target = exec ?? getActiveExec();
    if (!target?.session) return;
    const queued = projectedPlans(target.session.events).find(
      (plan) => plan.status === "queued_next_plan",
    );
    if (!queued) return;
    publishForSession(
      target,
      workLedgerController.buildPlanTransition({
        id: `${queued.planID}:activated:${queued.version + 1}`,
        planID: queued.planID,
        version: queued.version + 1,
        transition: "activated",
        at: new Date().toISOString(),
      }),
    );
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
      const { getActiveExec, publishForSession } = ctx.ports;
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
      const target = exec ?? getActiveExec();
      if (!target?.session) return [];
      const confirmed = (await workspaceFilesController?.reconcile()) ?? [];
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
      if (confirmed.length) {
        const activePlan = projectedPlans(target.session.events).find(
          (plan) => plan.status === "active",
        );
        const objective = activePlan?.objective ?? "";
        const applicableConstraints = activePlan?.constraints ?? [];
        if (objective || applicableConstraints.length) {
          const findings = workLedgerController.evaluateDrift({
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
            evidenceRefs: [],
          });
          for (const finding of findings) publishForSession(target, finding);
        }
      }
      return confirmed;
    })();
  }
}
