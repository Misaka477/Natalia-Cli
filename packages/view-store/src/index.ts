/**
 * `@natalia/view-store` — the pure TypeScript projection of a `RuntimeEvent`
 * stream into displayable state.
 *
 * This is the layer an externally built UI consumes so it does not have to
 * reimplement the runtime's event semantics. It is deliberately framework-free:
 * no Solid, no OpenTUI, no DOM. `applyEvent` mutates a plain object and
 * `reduceState` returns a new one by explicit copy rather than
 * `structuredClone`, because cloning a reactive proxy is what broke the first
 * attempt at this layer.
 *
 * What this layer must never do:
 *   - execute tools
 *   - own session persistence
 *   - decide policy or approval
 *   - hold credentials
 *   - invent UI-only durable truth
 *
 * The last rule is why `dialog`, modal stacks, scroll anchors, pane focus and
 * keybindings are absent: those belong to a specific UI, not to a shared
 * projection. `pendingApprovals` and `pendingQuestions` are present because they
 * are runtime facts, but this layer only *reports* them; deciding them is the
 * runtime's job.
 *
 * Scope, stated honestly: this projects the conversation core — session
 * identity, turn lifecycle, thinking/assistant streaming, tool cards, pending
 * interactive requests and status. Terminal panes, sandboxes, checkpoints,
 * subagents, retry and compaction banners and todos are *not* projected here
 * yet; a consumer that needs them still has to read the raw events. See
 */
import type {
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
} from "@natalia/contracts";

/** How many characters a single streamed block accumulates before it segments. */
export const streamSegmentChars = 6000;

export type MessageBlock = {
  id: string;
  role: "user" | "assistant" | "thinking" | "system" | "tool";
  /** Text the runtime has confirmed. Safe to keep in a transcript. */
  text: string;
  /**
   * Text streamed but not yet confirmed. A UI renders `text + pendingText`; a
   * transcript keeps only `text`. Cancelling a turn drops the pending part,
   * because unconfirmed partial output is not part of the record.
   */
  pendingText: string;
  status?: string;
  /** Present only on thinking blocks the provider allows a UI to render. */
  reasoningVisible?: boolean;
  tool?: ToolBlock;
};

export type ToolBlock = {
  name: string;
  callID?: string;
  status: string;
  summary: string;
  result?: string;
  startedAt?: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
};

export type StreamState = {
  /** Text already confirmed into a block. */
  committed: string;
  /** Text streamed but not yet confirmed. */
  tail: string;
  attempt: number;
  segmentIndex: number;
};

/** What a UI should display for a block: confirmed text plus streaming tail. */
export function displayText(block: MessageBlock): string {
  return block.text + block.pendingText;
}

export type PendingApproval = Extract<
  RuntimeEvent,
  { type: "approval.request" }
>;
export type PendingQuestion = Extract<
  RuntimeEvent,
  { type: "question.request" }
>;

export type AppState = {
  sessionID?: SessionID;
  title: string;
  status: string;
  footer: string;
  statusSegments: string[];
  messages: MessageBlock[];
  activeTurn?: string;
  lastSubmission?: SubmittedTurn;
  lastStopReason?: "done" | "cancelled" | "error";
  streams: Record<string, StreamState>;
  streamPhases: Record<string, "thinking" | "assistant">;
  tools: Record<string, ToolBlock>;
  pendingApprovals: PendingApproval[];
  pendingQuestions: PendingQuestion[];
};

export function initialState(): AppState {
  return {
    title: "New session",
    status: "booting",
    footer: "Ready",
    statusSegments: [
      "mode:runtime",
      "model:not-connected",
      "provider:not-connected",
    ],
    messages: [],
    streams: {},
    streamPhases: {},
    tools: {},
    pendingApprovals: [],
    pendingQuestions: [],
  };
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

export function cloneState(state: AppState): AppState {
  return {
    ...state,
    statusSegments: [...state.statusSegments],
    messages: state.messages.map((block) => ({
      ...block,
      ...(block.tool ? { tool: { ...block.tool } } : {}),
    })),
    streams: Object.fromEntries(
      Object.entries(state.streams).map(([key, value]) => [key, { ...value }]),
    ),
    streamPhases: { ...state.streamPhases },
    tools: Object.fromEntries(
      Object.entries(state.tools).map(([key, value]) => [key, { ...value }]),
    ),
    pendingApprovals: [...state.pendingApprovals],
    pendingQuestions: [...state.pendingQuestions],
  };
}

/** Mutates `state` in place. Unknown events are ignored, never fatal. */
export function applyEvent(state: AppState, event: RuntimeEvent): void {
  switch (event.type) {
    case "session.created":
      state.sessionID = event.sessionID;
      state.title = event.title;
      return;
    case "session.ready":
      state.status = "ready";
      return;
    case "status.update":
      state.status = event.status;
      state.footer = [event.status, event.detail].filter(Boolean).join(" - ");
      return;
    case "status.snapshot":
      state.statusSegments = [
        "mode:runtime",
        `model:${event.model}`,
        `provider:${event.provider}`,
        `ctx:${event.context}`,
        `step:${event.step}`,
        event.permissions,
        `bg:${event.background}`,
      ];
      return;
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
      return;
    case "thinking.delta":
      prepareStreamPhase(state, event.id, "thinking");
      appendStream(state, {
        id: streamID(event.id, "thinking"),
        role: "thinking",
        text: event.text,
        attempt: event.attempt,
        reasoningVisible: event.visible !== false,
      });
      return;
    case "thinking.done":
      flushStream(state, streamID(event.id, "thinking"));
      markBlockStatus(state, streamID(event.id, "thinking"), "completed");
      return;
    case "content.delta":
      prepareStreamPhase(state, event.id, "assistant");
      appendStream(state, {
        id: streamID(event.id, "assistant"),
        role: "assistant",
        text: event.text,
        attempt: event.attempt,
      });
      return;
    case "content.done": {
      const key = streamID(event.id, "assistant");
      flushStream(state, key);
      const stream = state.streams[key];
      const currentID = stream ? segmentID(key, stream.segmentIndex) : key;
      const current = state.messages.find((block) => block.id === currentID);
      // Live streaming has already filled this segment from deltas, so there is
      // nothing to synthesize. Durable history is the opposite case: deltas are
      // live-only events and never journaled, so a replaying consumer sees a
      // bare `content.done` per provider step and this is the only place the
      // text can come from.
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
      return;
    }
    case "tool.update": {
      const turnID = turnIDForToolEvent(event);
      // Model output is committed before its tool card, so a tool update never
      // reorders text around itself.
      flushStream(state, streamID(turnID, "thinking"));
      flushStream(state, streamID(turnID, "assistant"));
      beginPostToolSegment(state, turnID);
      delete state.streamPhases[turnID];
      upsertTool(state, event);
      return;
    }
    case "approval.request":
      state.pendingApprovals = [
        ...state.pendingApprovals.filter((item) => item.id !== event.id),
        event,
      ];
      return;
    case "approval.response":
      state.pendingApprovals = state.pendingApprovals.filter(
        (item) => item.id !== event.id,
      );
      return;
    case "question.request":
      state.pendingQuestions = [
        ...state.pendingQuestions.filter((item) => item.id !== event.id),
        event,
      ];
      return;
    case "question.response":
      state.pendingQuestions = state.pendingQuestions.filter(
        (item) => item.id !== event.id,
      );
      return;
    case "turn.cancelled":
      state.activeTurn = undefined;
      state.lastStopReason = "cancelled";
      state.footer = `cancelled: ${event.reason}`;
      dropStreamTail(state, event.id);
      upsertBlock(
        state,
        `${event.id}:cancelled`,
        "system",
        `cancelled: ${event.reason}`,
      );
      // A cancelled turn must not leave a pending request that nobody will
      // answer, or a consumer would render a prompt forever.
      state.pendingApprovals = [];
      state.pendingQuestions = [];
      return;
    case "turn.finished":
      flushStream(state, streamID(event.id, "thinking"));
      flushStream(state, streamID(event.id, "assistant"));
      if (state.activeTurn === event.id) state.activeTurn = undefined;
      state.lastStopReason = event.stopReason;
      state.footer =
        event.stopReason === "done"
          ? "Ready"
          : `turn ${event.stopReason}${event.reason ? `: ${event.reason}` : ""}`;
      if (event.stopReason !== "done") {
        state.pendingApprovals = [];
        state.pendingQuestions = [];
      }
      return;
    case "diagnostic":
      state.footer = `${event.level}: ${event.message}`;
      return;
    default:
      return;
  }
}

export function newStream(): StreamState {
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

/**
 * A tool event's `id` is the turn for model-driven calls, but resource tools can
 * report against a synthetic id. Anything that is not a known stream falls back
 * to the active turn so its output still lands in the right conversation.
 */
export function turnIDForToolEvent(
  event: { id: string },
  activeTurn?: string,
): string {
  return event.id || activeTurn || "";
}

export function upsertBlock(
  state: AppState,
  id: string,
  role: MessageBlock["role"],
  text: string,
  status?: string,
  extra?: Partial<MessageBlock>,
): void {
  const block = state.messages.find((item) => item.id === id);
  if (block) {
    block.text = text;
    if (status !== undefined) block.status = status;
    if (extra) Object.assign(block, extra);
    return;
  }
  state.messages.push({ id, role, text, pendingText: "", status, ...extra });
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
  // A retried attempt replaces the text of the attempt it supersedes rather
  // than appending to it, so a UI never shows two copies of one response.
  if (input.attempt !== undefined && input.attempt !== stream.attempt) {
    stream.attempt = input.attempt;
    stream.committed = "";
    stream.tail = "";
    removeStreamBlocks(state, input.id);
  }
  stream.tail += input.text;
  if (stream.committed.length + stream.tail.length > streamSegmentChars) {
    // Confirm what we have and start a new segment, so one enormous response does
    // not become a single unbounded block.
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

function removeStreamBlocks(state: AppState, id: string): void {
  state.messages = state.messages.filter(
    (block) => block.id !== id && !block.id.startsWith(`${id}:segment:`),
  );
}

function upsertTool(
  state: AppState,
  event: Extract<RuntimeEvent, { type: "tool.update" }>,
): void {
  const stateID = toolStateID(event);
  const tool: ToolBlock = {
    ...state.tools[stateID],
    name: event.name,
    callID: event.callID,
    status: event.status,
    summary: event.summary,
    ...(event.result !== undefined ? { result: event.result } : {}),
    ...(event.startedAt !== undefined ? { startedAt: event.startedAt } : {}),
    ...(event.endedAt !== undefined ? { endedAt: event.endedAt } : {}),
    ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
  };
  state.tools[stateID] = tool;
  upsertBlock(state, stateID, "tool", event.summary, event.status, { tool });
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
