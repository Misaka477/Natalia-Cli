"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectActiveActivities = selectActiveActivities;
exports.selectPrimaryActivity = selectPrimaryActivity;
exports.applyActivityEvent = applyActivityEvent;
/**
 * Live-work projection. This records only semantic activity facts; presentation,
 * localization, timing, and animation belong to each consuming UI.
 */
var ui_model_1 = require("@natalia/ui-model");
var conversation_1 = require("./conversation");
var terminalToolStatuses = new Set([
    "succeeded",
    "failed",
    "rejected",
    "cancelled",
]);
var activityPriority = {
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
function selectActiveActivities(state) {
    return Object.values(state.activities);
}
/**
 * Returns the single activity a compact status surface should emphasize.
 * Waiting for user input wins, followed by work that blocks visible progress.
 */
function selectPrimaryActivity(state) {
    var primary;
    for (var _i = 0, _a = Object.values(state.activities); _i < _a.length; _i++) {
        var activity = _a[_i];
        if (!primary ||
            activityPriority[activity.kind] < activityPriority[primary.kind])
            primary = activity;
    }
    return primary;
}
/** Observes every runtime event without claiming ownership of it. */
function applyActivityEvent(state, event) {
    var _a, _b;
    switch (event.type) {
        case "turn.submitted":
            // A submitted turn is always a genuinely starting turn now; queued inputs
            // live in the pending-inputs slice, not here.
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
            var id = (0, conversation_1.toolStateID)(event);
            if (terminalToolStatuses.has(event.status)) {
                delete state.activities[id];
                return;
            }
            var toolKind = (0, ui_model_1.classifyTool)(event.name, event.metadata);
            upsertActivity(state, {
                id: id,
                turnID: (0, conversation_1.turnIDForTool)(event),
                kind: toolKind === "shell" ||
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
            if (event.status === "completed" ||
                event.status === "failed" ||
                event.status === "stopped") {
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
        case "plan.doc.created":
            state.plans = __assign(__assign({}, state.plans), (_a = {}, _a[event.planID] = {
                planID: event.planID,
                title: event.title,
                documentPath: event.documentPath,
                createdBy: event.createdBy,
                createdAt: event.createdAt,
                updatedAt: event.createdAt,
                status: event.status,
            }, _a));
            upsertActivity(state, {
                id: planActivityID(event.planID),
                turnID: event.id,
                kind: "planning",
                state: "active",
                label: event.title,
                detail: event.documentPath,
            });
            return;
        case "plan.doc.updated":
            updatePlanDoc(state, event.planID, function (plan) {
                plan.updatedAt = event.updatedAt;
            });
            return;
        case "plan.doc.marked":
            updatePlanDoc(state, event.planID, function (plan) {
                plan.markedAt = event.markedAt;
                plan.updatedAt = event.markedAt;
            });
            return;
        case "plan.doc.status":
            updatePlanDoc(state, event.planID, function (plan) {
                plan.status = event.status;
                plan.updatedAt = event.at;
            });
            delete state.activities[planActivityID(event.planID)];
            return;
        case "plan.doc.deleted":
            delete state.plans[event.planID];
            delete state.activities[planActivityID(event.planID)];
            return;
        case "goal.changed":
            if (event.operation === "clear" || !event.snapshot) {
                delete state.goal;
                return;
            }
            state.goal = __assign(__assign(__assign({ goalID: event.snapshot.goalID, revision: event.snapshot.revision, objective: event.snapshot.objective, phase: event.snapshot.phase, roundsStarted: event.roundsStarted, maxGoalRounds: event.snapshot.maxGoalRounds }, (event.snapshot.planID ? { planID: event.snapshot.planID } : {})), (event.snapshot.blockedReason
                ? { blockedReason: event.snapshot.blockedReason }
                : {})), (event.snapshot.lastStop
                ? { lastStop: event.snapshot.lastStop }
                : {}));
            return;
        case "goal.status":
            if (!event.goal) {
                delete state.goal;
                return;
            }
            state.goal = __assign(__assign(__assign({ goalID: event.goal.goalID, revision: event.goal.revision, objective: event.goal.objective, phase: event.goal.phase, roundsStarted: event.goal.roundsStarted, maxGoalRounds: event.goal.maxGoalRounds }, (event.goal.planID ? { planID: event.goal.planID } : {})), (event.goal.blockedReason
                ? { blockedReason: event.goal.blockedReason }
                : {})), (event.goal.lastStop ? { lastStop: event.goal.lastStop } : {}));
            return;
        case "goal.round":
            if (state.goal && state.goal.goalID === event.goalID)
                state.goal = __assign(__assign({}, state.goal), { revision: event.revision, roundsStarted: event.round });
            return;
        case "mailbox.queued":
            state.mailbox = __assign(__assign({}, state.mailbox), (_b = {}, _b[event.messageID] = __assign(__assign({ messageID: event.messageID, source: event.source, priority: event.priority, intent: event.intent, text: event.text, safeSummary: event.safeSummary }, (event.relatedPlanID
                ? { relatedPlanID: event.relatedPlanID }
                : {})), { deliveryPolicy: event.deliveryPolicy, createdAt: event.createdAt, status: "queued" }), _b));
            return;
        case "mailbox.delivered":
            updateMailbox(state, event.messageID, function (message) {
                message.status = "delivered";
            });
            return;
        case "mailbox.acknowledged":
            updateMailbox(state, event.messageID, function (message) {
                message.status = "acknowledged";
            });
            return;
        case "mailbox.deferred":
            updateMailbox(state, event.messageID, function (message) {
                message.status = "deferred";
                message.reason = event.reason;
            });
            return;
        case "mailbox.superseded":
            updateMailbox(state, event.messageID, function (message) {
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
            removeActivities(state, function (activity) { return activity.kind === "waiting_for_user"; });
            return;
        case "turn.finished":
            removeTurnActivities(state, event.id);
            if (event.stopReason !== "done")
                removeActivities(state, function (activity) { return activity.kind === "waiting_for_user"; });
            return;
        default:
            return;
    }
}
function updatePlanDoc(state, planID, mutate) {
    var _a;
    var existing = state.plans[planID];
    if (!existing)
        return;
    var next = __assign({}, existing);
    mutate(next);
    state.plans = __assign(__assign({}, state.plans), (_a = {}, _a[planID] = next, _a));
}
function updateMailbox(state, messageID, mutate) {
    var _a;
    var existing = state.mailbox[messageID];
    if (!existing)
        return;
    var next = __assign({}, existing);
    mutate(next);
    state.mailbox = __assign(__assign({}, state.mailbox), (_a = {}, _a[messageID] = next, _a));
}
function upsertActivity(state, next) {
    state.activities[next.id] = __assign(__assign({}, state.activities[next.id]), next);
}
function removeTurnActivities(state, turnID) {
    removeActivities(state, function (activity) { return activity.turnID === turnID; });
}
function removeActivities(state, shouldRemove) {
    for (var _i = 0, _a = Object.entries(state.activities); _i < _a.length; _i++) {
        var _b = _a[_i], id = _b[0], activity = _b[1];
        if (shouldRemove(activity))
            delete state.activities[id];
    }
}
function turnActivityID(turnID) {
    return "turn:".concat(turnID);
}
function retryActivityID(turnID) {
    return "retry:".concat(turnID);
}
function terminalActivityID(id) {
    return "terminal:".concat(id);
}
function subagentActivityID(id) {
    return "subagent:".concat(id);
}
function approvalActivityID(id) {
    return "approval:".concat(id);
}
function questionActivityID(id) {
    return "question:".concat(id);
}
function planActivityID(id) {
    return "plan:".concat(id);
}
function compactionActivityID(id) {
    return "compaction:".concat(id);
}
