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
  if (event.type === "turn.submitted" && event.id === turnID)
    return event.internal ? "system" : "user";
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
        (r) =>
          r.type === "constitution.rule_added" && r.ruleID === event.ruleID,
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

export function latestSessionSnapshot(events: RuntimeEvent[]) {
  let latest: Extract<RuntimeEvent, { type: "session.snapshot" }> | undefined;
  for (const event of events) {
    if (event.type === "session.snapshot") latest = event;
  }
  return latest;
}

/**
 * A drift finding as projected from the journal. This is deliberately not the
 * `drift.finding_opened` event type: the current status is the result of
 * replaying later `drift.finding_updated` events, so it belongs to the
 * projection rather than to any single event.
 */
export type ProjectedDriftFinding = {
  findingID: string;
  severity: "advisory" | "warning" | "high";
  confidence: number;
  originalObjective: string;
  currentActivity: string;
  evidence: string[];
  applicableConstraints: string[];
  status: "open" | "explained" | "dismissed" | "corrected";
  rationale?: string;
};

export function projectedDriftFindings(
  events: RuntimeEvent[],
): ProjectedDriftFinding[] {
  const findings = new Map<string, ProjectedDriftFinding>();
  for (const event of events) {
    if (event.type === "drift.finding_opened")
      findings.set(event.findingID, {
        findingID: event.findingID,
        severity: event.severity,
        confidence: event.confidence,
        originalObjective: event.originalObjective,
        currentActivity: event.currentActivity,
        evidence: event.evidence,
        applicableConstraints: event.applicableConstraints,
        status: "open",
      });
    if (event.type === "drift.finding_updated") {
      const existing = findings.get(event.findingID);
      // An update carries no objective or evidence, so a finding that was never
      // opened cannot be reconstructed from it alone.
      if (existing)
        findings.set(event.findingID, {
          ...existing,
          status: event.status,
          ...(event.rationale === undefined
            ? {}
            : { rationale: event.rationale }),
        });
    }
  }
  return [...findings.values()];
}

export function projectedCanonicalTools(events: RuntimeEvent[]) {
  const tools = new Map<string, RuntimeEvent>();
  for (const event of events) {
    if (event.type === "tool.registered") tools.set(event.name, event);
    if (event.type === "tool.unregistered") tools.delete(event.name);
  }
  return [...tools.values()].filter(
    (e): e is Extract<RuntimeEvent, { type: "tool.registered" }> =>
      e.type === "tool.registered",
  );
}

/**
 * A loaded capability as projected from the journal. The nested manifest mirrors
 * `capabilityManifestSchema`, but only carries the fields the journal actually
 * records: `description` and `dependencies` are not part of the
 * `capability.loaded` event and are therefore not invented here.
 */
export type ProjectedCapability = {
  id: string;
  name: string;
  manifest: {
    apiVersion: number;
    id: string;
    name: string;
    version: string;
    scope: "process" | "workspace" | "session";
    grants: string[];
  };
};

export function projectedCapabilities(
  events: RuntimeEvent[],
): ProjectedCapability[] {
  const loaded = new Map<string, ProjectedCapability>();
  for (const event of events) {
    if (event.type === "capability.loaded")
      loaded.set(event.id, {
        id: event.id,
        name: event.name,
        manifest: {
          apiVersion: event.apiVersion,
          id: event.id,
          name: event.name,
          version: event.version,
          scope: event.scope,
          grants: event.grants,
        },
      });
    if (event.type === "capability.unloaded") loaded.delete(event.id);
  }
  return [...loaded.values()];
}

export function projectedWorkGraphNodes(events: RuntimeEvent[]) {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workgraph.node_added" }> =>
      event.type === "workgraph.node_added",
  );
}

export function projectedWorkGraphEdges(events: RuntimeEvent[]) {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workgraph.edge_added" }> =>
      event.type === "workgraph.edge_added",
  );
}

export function projectedEvidenceRecords(events: RuntimeEvent[]) {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "evidence.recorded" }> =>
      event.type === "evidence.recorded",
  );
}

/** Completion cards (P2 E4), in journal order. */
export function projectedCompletions(events: RuntimeEvent[]) {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "completion.recorded" }> =>
      event.type === "completion.recorded",
  );
}

export function projectedDecisionRecords(events: RuntimeEvent[]) {
  return events.filter(
    (event): event is Extract<RuntimeEvent, { type: "decision.recorded" }> =>
      event.type === "decision.recorded",
  );
}

/**
 * Projects the current mailbox state from the durable journal. The lifecycle is
 * event-sourced: `mailbox.queued` creates a message and each transition event
 * (`delivered`/`acknowledged`/`deferred`/`superseded`) moves it forward. The
 * projected status is the result of replaying the whole journal, so replay
 * reproduces the same mailbox the live session saw.
 */
export type ProjectedMailboxMessage = {
  messageID: string;
  source: "user_via_live_chat" | "system";
  priority: "normal" | "high" | "urgent";
  intent:
    | "clarification"
    | "constraint"
    | "reprioritize"
    | "pause"
    | "cancel"
    | "request_report"
    | "proposed_change"
    | "next_plan_handoff";
  text: string;
  safeSummary: string;
  relatedPlanID?: string;
  deliveryPolicy:
    | "next_safe_boundary"
    | "before_next_tool"
    | "before_next_side_effect"
    | "immediate_control";
  createdAt: string;
  status: "queued" | "delivered" | "acknowledged" | "deferred" | "superseded";
  reason?: string;
};

export function projectedMailboxMessages(
  events: RuntimeEvent[],
): ProjectedMailboxMessage[] {
  const messages = new Map<string, ProjectedMailboxMessage>();
  for (const event of events) {
    if (event.type === "mailbox.queued") {
      messages.set(event.messageID, {
        messageID: event.messageID,
        source: event.source,
        priority: event.priority,
        intent: event.intent,
        text: event.text,
        safeSummary: event.safeSummary,
        ...(event.relatedPlanID ? { relatedPlanID: event.relatedPlanID } : {}),
        deliveryPolicy: event.deliveryPolicy,
        createdAt: event.createdAt,
        status: "queued",
      });
      continue;
    }
    if (event.type === "mailbox.delivered") {
      const message = messages.get(event.messageID);
      if (message) message.status = "delivered";
      continue;
    }
    if (event.type === "mailbox.acknowledged") {
      const message = messages.get(event.messageID);
      if (message) message.status = "acknowledged";
      continue;
    }
    if (event.type === "mailbox.deferred") {
      const message = messages.get(event.messageID);
      if (message) {
        message.status = "deferred";
        message.reason = event.reason;
      }
      continue;
    }
    if (event.type === "mailbox.superseded") {
      const message = messages.get(event.messageID);
      if (message) {
        message.status = "superseded";
        message.reason = event.reason;
      }
    }
  }
  return [...messages.values()];
}

/**
 * Projects the Live Work Chat conversation from the durable journal. The
 * conversation is event-sourced: `chat.message.added` appends a message and
 * `chat.rollback` truncates the effective history at a message boundary, so the
 * Chat's context never diverges from what the journal records.
 */
export type ProjectedChatMessage = {
  messageID: string;
  role: "user" | "chat";
  text: string;
  at: string;
};

export function projectedChatMessages(
  events: RuntimeEvent[],
): ProjectedChatMessage[] {
  const messages: ProjectedChatMessage[] = [];
  for (const event of events) {
    if (event.type === "chat.message.added") {
      messages.push({
        messageID: event.messageID,
        role: event.role,
        text: event.text,
        at: event.at,
      });
      continue;
    }
    if (event.type === "chat.rollback") {
      const index = messages.findIndex(
        (message) => message.messageID === event.toMessageID,
      );
      if (index !== -1) messages.splice(index + 1);
      else messages.length = 0;
    }
  }
  return messages;
}

/**
 * Projects the agent-to-agent collaboration channel (Chat Navi ↔ Main Natalia):
 * suggestions, notices, questions and answers as a durable conversation, with
 * responses folding the decision back onto the target message's status. Both
 * agents read this same projection, so the 轮巡 works without the user
 * prompting either side to check on the other (§8.3).
 */
export type ProjectedCollabMessage = {
  id: string;
  kind: "suggestion" | "notice" | "question" | "answer" | "chat";
  from: "live_chat" | "main_agent";
  to: "live_chat" | "main_agent";
  text: string;
  priority?: string;
  noticeType?: string;
  status:
    | "proposed"
    | "adopted"
    | "rejected"
    | "deferred"
    | "answered"
    | "pending"
    | "replied"
    | "informational";
  questionID?: string;
  threadID?: string;
  replyToID?: string;
  round?: number;
  expectsReply?: boolean;
  /** The recipient's reply reason, when a suggestion was responded to. */
  responseReason?: string;
  at: string;
};

export function projectedCollabMessages(
  events: RuntimeEvent[],
): ProjectedCollabMessage[] {
  const messages: ProjectedCollabMessage[] = [];
  for (const event of events) {
    if (event.type === "collab.suggestion") {
      messages.push({
        id: event.id,
        kind: "suggestion",
        from: "live_chat",
        to: "main_agent",
        text: event.suggestion,
        priority: event.priority,
        status: "proposed",
        at: event.at,
      });
      continue;
    }
    if (event.type === "collab.notice") {
      messages.push({
        id: event.id,
        kind: "notice",
        from: "main_agent",
        to: "live_chat",
        text: event.notice,
        noticeType: event.noticeType,
        status: "proposed",
        at: event.at,
      });
      continue;
    }
    if (event.type === "collab.question") {
      messages.push({
        id: event.id,
        kind: "question",
        from: "main_agent",
        to: "live_chat",
        text: event.question,
        status: "proposed",
        at: event.at,
      });
      continue;
    }
    if (event.type === "collab.answer") {
      messages.push({
        id: event.id,
        kind: "answer",
        from: "live_chat",
        to: "main_agent",
        text: event.answer,
        questionID: event.questionID,
        status: "answered",
        at: event.at,
      });
      const target = messages.find(
        (message) => message.id === event.questionID,
      );
      if (target && target.kind === "question") target.status = "answered";
      continue;
    }
    if (event.type === "collab.chat") {
      if (event.replyToID) {
        const target = messages.find(
          (message) =>
            message.id === event.replyToID && message.kind === "chat",
        );
        if (target) target.status = "replied";
      }
      messages.push({
        id: event.id,
        kind: "chat",
        from: event.from,
        to: event.to,
        text: event.text,
        threadID: event.threadID,
        ...(event.replyToID ? { replyToID: event.replyToID } : {}),
        round: event.round,
        expectsReply: event.expectsReply,
        status: event.expectsReply ? "pending" : "informational",
        at: event.at,
      });
      continue;
    }
    if (event.type === "collab.response") {
      const target = messages.find((message) => message.id === event.messageID);
      if (target && target.kind === "suggestion") {
        target.status = event.decision;
        if (event.reason) target.responseReason = event.reason;
      }
      continue;
    }
  }
  return messages;
}

/**
 * Projects the current plan state from the durable journal. The lifecycle is
 * event-sourced: `plan.draft.created` creates the plan (with its content and
 * version) and each transition (`draft.updated`/`proposed`/`accepted`/`queued`/
 * `activated`/`superseded`/`completed`/`archived`) moves it forward and bumps
 * its version. Replaying the journal reproduces the same plan state a live
 * session saw.
 */
export type ProjectedPlan = {
  planID: string;
  version: number;
  title: string;
  author: "user" | "live_chat" | "main_agent";
  objective: string;
  steps: Array<{
    id: string;
    title: string;
    detail?: string;
    verification?: string;
  }>;
  constraints: string[];
  verification: string[];
  riskNotes: string[];
  relatedMailboxMessageID?: string;
  /** The task this plan verifies (E3 task contract). */
  taskID?: string;
  supersedesPlanID?: string;
  createdAt: string;
  status:
    | "draft"
    | "proposed"
    | "accepted"
    | "queued_next_plan"
    | "active"
    | "completed"
    | "superseded"
    | "archived";
  reason?: string;
};

export function projectedPlans(events: RuntimeEvent[]): ProjectedPlan[] {
  const plans = new Map<string, ProjectedPlan>();
  for (const rawEvent of events) {
    if (rawEvent.type === "plan.draft.created") {
      plans.set(rawEvent.planID, {
        planID: rawEvent.planID,
        version: rawEvent.version,
        title: rawEvent.title,
        author: rawEvent.author,
        objective: rawEvent.objective,
        steps: rawEvent.steps,
        constraints: rawEvent.constraints ?? [],
        verification: rawEvent.verification ?? [],
        riskNotes: rawEvent.riskNotes ?? [],
        ...(rawEvent.relatedMailboxMessageID
          ? { relatedMailboxMessageID: rawEvent.relatedMailboxMessageID }
          : {}),
        ...(rawEvent.taskID ? { taskID: rawEvent.taskID } : {}),
        ...(rawEvent.supersedesPlanID
          ? { supersedesPlanID: rawEvent.supersedesPlanID }
          : {}),
        createdAt: rawEvent.createdAt,
        status: "draft",
      });
      continue;
    }
    if (
      rawEvent.type !== "plan.draft.updated" &&
      rawEvent.type !== "plan.proposed" &&
      rawEvent.type !== "plan.accepted" &&
      rawEvent.type !== "plan.queued" &&
      rawEvent.type !== "plan.activated" &&
      rawEvent.type !== "plan.superseded" &&
      rawEvent.type !== "plan.completed" &&
      rawEvent.type !== "plan.archived"
    )
      continue;
    const event = rawEvent;
    const plan = plans.get(event.planID);
    if (!plan) continue;
    plan.version = event.version;
    switch (event.type) {
      case "plan.draft.updated":
        if (event.reason) plan.reason = event.reason;
        break;
      case "plan.proposed":
        plan.status = "proposed";
        break;
      case "plan.accepted":
        plan.status = "accepted";
        break;
      case "plan.queued":
        plan.status = "queued_next_plan";
        break;
      case "plan.activated":
        plan.status = "active";
        break;
      case "plan.superseded":
        plan.status = "superseded";
        plan.reason = event.reason;
        break;
      case "plan.completed":
        plan.status = "completed";
        break;
      case "plan.archived":
        plan.status = "archived";
        break;
    }
  }
  return [...plans.values()];
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
