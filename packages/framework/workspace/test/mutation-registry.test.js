"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var mutation_registry_1 = require("../src/mutation-registry");
var workspace_change_auditor_1 = require("../src/workspace-change-auditor");
(0, bun_test_1.test)("register creates an open expected mutation", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    var key = registry.register({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
        authorizedPaths: ["src"],
        expectedOperations: ["modified", "added"],
    });
    (0, bun_test_1.expect)(key).toBe("c_1");
    (0, bun_test_1.expect)(registry.pendingCount()).toBe(1);
});
(0, bun_test_1.test)("match hits an in-scope path with an expected operation", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    registry.register({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
        authorizedPaths: ["src"],
        expectedOperations: ["modified", "added"],
    });
    var hit = registry.match({ path: "src/a.ts", operation: "modified" });
    (0, bun_test_1.expect)(hit).toMatchObject({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
    });
});
(0, bun_test_1.test)("match misses out-of-scope paths and unexpected operations", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    registry.register({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
        authorizedPaths: ["src"],
        expectedOperations: ["modified"],
    });
    (0, bun_test_1.expect)(registry.match({ path: "lib/b.ts", operation: "modified" })).toBeUndefined();
    (0, bun_test_1.expect)(registry.match({ path: "src/a.ts", operation: "deleted" })).toBeUndefined();
});
(0, bun_test_1.test)("a settled mutation stops matching but keeps its record", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    registry.register({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
        authorizedPaths: ["src"],
        expectedOperations: ["modified"],
    });
    registry.settle("c_1");
    (0, bun_test_1.expect)(registry.match({ path: "src/a.ts", operation: "modified" })).toBeUndefined();
    (0, bun_test_1.expect)(registry.pendingCount()).toBe(0);
});
(0, bun_test_1.test)("an operation identity matches without a turn", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    registry.register({
        operationID: "sandbox_merge_1",
        toolName: "sandbox_merge",
        authorizedPaths: ["."],
        expectedOperations: ["added", "modified", "deleted"],
    });
    (0, bun_test_1.expect)(registry.match({ path: "built/out.txt", operation: "added" })).toMatchObject({ operationID: "sandbox_merge_1" });
});
(0, bun_test_1.test)("forget drops an expected mutation entirely", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    registry.register({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
        authorizedPaths: ["src"],
        expectedOperations: ["modified"],
    });
    registry.forget("c_1");
    (0, bun_test_1.expect)(registry.pendingCount()).toBe(0);
    (0, bun_test_1.expect)(registry.match({ path: "src/a.ts", operation: "modified" })).toBeUndefined();
});
(0, bun_test_1.test)("the auditor attributes a registry-matched hint to the tool", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    registry.register({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
        authorizedPaths: ["src"],
        expectedOperations: ["modified"],
    });
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
        resolveOrigin: function (path) {
            return registry.match({ path: path, operation: "modified" })
                ? "tool"
                : undefined;
        },
        resolveIdentity: function (path) {
            var hit = registry.match({ path: path, operation: "modified" });
            if (!hit)
                return undefined;
            var identity = {
                origin: "tool",
            };
            if (hit.turnID)
                identity.turnID = hit.turnID;
            if (hit.callID)
                identity.callID = hit.callID;
            if (hit.operationID)
                identity.operationID = hit.operationID;
            if (hit.sessionID)
                identity.sessionID = hit.sessionID;
            if (hit.episodeID)
                identity.episodeID = hit.episodeID;
            return identity;
        },
        hasReliableIdentity: function () { return true; },
    });
    auditor.observe({ path: "src/a.ts", operation: "modified" });
    var changes = auditor.reconcile(["src/a.ts"]);
    (0, bun_test_1.expect)(changes[0]).toMatchObject({
        path: "src/a.ts",
        origin: "tool",
        attribution: "attributed",
        correlation: { turnID: "t_1", callID: "c_1" },
    });
});
(0, bun_test_1.test)("the auditor leaves an unmatched hint unattributed", function () {
    var registry = (0, mutation_registry_1.createMutationRegistry)();
    registry.register({
        turnID: "t_1",
        callID: "c_1",
        toolName: "write_file",
        authorizedPaths: ["src"],
        expectedOperations: ["modified"],
    });
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
        resolveOrigin: function (path) {
            return registry.match({ path: path, operation: "modified" })
                ? "tool"
                : undefined;
        },
        resolveIdentity: function (path) {
            var hit = registry.match({ path: path, operation: "modified" });
            if (!hit)
                return undefined;
            var identity = {
                origin: "tool",
            };
            if (hit.turnID)
                identity.turnID = hit.turnID;
            if (hit.callID)
                identity.callID = hit.callID;
            if (hit.operationID)
                identity.operationID = hit.operationID;
            if (hit.sessionID)
                identity.sessionID = hit.sessionID;
            if (hit.episodeID)
                identity.episodeID = hit.episodeID;
            return identity;
        },
        hasReliableIdentity: function () { return true; },
    });
    auditor.observe({ path: "lib/b.ts", operation: "modified" });
    var changes = auditor.reconcile(["lib/b.ts"]);
    (0, bun_test_1.expect)(changes[0]).toMatchObject({
        path: "lib/b.ts",
        origin: "unknown",
        attribution: "unattributed",
    });
});
