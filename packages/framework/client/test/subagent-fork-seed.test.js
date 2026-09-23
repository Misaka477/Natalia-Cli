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
var subagent_fork_seed_1 = require("../src/runtime/initialize/subagent-fork-seed");
function entry(id, role, extra) {
    if (extra === void 0) { extra = {}; }
    return __assign({ id: id, role: role, content: id }, extra);
}
var conversation = [
    entry("system", "system"),
    entry("u1", "user"),
    entry("a1", "assistant"),
    entry("c1", "tool_call", { pairID: "p1" }),
    entry("r1", "tool_result", { pairID: "p1" }),
    entry("u2", "user"),
    entry("a2", "assistant"),
    entry("c2", "tool_call", { pairID: "p2" }),
    entry("r2", "tool_result", { pairID: "p2" }),
    entry("u3", "user"),
    entry("a3", "assistant"),
    entry("c3", "tool_call", { pairID: "p3" }),
];
(0, bun_test_1.test)("the seed is everything before the parent's last user message", function () {
    // The last user message opens the turn the parent may still be inside, so the
    // in-flight work is excluded rather than shown to the child unanswered.
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.forkSeedEntries)(conversation).map(function (e) { return e.id; })).toEqual([
        "fork:u1",
        "fork:a1",
        "fork:c1",
        "fork:r1",
        "fork:u2",
        "fork:a2",
        "fork:c2",
        "fork:r2",
    ]);
});
(0, bun_test_1.test)("a trailing unpaired tool call is trimmed", function () {
    // Carrying it would ask the child to answer for work it never did.
    var seed = (0, subagent_fork_seed_1.forkSeedEntries)(conversation);
    (0, bun_test_1.expect)(seed.at(-1).role).toBe("tool_result");
    (0, bun_test_1.expect)(seed.some(function (e) { return e.role === "tool_call" && !e.pairID; })).toBe(false);
});
(0, bun_test_1.test)("a leading orphaned tool result is trimmed", function () {
    var orphaned = [
        entry("system", "system"),
        entry("r0", "tool_result", { pairID: "p0" }),
        entry("u1", "user"),
        entry("a1", "assistant"),
        entry("u2", "user"),
    ];
    // A provider rejects a conversation that opens with a tool result.
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.forkSeedEntries)(orphaned).map(function (e) { return e.id; })).toEqual([
        "fork:u1",
        "fork:a1",
    ]);
});
(0, bun_test_1.test)("the parent's system prompt never reaches the child", function () {
    var seed = (0, subagent_fork_seed_1.forkSeedEntries)(conversation);
    (0, bun_test_1.expect)(seed.some(function (e) { return e.role === "system"; })).toBe(false);
});
(0, bun_test_1.test)("runtime notices and resources stay with the parent", function () {
    // What the parent was told is not what the child should be told.
    var withRuntime = [
        entry("system", "system"),
        entry("u1", "user"),
        entry("settled:a1:0", "dynamic"),
        entry("res", "resource", { content: "a resource" }),
        entry("a1", "assistant"),
        entry("u2", "user"),
    ];
    var seed = (0, subagent_fork_seed_1.forkSeedEntries)(withRuntime);
    (0, bun_test_1.expect)(seed.map(function (e) { return e.id; })).toEqual(["fork:u1", "fork:a1"]);
});
(0, bun_test_1.test)("a compaction summary carries into the seed, because it is the history", function () {
    var compacted = [
        entry("system", "system"),
        entry("summary", "summary"),
        entry("u1", "user"),
        entry("a1", "assistant"),
        entry("u2", "user"),
    ];
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.forkSeedEntries)(compacted).map(function (e) { return e.id; })).toEqual([
        "fork:summary",
        "fork:u1",
        "fork:a1",
    ]);
});
(0, bun_test_1.test)("seeded ids are re-keyed so they cannot collide with the child's own", function () {
    // The ledger rejects a duplicate id, and a fork that failed to seed would
    // silently start the child with nothing.
    var seed = (0, subagent_fork_seed_1.forkSeedEntries)(conversation);
    (0, bun_test_1.expect)(seed.every(function (e) { return e.id.startsWith("fork:"); })).toBe(true);
    (0, bun_test_1.expect)(seed.some(function (e) { return e.id === "system" || e.id === "task"; })).toBe(false);
});
(0, bun_test_1.test)("re-keying preserves tool pairing, which keys on pairID", function () {
    var seed = (0, subagent_fork_seed_1.forkSeedEntries)(conversation);
    var calls = seed.filter(function (e) { return e.role === "tool_call"; });
    var results = seed.filter(function (e) { return e.role === "tool_result"; });
    (0, bun_test_1.expect)(calls).toHaveLength(2);
    (0, bun_test_1.expect)(results).toHaveLength(2);
    var _loop_1 = function (call) {
        (0, bun_test_1.expect)(results.some(function (r) { return r.pairID === call.pairID; })).toBe(true);
    };
    for (var _i = 0, calls_1 = calls; _i < calls_1.length; _i++) {
        var call = calls_1[_i];
        _loop_1(call);
    }
});
(0, bun_test_1.test)("a conversation with no completed turn seeds nothing", function () {
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.forkSeedEntries)([entry("system", "system"), entry("u1", "user")])).toEqual([]);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.forkSeedEntries)([entry("system", "system"), entry("a1", "assistant")])).toEqual([]);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.forkSeedEntries)([])).toEqual([]);
});
(0, bun_test_1.test)("only seed roles carry over", function () {
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("user")).toBe(true);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("assistant")).toBe(true);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("tool_call")).toBe(true);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("tool_result")).toBe(true);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("summary")).toBe(true);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("system")).toBe(false);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("resource")).toBe(false);
    (0, bun_test_1.expect)((0, subagent_fork_seed_1.isSeedRole)("dynamic")).toBe(false);
});
