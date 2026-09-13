import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import { memoryTrace } from "@natalia/runtime";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";
import { filterRuntimeRetainedEvents } from "./session-event-retention";

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
    memoryTrace("execution.fullEvents.start", {
      sessionID: exec.session.id,
      currentEvents: exec.session.events.length,
    });
    const full = await sessionStore.loadFullAsync(exec.session.id, {
      runtimeEvents: true,
    });
    exec.session.events = filterRuntimeRetainedEvents(
      full.events,
      sessionStore.status().mode,
      true,
    );
    exec.eventCount = exec.session.events.length;
    memoryTrace("execution.fullEvents.done", {
      sessionID: exec.session.id,
      events: exec.session.events.length,
    });
  })();
  exec.fullEventsPromise = promise.catch((error) => {
    exec.fullEventsPromise = undefined;
    throw error;
  });
  return exec.fullEventsPromise;
}
