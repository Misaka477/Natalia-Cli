import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";

/**
 * Load the full durable event log into an execution state.
 *
 * The fast attach path may initially provide only the context tail. Consumers
 * that need the complete transcript/history must call this before reading
 * `exec.session.events`. The promise is memoized per execution so concurrent
 * callers share one load.
 */
export function ensureSessionFullEvents(
  ctx: RuntimeContext,
  exec: SessionExecutionState,
): Promise<void> {
  if (exec.fullEventsPromise) return exec.fullEventsPromise;
  const promise = (async () => {
    if (exec.eventCount === undefined) return;
    if (exec.session.events.length >= exec.eventCount) return;
    const sessionStore = ctx.ports.resolveService<SessionStoreController>(
      SESSION_STORE_CONTROLLER_SERVICE,
    );
    if (!sessionStore)
      throw new Error("session store unavailable (natalia-session-store)");
    const full = await sessionStore.load(exec.session.id);
    exec.session.events = full.session.events;
    exec.eventCount = full.session.events.length;
  })();
  exec.fullEventsPromise = promise.catch((error) => {
    exec.fullEventsPromise = undefined;
    throw error;
  });
  return exec.fullEventsPromise;
}
