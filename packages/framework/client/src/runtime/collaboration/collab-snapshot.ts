/**
 * Collaboration snapshot cache — runtime/collaboration/collab-snapshot.ts.
 *
 * `projectedCollabMessages()` and `projectedPlanDocs()` are O(events) pure
 * projections. They are used synchronously by turn-runner / chat-prompt /
 * event-sink, so on heavy sessions they can block the runtime event loop.
 *
 * This module keeps a main-thread snapshot per session. The worker recomputes
 * the projections in the background and replaces the snapshot atomically; the
 * synchronous consumers keep reading a plain object from `exec.collabSnapshot`.
 */
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import {
  projectedCollabMessages,
  projectedMailboxMessages,
  projectedPlanDocs,
} from "@natalia/session";
import { computeCollabSnapshotInWorker } from "../session-project-client";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";
import type { CollabSnapshot } from "../session-execution-state";

const SNAPSHOT_DEBOUNCE_MS = 80;

export type CollabSnapshotScheduler = {
  schedule: (exec: SessionExecutionState) => void;
  dispose: () => void;
};

export function createCollabSnapshotScheduler(
  ctx: RuntimeContext,
): CollabSnapshotScheduler {
  const revisions = new Map<SessionID, number>();
  const timers = new Map<SessionID, ReturnType<typeof setTimeout>>();

  function schedule(exec: SessionExecutionState) {
    if (ctx.ports.isDisposed()) return;
    const sessionID: SessionID = exec.session.id;
    const next = (revisions.get(sessionID) ?? 0) + 1;
    revisions.set(sessionID, next);
    if (process.env.NATALIA_PERF_VERBOSE === "1")
      console.warn(
        `[perf] collabSnapshot.schedule session=${sessionID} revision=${next}`,
      );
    const existing = timers.get(sessionID);
    if (existing) clearTimeout(existing);
    timers.set(
      sessionID,
      setTimeout(() => {
        timers.delete(sessionID);
        void flush(sessionID, next);
      }, SNAPSHOT_DEBOUNCE_MS),
    );
  }

  async function flush(sessionID: SessionID, revision: number) {
    if (ctx.ports.isDisposed()) return;
    const exec = ctx.ports.getExecutionBySession().get(sessionID);
    if (!exec) return;
    const events = exec.session.events;
    const start = performance.now();
    try {
      const computed = await computeCollabSnapshotInWorker(events);
      commit(sessionID, revision, computed);
      console.warn(
        `[perf] collabSnapshot.commit session=${sessionID} revision=${revision} events=${events.length} collab=${computed.collabMessages.length} plans=${computed.planDocs.length} +${(performance.now() - start).toFixed(1)}ms worker`,
      );
    } catch {
      // Worker failure must never take the collaboration surfaces offline.
      const computed: CollabSnapshot = {
        collabMessages: projectedCollabMessages(events),
        planDocs: projectedPlanDocs(events),
        mailboxMessages: projectedMailboxMessages(events),
        revision,
        eventCount: events.length,
      };
      commit(sessionID, revision, computed);
      console.warn(
        `[perf] collabSnapshot.commit session=${sessionID} revision=${revision} events=${events.length} collab=${computed.collabMessages.length} plans=${computed.planDocs.length} +${(performance.now() - start).toFixed(1)}ms fallback`,
      );
    }
  }

  function commit(
    sessionID: SessionID,
    revision: number,
    snapshot: CollabSnapshot,
  ) {
    // If a newer revision was scheduled while the worker was running, discard
    // this stale result; the newer timer will replace it.
    if (revisions.get(sessionID) !== revision) return;
    const exec = ctx.ports.getExecutionBySession().get(sessionID);
    if (!exec) return;
    exec.collabSnapshot = {
      ...snapshot,
      revision,
      eventCount: exec.session.events.length,
    };
  }

  function dispose() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    revisions.clear();
  }

  return { schedule, dispose };
}

export function isCollabSnapshotRelevantEvent(event: RuntimeEvent): boolean {
  return event.type.startsWith("collab.") || event.type.startsWith("plan.doc.");
}
