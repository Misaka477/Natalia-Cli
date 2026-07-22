import type { RuntimeEvent } from "@natalia/contracts";
import { admittedInputs, type AdmittedSessionInput } from "./inbox";
import type { SessionRecord } from "./index";

export type SessionProjection = {
  activeTurnIDs: string[];
  completedTurnIDs: string[];
  pendingInputs: AdmittedSessionInput[];
  replayableEvents: RuntimeEvent[];
  selectedAgent?: string;
  selectedModel?: { modelID?: string; variant?: string };
};

/** Selects the model-visible durable context after the latest epoch baseline. */
export function modelVisibleEvents(events: RuntimeEvent[]) {
  const checkpointIndex = events.reduce(
    (latest, event, index) =>
      event.type === "context.checkpoint" ? index : latest,
    -1,
  );
  if (checkpointIndex < 0) return events;
  return events.slice(checkpointIndex + 1);
}

/**
 * Projects append-only runtime events without attempting to replay an
 * incomplete provider/tool turn after restart.
 */
export function projectSession(session: SessionRecord): SessionProjection {
  const active = new Set<string>();
  const completed = new Set<string>();
  for (const event of session.events) {
    if (event.type === "turn.submitted") {
      active.add(event.id);
      continue;
    }
    if (event.type === "turn.finished") {
      active.delete(event.id);
      completed.add(event.id);
    }
  }
  // A crashed turn may contain partial model/tool state. Keep its durable
  // audit events on disk, but do not feed its input back into a new model turn.
  const replayable = session.events.filter(
    (event) => !belongsToInterruptedTurn(event, active),
  );
  return {
    activeTurnIDs: [...active],
    completedTurnIDs: [...completed],
    pendingInputs: admittedInputs(session).filter((input) => !input.promotedAt),
    replayableEvents: replayable,
    selectedAgent: selectedAgentFromEvents(replayable),
    selectedModel: selectedModelFromEvents(replayable),
  };
}

function belongsToInterruptedTurn(event: RuntimeEvent, active: Set<string>) {
  if (!("id" in event) || typeof event.id !== "string") return false;
  return [...active].some(
    (turnID) => event.id === turnID || event.id.startsWith(`${turnID}:`),
  );
}

export function selectedModelFromEvents(events: RuntimeEvent[]) {
  for (const event of [...events].reverse())
    if (event.type === "model.selection")
      return { modelID: event.modelID, variant: event.variant };
  return undefined;
}

/** Returns the last committed, rather than pending, runtime agent selection. */
export function selectedAgentFromEvents(events: RuntimeEvent[]) {
  for (const event of [...events].reverse())
    if (event.type === "agent.selection" && !event.pending) return event.name;
  return undefined;
}
