"use strict";
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
exports.readOptionalFile = readOptionalFile;
exports.safeToolEnv = safeToolEnv;
exports.terminateChildProcessTree = terminateChildProcessTree;
exports.sendProcessSignal = sendProcessSignal;
exports.isProcessRunning = isProcessRunning;
exports.parseProcStatStartTicks = parseProcStatStartTicks;
exports.processFingerprint = processFingerprint;
exports.ownsProcess = ownsProcess;
exports.stopProcessTree = stopProcessTree;
exports.truncateProcessOutput = truncateProcessOutput;
/**
 * Starting, inspecting and stopping OS child processes.
 *
 * The primitives every tool that spawns something needs, kept apart from the
 * durable registry that tracks long-lived ones: this layer knows about PIDs,
 * signals and process groups, and nothing about what a managed process is or
 * where its state is stored.
 *
 * Two things here are load-bearing for safety rather than convenience. A tool
 * inherits a deliberately small environment, because handing a model's shell the
 * whole environment hands it every credential in it. And stopping is done to a
 * process *group* with an identity check, because a PID can be reused between the
 * moment it was recorded and the moment a signal is sent.
 */
var platform_1 = require("@natalia/platform");
var promises_1 = require("node:fs/promises");
/**
 * Reads a file that may not exist yet, which is the normal state of a process log
 * asked about before the process has written anything.
 */
function readOptionalFile(path) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, ""];
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function safeToolEnv(allowlist) {
    var defaults = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM"];
    var allowed = new Set(__spreadArray(__spreadArray([], defaults, true), (allowlist !== null && allowlist !== void 0 ? allowlist : []), true));
    return Object.fromEntries(__spreadArray([], allowed, true).map(function (key) { return [key, process.env[key]]; })
        .filter(function (entry) { return typeof entry[1] === "string"; }));
}
function terminateChildProcessTree(pid) {
    if (!pid)
        return;
    var treeKill = (0, platform_1.processTreeKillCommand)(pid);
    if (treeKill) {
        // Windows has no process group, so the tree is terminated by the OS
        // utility. A failure still falls through to the single-process kill below.
        try {
            Bun.spawnSync(__spreadArray([treeKill.executable], treeKill.args, true), {
                stdout: "ignore",
                stderr: "ignore",
            });
            return;
        }
        catch (_a) {
            // Fall through to the direct kill.
        }
    }
    else {
        try {
            process.kill(-pid, "SIGTERM");
            var escalation = setTimeout(function () {
                try {
                    process.kill(-pid, "SIGKILL");
                }
                catch (error) {
                    if (error.code !== "ESRCH")
                        throw error;
                }
            }, 2000);
            escalation.unref();
            return;
        }
        catch (error) {
            if (error.code !== "ESRCH")
                return;
        }
    }
    try {
        process.kill(pid, "SIGTERM");
    }
    catch (error) {
        if (error.code !== "ESRCH")
            throw error;
    }
}
function sendProcessSignal(pid, signal) {
    try {
        // Managed processes start through setsid, so the negative PID addresses
        // their owned process group and includes background children. Windows has
        // no equivalent, so the tree is terminated through the OS utility instead.
        if ((0, platform_1.isWindows)()) {
            var treeKill = (0, platform_1.processTreeKillCommand)(pid);
            if (treeKill && signal === "SIGKILL") {
                Bun.spawnSync(__spreadArray([treeKill.executable], treeKill.args, true), {
                    stdout: "ignore",
                    stderr: "ignore",
                });
                return;
            }
            process.kill(pid, signal);
        }
        else
            process.kill(-pid, signal);
    }
    catch (error) {
        if (error.code !== "ESRCH")
            throw error;
        try {
            process.kill(pid, signal);
        }
        catch (fallbackError) {
            if (fallbackError.code !== "ESRCH")
                throw fallbackError;
        }
    }
}
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (_a) {
        return false;
    }
}
/**
 * Reads field 22 (starttime) from a `/proc/<pid>/stat` line. Field 2 (`comm`) is
 * parenthesized and may itself contain spaces or parentheses, so the line must
 * be split AFTER the last `)` — splitting the whole line on whitespace shifts
 * every later field whenever `comm` has a space, silently reading the wrong
 * value (itrealvalue instead of starttime) and weakening the pid-reuse check.
 * Post-`)` fields are 0-indexed from `state`, so starttime is index 19.
 */
function parseProcStatStartTicks(statLine) {
    var afterComm = statLine.slice(statLine.lastIndexOf(")") + 1);
    return afterComm.trim().split(/\s+/u)[19];
}
function processFingerprint(pid) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, statLine, commandLine, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (process.platform !== "linux")
                        return [2 /*return*/, {}];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.all([
                            (0, promises_1.readFile)("/proc/".concat(pid, "/stat"), "utf8"),
                            (0, promises_1.readFile)("/proc/".concat(pid, "/cmdline"), "utf8"),
                        ])];
                case 2:
                    _a = _c.sent(), statLine = _a[0], commandLine = _a[1];
                    return [2 /*return*/, {
                            pidStartTicks: parseProcStatStartTicks(statLine),
                            commandLine: commandLine.replace(/\0/gu, " ").trim(),
                        }];
                case 3:
                    _b = _c.sent();
                    return [2 /*return*/, {}];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function ownsProcess(pid, pidStartTicks) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pidStartTicks)
                        return [2 /*return*/, isProcessRunning(pid)];
                    return [4 /*yield*/, processFingerprint(pid)];
                case 1: return [2 /*return*/, (_a.sent()).pidStartTicks === pidStartTicks];
            }
        });
    });
}
function stopProcessTree(pid, timeoutMs, pidStartTicks) {
    return __awaiter(this, void 0, void 0, function () {
        var deadline;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ownsProcess(pid, pidStartTicks)];
                case 1:
                    if (!(_a.sent()))
                        return [2 /*return*/];
                    sendProcessSignal(pid, "SIGTERM");
                    deadline = Date.now() + Math.max(0, timeoutMs);
                    _a.label = 2;
                case 2:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 5];
                    return [4 /*yield*/, ownsProcess(pid, pidStartTicks)];
                case 3:
                    if (!(_a.sent()))
                        return [2 /*return*/];
                    return [4 /*yield*/, Bun.sleep(25)];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, ownsProcess(pid, pidStartTicks)];
                case 6:
                    if (_a.sent())
                        sendProcessSignal(pid, "SIGKILL");
                    return [2 /*return*/];
            }
        });
    });
}
function truncateProcessOutput(output, maxBytes) {
    if (maxBytes === void 0) { maxBytes = 20000; }
    var bytes = Buffer.from(output);
    if (bytes.byteLength <= maxBytes)
        return output;
    var start = bytes.byteLength - maxBytes;
    while (start < bytes.byteLength && (bytes[start] & 0xc0) === 0x80)
        start++;
    return bytes.subarray(start).toString("utf8");
}
