"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var tool_policy_derivation_1 = require("../src/tool-policy-derivation");
(0, bun_test_1.test)("agent policy falls back to mode defaults then agent overrides", function () {
    var mode = {
        allowedTools: ["a", "b"],
        excludedTools: ["x"],
    };
    var agent = {
        allowedTools: ["b", "c"],
        excludedTools: ["y"],
        permissions: { tools: { allow: ["plugin"], exclude: ["z"] } },
    };
    var _a = (0, tool_policy_derivation_1.deriveAgentToolPolicy)({ agent: agent, mode: mode }), allow = _a.allow, exclude = _a.exclude;
    (0, bun_test_1.expect)(allow).toEqual(["b", "c", "plugin"]);
    (0, bun_test_1.expect)(exclude).toEqual(["y", "z"]);
});
(0, bun_test_1.test)("agent policy uses mode only when the agent omits a field", function () {
    var mode = { allowedTools: ["base"], excludedTools: [] };
    var agent = {};
    var _a = (0, tool_policy_derivation_1.deriveAgentToolPolicy)({ agent: agent, mode: mode }), allow = _a.allow, exclude = _a.exclude;
    (0, bun_test_1.expect)(allow).toEqual(["base"]);
    (0, bun_test_1.expect)(exclude).toEqual([]);
});
(0, bun_test_1.test)("profile policy forwards allow and exclude verbatim", function () {
    var policy = (0, tool_policy_derivation_1.deriveProfileToolPolicy)({
        profile: {
            permissions: { tools: { allow: ["a"], exclude: ["b"] } },
        },
    });
    (0, bun_test_1.expect)(policy).toEqual({ allow: ["a"], exclude: ["b"] });
});
