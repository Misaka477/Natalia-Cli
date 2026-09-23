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
(0, bun_test_1.test)("session inbox exact retry is idempotent and conflicting reuse is rejected", function () {
    var session = (0, src_1.createSessionRecord)("ses_inbox", "Inbox");
    var input = {
        id: "turn_one",
        text: "hello",
        delivery: "next-step",
    };
    var first = (0, src_1.admitInput)(session, input, new Date("2026-07-21T00:00:00.000Z"));
    (0, bun_test_1.expect)((0, src_1.admitInput)(session, input)).toEqual(first);
    (0, bun_test_1.expect)(function () { return (0, src_1.admitInput)(session, __assign(__assign({}, input), { text: "different" })); }).toThrow(src_1.SessionInputConflictError);
    (0, bun_test_1.expect)(function () {
        return (0, src_1.admitInput)(session, __assign(__assign({}, input), { delivery: "next-turn" }));
    }).toThrow(src_1.SessionInputConflictError);
});
(0, bun_test_1.test)("session inbox treats structured mentions as part of admission identity", function () {
    var session = (0, src_1.createSessionRecord)("ses_mentions", "Mentions");
    var input = {
        id: "turn_mentions",
        text: "inspect",
        delivery: "next-step",
        resources: [{ server: "docs", uri: "docs://guide", name: "Guide" }],
        agents: [{ name: "review" }],
    };
    var first = (0, src_1.admitInput)(session, input);
    (0, bun_test_1.expect)((0, src_1.admitInput)(session, input)).toEqual(first);
    (0, bun_test_1.expect)(function () {
        return (0, src_1.admitInput)(session, __assign(__assign({}, input), { agents: [{ name: "build" }] }));
    }).toThrow(src_1.SessionInputConflictError);
});
(0, bun_test_1.test)("next-step inputs are promoted before next-turn inputs", function () {
    var session = (0, src_1.createSessionRecord)("ses_promote", "Promote");
    (0, src_1.admitInput)(session, { id: "step_a", text: "a", delivery: "next-step" });
    (0, src_1.admitInput)(session, { id: "turn_a", text: "b", delivery: "next-turn" });
    (0, src_1.admitInput)(session, { id: "step_b", text: "c", delivery: "next-step" });
    (0, src_1.admitInput)(session, { id: "turn_b", text: "d", delivery: "next-turn" });
    (0, bun_test_1.expect)((0, src_1.promoteNextSteps)(session).map(function (item) { return item.id; })).toEqual([
        "step_a",
        "step_b",
    ]);
    (0, bun_test_1.expect)((0, src_1.promoteNextTurn)(session).map(function (item) { return item.id; })).toEqual(["turn_a"]);
    (0, bun_test_1.expect)((0, src_1.promoteNextTurn)(session).map(function (item) { return item.id; })).toEqual(["turn_b"]);
    (0, bun_test_1.expect)((0, src_1.promoteNextTurn)(session)).toEqual([]);
});
(0, bun_test_1.test)("next-step promotion honors a captured admission cutoff", function () {
    var _a, _b;
    var session = (0, src_1.createSessionRecord)("ses_cutoff", "Cutoff");
    (0, src_1.admitInput)(session, {
        id: "before",
        text: "before",
        delivery: "next-step",
    });
    var cutoff = session.inbox[0].admittedSeq;
    (0, src_1.admitInput)(session, { id: "after", text: "after", delivery: "next-step" });
    (0, bun_test_1.expect)((0, src_1.promoteNextSteps)(session, cutoff).map(function (item) { return item.id; })).toEqual([
        "before",
    ]);
    (0, bun_test_1.expect)((_b = (_a = session.inbox) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.id === "after"; })) === null || _b === void 0 ? void 0 : _b.promotedAt).toBeUndefined();
});
(0, bun_test_1.test)("claimNextSteps takes every pending next-step and marks it promoted", function () {
    var session = (0, src_1.createSessionRecord)("ses_claim", "Claim");
    (0, src_1.admitInput)(session, { id: "s1", text: "a", delivery: "next-step" });
    (0, src_1.admitInput)(session, { id: "q1", text: "b", delivery: "next-turn" });
    (0, src_1.admitInput)(session, { id: "s2", text: "c", delivery: "next-step" });
    var claimed = (0, src_1.claimNextSteps)(session, "turn_1", 3);
    (0, bun_test_1.expect)(claimed.map(function (item) { return item.id; })).toEqual(["s1", "s2"]);
    (0, bun_test_1.expect)(claimed[0].claimedTurnID).toBe("turn_1");
    (0, bun_test_1.expect)(claimed[0].claimedStep).toBe(3);
    // Claimed steps are no longer promotable by a drain.
    (0, bun_test_1.expect)((0, src_1.promoteNextSteps)(session)).toEqual([]);
    (0, bun_test_1.expect)((0, src_1.promoteNextTurn)(session).map(function (item) { return item.id; })).toEqual(["q1"]);
});
(0, bun_test_1.test)("remove and replace only touch not-yet-promoted inputs", function () {
    var _a, _b, _c;
    var session = (0, src_1.createSessionRecord)("ses_mutate", "Mutate");
    (0, src_1.admitInput)(session, { id: "a", text: "first", delivery: "next-turn" });
    (0, src_1.admitInput)(session, { id: "b", text: "second", delivery: "next-turn" });
    (0, bun_test_1.expect)((_a = (0, src_1.replaceAdmittedInput)(session, "a", "edited")) === null || _a === void 0 ? void 0 : _a.text).toBe("edited");
    (0, bun_test_1.expect)((_b = (0, src_1.removeAdmittedInput)(session, "b")) === null || _b === void 0 ? void 0 : _b.id).toBe("b");
    (0, bun_test_1.expect)((_c = session.inbox) === null || _c === void 0 ? void 0 : _c.map(function (item) { return item.id; })).toEqual(["a"]);
    (0, src_1.promoteNextTurn)(session);
    (0, bun_test_1.expect)((0, src_1.removeAdmittedInput)(session, "a")).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.replaceAdmittedInput)(session, "a", "late")).toBeUndefined();
});
(0, bun_test_1.test)("promoteInputToStep moves a queued turn into the running turn", function () {
    var _a;
    var session = (0, src_1.createSessionRecord)("ses_steer", "Steer");
    (0, src_1.admitInput)(session, { id: "a", text: "next", delivery: "next-turn" });
    (0, bun_test_1.expect)((_a = (0, src_1.promoteInputToStep)(session, "a")) === null || _a === void 0 ? void 0 : _a.delivery).toBe("next-step");
    (0, bun_test_1.expect)((0, src_1.claimNextSteps)(session, "turn_1", 1).map(function (item) { return item.id; })).toEqual([
        "a",
    ]);
    (0, bun_test_1.expect)((0, src_1.promoteInputToStep)(session, "a")).toBeUndefined();
});
(0, bun_test_1.test)("normalizeInbox maps legacy steer/queue to next-turn", function () {
    var session = (0, src_1.createSessionRecord)("ses_legacy", "Legacy");
    session.inbox = [
        {
            id: "s",
            sessionID: session.id,
            text: "old steer",
            delivery: "steer",
            admittedAt: new Date(0).toISOString(),
            admittedSeq: 1,
        },
        {
            id: "q",
            sessionID: session.id,
            text: "old queue",
            delivery: "queue",
            admittedAt: new Date(0).toISOString(),
            admittedSeq: 2,
        },
        {
            id: "n",
            sessionID: session.id,
            text: "new step",
            delivery: "next-step",
            admittedAt: new Date(0).toISOString(),
            admittedSeq: 3,
        },
    ];
    (0, src_1.normalizeInbox)(session);
    (0, bun_test_1.expect)(session.inbox.map(function (item) { return item.delivery; })).toEqual([
        "next-turn",
        "next-turn",
        "next-step",
    ]);
});
(0, bun_test_1.test)("admission and update facts carry the text digest", function () {
    var admission = (0, src_1.buildInputAdmission)({
        id: "in_1",
        text: "hello",
        delivery: "next-step",
        admittedAt: "2026-01-01T00:00:00.000Z",
        admittedSeq: 3,
    });
    (0, bun_test_1.expect)(admission).toMatchObject({
        type: "input.admitted",
        id: "in_1",
        text: "hello",
        delivery: "next-step",
        admittedAt: "2026-01-01T00:00:00.000Z",
        admittedSeq: 3,
    });
    (0, bun_test_1.expect)(admission.sha256).toHaveLength(64);
    (0, bun_test_1.expect)(admission.byteLength).toBe(5);
    var updated = (0, src_1.buildInputUpdated)("in_1", "hello there");
    (0, bun_test_1.expect)(updated).toMatchObject({
        type: "input.updated",
        id: "in_1",
        text: "hello there",
    });
    (0, bun_test_1.expect)(updated.sha256).not.toBe(admission.sha256);
});
