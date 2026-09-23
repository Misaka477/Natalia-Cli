"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var format_output_1 = require("../src/format-output");
(0, bun_test_1.test)("a log that fits is returned whole", function () {
    (0, bun_test_1.expect)((0, format_output_1.boundVerboseOutput)(["a", "b", "c"], 100)).toBe("a\nb\nc");
});
(0, bun_test_1.test)("an oversized log keeps the tail and says how much was dropped", function () {
    // The tail is what the parent acts on, and hiding the drop would make a
    // truncated log read as a subagent that finished early.
    var bounded = (0, format_output_1.boundVerboseOutput)(["old-1", "old-2", "new-1", "new-2"], 14);
    (0, bun_test_1.expect)(bounded).toContain("new-1");
    (0, bun_test_1.expect)(bounded).toContain("new-2");
    (0, bun_test_1.expect)(bounded).not.toContain("old-1");
    (0, bun_test_1.expect)(bounded).toContain("2 earlier steps omitted, 4 total");
});
(0, bun_test_1.test)("the drop note is singular for one omitted step", function () {
    // A budget that fits only the newest line, so exactly one is dropped.
    (0, bun_test_1.expect)((0, format_output_1.boundVerboseOutput)(["a", "b"], 2)).toContain("1 earlier step omitted");
});
(0, bun_test_1.test)("a budget of zero or less disables the bound", function () {
    // The escape hatch, matching how `0` means unlimited elsewhere in the repo.
    (0, bun_test_1.expect)((0, format_output_1.boundVerboseOutput)(["a", "b"], 0)).toBe("a\nb");
    (0, bun_test_1.expect)((0, format_output_1.boundVerboseOutput)(["a", "b"], -1)).toBe("a\nb");
});
(0, bun_test_1.test)("at least the newest line is always kept, even alone over budget", function () {
    // A bound that could return nothing would hide the subagent's final answer,
    // which is the one line the parent needs.
    (0, bun_test_1.expect)((0, format_output_1.boundVerboseOutput)(["tiny", "x".repeat(500)], 10)).toContain("x".repeat(500));
});
(0, bun_test_1.test)("the bound does not grow with the input", function () {
    // The property that matters: a subagent with more history must not hand the
    // parent a proportionally larger log.
    var few = (0, format_output_1.boundVerboseOutput)(["y".repeat(50), "z"], format_output_1.VERBOSE_OUTPUT_MAX_CHARS);
    var many = (0, format_output_1.boundVerboseOutput)(Array.from({ length: 400 }, function () { return "y".repeat(200); }), format_output_1.VERBOSE_OUTPUT_MAX_CHARS);
    (0, bun_test_1.expect)(many.length).toBeLessThan(format_output_1.VERBOSE_OUTPUT_MAX_CHARS + 200);
    (0, bun_test_1.expect)(few.length).toBeLessThan(many.length);
});
