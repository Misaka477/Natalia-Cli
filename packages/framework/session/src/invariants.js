"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionInvariants = void 0;
/**
 * The session domain's declared data relations (Discovery D1: the owner
 * declares, the layer ticks, violations attribute back here).
 */
exports.sessionInvariants = [
    {
        id: "session.projection-complete-after-turns",
        statement: "a session that ran turns must have a completed fact projection (factStateComplete) — an incomplete projection means reads answer from a hole",
        check: function (input) {
            var violations = [];
            for (var _i = 0, _a = input.sessions; _i < _a.length; _i++) {
                var window_1 = _a[_i];
                var ranTurns = window_1.events.some(function (event) {
                    return event.type === "turn.started" || event.type === "turn.finished";
                });
                if (ranTurns && window_1.factStateComplete !== true)
                    violations.push({
                        code: "session.projection_incomplete",
                        detail: "session ".concat(window_1.sessionID, " ran turns but its fact projection is incomplete (").concat(window_1.events.length, " events unfolded)"),
                        sessionID: window_1.sessionID,
                    });
            }
            return violations;
        },
    },
];
