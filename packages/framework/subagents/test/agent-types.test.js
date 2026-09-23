"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var agent_types_1 = require("../src/agent-types");
(0, bun_test_1.test)("an explicit allow-list is reported as itself", function () {
    (0, bun_test_1.expect)((0, agent_types_1.describeToolAccess)({
        name: "explore",
        description: "d",
        allowedTools: ["read_file"],
    })).toBe("tools: read_file");
});
(0, bun_test_1.test)("a type with no restrictions reports the whole set", function () {
    (0, bun_test_1.expect)((0, agent_types_1.describeToolAccess)({ name: "general", description: "d" })).toBe("tools: all available");
});
(0, bun_test_1.test)("a type narrowed by exclusions names the exclusions", function () {
    (0, bun_test_1.expect)((0, agent_types_1.describeToolAccess)({
        name: "planner",
        description: "d",
        excludedTools: ["write_file", "edit_file"],
    })).toBe("tools: all except write_file, edit_file");
});
(0, bun_test_1.test)("an empty exclusion list is the same as no restriction", function () {
    (0, bun_test_1.expect)((0, agent_types_1.describeToolAccess)({ name: "g", description: "d", excludedTools: [] })).toBe("tools: all available");
});
(0, bun_test_1.test)("only subagent-mode agents with a description are advertised", function () {
    // A primary agent is the main runner, not a spawn target, and one with no
    // description cannot be chosen for any reason.
    var rendered = (0, agent_types_1.renderSubagentTypes)([
        { name: "build", description: "primary agent", mode: "primary" },
        { name: "explore", description: "read-only search", mode: "subagent" },
        { name: "silent", description: "", mode: "subagent" },
    ]);
    (0, bun_test_1.expect)(rendered).toContain("explore: read-only search (tools: all available)");
    (0, bun_test_1.expect)(rendered).not.toContain("build");
    (0, bun_test_1.expect)(rendered).not.toContain("silent");
    (0, bun_test_1.expect)(rendered).toContain("Pass one of these as `type`");
});
(0, bun_test_1.test)("nothing spawnable renders nothing rather than an empty section", function () {
    // A section listing nothing reads as "there are types and they are
    // undocumented".
    (0, bun_test_1.expect)((0, agent_types_1.renderSubagentTypes)([])).toBe("");
    (0, bun_test_1.expect)((0, agent_types_1.renderSubagentTypes)([
        { name: "build", description: "primary", mode: "primary" },
    ])).toBe("");
});
(0, bun_test_1.test)("an unknown type throws rather than falling back to a general subagent", function () {
    // A caller that asked for a read-only explorer and got a full implementer has
    // not been served, and nothing downstream would say so.
    (0, bun_test_1.expect)(function () {
        return (0, agent_types_1.resolveSubagentType)("nope", [
            { name: "explore", description: "read-only", mode: "subagent" },
        ]);
    }).toThrow(/unknown subagent type "nope".*explore/);
});
(0, bun_test_1.test)("a known type resolves", function () {
    var agents = [
        { name: "explore", description: "read-only", mode: "subagent" },
    ];
    (0, bun_test_1.expect)((0, agent_types_1.resolveSubagentType)("explore", agents).name).toBe("explore");
});
