"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var workspace_change_auditor_1 = require("../src/workspace-change-auditor");
(0, bun_test_1.test)("a single hint reconciles into one confirmed change", function () {
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.observe({ path: "src/a.ts", operation: "modified" });
    var changes = auditor.reconcile(["src/a.ts", "src/b.ts"]);
    (0, bun_test_1.expect)(changes).toHaveLength(1);
    (0, bun_test_1.expect)(changes[0]).toMatchObject({
        workspaceRoot: "/srv/project",
        path: "src/a.ts",
        operation: "modified",
        origin: "unknown",
        attribution: "unattributed",
    });
});
(0, bun_test_1.test)("a path absent at reconcile confirms as deleted", function () {
    var _a;
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.observe({ path: "gone.txt", operation: "modified" });
    var changes = auditor.reconcile(["still-here.txt"]);
    (0, bun_test_1.expect)((_a = changes[0]) === null || _a === void 0 ? void 0 : _a.operation).toBe("deleted");
});
(0, bun_test_1.test)("a deleted hint stays deleted even if the path reappears", function () {
    var _a;
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.observe({ path: "f.txt", operation: "deleted" });
    var changes = auditor.reconcile(["f.txt"]);
    (0, bun_test_1.expect)((_a = changes[0]) === null || _a === void 0 ? void 0 : _a.operation).toBe("deleted");
});
(0, bun_test_1.test)("a burst of events for one path coalesces to a single change", function () {
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.observe({ path: "a.txt", operation: "added" });
    auditor.observe({ path: "a.txt", operation: "modified" });
    auditor.observe({ path: "a.txt", operation: "modified" });
    auditor.observe({ path: "b.txt", operation: "modified" });
    var changes = auditor.reconcile(["a.txt", "b.txt"]);
    (0, bun_test_1.expect)(changes).toHaveLength(2);
    var a = changes.find(function (change) { return change.path === "a.txt"; });
    (0, bun_test_1.expect)(a === null || a === void 0 ? void 0 : a.operation).toBe("modified");
});
(0, bun_test_1.test)("reconcile clears the pending buffer", function () {
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.observe({ path: "a.txt", operation: "modified" });
    auditor.reconcile(["a.txt"]);
    (0, bun_test_1.expect)(auditor.reconcile(["a.txt"])).toEqual([]);
});
(0, bun_test_1.test)("a known origin attributes the change", function () {
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
        resolveOrigin: function (path) {
            return path.startsWith("src/") ? "tool" : undefined;
        },
        hasReliableIdentity: function () { return true; },
    });
    auditor.observe({ path: "src/a.ts", operation: "modified" });
    auditor.observe({ path: "lib/b.ts", operation: "modified" });
    var changes = auditor.reconcile(["src/a.ts", "lib/b.ts"]);
    var toolChange = changes.find(function (change) { return change.path === "src/a.ts"; });
    (0, bun_test_1.expect)(toolChange === null || toolChange === void 0 ? void 0 : toolChange.origin).toBe("tool");
    (0, bun_test_1.expect)(toolChange === null || toolChange === void 0 ? void 0 : toolChange.attribution).toBe("attributed");
    var unknownChange = changes.find(function (change) { return change.path === "lib/b.ts"; });
    (0, bun_test_1.expect)(unknownChange === null || unknownChange === void 0 ? void 0 : unknownChange.attribution).toBe("unattributed");
});
(0, bun_test_1.test)("an indeterminate window marks confirmed changes indeterminate", function () {
    var _a;
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
        resolveOrigin: function () { return "tool"; },
        hasReliableIdentity: function () { return true; },
    });
    auditor.markIndeterminate();
    auditor.observe({ path: "src/a.ts", operation: "modified" });
    var changes = auditor.reconcile(["src/a.ts"]);
    (0, bun_test_1.expect)((_a = changes[0]) === null || _a === void 0 ? void 0 : _a.attribution).toBe("indeterminate");
});
(0, bun_test_1.test)("degraded health is carried through the confirmed change", function () {
    var _a, _b;
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.setHealth("degraded", "inotify_limit");
    auditor.observe({ path: "a.txt", operation: "modified" });
    var changes = auditor.reconcile(["a.txt"]);
    (0, bun_test_1.expect)((_a = changes[0]) === null || _a === void 0 ? void 0 : _a.health).toBe("degraded");
    (0, bun_test_1.expect)((_b = changes[0]) === null || _b === void 0 ? void 0 : _b.healthReason).toBe("inotify_limit");
});
(0, bun_test_1.test)("recovering to healthy clears the indeterminate flag", function () {
    var _a;
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.markIndeterminate();
    auditor.setHealth("healthy");
    auditor.observe({ path: "a.txt", operation: "modified" });
    var changes = auditor.reconcile(["a.txt"]);
    (0, bun_test_1.expect)((_a = changes[0]) === null || _a === void 0 ? void 0 : _a.attribution).not.toBe("indeterminate");
});
(0, bun_test_1.test)("status reports health and pending count", function () {
    var auditor = (0, workspace_change_auditor_1.createWorkspaceChangeAuditor)({
        workspaceRoot: "/srv/project",
    });
    auditor.observe({ path: "a.txt", operation: "modified" });
    (0, bun_test_1.expect)(auditor.status()).toMatchObject({ health: "healthy", pending: 1 });
});
