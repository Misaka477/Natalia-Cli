/**
 * Event publishing choke point — runtime/event-sink module.
 *
 * `publish` and `publishForSession` are the single writers of the runtime event
 * stream: they stamp episode/session ids, bucket diagnostics, track live output
 * and active tools, dispatch to plugins, push to the sink, persist durable
 * events, and trigger session snapshots and safe-boundary settlement. Reads
 * everything it needs from `RuntimeContext` at call time.
 */
import { appendSessionEvent } from "@natalia/session";
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
      activateQueuedPlanAtBoundary,
      reconcileWorkspaceObservation,
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
      const sessionSnapshot = structuredClone(exec.session);
      const sessionPersistence = getSessionPersistence();
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
      setSessionPersistence(next);
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
      // P8 C4: a finished turn is also the safe completion point for the active
      // plan (§6.5 — "A reaches completed / paused / designated safe finish").
      // Promote the queued-next plan to active so the next turn carries it.
      // `plan.activated` is not a trigger, so this cannot recurse.
      activateQueuedPlanAtBoundary(exec);
      // WG4: a finished turn is a natural reconcile point — discover external
      // edits the watcher saw, graph them as isolated nodes, and drift-check
      // them against the active plan. No explicit call needed.
      void reconcileWorkspaceObservation(exec);
    }
  }
}
