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
 *   - `dialog.open` / `dialog.close`, `terminal.pane.focus`,
 *     `terminal.pane.select` — UI-only state, owned by whichever UI renders it.
 *   - `constitution.rule_added`, `decision.recorded`, `evidence.recorded`,
 *     `drift.finding_opened` — no production writer exists yet, so projecting
 *     them would advertise a feature the runtime does not have. Work Graph and
 *     tool registration events are deliberate exceptions: the client emits
 *     secret-safe facts for both in production, while their consumer-specific
 *     projections remain owned by session queries.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import { applyConversationEvent } from "./conversation";
import { applyResourceEvent } from "./resources";
import { applyStatusEvent } from "./status";
import { cloneState, initialState, type AppState } from "./state";

export {
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
} from "./state";
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
export { applyConversationEvent } from "./conversation";

/**
 * Mutates `state` in place. Unknown and deliberately unprojected events are
 * ignored rather than fatal, so a consumer built against an older contract keeps
 * working when the runtime adds an event.
 */
export function applyEvent(state: AppState, event: RuntimeEvent): void {
  if (applyConversationEvent(state, event)) return;
  if (applyResourceEvent(state, event)) return;
  applyStatusEvent(state, event);
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
