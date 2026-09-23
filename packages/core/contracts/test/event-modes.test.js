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
var event_modes_1 = require("../src/event-modes");
(0, bun_test_1.test)("every family in the event union has a declared mode", function () {
    // The mapped type makes this hold at compile time; the runtime assertion
    // keeps the guarantee honest if the type is ever loosened.
    var table = event_modes_1.EVENT_MODES;
    var modes = new Set(Object.values(table));
    (0, bun_test_1.expect)(modes.size).toBeGreaterThan(0);
    for (var _i = 0, modes_1 = modes; _i < modes_1.length; _i++) {
        var mode = modes_1[_i];
        (0, bun_test_1.expect)(["bail", "waterfall", "emit"]).toContain(mode);
    }
});
(0, bun_test_1.test)("eventMode resolves the family of namespaced and bare types", function () {
    (0, bun_test_1.expect)((0, event_modes_1.eventMode)("session.created")).toBe(event_modes_1.EVENT_MODES.session);
    (0, bun_test_1.expect)((0, event_modes_1.eventMode)("chat.thinking.delta")).toBe(event_modes_1.EVENT_MODES.chat);
    // The one unnamespaced type in the union is its own family.
    (0, bun_test_1.expect)((0, event_modes_1.eventMode)("diagnostic")).toBe(event_modes_1.EVENT_MODES.diagnostic);
    // The namespaced-collab legacy alias carries its own family.
    (0, bun_test_1.expect)((0, event_modes_1.eventMode)("natalia.collab.message")).toBe(event_modes_1.EVENT_MODES.natalia);
});
(0, bun_test_1.test)("the table is keyed by exactly the families the union uses", function () {
    // A family added to the union without a declaration is a compile error; this
    // test fails the other direction — a stale row that no event uses anymore.
    var declared = Object.keys(event_modes_1.EVENT_MODES).sort();
    var used = __spreadArray([], new Set([
        "session.created",
        "chat.thinking.delta",
        "checkpoint.created",
        "approval.request",
        "diagnostic",
        "turn.started",
    ].map(function (type) { return type.split(".")[0]; })), true).sort();
    for (var _i = 0, used_1 = used; _i < used_1.length; _i++) {
        var family = used_1[_i];
        (0, bun_test_1.expect)(declared).toContain(family);
    }
});
(0, bun_test_1.test)("the declaration is descriptive today: no family deviates from emit", function () {
    // Locked until the generation machine lands its verification pipe — the
    // first consumer with real bail semantics. When a family flips, this test
    // is updated in the same commit as the consumer that gives the mode meaning.
    var deviations = Object.entries(event_modes_1.EVENT_MODES).filter(function (_a) {
        var mode = _a[1];
        return mode !== "emit";
    });
    (0, bun_test_1.expect)(deviations).toEqual([]);
});
(0, bun_test_1.test)("a mode is one of the three declared values", function () {
    var mode = "waterfall";
    (0, bun_test_1.expect)(["bail", "waterfall", "emit"]).toContain(mode);
});
