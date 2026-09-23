"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var subagent_settled_notice_1 = require("../src/runtime/initialize/subagent-settled-notice");
(0, bun_test_1.test)("the notice is attributed to the runtime, not the subagent", function () {
    var content = (0, subagent_settled_notice_1.subagentSettledNoticeContent)({
        agentId: "a1",
        status: "completed",
        continuation: 0,
    });
    // The one distinction that matters: a transcript that merged the two would
    // credit the child with words it never wrote.
    (0, bun_test_1.expect)(content).toContain('source="subagent_settled"');
    (0, bun_test_1.expect)(content).toContain('trust="runtime"');
    (0, bun_test_1.expect)(content).toContain("This is the runtime reporting the outcome, not the subagent's own account");
});
(0, bun_test_1.test)("the notice states the terminal status and the stop reason when there is one", function () {
    var clean = (0, subagent_settled_notice_1.subagentSettledNoticeContent)({
        agentId: "a1",
        status: "completed",
        continuation: 0,
    });
    var stopped = (0, subagent_settled_notice_1.subagentSettledNoticeContent)({
        agentId: "a2",
        status: "stopped",
        continuation: 0,
        stopReason: "wall-clock budget of 900000ms exceeded",
    });
    (0, bun_test_1.expect)(clean).toContain("a1 has finished: completed.");
    (0, bun_test_1.expect)(stopped).toContain("a2 has finished: stopped (wall-clock budget of 900000ms exceeded).");
});
(0, bun_test_1.test)("the notice quotes the final result, bounded", function () {
    var short = (0, subagent_settled_notice_1.subagentSettledNoticeContent)({
        agentId: "a1",
        status: "completed",
        continuation: 0,
        finalResult: "read two files",
    });
    var longer = (0, subagent_settled_notice_1.subagentSettledNoticeContent)({
        agentId: "a1",
        status: "completed",
        continuation: 0,
        finalResult: "x".repeat(9000),
    });
    (0, bun_test_1.expect)(short).toContain("Its final result: read two files");
    // Bounded: the quote is capped rather than truncated by whatever the notice
    // happens to fit in, and the notice stops growing once the cap is reached —
    // an unbounded quote would put the subagent's whole transcript into the
    // parent's ledger and blow the prefix it is trying to preserve.
    (0, bun_test_1.expect)(longer).toContain("Its final result: " + "x".repeat(400) + "…");
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.subagentSettledNoticeContent)({
        agentId: "a1",
        status: "completed",
        continuation: 0,
        finalResult: "x".repeat(90000),
    }).length).toBe(longer.length);
});
(0, bun_test_1.test)("a notice with no final result quotes nothing", function () {
    var content = (0, subagent_settled_notice_1.subagentSettledNoticeContent)({
        agentId: "a1",
        status: "failed",
        continuation: 0,
    });
    (0, bun_test_1.expect)(content).not.toContain("Its final result");
    (0, bun_test_1.expect)(content).toContain("has finished: failed.");
});
(0, bun_test_1.test)("the entry id is stable per subagent and continuation", function () {
    // Stable so a re-emitted settle for the same continuation overwrites rather
    // than stacking duplicates in the ledger.
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeEntryID)("a1", 0)).toBe("subagent_settled:a1:0");
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeEntryID)("a1", 0)).toBe((0, subagent_settled_notice_1.settledNoticeEntryID)("a1", 0));
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeEntryID)("a1", 1)).not.toBe((0, subagent_settled_notice_1.settledNoticeEntryID)("a1", 0));
});
(0, bun_test_1.test)("the budget admits notices until it is spent, then stops", function () {
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeAllowed)(0, 3)).toBe(true);
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeAllowed)(2, 3)).toBe(true);
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeAllowed)(3, 3)).toBe(false);
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeAllowed)(99, 3)).toBe(false);
});
(0, bun_test_1.test)("a budget of zero disables the notices entirely", function () {
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeAllowed)(0, 0)).toBe(false);
});
(0, bun_test_1.test)("an unbounded budget admits every notice", function () {
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeAllowed)(0, Infinity)).toBe(true);
    (0, bun_test_1.expect)((0, subagent_settled_notice_1.settledNoticeAllowed)(10000, Infinity)).toBe(true);
});
(0, bun_test_1.test)("the default budget is a real finite number", function () {
    (0, bun_test_1.expect)(subagent_settled_notice_1.DEFAULT_SETTLED_NOTICE_BUDGET).toBeGreaterThan(0);
    (0, bun_test_1.expect)(Number.isFinite(subagent_settled_notice_1.DEFAULT_SETTLED_NOTICE_BUDGET)).toBe(true);
});
