/**
 * Event publishing choke point — runtime/event-sink module.
 *
 * `publish` and `publishForSession` are the single writers of the runtime event
 * stream: they stamp episode/session ids, bucket diagnostics, track live output
 * and active tools, dispatch to plugins, push to the sink, persist durable
 * events, and trigger session snapshots and safe-boundary settlement. Reads
 * everything it needs from `RuntimeContext` at call time.
 */
import {
  appendSessionEvent,
  projectedChatMessages,
  projectedPlanDocs,
} from "@natalia/session";
import { runtimeEventDurability } from "@natalia/contracts";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import type { RuntimeEvent } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";
import type { RealRuntimeClientOptions } from "./options";

type RuntimeDiagnostic = Extract<RuntimeEvent, { type: "diagnostic" }> & {
  at: string;
};

export function createEventSink(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    publish,
    publishForSession,
  };

  function publish(event: RuntimeEvent) {
    publishForSession(ctx.ports.getActiveExec(), event);
  }

  function publishForSession(
    exec: SessionExecutionState | undefined,
    event: RuntimeEvent,
  ) {
    const {
      getSink,
      getSessionPersistence,
      setSessionPersistence,
      setPendingHumanTerminal,
      maybeContinueAfterHumanInput,
      settleMailboxAtBoundary,
      reconcileWorkspaceObservation,
      requestNaviWake,
      toolEventTurnID,
      isSessionSnapshotTrigger,
      publishSessionSnapshot,
      getPluginsController,
    } = ctx.ports;
    const {
      runtimeDiagnosticsBySession,
      runtimeDiagnostics,
      liveMainOutputByTurn,
      turnSession,
      activeToolByTurn,
      performanceTrace,
    } = ctx.state;
    const sink = getSink();
    const publishStartedAt = performance.now();
    if (options.episodeID && !event.episodeID)
      event = { ...event, episodeID: options.episodeID };
    // D6: while a session is active every event belongs to it. Events that
    // already carry a session id keep their own; events published before the
    // session exists are runtime-level and reach every subscriber. The stamp
    // follows the exec the event is published for — a background turn stamps
    // its own session even when the UI is attached to another.
    if (exec?.session && event.sessionID === undefined)
      event = { ...event, sessionID: exec.session.id };
    if (event.type === "diagnostic")
      event = { ...event, at: event.at ?? new Date().toISOString() };
    if (event.type === "diagnostic") {
      const diagnostic = {
        ...event,
        at: event.at ?? new Date().toISOString(),
      } as RuntimeDiagnostic;
      const bucketID = exec?.session.id ?? event.sessionID;
      if (bucketID) {
        const bucket = runtimeDiagnosticsBySession.get(bucketID) ?? [];
        bucket.push(diagnostic);
        if (bucket.length > 500) bucket.splice(0, 1);
        runtimeDiagnosticsBySession.set(bucketID, bucket);
      } else {
        runtimeDiagnostics.push(diagnostic);
        if (runtimeDiagnostics.length > 500) runtimeDiagnostics.splice(0, 1);
      }
    }
    if (!event.agentID && event.type === "content.delta") {
      const current = liveMainOutputByTurn.get(event.id) ?? "";
      liveMainOutputByTurn.set(
        event.id,
        `${current}${event.text}`.slice(-8000),
      );
    }
    // TERM-M.3 (c): a turn that ended as waiting_human persists the typed
    // pending-human state and clears the turn-level marker.
    if (
      !event.agentID &&
      event.type === "turn.finished" &&
      event.stopReason === "waiting_human"
    ) {
      const pending = exec?.endTurnWaitingHuman;
      if (exec) exec.endTurnWaitingHuman = undefined;
      turnSession.delete(event.id);
      if (pending && exec?.session)
        void setPendingHumanTerminal(exec.session.id, pending);
    } else if (!event.agentID && event.type === "turn.finished") {
      // Any other settlement discards a stale marker: a request_human call
      // from a turn that later failed must not bleed into the next turn.
      if (exec) exec.endTurnWaitingHuman = undefined;
      turnSession.delete(event.id);
    }
    // TERM-M.3 (c): when the human releases the requested pane, the runtime
    // starts the continuation turn automatically. Replay never passes through
    // publish, so a replayed detach cannot double-resume.
    if (
      !event.agentID &&
      event.type === "terminal.timeline" &&
      event.actor === "user" &&
      event.action === "detach"
    )
      void maybeContinueAfterHumanInput(
        event.id,
        exec?.session.id ?? event.sessionID,
      );
    if (
      exec?.session &&
      !event.agentID &&
      event.type !== "session.created" &&
      event.type !== "session.ready" &&
      runtimeEventDurability(event) === "durable"
    ) {
      appendSessionEvent(exec.session, event);
      const sessionStoreController =
        ctx.ports.resolveService<SessionStoreController>(
          SESSION_STORE_CONTROLLER_SERVICE,
        );
      if (!sessionStoreController)
        throw new Error("session store unavailable (natalia-session-store)");
      if (!sessionStoreController.status().initialized) {
        return;
      }
      const sessionSnapshot = { ...exec.session };
      const sessionPersistence = ctx.ports.getSessionPersistenceForSession(
        exec.session.id,
      );
      const next = sessionPersistence
        .then(() => {
          if (sessionStoreController.status().initialized)
            return sessionStoreController.appendEvent(sessionSnapshot, event);
        })
        .catch((error) => {
          sink?.({
            type: "diagnostic",
            level: "warning",
            message: `session persistence deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        });
      ctx.ports.setSessionPersistenceForSession(exec.session.id, next);
      setSessionPersistence(
        Promise.allSettled([getSessionPersistence(), next]).then(
          () => undefined,
        ),
      );
    }
    const pluginStartedAt = performance.now();
    if (!event.agentID) getPluginsController().dispatch(event);
    const pluginMs = performance.now() - pluginStartedAt;
    const sinkStartedAt = performance.now();
    sink?.(event);
    const sinkMs = performance.now() - sinkStartedAt;
    performanceTrace.record(event, {
      publishMs: performance.now() - publishStartedAt,
      pluginMs,
      sinkMs,
    });
    // P8 C1 writer: keep the live work-state tracking current and publish a
    // session intelligence snapshot at work-state boundaries. `session.snapshot`
    // is not a trigger, so the snapshot's own publish cannot recurse here.
    if (!event.agentID && event.type === "tool.update") {
      const turnID = toolEventTurnID(event);
      if (event.status === "running") activeToolByTurn.set(turnID, event.name);
      else if (
        ["succeeded", "failed", "rejected", "cancelled"].includes(event.status)
      )
        activeToolByTurn.delete(turnID);
    }
    if (!event.agentID && isSessionSnapshotTrigger(event))
      publishSessionSnapshot(exec);
    if (
      !event.agentID &&
      (event.type === "turn.finished" || event.type === "turn.cancelled")
    )
      liveMainOutputByTurn.delete(event.id);
    // P8 C3 safe-boundary scheduler: a finished turn is a safe point (§5.2 —
    // "step complete"). Deliver every queued mailbox message so the main agent
    // sees user intents at the boundary, never mid-token. `mailbox.delivered`
    // is not a trigger, so this cannot recurse. Only a turn that finished on
    // purpose is a settlement: a cancelled/aborted/error turn did not complete
    // its context, so its delivered intents stay delivered for another chance.
    if (
      !event.agentID &&
      event.type === "turn.finished" &&
      exec?.session &&
      event.stopReason === "error"
    ) {
      exec.advisorPending = true;
      console.log("[navi-wake-trigger] main turn error");
      requestNaviWake(exec);
    }
    if (
      !event.agentID &&
      event.type === "chat.turn.finished" &&
      event.channel === "nia" &&
      event.stopReason === "done" &&
      exec?.session
    ) {
      const niaMessages = projectedChatMessages(exec.session.events).filter(
        (message) => message.channel === "nia",
      );
      const last = niaMessages[niaMessages.length - 1];
      const niaAuditWake = exec.session.events.some(
        (candidate) =>
          candidate.type === "chat.turn.started" &&
          candidate.messageID === event.messageID &&
          candidate.internal === true,
      );
      const auditReported = exec.session.events.some(
        (candidate) =>
          candidate.type === "chat.tool.used" &&
          candidate.messageID === event.messageID &&
          candidate.toolName === "audit_report",
      );
      const niaCollabSent = exec.session.events.some(
        (candidate) =>
          candidate.type === "chat.tool.used" &&
          candidate.messageID === event.messageID &&
          candidate.toolName === "collab_chat",
      );
      const auditReportEvent = exec.session.events.find(
        (
          candidate,
        ): candidate is Extract<RuntimeEvent, { type: "chat.tool.used" }> =>
          candidate.type === "chat.tool.used" &&
          candidate.messageID === event.messageID &&
          candidate.toolName === "audit_report",
      );
      let auditSummary = last?.text ?? "";
      if (auditReportEvent?.argumentsRaw) {
        try {
          const args = JSON.parse(auditReportEvent.argumentsRaw) as {
            gaps?: string[];
          };
          if (Array.isArray(args.gaps) && args.gaps.length) {
            auditSummary += `\n\nGap list from audit_report:\n${args.gaps
              .map((gap, index) => `${index + 1}. ${gap}`)
              .join("\n")}`;
          }
        } catch {
          // Keep the natural-language fallback if arguments are not JSON.
        }
      }
      // Nia's audit wake usually goes through collab_chat or audit_report.
      // Always forward when audit_report was used, even for a manually started
      // Nia audit, because that report has already changed the plan lifecycle.
      // Only skip when Nia actively used collab_chat, so the formal audit
      // message is not duplicated.
      const shouldForwardAudit = niaAuditWake || auditReported;
      console.log("[nia-audit-tail]", {
        messageID: event.messageID,
        niaAuditWake,
        auditReported,
        niaCollabSent,
        shouldForwardAudit,
        forwarded: Boolean(last && shouldForwardAudit && !niaCollabSent),
        lastText: last?.text.slice(0, 120),
      });
      if (last && shouldForwardAudit && !niaCollabSent) {
        const wakeID = `turn_nia_${event.messageID.replace(/[^a-zA-Z0-9]/gu, "_")}`;
        ctx.ports.scheduleInternalWake(exec, {
          id: wakeID,
          text: `(internal Nia audit result: ${auditSummary}. This is internal context for you and the user. Do not forward it to Navi; act on the findings directly.)`,
          delivery: "steer",
        });
      }
      // If Nia did not call audit_report, fall back to known audit phrasing so
      // the plan lifecycle still closes even when the model forgets the tool.
      if (last && niaAuditWake && !auditReported) {
        const auditDone =
          /全部完成|全部通过|没有缺口|已完成|audit_passed|no gaps|all done/iu.test(
            last.text,
          );
        const active = projectedPlanDocs(exec.session.events).filter(
          (plan) =>
            plan.status === "handed_off" ||
            plan.status === "executing" ||
            plan.status === "awaiting_audit" ||
            plan.status === "auditing" ||
            plan.status === "audit_gaps",
        );
        for (const plan of active) {
          void ctx.ports.planDocRuntime.planDocUpdateStatus({
            planID: plan.planID,
            status: auditDone ? "completed" : "audit_gaps",
            sessionID: exec.session.id,
          });
        }
      }
    }
    if (
      !event.agentID &&
      event.type === "turn.finished" &&
      event.stopReason === "done"
    ) {
      // P8 C3 safe-boundary scheduler: a finished turn is a safe point (§5.2 —
      // "step complete"). Delivery is consumption-driven, not model-discipline-
      // driven: messages delivered at the previous boundary were injected into
      // this turn's context, so a normal turn finish acknowledges them (they no
      // longer re-inject); messages still queued are delivered for the next
      // turn. The order matters — acknowledge the already-delivered batch before
      // delivering the queued batch, so a fresh delivery is not mis-acked.
      settleMailboxAtBoundary(exec);
      // Runtime-owned plan lifecycle: after Natalia finishes, promote any
      // executed plan to awaiting_audit. planDocUpdateStatus itself wakes Nia,
      // so this never depends on the model remembering to call a status tool.
      if (exec?.session) {
        const activePlans = projectedPlanDocs(exec.session.events).filter(
          (plan) =>
            plan.status === "handed_off" ||
            plan.status === "executing" ||
            plan.status === "audit_gaps",
        );
        for (const plan of activePlans)
          void ctx.ports.planDocRuntime.planDocUpdateStatus({
            planID: plan.planID,
            status: "awaiting_audit",
            sessionID: exec.session.id,
          });
      }
      // WG4: a finished turn is a natural reconcile point — discover external
      // edits the watcher saw, graph them as isolated nodes, and drift-check
      // them against the active plan. No explicit call needed.
      void reconcileWorkspaceObservation(exec).catch((error) => {
        if (ctx.ports.isDisposed()) return;
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return;
        publishForSession(exec, {
          type: "diagnostic",
          level: "warning",
          message: `workspace observation reconcile failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      });
    }
  }
}
