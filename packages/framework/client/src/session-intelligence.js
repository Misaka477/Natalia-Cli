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
exports.countChangedFiles = countChangedFiles;
exports.countValidatedChanges = countValidatedChanges;
exports.latestConfirmedOutput = latestConfirmedOutput;
exports.hasLivePTY = hasLivePTY;
exports.hasLiveSandbox = hasLiveSandbox;
exports.buildSessionIntelligenceSnapshot = buildSessionIntelligenceSnapshot;
exports.buildSessionIntelligenceSnapshotFromFacts = buildSessionIntelligenceSnapshotFromFacts;
var session_1 = require("@anthelia/session");
/** The changed workspace files, as recorded by the Work Graph writer. */
function countChangedFiles(events) {
    return (0, session_1.sessionIntelligenceFactsFromEvents)(events).changedFiles;
}
/** Changes backed by `evidence.recorded` events. Zero today: no evidence writer. */
function countValidatedChanges(events) {
    return (0, session_1.sessionIntelligenceFactsFromEvents)(events).validatedChanges;
}
/** The last confirmed assistant output, if any, before the snapshot moment. */
function latestConfirmedOutput(events) {
    return (0, session_1.sessionIntelligenceFactsFromEvents)(events).latestOutput;
}
/**
 * Whether a live PTY exists, derived from the durable `terminal.timeline`
 * journal. A pane is live when its last timeline action is not `exit`; a start
 * publishes `started`/`created`, a stop publishes `exit`, and intermediate
 * actions (`write`, `attach`, `secure_input`, …) only happen while the pane
 * exists. Journal-derived so replay answers the same way the live moment did.
 */
function hasLivePTY(events) {
    return (0, session_1.sessionIntelligenceFactsFromEvents)(events).hasPTY;
}
/**
 * Whether a live sandbox exists, derived from the durable `sandbox.update`
 * journal. A sandbox is live when its latest status is not a terminal one
 * (`deleted`/`stopped`/`failed`); creation publishes `created`, deletion
 * publishes `deleted`. Journal-derived so replay answers the same way.
 */
function hasLiveSandbox(events) {
    return (0, session_1.sessionIntelligenceFactsFromEvents)(events).hasSandbox;
}
function buildSessionIntelligenceSnapshot(input) {
    return buildSessionIntelligenceSnapshotFromFacts({
        id: input.id,
        facts: (0, session_1.sessionIntelligenceFactsFromEvents)(input.events),
        live: input.live,
    });
}
/**
 * Assemble the snapshot from already-folded intelligence facts. The runtime's
 * incremental hot state uses this variant so an immediate-status read does not
 * re-scan the journal when the fact state is complete.
 */
function buildSessionIntelligenceSnapshotFromFacts(input) {
    var _a;
    var output = (_a = input.live.recentOutput) !== null && _a !== void 0 ? _a : input.facts.latestOutput;
    return __assign(__assign(__assign(__assign(__assign({ type: "session.snapshot", id: input.id, agentStatus: input.live.agentStatus }, (input.live.currentStep ? { currentStep: input.live.currentStep } : {})), (input.live.activeTool ? { activeTool: input.live.activeTool } : {})), { changedFiles: input.facts.changedFiles, unvalidatedChanges: input.facts.unvalidatedChanges }), (output ? { recentOutput: output.slice(0, 2000) } : {})), { hasPTY: input.facts.hasPTY, hasSandbox: input.facts.hasSandbox });
}
