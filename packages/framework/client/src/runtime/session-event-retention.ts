import type { RuntimeEvent } from "@natalia/contracts";

export type SessionStoreMode = "json" | "sqlite";

/**
 * Events that are safe to keep in the live execution state.
 *
 * `session.snapshot` and `rollback.previewed` are live-only projections now:
 * they can be rebuilt/re-requested, and persisting them only bloats long
 * sessions and every full-session clone. `context.checkpoint` is retained only
 * when the store has no epoch baseline to recover from; SQLite stores the full
 * checkpoint in `context_epochs`, so the event payload is redundant there.
 */
export function isRuntimeRetainedEvent(
  event: RuntimeEvent,
  mode: SessionStoreMode,
  hasContextEpoch: boolean,
): boolean {
  if (event.type === "session.snapshot" || event.type === "rollback.previewed")
    return false;
  if (
    event.type === "context.checkpoint" &&
    mode === "sqlite" &&
    hasContextEpoch
  )
    return false;
  return true;
}

export function filterRuntimeRetainedEvents(
  events: RuntimeEvent[],
  mode: SessionStoreMode,
  hasContextEpoch: boolean,
): RuntimeEvent[] {
  return events.filter((event) =>
    isRuntimeRetainedEvent(event, mode, hasContextEpoch),
  );
}
