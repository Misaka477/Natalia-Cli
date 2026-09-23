"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var invariants_1 = require("../src/invariants");
var work_contract_1 = require("../src/work-contract");
var machine = invariants_1.workLedgerInvariants[0];
var evidence = invariants_1.workLedgerInvariants[1];
var now = "2026-01-01T00:00:00.000Z";
var drafted = function (planID, planVersion) {
    return (0, work_contract_1.buildWorkContractDrafted)({
        id: "wc:".concat(planID, ":").concat(planVersion),
        planID: planID,
        planVersion: planVersion,
        draftedAt: now,
    });
};
var accepted = function (planID, planVersion) {
    return (0, work_contract_1.buildWorkContractAccepted)({
        id: "wc:".concat(planID, ":").concat(planVersion, ":ok"),
        planID: planID,
        planVersion: planVersion,
        acceptedAt: now,
    });
};
var completion = function (taskID) {
    return ({
        type: "completion.recorded",
        id: "comp_1",
        taskID: taskID,
        objective: "done",
        changeSummary: "s",
        validations: [],
        recordedAt: now,
    });
};
var run = function (check) {
    var events = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        events[_i - 1] = arguments[_i];
    }
    return check.check({
        sessions: [{ sessionID: "ses_w", events: events, factStateComplete: true }],
    });
};
(0, bun_test_1.test)("draft then accept is the legal machine path", function () {
    (0, bun_test_1.expect)(run(machine, drafted("plan:1", 1), accepted("plan:1", 1))).toHaveLength(0);
});
(0, bun_test_1.test)("an acceptance without a matching draft violates — by version too", function () {
    var noDraft = run(machine, accepted("plan:1", 1));
    (0, bun_test_1.expect)(noDraft).toHaveLength(1);
    (0, bun_test_1.expect)(noDraft[0].code).toBe("work_contract.accepted_without_draft");
    // A draft for ANOTHER version does not license this acceptance.
    var wrongVersion = run(machine, drafted("plan:1", 2), accepted("plan:1", 1));
    (0, bun_test_1.expect)(wrongVersion).toHaveLength(1);
    // And the draft may live in a different window (cross-session contracts).
    var across = machine.check({
        sessions: [
            {
                sessionID: "a",
                events: [drafted("plan:9", 3)],
                factStateComplete: true,
            },
            {
                sessionID: "b",
                events: [accepted("plan:9", 3)],
                factStateComplete: true,
            },
        ],
    });
    (0, bun_test_1.expect)(across).toHaveLength(0);
});
(0, bun_test_1.test)("an accepted contract must end with evidence for its plan", function () {
    var missing = run(evidence, accepted("plan:1", 1));
    (0, bun_test_1.expect)(missing).toHaveLength(1);
    (0, bun_test_1.expect)(missing[0].code).toBe("work_contract.accepted_without_evidence");
    (0, bun_test_1.expect)(run(evidence, accepted("plan:1", 1), completion("plan:1"))).toHaveLength(0);
    // completion for a DIFFERENT plan does not satisfy this one.
    (0, bun_test_1.expect)(run(evidence, accepted("plan:1", 1), completion("plan:2"))).toHaveLength(1);
});
