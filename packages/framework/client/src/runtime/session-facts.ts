/**
 * Incremental hot memory for one execution — the client-side owner of
 * `SessionFactState`.
 *
 * The fact state is the in-memory half of the RINA memory tier: it keeps the
 * active-set facts (open drift, live constitution rules, un-terminated mailbox,
 * recent decisions, collab threads, turn status) without re-scanning the whole
 * journal. It is seeded lazily from `exec.session.events` and then maintained
 * in O(1) per durable event at the single event-sink choke point.
 *
 * Completeness matters: a fast-attach execution holds only the post-epoch tail,
 * so a state seeded from it is missing pre-epoch facts. `factStateComplete`
 * records which case we are in; consumers that need cross-history facts must
 * fall back to the full-history escape hatch while it is false.
 */
import {
  applySessionFactEvent,
  sessionFactStateFromEvents,
  type SessionFactState,
} from "@natalia/session";
import type { RuntimeEvent } from "@natalia/contracts";
import type { SessionExecutionState } from "./session-execution-state";

/** Lazily build (and memoize) the incremental fact state for an execution. */
export function ensureSessionFactState(
  exec: SessionExecutionState,
): SessionFactState {
  if (!exec.factState) seedSessionFactState(exec);
  return exec.factState!;
}

/** Re-seed after `exec.session.events` is replaced with a new base. */
export function reseedSessionFactState(
  exec: SessionExecutionState,
  complete = exec.fullEventsLoaded === true,
): SessionFactState {
  seedSessionFactState(exec, complete);
  return exec.factState!;
}

/** Feed one durable event already appended to `exec.session.events`. */
export function feedSessionFactState(
  exec: SessionExecutionState,
  event: RuntimeEvent,
): void {
  if (exec.factState) applySessionFactEvent(exec.factState, event);
}

function seedSessionFactState(
  exec: SessionExecutionState,
  complete = exec.fullEventsLoaded === true,
): void {
  exec.factState = sessionFactStateFromEvents(exec.session.events);
  exec.factStateComplete = complete;
}
