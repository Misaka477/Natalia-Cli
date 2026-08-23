import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<RuntimeServiceClient, "pause" | "resume">;
export function createTurnControlSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    pause(reason = "user pause") {
      // Refusing is a value: a caller that gets `paused: true` when nothing was
      // paused has been told the turn is held when it is not.
      const exec = ctx.ports.getActiveExec();
      if (!exec?.lastSubmitted)
        return { paused: false, reason: "no turn has been submitted" };
      if (exec.paused) return { paused: true, reason: "already paused" };
      exec.paused = true;
      ctx.ports.setPaused(true);
      ctx.ports.publish({
        type: "turn.paused",
        id: exec.lastSubmitted.id,
        reason,
      });
      ctx.ports.publish({
        type: "status.update",
        status: "paused",
        detail: reason,
      });
      return { paused: true };
    },
    resume() {
      const exec = ctx.ports.getActiveExec();
      if (!exec?.lastSubmitted)
        return { resumed: false, reason: "no turn has been submitted" };
      if (!exec.paused)
        return { resumed: false, reason: "the turn is not paused" };
      exec.paused = false;
      ctx.ports.setPaused(false);
      const waiters = exec.pauseWaiters;
      exec.pauseWaiters = [];
      for (const resolveWaiter of waiters) resolveWaiter();
      ctx.ports.publish({ type: "turn.resumed", id: exec.lastSubmitted.id });
      ctx.ports.publish({
        type: "status.update",
        status: "running",
        detail: "resumed",
      });
      return { resumed: true };
    },
  };
}
