"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var governance_1 = require("../src/governance");
(0, bun_test_1.test)("paths classify into risk tiers", function () {
    // The tool contract and the capability kernel are high risk.
    (0, bun_test_1.expect)((0, governance_1.riskTierForPath)("packages/core/tools/src/types.ts")).toBe("high");
    (0, bun_test_1.expect)((0, governance_1.riskTierForPath)("packages/core/capability/src/index.ts")).toBe("high");
    (0, bun_test_1.expect)((0, governance_1.riskTierForPath)("packages/core/plugin/src/index.ts")).toBe("high");
    // Implementation source is medium.
    (0, bun_test_1.expect)((0, governance_1.riskTierForPath)("packages/tool-fs/src/index.ts")).toBe("medium");
    (0, bun_test_1.expect)((0, governance_1.riskTierForPath)("packages/framework/client/src/runtime/main.ts")).toBe("medium");
    // Data and config are low.
    (0, bun_test_1.expect)((0, governance_1.riskTierForPath)(".natalia/config.json")).toBe("low");
    (0, bun_test_1.expect)((0, governance_1.riskTierForPath)("docs/guide.md")).toBe("low");
});
(0, bun_test_1.test)("a change set takes the highest of its changes", function () {
    (0, bun_test_1.expect)((0, governance_1.riskTierForChanges)([{ kind: "modify", path: "docs/guide.md" }])).toBe("low");
    (0, bun_test_1.expect)((0, governance_1.riskTierForChanges)([
        { kind: "modify", path: "docs/guide.md" },
        { kind: "modify", path: "packages/tool-fs/src/index.ts" },
    ])).toBe("medium");
    (0, bun_test_1.expect)((0, governance_1.riskTierForChanges)([
        { kind: "modify", path: "packages/core/tools/src/types.ts" },
        { kind: "modify", path: "packages/tool-fs/src/index.ts" },
    ])).toBe("high");
});
(0, bun_test_1.test)("approval gates are monotonic by tier", function () {
    (0, bun_test_1.expect)((0, governance_1.requiresApproval)("medium", "low")).toBe(true);
    (0, bun_test_1.expect)((0, governance_1.requiresApproval)("high", "high")).toBe(true);
    (0, bun_test_1.expect)((0, governance_1.requiresApproval)("low", "high")).toBe(false);
    (0, bun_test_1.expect)((0, governance_1.requiresApproval)("medium", "high")).toBe(false);
});
