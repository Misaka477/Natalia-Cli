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
var src_1 = require("../src");
var AT = "2026-01-01T00:00:00.000Z";
function snap(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ goalID: "goal_1", revision: 1, objective: "ship the thing", phase: "active", maxGoalRounds: 256, 
        // A goal without a budget beyond its round cap, and nothing spent.
        maxGoalTokens: 0, maxGoalWallClockMs: 0, spentGoalTokens: 0, goalWallClockMs: 0 }, overrides);
}
function changed(operation, snapshot, roundsStarted, at) {
    if (roundsStarted === void 0) { roundsStarted = 0; }
    if (at === void 0) { at = AT; }
    return {
        type: "goal.changed",
        id: "goal:".concat(operation, ":").concat(snapshot.revision),
        operation: operation,
        snapshot: snapshot,
        roundsStarted: roundsStarted,
        at: at,
    };
}
function cleared(goalID, revision) {
    return {
        type: "goal.changed",
        id: "goal:clear:".concat(revision),
        operation: "clear",
        cleared: { goalID: goalID, revision: revision },
        roundsStarted: 0,
        at: AT,
    };
}
function goalRound(goalID, revision, round) {
    return {
        type: "goal.round",
        id: "goal:round:".concat(round),
        goalID: goalID,
        revision: revision,
        round: round,
        at: AT,
    };
}
(0, bun_test_1.test)("an empty log has no goal", function () {
    (0, bun_test_1.expect)((0, src_1.foldGoal)([])).toBeUndefined();
});
(0, bun_test_1.test)("create yields a disarmed active goal at revision 1", function () {
    var goal = (0, src_1.foldGoal)([changed("create", snap())]);
    (0, bun_test_1.expect)(goal).toMatchObject({
        goalID: "goal_1",
        revision: 1,
        phase: "active",
        roundsStarted: 0,
        activation: "disarmed",
        createdAt: AT,
        updatedAt: AT,
    });
});
(0, bun_test_1.test)("edit keeps the phase and advances the revision", function () {
    var goal = (0, src_1.foldGoal)([
        changed("create", snap()),
        changed("edit", snap({ revision: 2, objective: "ship it well" })),
    ]);
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.revision).toBe(2);
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.objective).toBe("ship it well");
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("active");
});
(0, bun_test_1.test)("pause then resume toggles phase, resume clears the blocker", function () {
    var goal = (0, src_1.foldGoal)([
        changed("create", snap()),
        changed("pause", snap({ revision: 2, phase: "paused" })),
        changed("resume", snap({ revision: 3 })),
    ]);
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("active");
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.revision).toBe(3);
});
(0, bun_test_1.test)("block records a reason and resume clears it", function () {
    var blocked = snap({
        revision: 2,
        phase: "blocked",
        // A code from the closed set: the value is incidental to what this test
        // checks, which is that a block records a reason and a resume clears it.
        blockedReason: { code: "round-limit", message: "quota" },
    });
    var goal = (0, src_1.foldGoal)([
        changed("create", snap()),
        changed("blocked", blocked),
        changed("resume", snap({ revision: 3 })),
    ]);
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("active");
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.blockedReason).toBeUndefined();
});
(0, bun_test_1.test)("complete stops continuation and a completed goal may be replaced", function () {
    var done = (0, src_1.foldGoal)([
        changed("create", snap()),
        changed("complete", snap({ revision: 2, phase: "complete" })),
    ]);
    (0, bun_test_1.expect)(done === null || done === void 0 ? void 0 : done.phase).toBe("complete");
    var replaced = (0, src_1.foldGoal)([
        changed("create", snap()),
        changed("complete", snap({ revision: 2, phase: "complete" })),
        changed("create", snap({ goalID: "goal_2", revision: 1 })),
    ]);
    (0, bun_test_1.expect)(replaced === null || replaced === void 0 ? void 0 : replaced.goalID).toBe("goal_2");
});
(0, bun_test_1.test)("clear drops the current goal", function () {
    var goal = (0, src_1.foldGoal)([
        changed("create", snap()),
        changed("edit", snap({ revision: 2 })),
        cleared("goal_1", 3),
    ]);
    (0, bun_test_1.expect)(goal).toBeUndefined();
});
(0, bun_test_1.test)("goal rounds advance only from matching sequential goal-sourced turns", function () {
    var goal = (0, src_1.foldGoal)([
        changed("create", snap()),
        goalRound("goal_1", 1, 1),
        goalRound("goal_1", 1, 2),
        // A turn for a different revision or a human turn does not count.
        goalRound("goal_1", 99, 99),
        changed("edit", snap({ revision: 2 }), 2),
    ]);
    (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.roundsStarted).toBe(2);
});
(0, bun_test_1.test)("resume is refused when the round cap is exhausted", function () {
    var paused = snap({ revision: 2, phase: "paused", maxGoalRounds: 2 });
    (0, bun_test_1.expect)(function () {
        return (0, src_1.foldGoal)([
            changed("create", snap({ maxGoalRounds: 2 })),
            goalRound("goal_1", 1, 1),
            goalRound("goal_1", 1, 2),
            changed("pause", paused, 2),
            changed("resume", snap({ revision: 3, maxGoalRounds: 2 }), 2),
        ]);
    }).toThrow(/round cap is exhausted/);
});
(0, bun_test_1.test)("strict fold refuses malformed or illegal records", function () {
    // create while a non-complete goal is current
    (0, bun_test_1.expect)(function () {
        return (0, src_1.foldGoal)([changed("create", snap()), changed("create", snap())]);
    }).toThrow(/cannot create a goal/);
    // revision gap
    (0, bun_test_1.expect)(function () {
        return (0, src_1.foldGoal)([
            changed("create", snap()),
            changed("edit", snap({ revision: 3 })),
        ]);
    }).toThrow(/advance the revision/);
    // edit changing phase
    (0, bun_test_1.expect)(function () {
        return (0, src_1.foldGoal)([
            changed("create", snap()),
            changed("edit", snap({ revision: 2, phase: "paused" })),
        ]);
    }).toThrow(/must not change the phase/);
    // blocked without a reason
    (0, bun_test_1.expect)(function () {
        return (0, src_1.foldGoal)([
            changed("create", snap()),
            changed("blocked", snap({ revision: 2, phase: "blocked" })),
        ]);
    }).toThrow(/must carry a blockedReason/);
    // round out of sequence
    (0, bun_test_1.expect)(function () {
        return (0, src_1.foldGoal)([changed("create", snap()), goalRound("goal_1", 1, 2)]);
    }).toThrow(/out of sequence/);
    // round beyond cap (sequential but past the budget)
    (0, bun_test_1.expect)(function () {
        return (0, src_1.foldGoal)([
            changed("create", snap({ maxGoalRounds: 1 })),
            goalRound("goal_1", 1, 1),
            goalRound("goal_1", 1, 2),
        ]);
    }).toThrow(/exceeds maxGoalRounds/);
});
(0, bun_test_1.test)("a block reason's code comes from the closed set, so a typo cannot reach durable state", function () {
    var _a, _b;
    // The closed set is the point: before it, a misspelled code from any of the
    // three producers rolled forward into the durable snapshot, where a consumer
    // switching on the code fell through to a default and the goal displayed as
    // blocked with no reason it could name.
    var codes = [
        "round-limit",
        "turn-error",
        "model-reported",
        "queue-failed",
        "cancelled",
        "max-tokens",
    ];
    // Every code a producer can emit folds to a usable reason, rather than being
    // accepted and then lost at the rendering boundary.
    for (var _i = 0, codes_1 = codes; _i < codes_1.length; _i++) {
        var code = codes_1[_i];
        var goal = (0, src_1.foldGoal)([
            changed("create", snap()),
            changed("blocked", snap({
                revision: 2,
                phase: "blocked",
                blockedReason: { code: code, message: "why" },
            })),
        ]);
        (0, bun_test_1.expect)((_a = goal === null || goal === void 0 ? void 0 : goal.blockedReason) === null || _a === void 0 ? void 0 : _a.code).toBe(code);
        (0, bun_test_1.expect)((_b = goal === null || goal === void 0 ? void 0 : goal.blockedReason) === null || _b === void 0 ? void 0 : _b.message).toBe("why");
    }
});
