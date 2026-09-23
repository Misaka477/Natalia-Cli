"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("agent registry selects visible primary agents and respects configured defaults", function () {
    var _a, _b;
    var registry = new src_1.AgentRegistry({
        defaultAgent: "hidden",
        agents: {
            worker: { description: "Worker", mode: "subagent" },
            hidden: { description: "Hidden", mode: "primary", hidden: true },
            review: { description: "Review", mode: "primary" },
        },
    });
    (0, bun_test_1.expect)((_a = registry.default()) === null || _a === void 0 ? void 0 : _a.name).toBe("review");
    (0, bun_test_1.expect)((_b = registry.select("worker")) === null || _b === void 0 ? void 0 : _b.mode).toBe("subagent");
    (0, bun_test_1.expect)(registry.selectable().map(function (agent) { return agent.name; })).toEqual(["review"]);
});
(0, bun_test_1.test)("agent registry replaces definitions and clears removed defaults", function () {
    var _a;
    var registry = new src_1.AgentRegistry({
        defaultAgent: "build",
        agents: { build: { description: "Build", mode: "primary" } },
    });
    registry.register({ name: "build", description: "Updated", mode: "primary" });
    (0, bun_test_1.expect)((_a = registry.get("build")) === null || _a === void 0 ? void 0 : _a.description).toBe("Updated");
    registry.remove("build");
    (0, bun_test_1.expect)(registry.default()).toBeUndefined();
});
