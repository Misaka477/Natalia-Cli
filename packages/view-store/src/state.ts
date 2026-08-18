/**
 * The projected state an external UI renders, and the primitives every
 * projection module shares.
 *
 * Kept separate from the projection logic so adding a new surface means adding a
 * slice here plus one module, not editing a single growing switch.
 */
import type {
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
} from "@natalia/contracts";
import type { TodoView } from "@natalia/ui-model";

/** How many characters a single streamed block accumulates before it segments. */
export const streamSegmentChars = 6000;
/**
 * Bounds on the histories a long session accumulates. A projection that grows
 * without limit is a leak in every consumer that holds it.
 */
export const terminalTimelineLimit = 200;
export const subagentHistoryLimit = 100;
export const policyDecisionLimit = 200;
export const checkpointLimit = 200;
/**
 * A terminal's transcript grows for as long as the pane lives, so the projection
 * keeps a bounded tail with an explicit note about what was dropped. Storing the
 * event as-is would grow without limit for the whole session.
 */
export const terminalTranscriptChars = 12_000;

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
  /** Accumulated raw arguments, so a consumer can show what was requested. */
  argumentsRaw: string;
};

export type StreamState = {
  /** Text already confirmed into a block. */
  committed: string;
  /** Text streamed but not yet confirmed. */
  tail: string;
  /**
   * Text a retry is expected to send again. A provider that retries restarts its
   * stream, so the overlap has to be skipped or the response renders twice.
   */
  retrySkip: string;
  attempt: number;
  segmentIndex: number;
};

export type TerminalView = Extract<RuntimeEvent, { type: "terminal.update" }>;
export type TerminalTimelineEntry = Extract<
  RuntimeEvent,
  { type: "terminal.timeline" }
>;
export type TerminalApprovalView = Extract<
  RuntimeEvent,
  { type: "terminal.approval" }
>;
export type SandboxView = Extract<RuntimeEvent, { type: "sandbox.update" }>;
export type SandboxDiffView = Extract<RuntimeEvent, { type: "sandbox.diff" }>;
export type SubagentView = Extract<RuntimeEvent, { type: "subagent.update" }>;
export type McpView = Extract<RuntimeEvent, { type: "mcp.status" }>;
export type PluginView = Extract<RuntimeEvent, { type: "plugin.update" }>;
export type CapabilityView = Extract<
  RuntimeEvent,
  { type: "capability.loaded" }
>;
export type CheckpointView = Extract<
  RuntimeEvent,
  { type: "checkpoint.created" }
>;
export type ContextView = Extract<RuntimeEvent, { type: "context.status" }>;
export type PolicyDecisionView = Extract<
  RuntimeEvent,
  { type: "policy.decision" }
>;
export type WorkGraphNodeView = Extract<
  RuntimeEvent,
  { type: "workgraph.node_added" }
>;
export type WorkGraphEdgeView = Extract<
  RuntimeEvent,
  { type: "workgraph.edge_added" }
>;
export type SessionIntelligenceView = Extract<
  RuntimeEvent,
  { type: "session.snapshot" }
>;
export type PendingApproval = Extract<
  RuntimeEvent,
  { type: "approval.request" }
>;
export type PendingQuestion = Extract<
  RuntimeEvent,
  { type: "question.request" }
>;

/**
 * A live unit of runtime work. Consumers render these facts in their own visual
 * language rather than reinterpreting the complete runtime event stream.
 */
export type ActivityKind =
  | "planning"
  | "thinking"
  | "generating"
  | "tool"
  | "command"
  | "workflow"
  | "subagent"
  | "compacting"
  | "retrying"
  | "waiting_for_user"
  | "paused";

export type ActivityState = "active" | "waiting" | "paused";

export type ActivityView = {
  /** Stable source identity, so replaying an event updates instead of duplicates. */
  id: string;
  kind: ActivityKind;
  state: ActivityState;
  /** The turn that owns this work, when the runtime exposes one. */
  turnID?: string;
  /** Runtime-provided name or title, deliberately not UI-localized prose. */
  label?: string;
  /** Runtime-provided detail such as a command or tool summary. */
  detail?: string;
};

export type ChatActivityView = {
  messageID: string;
  phase: "waiting" | "thinking" | "generating" | "using_tool";
  startedAt: number;
  toolName?: string;
  error?: string;
};

/** An advisory line a UI shows while something transient is happening. */
export type Banner = { text: string; kind: string };

/** Rollback is a workspace-wide operation, so at most one is in flight. */
export type RollbackView = {
  checkpointID: string;
  safetyCheckpointID?: string;
  state: "previewed" | "running" | "completed" | "failed";
  dryRun?: boolean;
  restoredFiles?: number;
  deletedFiles?: number;
  message?: string;
  recovered?: boolean;
};

export type AppState = {
  // conversation
  sessionID?: SessionID;
  title: string;
  status: string;
  footer: string;
  statusSegments: string[];
  messages: MessageBlock[];
  activeTurn?: string;
  paused: boolean;
  lastSubmission?: SubmittedTurn;
  lastStopReason?: "done" | "cancelled" | "error" | "waiting_human";
  streams: Record<string, StreamState>;
  streamPhases: Record<string, "thinking" | "assistant">;
  tools: Record<string, ToolBlock>;
  todos: TodoView[];
  pendingApprovals: PendingApproval[];
  pendingQuestions: PendingQuestion[];
  /** All currently live work; settled activities are removed by the projection. */
  activities: Record<string, ActivityView>;

  // live work chat
  /** The Chat conversation, projected like the main transcript (§8.3). */
  chatMessages: MessageBlock[];
  chatStreams: Record<string, StreamState>;
  chatStreamPhases: Record<string, "thinking" | "assistant">;
  chatActivity?: ChatActivityView;

  // resources
  terminals: Record<string, TerminalView>;
  terminalTimeline: Record<string, TerminalTimelineEntry[]>;
  terminalApprovals: Record<string, TerminalApprovalView>;
  sandboxes: Record<string, SandboxView>;
  sandboxDiffs: Record<string, SandboxDiffView>;
  subagents: Record<string, SubagentView>;
  subagentHistory: Record<string, SubagentView[]>;
  mcp: Record<string, McpView>;
  plugins: Record<string, PluginView>;
  capabilities: Record<string, CapabilityView>;
  checkpoints: CheckpointView[];
  rollback?: RollbackView;

  // status and advisories
  context?: ContextView;
  compactionBanner?: Banner;
  retryBanner?: Banner;
  agentSelection?: { name?: string; pending: boolean };
  modelSelection?: { modelID?: string; variant?: string };
  /** Recent policy outcomes, so a UI can explain why a tool did not run. */
  policyDecisions: PolicyDecisionView[];
  workGraphNodes: Record<string, WorkGraphNodeView>;
  workGraphEdges: Record<string, WorkGraphEdgeView>;
  intelligence?: SessionIntelligenceView;
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
    paused: false,
    streams: {},
    streamPhases: {},
    tools: {},
    todos: [],
    pendingApprovals: [],
    pendingQuestions: [],
    activities: {},
    chatMessages: [],
    chatStreams: {},
    chatStreamPhases: {},
    terminals: {},
    terminalTimeline: {},
    terminalApprovals: {},
    sandboxes: {},
    sandboxDiffs: {},
    subagents: {},
    subagentHistory: {},
    mcp: {},
    plugins: {},
    capabilities: {},
    checkpoints: [],
    policyDecisions: [],
    workGraphNodes: {},
    workGraphEdges: {},
  };
}

/**
 * Copies enough of the state that `applyEvent` cannot mutate the previous one.
 * Explicit rather than `structuredClone` because cloning a reactive proxy is
 * what broke the first attempt at this layer.
 */
export function cloneState(state: AppState): AppState {
  return {
    ...state,
    statusSegments: [...state.statusSegments],
    messages: state.messages.map((block) => ({
      ...block,
      ...(block.tool ? { tool: { ...block.tool } } : {}),
    })),
    streams: mapRecord(state.streams, (value) => ({ ...value })),
    streamPhases: { ...state.streamPhases },
    tools: mapRecord(state.tools, (value) => ({ ...value })),
    todos: [...state.todos],
    pendingApprovals: [...state.pendingApprovals],
    pendingQuestions: [...state.pendingQuestions],
    activities: mapRecord(state.activities, (value) => ({ ...value })),
    chatMessages: state.chatMessages.map((block) => ({
      ...block,
      ...(block.tool ? { tool: { ...block.tool } } : {}),
    })),
    chatStreams: mapRecord(state.chatStreams, (value) => ({ ...value })),
    chatStreamPhases: { ...state.chatStreamPhases },
    terminals: { ...state.terminals },
    terminalTimeline: mapRecord(state.terminalTimeline, (value) => [...value]),
    terminalApprovals: { ...state.terminalApprovals },
    sandboxes: { ...state.sandboxes },
    sandboxDiffs: { ...state.sandboxDiffs },
    subagents: { ...state.subagents },
    subagentHistory: mapRecord(state.subagentHistory, (value) => [...value]),
    mcp: { ...state.mcp },
    plugins: { ...state.plugins },
    capabilities: { ...state.capabilities },
    checkpoints: [...state.checkpoints],
    policyDecisions: [...state.policyDecisions],
    workGraphNodes: { ...state.workGraphNodes },
    workGraphEdges: { ...state.workGraphEdges },
    ...(state.rollback ? { rollback: { ...state.rollback } } : {}),
  };
}

/** What a UI should display for a block: confirmed text plus streaming tail. */
export function displayText(block: MessageBlock): string {
  return block.text + block.pendingText;
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

/** Appends to a bounded history, dropping the oldest entries past the cap. */
export function appendBounded<T>(list: T[], entry: T, limit: number): T[] {
  const next = [...list, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function mapRecord<T>(
  record: Record<string, T>,
  map: (value: T) => T,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const key in record) next[key] = map(record[key] as T);
  return next;
}

/**
 * Transcript eviction.
 *
 * `messages` is deliberately unbounded: a transcript is the record, and silently
 * dropping conversation is a policy decision that belongs to the consumer, not to
 * a shared projection. A long-lived UI does need to evict, so the rule that makes
 * eviction safe lives here rather than being re-derived by every consumer:
 * **evict whole user turns only**. Dropping a partial turn leaves an assistant
 * reply with no prompt above it, which reads as the assistant answering nothing.
 *
 * Durable history stays reloadable by cursor, so eviction loses nothing permanent.
 */
export const transcriptLimit = 300;
export const transcriptWatermark = 240;

export type TranscriptBound<T> = {
  messages: T[];
  evicted: boolean;
};

/**
 * Generic over the row type: eviction only needs to know which rows begin a user
 * turn, so a consumer with a richer block shape can use this without converting.
 */
export function boundTranscript<T extends { role: string }>(
  messages: T[],
  direction: "older" | "newer",
  limit = transcriptLimit,
  watermark = transcriptWatermark,
): TranscriptBound<T> {
  if (messages.length <= limit) return { messages, evicted: false };
  const excess = messages.length - watermark;
  if (direction === "older") {
    // Trimming the oldest end: walk back to a user turn boundary.
    let start = messages.length;
    let removed = 0;
    while (start > 0) {
      start--;
      removed++;
      if (removed >= excess && messages[start]?.role === "user") break;
    }
    return { messages: messages.slice(0, start), evicted: true };
  }
  let end = 0;
  let removed = 0;
  while (end < messages.length) {
    if (removed >= excess && end > 0 && messages[end]?.role === "user") break;
    end++;
    removed++;
  }
  return { messages: messages.slice(end), evicted: true };
}
