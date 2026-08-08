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
  subagentHistoryLimit,
  terminalTimelineLimit,
  upsertBlock,
  type AppState,
} from "./state";

/** Returns true when the event belongs to this projection. */
export function applyResourceEvent(
  state: AppState,
  event: RuntimeEvent,
): boolean {
  switch (event.type) {
    case "terminal.update":
      state.terminals = { ...state.terminals, [event.id]: event };
      return true;
    case "terminal.timeline":
      state.terminalTimeline = {
        ...state.terminalTimeline,
        [event.id]: appendBounded(
          state.terminalTimeline[event.id] ?? [],
          event,
          terminalTimelineLimit,
        ),
      };
      return true;
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
    default:
      return false;
  }
}
