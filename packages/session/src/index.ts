import type { RuntimeEvent, SessionID } from "@natalia/contracts";

export type SessionRecord = {
  id: SessionID;
  title: string;
  createdAt: string;
  events: RuntimeEvent[];
  cancelled: boolean;
  resumable: boolean;
};

export function createSessionRecord(
  id: SessionID,
  title: string,
  now = new Date(),
): SessionRecord {
  return {
    id,
    title,
    createdAt: now.toISOString(),
    events: [],
    cancelled: false,
    resumable: true,
  };
}

export function appendSessionEvent(
  session: SessionRecord,
  event: RuntimeEvent,
) {
  session.events.push(event);
  if (event.type === "turn.cancelled") session.cancelled = true;
}
