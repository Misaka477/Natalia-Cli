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
exports.assertGoalSnapshot = assertGoalSnapshot;
exports.foldGoalStep = foldGoalStep;
exports.foldGoal = foldGoal;
var PHASES = [
    "active",
    "paused",
    "blocked",
    "complete",
];
function isPhase(value) {
    return (typeof value === "string" && PHASES.includes(value));
}
function assertBlockReason(reason) {
    if (typeof reason.code !== "string" || !reason.code.trim())
        throw new Error("goal blockedReason.code must be a non-empty string");
    if (typeof reason.message !== "string" || !reason.message.trim())
        throw new Error("goal blockedReason.message must be a non-empty string");
}
function assertLastStop(lastStop) {
    if (typeof lastStop.code !== "string" || !lastStop.code.trim())
        throw new Error("goal lastStop.code must be a non-empty string");
    if (typeof lastStop.at !== "number" || !Number.isFinite(lastStop.at))
        throw new Error("goal lastStop.at must be a finite number");
}
/** Validates the shape of a persisted goal snapshot; throws when malformed. */
function assertGoalSnapshot(snapshot) {
    if (typeof snapshot.goalID !== "string" || !snapshot.goalID.trim())
        throw new Error("goal snapshot must carry a non-empty goalID");
    if (!Number.isInteger(snapshot.revision) || snapshot.revision < 1)
        throw new Error("goal snapshot revision must be a positive integer");
    if (typeof snapshot.objective !== "string" || !snapshot.objective.trim())
        throw new Error("goal snapshot objective must be a non-empty string");
    if (!isPhase(snapshot.phase))
        throw new Error("goal snapshot phase is invalid: ".concat(String(snapshot.phase)));
    if (!Number.isInteger(snapshot.maxGoalRounds) || snapshot.maxGoalRounds < 0)
        throw new Error("goal snapshot maxGoalRounds must be a non-negative integer (0 = unlimited)");
    if (snapshot.phase === "blocked") {
        if (snapshot.blockedReason === undefined)
            throw new Error("a blocked goal must carry a blockedReason");
        assertBlockReason(snapshot.blockedReason);
    }
    else if (snapshot.blockedReason !== undefined) {
        throw new Error("only a blocked goal may carry a blockedReason");
    }
    if (snapshot.lastStop !== undefined)
        assertLastStop(snapshot.lastStop);
    if (snapshot.planID !== undefined &&
        (typeof snapshot.planID !== "string" || !snapshot.planID.trim()))
        throw new Error("goal planID must be a non-empty string when present");
}
/** Validates one lifecycle transition (and the revision it must carry). */
function assertTransition(previous, operation, next, roundsStarted) {
    if (operation === "create") {
        if (previous !== undefined && previous.phase !== "complete")
            throw new Error("cannot create a goal while ".concat(previous.goalID, " is ").concat(previous.phase));
        if (next.revision !== 1)
            throw new Error("a newly created goal must start at revision 1");
        return;
    }
    if (previous === undefined)
        throw new Error("goal ".concat(operation, " requires a current goal"));
    if (next.goalID !== previous.goalID)
        throw new Error("goal ".concat(operation, " must not change identity"));
    if (next.revision !== previous.revision + 1)
        throw new Error("goal ".concat(operation, " must advance the revision by exactly one"));
    switch (operation) {
        case "edit":
            if (next.phase !== previous.phase)
                throw new Error("goal edit must not change the phase");
            return;
        case "pause":
            if (previous.phase !== "active" || next.phase !== "paused")
                throw new Error("goal pause requires active -> paused");
            return;
        case "resume":
            if (next.phase !== "active")
                throw new Error("goal resume must produce an active goal");
            if (previous.phase !== "paused" && previous.phase !== "blocked")
                throw new Error("goal resume requires a paused or blocked goal");
            if (next.maxGoalRounds !== 0 && roundsStarted >= next.maxGoalRounds)
                throw new Error("goal resume refused: the round cap is exhausted");
            return;
        case "complete":
            if (previous.phase === "complete" || next.phase !== "complete")
                throw new Error("goal complete requires a non-complete -> complete");
            return;
        case "blocked":
            if (previous.phase !== "active" || next.phase !== "blocked")
                throw new Error("goal blocked requires active -> blocked");
            return;
        default:
            throw new Error("unsupported goal operation: ".concat(String(operation)));
    }
}
/**
 * Folds the current goal from a session log prefix. Returns `undefined` when no
 * goal is current. The result is always `disarmed`: process-local continuation
 * authority is never reconstructed by replay.
 */
/**
 * One strict step of the goal fold. Extracted so a durable projection can carry
 * the goal forward incrementally (O(1) per event) instead of rescanning the log;
 * `foldGoal` is defined in terms of it so the two can never drift.
 */
function foldGoalStep(current, event) {
    if (event.type === "goal.changed") {
        if (event.operation === "clear") {
            if (event.cleared === undefined)
                throw new Error("goal clear is missing its cleared identity");
            if (event.snapshot !== undefined)
                throw new Error("goal clear must not carry a snapshot");
            if (current === undefined || current.goalID !== event.cleared.goalID)
                throw new Error("goal clear does not match the current goal");
            return undefined;
        }
        var snapshot = event.snapshot;
        if (snapshot === undefined)
            throw new Error("goal ".concat(event.operation, " is missing its snapshot"));
        assertGoalSnapshot(snapshot);
        if (current !== undefined &&
            current.goalID === snapshot.goalID &&
            event.roundsStarted < current.roundsStarted)
            throw new Error("goal roundsStarted must not go backwards");
        assertTransition(current, event.operation, snapshot, event.roundsStarted);
        var sameGoal = current !== undefined && current.goalID === snapshot.goalID;
        return __assign(__assign({}, snapshot), { roundsStarted: event.roundsStarted, createdAt: sameGoal ? current.createdAt : event.at, updatedAt: event.at, 
            // Replay never arms continuation.
            activation: "disarmed" });
    }
    if (event.type === "goal.round.cost") {
        if (current === undefined)
            return current;
        // A cost for a superseded revision is ignored, not charged — the same rule
        // the admission event follows, so a late report cannot bill a retired goal.
        if (event.goalID !== current.goalID || event.revision !== current.revision)
            return current;
        if (event.round !== current.roundsStarted)
            throw new Error("goal round ".concat(event.round, " cost is out of sequence (expected the admitted round ").concat(current.roundsStarted, ")"));
        if (!Number.isFinite(event.tokens) || event.tokens < 0)
            throw new Error("goal round cost tokens must be a non-negative number");
        if (!Number.isFinite(event.durationMs) || event.durationMs < 0)
            throw new Error("goal round cost durationMs must be a non-negative number");
        return __assign(__assign({}, current), { spentGoalTokens: current.spentGoalTokens + event.tokens, goalWallClockMs: current.goalWallClockMs + event.durationMs });
    }
    if (event.type === "goal.round") {
        if (current === undefined)
            return current;
        // A round for a superseded revision is ignored, not charged.
        if (event.goalID !== current.goalID || event.revision !== current.revision)
            return current;
        if (event.round !== current.roundsStarted + 1)
            throw new Error("goal round ".concat(event.round, " is out of sequence (expected ").concat(current.roundsStarted + 1, ")"));
        if (current.maxGoalRounds !== 0 && event.round > current.maxGoalRounds)
            throw new Error("goal round ".concat(event.round, " exceeds maxGoalRounds ").concat(current.maxGoalRounds));
        return __assign(__assign({}, current), { roundsStarted: event.round });
    }
    return current;
}
function foldGoal(events) {
    var current;
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        current = foldGoalStep(current, event_1);
    }
    return current;
}
