import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import { memoryTrace } from "@natalia/runtime";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";
import {
  filterRuntimeRetainedEvents,
  maxLiveSessionEvents,
  windowRuntimeEvents,
} from "./session-event-retention";

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
  // The fast attach path seeds `session.events` with only the post-epoch tail
  // and sets `eventCount` to that tail length. Comparing `events.length` to
  // `eventCount` therefore cannot tell whether the complete durable log is
  // loaded. Consumers such as the Navi/Nia chat surfaces read this log directly
  // and saw an empty stream until the background full-load happened to finish.
  if (exec.fullEventsLoaded === true) return Promise.resolve();
  if (
    process.env.NATALIA_MEMORY_TRACE === "1" ||
    process.env.NATALIA_TRACE_FULL_EVENTS === "1"
  ) {
    const stack = new Error("full-events caller").stack
      ?.split("\n")
      .slice(1, 8)
      .join("\n");
    console.warn(`[full-events] caller session=${exec.session.id}\n${stack}`);
  }
  const promise = (async () => {
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
    exec.session.events = windowRuntimeEvents(
      filterRuntimeRetainedEvents(
        full.events,
        sessionStore.status().mode,
        true,
      ),
      maxLiveSessionEvents(),
    );
    exec.eventCount = exec.session.events.length;
    exec.fullEventsLoaded = true;
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
