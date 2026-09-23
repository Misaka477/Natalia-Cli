"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSecretSafeObservation = assertSecretSafeObservation;
exports.observationHealth = observationHealth;
exports.turnCorrelation = turnCorrelation;
exports.operationCorrelation = operationCorrelation;
exports.attributionFor = attributionFor;
var contracts_1 = require("@natalia/contracts");
/**
 * WG4 Phase 1: the secret-safe boundary around workspace observation facts.
 *
 * Ownership boundaries (from mainline plan §56.9):
 *
 * - `WorkspaceFilesController` owns the watcher lifecycle and catalog
 *   invalidation; it must not write the Work Graph or generate workspace
 *   provenance.
 * - A new `WorkspaceChangeAuditor` (Phase 2+) is the sole production owner of
 *   workspace observation: baseline, reconciliation, expected-mutation
 *   matching and observation health.
 * - `work-graph.ts` stays the only Work Graph writer.
 * - `DriftEvaluator` is the only production writer of `drift.finding_opened`
 *   (Phase 4); its package owns and enforces that writer boundary.
 *
 * This module is the contract's enforcement point: `assertSecretSafeObservation`
 * rejects any forbidden field, so a future hint/auditor that accidentally
 * carries content, a diff or command text fails here rather than leaking into
 * the durable graph.
 */
/** Anything that must never cross into a workspace observation or confirmed change. */
var FORBIDDEN_OBSERVATION_KEYS = new Set([
    "content",
    "diff",
    "patch",
    "command",
    "args",
    "arguments",
    "result",
    "output",
    "thinking",
    "reasoning",
    "context",
    "error",
    "stderr",
    "stdout",
]);
function assertSecretSafeObservation(fact) {
    for (var _i = 0, _a = Object.keys(fact); _i < _a.length; _i++) {
        var key = _a[_i];
        if (FORBIDDEN_OBSERVATION_KEYS.has(key))
            throw new Error("workspace observation carries a forbidden field: ".concat(key));
    }
}
function observationHealth(status, reason) {
    return reason ? { status: status, reason: reason } : { status: status };
}
/** A turn identity: turnID and callID travel together. */
function turnCorrelation(input) {
    var correlation = {
        sessionID: input.sessionID,
        episodeID: input.episodeID,
        turnID: input.turnID,
        callID: input.callID,
    };
    return contracts_1.workspaceCorrelationSchema.parse(correlation);
}
/** A non-turn operation identity: sandbox merge, checkpoint rollback, direct runtime API. */
function operationCorrelation(input) {
    var correlation = {
        sessionID: input.sessionID,
        episodeID: input.episodeID,
        operationID: input.operationID,
    };
    return contracts_1.workspaceCorrelationSchema.parse(correlation);
}
/**
 * The attribution decision for a confirmed change (§56.9):
 * only a success inside the expected/authorized scope with a reliable identity
 * is attributed; failed, out-of-scope, identity-less or indeterminate windows
 * are never force-attributed.
 */
function attributionFor(origin, options) {
    if (options.indeterminate)
        return "indeterminate";
    if (!options.hasReliableIdentity)
        return "unattributed";
    return origin === "external" ? "unattributed" : "attributed";
}
