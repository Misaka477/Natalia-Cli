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
var bun_test_1 = require("bun:test");
var invariants_1 = require("../src/invariants");
var check = invariants_1.constitutionInvariants[0];
var added = function (fields) {
    var _a;
    return (__assign({ type: "constitution.rule_added", statement: (_a = fields.statement) !== null && _a !== void 0 ? _a : "must", scope: "release", source: "policy", enforcement: "deny", at: "2026-01-01T00:00:00.000Z", sessionID: "ses_c" }, fields));
};
var updated = function (fields) {
    return (__assign({ type: "constitution.rule_updated", at: "2026-01-02T00:00:00.000Z" }, fields));
};
var removed = function (ruleID) {
    return ({
        type: "constitution.rule_removed",
        ruleID: ruleID,
        at: "2026-01-03T00:00:00.000Z",
    });
};
var run = function () {
    var events = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        events[_i] = arguments[_i];
    }
    return check.check({
        sessions: [{ sessionID: "ses_c", events: events, factStateComplete: true }],
    });
};
(0, bun_test_1.test)("removing a protected rule violates", function () {
    var violations = run(added({ ruleID: "C-1", priority: "critical", overridePolicy: "forbidden" }), removed("C-1"));
    (0, bun_test_1.expect)(violations).toHaveLength(1);
    (0, bun_test_1.expect)(violations[0].code).toBe("constitution.protected_rule_removed");
    (0, bun_test_1.expect)(violations[0].detail).toContain("C-1");
    (0, bun_test_1.expect)(violations[0].sessionID).toBe("ses_c");
});
(0, bun_test_1.test)("weakening a protected rule violates; strengthening or touching others does not", function () {
    var weaken = run(added({ ruleID: "C-1", priority: "critical", overridePolicy: "forbidden" }), updated({ ruleID: "C-1", priority: "low", overridePolicy: "forbidden" }));
    (0, bun_test_1.expect)(weaken).toHaveLength(1);
    (0, bun_test_1.expect)(weaken[0].code).toBe("constitution.protected_rule_weakened");
    var relax = run(added({ ruleID: "C-1", priority: "critical", overridePolicy: "forbidden" }), updated({
        ruleID: "C-1",
        priority: "critical",
        overridePolicy: "user_scoped",
    }));
    (0, bun_test_1.expect)(relax).toHaveLength(1);
    // A warn-only (unprotected) rule may be removed freely — the invariant
    // guards what the user marked untouchable, not all policy.
    (0, bun_test_1.expect)(run(added({ ruleID: "W-1", priority: "low", overridePolicy: "user_scoped" }), removed("W-1"))).toHaveLength(0);
    (0, bun_test_1.expect)(run(added({
        ruleID: "C-1",
        priority: "critical",
        overridePolicy: "forbidden",
    }))).toHaveLength(0);
});
(0, bun_test_1.test)("each session folds its own seeded ledger (no cross-session masking)", function () {
    var violations = check.check({
        sessions: [
            {
                sessionID: "ses_one",
                events: [
                    added({
                        ruleID: "C-1",
                        priority: "critical",
                        overridePolicy: "forbidden",
                    }),
                ],
                factStateComplete: true,
            },
            {
                sessionID: "ses_two",
                events: [removed("C-1")],
                factStateComplete: true,
            },
        ],
    });
    // ses_two removed a rule its own ledger never had — nothing protected to
    // remove there, so no violation; the fold never leaks across windows.
    (0, bun_test_1.expect)(violations).toHaveLength(0);
});
