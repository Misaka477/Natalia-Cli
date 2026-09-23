"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Test-workspace hygiene guard.
 *
 * Fails when `dist/ts/client-test-workspaces` still holds directories after a
 * test run. Every official-plugin test workspace is removed by the per-file
 * `useWorkspaceCleanup()` hook (see plugin-test-helpers.ts); residue means a
 * test file created workspaces without registering it, or a process was killed
 * hard mid-run. Either way the leak is bounded only by disk: 95,927 leftover
 * workspaces once exhausted btrfs metadata and turned every later verify red
 * with ENOSPC. This guard turns the silent leak into a loud failure.
 *
 * Run after `bun test` (the "test" script chains it), so a failing run is
 * already red — this guard exists for the quiet case where everything passes
 * and the disk still fills.
 */
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var root = process.cwd();
var residueRoot = (0, node_path_1.resolve)(root, "dist", "ts", "client-test-workspaces");
if (!(0, node_fs_1.existsSync)(residueRoot)) {
    console.log("test-workspace hygiene guard: no test workspaces present");
    process.exit(0);
}
var entries = (0, node_fs_1.readdirSync)(residueRoot);
var leftovers = entries.filter(function (entry) {
    try {
        return (0, node_fs_1.statSync)((0, node_path_1.resolve)(residueRoot, entry)).isDirectory();
    }
    catch (_a) {
        return false;
    }
});
console.log("test-workspace hygiene guard: scanned ".concat(residueRoot, " (").concat(entries.length, " entries)"));
if (leftovers.length > 0) {
    console.error("leftover test workspaces: ".concat(leftovers.length));
    for (var _i = 0, _a = leftovers.slice(0, 10); _i < _a.length; _i++) {
        var entry = _a[_i];
        console.error("  ".concat((0, node_path_1.resolve)(residueRoot, entry)));
    }
    if (leftovers.length > 10)
        console.error("  \u2026 and ".concat(leftovers.length - 10, " more"));
    console.error("every test file creating workspaces must call useWorkspaceCleanup() from plugin-test-helpers;");
    console.error("hard-killed residue can be removed with: rm -rf ".concat(residueRoot));
    process.exit(1);
}
console.log("no leftover test workspaces");
