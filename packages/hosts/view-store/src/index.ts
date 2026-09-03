/**
 * `@natalia/view-store` — the pure TypeScript projection of a `RuntimeEvent`
 * stream into displayable state.
 *
 * This is the layer an externally built UI consumes so it does not have to
 * reimplement the runtime's event semantics. It is framework-free: no Solid, no
 * OpenTUI, no DOM. `applyEvent` mutates a plain object and `reduceState` returns
 * a new one by explicit copy rather than `structuredClone`, because cloning a
 * reactive proxy is what broke the first attempt at this layer.
 *
 * What this layer must never do:
 *   - execute tools
 *   - own session persistence
 *   - decide policy or approval
 *   - hold credentials
 *   - invent UI-only durable truth
 *
 * The last rule is why dialog stacks, pane focus, scroll anchors and keybindings
 * are absent: those belong to a specific UI. `pendingApprovals` and
 * `terminalApprovals` are present because they are runtime facts — this layer
 * reports them; the runtime decides them.
 *
 * Projections live in three modules so adding a surface is a local edit:
 * `conversation.ts` (turns, streaming, tools, todos, interactive),
 * `resources.ts` (terminals, sandboxes, subagents, checkpoints, rollback, MCP,
 * plugins, capabilities) and `status.ts` (context, compaction, retries,
 * selections, policy, intelligence).
 *
 * Deliberately **not** projected, and why:
 *   - `dialog.open` / `dialog.close`, `terminal.pane.select` — UI-only state,
 *     owned by whichever UI renders it.
 *   - `drift.finding_opened` stays a session query until a second UI needs the
 *     live list in `facts`; constitution/decision/evidence/plan/mailbox/workgraph
 *     now have production writers and project here for any host.
 */
import { subagentHistoryLimit } from "./state";
import type {
  ChatMessageRow,
  RuntimeEvent,
  RuntimeProjectedMessage,
  RuntimeSubagentView,
} from "@natalia/contracts";
import { applyActivityEvent } from "./activity";
import { applyChatEvent, applyConversationEvent } from "./conversation";
import { applyResourceEvent } from "./resources";
import { applyStatusEvent } from "./status";
import { applyWorkspaceEvent } from "./workspace";
import {
  boundTranscript,
  cloneState,
  initialState,
  type AppState,
} from "./state";

export {
  type ActivityKind,
  type ActivityState,
  type ActivityView,
  appendBounded,
  boundTranscript,
  checkpointLimit,
  cloneState,
  displayText,
  initialState,
  policyDecisionLimit,
  streamSegmentChars,
  subagentHistoryLimit,
  terminalTimelineLimit,
  terminalTranscriptChars,
  transcriptLimit,
  transcriptWatermark,
  upsertBlock,
  type AppState,
  type Banner,
  type ChatActivityView,
  type CapabilityView,
  type CheckpointView,
  type ContextView,
  type McpView,
  type MessageBlock,
  type PendingApproval,
  type PendingQuestion,
  type PluginView,
  type PolicyDecisionView,
  type RollbackView,
  type SandboxDiffView,
  type SandboxView,
  type SessionIntelligenceView,
  type StreamState,
  type SubagentView,
  type TerminalApprovalView,
  type TerminalTimelineEntry,
  type TerminalView,
  type ToolBlock,
  type TranscriptBound,
  type WorkGraphEdgeView,
  type WorkGraphNodeView,
  type MailboxMessageView,
  type PlanDocView,
} from "./state";
export {
  applyActivityEvent,
  selectActiveActivities,
  selectPrimaryActivity,
} from "./activity";
export {
  flushStream,
  newStream,
  segmentID,
  streamID,
  toolStateID,
  turnIDForTool,
} from "./conversation";
/**
 * The projection composed in pieces, for a consumer migrating onto this layer one
 * concern at a time. A UI that still owns its own transcript can take the resource
 * facts from here without also taking the conversation model.
 */
export { applyResourceEvent } from "./resources";
export { applyStatusEvent } from "./status";
export { applyWorkspaceEvent } from "./workspace";
export { applyChatEvent, applyConversationEvent } from "./conversation";
export {
  selectUnattributedWorkGraphNodes,
  selectWorkGraphNeighborhood,
  type WorkGraphSlice,
} from "./graph";

/**
 * Mutates `state` in place. Unknown and deliberately unprojected events are
 * ignored rather than fatal, so a consumer built against an older contract keeps
 * working when the runtime adds an event.
 */
export function applyEvent(state: AppState, event: RuntimeEvent): void {
  const projectedSession = state.sessionID ?? state.activeSessionID;
  if (
    projectedSession &&
    event.sessionID &&
    event.sessionID !== projectedSession &&
    event.type !== "session.created" &&
    event.type !== "session.ready" &&
    event.type !== "session.title.updated" &&
    !event.type.startsWith("workspace.")
  )
    return;
  if (event.agentID) {
    // Events belonging to a subagent are projected into that subagent's own
    // isolated state, so the main Natalia/Navi transcript and the subagent
    // stream do not mix.
    const agentID = event.agentID;
    const child = (state.subagentStates[agentID] ??= initialState());
    applyEvent(child, { ...event, agentID: undefined });
    return;
  }
  if (applyWorkspaceEvent(state, event)) return;
  if (applyConversationEvent(state, event)) {
    applyActivityEvent(state, event);
    return;
  }
  if (applyChatEvent(state, event)) {
    applyActivityEvent(state, event);
    return;
  }
  if (applyResourceEvent(state, event)) {
    if (event.type === "rollback.end")
      truncateHistoryAfterRollback(state, event);
    applyActivityEvent(state, event);
    return;
  }
  applyStatusEvent(state, event);
  applyActivityEvent(state, event);
}

/**
 * A Main Agent checkpoint rollback is a return to a prior execution point.
 * Keep the rollback-fact resource projection intact, but also drop the visible
 * transcript rows for turns after that checkpoint so the UI does not show
 * work the runtime has undone.
 */
function truncateHistoryAfterRollback(
  state: AppState,
  event: Extract<RuntimeEvent, { type: "rollback.end" }>,
): void {
  const checkpoint = state.checkpoints.find(
    (candidate) => candidate.id === event.checkpointID,
  );
  const turnID = checkpoint?.turnID;
  if (!turnID) return;
  const prefix = `${turnID}:`;
  const index = state.messages.findIndex((block) =>
    block.id.startsWith(prefix),
  );
  if (index === -1) return;
  state.messages.splice(index);
  for (const key of Object.keys(state.streams))
    if (!key.startsWith(prefix)) delete state.streams[key];
  for (const key of Object.keys(state.streamPhases))
    if (!key.startsWith(prefix)) delete state.streamPhases[key];
  for (const key of Object.keys(state.tools))
    if (!key.startsWith(prefix)) delete state.tools[key];
}

/**
 * Folds one event into a new state. The copy is explicit rather than
 * `structuredClone` so this stays safe when a caller keeps the previous state
 * behind a reactive proxy.
 */
export function reduceState(state: AppState, event: RuntimeEvent): AppState {
  const next = cloneState(state);
  applyEvent(next, event);
  return next;
}

/** Folds a whole stream, which is how an external UI replays history. */
export function projectEvents(
  events: Iterable<RuntimeEvent>,
  from: AppState = initialState(),
): AppState {
  const state = cloneState(from);
  for (const event of events) applyEvent(state, event);
  return state;
}

/**
 * Hydrates UI transcript rows from server-projected messages. Used by UIs that
 * adopt message-page loading instead of replaying every raw session event.
 * Merges by message id so a live projection can keep its own streaming rows.
 */
export function hydrateProjectedMessages(
  state: AppState,
  messages: RuntimeProjectedMessage[],
  direction: "older" | "newer" = "older",
  options: { replace?: boolean } = {},
): boolean {
  const existingTurnIDs = options.replace
    ? new Set<string>()
    : new Set(
        state.messages
          .filter((message) => message.role === "user")
          .map((message) => message.id.replace(/:user$/u, "")),
      );
  const projected = initialState();
  for (const message of messages) {
    if (existingTurnIDs.has(message.turnID)) continue;
    for (const row of message.rows) applyEvent(projected, row.event);
  }
  if (options.replace) {
    const incoming = projected.messages.map((message) => ({ ...message }));
    const bounded = boundTranscript(incoming, direction);
    state.messages = bounded.messages;
    state.streams = { ...projected.streams };
    state.streamPhases = { ...projected.streamPhases };
    state.tools = { ...projected.tools };
    return bounded.evicted;
  }
  const incoming = projected.messages.map((message) => ({ ...message }));
  if (!incoming.length) return false;
  const incomingIDs = new Set(incoming.map((message) => message.id));
  const retained = state.messages.filter(
    (message) => !incomingIDs.has(message.id),
  );
  const merged =
    direction === "older"
      ? [...incoming, ...retained]
      : [...retained, ...incoming];
  const bounded = boundTranscript(merged, direction);
  state.messages = bounded.messages;
  // Keep stream/tool state for hydrated turns when the live project has not
  // seen them yet.
  for (const id of Object.keys(projected.streams))
    if (!(id in state.streams)) state.streams[id] = projected.streams[id];
  for (const id of Object.keys(projected.streamPhases))
    if (!(id in state.streamPhases))
      state.streamPhases[id] = projected.streamPhases[id];
  for (const id of Object.keys(projected.tools))
    if (!(id in state.tools)) state.tools[id] = projected.tools[id];
  // Preserve interactive requests projected from the hydrated turns so a
  // message-first startup still surfaces pending approvals/questions.
  const approvalIDs = new Set(
    state.pendingApprovals.map((approval) => approval.id),
  );
  for (const approval of projected.pendingApprovals)
    if (!approvalIDs.has(approval.id)) state.pendingApprovals.push(approval);
  const questionIDs = new Set(
    state.pendingQuestions.map((question) => question.id),
  );
  for (const question of projected.pendingQuestions)
    if (!questionIDs.has(question.id)) state.pendingQuestions.push(question);

  if (!state.sessionID && projected.sessionID)
    state.sessionID = projected.sessionID;
  if (!state.title && projected.title) state.title = projected.title;
  return bounded.evicted;
}

/**
 * Hydrates the Live Work Chat rows from the durable chat projection. This is
 * the chat counterpart of `hydrateProjectedMessages`: it lets the UI reuse the
 * same lazy-loading path instead of replaying every raw chat event.
 */
function chatRowToBlock(row: ChatMessageRow): {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  pendingText: string;
  channel: "navi" | "nia";
} {
  const internal = row.role === "user" && row.text.startsWith("(internal");
  return {
    id: internal
      ? `chat:${row.messageID}:system`
      : row.role === "user"
        ? `chat:${row.messageID}:user`
        : `chat:${row.messageID}:assistant`,
    role: internal
      ? ("system" as const)
      : row.role === "user"
        ? ("user" as const)
        : ("assistant" as const),
    text: row.text,
    pendingText: "",
    channel: row.channel ?? "navi",
  };
}

/**
 * Hydrates the Live Work Chat rows from the durable chat projection. Navi and
 * Nia are independent streams: the channel on each durable row routes it into
 * that agent's own projection so neither UI can read the other's transcript.
 */
export function hydrateChatMessages(
  state: AppState,
  rows: ChatMessageRow[],
): boolean {
  if (!rows.length) return false;
  const naviIncoming: ReturnType<typeof chatRowToBlock>[] = [];
  const niaIncoming: ReturnType<typeof chatRowToBlock>[] = [];
  for (const row of rows) {
    const block = chatRowToBlock(row);
    if (block.channel === "nia") niaIncoming.push(block);
    else naviIncoming.push(block);
  }
  let changed = false;
  const merge = (
    target: AppState["chatMessages"],
    incoming: ReturnType<typeof chatRowToBlock>[],
  ) => {
    if (!incoming.length) return;
    const incomingIDs = new Set(incoming.map((row) => row.id));
    const retained = target.filter((row) => !incomingIDs.has(row.id));
    target.splice(0, target.length, ...incoming, ...retained);
    changed = true;
  };
  merge(state.chatMessages, naviIncoming);
  merge(state.niaMessages, niaIncoming);
  return changed;
}


/**
 * Hydrates the current subagent registry into the projected subagent tree.
 * Existing live entries win over this lazy snapshot so a newer subagent.update
 * that arrived after the RPC still takes precedence.
 */
export function hydrateSubagents(
  state: AppState,
  subagents: RuntimeSubagentView[],
): boolean {
  if (!subagents.length) return false;
  const incoming: Record<string, RuntimeSubagentView> = {};
  for (const subagent of subagents) incoming[subagent.id] = subagent;
  state.subagents = { ...incoming, ...state.subagents };
  return true;
}

export function hydrateSubagentHistory(
  state: AppState,
  history: RuntimeSubagentView[],
): boolean {
  if (!history.length) return false;
  for (const event of history) {
    const id = event.id;
    const list = state.subagentHistory[id] ?? [];
    if (!list.some((item) => item.id === event.id)) list.push(event);
    state.subagentHistory[id] = list.slice(-subagentHistoryLimit);
  }
  return true;
}
