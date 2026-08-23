import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeEvent } from "@natalia/contracts";
import { sessionRunCoordinator } from "@natalia/session";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  | "service"
  | "start"
  | "submit"
  | "cancel"
  | "snapshot"
  | "diagnostic"
  | "lastSubmission"
  | "respondApproval"
  | "respondQuestion"
>;
export function createCoreSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async service<T>(name: string) {
      await ctx.ports.ensureReady();
      return ctx.ports.getCapabilityRegistry().service<T>(name);
    },
    start(onEvent, startOptions) {
      ctx.ports.setSink(onEvent);
      ctx.ports.setReplayMode(startOptions?.replay ?? "all");
      // Idempotent: a second subscriber (e.g. the transport server attaching
      // its event sink after the TUI) must not re-run initialize. Re-running
      // it opened a second sqlite connection and a second workspace watcher,
      // which on Windows fails the sqlite open and leaks the first watcher,
      // keeping the process alive after dispose.
      void ctx.ports.ensureReady();
    },
    async submit(text) {
      return await ctx.ports.submitInput({ text });
    },
    cancel(reason = "user cancel") {
      const cancelledSessionID = ctx.ports.getSessionID();
      const coordinator = sessionRunCoordinator(cancelledSessionID);
      const cancelledExec = ctx.ports.getActiveExec();
      const runningTurnID = cancelledExec?.activeTurnID;
      const pendingTurnID = runningTurnID
        ? undefined
        : cancelledExec?.lastSubmitted?.id;
      const pendingSessionID = pendingTurnID
        ? (ctx.ports.getTurnSession().get(pendingTurnID) ?? cancelledSessionID)
        : undefined;
      const pendingSession = pendingTurnID
        ? (ctx.ports.getExecutionBySession().get(pendingSessionID!)?.session ??
          ctx.ports.getSession())
        : undefined;
      const pendingInput = pendingSession?.inbox?.find(
        (input) => input.id === pendingTurnID && !input.promotedAt,
      );
      if (pendingInput && pendingSession) {
        pendingSession.inbox = pendingSession.inbox?.filter(
          (input) => input.id !== pendingTurnID,
        );
        if (cancelledExec && cancelledExec.lastSubmitted?.id === pendingTurnID)
          cancelledExec.lastSubmitted = undefined;
      }
      if (cancelledExec) cancelledExec.paused = false;
      ctx.ports.setPaused(false);
      const waiters =
        cancelledExec?.pauseWaiters ?? ctx.ports.getPauseWaiters();
      if (cancelledExec) cancelledExec.pauseWaiters = [];
      else ctx.ports.setPauseWaiters([]);
      for (const resolveWaiter of waiters) resolveWaiter();
      cancelledExec?.activeAbort?.abort(reason);
      const cancelledTurnID =
        runningTurnID ??
        pendingInput?.id ??
        (coordinator.active ? cancelledExec?.lastSubmitted?.id : undefined);
      if (cancelledTurnID)
        ctx.ports.publish({
          type: "turn.cancelled",
          id: cancelledTurnID,
          reason,
        });
      void (async () => {
        if (pendingInput)
          await ctx.ports
            .getTurnController()
            .persistPromotion(pendingSessionID!);
        await coordinator.interrupt();
        // `interrupt` intentionally clears stale wakeups. A prompt admitted with
        // queue delivery is durable work, not a stale wakeup, so start a fresh
        // drain after cancellation to promote it at the new idle boundary.
        await coordinator.wake(
          ctx.ports.drainSessionFor(pendingSessionID ?? cancelledSessionID),
        );
      })().catch((error) =>
        ctx.ports.publishForSession(cancelledExec, {
          type: "diagnostic",
          level: "warning",
          message: `session cancellation cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    },
    snapshot() {
      const event: RuntimeEvent = {
        type: "snapshot.created",
        id: `snap_${Date.now().toString(36)}`,
        files: [],
      };
      ctx.ports.publish(event);
      return event;
    },
    diagnostic(message, level = "warning") {
      ctx.ports.publish({ type: "diagnostic", level, message });
    },
    lastSubmission() {
      return ctx.ports.getActiveExec()?.lastSubmitted;
    },
    async respondApproval(response) {
      await ctx.ports.getReady();
      return ctx.ports.getInteractive().respondApproval(response);
    },
    async respondQuestion(response) {
      await ctx.ports.getReady();
      return ctx.ports.getInteractive().respondQuestion(response);
    },
  };
}
