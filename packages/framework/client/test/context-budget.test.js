"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var runtime_1 = require("@natalia/runtime");
var provider_selection_1 = require("../src/runtime/provider-selection");
(0, bun_test_1.test)("the default context config is a complete ContextBudget", function () {
    var budget = (0, provider_selection_1.defaultContextStatusConfig)();
    // Every field the plan §2.3 budget promises is resolved up front, so no
    // reader has to fall back to raw config with its own default.
    (0, bun_test_1.expect)(budget.max).toBeGreaterThan(0);
    (0, bun_test_1.expect)(budget.thresholdPercent).toBeGreaterThan(0);
    (0, bun_test_1.expect)(budget.reserved).toBeGreaterThan(0);
    (0, bun_test_1.expect)(budget.reservedSource).toBeTruthy();
    (0, bun_test_1.expect)(budget.preservedRecentMessages).toBeGreaterThan(0);
    (0, bun_test_1.expect)(budget.preservedRecentTokens).toBe(0);
    (0, bun_test_1.expect)(budget.maxOverflowRetries).toBeGreaterThanOrEqual(0);
    (0, bun_test_1.expect)(budget.prune.thresholdChars).toBeGreaterThan(0);
    // The default must itself satisfy the config-time invariant.
    (0, bun_test_1.expect)(function () { return (0, runtime_1.assertContextBudgetInvariants)(budget); }).not.toThrow();
});
(0, bun_test_1.test)("the default budget derives the threshold from its window and percent", function () {
    var budget = (0, provider_selection_1.defaultContextStatusConfig)();
    (0, bun_test_1.expect)((0, runtime_1.contextThresholdTokens)(budget)).toBe(Math.floor((budget.max * budget.thresholdPercent) / 100));
});
