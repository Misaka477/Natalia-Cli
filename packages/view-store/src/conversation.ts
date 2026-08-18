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
  appendWithRetrySkip,
  splitMarkdownAtSafeBoundary,
  parseToolArguments,
  parseTodoItems,
  classifyTool,
  providerSafeThinkingSummary,
} from "@natalia/ui-model";
import {
  streamSegmentChars,
  upsertBlock,
  type AppState,
  type MessageBlock,
  type StreamState,
  type ToolBlock,
} from "./state";

/**
 * The part of projected state the streaming helpers write to. The main
 * transcript and the Live Work Chat conversation both stream with the same
 * markdown-safe segmentation machinery; `AppState` satisfies this structurally,
 * and the Chat projection passes its own arrays.
 */
export type StreamTarget = {
  messages: MessageBlock[];
  streams: Record<string, StreamState>;
  streamPhases: Record<string, "thinking" | "assistant">;
};

/** Upserts into an explicit messages array (the generic form of upsertBlock). */
export function upsertInto(
  messages: MessageBlock[],
  id: string,
  role: MessageBlock["role"],
  text: string,
  status?: string,
  extra?: Partial<MessageBlock>,
): void {
  const block = messages.find((item) => item.id === id);
  if (block) {
    block.text = text;
    if (status !== undefined) block.status = status;
    if (extra) Object.assign(block, extra);
    return;
  }
  messages.push({ id, role, text, pendingText: "", status, ...extra });
}

export function newStream(): StreamState {
  return {
    committed: "",
    tail: "",
    retrySkip: "",
    attempt: 1,
    segmentIndex: 0,
  };
}

/**
 * Prepares a turn's streams for a retry the runtime has announced.
 *
 * A retry means the attempt did not finish, so the two halves of a stream are
 * treated differently. Text markdown had already completed stays: a provider that
 * resumes rather than restarts continues from it, and it becomes the overlap a
 * provider that restarts will re-send and must have skipped. Text still in flight
 * is dropped, because it is a fragment of an attempt that failed — keeping it
 * would glue half of the failed attempt onto the front of the new answer whenever
 * the retry does not happen to re-send exactly that fragment.
 *
 * The announced attempt is recorded on the stream because the resent deltas may
 * carry an `attempt` stamp. That stamp is the *other* way a supersede can be
 * signalled — for a retry nobody announced — and the two must not both act: the
 * stamp discards the confirmed text while the overlap skip assumes it is still
 * there, which drops everything up to the point where the resend diverges.
 */
export function resetStreamsForRetry(
  state: AppState,
  turnID: string,
  attempt?: number,
): void {
  for (const role of ["thinking", "assistant"] as const) {
    const id = streamID(turnID, role);
    const stream = state.streams[id];
    if (!stream) continue;
    stream.tail = "";
    stream.retrySkip = stream.committed;
    if (attempt !== undefined) stream.attempt = attempt;
    const block = state.messages.find(
      (item) => item.id === segmentID(id, stream.segmentIndex),
    );
    if (block) {
      block.text = stream.committed;
      block.pendingText = "";
    }
  }
}

export function streamID(turnID: string, role: "thinking" | "assistant") {
  return `${turnID}:${role}`;
}

export function segmentID(baseID: string, index: number) {
  if (index === 0) return baseID;
  return `${baseID}:segment:${index}`;
}

/**
 * The turn a tool event belongs to.
 *
 * The runtime publishes tool events with `id` set to `${turnID}:${callID}` and
 * the call id repeated in `callID`, so the id has to be normalised before it can
 * be used to reach the turn's streams. Taking `id` at face value files the card
 * under a turn that does not exist: the model text streaming above the call is
 * never committed and no new segment opens, so the card sinks below text that
 * arrived after it and the text from before and after the call merge into one
 * block.
 */
export function turnIDForTool(event: { id: string; callID?: string }): string {
  // Only a suffix that is actually there is stripped, so a producer that already
  // publishes the bare turn id is left alone.
  const suffix = `:${event.callID}`;
  return event.callID && event.id.endsWith(suffix)
    ? event.id.slice(0, -suffix.length)
    : event.id;
}

export function toolStateID(event: {
  id: string;
  name: string;
  callID?: string;
}) {
  return `${turnIDForTool(event)}:tool:${event.callID ?? event.name}`;
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
    case "session.title.updated":
      if (state.sessionID && state.sessionID !== event.sessionID) return false;
      state.title = event.title;
      return true;
    case "session.ready":
      state.status = "ready";
      return true;
    case "turn.submitted":
      if (event.delivery !== "queue") state.activeTurn = event.id;
      state.lastSubmission = event;
      state.lastStopReason = undefined;
      state.streams[streamID(event.id, "thinking")] = newStream();
      state.streams[streamID(event.id, "assistant")] = newStream();
      state.messages.push({
        id: `${event.id}:user`,
        role: "user",
        text: userText(event),
        pendingText: "",
        status: event.delivery === "queue" ? "queued" : undefined,
      });
      return true;
    case "turn.started":
      markTurnStarted(state, event.id);
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
      markTurnStarted(state, event.id);
      prepareStreamPhase(state, event.id, "thinking");
      // A provider that forbids showing its reasoning is obeyed by never
      // retaining the text: not in the block, and not in the stream either, so
      // there is nowhere for a consumer to read it from.
      if (event.visible === false) {
        recordHiddenThinking(state, streamID(event.id, "thinking"));
        return true;
      }
      appendStream(state, {
        id: streamID(event.id, "thinking"),
        role: "thinking",
        text: event.text,
        attempt: event.attempt,
        reasoningVisible: true,
      });
      return true;
    case "thinking.done":
      flushStream(state, streamID(event.id, "thinking"));
      markBlockStatus(state, streamID(event.id, "thinking"), "completed");
      return true;
    case "content.delta":
      markTurnStarted(state, event.id);
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
      const turnID = turnIDForTool(event);
      markTurnStarted(state, turnID);
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
      if (state.activeTurn === event.id) state.activeTurn = undefined;
      markTurnCancelled(state, event.id);
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
      markTurnStarted(state, event.id);
      flushStream(state, streamID(event.id, "thinking"));
      flushStream(state, streamID(event.id, "assistant"));
      // A turn that has finished has finished reasoning, whether or not the
      // provider bothered to send `thinking.done` — many do not, and the row would
      // otherwise sit there unmarked for the rest of the session.
      markBlockStatus(state, streamID(event.id, "thinking"), "completed");
      releaseStreams(state, event.id);
      if (state.activeTurn === event.id) state.activeTurn = undefined;
      state.paused = false;
      state.lastStopReason = event.stopReason;
      state.footer =
        event.stopReason === "done"
          ? "Ready"
          : event.stopReason === "waiting_human"
            ? "Waiting for a human on a terminal"
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

function markTurnStarted(state: AppState, turnID: string) {
  state.activeTurn = turnID;
  const user = state.messages.find((block) => block.id === `${turnID}:user`);
  if (user?.status === "queued") user.status = undefined;
}

function markTurnCancelled(state: AppState, turnID: string) {
  const user = state.messages.find((block) => block.id === `${turnID}:user`);
  if (user?.status === "queued") user.status = "cancelled";
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
  if (
    classifyTool(event.name, event.metadata) !== "todo" ||
    event.status !== "succeeded"
  )
    return;
  const parsed = parseToolArguments(argumentsRaw);
  if (!parsed.complete || !parsed.redactedJson) return;
  try {
    const input = JSON.parse(parsed.redactedJson) as Record<string, unknown>;
    const candidate = input.items ?? input.todos;
    if (Array.isArray(candidate)) state.todos = parseTodoItems(candidate);
  } catch {
    // Partial or redacted arguments simply leave the previous list in place.
  }
}

/**
 * Notes that hidden reasoning arrived, without keeping any of it. The block shows
 * the provider-safe summary so a consumer can tell thinking happened, and
 * `reasoningVisible: false` lets it hide the row entirely if it prefers.
 */
function recordHiddenThinking(state: AppState, id: string): void {
  const stream = (state.streams[id] ??= newStream());
  upsertBlock(
    state,
    segmentID(id, stream.segmentIndex),
    "thinking",
    providerSafeThinkingSummary(false, "x"),
    undefined,
    { pendingText: "", reasoningVisible: false },
  );
}

/**
 * Whether the text ends inside an unclosed fenced block. Counting fence openers is
 * enough: they alternate open/close, so an odd count means one is still open.
 */
function insideFence(text: string): boolean {
  let open = 0;
  for (const line of text.split("\n"))
    if (/^\s*(?:```+|~~~+)/u.test(line)) open += 1;
  return open % 2 === 1;
}

function prepareStreamPhase(
  target: StreamTarget,
  turnID: string,
  phase: "thinking" | "assistant",
): void {
  const previous = target.streamPhases[turnID];
  if (previous === phase) return;
  if (previous) flushStream(target, streamID(turnID, previous));
  // Returning to a phase that already rendered text means the model alternated
  // between reasoning and answering. The new text belongs *below* whatever the
  // other phase wrote in between, so it opens a new segment instead of growing
  // the block above it — otherwise a second thought merges into the first and the
  // answer that came before it ends up rendered underneath, which is no longer
  // the order the model produced them in.
  const stream = target.streams[streamID(turnID, phase)];
  if (stream && (stream.committed || stream.tail)) {
    stream.segmentIndex += 1;
    stream.committed = "";
    stream.tail = "";
  }
  target.streamPhases[turnID] = phase;
}

function appendStream(
  target: StreamTarget,
  input: {
    id: string;
    role: "thinking" | "assistant";
    text: string;
    attempt?: number;
    reasoningVisible?: boolean;
  },
): void {
  const stream = (target.streams[input.id] ??= newStream());
  // A retried attempt replaces the text of the attempt it supersedes rather than
  // appending to it, so a UI never shows two copies of one response.
  if (input.attempt !== undefined && input.attempt !== stream.attempt) {
    stream.attempt = input.attempt;
    stream.committed = "";
    stream.tail = "";
    target.messages = target.messages.filter(
      (block) =>
        block.id !== input.id && !block.id.startsWith(`${input.id}:segment:`),
    );
  }
  const applied = appendWithRetrySkip(input.text, stream.retrySkip);
  stream.retrySkip = applied.retrySkip;
  if (!applied.text && applied.retrySkip) {
    // The whole chunk was text we already have; nothing to render yet.
    writeStreamBlock(target, input.id, input.role, input.reasoningVisible);
    return;
  }
  stream.tail += applied.text;
  // Confirm as much as markdown says is complete, as it arrives. `text` claims to
  // be the confirmed record and `pendingText` the part not confirmed yet, and
  // nothing else in this layer moves text between them until some later event
  // flushes the stream. Without this the claim was false for the whole of a live
  // response: it stayed unconfirmed to the end, so cancelling a turn discarded an
  // answer the reader had already read, and a consumer rendering `text` as
  // markdown and `pendingText` as provisional had nothing to render until the
  // turn was over.
  const settled = splitMarkdownAtSafeBoundary(stream.tail);
  if (settled.committed) {
    stream.committed += settled.committed;
    stream.tail = settled.tail;
  }
  if (stream.committed.length + stream.tail.length > streamSegmentChars) {
    // One enormous response must not become a single unbounded block. Close the
    // segment at the boundary already confirmed above; that is by construction
    // outside any markdown construct, so neither segment is left holding an
    // unpaired fence that would make a renderer swallow the rest.
    //
    // With nothing confirmed there is no boundary to use: a hard split is still
    // safe while we are outside a fence, which keeps the size bound real for
    // prose that offers no boundary at all. Inside an open fence, keep
    // accumulating — a readable block beats an exactly sized one, and the fence
    // must close.
    const cut = stream.committed
      ? 0
      : insideFence(stream.tail)
        ? -1
        : Math.max(0, streamSegmentChars - stream.committed.length);
    if (cut >= 0) {
      const carried = stream.tail.slice(cut);
      stream.tail = stream.tail.slice(0, cut);
      commitStream(target, input.id, input.role, input.reasoningVisible);
      stream.segmentIndex += 1;
      stream.committed = "";
      stream.tail = carried;
      writeStreamBlock(target, input.id, input.role, input.reasoningVisible);
      return;
    }
  }
  writeStreamBlock(target, input.id, input.role, input.reasoningVisible);
}

/** Reflects the stream into its block without confirming the tail. */
function writeStreamBlock(
  target: StreamTarget,
  id: string,
  role: "thinking" | "assistant",
  reasoningVisible?: boolean,
): void {
  const stream = target.streams[id];
  if (!stream) return;
  // A segment that has just opened with nothing carried into it has nothing to
  // show, and a block with no text renders as an empty gap in the transcript.
  if (!stream.committed && !stream.tail) return;
  upsertInto(
    target.messages,
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
  target: StreamTarget,
  id: string,
  role: "thinking" | "assistant",
  reasoningVisible?: boolean,
): void {
  const stream = target.streams[id];
  if (!stream) return;
  stream.committed += stream.tail;
  stream.tail = "";
  upsertInto(
    target.messages,
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
export function flushStream(target: StreamTarget, id: string): void {
  const stream = target.streams[id];
  if (!stream) return;
  if (!stream.tail && !stream.committed) return;
  const block = target.messages.find(
    (item) => item.id === segmentID(id, stream.segmentIndex),
  );
  commitStream(
    target,
    id,
    id.endsWith(":thinking") ? "thinking" : "assistant",
    block?.reasoningVisible,
  );
}

/**
 * After a tool card, subsequent model text belongs to a fresh segment so it
 * renders below the card instead of growing the block above it.
 */
function beginPostToolSegment(target: StreamTarget, turnID: string): void {
  for (const role of ["thinking", "assistant"] as const) {
    const stream = target.streams[streamID(turnID, role)];
    if (!stream || (!stream.committed && !stream.tail)) continue;
    stream.segmentIndex += 1;
    stream.committed = "";
    stream.tail = "";
  }
}

/**
 * Releases a settled turn's streaming buffers.
 *
 * A stream holds the confirmed text of its turn, which the transcript already
 * has. Keeping it after the turn ends means the projection carries a second copy
 * of every response for the life of the session, growing with two entries per
 * turn and untouched by transcript eviction, because eviction bounds `messages`
 * and nothing bounds this. The phase marker goes too: it only describes a turn in
 * progress.
 */
function releaseStreams(state: AppState, turnID: string): void {
  for (const role of ["thinking", "assistant"] as const)
    delete state.streams[streamID(turnID, role)];
  delete state.streamPhases[turnID];
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

function chatTarget(state: AppState): StreamTarget {
  return {
    messages: state.chatMessages,
    streams: state.chatStreams,
    streamPhases: state.chatStreamPhases,
  };
}

/**
 * Projects the Live Work Chat conversation through the same streaming machinery
 * as the main transcript (§8.3: one projection, not a separate drift-prone
 * copy). `chat.message.delta` streams into an assistant stream keyed by the
 * message id, `chat.thinking.delta` into a thinking stream, the final
 * `chat.message.added` flushes and (on replay) synthesizes the block, tool
 * actions narrate as system rows, and `chat.rollback` truncates at a boundary.
 */
export function applyChatEvent(state: AppState, event: RuntimeEvent): boolean {
  switch (event.type) {
    case "chat.turn.started":
      state.chatActivity = {
        messageID: event.messageID,
        phase: "waiting",
        startedAt: event.startedAt,
      };
      return true;
    case "chat.turn.phase":
      if (state.chatActivity?.messageID === event.messageID) {
        state.chatActivity.phase = event.phase;
        state.chatActivity.toolName = event.toolName;
      }
      return true;
    case "chat.turn.finished":
      if (state.chatActivity?.messageID === event.messageID)
        state.chatActivity = undefined;
      return true;
    case "chat.message.added": {
      if (event.role === "user") {
        state.chatMessages.push({
          id: `chat:${event.messageID}:user`,
          role: "user",
          text: event.text,
          pendingText: "",
        });
        return true;
      }
      const key = `chat:${event.messageID}:assistant`;
      flushStream(chatTarget(state), key);
      const stream = state.chatStreams[key];
      const currentID = stream ? segmentID(key, stream.segmentIndex) : key;
      const current = state.chatMessages.find(
        (block) => block.id === currentID,
      );
      // Live streaming has already filled the segment; durable replay is the
      // case where this is the only place the text can come from.
      const alreadyRendered = Boolean(
        current && (current.text || current.pendingText),
      );
      if (event.text && !alreadyRendered)
        upsertInto(state.chatMessages, currentID, "assistant", event.text);
      delete state.chatStreams[key];
      delete state.chatStreams[`chat:${event.messageID}:thinking`];
      delete state.chatStreamPhases[`chat:${event.messageID}`];
      return true;
    }
    case "chat.message.delta":
      prepareStreamPhase(
        chatTarget(state),
        `chat:${event.messageID}`,
        "assistant",
      );
      appendStream(chatTarget(state), {
        id: `chat:${event.messageID}:assistant`,
        role: "assistant",
        text: event.text,
      });
      return true;
    case "chat.thinking.delta":
      prepareStreamPhase(
        chatTarget(state),
        `chat:${event.messageID}`,
        "thinking",
      );
      appendStream(chatTarget(state), {
        id: `chat:${event.messageID}:thinking`,
        role: "thinking",
        text: event.text,
      });
      return true;
    case "chat.tool.used": {
      // Mirrors the transcript's `tool.update`: commit any in-flight text,
      // open a fresh segment so the model's post-tool reply renders BELOW the
      // card (not merged into the block above it), then insert the card.
      const turnKey = `chat:${event.messageID}`;
      const target = chatTarget(state);
      flushStream(target, `${turnKey}:thinking`);
      flushStream(target, `${turnKey}:assistant`);
      beginPostToolSegment(target, turnKey);
      delete target.streamPhases[turnKey];
      const tool: ToolBlock = {
        name: event.toolName,
        status: event.status,
        summary: event.summary,
        argumentsRaw: event.argumentsRaw ?? "",
        ...(event.result !== undefined ? { result: event.result } : {}),
        ...(event.startedAt !== undefined
          ? { startedAt: event.startedAt }
          : {}),
        ...(event.endedAt !== undefined ? { endedAt: event.endedAt } : {}),
      };
      upsertInto(
        state.chatMessages,
        `chat:${event.id}:tool`,
        "tool",
        event.summary,
        event.status,
        { tool },
      );
      return true;
    }
    case "chat.rollback": {
      const boundary = `chat:${event.toMessageID}`;
      const index = state.chatMessages.findIndex(
        (block) => block.id === `${boundary}:user`,
      );
      if (index !== -1) state.chatMessages.splice(index + 1);
      else state.chatMessages.length = 0;
      state.chatStreams = {};
      state.chatStreamPhases = {};
      return true;
    }
    case "collab.suggestion":
      upsertInto(
        state.chatMessages,
        `chat:${event.id}:collab`,
        "system",
        `Navi → Natalia: ${event.suggestion}`,
      );
      return true;
    case "collab.notice":
      upsertInto(
        state.chatMessages,
        `chat:${event.id}:collab`,
        "system",
        `Natalia → Navi: [${event.noticeType}] ${event.notice}`,
      );
      return true;
    case "collab.question":
      upsertInto(
        state.chatMessages,
        `chat:${event.id}:collab`,
        "system",
        `Natalia → Navi: ${event.question}`,
      );
      return true;
    case "collab.answer":
      upsertInto(
        state.chatMessages,
        `chat:${event.id}:collab`,
        "system",
        `Navi → Natalia: ${event.answer}`,
      );
      return true;
    case "collab.response":
      upsertInto(
        state.chatMessages,
        `chat:${event.id}:collab`,
        "system",
        `Natalia ${event.decision} the suggestion${event.reason ? ` (${event.reason})` : ""}`,
      );
      return true;
    default:
      return false;
  }
}
