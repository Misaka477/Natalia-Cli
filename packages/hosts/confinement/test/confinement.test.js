"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var node_child_process_1 = require("node:child_process");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var index_1 = require("../src/index");
var binary = (0, index_1.confinementBinary)();
var available = binary !== undefined;
// The two directories deliberately live OUTSIDE every writable root except
// the explicit one: the package's test dir is inside the repo (not under
// /tmp), so a workspace-write grant of the workspace root is the only thing
// that lets the confined command write there — and the sibling dir stays
// denied. Proving it inside /tmp would let the always-granted temp root
// pass the test without the workspace rule.
var workspace = "";
var outside = "";
(0, bun_test_1.beforeAll)(function () {
    var base = (0, node_path_1.join)(import.meta.dir, ".confinement-".concat(process.pid));
    workspace = (0, node_path_1.join)(base, "workspace");
    outside = (0, node_path_1.join)(base, "outside");
    (0, node_fs_1.mkdirSync)(workspace, { recursive: true });
    (0, node_fs_1.mkdirSync)(outside, { recursive: true });
});
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)((0, node_path_1.join)(import.meta.dir, ".confinement-".concat(process.pid)), {
        recursive: true,
        force: true,
    });
});
function run(command, args) {
    return (0, node_child_process_1.spawnSync)(command, args, { encoding: "utf8" });
}
(0, bun_test_1.test)("read-only grants nothing but /dev/null", function () {
    (0, bun_test_1.expect)((0, index_1.writableRoots)("read-only")).toEqual(["/dev/null"]);
});
(0, bun_test_1.test)("workspace-write is canonical, deduplicated and covers temp + workspace", function () {
    var roots = (0, index_1.writableRoots)("workspace-write", workspace);
    (0, bun_test_1.expect)(roots).toContain((0, index_1.canonicalPath)(workspace));
    (0, bun_test_1.expect)(roots).toContain((0, index_1.canonicalPath)("/tmp"));
    (0, bun_test_1.expect)(roots).toContain("/dev/null");
    (0, bun_test_1.expect)(new Set(roots).size).toBe(roots.length);
});
(0, bun_test_1.test)("danger-full-access needs no backend and returns the raw command", function () {
    // The degradation path: on a platform whose rungs are not built, only
    // danger may run — and it must still be runnable.
    var wrapped = (0, index_1.wrapConfinedCommand)({
        mode: "danger-full-access",
        command: "/bin/echo",
        args: ["hi"],
        binaryPath: "/nonexistent/confinement-exec",
    });
    (0, bun_test_1.expect)(wrapped).toEqual({ command: "/bin/echo", args: ["hi"] });
});
(0, bun_test_1.test)("a confined mode fails closed when no backend exists", function () {
    (0, bun_test_1.expect)((0, index_1.wrapConfinedCommand)({
        mode: "workspace-write",
        workspaceRoot: workspace,
        command: "/bin/echo",
        args: ["hi"],
        binaryPath: "/nonexistent/confinement-exec",
    })).toBeUndefined();
});
(0, bun_test_1.test)("the wrapper argv carries every writable root and rlimit", function () {
    if (!available)
        return;
    var wrapped = (0, index_1.wrapConfinedCommand)({
        mode: "workspace-write",
        workspaceRoot: workspace,
        rlimits: { fsize: 4096, nproc: 64 },
        command: "/bin/echo",
        args: ["hi"],
    });
    (0, bun_test_1.expect)(wrapped === null || wrapped === void 0 ? void 0 : wrapped.command).toBe(binary);
    var argv = wrapped.args;
    (0, bun_test_1.expect)(argv.filter(function (a) { return a === "--read-write"; }).length).toBe((0, index_1.writableRoots)("workspace-write", workspace).length);
    (0, bun_test_1.expect)(argv).toContain("fsize=4096");
    (0, bun_test_1.expect)(argv).toContain("nproc=64");
    (0, bun_test_1.expect)(argv.indexOf("--")).toBe(argv.length - 3);
    (0, bun_test_1.expect)(argv.slice(-2)).toEqual(["/bin/echo", "hi"]);
});
(0, bun_test_1.test)("probe reports a working landlock backend (gated on the binary)", function () {
    if (!available)
        return;
    var probe = (0, index_1.probeConfinement)();
    (0, bun_test_1.expect)(probe).not.toBeUndefined();
    (0, bun_test_1.expect)(probe.landlockABI).toBeGreaterThanOrEqual(1);
    (0, bun_test_1.expect)(probe.functional).toBe(true);
    (0, bun_test_1.expect)((0, index_1.confinementAvailable)()).toBe(true);
});
(0, bun_test_1.test)("probe returns undefined for a missing binary", function () {
    (0, bun_test_1.expect)((0, index_1.probeConfinement)("/nonexistent/confinement-exec")).toBeUndefined();
});
(0, bun_test_1.test)("workspace-write allows the workspace and denies its sibling", function () {
    if (!available)
        return;
    var inside = (0, node_path_1.join)(workspace, "allowed.txt");
    var blocked = (0, node_path_1.join)(outside, "denied.txt");
    var granted = (0, index_1.wrapConfinedCommand)({
        mode: "workspace-write",
        workspaceRoot: workspace,
        command: "/bin/sh",
        args: ["-c", "echo ok > \"".concat(inside, "\" && echo bad > \"").concat(blocked, "\"")],
    });
    (0, bun_test_1.expect)(granted).not.toBeUndefined();
    var result = run(granted.command, granted.args);
    (0, bun_test_1.expect)(result.status).not.toBe(0);
    (0, bun_test_1.expect)((0, node_fs_1.existsSync)(inside)).toBe(true);
    (0, bun_test_1.expect)((0, node_fs_1.existsSync)(blocked)).toBe(false);
});
(0, bun_test_1.test)("read-only denies writes even inside the workspace", function () {
    if (!available)
        return;
    var target = (0, node_path_1.join)(workspace, "ro-denied.txt");
    var wrapped = (0, index_1.wrapConfinedCommand)({
        mode: "read-only",
        workspaceRoot: workspace,
        command: "/bin/sh",
        args: ["-c", "echo x > \"".concat(target, "\"")],
    });
    (0, bun_test_1.expect)(wrapped).not.toBeUndefined();
    var result = run(wrapped.command, wrapped.args);
    (0, bun_test_1.expect)(result.status).not.toBe(0);
    (0, bun_test_1.expect)((0, node_fs_1.existsSync)(target)).toBe(false);
});
(0, bun_test_1.test)("the fsize rlimit caps the write (SIGXFSZ at the ceiling)", function () {
    if (!available)
        return;
    var target = (0, node_path_1.join)(workspace, "big.bin");
    var wrapped = (0, index_1.wrapConfinedCommand)({
        mode: "workspace-write",
        workspaceRoot: workspace,
        rlimits: { fsize: 1024 },
        command: "/bin/sh",
        args: ["-c", "head -c 8192 /dev/zero > \"".concat(target, "\"")],
    });
    (0, bun_test_1.expect)(wrapped).not.toBeUndefined();
    run(wrapped.command, wrapped.args); // killed by SIGXFSZ or capped
    (0, bun_test_1.expect)((0, node_fs_1.existsSync)(target)).toBe(true);
    (0, bun_test_1.expect)((0, node_fs_1.readFileSync)(target).byteLength).toBeLessThanOrEqual(1024);
});
(0, bun_test_1.test)("danger-full-access runs unconfined (no wrapper needed)", function () {
    var target = (0, node_path_1.join)(outside, "danger.txt");
    var wrapped = (0, index_1.wrapConfinedCommand)({
        mode: "danger-full-access",
        command: "/bin/sh",
        args: ["-c", "echo ok > \"".concat(target, "\"")],
    });
    (0, bun_test_1.expect)(wrapped).not.toBeUndefined();
    var result = run(wrapped.command, wrapped.args);
    (0, bun_test_1.expect)(result.status).toBe(0);
    (0, bun_test_1.expect)((0, node_fs_1.existsSync)(target)).toBe(true);
});
(0, bun_test_1.test)("the unavailable backend is reported, not faked", function () {
    // The honest-reporting discipline: capability is a fact we measured.
    if (!available)
        (0, bun_test_1.expect)((0, index_1.probeConfinement)()).toBeUndefined();
    else
        (0, bun_test_1.expect)(typeof (0, index_1.probeConfinement)().landlockABI).toBe("number");
});
