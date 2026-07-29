import type {
  RuntimeEvent,
  RuntimeMessagePage,
  RuntimeProjectedMessage,
  RuntimeProjectedMessageRowKind,
} from "@natalia/contracts";
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

/**
 * Projects durable events into stable user-turn messages. A message page never
 * splits a turn, so a consumer can group user, reasoning, tool, and interactive
 * rows before it applies its own measured virtualization.
 */
export function projectSessionMessages(
  session: SessionRecord,
  options: { limit?: number; order?: "asc" | "desc"; cursor?: string } = {},
): RuntimeMessagePage {
  const order = options.cursor
    ? decodeMessageCursor(options.cursor).order
    : (options.order ?? "desc");
  if (options.cursor && options.order)
    throw new Error("message cursor cannot be combined with order");
  const messages = projectTurnMessages(session.events);
  const ordered = order === "asc" ? messages : [...messages].reverse();
  const limit = Math.min(200, Math.max(1, options.limit ?? 100));
  const start = messagePageStart(ordered, options.cursor, limit);
  const data = ordered.slice(start, start + limit);
  return {
    data,
    cursor: {
      previous:
        start > 0 && data[0]
          ? encodeMessageCursor({
              order,
              direction: "previous",
              anchor: data[0].id,
            })
          : undefined,
      next:
        start + data.length < ordered.length && data.at(-1)
          ? encodeMessageCursor({
              order,
              direction: "next",
              anchor: data.at(-1)!.id,
            })
          : undefined,
    },
  };
}

export type MessageCursor = {
  version: 1;
  order: "asc" | "desc";
  direction: "previous" | "next";
  anchor: string;
};

function messagePageStart(
  messages: RuntimeProjectedMessage[],
  cursor: string | undefined,
  limit: number,
) {
  if (!cursor) return 0;
  const value = decodeMessageCursor(cursor);
  const index = messages.findIndex((message) => message.id === value.anchor);
  if (index < 0)
    throw new Error("message cursor anchor is no longer available");
  if (value.direction === "next") return index + 1;
  return Math.max(0, index - limit);
}

export function projectTurnMessage(
  submitted: Extract<RuntimeEvent, { type: "turn.submitted" }>,
  events: RuntimeEvent[],
): RuntimeProjectedMessage {
  const rows = events.flatMap((candidate) => {
    const kind = projectedRowKind(candidate, submitted.id);
    return kind
      ? [
          {
            id: projectedRowID(candidate, submitted.id),
            turnID: submitted.id,
            kind,
            event: candidate,
          },
        ]
      : [];
  });
  const terminal = rows.findLast((row) => row.event.type === "turn.finished");
  return {
    id: submitted.id,
    turnID: submitted.id,
    submitted,
    rows,
    stopReason:
      terminal?.event.type === "turn.finished"
        ? terminal.event.stopReason
        : undefined,
  };
}

/**
 * Projects all submitted turns in one event pass. The former implementation
 * scanned the complete journal once per turn, which made JSON-mode history
 * projection quadratic while producing the same row membership.
 */
export function projectTurnMessages(events: RuntimeEvent[]) {
  const byID = new Map<
    string,
    {
      submitted: Extract<RuntimeEvent, { type: "turn.submitted" }>;
      rows: RuntimeProjectedMessage["rows"];
    }
  >();
  const ordered: string[] = [];
  for (const event of events)
    if (event.type === "turn.submitted" && !byID.has(event.id)) {
      byID.set(event.id, { submitted: event, rows: [] });
      ordered.push(event.id);
    }
  for (const event of events) {
    const turnID = projectedTurnID(event, byID);
    if (!turnID) continue;
    const message = byID.get(turnID)!;
    const kind = projectedRowKind(event, turnID);
    if (!kind) continue;
    message.rows.push({
      id: projectedRowID(event, turnID),
      turnID,
      kind,
      event,
    });
  }
  return ordered.map((id) => {
    const message = byID.get(id)!;
    const terminal = message.rows.findLast(
      (row) => row.event.type === "turn.finished",
    );
    return {
      id,
      turnID: id,
      submitted: message.submitted,
      rows: message.rows,
      stopReason:
        terminal?.event.type === "turn.finished"
          ? terminal.event.stopReason
          : undefined,
    } satisfies RuntimeProjectedMessage;
  });
}

function projectedTurnID(event: RuntimeEvent, messages: Map<string, unknown>) {
  if (event.type === "policy.decision")
    return messages.has(event.turnID) ? event.turnID : undefined;
  if (!("id" in event) || typeof event.id !== "string") return undefined;
  let candidate = event.id;
  while (candidate) {
    if (messages.has(candidate)) return candidate;
    const separator = candidate.lastIndexOf(":");
    if (separator < 0) return undefined;
    candidate = candidate.slice(0, separator);
  }
  return undefined;
}

function projectedRowKind(
  event: RuntimeEvent,
  turnID: string,
): RuntimeProjectedMessageRowKind | undefined {
  if (event.type === "turn.submitted" && event.id === turnID) return "user";
  if (event.type === "policy.decision" && event.turnID === turnID)
    return "system";
  if (!("id" in event) || typeof event.id !== "string") return undefined;
  if (event.id !== turnID && !event.id.startsWith(`${turnID}:`))
    return undefined;
  if (event.type === "thinking.delta" || event.type === "thinking.done")
    return "thinking";
  if (event.type === "content.delta" || event.type === "content.done")
    return "assistant";
  if (event.type === "tool.update") return "tool";
  if (event.type === "approval.request" || event.type === "approval.response")
    return "approval";
  if (event.type === "question.request" || event.type === "question.response")
    return "question";
  return "system";
}

function projectedRowID(event: RuntimeEvent, turnID: string) {
  if (event.type === "policy.decision")
    return `${turnID}:policy:${event.toolCallID ?? event.toolName}:${event.decision}`;
  if ("id" in event && typeof event.id === "string")
    return `${event.id}:${event.type}`;
  return `${turnID}:${event.type}`;
}

export function encodeMessageCursor(input: Omit<MessageCursor, "version">) {
  return Buffer.from(JSON.stringify({ version: 1, ...input })).toString(
    "base64url",
  );
}

export function decodeMessageCursor(cursor: string): MessageCursor {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<MessageCursor>;
    if (
      value.version !== 1 ||
      (value.order !== "asc" && value.order !== "desc") ||
      (value.direction !== "previous" && value.direction !== "next") ||
      typeof value.anchor !== "string" ||
      !value.anchor
    )
      throw new Error("invalid message cursor");
    return value as MessageCursor;
  } catch {
    throw new Error("invalid message cursor");
  }
}

/**
 * Settles only interactive requests owned by a crashed turn. Provider and tool
 * execution cannot be resumed safely without a durable continuation record.
 */
export function settleInterruptedTurns(session: SessionRecord) {
  const activeTurnIDs = projectSession(session).activeTurnIDs;
  if (!activeTurnIDs.length) return [];
  const pendingApprovals = new Set<string>();
  const pendingQuestions = new Set<string>();
  for (const event of session.events) {
    if (event.type === "approval.request") pendingApprovals.add(event.id);
    if (event.type === "approval.response") pendingApprovals.delete(event.id);
    if (event.type === "question.request") pendingQuestions.add(event.id);
    if (event.type === "question.response") pendingQuestions.delete(event.id);
  }
  const settled = settleInterruptedTurnIDs(
    activeTurnIDs,
    [...pendingApprovals],
    [...pendingQuestions],
  );
  session.events.push(...settled);
  return settled;
}

export function projectedConstitutionRules(events: RuntimeEvent[]) {
  const rules: RuntimeEvent[] = [];
  for (const event of events) {
    if (event.type === "constitution.rule_added") {
      rules.push(event);
    }
    if (event.type === "constitution.rule_updated") {
      const existing = rules.findLast(
        (r) => r.type === "constitution.rule_added" && r.ruleID === event.ruleID,
      );
      if (existing && existing.type === "constitution.rule_added") {
        const idx = rules.indexOf(existing);
        rules[idx] = {
          ...existing,
          statement: event.statement ?? existing.statement,
          priority: event.priority ?? existing.priority,
        };
      }
    }
  }
  return rules.filter(
    (r): r is Extract<RuntimeEvent, { type: "constitution.rule_added" }> =>
      r.type === "constitution.rule_added",
  );
}

export function projectedEvidenceRecords(events: RuntimeEvent[]) {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "evidence.recorded" }> =>
      event.type === "evidence.recorded",
  );
}

export function projectedDecisionRecords(events: RuntimeEvent[]) {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "decision.recorded" }> =>
      event.type === "decision.recorded",
  );
}

export function settleInterruptedTurnIDs(
  activeTurnIDs: string[],
  pendingApprovalIDs: string[],
  pendingQuestionIDs: string[],
) {
  const settled: RuntimeEvent[] = [];
  for (const requestID of pendingApprovalIDs)
    if (requestBelongsToInterruptedTurn(requestID, activeTurnIDs))
      settled.push({
        type: "approval.response",
        id: requestID,
        decision: "reject",
        feedback: "interrupted turn cannot continue after runtime restart",
      });
  for (const requestID of pendingQuestionIDs)
    if (requestBelongsToInterruptedTurn(requestID, activeTurnIDs))
      settled.push({
        type: "question.response",
        id: requestID,
        answers: [],
        rejected: true,
      });
  for (const id of activeTurnIDs)
    settled.push({ type: "turn.finished", id, stopReason: "error" });
  return settled;
}

function requestBelongsToInterruptedTurn(requestID: string, turnIDs: string[]) {
  return turnIDs.some(
    (turnID) =>
      requestID === turnID ||
      requestID.startsWith(`${turnID}:`) ||
      requestID.includes(`:${turnID}:`),
  );
}
