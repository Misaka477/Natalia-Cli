/**
 * Session Intelligence snapshot builder.
 *
 * P8 C1 shipped the read model — the `session.snapshot` event, its projector
 * (`latestSessionSnapshot`), the RPC/SDK query and the TUI dialog — but nothing
 * in production ever published the event, so every query answered `undefined`
 * and the dialog said "No snapshot available". This module is the writer's pure
 * half: it derives the journal-backed fields (changed files, unvalidated
 * changes, recent output) from the session's durable events and assembles the
 * event. The live half (agent status, active tool, PTY/sandbox presence) comes
 * from the runtime through `live`, so the builder itself stays testable without
 * a running runtime.
 *
 * Two rules shape it, following the work-graph writer's:
 *
 * 1. **Counts and safe strings only.** `changedFiles`/`unvalidatedChanges` are
 *    numbers; `recentOutput` is the last confirmed assistant output, bounded to
 *    the schema's 2000-character cap. File contents, tool arguments, command
 *    text and results never enter the snapshot.
 * 2. **Derived from durable events.** Changed files are counted from the
 *    `workspace_change` Work Graph nodes the runtime already writes; validated
 *    changes come from `evidence.recorded` events (none exist yet, so all
 *    changes are unvalidated — that is the honest answer, not a bug).
 */
import type { RuntimeEvent } from "@natalia/contracts";

export type SessionIntelligenceLive = {
  agentStatus: string;
  currentStep?: string;
  activeTool?: string;
};

/** The changed workspace files, as recorded by the Work Graph writer. */
export function countChangedFiles(events: RuntimeEvent[]): number {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workgraph.node_added" }> =>
      event.type === "workgraph.node_added" &&
      event.kind === "workspace_change",
  ).length;
}

/** Changes backed by `evidence.recorded` events. Zero today: no evidence writer. */
export function countValidatedChanges(events: RuntimeEvent[]): number {
  return events
    .filter(
      (event): event is Extract<RuntimeEvent, { type: "evidence.recorded" }> =>
        event.type === "evidence.recorded",
    )
    .reduce((sum, event) => sum + (event.changes?.length ?? 0), 0);
}

/** The last confirmed assistant output, if any, before the snapshot moment. */
export function latestConfirmedOutput(
  events: RuntimeEvent[],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event && event.type === "content.done" && event.text) return event.text;
  }
  return undefined;
}

/**
 * Whether a live PTY exists, derived from the durable `terminal.timeline`
 * journal. A pane is live when its last timeline action is not `exit`; a start
 * publishes `started`/`created`, a stop publishes `exit`, and intermediate
 * actions (`write`, `attach`, `secure_input`, …) only happen while the pane
 * exists. Journal-derived so replay answers the same way the live moment did.
 */
export function hasLivePTY(events: RuntimeEvent[]): boolean {
  const latestAction = new Map<string, string>();
  for (const event of events) {
    if (event.type === "terminal.timeline")
      latestAction.set(event.id, event.action);
  }
  return [...latestAction.values()].some((action) => action !== "exit");
}

/**
 * Whether a live sandbox exists, derived from the durable `sandbox.update`
 * journal. A sandbox is live when its latest status is not a terminal one
 * (`deleted`/`stopped`/`failed`); creation publishes `created`, deletion
 * publishes `deleted`. Journal-derived so replay answers the same way.
 */
export function hasLiveSandbox(events: RuntimeEvent[]): boolean {
  const latestStatus = new Map<string, string>();
  for (const event of events) {
    if (event.type === "sandbox.update")
      latestStatus.set(event.id, event.status);
  }
  return [...latestStatus.values()].some(
    (status) =>
      status !== "deleted" && status !== "stopped" && status !== "failed",
  );
}

export function buildSessionIntelligenceSnapshot(input: {
  id: string;
  events: RuntimeEvent[];
  live: SessionIntelligenceLive;
}): Extract<RuntimeEvent, { type: "session.snapshot" }> {
  const changedFiles = countChangedFiles(input.events);
  const validated = countValidatedChanges(input.events);
  const output = latestConfirmedOutput(input.events);
  return {
    type: "session.snapshot",
    id: input.id,
    agentStatus: input.live.agentStatus,
    ...(input.live.currentStep ? { currentStep: input.live.currentStep } : {}),
    ...(input.live.activeTool ? { activeTool: input.live.activeTool } : {}),
    changedFiles,
    unvalidatedChanges: Math.max(0, changedFiles - validated),
    ...(output ? { recentOutput: output.slice(0, 2000) } : {}),
    hasPTY: hasLivePTY(input.events),
    hasSandbox: hasLiveSandbox(input.events),
  };
}
