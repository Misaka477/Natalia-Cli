import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import { runtimeEventSessionSeq, type RuntimeEvent } from "@natalia/contracts";
import { ensureSessionFullEvents } from "./session-full-events";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./session-execution-state";
import {
  SessionWindow,
  type SessionWindowEntry,
  type SessionWindowLoader,
} from "./session-window";

const DEFAULT_EVENT_WINDOW_PAGE = 2_000;

function storeLoader(
  store: SessionStoreController,
  exec: SessionExecutionState,
  limit: number,
): SessionWindowLoader<SessionWindowEntry<RuntimeEvent>> {
  const mapPage = (
    page: Awaited<ReturnType<SessionStoreController["eventWindow"]>>,
  ) => {
    let next = 1;
    return {
      events: page.events.map((entry) => {
        const seq = entry.sessionSeq ?? next;
        next = seq + 1;
        return { seq, event: entry.event } as SessionWindowEntry<RuntimeEvent>;
      }),
      hasMore: page.hasMore,
    };
  };
  return {
    loadTail: async () =>
      mapPage(
        await store.eventWindow(exec.session.id, exec.session.events, {
          limit,
        }),
      ),
    loadBefore: async (beforeSeq) =>
      mapPage(
        await store.eventWindow(exec.session.id, exec.session.events, {
          beforeSeq,
          limit,
        }),
      ),
  };
}

/**
 * Lazily create the one per-session event window used by secondary surfaces.
 *
 * The full journal remains reachable through ensureSessionFullEvents(); this
 * helper is the normal path for chat/subagent/tool projections that only need
 * the current tail and can page older later.
 */
function hasSequenceGap(
  exec: SessionExecutionState,
  window: SessionWindow<SessionWindowEntry<RuntimeEvent>>,
): boolean {
  const seqs = new Set<number>();
  for (const entry of window.eventsView) seqs.add(entry.seq);
  for (const event of exec.session.events) {
    const seq = runtimeEventSessionSeq(event);
    if (seq !== undefined) seqs.add(seq);
  }
  const sorted = [...seqs].sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index] !== sorted[index - 1]! + 1) return true;
  }
  return false;
}

export async function ensureSessionEventWindow(
  ctx: RuntimeContext,
  exec: SessionExecutionState,
  limit = DEFAULT_EVENT_WINDOW_PAGE,
): Promise<SessionWindow<SessionWindowEntry<RuntimeEvent>> | undefined> {
  if (exec.fullEventsLoaded) return undefined;
  const store = ctx.ports.resolveService<SessionStoreController>(
    SESSION_STORE_CONTROLLER_SERVICE,
  );
  if (!store) return undefined;
  const existing = exec.eventWindow;
  if (existing && existing.openState === "open") {
    if (!hasSequenceGap(exec, existing)) return existing;
    exec.eventWindow = undefined;
    await ensureSessionFullEvents(ctx, exec);
    return undefined;
  }
  const window =
    existing ??
    new SessionWindow<SessionWindowEntry<RuntimeEvent>>({
      loader: storeLoader(store, exec, limit),
    });
  exec.eventWindow = window;
  await window.open();
  // A live event may have landed before the first secondary read created the
  // window. Replay the hidden-seq events already resident in the execution so
  // the window covers the same prefix the chat/subagent projection sees.
  for (const event of exec.session.events) {
    const seq = runtimeEventSessionSeq(event);
    if (seq !== undefined) window.acceptLive({ seq, event });
  }
  if (hasSequenceGap(exec, window)) {
    exec.eventWindow = undefined;
    await ensureSessionFullEvents(ctx, exec);
    return undefined;
  }
  return window;
}

/** Feed one durable live event into the shared window, when it exists. */
export function feedSessionEventWindow(
  exec: SessionExecutionState,
  seq: number,
  event: RuntimeEvent,
): void {
  exec.eventWindow?.acceptLive({ seq, event });
}

/**
 * Merge the persisted window with durable live events already resident in the
 * execution. The persistence queue can lag a just-finished turn, so a read
 * must not discard the live tail merely because the window page is older.
 */
export function sessionWindowEvents(
  exec: SessionExecutionState,
  window: SessionWindow<SessionWindowEntry<RuntimeEvent>>,
): RuntimeEvent[] {
  const bySeq = new Map<number, RuntimeEvent>();
  for (const entry of window.eventsView) bySeq.set(entry.seq, entry.event);
  for (const event of exec.session.events) {
    const seq = runtimeEventSessionSeq(event);
    if (seq !== undefined && !bySeq.has(seq)) bySeq.set(seq, event);
  }
  const result = [...bySeq.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, event]) => event);
  return result;
}
