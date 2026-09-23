"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var invariants_1 = require("../src/invariants");
var check = invariants_1.sessionInvariants[0];
function window(events, complete) {
    return {
        sessionID: "ses_inv",
        events: events,
        factStateComplete: complete,
    };
}
var turn = function (id) { return ({ type: "turn.started", id: id }); };
(0, bun_test_1.test)("turns with an incomplete projection violate", function () {
    var violations = check.check({
        sessions: [window([turn("turn_1"), turn("turn_2")], false)],
    });
    (0, bun_test_1.expect)(violations).toHaveLength(1);
    (0, bun_test_1.expect)(violations[0].code).toBe("session.projection_incomplete");
    (0, bun_test_1.expect)(violations[0].detail).toContain("ses_inv");
    // D2: the citation travels on the violation itself, for the journal event.
    (0, bun_test_1.expect)(violations[0].sessionID).toBe("ses_inv");
});
(0, bun_test_1.test)("a completed projection is clean, and sessions without turns are exempt", function () {
    (0, bun_test_1.expect)(check.check({ sessions: [window([turn("turn_1")], true)] })).toHaveLength(0);
    // Boot noise (created/ready events) with no turns must not trip it.
    (0, bun_test_1.expect)(check.check({
        sessions: [
            window([
                {
                    type: "session.created",
                    sessionID: "ses_inv",
                    title: "t",
                },
            ], false),
        ],
    })).toHaveLength(0);
});
