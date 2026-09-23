"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeWorkspaceFile = exports.watchWorkspaceFiles = exports.searchWorkspaceFiles = exports.renameWorkspaceFile = exports.readWorkspaceFile = exports.listWorkspaceFiles = exports.invalidateWorkspaceFiles = exports.grepWorkspaceFilesBounded = exports.globWorkspaceFilesBounded = exports.globWorkspaceFiles = exports.findWorkspaceFiles = exports.deleteWorkspaceFile = exports.createWorkspaceFile = exports.parseSnapshotIgnoreLine = exports.parseSnapshotIgnore = exports.NATALIA_IGNORE_FILE = exports.loadNataliaIgnore = exports.isSnapshotIgnored = exports.ensureNataliaIgnoreFile = exports.DEFAULT_NATALIA_IGNORE_PATTERNS = exports.DEFAULT_NATALIA_IGNORE_CONTENT = void 0;
exports.currentPlatform = currentPlatform;
exports.isWindows = isWindows;
exports.platformJoin = platformJoin;
exports.executableName = executableName;
exports.resolveBashExecutable = resolveBashExecutable;
exports.profileShellCommand = profileShellCommand;
exports.isolatedShellCommand = isolatedShellCommand;
exports.shellQuote = shellQuote;
exports.detachedShellPrefix = detachedShellPrefix;
exports.startDetachedProcess = startDetachedProcess;
exports.processTreeKillCommand = processTreeKillCommand;
exports.globalConfigHome = globalConfigHome;
exports.userStateHome = userStateHome;
exports.userRuntimeHome = userRuntimeHome;
exports.normalizeLinkTarget = normalizeLinkTarget;
exports.createSymlink = createSymlink;
exports.forceRemove = forceRemove;
exports.foregroundProcessForTTY = foregroundProcessForTTY;
exports.parseProcessStat = parseProcessStat;
__exportStar(require("./hash-tree"), exports);
__exportStar(require("./store-paths"), exports);
var node_child_process_1 = require("node:child_process");
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var natalia_ignore_1 = require("./natalia-ignore");
Object.defineProperty(exports, "DEFAULT_NATALIA_IGNORE_CONTENT", { enumerable: true, get: function () { return natalia_ignore_1.DEFAULT_NATALIA_IGNORE_CONTENT; } });
Object.defineProperty(exports, "DEFAULT_NATALIA_IGNORE_PATTERNS", { enumerable: true, get: function () { return natalia_ignore_1.DEFAULT_NATALIA_IGNORE_PATTERNS; } });
Object.defineProperty(exports, "ensureNataliaIgnoreFile", { enumerable: true, get: function () { return natalia_ignore_1.ensureNataliaIgnoreFile; } });
Object.defineProperty(exports, "isSnapshotIgnored", { enumerable: true, get: function () { return natalia_ignore_1.isSnapshotIgnored; } });
Object.defineProperty(exports, "loadNataliaIgnore", { enumerable: true, get: function () { return natalia_ignore_1.loadNataliaIgnore; } });
Object.defineProperty(exports, "NATALIA_IGNORE_FILE", { enumerable: true, get: function () { return natalia_ignore_1.NATALIA_IGNORE_FILE; } });
Object.defineProperty(exports, "parseSnapshotIgnore", { enumerable: true, get: function () { return natalia_ignore_1.parseSnapshotIgnore; } });
Object.defineProperty(exports, "parseSnapshotIgnoreLine", { enumerable: true, get: function () { return natalia_ignore_1.parseSnapshotIgnoreLine; } });
var workspace_files_1 = require("./workspace-files");
Object.defineProperty(exports, "createWorkspaceFile", { enumerable: true, get: function () { return workspace_files_1.createWorkspaceFile; } });
Object.defineProperty(exports, "deleteWorkspaceFile", { enumerable: true, get: function () { return workspace_files_1.deleteWorkspaceFile; } });
Object.defineProperty(exports, "findWorkspaceFiles", { enumerable: true, get: function () { return workspace_files_1.findWorkspaceFiles; } });
Object.defineProperty(exports, "globWorkspaceFiles", { enumerable: true, get: function () { return workspace_files_1.globWorkspaceFiles; } });
Object.defineProperty(exports, "globWorkspaceFilesBounded", { enumerable: true, get: function () { return workspace_files_1.globWorkspaceFilesBounded; } });
Object.defineProperty(exports, "grepWorkspaceFilesBounded", { enumerable: true, get: function () { return workspace_files_1.grepWorkspaceFilesBounded; } });
Object.defineProperty(exports, "invalidateWorkspaceFiles", { enumerable: true, get: function () { return workspace_files_1.invalidateWorkspaceFiles; } });
Object.defineProperty(exports, "listWorkspaceFiles", { enumerable: true, get: function () { return workspace_files_1.listWorkspaceFiles; } });
Object.defineProperty(exports, "readWorkspaceFile", { enumerable: true, get: function () { return workspace_files_1.readWorkspaceFile; } });
Object.defineProperty(exports, "renameWorkspaceFile", { enumerable: true, get: function () { return workspace_files_1.renameWorkspaceFile; } });
Object.defineProperty(exports, "searchWorkspaceFiles", { enumerable: true, get: function () { return workspace_files_1.searchWorkspaceFiles; } });
Object.defineProperty(exports, "watchWorkspaceFiles", { enumerable: true, get: function () { return workspace_files_1.watchWorkspaceFiles; } });
Object.defineProperty(exports, "writeWorkspaceFile", { enumerable: true, get: function () { return workspace_files_1.writeWorkspaceFile; } });
function currentPlatform() {
    return process.platform;
}
function isWindows(os) {
    return (os !== null && os !== void 0 ? os : currentPlatform()) === "win32";
}
/**
 * Joins path segments with the separator of the *target* platform rather than
 * the host. Windows paths therefore stay well-formed when they are constructed
 * or asserted from a POSIX host, which keeps both branches deterministic.
 */
function platformJoin(os) {
    var segments = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        segments[_i - 1] = arguments[_i];
    }
    return isWindows(os) ? node_path_1.win32.join.apply(node_path_1.win32, segments) : node_path_1.posix.join.apply(node_path_1.posix, segments);
}
/**
 * Appends the Windows executable suffix to a bare binary name. Sibling binaries
 * of a resolved executable are located by name, so the suffix must be applied
 * consistently rather than only at the entry point.
 */
function executableName(base, os) {
    if (!isWindows(os))
        return base;
    return base.toLowerCase().endsWith(".exe") ? base : "".concat(base, ".exe");
}
var WINDOWS_BASH_RELATIVE_PATHS = [
    node_path_1.win32.join("Git", "bin", "bash.exe"),
    node_path_1.win32.join("Git", "usr", "bin", "bash.exe"),
];
/**
 * Locates a bash-compatible shell on Windows. Natalia's shell call sites pass
 * `bash -lc` with POSIX quoting, so the Git for Windows bash is used rather
 * than `cmd.exe`: it preserves argument, redirection, and quoting semantics
 * exactly, which keeps a single shell contract across platforms.
 */
function resolveBashExecutable(input) {
    var _a, _b;
    if (input === void 0) { input = {}; }
    var env = (_a = input.env) !== null && _a !== void 0 ? _a : process.env;
    var configured = env.NATALIA_BASH_EXECUTABLE;
    if (configured)
        return configured;
    if (!isWindows(input.os))
        return undefined;
    var exists = (_b = input.exists) !== null && _b !== void 0 ? _b : defaultExists;
    var roots = [
        env.ProgramFiles,
        env.ProgramW6432,
        env["ProgramFiles(x86)"],
        env.LOCALAPPDATA ? node_path_1.win32.join(env.LOCALAPPDATA, "Programs") : undefined,
    ];
    for (var _i = 0, roots_1 = roots; _i < roots_1.length; _i++) {
        var root = roots_1[_i];
        if (!root)
            continue;
        for (var _c = 0, WINDOWS_BASH_RELATIVE_PATHS_1 = WINDOWS_BASH_RELATIVE_PATHS; _c < WINDOWS_BASH_RELATIVE_PATHS_1.length; _c++) {
            var relative = WINDOWS_BASH_RELATIVE_PATHS_1[_c];
            var candidate = node_path_1.win32.join(root, relative);
            if (exists(candidate))
                return candidate;
        }
    }
    return undefined;
}
/**
 * Builds the `-lc` profile-reading shell invocation used by every Natalia call
 * site. `posixShell` carries the resolution each call site already performed so
 * that POSIX behaviour is unchanged.
 */
function profileShellCommand(script, input) {
    if (input === void 0) { input = {}; }
    return {
        executable: shellExecutable(input),
        args: ["-lc", script],
    };
}
/**
 * Builds the `--noprofile --norc -c` invocation used where profile
 * side effects must not leak into a managed session.
 */
function isolatedShellCommand(script, input) {
    if (input === void 0) { input = {}; }
    return {
        executable: shellExecutable(input),
        args: ["--noprofile", "--norc", "-c", script],
    };
}
function shellExecutable(input) {
    var _a;
    if (!isWindows(input.os))
        return (_a = input.posixShell) !== null && _a !== void 0 ? _a : "bash";
    var resolved = resolveBashExecutable(input);
    if (resolved)
        return resolved;
    throw new Error("A bash-compatible shell is unavailable on this Windows host. Install Git for Windows or set NATALIA_BASH_EXECUTABLE to a bash executable.");
}
/**
 * Quotes a value for safe interpolation into a shell script.
 *
 * A single-quoted POSIX string is used, and an embedded quote is closed,
 * escaped, and reopened as `'\''`. This is valid on every platform Natalia
 * supports because a bash-compatible shell is always used, including on
 * Windows. A shorter-looking `'''` is *not* equivalent: it terminates the
 * string and silently drops or truncates the surrounding text.
 */
function shellQuote(value) {
    return "'".concat(value.replaceAll("'", "'\\''"), "'");
}
/**
 * Prefix that detaches a background command from the launching shell's job
 * control. `setsid` creates the owned process group that negative-PID signals
 * later address; Windows has no process-group equivalent, so the prefix is
 * empty there and process trees are terminated through `taskkill /T`.
 */
function detachedShellPrefix(os) {
    return isWindows(os) ? "" : "setsid ";
}
/**
 * Starts a detached background process and reports a PID that the operating
 * system can later signal.
 *
 * POSIX keeps the caller's own script verbatim, so its quoting, redirection and
 * `setsid` process-group semantics are unchanged. Windows cannot reuse that
 * script: a bash-compatible shell there reports an MSYS process id from `$!`,
 * which lives in a separate namespace from the Windows process ids used by
 * `process.kill` and `taskkill`. Redirection and detachment are therefore
 * performed natively so that the returned PID is the real Windows one.
 */
function startDetachedProcess(input) {
    return __awaiter(this, void 0, void 0, function () {
        var resolution, shell, child_1, pid_1, launcherShell, launcher, stdout, stderr, launcherEvents, exitCode, pid;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    resolution = {
                        os: input.os,
                        env: input.hostEnv,
                        posixShell: input.posixShell,
                        exists: input.exists,
                    };
                    if (!isWindows(input.os)) return [3 /*break*/, 2];
                    shell = profileShellCommand("( ".concat(input.command, " ) > ").concat(shellQuote(input.outputPath), " 2>&1"), resolution);
                    child_1 = (0, node_child_process_1.spawn)(shell.executable, shell.args, {
                        cwd: input.cwd,
                        env: input.env,
                        detached: true,
                        windowsHide: true,
                        stdio: ["ignore", "ignore", "ignore"],
                    });
                    return [4 /*yield*/, new Promise(function (resolvePromise, reject) {
                            var childEvents = child_1;
                            childEvents.once("spawn", function () { return resolvePromise(child_1.pid); });
                            childEvents.once("error", reject);
                        })];
                case 1:
                    pid_1 = _c.sent();
                    if (pid_1 === undefined)
                        throw new Error("the detached process did not report a process id");
                    child_1.unref();
                    return [2 /*return*/, { pid: pid_1 }];
                case 2:
                    launcherShell = profileShellCommand(input.posixScript, resolution);
                    launcher = (0, node_child_process_1.spawn)(launcherShell.executable, launcherShell.args, {
                        cwd: input.cwd,
                        env: input.env,
                        stdio: ["ignore", "pipe", "pipe"],
                    });
                    stdout = [];
                    stderr = [];
                    launcherEvents = launcher;
                    (_a = launcherEvents.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (chunk) { return stdout.push(chunk); });
                    (_b = launcherEvents.stderr) === null || _b === void 0 ? void 0 : _b.on("data", function (chunk) { return stderr.push(chunk); });
                    return [4 /*yield*/, new Promise(function (resolvePromise, reject) {
                            launcherEvents.on("error", reject);
                            launcherEvents.on("close", function (code) {
                                return resolvePromise(code !== null && code !== void 0 ? code : -1);
                            });
                        })];
                case 3:
                    exitCode = _c.sent();
                    pid = Number(Buffer.concat(stdout).toString("utf8").trim());
                    if (exitCode !== 0 || !Number.isFinite(pid))
                        throw new Error(Buffer.concat(stderr).toString("utf8") ||
                            "the detached launcher exited with ".concat(exitCode));
                    return [2 /*return*/, { pid: pid }];
            }
        });
    });
}
/**
 * Windows process-tree termination command. POSIX callers keep using a negative
 * PID signal, so `undefined` is returned there.
 */
function processTreeKillCommand(pid, os) {
    if (!isWindows(os))
        return undefined;
    return {
        executable: "taskkill",
        args: ["/PID", String(Math.trunc(pid)), "/T", "/F"],
    };
}
/**
 * Root of the per-user global configuration tree. The POSIX branch reproduces
 * the previous `$HOME/.config` resolution exactly.
 */
function globalConfigHome(input) {
    var _a, _b;
    if (input === void 0) { input = {}; }
    var env = (_a = input.env) !== null && _a !== void 0 ? _a : process.env;
    if (isWindows(input.os))
        return usableDirectory([env.APPDATA], function () {
            return node_path_1.win32.join(userHome(input), "AppData", "Roaming");
        });
    return node_path_1.posix.join((_b = env.HOME) !== null && _b !== void 0 ? _b : "", ".config");
}
/**
 * Root of the per-user durable state tree, preserving the previous
 * `XDG_STATE_HOME ?? $HOME/.local/state` resolution on POSIX.
 */
function userStateHome(input) {
    var _a, _b, _c;
    if (input === void 0) { input = {}; }
    var env = (_a = input.env) !== null && _a !== void 0 ? _a : process.env;
    if (isWindows(input.os))
        return usableDirectory([env.LOCALAPPDATA], function () {
            return node_path_1.win32.join(userHome(input), "AppData", "Local");
        });
    return (_b = env.XDG_STATE_HOME) !== null && _b !== void 0 ? _b : node_path_1.posix.join((_c = env.HOME) !== null && _c !== void 0 ? _c : ".", ".local", "state");
}
/**
 * Root of the per-user ephemeral runtime tree. Windows has no XDG runtime
 * directory, so callers fall back to their existing workspace-local path.
 */
function userRuntimeHome(input) {
    var _a;
    if (input === void 0) { input = {}; }
    var env = (_a = input.env) !== null && _a !== void 0 ? _a : process.env;
    if (isWindows(input.os))
        return usableDirectory([env.LOCALAPPDATA, env.TEMP], safeHomedir);
    return env.XDG_RUNTIME_DIR;
}
function userHome(input) {
    var _a;
    var env = (_a = input.env) !== null && _a !== void 0 ? _a : process.env;
    return usableDirectory([env.USERPROFILE, env.HOME], safeHomedir);
}
/**
 * Picks the first usable directory from the candidates. A bare drive letter
 * ("D:") from a misconfigured env var (LOCALAPPDATA/TEMP/APPDATA/HOME set to
 * just the drive) is not a usable directory: creating a directory at the
 * drive root fails with EPERM on Windows, which surfaced as a hard startup
 * crash. Such values are skipped in favour of the real user home.
 */
function usableDirectory(candidates, fallback) {
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var candidate = candidates_1[_i];
        if (candidate && !/^[A-Za-z]:$/u.test(candidate))
            return candidate;
    }
    return fallback();
}
/**
 * Strips the Windows extended-length (`\\?\`) prefix and normalises separators
 * so a link target can be resolved and containment-checked.
 *
 * `readlink` on a Windows directory junction returns an absolute
 * `\\?\C:\...` path. Resolving that verbatim produces a path no containment
 * check can match, which silently marks a workspace manifest incomplete. POSIX
 * targets are returned untouched.
 */
function normalizeLinkTarget(target, os) {
    if (!isWindows(os))
        return target;
    var unprefixed = target.startsWith("\\\\?\\") ? target.slice(4) : target;
    return unprefixed.replaceAll("\\", "/");
}
/**
 * Creates a symbolic link, choosing the Windows link type that does not
 * require elevation where possible.
 *
 * An unprivileged Windows process cannot create a symlink, but it *can* create
 * a directory junction. Node also defaults to a `file` link on Windows, which
 * would turn a restored directory link into a broken one. POSIX takes the
 * original single-argument call so its behaviour is unchanged.
 */
function createSymlink(target_1, path_1) {
    return __awaiter(this, arguments, void 0, function (target, path, input) {
        var link;
        var _a;
        if (input === void 0) { input = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    link = (_a = input.symlink) !== null && _a !== void 0 ? _a : nodeSymlink;
                    if (!!isWindows(input.os)) return [3 /*break*/, 2];
                    return [4 /*yield*/, link(target, path)];
                case 1: return [2 /*return*/, _b.sent()];
                case 2: return [4 /*yield*/, link(target, path, input.targetIsDirectory ? "junction" : "file")];
                case 3: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
/**
 * Removes a path, clearing the Windows read-only attribute first.
 *
 * `fs.rm({ force: true })` does not clear `FILE_ATTRIBUTE_READONLY`, so a file
 * restored from a manifest that recorded a read-only POSIX mode cannot be
 * deleted afterwards. On POSIX this is exactly the previous `rm` call.
 */
function forceRemove(path_1) {
    return __awaiter(this, arguments, void 0, function (path, input) {
        var remove, options, lastError, attempt, error_1, code;
        var _a, _b, _c;
        if (input === void 0) { input = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    remove = (_a = input.rm) !== null && _a !== void 0 ? _a : nodeRm;
                    options = { force: true, recursive: (_b = input.recursive) !== null && _b !== void 0 ? _b : false };
                    if (!!isWindows(input.os)) return [3 /*break*/, 2];
                    return [4 /*yield*/, remove(path, options)];
                case 1: return [2 /*return*/, _d.sent()];
                case 2:
                    attempt = 0;
                    _d.label = 3;
                case 3:
                    if (!(attempt < 10)) return [3 /*break*/, 10];
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 6, , 9]);
                    return [4 /*yield*/, remove(path, options)];
                case 5: return [2 /*return*/, _d.sent()];
                case 6:
                    error_1 = _d.sent();
                    lastError = error_1;
                    code = error_1.code;
                    if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")
                        throw error_1;
                    // Read-only attribute: clear it, then retry. EBUSY is a transient lock
                    // (a just-exited child still releasing its working-directory handle);
                    // the backoff spans several seconds so a slow child exit clears it.
                    return [4 /*yield*/, ((_c = input.chmod) !== null && _c !== void 0 ? _c : nodeChmod)(path, 438).catch(function () { return undefined; })];
                case 7:
                    // Read-only attribute: clear it, then retry. EBUSY is a transient lock
                    // (a just-exited child still releasing its working-directory handle);
                    // the backoff spans several seconds so a slow child exit clears it.
                    _d.sent();
                    return [4 /*yield*/, Bun.sleep(100 * (attempt + 1))];
                case 8:
                    _d.sent();
                    return [3 /*break*/, 9];
                case 9:
                    attempt++;
                    return [3 /*break*/, 3];
                case 10: throw lastError;
            }
        });
    });
}
function nodeSymlink(target, path, type) {
    return __awaiter(this, void 0, void 0, function () {
        var symlink;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
                case 1:
                    symlink = (_a.sent()).symlink;
                    return [4 /*yield*/, symlink(target, path, type)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function nodeRm(path, options) {
    return __awaiter(this, void 0, void 0, function () {
        var rm;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
                case 1:
                    rm = (_a.sent()).rm;
                    return [4 /*yield*/, rm(path, options)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function nodeChmod(path, mode) {
    return __awaiter(this, void 0, void 0, function () {
        var chmod;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
                case 1:
                    chmod = (_a.sent()).chmod;
                    return [4 /*yield*/, chmod(path, mode)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function safeHomedir() {
    try {
        return (0, node_os_1.homedir)();
    }
    catch (_a) {
        return "";
    }
}
function defaultExists(path) {
    try {
        return (0, node_fs_1.existsSync)(path);
    }
    catch (_a) {
        return false;
    }
}
function foregroundProcessForTTY(ttyName, io) {
    var _a, _b, _c, _d;
    if (io === void 0) { io = {}; }
    var os = (_a = io.os) !== null && _a !== void 0 ? _a : currentPlatform();
    if (os !== "linux")
        return {
            supported: false,
            reason: "foreground process confirmation is unavailable on ".concat(os),
        };
    if (!ttyName)
        return { supported: false, reason: "pane has no tty to inspect" };
    var deviceNumber = ((_b = io.deviceNumber) !== null && _b !== void 0 ? _b : defaultDeviceNumber)(ttyName);
    if (deviceNumber === undefined)
        return { supported: false, reason: "tty is not inspectable: ".concat(ttyName) };
    var readStat = (_c = io.processStat) !== null && _c !== void 0 ? _c : defaultProcessStat;
    var pids = ((_d = io.processIDs) !== null && _d !== void 0 ? _d : defaultProcessIDs)();
    var foregroundGroup;
    var names = new Map();
    for (var _i = 0, pids_1 = pids; _i < pids_1.length; _i++) {
        var pid = pids_1[_i];
        var stat = readStat(pid);
        if (!stat)
            continue;
        var parsed = parseProcessStat(stat);
        if (!parsed)
            continue;
        names.set(parsed.pid, parsed.name);
        if (parsed.tty === deviceNumber && parsed.foregroundGroup > 0)
            foregroundGroup = parsed.foregroundGroup;
    }
    if (foregroundGroup === undefined)
        return { supported: true, process: undefined };
    var name = names.get(foregroundGroup);
    if (name === undefined) {
        // The group leader is gone or unreadable, so nothing can be confirmed.
        return {
            supported: false,
            reason: "foreground process group ".concat(foregroundGroup, " is not inspectable"),
        };
    }
    return { supported: true, process: { pid: foregroundGroup, name: name } };
}
/**
 * Parses `/proc/<pid>/stat`. The command name is brace-delimited and may itself
 * contain spaces and parentheses, so the numeric fields are read relative to the
 * final `)`.
 */
function parseProcessStat(stat) {
    var _a, _b;
    var open = stat.indexOf("(");
    var close = stat.lastIndexOf(")");
    if (open < 0 || close < open)
        return undefined;
    var pid = Number.parseInt(stat.slice(0, open).trim(), 10);
    var name = stat.slice(open + 1, close);
    var rest = stat
        .slice(close + 1)
        .trim()
        .split(/\s+/u);
    // rest[0] is state (field 3), so tty_nr (field 7) and tpgid (field 8) are at
    // offsets 4 and 5.
    var tty = Number.parseInt((_a = rest[4]) !== null && _a !== void 0 ? _a : "", 10);
    var foregroundGroup = Number.parseInt((_b = rest[5]) !== null && _b !== void 0 ? _b : "", 10);
    if (!Number.isSafeInteger(pid) ||
        !Number.isSafeInteger(tty) ||
        !Number.isSafeInteger(foregroundGroup))
        return undefined;
    return { pid: pid, name: name, tty: tty, foregroundGroup: foregroundGroup };
}
function defaultDeviceNumber(ttyName) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        var statSync = require("node:fs").statSync;
        return statSync(ttyName).rdev;
    }
    catch (_a) {
        return undefined;
    }
}
function defaultProcessIDs() {
    try {
        var readdirSync = require("node:fs").readdirSync;
        return readdirSync("/proc")
            .map(function (entry) { return Number.parseInt(entry, 10); })
            .filter(function (pid) { return Number.isSafeInteger(pid) && pid > 0; });
    }
    catch (_a) {
        return [];
    }
}
function defaultProcessStat(pid) {
    try {
        var readFileSync = require("node:fs").readFileSync;
        return readFileSync("/proc/".concat(pid, "/stat"), "utf8");
    }
    catch (_a) {
        return undefined;
    }
}
