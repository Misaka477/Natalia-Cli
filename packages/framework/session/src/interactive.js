"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectInteractiveRequests = projectInteractiveRequests;
exports.requestsForSession = requestsForSession;
/** Projects durable request/reply events; in-memory waiters are not replay state. */
function projectInteractiveRequests(events) {
    var approvals = new Map();
    var questions = new Map();
    var interactives = new Map();
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        if (event_1.type === "approval.request")
            approvals.set(event_1.id, event_1);
        if (event_1.type === "approval.response")
            approvals.delete(event_1.id);
        if (event_1.type === "question.request")
            questions.set(event_1.id, event_1);
        if (event_1.type === "question.response")
            questions.delete(event_1.id);
        if (event_1.type === "interactive.request")
            interactives.set(event_1.id, event_1);
        if (event_1.type === "interactive.response")
            interactives.delete(event_1.id);
    }
    return {
        approvals: __spreadArray([], approvals.values(), true),
        questions: __spreadArray([], questions.values(), true),
        interactives: __spreadArray([], interactives.values(), true),
    };
}
function requestsForSession(_sessionID, events) {
    return projectInteractiveRequests(events);
}
