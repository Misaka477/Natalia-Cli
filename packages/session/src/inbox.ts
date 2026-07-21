import type { SessionID } from "@natalia/contracts";
import type { SessionRecord } from "./index";

export type SessionInputDelivery = "steer" | "queue";

export type AdmittedSessionInput = {
  id: string;
  sessionID: SessionID;
  text: string;
  delivery: SessionInputDelivery;
  admittedAt: string;
  promotedAt?: string;
};

export class SessionInputConflictError extends Error {
  constructor(id: string) {
    super(`session input conflicts with existing admission: ${id}`);
  }
}

export function admittedInputs(session: SessionRecord) {
  return session.inbox ?? [];
}

export function admitInput(
  session: SessionRecord,
  input: Omit<AdmittedSessionInput, "sessionID" | "admittedAt" | "promotedAt">,
  now = new Date(),
) {
  const existing = admittedInputs(session).find((item) => item.id === input.id);
  if (existing) {
    if (
      existing.sessionID === session.id &&
      existing.text === input.text &&
      existing.delivery === input.delivery
    )
      return existing;
    throw new SessionInputConflictError(input.id);
  }
  const admitted: AdmittedSessionInput = {
    ...input,
    sessionID: session.id,
    admittedAt: now.toISOString(),
  };
  session.inbox = [...admittedInputs(session), admitted];
  return admitted;
}

/** Promotes every pending steer admitted before this provider-turn boundary. */
export function promoteSteers(session: SessionRecord, now = new Date()) {
  return promote(
    session,
    admittedInputs(session).filter((item) => !item.promotedAt && item.delivery === "steer"),
    now,
  );
}

/** Promotes one queued input only when the session would otherwise be idle. */
export function promoteNextQueued(session: SessionRecord, now = new Date()) {
  const next = admittedInputs(session).find(
    (item) => !item.promotedAt && item.delivery === "queue",
  );
  return next ? promote(session, [next], now) : [];
}

function promote(session: SessionRecord, inputs: AdmittedSessionInput[], now: Date) {
  if (!inputs.length) return [];
  const promoted = new Set(inputs.map((item) => item.id));
  const promotedAt = now.toISOString();
  session.inbox = admittedInputs(session).map((item) =>
    promoted.has(item.id) ? { ...item, promotedAt } : item,
  );
  return session.inbox.filter((item) => promoted.has(item.id));
}
