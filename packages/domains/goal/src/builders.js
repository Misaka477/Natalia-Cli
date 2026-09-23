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
exports.buildGoalChanged = buildGoalChanged;
exports.buildGoalRound = buildGoalRound;
/**
 * Builds one `goal.changed` event. Callers own the event id and timestamp (the
 * runtime's `nextGoalSequence` / clock), matching the work-ledger builders.
 */
function buildGoalChanged(input) {
    return __assign(__assign(__assign({ type: "goal.changed", id: input.id, operation: input.operation }, (input.snapshot ? { snapshot: input.snapshot } : {})), (input.cleared ? { cleared: input.cleared } : {})), { roundsStarted: input.roundsStarted, at: input.at });
}
/**
 * Builds one `goal.round` event. Written by the round driver the moment it
 * admits a `<goal_round>` turn, so replay counts only rounds that actually
 * started.
 */
function buildGoalRound(input) {
    return {
        type: "goal.round",
        id: input.id,
        goalID: input.goalID,
        revision: input.revision,
        round: input.round,
        at: input.at,
    };
}
