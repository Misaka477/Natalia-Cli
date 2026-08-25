/**
 * Live-work projection. This records only semantic activity facts; presentation,
 * localization, timing, and animation belong to each consuming UI.
 */
import { classifyTool } from "@natalia/ui-model";
import type { RuntimeEvent } from "@natalia/contracts";
import { toolStateID, turnIDForTool } from "./conversation";
import type { ActivityKind, ActivityView, AppState } from "./state";

const terminalToolStatuses = new Set([
  "succeeded",
  "failed",
  "rejected",
  "cancelled",
]);

const activityPriority: Record<ActivityKind, number> = {
  waiting_for_user: 0,
  retrying: 1,
  compacting: 2,
  command: 3,
  tool: 4,
  subagent: 5,
  workflow: 6,
  planning: 7,
  thinking: 8,
  generating: 9,
  paused: 10,
};

/** Returns all live work in stable source insertion order. */
export function selectActiveActivities(
  state: AppState,
): readonly ActivityView[] {
  return Object.values(state.activities);
}

/**
 * Returns the single activity a compact status surface should emphasize.
 * Waiting for user input wins, followed by work that blocks visible progress.
 */
export function selectPrimaryActivity(
  state: AppState,
): ActivityView | undefined {
  let primary: ActivityView | undefined;
  for (const activity of Object.values(state.activities)) {
    if (
      !primary ||
      activityPriority[activity.kind] < activityPriority[primary.kind]
    )
      primary = activity;
  }
  return primary;
}

/** Observes every runtime event without claiming ownership of it. */
export function applyActivityEvent(state: AppState, event: RuntimeEvent): void {
  switch (event.type) {
    case "turn.submitted":
      if (event.delivery === "queue") return;
      upsertActivity(state, {
        id: turnActivityID(event.id),
        turnID: event.id,
        kind: "planning",
        state: "active",
      });
      return;
    case "turn.started":
      upsertActivity(state, {
        id: turnActivityID(event.id),
        turnID: event.id,
        kind: "planning",
        state: "active",
      });
      return;
    case "turn.paused":
      upsertActivity(state, {
        id: turnActivityID(event.id),
        turnID: event.id,
        kind: "paused",
        state: "paused",
        detail: event.reason,
      });
      return;
    case "turn.resumed":
      upsertActivity(state, {
        id: turnActivityID(event.id),
        turnID: event.id,
        kind: "planning",
        state: "active",
      });
      return;
    case "thinking.delta":
      delete state.activities[retryActivityID(event.id)];
      upsertActivity(state, {
        id: turnActivityID(event.id),
        turnID: event.id,
        kind: "thinking",
        state: "active",
      });
      return;
    case "content.delta":
      delete state.activities[retryActivityID(event.id)];
      upsertActivity(state, {
        id: turnActivityID(event.id),
        turnID: event.id,
        kind: "generating",
        state: "active",
      });
      return;
    case "turn.retry":
    case "step.retry":
      upsertActivity(state, {
        id: retryActivityID(event.id),
        turnID: event.id,
        kind: "retrying",
        state: "active",
      });
      return;
    case "step.retry.cleared":
    case "step.retry.exhausted":
      delete state.activities[retryActivityID(event.id)];
      return;
    case "tool.update": {
      const id = toolStateID(event);
      if (terminalToolStatuses.has(event.status)) {
        delete state.activities[id];
        return;
      }
      const toolKind = classifyTool(event.name, event.metadata);
      upsertActivity(state, {
        id,
        turnID: turnIDForTool(event),
        kind:
          toolKind === "shell" ||
          toolKind === "terminal" ||
          toolKind === "execute"
            ? "command"
            : toolKind === "workflow"
              ? "workflow"
              : toolKind === "subagent"
                ? "subagent"
                : "tool",
        state: event.status === "awaiting_approval" ? "waiting" : "active",
        label: event.name,
        detail: event.summary,
      });
      return;
    }
    case "terminal.update":
      if (event.status !== "running" || event.activity !== "running") {
        delete state.activities[terminalActivityID(event.id)];
        return;
      }
      upsertActivity(state, {
        id: terminalActivityID(event.id),
        kind: "command",
        state: "active",
        label: "terminal",
        detail: event.command,
      });
      return;
    case "subagent.update":
      if (
        event.status === "completed" ||
        event.status === "failed" ||
        event.status === "stopped"
      ) {
        delete state.activities[subagentActivityID(event.id)];
        return;
      }
      upsertActivity(state, {
        id: subagentActivityID(event.id),
        kind: "subagent",
        state: event.status === "paused" ? "paused" : "active",
        label: event.id,
        detail: event.task,
      });
      return;
    case "approval.request":
      upsertActivity(state, {
        id: approvalActivityID(event.id),
        kind: "waiting_for_user",
        state: "waiting",
        label: "approval",
        detail: event.title,
      });
      return;
    case "approval.response":
      delete state.activities[approvalActivityID(event.id)];
      return;
    case "question.request":
      upsertActivity(state, {
        id: questionActivityID(event.id),
        kind: "waiting_for_user",
        state: "waiting",
        label: "question",
        detail: event.title,
      });
      return;
    case "question.response":
      delete state.activities[questionActivityID(event.id)];
      return;
    case "plan.draft.created":
      upsertActivity(state, {
        id: planActivityID(event.planID),
        turnID: event.id,
        kind: "planning",
        state: "active",
        label: event.title,
        detail: event.objective,
      });
      return;
    case "plan.draft.updated":
      upsertActivity(state, {
        id: planActivityID(event.planID),
        turnID: event.id,
        kind: "planning",
        state: "active",
      });
      return;
    case "plan.proposed":
      upsertActivity(state, {
        id: planActivityID(event.planID),
        turnID: event.id,
        kind: "planning",
        state: "waiting",
      });
      return;
    case "plan.accepted":
    case "plan.queued":
    case "plan.activated":
      upsertActivity(state, {
        id: planActivityID(event.planID),
        turnID: event.id,
        kind: "planning",
        state: "active",
      });
      return;
    case "plan.superseded":
    case "plan.completed":
    case "plan.archived":
      delete state.activities[planActivityID(event.planID)];
      return;
    case "compaction.begin":
      upsertActivity(state, {
        id: compactionActivityID(event.id),
        kind: "compacting",
        state: "active",
        label: event.trigger,
      });
      return;
    case "compaction.end":
      delete state.activities[compactionActivityID(event.id)];
      return;
    case "flow.module_event":
      if (event.kind === "completed") {
        delete state.activities[flowActivityID(event.moduleID)];
        return;
      }
      upsertActivity(state, {
        id: flowActivityID(event.moduleID),
        kind: "workflow",
        state:
          event.kind === "blocked" || event.kind === "stalled"
            ? "waiting"
            : "active",
        label: event.moduleType ?? event.moduleID,
        detail: event.reason,
      });
      return;
    case "flow.finished":
      removeActivities(state, (activity) => activity.kind === "workflow");
      return;
    case "turn.cancelled":
      removeTurnActivities(state, event.id);
      removeActivities(
        state,
        (activity) => activity.kind === "waiting_for_user",
      );
      return;
    case "turn.finished":
      removeTurnActivities(state, event.id);
      if (event.stopReason !== "done")
        removeActivities(
          state,
          (activity) => activity.kind === "waiting_for_user",
        );
      return;
    default:
      return;
  }
}

function upsertActivity(state: AppState, next: ActivityView) {
  state.activities[next.id] = { ...state.activities[next.id], ...next };
}

function removeTurnActivities(state: AppState, turnID: string) {
  removeActivities(state, (activity) => activity.turnID === turnID);
}

function removeActivities(
  state: AppState,
  shouldRemove: (activity: ActivityView) => boolean,
) {
  for (const [id, activity] of Object.entries(state.activities))
    if (shouldRemove(activity)) delete state.activities[id];
}

function turnActivityID(turnID: string) {
  return `turn:${turnID}`;
}

function retryActivityID(turnID: string) {
  return `retry:${turnID}`;
}

function terminalActivityID(id: string) {
  return `terminal:${id}`;
}

function subagentActivityID(id: string) {
  return `subagent:${id}`;
}

function approvalActivityID(id: string) {
  return `approval:${id}`;
}

function questionActivityID(id: string) {
  return `question:${id}`;
}

function planActivityID(id: string) {
  return `plan:${id}`;
}

function compactionActivityID(id: string) {
  return `compaction:${id}`;
}

function flowActivityID(id: string) {
  return `flow:${id}`;
}
