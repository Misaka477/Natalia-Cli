"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var substrate_1 = require("@anthelia/substrate");
function submitted(id) {
    return {
        type: "turn.submitted",
        id: id,
        text: "hi",
        byteLength: 2,
        lineCount: 1,
        sha256: "x",
    };
}
function delta(id, text) {
    return { type: "content.delta", id: id, text: text };
}
(0, bun_test_1.test)("windowRuntimeEvents is a no-op when disabled or under the cap", function () {
    var events = [submitted("t1"), delta("t1", "a")];
    (0, bun_test_1.expect)((0, substrate_1.windowRuntimeEvents)(events, 0)).toBe(events);
    (0, bun_test_1.expect)((0, substrate_1.windowRuntimeEvents)(events, 10)).toBe(events);
});
(0, bun_test_1.test)("windowRuntimeEvents keeps the newest events aligned to a turn boundary", function () {
    var events = [
        submitted("t1"),
        delta("t1", "a"),
        delta("t1", "b"),
        submitted("t2"),
        delta("t2", "c"),
        delta("t2", "d"),
        submitted("t3"),
        delta("t3", "e"),
    ];
    var atBoundary = function (list) {
        return list.map(function (event) { return event.id; });
    };
    // 4 keeps the tail; the first turn boundary at/after the cut is t3.
    (0, bun_test_1.expect)(atBoundary((0, substrate_1.windowRuntimeEvents)(events, 4))).toEqual(["t3", "t3"]);
    // 6 reaches the t2 submission exactly, so t2 is included whole.
    (0, bun_test_1.expect)(atBoundary((0, substrate_1.windowRuntimeEvents)(events, 6))).toEqual([
        "t2",
        "t2",
        "t2",
        "t3",
        "t3",
    ]);
});
(0, bun_test_1.test)("windowRuntimeEvents keeps everything when no boundary is reachable", function () {
    var events = [delta("t1", "a"), delta("t1", "b")];
    (0, bun_test_1.expect)((0, substrate_1.windowRuntimeEvents)(events, 1)).toBe(events);
});
(0, bun_test_1.test)("maxLiveSessionEvents reads a positive env override and defaults to off", function () {
    var previous = process.env.NATALIA_MAX_LIVE_SESSION_EVENTS;
    try {
        process.env.NATALIA_MAX_LIVE_SESSION_EVENTS = "1234";
        (0, bun_test_1.expect)((0, substrate_1.maxLiveSessionEvents)()).toBe(1234);
        process.env.NATALIA_MAX_LIVE_SESSION_EVENTS = "0";
        (0, bun_test_1.expect)((0, substrate_1.maxLiveSessionEvents)()).toBe(0);
        delete process.env.NATALIA_MAX_LIVE_SESSION_EVENTS;
        (0, bun_test_1.expect)((0, substrate_1.maxLiveSessionEvents)()).toBe(0);
    }
    finally {
        if (previous === undefined)
            delete process.env.NATALIA_MAX_LIVE_SESSION_EVENTS;
        else
            process.env.NATALIA_MAX_LIVE_SESSION_EVENTS = previous;
    }
});
