/**
 * Conversation projection: turns, streaming text, tool cards, todos and the
 * interactive requests the runtime is waiting on.
 *
 * Streaming is the subtle part. Live consumers receive `content.delta` and watch
 * text accumulate. Consumers replaying durable history receive none of those,
 * because deltas are live-only events and are never journaled; they see one bare
 * `content.done` per provider step instead. Both paths must produce the same
 * transcript, which is the main reason this layer exists rather than every
 * consumer writing its own reducer.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import {
  parseToolArguments,
  parseTodoItems,
  classifyTool,
} from "@natalia/ui-model";
import {
  streamSegmentChars,
  upsertBlock,
  type AppState,
  type ToolBlock,
} from "./state";

export function newStream() {
  return { committed: "", tail: "", attempt: 1, segmentIndex: 0 };
}

export function streamID(turnID: string, role: "thinking" | "assistant") {
  return `${turnID}:${role}`;
}

export function segmentID(baseID: string, index: number) {
  if (index === 0) return baseID;
  return `${baseID}:segment:${index}`;
}

export function toolStateID(event: {
  id: string;
  name: string;
  callID?: string;
}) {
  return `${event.id}:tool:${event.callID ?? event.name}`;
}

/** Returns true when the event belongs to this projection. */
export function applyConversationEvent(
  state: AppState,
  event: RuntimeEvent,
): boolean {
  switch (event.type) {
    case "session.created":
      state.sessionID = event.sessionID;
      state.title = event.title;
      return true;
    case "session.ready":
      state.status = "ready";
      return true;
    case "turn.submitted":
      state.activeTurn = event.id;
      state.lastSubmission = event;
      state.lastStopReason = undefined;
      state.streams[streamID(event.id, "thinking")] = newStream();
      state.streams[streamID(event.id, "assistant")] = newStream();
      state.messages.push({
        id: `${event.id}:user`,
        role: "user",
        text: userText(event),
        pendingText: "",
      });
      return true;
    case "turn.paused":
      state.paused = true;
      state.footer = `paused: ${event.reason}`;
      return true;
    case "turn.resumed":
      state.paused = false;
      state.footer = "resumed";
      return true;
    case "thinking.delta":
      prepareStreamPhase(state, event.id, "thinking");
      appendStream(state, {
        id: streamID(event.id, "thinking"),
        role: "thinking",
        text: event.text,
        attempt: event.attempt,
        reasoningVisible: event.visible !== false,
      });
      return true;
    case "thinking.done":
      flushStream(state, streamID(event.id, "thinking"));
      markBlockStatus(state, streamID(event.id, "thinking"), "completed");
      return true;
    case "content.delta":
      prepareStreamPhase(state, event.id, "assistant");
      appendStream(state, {
        id: streamID(event.id, "assistant"),
        role: "assistant",
        text: event.text,
        attempt: event.attempt,
      });
      return true;
    case "content.done": {
      const key = streamID(event.id, "assistant");
      flushStream(state, key);
      const stream = state.streams[key];
      const currentID = stream ? segmentID(key, stream.segmentIndex) : key;
      const current = state.messages.find((block) => block.id === currentID);
      // Live streaming has already filled this segment from deltas, so there is
      // nothing to synthesize. Durable replay is the opposite case: this is the
      // only place the text can come from.
      const alreadyRendered = Boolean(
        current && (current.text || current.pendingText),
      );
      if (event.text && !alreadyRendered) {
        upsertBlock(state, currentID, "assistant", event.text);
        // One `content.done` is one message. Advance so the next step's text
        // becomes its own block instead of overwriting this one — a turn that
        // calls tools produces several, and on replay they would otherwise
        // collapse into the first.
        if (stream) {
          stream.segmentIndex += 1;
          stream.committed = "";
          stream.tail = "";
        }
      }
      return true;
    }
    case "tool.update": {
      const turnID = event.id;
      // Model output is committed before its tool card, so a tool update never
      // reorders text around itself.
      flushStream(state, streamID(turnID, "thinking"));
      flushStream(state, streamID(turnID, "assistant"));
      beginPostToolSegment(state, turnID);
      delete state.streamPhases[turnID];
      upsertTool(state, event);
      return true;
    }
    case "approval.request":
      state.pendingApprovals = [
        ...state.pendingApprovals.filter((item) => item.id !== event.id),
        event,
      ];
      return true;
    case "approval.response":
      state.pendingApprovals = state.pendingApprovals.filter(
        (item) => item.id !== event.id,
      );
      return true;
    case "question.request":
      state.pendingQuestions = [
        ...state.pendingQuestions.filter((item) => item.id !== event.id),
        event,
      ];
      return true;
    case "question.response":
      state.pendingQuestions = state.pendingQuestions.filter(
        (item) => item.id !== event.id,
      );
      return true;
    case "turn.cancelled":
      state.activeTurn = undefined;
      state.paused = false;
      state.lastStopReason = "cancelled";
      state.footer = `cancelled: ${event.reason}`;
      dropStreamTail(state, event.id);
      upsertBlock(
        state,
        `${event.id}:cancelled`,
        "system",
        `cancelled: ${event.reason}`,
      );
      // A cancelled turn must not leave a pending request nobody will answer, or
      // a consumer renders a prompt forever.
      state.pendingApprovals = [];
      state.pendingQuestions = [];
      return true;
    case "turn.finished":
      flushStream(state, streamID(event.id, "thinking"));
      flushStream(state, streamID(event.id, "assistant"));
      if (state.activeTurn === event.id) state.activeTurn = undefined;
      state.paused = false;
      state.lastStopReason = event.stopReason;
      state.footer =
        event.stopReason === "done"
          ? "Ready"
          : `turn ${event.stopReason}${event.reason ? `: ${event.reason}` : ""}`;
      if (event.stopReason !== "done") {
        state.pendingApprovals = [];
        state.pendingQuestions = [];
      }
      return true;
    default:
      return false;
  }
}

function upsertTool(
  state: AppState,
  event: Extract<RuntimeEvent, { type: "tool.update" }>,
): void {
  const stateID = toolStateID(event);
  const previous = state.tools[stateID];
  // Arguments stream in fragments, so a consumer only sees the whole request
  // once they are reassembled.
  const argumentsRaw =
    (previous?.argumentsRaw ?? "") + (event.argumentsDelta ?? "");
  const tool: ToolBlock = {
    ...previous,
    name: event.name,
    callID: event.callID,
    status: event.status,
    summary: event.summary,
    argumentsRaw,
    ...(event.result !== undefined ? { result: event.result } : {}),
    ...(event.startedAt !== undefined ? { startedAt: event.startedAt } : {}),
    ...(event.endedAt !== undefined ? { endedAt: event.endedAt } : {}),
    ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
  };
  state.tools[stateID] = tool;
  upsertBlock(state, stateID, "tool", event.summary, event.status, { tool });

  // The todo list is a projection of the todo tool's own arguments; there is no
  // separate event for it.
  if (classifyTool(event.name, event.metadata) !== "todo") return;
  const parsed = parseToolArguments(argumentsRaw);
  if (!parsed.complete || !parsed.redactedJson) return;
  try {
    const input = JSON.parse(parsed.redactedJson) as Record<string, unknown>;
    const todos = parseTodoItems(input.items ?? input.todos);
    if (todos.length) state.todos = todos;
  } catch {
    // Partial or redacted arguments simply leave the previous list in place.
  }
}

function prepareStreamPhase(
  state: AppState,
  turnID: string,
  phase: "thinking" | "assistant",
): void {
  const previous = state.streamPhases[turnID];
  if (previous && previous !== phase)
    flushStream(state, streamID(turnID, previous));
  state.streamPhases[turnID] = phase;
}

function appendStream(
  state: AppState,
  input: {
    id: string;
    role: "thinking" | "assistant";
    text: string;
    attempt?: number;
    reasoningVisible?: boolean;
  },
): void {
  const stream = (state.streams[input.id] ??= newStream());
  // A retried attempt replaces the text of the attempt it supersedes rather than
  // appending to it, so a UI never shows two copies of one response.
  if (input.attempt !== undefined && input.attempt !== stream.attempt) {
    stream.attempt = input.attempt;
    stream.committed = "";
    stream.tail = "";
    removeStreamBlocks(state, input.id);
  }
  stream.tail += input.text;
  if (stream.committed.length + stream.tail.length > streamSegmentChars) {
    // Confirm what we have and start a new segment, so one enormous response
    // does not become a single unbounded block.
    commitStream(state, input.id, input.role, input.reasoningVisible);
    stream.segmentIndex += 1;
    stream.committed = "";
    return;
  }
  writeStreamBlock(state, input.id, input.role, input.reasoningVisible);
}

/** Reflects the stream into its block without confirming the tail. */
function writeStreamBlock(
  state: AppState,
  id: string,
  role: "thinking" | "assistant",
  reasoningVisible?: boolean,
): void {
  const stream = state.streams[id];
  if (!stream) return;
  upsertBlock(
    state,
    segmentID(id, stream.segmentIndex),
    role,
    stream.committed,
    undefined,
    {
      pendingText: stream.tail,
      ...(role === "thinking" ? { reasoningVisible } : {}),
    },
  );
}

function commitStream(
  state: AppState,
  id: string,
  role: "thinking" | "assistant",
  reasoningVisible?: boolean,
): void {
  const stream = state.streams[id];
  if (!stream) return;
  stream.committed += stream.tail;
  stream.tail = "";
  upsertBlock(
    state,
    segmentID(id, stream.segmentIndex),
    role,
    stream.committed,
    undefined,
    {
      pendingText: "",
      ...(role === "thinking" ? { reasoningVisible } : {}),
    },
  );
}

/** Commits any buffered text so later output cannot interleave with it. */
export function flushStream(state: AppState, id: string): void {
  const stream = state.streams[id];
  if (!stream) return;
  if (!stream.tail && !stream.committed) return;
  const block = state.messages.find(
    (item) => item.id === segmentID(id, stream.segmentIndex),
  );
  commitStream(
    state,
    id,
    id.endsWith(":thinking") ? "thinking" : "assistant",
    block?.reasoningVisible,
  );
}

/**
 * After a tool card, subsequent model text belongs to a fresh segment so it
 * renders below the card instead of growing the block above it.
 */
function beginPostToolSegment(state: AppState, turnID: string): void {
  for (const role of ["thinking", "assistant"] as const) {
    const stream = state.streams[streamID(turnID, role)];
    if (!stream || (!stream.committed && !stream.tail)) continue;
    stream.segmentIndex += 1;
    stream.committed = "";
    stream.tail = "";
  }
}

/**
 * Discards text that streamed but was never confirmed. A cancelled turn must not
 * leave half a sentence in the record as though the model had said it.
 */
function dropStreamTail(state: AppState, turnID: string): void {
  for (const role of ["thinking", "assistant"] as const) {
    const id = streamID(turnID, role);
    const stream = state.streams[id];
    if (!stream) continue;
    stream.tail = "";
    const block = state.messages.find(
      (item) => item.id === segmentID(id, stream.segmentIndex),
    );
    if (block) block.pendingText = "";
  }
}

function removeStreamBlocks(state: AppState, id: string): void {
  state.messages = state.messages.filter(
    (block) => block.id !== id && !block.id.startsWith(`${id}:segment:`),
  );
}

/** Marks the last segment of a stream, which is the block a reader ends on. */
function markBlockStatus(state: AppState, id: string, status: string): void {
  const stream = state.streams[id];
  const target = stream ? segmentID(id, stream.segmentIndex) : id;
  const block = state.messages.find((item) => item.id === target);
  if (block) block.status = status;
}

function userText(
  event: Extract<RuntimeEvent, { type: "turn.submitted" }>,
): string {
  if (!event.attachments?.length) return event.text;
  const attachments = event.attachments
    .map(
      (attachment) =>
        `${attachment.filename} (${attachment.mediaType}, ${attachment.byteLength} bytes)`,
    )
    .join(", ");
  return `${event.text}\n\nAttachments: ${attachments}`;
}
