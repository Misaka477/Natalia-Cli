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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var index_1 = require("../src/index");
(0, bun_test_1.describe)("startDetachedProcess", function () {
    // The posixScript launcher semantics are exercised only where they run:
    // Windows uses the native spawn branch and gets its own tests below.
    var posixTest = bun_test_1.test.skipIf(process.platform === "win32");
    posixTest("reports a signalable PID and redirects output on POSIX", function () { return __awaiter(void 0, void 0, void 0, function () {
        var root, outputPath, pid, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-detached-"))];
                case 1:
                    root = _b.sent();
                    outputPath = (0, node_path_1.join)(root, "out.log");
                    return [4 /*yield*/, (0, index_1.startDetachedProcess)({
                            command: "printf posix-branch",
                            posixScript: "setsid bash -c 'printf posix-branch' > '".concat(outputPath, "' 2>&1 & echo $!"),
                            cwd: root,
                            outputPath: outputPath,
                            env: { PATH: process.env.PATH },
                        })];
                case 2:
                    pid = (_b.sent()).pid;
                    (0, bun_test_1.expect)(Number.isInteger(pid)).toBe(true);
                    (0, bun_test_1.expect)(pid).toBeGreaterThan(0);
                    _a = bun_test_1.expect;
                    return [4 /*yield*/, waitForOutput(outputPath)];
                case 3:
                    _a.apply(void 0, [_b.sent()]).toContain("posix-branch");
                    return [2 /*return*/];
            }
        });
    }); });
    posixTest("surfaces a failing POSIX launcher instead of a bogus PID", function () { return __awaiter(void 0, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-detached-fail-"))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.startDetachedProcess)({
                            command: "true",
                            posixScript: "exit 7",
                            cwd: root,
                            outputPath: (0, node_path_1.join)(root, "out.log"),
                            env: { PATH: process.env.PATH },
                        })).rejects.toThrow()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)("locates the shell through the host environment, not the child env", function () { return __awaiter(void 0, void 0, void 0, function () {
        var root, outputPath, bash, pid, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-detached-win-"))];
                case 1:
                    root = _b.sent();
                    outputPath = (0, node_path_1.join)(root, "out.log");
                    bash = process.platform === "win32"
                        ? (0, index_1.resolveBashExecutable)({ env: process.env })
                        : "/bin/bash";
                    return [4 /*yield*/, (0, index_1.startDetachedProcess)({
                            command: "printf windows-branch",
                            posixScript: "echo 999999999",
                            cwd: root,
                            outputPath: outputPath,
                            os: "win32",
                            env: { PATH: process.env.PATH },
                            hostEnv: { NATALIA_BASH_EXECUTABLE: bash },
                        })];
                case 2:
                    pid = (_b.sent()).pid;
                    (0, bun_test_1.expect)(pid).not.toBe(999999999);
                    (0, bun_test_1.expect)(Number.isInteger(pid)).toBe(true);
                    (0, bun_test_1.expect)(pid).toBeGreaterThan(0);
                    // Redirection is performed natively rather than by the shell script.
                    _a = bun_test_1.expect;
                    return [4 /*yield*/, waitForOutput(outputPath)];
                case 3:
                    // Redirection is performed natively rather than by the shell script.
                    _a.apply(void 0, [_b.sent()]).toContain("windows-branch");
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)("requires a bash-compatible shell on Windows", function () { return __awaiter(void 0, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-detached-nobash-"))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.startDetachedProcess)({
                            command: "printf hi",
                            posixScript: "echo 1",
                            cwd: root,
                            outputPath: (0, node_path_1.join)(root, "out.log"),
                            os: "win32",
                            hostEnv: { ProgramFiles: node_path_1.win32.join("C:", "Program Files") },
                            exists: function () { return false; },
                        })).rejects.toThrow(/bash-compatible shell is unavailable/u)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
/**
 * A profile-reading shell can take a second to start, so the log is polled
 * rather than sampled after a fixed delay.
 */
function waitForOutput(path_1) {
    return __awaiter(this, arguments, void 0, function (path, timeoutMs) {
        var deadline, content;
        if (timeoutMs === void 0) { timeoutMs = 15000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deadline = Date.now() + timeoutMs;
                    _a.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8").catch(function () { return ""; })];
                case 2:
                    content = _a.sent();
                    if (content.trim())
                        return [2 /*return*/, content];
                    return [4 /*yield*/, Bun.sleep(100)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, ""];
            }
        });
    });
}
