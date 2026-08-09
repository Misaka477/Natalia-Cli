/**
 * Resource projection: terminals, sandboxes, subagents, checkpoints, rollback,
 * MCP servers, plugins and loaded capabilities.
 *
 * These are runtime facts, so this layer only records the latest state and a
 * bounded history. It never decides anything about them: starting, stopping,
 * merging and approving all stay with the runtime.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import {
  appendBounded,
  checkpointLimit,
  terminalTranscriptChars,
  type TerminalTimelineEntry,
  type TerminalView,
  subagentHistoryLimit,
  terminalTimelineLimit,
  upsertBlock,
  type AppState,
} from "./state";

/**
 * Keeps the visible tail of a transcript and says how much was dropped, so a
 * consumer never silently renders a truncated scrollback as if it were complete.
 */
function boundTerminalTranscript(event: TerminalView): TerminalView {
  const transcript = event.transcript;
  if (!transcript || transcript.length <= terminalTranscriptChars) return event;
  const omitted = transcript.length - terminalTranscriptChars;
  return {
    ...event,
    transcript: `... ${omitted} earlier chars omitted from live pane ...\n${transcript.slice(
      -terminalTranscriptChars,
    )}`,
  };
}

function sameTimelineEntry(
  previous: TerminalTimelineEntry,
  next: TerminalTimelineEntry,
): boolean {
  return (
    previous.at === next.at &&
    previous.actor === next.actor &&
    previous.action === next.action &&
    previous.status === next.status
  );
}

/** Every field a consumer can observe. Compared to skip no-op republishes. */
function sameTerminalState(
  previous: TerminalView,
  next: TerminalView,
): boolean {
  return (
    previous.status === next.status &&
    previous.attached === next.attached &&
    previous.rows === next.rows &&
    previous.cols === next.cols &&
    previous.activity === next.activity &&
    previous.tail === next.tail &&
    previous.transcript === next.transcript &&
    previous.command === next.command &&
    previous.cwd === next.cwd &&
    previous.prompt === next.prompt &&
    previous.lastAction === next.lastAction &&
    previous.ownership === next.ownership &&
    previous.revision === next.revision &&
    previous.lastOutputAt === next.lastOutputAt
  );
}

/** Returns true when the event belongs to this projection. */
export function applyResourceEvent(
  state: AppState,
  event: RuntimeEvent,
): boolean {
  switch (event.type) {
    case "terminal.update": {
      const previous = state.terminals[event.id];
      const next = boundTerminalTranscript(event);
      // A pane republishes on every keystroke, so an update that changes nothing
      // a consumer can see is dropped rather than forcing a re-render.
      if (previous && sameTerminalState(previous, next)) return true;
      state.terminals = { ...state.terminals, [event.id]: next };
      return true;
    }
    case "terminal.timeline": {
      const existing = state.terminalTimeline[event.id] ?? [];
      // Replaying history re-delivers events a consumer may already hold, so an
      // entry identical in time, actor, action and outcome is the same entry, not a
      // second occurrence. Without this, every reconnect doubles the timeline.
      if (existing.some((entry) => sameTimelineEntry(entry, event)))
        return true;
      state.terminalTimeline = {
        ...state.terminalTimeline,
        [event.id]: appendBounded(existing, event, terminalTimelineLimit),
      };
      return true;
    }
    case "terminal.approval":
      // Keyed by approval id, not terminal id: one pane can have several
      // approvals over its life and a UI needs to resolve the right one.
      state.terminalApprovals = {
        ...state.terminalApprovals,
        [event.approvalID]: event,
      };
      return true;
    case "terminal.action":
      return true;
    case "terminal.viewer":
      return true;
    case "sandbox.update":
      state.sandboxes = { ...state.sandboxes, [event.id]: event };
      return true;
    case "sandbox.diff":
      state.sandboxDiffs = { ...state.sandboxDiffs, [event.id]: event };
      return true;
    case "sandbox.audit":
      upsertBlock(
        state,
        `sandbox:${event.id}:${event.action}`,
        "system",
        event.message,
        event.approvalRequired ? "approval_required" : undefined,
      );
      return true;
    case "subagent.update":
      state.subagents = { ...state.subagents, [event.id]: event };
      state.subagentHistory = {
        ...state.subagentHistory,
        [event.id]: appendBounded(
          state.subagentHistory[event.id] ?? [],
          event,
          subagentHistoryLimit,
        ),
      };
      return true;
    case "checkpoint.created":
      state.checkpoints = appendBounded(
        state.checkpoints,
        event,
        checkpointLimit,
      );
      return true;
    case "checkpoint.failed":
      // An incomplete checkpoint is a rollback-safety fact, so say so rather
      // than dropping it.
      upsertBlock(
        state,
        `checkpoint:failed:${event.reason}`,
        "system",
        event.incomplete
          ? `checkpoint incomplete (${event.reason}): ${event.message}`
          : `checkpoint failed (${event.reason}): ${event.message}`,
        "failed",
      );
      return true;
    case "checkpoint.unavailable":
      upsertBlock(
        state,
        "checkpoint:unavailable",
        "system",
        `checkpoints unavailable (${event.reason}): ${event.suggestion}`,
        event.disabledByConfig ? "disabled" : "unavailable",
      );
      return true;
    case "rollback.previewed":
      state.rollback = {
        checkpointID: event.preview.checkpointID,
        state: "previewed",
      };
      return true;
    case "rollback.begin":
      state.rollback = {
        checkpointID: event.checkpointID,
        safetyCheckpointID: event.safetyCheckpointID,
        state: "running",
        dryRun: event.dryRun,
      };
      return true;
    case "rollback.end":
      state.rollback = {
        checkpointID: event.checkpointID,
        safetyCheckpointID: event.safetyCheckpointID,
        state: "completed",
        restoredFiles: event.restoredFiles,
        deletedFiles: event.deletedFiles,
      };
      return true;
    case "rollback.failed":
      state.rollback = {
        checkpointID: event.checkpointID,
        safetyCheckpointID: event.safetyCheckpointID,
        state: "failed",
        message: event.message,
        recovered: event.recovered,
      };
      return true;
    case "snapshot.created":
      upsertBlock(
        state,
        `snapshot:${event.id}`,
        "system",
        `snapshot ${event.id}: ${event.files.join(", ")}`,
        "created",
      );
      return true;
    case "mcp.status":
      state.mcp = { ...state.mcp, [event.server]: event };
      return true;
    case "plugin.update":
      state.plugins = { ...state.plugins, [event.id]: event };
      return true;
    case "capability.loaded":
      state.capabilities = { ...state.capabilities, [event.id]: event };
      return true;
    case "capability.unloaded":
    case "capability.failed": {
      const { [event.id]: _removed, ...rest } = state.capabilities;
      state.capabilities = rest;
      return true;
    }
    case "workgraph.node_added":
      state.workGraphNodes = {
        ...state.workGraphNodes,
        [event.nodeID]: event,
      };
      return true;
    case "workgraph.edge_added":
      state.workGraphEdges = {
        ...state.workGraphEdges,
        [event.id]: event,
      };
      return true;
    default:
      return false;
  }
}
