"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var src_1 = require("../src");
var root = (0, node_path_1.resolve)((0, node_os_1.tmpdir)(), "natalia-workspace-path-fixture");
(0, bun_test_1.test)("workspacePath resolves in-workspace relative paths", function () {
    (0, bun_test_1.expect)((0, src_1.workspacePath)(root, "src/index.ts")).toBe((0, node_path_1.join)(root, "src/index.ts"));
    (0, bun_test_1.expect)((0, src_1.workspacePath)(root, "./a/b.txt")).toBe((0, node_path_1.join)(root, "a/b.txt"));
    // An absolute path that is inside the workspace is allowed.
    (0, bun_test_1.expect)((0, src_1.workspacePath)(root, (0, node_path_1.join)(root, "inside.ts"))).toBe((0, node_path_1.join)(root, "inside.ts"));
});
(0, bun_test_1.test)("workspacePath refuses paths that leave the workspace", function () {
    var _loop_1 = function (escape_1) {
        (0, bun_test_1.expect)(function () { return (0, src_1.workspacePath)(root, escape_1); }, escape_1).toThrow(/path escapes workspace/);
    };
    for (var _i = 0, _a = [
        "..",
        "../outside.txt",
        "a/../../b",
        "../../etc/passwd",
    ]; _i < _a.length; _i++) {
        var escape_1 = _a[_i];
        _loop_1(escape_1);
    }
    // An absolute path outside the workspace is refused.
    (0, bun_test_1.expect)(function () {
        return (0, src_1.workspacePath)(root, (0, node_path_1.resolve)((0, node_os_1.tmpdir)(), "definitely-outside.txt"));
    }).toThrow(/path escapes workspace/);
});
(0, bun_test_1.test)("workspacePath allows in-workspace names that merely start with '..'", function () {
    // A file whose name starts with ".." is a legitimate in-workspace path, not an
    // escape: the escape check matches the whole leading segment, not a ".." prefix.
    var dotdot = (0, src_1.workspacePath)(root, "..config");
    (0, bun_test_1.expect)((0, node_path_1.isAbsolute)(dotdot)).toBe(true);
    (0, bun_test_1.expect)((0, node_path_1.relative)(root, dotdot)).toBe("..config");
    (0, bun_test_1.expect)(function () { return (0, src_1.workspacePath)(root, "nested/..data"); }).not.toThrow();
});
