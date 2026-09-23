"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var token_usage_1 = require("../src/token-usage");
(0, bun_test_1.describe)("totalInputTokens", function () {
    (0, bun_test_1.test)("counts cached traffic in the denominator", function () {
        (0, bun_test_1.expect)((0, token_usage_1.totalInputTokens)({
            inputTokens: 2000,
            cacheReadInputTokens: 100000,
            cacheCreationInputTokens: 20000,
        })).toBe(122000);
    });
    (0, bun_test_1.test)("treats omitted cache fields as zero", function () {
        (0, bun_test_1.expect)((0, token_usage_1.totalInputTokens)({ inputTokens: 1234 })).toBe(1234);
    });
});
(0, bun_test_1.describe)("cacheHitRate", function () {
    (0, bun_test_1.test)("is write-aware: cache writes are in the denominator", function () {
        // The provider trace used to divide the read by `inputTokens`, which is the
        // *uncached* remainder on every provider. 100k read against 2k fresh input
        // read as 5000%; the correct figure is the read's share of all input.
        (0, bun_test_1.expect)((0, token_usage_1.cacheHitRate)({
            inputTokens: 2000,
            cacheReadInputTokens: 100000,
            cacheCreationInputTokens: 20000,
        })).toBeCloseTo(100000 / 122000, 10);
    });
    (0, bun_test_1.test)("a write-heavy session is not a high hit rate", function () {
        var writeHeavy = (0, token_usage_1.cacheHitRate)({
            inputTokens: 1000,
            cacheReadInputTokens: 1000,
            cacheCreationInputTokens: 1000000,
        });
        (0, bun_test_1.expect)(writeHeavy).toBeCloseTo(1000 / 1002000, 10);
        (0, bun_test_1.expect)(writeHeavy).toBeLessThan(0.01);
    });
    (0, bun_test_1.test)("a fully cached request rates 1", function () {
        (0, bun_test_1.expect)((0, token_usage_1.cacheHitRate)({
            inputTokens: 0,
            cacheReadInputTokens: 50000,
        })).toBe(1);
    });
    (0, bun_test_1.test)("an uncached request rates 0", function () {
        (0, bun_test_1.expect)((0, token_usage_1.cacheHitRate)({ inputTokens: 7000 })).toBe(0);
    });
    (0, bun_test_1.test)("a request with no input at all rates 0 rather than dividing by zero", function () {
        (0, bun_test_1.expect)((0, token_usage_1.cacheHitRate)({ inputTokens: 0 })).toBe(0);
        (0, bun_test_1.expect)((0, token_usage_1.cacheHitRate)({
            inputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
        })).toBe(0);
    });
});
