"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var substrate_1 = require("@anthelia/substrate");
var session_1 = require("@anthelia/session");
function ruleEvent(id, ruleID) {
    return {
        type: "constitution.rule_added",
        id: id,
        ruleID: ruleID,
        statement: "rule ".concat(ruleID),
        scope: "project",
        priority: "high",
        source: "user",
        enforcement: "warn",
        overridePolicy: "forbidden",
    };
}
function fakeExec(events, fullEventsLoaded) {
    return {
        session: { id: "ses_facts", events: events },
        fullEventsLoaded: fullEventsLoaded,
    };
}
(0, bun_test_1.test)("ensureSessionFactState seeds lazily and records completeness", function () {
    var events = [ruleEvent("r1", "C-001")];
    var incomplete = fakeExec(events, false);
    (0, bun_test_1.expect)(incomplete.factState).toBeUndefined();
    var state = (0, substrate_1.ensureSessionFactState)(incomplete);
    (0, bun_test_1.expect)((0, session_1.sessionFactConstitutionRules)(state)).toHaveLength(1);
    (0, bun_test_1.expect)(incomplete.factStateComplete).toBe(false);
    // Memoized: a second call returns the same instance.
    (0, bun_test_1.expect)((0, substrate_1.ensureSessionFactState)(incomplete)).toBe(state);
    var complete = fakeExec([ruleEvent("r2", "C-002")], true);
    (0, substrate_1.ensureSessionFactState)(complete);
    (0, bun_test_1.expect)(complete.factStateComplete).toBe(true);
});
(0, bun_test_1.test)("feedSessionFactState is a no-op before seeding and incremental after", function () {
    var events = [ruleEvent("r1", "C-001")];
    var exec = fakeExec(events, true);
    // No state yet: feeding must not create one or throw.
    (0, substrate_1.feedSessionFactState)(exec, ruleEvent("r2", "C-002"));
    (0, bun_test_1.expect)(exec.factState).toBeUndefined();
    // First access folds the whole log (including the fed event's source).
    events.push(ruleEvent("r2", "C-002"));
    var state = (0, substrate_1.ensureSessionFactState)(exec);
    (0, bun_test_1.expect)((0, session_1.sessionFactConstitutionRules)(state)).toHaveLength(2);
    (0, substrate_1.feedSessionFactState)(exec, ruleEvent("r3", "C-003"));
    (0, bun_test_1.expect)((0, session_1.sessionFactConstitutionRules)(state)).toHaveLength(3);
});
(0, bun_test_1.test)("reseedSessionFactState rebuilds after the base log is replaced", function () {
    var exec = fakeExec([ruleEvent("r1", "C-001")], false);
    var state = (0, substrate_1.ensureSessionFactState)(exec);
    (0, bun_test_1.expect)((0, session_1.sessionFactConstitutionRules)(state)).toHaveLength(1);
    (0, bun_test_1.expect)(exec.factStateComplete).toBe(false);
    // Simulate `ensureSessionFullEvents` swapping in the full log.
    exec.session.events = [ruleEvent("r1", "C-001"), ruleEvent("r2", "C-002")];
    (0, substrate_1.reseedSessionFactState)(exec, true);
    (0, bun_test_1.expect)(exec.factState).not.toBe(state);
    (0, bun_test_1.expect)((0, session_1.sessionFactConstitutionRules)(exec.factState)).toHaveLength(2);
    (0, bun_test_1.expect)(exec.factStateComplete).toBe(true);
});
