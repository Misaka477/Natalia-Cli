"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
function toolUpdate(name, status, args) {
    if (args === void 0) { args = ""; }
    return {
        type: "tool.update",
        id: "tu_".concat(Math.random()),
        name: name,
        status: status,
        summary: "",
        argumentsDelta: args,
    };
}
(0, bun_test_1.test)("deriveDriftBehaviorSignals classifies actions and collects failures with a hashed key", function () {
    var signals = (0, src_1.deriveDriftBehaviorSignals)([
        toolUpdate("read_file", "succeeded"),
        { type: "evidence.recorded", id: "e1" },
        toolUpdate("run_shell", "failed", "bun test"),
        toolUpdate("run_shell", "failed", "bun test"),
        toolUpdate("run_shell", "failed", "bun test"),
        { type: "completion.recorded", id: "c1" },
    ]);
    // Actions: tool_call, evidence, tool_call x3, completion.
    (0, bun_test_1.expect)(signals.recentActions.map(function (a) { return a.kind; })).toEqual([
        "tool_call",
        "evidence.recorded",
        "tool_call",
        "tool_call",
        "tool_call",
        "completion.recorded",
    ]);
    // Three failed run_shell calls, all with the same args → the same key.
    (0, bun_test_1.expect)(signals.recentFailures).toHaveLength(3);
    (0, bun_test_1.expect)(signals.recentFailures.every(function (f) { return f.toolName === "run_shell"; })).toBe(true);
    (0, bun_test_1.expect)(new Set(signals.recentFailures.map(function (f) { return f.key; })).size).toBe(1);
    // The key is a hash, never the raw args.
    (0, bun_test_1.expect)(signals.recentFailures[0].key).not.toContain("bun test");
});
(0, bun_test_1.test)("deriveDriftBehaviorSignals distinguishes different args by key", function () {
    var signals = (0, src_1.deriveDriftBehaviorSignals)([
        toolUpdate("run_shell", "failed", "bun test"),
        toolUpdate("run_shell", "failed", "bun run build"),
        toolUpdate("run_shell", "failed", "git status"),
    ]);
    (0, bun_test_1.expect)(new Set(signals.recentFailures.map(function (f) { return f.key; })).size).toBe(3);
});
(0, bun_test_1.test)("evaluateBehavior runs only the behaviour rules (no objective/contract spam)", function () {
    var evaluator = (0, src_1.createDriftEvaluator)({ openFindingIDs: function () { return new Set(); } });
    // Empty activity, no changes/contract: the objective rule would fire on a full
    // evaluate, but evaluateBehavior must not.
    var findings = evaluator.evaluateBehavior({
        sessionID: "ses_b",
        turnID: "t_b",
        objective: "ship it",
        currentActivity: "",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        recentActions: Array.from({ length: 8 }, function () { return ({
            kind: "tool_call",
        }); }),
    });
    (0, bun_test_1.expect)(findings.map(function (f) { var _a, _b; return (_b = (_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.rule; })).toEqual(["no_progress"]);
});
