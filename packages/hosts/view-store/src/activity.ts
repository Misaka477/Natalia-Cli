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
      state.plans = {
        ...state.plans,
        [event.planID]: {
          planID: event.planID,
          version: event.version,
          title: event.title,
          author: event.author,
          objective: event.objective,
          ...(event.context ? { context: event.context } : {}),
          nonGoals: event.nonGoals ?? [],
          assumptions: event.assumptions ?? [],
          dependencies: event.dependencies ?? [],
          steps: event.steps,
          constraints: event.constraints ?? [],
          verification: event.verification ?? [],
          riskNotes: event.riskNotes ?? [],
          overallVerification: event.overallVerification ?? [],
          rollbackCriteria: event.rollbackCriteria ?? [],
          communicationRules: event.communicationRules ?? [],
          ...(event.relatedMailboxMessageID
            ? { relatedMailboxMessageID: event.relatedMailboxMessageID }
            : {}),
          ...(event.taskID ? { taskID: event.taskID } : {}),
          ...(event.supersedesPlanID
            ? { supersedesPlanID: event.supersedesPlanID }
            : {}),
          createdAt: event.createdAt,
          status: "draft",
        },
      };
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
      updatePlan(state, event.planID, event.version, (plan) => {
        if (event.reason) plan.reason = event.reason;
      });
      upsertActivity(state, {
        id: planActivityID(event.planID),
        turnID: event.id,
        kind: "planning",
        state: "active",
      });
      return;
    case "plan.proposed":
      updatePlan(state, event.planID, event.version, (plan) => {
        plan.status = "proposed";
      });
      upsertActivity(state, {
        id: planActivityID(event.planID),
        turnID: event.id,
        kind: "planning",
        state: "waiting",
      });
      return;
    case "plan.accepted":
      updatePlan(state, event.planID, event.version, (plan) => {
        plan.status = "accepted";
      });
      delete state.activities[planActivityID(event.planID)];
      return;
    case "plan.queued":
      updatePlan(state, event.planID, event.version, (plan) => {
        plan.status = "queued_next_plan";
      });
      delete state.activities[planActivityID(event.planID)];
      return;
    case "plan.activated":
      updatePlan(state, event.planID, event.version, (plan) => {
        plan.status = "active";
      });
      delete state.activities[planActivityID(event.planID)];
      return;
    case "plan.superseded":
      updatePlan(state, event.planID, event.version, (plan) => {
        plan.status = "superseded";
        plan.reason = event.reason;
      });
      delete state.activities[planActivityID(event.planID)];
      return;
    case "plan.completed":
      updatePlan(state, event.planID, event.version, (plan) => {
        plan.status = "completed";
      });
      delete state.activities[planActivityID(event.planID)];
      return;
    case "plan.archived":
      updatePlan(state, event.planID, event.version, (plan) => {
        plan.status = "archived";
      });
      delete state.activities[planActivityID(event.planID)];
      return;
    case "mailbox.queued":
      state.mailbox = {
        ...state.mailbox,
        [event.messageID]: {
          messageID: event.messageID,
          source: event.source,
          priority: event.priority,
          intent: event.intent,
          text: event.text,
          safeSummary: event.safeSummary,
          ...(event.relatedPlanID
            ? { relatedPlanID: event.relatedPlanID }
            : {}),
          deliveryPolicy: event.deliveryPolicy,
          createdAt: event.createdAt,
          status: "queued",
        },
      };
      return;
    case "mailbox.delivered":
      updateMailbox(state, event.messageID, (message) => {
        message.status = "delivered";
      });
      return;
    case "mailbox.acknowledged":
      updateMailbox(state, event.messageID, (message) => {
        message.status = "acknowledged";
      });
      return;
    case "mailbox.deferred":
      updateMailbox(state, event.messageID, (message) => {
        message.status = "deferred";
        message.reason = event.reason;
      });
      return;
    case "mailbox.superseded":
      updateMailbox(state, event.messageID, (message) => {
        message.status = "superseded";
        message.reason = event.reason;
      });
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

function updatePlan(
  state: AppState,
  planID: string,
  version: number,
  mutate: (plan: NonNullable<AppState["plans"][string]>) => void,
) {
  const existing = state.plans[planID];
  if (!existing) return;
  const next = { ...existing, version };
  mutate(next);
  state.plans = { ...state.plans, [planID]: next };
}

function updateMailbox(
  state: AppState,
  messageID: string,
  mutate: (message: NonNullable<AppState["mailbox"][string]>) => void,
) {
  const existing = state.mailbox[messageID];
  if (!existing) return;
  const next = { ...existing };
  mutate(next);
  state.mailbox = { ...state.mailbox, [messageID]: next };
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


