"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var evidence = function (id, status) {
    return ({
        type: "evidence.recorded",
        id: id,
        taskID: "t_".concat(id),
        objective: "o",
        status: status,
    });
};
var completion = function (id) {
    return ({
        type: "completion.recorded",
        id: id,
        taskID: "t_".concat(id),
        objective: "o",
        changeSummary: "c",
        validations: [],
        recordedAt: "2026-01-01T00:00:00.000Z",
    });
};
var decision = function (id) {
    return ({
        type: "decision.recorded",
        id: id,
        decision: "d_".concat(id),
        scope: "session",
        status: "accepted",
    });
};
(0, bun_test_1.test)("evictTerminalFacts bounds terminal entries but keeps active ones", function () {
    var state = (0, src_1.emptySessionFactState)();
    for (var i = 0; i < 500; i += 1)
        (0, src_1.applySessionFactEvent)(state, evidence("term".concat(i), "accepted"));
    for (var i = 0; i < 10; i += 1)
        (0, src_1.applySessionFactEvent)(state, evidence("active".concat(i), "validated"));
    for (var i = 0; i < 300; i += 1)
        (0, src_1.applySessionFactEvent)(state, completion("comp".concat(i)));
    for (var i = 0; i < 300; i += 1)
        (0, src_1.applySessionFactEvent)(state, decision("dec".concat(i)));
    var evicted = (0, src_1.evictTerminalFacts)(state, 200);
    (0, bun_test_1.expect)(evicted).toBe(true);
    var keptEvidence = state.intelligence.journalEvents.filter(function (event) { return event.type === "evidence.recorded"; });
    // Terminal evidence keeps the most recent 200; active evidence is kept whole.
    (0, bun_test_1.expect)(keptEvidence.filter(function (event) { return event.status === "accepted"; })).toHaveLength(200);
    (0, bun_test_1.expect)(keptEvidence.filter(function (event) { return event.status === "validated"; })).toHaveLength(10);
    (0, bun_test_1.expect)(state.intelligence.journalEvents.filter(function (event) { return event.type === "completion.recorded"; })).toHaveLength(200);
    (0, bun_test_1.expect)(state.decisions.records).toHaveLength(200);
});
(0, bun_test_1.test)("evictTerminalFacts keeps open/disputed drift and is idempotent", function () {
    var state = (0, src_1.emptySessionFactState)();
    for (var i = 0; i < 300; i += 1) {
        (0, src_1.applySessionFactEvent)(state, {
            type: "drift.finding_opened",
            id: "f".concat(i),
            findingID: "f".concat(i),
            severity: "advisory",
            confidence: 0.5,
            originalObjective: "o",
            currentActivity: "a",
            evidence: [],
            applicableConstraints: [],
            contractVersion: 1,
        });
        // Terminal: the finding was explained.
        (0, src_1.applySessionFactEvent)(state, {
            type: "drift.finding_updated",
            id: "f".concat(i, ":updated"),
            findingID: "f".concat(i),
            status: "explained",
        });
    }
    for (var i = 0; i < 5; i += 1)
        (0, src_1.applySessionFactEvent)(state, {
            type: "drift.finding_opened",
            id: "open".concat(i),
            findingID: "open".concat(i),
            severity: "advisory",
            confidence: 0.5,
            originalObjective: "o",
            currentActivity: "a",
            evidence: [],
            applicableConstraints: [],
            contractVersion: 1,
        });
    (0, bun_test_1.expect)((0, src_1.evictTerminalFacts)(state, 200)).toBe(true);
    var statuses = __spreadArray([], state.drift.findings.values(), true).map(function (f) { return f.status; });
    (0, bun_test_1.expect)(statuses.filter(function (s) { return s === "open"; }).length).toBe(5);
    // Terminal findings keep the most recent 200.
    (0, bun_test_1.expect)(statuses.filter(function (s) { return s === "explained"; }).length).toBe(200);
    // Second pass: already bounded, nothing more to evict.
    (0, bun_test_1.expect)((0, src_1.evictTerminalFacts)(state, 200)).toBe(false);
});
