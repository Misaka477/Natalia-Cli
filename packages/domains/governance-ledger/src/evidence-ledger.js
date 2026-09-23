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
exports.buildHumanValidation = buildHumanValidation;
exports.buildEvidenceRecorded = buildEvidenceRecorded;
exports.boundValidationOutcome = boundValidationOutcome;
exports.buildCompletionRecorded = buildCompletionRecorded;
exports.evidenceStatusForPlanState = evidenceStatusForPlanState;
/**
 * Builds an `evidence.recorded` event. `validations` entries are bounded to a
 * command + outcome + safe summary; nothing else about the run may enter the
 * journal. Empty validation lists are omitted rather than emitted as `[]` so a
 * consumer can tell "no validation recorded" from "recorded as skipped".
 */
/**
 * EI Phase 0: a human's validation note on a completion card (the user's UI
 * entry point for humanValidation). Durable; the read surface merges the latest
 * one per task onto the completion card. The note is safe prose (redacted by
 * the caller before this runs).
 */
function buildHumanValidation(input) {
    return {
        type: "completion.human_validation",
        id: input.id,
        taskID: input.taskID,
        validation: input.validation,
        recordedAt: input.recordedAt,
    };
}
function buildEvidenceRecorded(input) {
    return __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ type: "evidence.recorded", id: input.id, taskID: input.taskID, objective: input.objective, status: input.status }, (input.changes && input.changes.length
        ? { changes: input.changes }
        : {})), (input.validations && input.validations.length
        ? { validations: input.validations }
        : {})), (input.knownGaps && input.knownGaps.length
        ? { knownGaps: input.knownGaps }
        : {})), (input.recordedAt ? { recordedAt: input.recordedAt } : {})), (input.environment ? { environment: input.environment } : {})), (input.repositoryVersion
        ? { repositoryVersion: input.repositoryVersion }
        : {})), (input.commit ? { commit: input.commit } : {})), (input.manifestRef ? { manifestRef: input.manifestRef } : {}));
}
/**
 * Bounds a validation outcome to its safe, journal-safe shape: the command,
 * the result, a truncated safe summary and an optional duration. The summary is
 * capped at 2000 characters so a chatty runner cannot bloat the journal, and
 * secret redaction is the caller's job before this runs.
 */
function boundValidationOutcome(input) {
    return __assign(__assign({ command: input.command, result: input.result, safeSummary: input.safeSummary.slice(0, 2000) }, (input.artifactRef ? { artifactRef: input.artifactRef } : {})), (input.durationMs !== undefined
        ? { durationMs: Math.max(0, Math.round(input.durationMs)) }
        : {}));
}
/**
 * A completion card (P2 E4): the fixed report structure from the evidence plan
 * §5 — change summary, behavior impact, validation evidence, human validation,
 * known gaps, external side effects, rollback state. `changeSummary` is safe
 * prose (a summary, never a diff or file content); validation entries are the
 * same bounded outcomes as evidence. A completion records which evidence facts
 * it rests on via `evidenceIDs`.
 */
function buildCompletionRecorded(input) {
    var _a;
    return __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ type: "completion.recorded", id: input.id, taskID: input.taskID, objective: input.objective, changeSummary: input.changeSummary }, (input.behaviorImpact ? { behaviorImpact: input.behaviorImpact } : {})), { validations: (_a = input.validations) !== null && _a !== void 0 ? _a : [] }), (input.humanValidation
        ? { humanValidation: input.humanValidation }
        : {})), (input.knownGaps && input.knownGaps.length
        ? { knownGaps: input.knownGaps }
        : {})), (input.externalSideEffects && input.externalSideEffects.length
        ? { externalSideEffects: input.externalSideEffects }
        : {})), (input.rollbackState ? { rollbackState: input.rollbackState } : {})), (input.evidenceIDs && input.evidenceIDs.length
        ? { evidenceIDs: input.evidenceIDs }
        : {})), { recordedAt: input.recordedAt });
}
function evidenceStatusForPlanState(planState, recordedStatus) {
    switch (planState) {
        case "executing":
        case "awaiting_audit":
        case "auditing":
        case "audit_gaps":
            return "implemented";
        case "audit_passed":
        case "completed":
            return "accepted";
        default:
            return recordedStatus;
    }
}
