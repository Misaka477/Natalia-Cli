"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFINEMENT_MODES = void 0;
exports.confinementBinary = confinementBinary;
exports.canonicalPath = canonicalPath;
exports.writableRoots = writableRoots;
exports.wrapConfinedCommand = wrapConfinedCommand;
exports.probeConfinement = probeConfinement;
exports.confinementAvailable = confinementAvailable;
__exportStar(require("./escalation"), exports);
var node_child_process_1 = require("node:child_process");
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_fs_2 = require("node:fs");
var node_path_1 = require("node:path");
var contracts_1 = require("@natalia/contracts");
Object.defineProperty(exports, "CONFINEMENT_MODES", { enumerable: true, get: function () { return contracts_1.CONFINEMENT_MODES; } });
function candidatePaths() {
    var dir = import.meta.dir;
    var base = "native/target/release/confinement-exec";
    return [
        (0, node_path_1.resolve)(dir, "..", base),
        (0, node_path_1.resolve)(process.cwd(), "packages", "hosts", "confinement", base),
    ];
}
/** The built wrapper binary, or `undefined` when the backend is absent. */
function confinementBinary() {
    for (var _i = 0, _a = candidatePaths(); _i < _a.length; _i++) {
        var path = _a[_i];
        if ((0, node_fs_1.existsSync)(path))
            return path;
    }
    return undefined;
}
/**
 * Resolve a granted root to the path the kernel actually compares
 * (dsh's `roots.ts` lesson): the native realpath follows the
 * component-by-component lookup a spawn performs, where the JS
 * implementation lexically collapses `..` before resolving a preceding
 * symlink — an as-spelled grant can match nothing. A missing root stays as
 * spelled: conservative, because inventing a fallback would grant a path the
 * caller never named.
 */
function canonicalPath(path) {
    try {
        return node_fs_2.realpathSync.native(path);
    }
    catch (_a) {
        return path;
    }
}
/**
 * The one home for "where may this mode WRITE" — the landlock dialect's
 * spelling (dsh keeps one meaning and per-runner grants: their landlock
 * profile grants `/dev/null` unconditionally, adds `/tmp` and the workspace
 * under `workspace-write`). Deduplicated and canonical, so identical
 * content produces identical rule sets.
 */
function writableRoots(mode, workspaceRoot) {
    if (mode !== "workspace-write")
        return ["/dev/null"];
    var roots = ["/dev/null", "/tmp", (0, node_os_1.tmpdir)()];
    if (workspaceRoot)
        roots.push(workspaceRoot);
    return __spreadArray([], new Set(roots.map(canonicalPath)), true);
}
/**
 * Wrap a command in the confinement binary.
 *
 * Returns `undefined` when the mode needs a backend and no usable one exists
 * — fail-closed: the caller must refuse rather than run the command raw
 * (dsh: "Missing or unusable confinement fails closed rather than returning
 * the original argv"). `danger-full-access` needs no backend by definition,
 * so it returns the raw command: the degradation path that keeps working on
 * platforms whose rungs are not built yet.
 */
function wrapConfinedCommand(input) {
    var _a;
    var mode = input.mode, workspaceRoot = input.workspaceRoot, rlimits = input.rlimits, command = input.command, args = input.args;
    if (mode === "danger-full-access")
        return { command: command, args: args };
    // Fail-closed on ANY absent backend, including an explicitly named one:
    // wrapping a command in a nonexistent binary would swap a confinement
    // refusal for an exec error, which reads like a different failure.
    var binary = (_a = input.binaryPath) !== null && _a !== void 0 ? _a : confinementBinary();
    if (!binary || !(0, node_fs_1.existsSync)(binary))
        return undefined;
    // argv carries only the flags: the binary is the `command`, and a second
    // copy here would arrive as a bogus first argument (usage refusal).
    var wrapped = [];
    for (var _i = 0, _b = writableRoots(mode, workspaceRoot); _i < _b.length; _i++) {
        var root = _b[_i];
        wrapped.push("--read-write", root);
    }
    for (var _c = 0, _d = Object.entries(rlimits !== null && rlimits !== void 0 ? rlimits : {}); _c < _d.length; _c++) {
        var _e = _d[_c], name_1 = _e[0], value = _e[1];
        if (value !== undefined)
            wrapped.push("--rlimit", "".concat(name_1, "=").concat(value));
    }
    wrapped.push.apply(wrapped, __spreadArray(["--", command], args, false));
    return { command: binary, args: wrapped };
}
/**
 * Probe the backend: capability facts from `--probe`, plus the functional
 * half dsh's runner chain performs — a trivial command actually running
 * through confinement. `undefined` means no binary exists at all (the
 * fail-closed signal for the ro/rw modes).
 */
function probeConfinement(binaryPath) {
    var binary = binaryPath !== null && binaryPath !== void 0 ? binaryPath : confinementBinary();
    if (!binary)
        return undefined;
    var info = (0, node_child_process_1.spawnSync)(binary, ["--probe"], { encoding: "utf8" });
    if (info.status !== 0)
        return undefined;
    var facts;
    try {
        facts = JSON.parse(info.stdout);
    }
    catch (_a) {
        return undefined;
    }
    var functional = facts.landlockABI >= 1 &&
        (0, node_child_process_1.spawnSync)(binary, ["--read-write", (0, node_os_1.tmpdir)(), "--", "true"], {
            encoding: "utf8",
        }).status === 0;
    return __assign(__assign({}, facts), { functional: functional });
}
/** Whether the ro/rw modes can actually be enforced right now. */
function confinementAvailable(binaryPath) {
    var _a;
    return ((_a = probeConfinement(binaryPath)) === null || _a === void 0 ? void 0 : _a.functional) === true;
}
