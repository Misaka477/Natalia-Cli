import type {
  ChatChannel,
  CollaborationMessage,
  RuntimeEvent,
  RuntimeMessagePage,
  RuntimeProjectedMessage,
  RuntimeProjectedMessageRowKind,
} from "@natalia/contracts";
import { foldGoal, type GoalView } from "@natalia/goal";
import { admittedInputs, type AdmittedSessionInput } from "./inbox";
import type { SessionRecord } from "./index";

export type SessionProjection = {
  activeTurnIDs: string[];
  completedTurnIDs: string[];
  pendingInputs: AdmittedSessionInput[];
  replayableEvents: RuntimeEvent[];
  /** Current same-session goal, folded from the log (always disarmed). */
  goal?: GoalView;
  selectedAgent?: string;
  selectedModel?: { modelID?: string; variant?: string };
  reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
  chatModelProfile?: Record<
    string,
    import("@natalia/contracts").ChatModelProfile
  >;
  permissionMode?: "ask" | "auto" | "read_only";
  permissionProfile?: string;
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
    goal: projectedGoal(session.events),
    selectedAgent: selectedAgentFromEvents(replayable),
    selectedModel: selectedModelFromEvents(replayable),
    reasoningEffort: reasoningEffortFromEvents(replayable),
    chatModelProfile: chatModelProfileFromEvents(replayable),
    permissionMode: permissionModeFromEvents(replayable),
    permissionProfile: permissionProfileFromEvents(replayable),
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

export function reasoningEffortFromEvents(
  events: RuntimeEvent[],
): import("@natalia/contracts").RuntimeReasoningEffort | undefined {
  for (const event of [...events].reverse())
    if (event.type === "model.reasoning.set") return event.reasoningEffort;
  return undefined;
}

export function chatModelProfileFromEvents(
  events: RuntimeEvent[],
): Record<string, import("@natalia/contracts").ChatModelProfile> | undefined {
  let profile:
    | Record<string, import("@natalia/contracts").ChatModelProfile>
    | undefined;
  for (const event of events) {
    if (event.type === "navi.chat.model.profile") {
      profile = profile ?? {};
      profile.navi = event.profile;
      continue;
    }
    if (event.type === "nia.chat.model.profile") {
      profile = profile ?? {};
      profile.nia = event.profile;
      continue;
    }
    if (event.type === "chat.model.profile") {
      profile = profile ?? {};
      profile[event.channel] = event.profile;
    }
  }
  return profile;
}

export function permissionModeFromEvents(
  events: RuntimeEvent[],
): "ask" | "auto" | "read_only" | undefined {
  for (const event of [...events].reverse())
    if (event.type === "session.permission.mode") return event.mode;
  return undefined;
}

export function permissionProfileFromEvents(
  events: RuntimeEvent[],
): string | undefined {
  for (const event of [...events].reverse())
    if (event.type === "session.permission.mode") return event.profile;
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
  const rowIDCounts = new Map<string, number>();
  const rows = events.flatMap((candidate) => {
    const kind = projectedRowKind(candidate, submitted.id);
    if (!kind) return [];
    const baseID = projectedRowID(candidate, submitted.id);
    const occurrence = rowIDCounts.get(baseID) ?? 0;
    rowIDCounts.set(baseID, occurrence + 1);
    return [
      {
        // Durable rows can repeat the same event type/id within one turn
        // (multiple provider steps, partial/done pairs). The row id is a
        // consumer-facing key, so keep the first id stable and disambiguate
        // later occurrences instead of returning duplicates.
        id: occurrence === 0 ? baseID : `${baseID}:${occurrence}`,
        turnID: submitted.id,
        kind,
        event: candidate,
      },
    ];
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
  let currentTurnID: string | undefined;
  const rowIDCounts = new Map<string, Map<string, number>>();
  for (const event of events) {
    if (event.type === "turn.submitted" && byID.has(event.id))
      currentTurnID = event.id;
    const turnID = projectedTurnID(event, byID, currentTurnID);
    if (!turnID) continue;
    const message = byID.get(turnID)!;
    const kind = projectedRowKind(event, turnID);
    if (!kind) continue;
    const baseID = projectedRowID(event, turnID);
    const counts = rowIDCounts.get(turnID) ?? new Map<string, number>();
    rowIDCounts.set(turnID, counts);
    const occurrence = counts.get(baseID) ?? 0;
    counts.set(baseID, occurrence + 1);
    message.rows.push({
      id: occurrence === 0 ? baseID : `${baseID}:${occurrence}`,
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

function projectedTurnID(
  event: RuntimeEvent,
  messages: Map<string, unknown>,
  currentTurnID?: string,
) {
  if (event.type === "policy.decision")
    return messages.has(event.turnID) ? event.turnID : undefined;
  if (event.type === "turn.input")
    return messages.has(event.turnID) ? event.turnID : undefined;
  // `input.*` events describe a durable admission, not a turn row. Without this
  // they would attach to the started turn carrying the same id.
  if (event.type.startsWith("input.")) return undefined;
  // Collaboration messages carry their identity under `message.id`, not a
  // top-level `id` prefixed by the turn. They still belong to the turn that was
  // open when they were emitted, so attach them by event-stream order.
  if (event.type === "natalia.collab.message") return currentTurnID;
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
  if (event.type === "turn.input") return event.internal ? "system" : "user";
  if (event.type === "natalia.collab.message") return "system";
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
  if (event.type === "turn.input")
    return `${event.turnID}:user:${event.inputID}`;
  if (event.type === "natalia.collab.message")
    return `${turnID}:collab:${event.message.id}`;
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

/**
 * Projects the current same-session goal from the journal. The result is always
 * `disarmed`: continuation authority is process-local and never reconstructed
 * by replay (see the goal subsystem plan).
 */
export function projectedGoal(events: RuntimeEvent[]): GoalView | undefined {
  return foldGoal(events);
}

export function projectedConstitutionRules(events: RuntimeEvent[]) {
  const rules: RuntimeEvent[] = [];
  for (const event of events) {
    if (event.type === "constitution.rule_added") {
      if (
        rules.some(
          (existing) =>
            existing.type === "constitution.rule_added" &&
            existing.ruleID === event.ruleID,
        )
      )
        continue;
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
          enforcement: event.enforcement ?? existing.enforcement,
          overridePolicy: event.overridePolicy ?? existing.overridePolicy,
        };
      }
    }
  }
  return rules.filter(
    (r): r is Extract<RuntimeEvent, { type: "constitution.rule_added" }> =>
      r.type === "constitution.rule_added",
  );
}

export function projectedConstitutionOverrides(events: RuntimeEvent[]) {
  const now = Date.now();
  const overrides: Array<
    Extract<RuntimeEvent, { type: "constitution.override_granted" }>
  > = [];
  for (const event of events) {
    if (event.type !== "constitution.override_granted") continue;
    if (event.expiresAt) {
      const expires = Date.parse(event.expiresAt);
      if (Number.isFinite(expires) && expires <= now) continue;
    }
    overrides.push(event);
  }
  return overrides;
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
  const records: Array<Extract<RuntimeEvent, { type: "decision.recorded" }>> =
    [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type !== "decision.recorded") continue;
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    records.push(event);
  }
  return records;
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
 * Projects the independent Navi and Nia conversations from the durable journal.
 * New records route by their `navi.chat.*` or `nia.chat.*` prefix. The legacy
 * `chat.*` branch is retained only to ingest journals persisted before the
 * namespace migration.
 */
export type ProjectedChatMessage = {
  messageID: string;
  role: "user" | "chat" | "system";
  text: string;
  at: string;
  channel: ChatChannel;
  kind?: "message" | "thinking" | "tool" | "compaction" | "collab";
  attachments?: import("@natalia/contracts").LocalAttachment[];
  tool?: {
    /** Durable event id, stable across replay and live hydration. */
    eventID?: string;
    name: string;
    status: string;
    summary: string;
    result?: string;
    argumentsRaw?: string;
    startedAt?: number;
    endedAt?: number;
  };
};

export function projectedChatMessages(
  events: RuntimeEvent[],
): ProjectedChatMessage[] {
  const messages: ProjectedChatMessage[] = [];
  const thinkingByMessage = new Map<string, ProjectedChatMessage>();
  for (const event of events) {
    const channel = chatEventChannel(event);
    if (!channel) continue;
    if (isChatThinkingDelta(event)) {
      const key = `${channel}:${event.messageID}`;
      const existing = thinkingByMessage.get(key);
      if (existing) {
        existing.text += event.text;
      } else {
        const thinking: ProjectedChatMessage = {
          messageID: event.messageID,
          role: "chat",
          text: event.text,
          // Chat deltas do not carry a timestamp. Keeping journal order avoids
          // making replay depend on the wall clock used by the projector.
          at: "",
          channel,
          kind: "thinking",
        };
        thinkingByMessage.set(key, thinking);
        messages.push(thinking);
      }
      continue;
    }
    if (isChatThinkingDone(event)) {
      const key = `${channel}:${event.messageID}`;
      const existing = thinkingByMessage.get(key);
      if (existing) {
        // The durable settlement is the complete record. It supersedes any
        // live-only delta captured by a caller that projects both streams.
        existing.text = event.text;
      } else {
        const thinking: ProjectedChatMessage = {
          messageID: event.messageID,
          role: "chat",
          text: event.text,
          at: "",
          channel,
          kind: "thinking",
        };
        thinkingByMessage.set(key, thinking);
        messages.push(thinking);
      }
      continue;
    }
    if (isChatMessageSettlement(event)) {
      messages.push({
        messageID: event.messageID,
        role: event.role,
        text: event.text,
        at: event.at,
        channel,
        kind: "message",
        ...(event.attachments ? { attachments: event.attachments } : {}),
      });
      continue;
    }
    if (isChatToolUsed(event)) {
      messages.push({
        messageID: event.messageID,
        role: "chat",
        text: event.summary,
        at: event.at,
        channel,
        kind: "tool",
        tool: {
          eventID: event.id,
          name: event.toolName,
          status: event.status,
          summary: event.summary,
          ...(event.result !== undefined ? { result: event.result } : {}),
          ...(event.argumentsRaw !== undefined
            ? { argumentsRaw: event.argumentsRaw }
            : {}),
          ...(event.startedAt !== undefined
            ? { startedAt: event.startedAt }
            : {}),
          ...(event.endedAt !== undefined ? { endedAt: event.endedAt } : {}),
        },
      });
      continue;
    }
    if (isChatRollback(event)) {
      const boundary = messages.findIndex(
        (message) =>
          message.messageID === event.toMessageID &&
          message.channel === channel,
      );
      if (boundary !== -1) {
        for (let index = messages.length - 1; index >= 0; index -= 1)
          if (messages[index]?.channel === channel && index > boundary)
            messages.splice(index, 1);
      } else {
        for (let index = messages.length - 1; index >= 0; index -= 1)
          if (messages[index]?.channel === channel) messages.splice(index, 1);
      }
      thinkingByMessage.clear();
      for (const message of messages)
        if (message.kind === "thinking")
          thinkingByMessage.set(
            `${message.channel}:${message.messageID}`,
            message,
          );
    }
    if (isChatCompacted(event)) {
      const boundary = messages.findIndex(
        (message) =>
          message.messageID === event.compactedThroughMessageID &&
          message.channel === channel,
      );
      if (boundary !== -1) {
        for (let index = messages.length - 1; index >= 0; index -= 1)
          if (messages[index]?.channel === channel && index >= boundary)
            messages.splice(index, 1);
      } else {
        for (let index = messages.length - 1; index >= 0; index -= 1)
          if (messages[index]?.channel === channel) messages.splice(index, 1);
      }
      messages.push({
        messageID: event.messageID,
        role: "chat",
        text: `[已压缩的聊天历史]
${event.summary}`,
        at: event.at,
        channel,
        kind: "compaction",
      });
    }
  }
  return messages;
}

export function projectedNaviChatMessages(
  events: RuntimeEvent[],
): ProjectedChatMessage[] {
  return projectNaviChatMessages(events);
}

export function projectedNiaChatMessages(
  events: RuntimeEvent[],
): ProjectedChatMessage[] {
  return projectNiaChatMessages(events);
}

function projectNaviChatMessages(
  events: RuntimeEvent[],
): ProjectedChatMessage[] {
  return projectChatStream(events, "navi", isNaviChatEvent);
}

function projectNiaChatMessages(
  events: RuntimeEvent[],
): ProjectedChatMessage[] {
  return projectChatStream(events, "nia", isNiaChatEvent);
}

function collabChatRow(
  event: RuntimeEvent,
  channel: ChatChannel,
): ProjectedChatMessage | undefined {
  const message = normalizeCollaborationEvent(event);
  if (!message) return undefined;
  if (channel === "navi" && message.from !== "live_chat") return undefined;
  if (channel === "nia" && message.from !== "nia") return undefined;
  const from =
    message.from === "main_agent"
      ? "Natalia"
      : message.from === "live_chat"
        ? "Navi"
        : "Nia";
  const to =
    message.to === "main_agent"
      ? "Natalia"
      : message.to === "live_chat"
        ? "Navi"
        : "Nia";
  const text =
    message.kind === "response"
      ? `Natalia ${message.decision} the suggestion${message.reason ? ` (${message.reason})` : ""}`
      : `${from} → ${to}: ${message.text}`;
  return {
    messageID: message.id,
    role: "system",
    text,
    at: message.at,
    channel,
    kind: "collab",
  };
}

function projectChatStream(
  events: RuntimeEvent[],
  channel: ChatChannel,
  owns: (event: RuntimeEvent) => boolean,
): ProjectedChatMessage[] {
  const messages: ProjectedChatMessage[] = [];
  const thinkingByMessage = new Map<string, ProjectedChatMessage>();
  for (const event of events) {
    const collab = collabChatRow(event, channel);
    if (collab) {
      messages.push(collab);
      continue;
    }
    if (!owns(event)) continue;
    if (isChatThinkingDelta(event)) {
      const existing = thinkingByMessage.get(event.messageID);
      if (existing) existing.text += event.text;
      else {
        const thinking = {
          messageID: event.messageID,
          role: "chat" as const,
          text: event.text,
          at: "",
          channel,
          kind: "thinking" as const,
        };
        thinkingByMessage.set(event.messageID, thinking);
        messages.push(thinking);
      }
      continue;
    }
    if (isChatThinkingDone(event)) {
      const existing = thinkingByMessage.get(event.messageID);
      if (existing) existing.text = event.text;
      else {
        const thinking = {
          messageID: event.messageID,
          role: "chat" as const,
          text: event.text,
          at: "",
          channel,
          kind: "thinking" as const,
        };
        thinkingByMessage.set(event.messageID, thinking);
        messages.push(thinking);
      }
      continue;
    }
    if (isChatMessageSettlement(event)) {
      messages.push({
        messageID: event.messageID,
        role: event.role,
        text: event.text,
        at: event.at,
        channel,
        kind: "message",
        ...(event.attachments ? { attachments: event.attachments } : {}),
      });
      continue;
    }
    if (isChatToolUsed(event)) {
      messages.push({
        messageID: event.messageID,
        role: "chat",
        text: event.summary,
        at: event.at,
        channel,
        kind: "tool",
        tool: {
          name: event.toolName,
          status: event.status,
          summary: event.summary,
          ...(event.result !== undefined ? { result: event.result } : {}),
          ...(event.argumentsRaw !== undefined
            ? { argumentsRaw: event.argumentsRaw }
            : {}),
          ...(event.startedAt !== undefined
            ? { startedAt: event.startedAt }
            : {}),
          ...(event.endedAt !== undefined ? { endedAt: event.endedAt } : {}),
        },
      });
      continue;
    }
    if (isChatRollback(event)) {
      const boundary = messages.findIndex(
        (message) => message.messageID === event.toMessageID,
      );
      messages.splice(boundary === -1 ? 0 : boundary + 1);
      thinkingByMessage.clear();
      for (const message of messages)
        if (message.kind === "thinking")
          thinkingByMessage.set(message.messageID, message);
      continue;
    }
    if (isChatCompacted(event)) {
      const boundary = messages.findIndex(
        (message) => message.messageID === event.compactedThroughMessageID,
      );
      messages.splice(boundary === -1 ? 0 : boundary);
      messages.push({
        messageID: event.messageID,
        role: "chat",
        text: `[已压缩的聊天历史]\n${event.summary}`,
        at: event.at,
        channel,
        kind: "compaction",
      });
    }
  }
  return messages;
}

function isNaviChatEvent(event: RuntimeEvent): boolean {
  return (
    event.type.startsWith("navi.chat.") ||
    (event.type.startsWith("chat.") &&
      (event as { channel?: ChatChannel }).channel !== "nia")
  );
}

function isNiaChatEvent(event: RuntimeEvent): boolean {
  return (
    event.type.startsWith("nia.chat.") ||
    (event.type.startsWith("chat.") &&
      (event as { channel?: ChatChannel }).channel === "nia")
  );
}

function chatEventChannel(event: RuntimeEvent): ChatChannel | undefined {
  if (event.type.startsWith("navi.chat.")) return "navi";
  if (event.type.startsWith("nia.chat.")) return "nia";
  if (event.type.startsWith("chat."))
    return (event as { channel?: ChatChannel }).channel ?? "navi";
  return undefined;
}

function isChatCompacted(
  event: RuntimeEvent,
): event is Extract<RuntimeEvent, { type: `${ChatChannel}.chat.compacted` }> {
  return (
    event.type === "navi.chat.compacted" || event.type === "nia.chat.compacted"
  );
}

function isChatThinkingDelta(
  event: RuntimeEvent,
): event is Extract<
  RuntimeEvent,
  { type: `${ChatChannel}.chat.thinking.delta` | "chat.thinking.delta" }
> {
  return (
    event.type === "navi.chat.thinking.delta" ||
    event.type === "nia.chat.thinking.delta" ||
    event.type === "chat.thinking.delta"
  );
}

function isChatToolUsed(
  event: RuntimeEvent,
): event is Extract<
  RuntimeEvent,
  { type: `${ChatChannel}.chat.tool.used` | "chat.tool.used" }
> {
  return (
    event.type === "navi.chat.tool.used" ||
    event.type === "nia.chat.tool.used" ||
    event.type === "chat.tool.used"
  );
}

function isChatMessageSettlement(event: RuntimeEvent): event is Extract<
  RuntimeEvent,
  {
    type:
      | `${ChatChannel}.chat.message.new`
      | `${ChatChannel}.chat.message.added`
      | "chat.message.added";
  }
> {
  return (
    event.type === "navi.chat.message.new" ||
    event.type === "nia.chat.message.new" ||
    event.type === "navi.chat.message.added" ||
    event.type === "nia.chat.message.added" ||
    event.type === "chat.message.added"
  );
}

function isChatThinkingDone(
  event: RuntimeEvent,
): event is Extract<
  RuntimeEvent,
  { type: `${ChatChannel}.chat.thinking.done` }
> {
  return (
    event.type === "navi.chat.thinking.done" ||
    event.type === "nia.chat.thinking.done"
  );
}

function isChatRollback(
  event: RuntimeEvent,
): event is Extract<
  RuntimeEvent,
  { type: `${ChatChannel}.chat.rollback` | "chat.rollback" }
> {
  return (
    event.type === "navi.chat.rollback" ||
    event.type === "nia.chat.rollback" ||
    event.type === "chat.rollback"
  );
}

/**
 * Projects the agent-to-agent collaboration channel (Chat Navi ↔ Main Natalia):
 * suggestions, notices, questions, answers and responses as one durable
 * conversation. Reply relationships are resolved after normalization so
 * replay order does not change pending state.
 */
export type ProjectedCollabMessage = CollaborationMessage & {
  status: "pending" | "replied" | "informational";
  /** Legacy alias retained while the public tool still calls this questionID. */
  questionID?: string;
};

export function normalizeCollaborationEvent(
  event: RuntimeEvent,
  targets: ReadonlyMap<string, CollaborationMessage> = new Map(),
): CollaborationMessage | undefined {
  if (
    event.type === "collab.message" ||
    event.type === "natalia.collab.message" ||
    event.type === "navi.collab.message" ||
    event.type === "nia.collab.message"
  )
    return event.message;
  if (event.type === "collab.suggestion")
    return {
      id: event.id,
      threadID: event.id,
      kind: "suggestion",
      from: event.from,
      to: event.to,
      text: event.suggestion,
      expectsReply: true,
      priority: event.priority,
      ...(event.rationale ? { rationale: event.rationale } : {}),
      at: event.at,
    };
  if (event.type === "collab.notice")
    return {
      id: event.id,
      threadID: event.id,
      kind: "notice",
      from: event.from,
      to: event.to,
      text: event.notice,
      expectsReply: false,
      noticeType: event.noticeType,
      at: event.at,
    };
  if (event.type === "collab.question")
    return {
      id: event.id,
      threadID: event.id,
      kind: "question",
      from: event.from,
      to: event.to,
      text: event.question,
      expectsReply: true,
      at: event.at,
    };
  if (event.type === "collab.answer")
    return {
      id: event.id,
      threadID: targets.get(event.questionID)?.threadID ?? event.questionID,
      replyToID: event.questionID,
      kind: "answer",
      from: event.from,
      to: event.to,
      text: event.answer,
      expectsReply: false,
      at: event.at,
    };
  if (event.type === "collab.chat")
    return {
      id: event.id,
      threadID: event.threadID,
      ...(event.replyToID ? { replyToID: event.replyToID } : {}),
      kind: "chat",
      from: event.from,
      to: event.to,
      text: event.text,
      expectsReply: event.expectsReply,
      round: event.round,
      at: event.at,
    };
  if (event.type === "collab.response")
    return {
      id: event.id,
      threadID: targets.get(event.messageID)?.threadID ?? event.messageID,
      replyToID: event.messageID,
      kind: "response",
      from: "main_agent",
      to: "live_chat",
      text: event.reason ?? event.decision,
      expectsReply: false,
      decision: event.decision,
      ...(event.reason ? { reason: event.reason } : {}),
      at: event.at,
    };
  return undefined;
}

export function projectedCollabMessages(
  events: RuntimeEvent[],
): ProjectedCollabMessage[] {
  const targets = new Map<string, CollaborationMessage>();
  for (const event of events) {
    const message = normalizeCollaborationEvent(event, targets);
    if (message && !targets.has(message.id)) targets.set(message.id, message);
  }
  const normalized = events
    .map((event) => normalizeCollaborationEvent(event, targets))
    .filter((message): message is CollaborationMessage => Boolean(message));
  const unique = normalized.filter(
    (message, index) =>
      normalized.findIndex((candidate) => candidate.id === message.id) ===
      index,
  );
  const replied = new Set<string>();
  for (const message of unique) {
    if (!message.replyToID) continue;
    const target = targets.get(message.replyToID);
    if (
      target &&
      target.expectsReply &&
      target.threadID === message.threadID &&
      target.from === message.to &&
      target.to === message.from &&
      ((message.kind === "answer" && target.kind === "question") ||
        (message.kind === "response" && target.kind === "suggestion") ||
        (message.kind === "chat" && target.kind === "chat"))
    )
      replied.add(target.id);
  }
  return unique.map((message) => ({
    ...message,
    status: replied.has(message.id)
      ? "replied"
      : message.expectsReply
        ? "pending"
        : "informational",
    ...(message.kind === "answer" ? { questionID: message.replyToID } : {}),
  }));
}

/**
 * Projects the current lightweight plan document registry from the journal.
 *
 * Unlike the former C4 plan ledger, this does not store plan content. It only
 * tracks which Markdown document is a formal Plan, where it lives, and the
 * lifecycle status used by handoff/execution/audit routing.
 */
export type ProjectedPlanDoc = {
  planID: string;
  title: string;
  documentPath: string;
  createdBy: "user" | "live_chat" | "main_agent";
  createdAt: string;
  updatedAt: string;
  markedAt?: string;
  status: string;
};

export function projectedPlanDocs(events: RuntimeEvent[]): ProjectedPlanDoc[] {
  const plans = new Map<string, ProjectedPlanDoc>();
  for (const event of events) {
    if (event.type === "plan.doc.created") {
      plans.set(event.planID, {
        planID: event.planID,
        title: event.title,
        documentPath: event.documentPath,
        createdBy: event.createdBy,
        createdAt: event.createdAt,
        updatedAt: event.createdAt,
        status: event.status,
      });
      continue;
    }
    if (event.type === "plan.doc.deleted") {
      plans.delete(event.planID);
      continue;
    }
    if (
      event.type !== "plan.doc.updated" &&
      event.type !== "plan.doc.marked" &&
      event.type !== "plan.doc.status"
    )
      continue;
    const plan = plans.get(event.planID);
    if (!plan) continue;
    switch (event.type) {
      case "plan.doc.updated":
        plan.updatedAt = event.updatedAt;
        if (event.reason) plan.status = plan.status;
        break;
      case "plan.doc.marked":
        plan.markedAt = event.markedAt;
        plan.updatedAt = event.markedAt;
        break;
      case "plan.doc.status":
        plan.status = event.status;
        plan.updatedAt = event.at;
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
