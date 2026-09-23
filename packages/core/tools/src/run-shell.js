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
exports.runShell = runShell;
var node_child_process_1 = require("node:child_process");
var promises_1 = require("node:fs/promises");
var platform_1 = require("@natalia/platform");
var confinement_1 = require("@natalia/confinement");
var child_process_1 = require("./child-process");
/** The confinement wrapper's refusal prefix (its own stderr dialect). */
var WRAPPER_FAILURE_SIGNATURE = "confinement-exec:";
/**
 * Runs one shell command inside the workspace with output capture.
 *
 * Lives here rather than in `@natalia/plugin-tool-shell` because it is a shared
 * execution primitive, not shell-plugin-specific: `@natalia/plugin-tool-web` runs the
 * headless browser through it. A tool plugin may use it without statically
 * depending on another tool plugin's package.
 */
function runShell(command, context, timeoutSec) {
    return __awaiter(this, void 0, void 0, function () {
        var shell, executable, args, wrapped;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.stat)(context.workspaceRoot)];
                case 1:
                    _a.sent();
                    shell = (0, platform_1.profileShellCommand)(command);
                    executable = shell.executable;
                    args = shell.args;
                    if (context.confinement && context.confinement !== "danger-full-access") {
                        wrapped = (0, confinement_1.wrapConfinedCommand)({
                            mode: context.confinement,
                            workspaceRoot: context.workspaceRoot,
                            command: shell.executable,
                            args: shell.args,
                        });
                        if (!wrapped)
                            throw new Error("sandbox unavailable: the confinement backend is missing; refusing to run the command unconstrained (fail-closed)");
                        executable = wrapped.command;
                        args = wrapped.args;
                    }
                    return [4 /*yield*/, new Promise(function (resolvePromise, reject) {
                            var _a, _b, _c, _d;
                            var child = (0, node_child_process_1.spawn)(executable, args, {
                                cwd: context.workspaceRoot,
                                detached: true,
                                stdio: ["ignore", "pipe", "pipe"],
                                env: (0, child_process_1.safeToolEnv)((_a = context.settings) === null || _a === void 0 ? void 0 : _a.envAllowlist),
                            });
                            var settled = false;
                            var finish = function (result) {
                                var _a;
                                if (settled)
                                    return;
                                settled = true;
                                clearTimeout(timer);
                                (_a = context.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", abort);
                                result();
                            };
                            var abort = function () {
                                (0, child_process_1.terminateChildProcessTree)(child.pid);
                                finish(function () { var _a, _b; return reject((_b = (_a = context.signal) === null || _a === void 0 ? void 0 : _a.reason) !== null && _b !== void 0 ? _b : new Error("command cancelled")); });
                            };
                            var timer = setTimeout(function () {
                                (0, child_process_1.terminateChildProcessTree)(child.pid);
                                finish(function () { return reject(new Error("command timed out after ".concat(timeoutSec, "s"))); });
                            }, timeoutSec * 1000);
                            (_b = context.signal) === null || _b === void 0 ? void 0 : _b.addEventListener("abort", abort, { once: true });
                            var stdout = "";
                            var stderr = "";
                            var childEvents = child;
                            (_c = childEvents.stdout) === null || _c === void 0 ? void 0 : _c.on("data", function (chunk) { return (stdout += String(chunk)); });
                            (_d = childEvents.stderr) === null || _d === void 0 ? void 0 : _d.on("data", function (chunk) { return (stderr += String(chunk)); });
                            childEvents.on("error", function (error) {
                                finish(function () { return reject(error); });
                            });
                            childEvents.on("close", function (code) {
                                // The wrapper prints `confinement-exec: ...` when IT refuses (missing
                                // landlock, an unappliable rule): that is a sandbox failure, not the
                                // command's own exit, and must read as one (dsh's runner-failure
                                // signature classification).
                                if (code !== 0 && stderr.startsWith(WRAPPER_FAILURE_SIGNATURE)) {
                                    finish(function () {
                                        return reject(new Error("sandbox refused the command before exec (fail-closed): ".concat(stderr.trim())));
                                    });
                                    return;
                                }
                                var output = [
                                    "exit=".concat(code),
                                    stdout && "stdout:\n".concat(stdout),
                                    stderr && "stderr:\n".concat(stderr),
                                ]
                                    .filter(Boolean)
                                    .join("\n");
                                if (code === 0)
                                    finish(function () { return resolvePromise(output); });
                                else
                                    finish(function () { return reject(new Error(output)); });
                            });
                        })];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
