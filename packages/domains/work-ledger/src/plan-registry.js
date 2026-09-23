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
exports.buildPlanDocCreated = buildPlanDocCreated;
exports.buildPlanDocUpdated = buildPlanDocUpdated;
exports.buildPlanDocMarked = buildPlanDocMarked;
exports.buildPlanDocDeleted = buildPlanDocDeleted;
exports.buildPlanDocStatus = buildPlanDocStatus;
exports.buildAuditRequested = buildAuditRequested;
function buildPlanDocCreated(input) {
    return {
        type: "plan.doc.created",
        id: input.id,
        planID: input.planID,
        title: input.title,
        documentPath: input.documentPath,
        createdBy: input.createdBy,
        status: input.status,
        createdAt: input.createdAt,
    };
}
function buildPlanDocUpdated(input) {
    return __assign({ type: "plan.doc.updated", id: input.id, planID: input.planID, revision: input.revision, updatedAt: input.updatedAt }, (input.reason ? { reason: input.reason } : {}));
}
function buildPlanDocMarked(input) {
    return {
        type: "plan.doc.marked",
        id: input.id,
        planID: input.planID,
        markedAt: input.markedAt,
    };
}
function buildPlanDocDeleted(input) {
    return {
        type: "plan.doc.deleted",
        id: input.id,
        planID: input.planID,
        deletedAt: input.deletedAt,
    };
}
function buildPlanDocStatus(input) {
    return __assign({ type: "plan.doc.status", id: input.id, planID: input.planID, status: input.status, at: input.at }, (input.reason ? { reason: input.reason } : {}));
}
/**
 * EI §3.9: durable audit request. One trigger event → one request; the
 * request is the restart-safe shadow for the process-local Nia wake queue.
 */
function buildAuditRequested(input) {
    return __assign({ type: "audit.requested", id: input.id, planID: input.planID, planVersion: input.planVersion, triggerEventID: input.triggerEventID, round: input.round, scope: input.scope, at: input.at }, (input.checkpointID ? { checkpointID: input.checkpointID } : {}));
}
