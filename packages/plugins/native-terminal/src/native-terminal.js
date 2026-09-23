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
exports.NativeTerminalRegistry = exports.startNativeInputBroker = exports.nativeInputBrokerDecision = exports.nativeInputBrokerEndpoint = exports.encodeNativeInputDecision = exports.decodeNativeInputDecision = exports.decodeNativeInputClaim = exports.NATIVE_INPUT_BROKER_VERSION = void 0;
exports.resolveWezTermExecutable = resolveWezTermExecutable;
exports.nativeTerminalForkBuildDir = nativeTerminalForkBuildDir;
exports.resolveNataliaWezTermForkExecutable = resolveNataliaWezTermForkExecutable;
exports.nativeTerminalPaneCommand = nativeTerminalPaneCommand;
exports.createWezTermHost = createWezTermHost;
exports.reclaimStaleMuxRuntimeDirs = reclaimStaleMuxRuntimeDirs;
exports.writeWezTermNativeDomainConfig = writeWezTermNativeDomainConfig;
exports.monospaceFontFallback = monospaceFontFallback;
var node_crypto_1 = require("node:crypto");
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var node_worker_threads_1 = require("node:worker_threads");
var platform_1 = require("@natalia/platform");
var input_broker_1 = require("./input-broker");
Object.defineProperty(exports, "NATIVE_INPUT_BROKER_VERSION", { enumerable: true, get: function () { return input_broker_1.NATIVE_INPUT_BROKER_VERSION; } });
Object.defineProperty(exports, "decodeNativeInputClaim", { enumerable: true, get: function () { return input_broker_1.decodeNativeInputClaim; } });
Object.defineProperty(exports, "decodeNativeInputDecision", { enumerable: true, get: function () { return input_broker_1.decodeNativeInputDecision; } });
Object.defineProperty(exports, "encodeNativeInputDecision", { enumerable: true, get: function () { return input_broker_1.encodeNativeInputDecision; } });
Object.defineProperty(exports, "nativeInputBrokerEndpoint", { enumerable: true, get: function () { return input_broker_1.nativeInputBrokerEndpoint; } });
Object.defineProperty(exports, "nativeInputBrokerDecision", { enumerable: true, get: function () { return input_broker_1.nativeInputBrokerDecision; } });
var input_broker_server_1 = require("./input-broker-server");
Object.defineProperty(exports, "startNativeInputBroker", { enumerable: true, get: function () { return input_broker_server_1.startNativeInputBroker; } });
function resolveWezTermExecutable(input) {
    if (input === void 0) { input = {}; }
    if (input.configured)
        return input.configured;
    var fork = resolveNataliaWezTermForkExecutable({
        os: input.os,
        buildDir: input.forkBuildDir,
    });
    if (fork)
        return fork;
    return undefined;
}
/**
 * The patched current-main source is owned by this package. Its release build
 * is generated locally and intentionally excluded from version control.
 */
function nativeTerminalForkBuildDir() {
    return import.meta.url.endsWith(".ts")
        ? (0, node_path_1.join)(import.meta.dir, "..", "wezterm", "target", "release")
        : (0, node_path_1.join)(import.meta.dir, "wezterm");
}
function resolveNataliaWezTermForkExecutable(input) {
    var _a, _b;
    if (input === void 0) { input = {}; }
    var os = (_a = input.os) !== null && _a !== void 0 ? _a : (0, node_os_1.platform)();
    var executable = (0, node_path_1.join)((_b = input.buildDir) !== null && _b !== void 0 ? _b : nativeTerminalForkBuildDir(), (0, platform_1.executableName)("wezterm", os));
    return (0, node_fs_1.existsSync)(executable) ? executable : undefined;
}
/**
 * Readiness budget for a Windows mux server. It is far larger than the POSIX
 * one because the server is not daemonized there, so first-run costs such as
 * Defender inspecting a freshly written executable land inside this window.
 */
var WINDOWS_MUX_READY_TIMEOUT_MS = 120000;
/**
 * Argument vector for the shell that hosts a managed pane's command. A
 * bash `-lc` shell is used on every platform so that the command text, its
 * quoting, and its profile semantics are identical for the model regardless of
 * host. Windows resolves this to the Git for Windows bash.
 */
function nativeTerminalPaneCommand(command, os) {
    var shell = (0, platform_1.profileShellCommand)(command, { os: os, posixShell: "/bin/sh" });
    return __spreadArray([shell.executable], shell.args, true);
}
function createWezTermHost(input) {
    var _this = this;
    var _a, _b, _c, _d, _e, _f, _g;
    if (input === void 0) { input = {}; }
    // A deployment under test may be POSIX-shaped while the host machine is
    // Windows; the host's own os lets fixtures keep exercising the POSIX
    // launcher paths instead of silently falling into the native branch.
    var os = (_a = input.os) !== null && _a !== void 0 ? _a : (0, node_os_1.platform)();
    // An explicit override is reserved for controlled diagnostics. The managed
    // current-main fork build is the normal host when available.
    var executable = (_b = input.executable) !== null && _b !== void 0 ? _b : resolveWezTermExecutable({
        configured: process.env.NATALIA_WEZTERM_EXECUTABLE,
    });
    if (!executable)
        throw new Error("WezTerm Native Terminal Host is unavailable. Build the managed Natalia fork for this platform or set NATALIA_WEZTERM_EXECUTABLE for controlled diagnostics.");
    var run = (_c = input.run) !== null && _c !== void 0 ? _c : runWezTermCommand;
    var measure = function (name, work) { return __awaiter(_this, void 0, void 0, function () {
        var startedAt;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    startedAt = performance.now();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, work()];
                case 2: return [2 /*return*/, _b.sent()];
                case 3:
                    (_a = input.onPerformance) === null || _a === void 0 ? void 0 : _a.call(input, name, performance.now() - startedAt);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var timeoutMs = (_d = input.timeoutMs) !== null && _d !== void 0 ? _d : 5000;
    var launch = (_e = input.launch) !== null && _e !== void 0 ? _e : launchWezTermGUI;
    var configFile = (_g = (_f = input.nativeDomain) === null || _f === void 0 ? void 0 : _f.configFile) !== null && _g !== void 0 ? _g : input.configFile;
    var global = configFile ? ["--config-file", configFile] : [];
    var muxServer = (0, node_path_1.join)((0, node_path_1.dirname)(executable), (0, platform_1.executableName)("wezterm-mux-server", os));
    var privateEnvironment = __assign(__assign({}, input.environment), (input.muxRuntimeDir ? { XDG_RUNTIME_DIR: input.muxRuntimeDir } : {}));
    var muxReady;
    var command;
    var ensureMux = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        var _this = this;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!((_b = input.environment) === null || _b === void 0 ? void 0 : _b.WEZTERM_UNIX_SOCKET))
                        return [2 /*return*/];
                    _a = muxReady;
                    if (!_a) return [3 /*break*/, 2];
                    return [4 /*yield*/, isMuxAlive()];
                case 1:
                    _a = !(_c.sent());
                    _c.label = 2;
                case 2:
                    // A resolved promise only proves the server answered once. It can die
                    // later, and trusting the cache meant every later spawn talked to a dead
                    // socket with no way back: the only code that cleared the cache ran from
                    // reconcile, which spawn never reaches.
                    if (_a)
                        muxReady = undefined;
                    muxReady !== null && muxReady !== void 0 ? muxReady : (muxReady = (function () { return __awaiter(_this, void 0, void 0, function () {
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, muxIsReady()];
                                case 1:
                                    if (_a.sent())
                                        return [2 /*return*/];
                                    return [4 /*yield*/, measure("native.mux.start", function () { return __awaiter(_this, void 0, void 0, function () {
                                            var result, _a;
                                            return __generator(this, function (_b) {
                                                switch (_b.label) {
                                                    case 0:
                                                        if (!(0, platform_1.isWindows)(os)) return [3 /*break*/, 2];
                                                        // `--daemonize` relies on a DETACHED_PROCESS create that can leave the
                                                        // parent waiting on the cross-compiled binary, so the server is
                                                        // spawned directly and its readiness is polled instead. Its streams
                                                        // are discarded because the process outlives this call.
                                                        Bun.spawn(__spreadArray([muxServer], global, true), {
                                                            env: __assign(__assign({}, process.env), privateEnvironment),
                                                            detached: true,
                                                            stdout: "ignore",
                                                            stderr: "ignore",
                                                            stdin: "ignore",
                                                        }).unref();
                                                        return [4 /*yield*/, waitForMux(WINDOWS_MUX_READY_TIMEOUT_MS, 200)];
                                                    case 1:
                                                        _b.sent();
                                                        return [2 /*return*/];
                                                    case 2: return [4 /*yield*/, withTimeout(run(muxServer, __spreadArray(__spreadArray([], global, true), ["--daemonize"], false), undefined, privateEnvironment, timeoutMs), timeoutMs, ["wezterm-mux-server", "--daemonize"])];
                                                    case 3:
                                                        result = _b.sent();
                                                        _a = result.exitCode !== 0;
                                                        if (!_a) return [3 /*break*/, 5];
                                                        return [4 /*yield*/, muxIsReady()];
                                                    case 4:
                                                        _a = !(_b.sent());
                                                        _b.label = 5;
                                                    case 5:
                                                        // A concurrent session may have won the pid lock between the readiness
                                                        // probe and spawn. Reuse that mux only when it serves our private socket.
                                                        if (_a)
                                                            throw new Error("WezTerm mux server failed: ".concat(result.stderr.trim()));
                                                        return [4 /*yield*/, waitForMux(timeoutMs, 50)];
                                                    case 6:
                                                        _b.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })().catch(function (error) {
                        muxReady = undefined;
                        throw error;
                    }));
                    return [4 /*yield*/, muxReady];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var waitForMux = function (budgetMs, intervalMs) { return __awaiter(_this, void 0, void 0, function () {
        var deadline;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deadline = performance.now() + budgetMs;
                    _a.label = 1;
                case 1:
                    if (!(performance.now() < deadline)) return [3 /*break*/, 4];
                    return [4 /*yield*/, muxIsReady()];
                case 2:
                    if (_a.sent())
                        return [2 /*return*/];
                    return [4 /*yield*/, Bun.sleep(intervalMs)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 4: throw new Error("WezTerm mux server did not become ready within ".concat(budgetMs, "ms"));
            }
        });
    }); };
    command = function (args, stdin) { return __awaiter(_this, void 0, void 0, function () {
        var cliArgs, operation, result;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    cliArgs = args[0] === "cli" && input.className
                        ? __spreadArray([
                            "cli",
                            "--no-auto-start",
                            "--prefer-mux",
                            "--class",
                            input.className
                        ], args.slice(1), true) : args[0] === "cli"
                        ? __spreadArray(["cli", "--no-auto-start", "--prefer-mux"], args.slice(1), true) : args;
                    operation = args[0] === "cli" ? ((_a = args[1]) !== null && _a !== void 0 ? _a : "unknown") : ((_b = args[0]) !== null && _b !== void 0 ? _b : "unknown");
                    return [4 /*yield*/, measure("native.cli.".concat(operation), function () {
                            return withTimeout(run(executable, __spreadArray(__spreadArray([], global, true), cliArgs, true), stdin, privateEnvironment, timeoutMs), timeoutMs, args);
                        })];
                case 1:
                    result = _c.sent();
                    if (result.exitCode !== 0)
                        throw new Error("WezTerm command failed (".concat(args.join(" "), "): ").concat(result.stderr.trim()));
                    return [2 /*return*/, result.stdout];
            }
        });
    }); };
    var muxIsReady = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, command(["cli", "list", "--format", "json"])];
                case 1:
                    _b.sent();
                    return [2 /*return*/, true];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var privateClientPaneIDs = function () { return __awaiter(_this, void 0, void 0, function () {
        var output, clients, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, command(["cli", "list-clients", "--format", "json"])];
                case 1:
                    output = _b.sent();
                    clients = JSON.parse(output);
                    if (!Array.isArray(clients))
                        return [2 /*return*/, []];
                    return [2 /*return*/, clients.flatMap(function (client) {
                            if (!client || typeof client !== "object")
                                return [];
                            var paneID = client.focused_pane_id;
                            return Number.isSafeInteger(paneID) ? [paneID] : [];
                        })];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var ensureCjkGlyphReadiness = function () { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, measure("native.gui.glyph-ready", function () { return __awaiter(_this, void 0, void 0, function () {
                        var output;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, command(["ls-fonts", "--text", "你好中文"])];
                                case 1:
                                    output = _a.sent();
                                    if (!output.trim() || /(?:Last Resort|No fonts)/iu.test(output))
                                        throw new Error("Native GUI CJK glyph fallback is unavailable; refusing to report Terminal Hub open success");
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var isMuxAlive = function () { return __awaiter(_this, void 0, void 0, function () {
        var result, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, withTimeout(run(executable, [
                            "cli",
                            "--no-auto-start",
                            "--prefer-mux",
                            "list",
                            "--format",
                            "json",
                        ], undefined, privateEnvironment, 2000), 2000, ["cli", "list"])];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, result.exitCode === 0];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    return {
        kind: "wezterm",
        executable: executable,
        spawn: function (options) {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, measure("native.spawn", function () { return __awaiter(_this, void 0, void 0, function () {
                                var args, output, paneID, pane;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, ensureMux()];
                                        case 1:
                                            _a.sent();
                                            args = ["cli", "spawn", "--cwd", options.cwd];
                                            if (options.muxWindowID === undefined) {
                                                args.push("--new-window");
                                                if (options.workspace)
                                                    args.push("--workspace", options.workspace);
                                            }
                                            else
                                                args.push("--window-id", String(options.muxWindowID));
                                            args.push.apply(args, __spreadArray(["--"], options.command, false));
                                            return [4 /*yield*/, command(args)];
                                        case 2:
                                            output = _a.sent();
                                            paneID = Number.parseInt(output.trim(), 10);
                                            if (!Number.isSafeInteger(paneID))
                                                throw new Error("WezTerm returned an invalid pane id: ".concat(output.trim()));
                                            return [4 /*yield*/, this.list()];
                                        case 3:
                                            pane = (_a.sent()).find(function (item) { return item.pane_id === paneID; });
                                            if (!pane)
                                                throw new Error("WezTerm created pane ".concat(paneID, " but it was not listed"));
                                            return [2 /*return*/, pane];
                                    }
                                });
                            }); })];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        list: function () {
            return __awaiter(this, void 0, void 0, function () {
                var output, parsed;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, command(["cli", "list", "--format", "json"])];
                        case 1:
                            output = _a.sent();
                            parsed = JSON.parse(output);
                            if (!Array.isArray(parsed))
                                throw new Error("WezTerm returned invalid pane list");
                            return [2 /*return*/, parsed.map(parsePane)];
                    }
                });
            });
        },
        read: function (paneID_1) {
            return __awaiter(this, arguments, void 0, function (paneID, options) {
                var maxLines, args, startLine, endLine, lowerLine;
                var _a;
                if (options === void 0) { options = {}; }
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!(options.format === "selection")) return [3 /*break*/, 2];
                            return [4 /*yield*/, command([
                                    "cli",
                                    "get-selection",
                                    "--pane-id",
                                    String(paneID),
                                ])];
                        case 1: return [2 /*return*/, _b.sent()];
                        case 2:
                            if (!(options.format === "highlights")) return [3 /*break*/, 4];
                            return [4 /*yield*/, command([
                                    "cli",
                                    "get-highlights",
                                    "--pane-id",
                                    String(paneID),
                                ])];
                        case 3: return [2 /*return*/, _b.sent()];
                        case 4:
                            maxLines = Math.max(1, Math.min((_a = options.maxLines) !== null && _a !== void 0 ? _a : 200, 2000));
                            args = ["cli", "get-text", "--pane-id", String(paneID)];
                            if (options.startLine !== undefined) {
                                startLine = Math.trunc(options.startLine);
                                endLine = options.endLine === undefined
                                    ? undefined
                                    : Math.trunc(options.endLine);
                                lowerLine = endLine === undefined ? startLine : Math.min(startLine, endLine);
                                args.push("--start-line", String(lowerLine));
                                if (endLine !== undefined)
                                    args.push("--end-line", String(Math.max(startLine, endLine)));
                            }
                            else
                                args.push("--start-line", String(-maxLines));
                            return [4 /*yield*/, command(args)];
                        case 5: return [2 /*return*/, _b.sent()];
                    }
                });
            });
        },
        write: function (paneID, data) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, command(["cli", "send-text", "--pane-id", String(paneID), "--no-paste"], data)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        open: function (paneID_1) {
            return __awaiter(this, arguments, void 0, function (paneID, options) {
                var openedAt, before, _i, _a, pane, deadline, pane;
                var _b, _c, _d;
                if (options === void 0) { options = {}; }
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            openedAt = performance.now();
                            return [4 /*yield*/, this.list()];
                        case 1:
                            before = (_e.sent()).find(function (item) { return item.pane_id === paneID; });
                            if (!before)
                                throw new Error("WezTerm pane ".concat(paneID, " is unavailable"));
                            if (!options.discardBootstrapPanes) return [3 /*break*/, 6];
                            _i = 0;
                            return [4 /*yield*/, this.list()];
                        case 2:
                            _a = _e.sent();
                            _e.label = 3;
                        case 3:
                            if (!(_i < _a.length)) return [3 /*break*/, 6];
                            pane = _a[_i];
                            if (!(pane.pane_id !== paneID)) return [3 /*break*/, 5];
                            return [4 /*yield*/, command([
                                    "cli",
                                    "kill-pane",
                                    "--pane-id",
                                    String(pane.pane_id),
                                ])];
                        case 4:
                            _e.sent();
                            _e.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6: return [4 /*yield*/, command(__spreadArray([
                                "cli",
                                "move-pane-to-new-tab",
                                "--pane-id",
                                String(paneID)
                            ], (options.muxWindowID === undefined
                                ? ["--new-window", "--workspace", "natalia"]
                                : ["--window-id", String(options.muxWindowID)]), true))];
                        case 7:
                            _e.sent();
                            if (!(options.launch !== false)) return [3 /*break*/, 9];
                            return [4 /*yield*/, ((_b = this.openHub) === null || _b === void 0 ? void 0 : _b.call(this, { environment: options.environment }))];
                        case 8:
                            _e.sent();
                            (_c = input.onPerformance) === null || _c === void 0 ? void 0 : _c.call(input, "native.gui.launch", performance.now() - openedAt);
                            _e.label = 9;
                        case 9:
                            deadline = performance.now() + timeoutMs;
                            _e.label = 10;
                        case 10:
                            if (!(performance.now() < deadline)) return [3 /*break*/, 15];
                            return [4 /*yield*/, command(["cli", "activate-pane", "--pane-id", String(paneID)])];
                        case 11:
                            _e.sent();
                            return [4 /*yield*/, this.list()];
                        case 12:
                            pane = (_e.sent()).find(function (item) { return item.pane_id === paneID; });
                            if (!pane)
                                throw new Error("WezTerm pane ".concat(paneID, " disappeared while opening"));
                            return [4 /*yield*/, privateClientPaneIDs()];
                        case 13:
                            // A server-side move changes window identity before any GUI client
                            // exists. Only the private mux client's focused pane proves the GUI
                            // attached to this exact Natalia pane rather than a local shell.
                            if ((_e.sent()).includes(paneID)) {
                                (_d = input.onPerformance) === null || _d === void 0 ? void 0 : _d.call(input, "native.gui.attach", performance.now() - openedAt);
                                return [2 /*return*/, pane];
                            }
                            return [4 /*yield*/, Bun.sleep(100)];
                        case 14:
                            _e.sent();
                            return [3 /*break*/, 10];
                        case 15: throw new Error("WezTerm GUI did not attach to the native terminal window within ".concat(timeoutMs, "ms"));
                    }
                });
            });
        },
        openHub: function () {
            return __awaiter(this, arguments, void 0, function (options) {
                var _a, _b, _c;
                if (options === void 0) { options = {}; }
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, privateClientPaneIDs()];
                        case 1:
                            if ((_d.sent()).length)
                                return [2 /*return*/];
                            return [4 /*yield*/, ensureCjkGlyphReadiness()];
                        case 2:
                            _d.sent();
                            return [4 /*yield*/, launch(executable, __spreadArray(__spreadArray([], global, true), [
                                    "connect",
                                    (_c = (_b = (_a = input.nativeDomain) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : input.muxDomain) !== null && _c !== void 0 ? _c : "local",
                                    "--workspace",
                                    "natalia",
                                ], false), options.environment
                                    ? __assign(__assign({}, privateEnvironment), options.environment) : privateEnvironment)];
                        case 3:
                            _d.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        focus: function (paneID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, command(["cli", "activate-pane", "--pane-id", String(paneID)])];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        resize: function (paneID, rows, cols) {
            return __awaiter(this, void 0, void 0, function () {
                var pane, rowDelta, colDelta;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.list()];
                        case 1:
                            pane = (_a.sent()).find(function (item) { return item.pane_id === paneID; });
                            if (!pane || pane.rows === undefined || pane.cols === undefined)
                                throw new Error("WezTerm pane geometry is unavailable");
                            rowDelta = rows - pane.rows;
                            colDelta = cols - pane.cols;
                            if (!rowDelta) return [3 /*break*/, 3];
                            return [4 /*yield*/, command([
                                    "cli",
                                    "adjust-pane-size",
                                    "--pane-id",
                                    String(paneID),
                                    "--amount",
                                    String(Math.abs(rowDelta)),
                                    rowDelta > 0 ? "Down" : "Up",
                                ])];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            if (!colDelta) return [3 /*break*/, 5];
                            return [4 /*yield*/, command([
                                    "cli",
                                    "adjust-pane-size",
                                    "--pane-id",
                                    String(paneID),
                                    "--amount",
                                    String(Math.abs(colDelta)),
                                    colDelta > 0 ? "Right" : "Left",
                                ])];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5: return [2 /*return*/];
                    }
                });
            });
        },
        stop: function (paneID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, command(["cli", "kill-pane", "--pane-id", String(paneID)])];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        dispose: function () {
            return __awaiter(this, void 0, void 0, function () {
                var pidFile, pid, _a, _b, error_1, code, attempt, error_2, code;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (!input.muxRuntimeDir)
                                return [2 /*return*/];
                            pidFile = (0, node_path_1.join)(input.muxRuntimeDir, "wezterm", "pid");
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 3, 4, 11]);
                            _b = (_a = Number).parseInt;
                            return [4 /*yield*/, (0, promises_1.readFile)(pidFile, "utf8")];
                        case 2:
                            pid = _b.apply(_a, [(_c.sent()).trim(),
                                10]);
                            if (Number.isSafeInteger(pid) && pid > 1)
                                process.kill(pid, "SIGTERM");
                            return [3 /*break*/, 11];
                        case 3:
                            error_1 = _c.sent();
                            code = error_1 instanceof Error && "code" in error_1
                                ? error_1.code
                                : undefined;
                            if (code !== "ENOENT" && code !== "ESRCH")
                                throw error_1;
                            return [3 /*break*/, 11];
                        case 4:
                            attempt = 0;
                            _c.label = 5;
                        case 5:
                            _c.trys.push([5, 7, , 9]);
                            return [4 /*yield*/, (0, promises_1.rm)(input.muxRuntimeDir, { recursive: true, force: true })];
                        case 6:
                            _c.sent();
                            return [3 /*break*/, 10];
                        case 7:
                            error_2 = _c.sent();
                            code = error_2.code;
                            if ((code !== "EBUSY" && code !== "EPERM") || attempt >= 10)
                                return [3 /*break*/, 10];
                            return [4 /*yield*/, Bun.sleep(100)];
                        case 8:
                            _c.sent();
                            return [3 /*break*/, 9];
                        case 9:
                            attempt += 1;
                            return [3 /*break*/, 5];
                        case 10: return [7 /*endfinally*/];
                        case 11: return [2 /*return*/];
                    }
                });
            });
        },
        isClientAttached: function (paneID) {
            return __awaiter(this, void 0, void 0, function () {
                var output, clients, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, command([
                                    "cli",
                                    "list-clients",
                                    "--format",
                                    "json",
                                ])];
                        case 1:
                            output = _b.sent();
                            clients = JSON.parse(output);
                            if (!Array.isArray(clients))
                                return [2 /*return*/, false];
                            return [2 /*return*/, clients.some(function (client) {
                                    return client &&
                                        typeof client.focused_pane_id === "number" &&
                                        client.focused_pane_id === paneID;
                                })];
                        case 2:
                            _a = _b.sent();
                            return [2 /*return*/, false];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        },
        isAlive: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, isMuxAlive()];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        resetMuxReady: function () {
            muxReady = undefined;
        },
        listClients: function () {
            return __awaiter(this, void 0, void 0, function () {
                var output, clients, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, command([
                                    "cli",
                                    "list-clients",
                                    "--format",
                                    "json",
                                ])];
                        case 1:
                            output = _b.sent();
                            clients = JSON.parse(output);
                            if (!Array.isArray(clients))
                                return [2 /*return*/, []];
                            return [2 /*return*/, clients
                                    .filter(function (client) {
                                    return !!client && typeof client === "object";
                                })
                                    .map(function (client) { return ({
                                    focused_pane_id: client.focused_pane_id,
                                }); })];
                        case 2:
                            _a = _b.sent();
                            return [2 /*return*/, []];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        },
    };
}
/**
 * Removes mux runtime directories left behind by runtimes that exited without
 * disposing. Each runtime creates one directory, so a process that is killed or
 * crashes leaks it, and they accumulate for as long as the host stays up.
 *
 * A directory is only reclaimed when nothing is using it: either no mux server
 * ever wrote a pid there, or the recorded pid is gone. The age check keeps this
 * away from a sibling runtime that has just created its directory and has not
 * started its server yet.
 */
function reclaimStaleMuxRuntimeDirs(input) {
    return __awaiter(this, void 0, void 0, function () {
        var olderThanMs, entries, reclaimed, _i, entries_1, entry, directory, info, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    olderThanMs = (_b = input.olderThanMs) !== null && _b !== void 0 ? _b : 600000;
                    return [4 /*yield*/, (0, promises_1.readdir)(input.root, { withFileTypes: true }).catch(function () { return []; })];
                case 1:
                    entries = _c.sent();
                    reclaimed = 0;
                    _i = 0, entries_1 = entries;
                    _c.label = 2;
                case 2:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 9];
                    entry = entries_1[_i];
                    if (!entry.isDirectory() || entry.name === input.keep)
                        return [3 /*break*/, 8];
                    directory = (0, node_path_1.join)(input.root, entry.name);
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 7, , 8]);
                    return [4 /*yield*/, (0, promises_1.stat)(directory)];
                case 4:
                    info = _c.sent();
                    if (Date.now() - info.mtimeMs < olderThanMs)
                        return [3 /*break*/, 8];
                    return [4 /*yield*/, muxRuntimeDirInUse(directory)];
                case 5:
                    if (_c.sent())
                        return [3 /*break*/, 8];
                    return [4 /*yield*/, (0, promises_1.rm)(directory, { recursive: true, force: true })];
                case 6:
                    _c.sent();
                    reclaimed += 1;
                    return [3 /*break*/, 8];
                case 7:
                    _a = _c.sent();
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9: return [2 /*return*/, reclaimed];
            }
        });
    });
}
function muxRuntimeDirInUse(directory) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, pid;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(directory, "wezterm", "pid"), "utf8").catch(function () { return undefined; })];
                case 1:
                    raw = _a.sent();
                    if (raw === undefined)
                        return [2 /*return*/, false];
                    pid = Number.parseInt(raw.trim(), 10);
                    if (!Number.isSafeInteger(pid) || pid <= 1)
                        return [2 /*return*/, false];
                    try {
                        process.kill(pid, 0);
                        return [2 /*return*/, true];
                    }
                    catch (error) {
                        // EPERM means the process exists but belongs to someone else, so it is in
                        // use. ESRCH means it is gone and the directory can go with it.
                        return [2 /*return*/, error.code === "EPERM"];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function writeWezTermNativeDomainConfig(input) {
    return __awaiter(this, void 0, void 0, function () {
        var name, configFile, fonts;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    name = (_a = input.name) !== null && _a !== void 0 ? _a : "natalia";
                    configFile = (0, node_path_1.join)(input.directory, "wezterm-native-domain.lua");
                    fonts = monospaceFontFallback(input.os)
                        .map(function (font) { return "    ".concat(JSON.stringify(font), ","); })
                        .join("\n");
                    return [4 /*yield*/, (0, promises_1.writeFile)(configFile, "local wezterm = require 'wezterm'\n\nreturn {\n  unix_domains = {\n    {\n      name = ".concat(JSON.stringify(name), ",\n      socket_path = [[").concat(input.socketPath, "]],\n      no_serve_automatically = true,\n    },\n  },\n  -- Avoid the asynchronous system fallback path for CJK text. The latter can\n  -- briefly render Last Resort/tofu glyphs while fontconfig resolves fonts.\n  font = wezterm.font_with_fallback {\n").concat(fonts, "\n  },\n}\n"), { mode: 384 })];
                case 1:
                    _b.sent();
                    return [2 /*return*/, { name: name, socketPath: input.socketPath, configFile: configFile }];
            }
        });
    });
}
/**
 * Explicit monospace fallback chain per platform. The CJK families differ
 * between distributions and Windows, and an absent family would otherwise be
 * resolved as tofu rather than falling through to the next candidate.
 */
function monospaceFontFallback(os) {
    if ((0, platform_1.isWindows)(os))
        return [
            "JetBrains Mono",
            "Cascadia Mono",
            "Consolas",
            "Microsoft YaHei Mono",
            "Microsoft YaHei",
            "Segoe UI Emoji",
        ];
    return [
        "JetBrains Mono",
        "Noto Sans Mono CJK SC",
        "Noto Sans CJK SC",
        "Noto Color Emoji",
    ];
}
function withTimeout(promise, timeoutMs, args) {
    return __awaiter(this, void 0, void 0, function () {
        var timer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, , 2, 3]);
                    return [4 /*yield*/, Promise.race([
                            promise,
                            new Promise(function (_, reject) {
                                timer = setTimeout(function () {
                                    return reject(new Error("WezTerm command timed out after ".concat(timeoutMs, "ms: ").concat(args.join(" "))));
                                }, timeoutMs);
                            }),
                        ])];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    if (timer)
                        clearTimeout(timer);
                    return [7 /*endfinally*/];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Control plane for panes rendered by WezTerm itself. It intentionally has no
 * framebuffer, polling loop, or ANSI renderer: the native pane is the only
 * human-facing terminal authority.
 */
var NativeTerminalRegistry = /** @class */ (function () {
    function NativeTerminalRegistry(host, options) {
        if (options === void 0) { options = {}; }
        this.host = host;
        this.options = options;
        this.sessions = new Map();
        this.idempotency = new Map();
        this.modelWrites = new Map();
        this.revisionWaiters = new Map();
        this.lastReconcileAt = -Infinity;
        this.loadPersistedSessions();
    }
    NativeTerminalRegistry.prototype.setHumanInputBridge = function (bridge) {
        this.humanInputBridge = bridge;
    };
    /**
     * I3: switch whose panes the model-visible surface addresses. Pane records
     * without an owning session (a host-injected registry that started panes
     * before the runtime had a session) are claimed by the new active session;
     * explicitly owned panes never move.
     */
    NativeTerminalRegistry.prototype.setActiveSession = function (sessionID) {
        if (sessionID !== undefined)
            for (var _i = 0, _a = this.sessions.values(); _i < _a.length; _i++) {
                var session = _a[_i];
                if (session.sessionID === undefined && session.status === "running")
                    session.sessionID = sessionID;
            }
        this.activeSession = sessionID;
    };
    NativeTerminalRegistry.prototype.assertSessionOwner = function (session, sessionID) {
        var expected = sessionID !== null && sessionID !== void 0 ? sessionID : this.activeSession;
        if (expected && session.sessionID && session.sessionID !== expected)
            throw new Error("terminal ".concat(session.id, " belongs to session ").concat(session.sessionID));
    };
    NativeTerminalRegistry.prototype.start = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var owningSession, background, pane, error_3, msg, session, error_4, windowMode, known, _i, _a, p, error_5;
            var _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        // Creating a pane is only ever requested by the model, and it lands in the
                        // window the human is attached to.
                        this.assertNoHumanSecureInput("starting a terminal", "model");
                        owningSession = (_b = input.sessionID) !== null && _b !== void 0 ? _b : this.activeSession;
                        background = this.activeSession !== undefined && owningSession !== this.activeSession;
                        return [4 /*yield*/, ((_d = (_c = this.host).isAlive) === null || _d === void 0 ? void 0 : _d.call(_c))];
                    case 1:
                        if (!((_j.sent()) === false)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.reconcile({ force: true })];
                    case 2:
                        _j.sent();
                        _j.label = 3;
                    case 3:
                        _j.trys.push([3, 5, , 9]);
                        return [4 /*yield*/, this.host.spawn({
                                cwd: input.cwd,
                                command: nativeTerminalPaneCommand(input.command),
                                workspace: "natalia",
                                muxWindowID: (_e = this.hub) === null || _e === void 0 ? void 0 : _e.muxWindowID,
                            })];
                    case 4:
                        pane = _j.sent();
                        return [3 /*break*/, 9];
                    case 5:
                        error_3 = _j.sent();
                        msg = error_3 instanceof Error ? error_3.message : String(error_3);
                        if (!(this.hub && /window.*(?:not found|doesn.t exist)/i.test(msg))) return [3 /*break*/, 7];
                        this.hub = undefined;
                        return [4 /*yield*/, this.host.spawn({
                                cwd: input.cwd,
                                command: nativeTerminalPaneCommand(input.command),
                                workspace: "natalia",
                                muxWindowID: undefined,
                            })];
                    case 6:
                        pane = _j.sent();
                        return [3 /*break*/, 8];
                    case 7: throw error_3;
                    case 8: return [3 /*break*/, 9];
                    case 9:
                        session = __assign(__assign({ id: (_f = input.id) !== null && _f !== void 0 ? _f : "terminal_".concat((0, node_crypto_1.randomUUID)()), 
                            // Model-side starts (tools and remote callers) belong to the active
                            // session; an explicit id wins once parallel sessions can start panes
                            // for a background session.
                            sessionID: (_g = input.sessionID) !== null && _g !== void 0 ? _g : this.activeSession }, (input.agentID ? { agentID: input.agentID } : {})), { host: "wezterm", paneID: pane.pane_id, windowID: pane.window_id, muxWindowID: pane.window_id, tabID: pane.tab_id, command: input.command, cwd: input.cwd, startedAt: new Date().toISOString(), revision: 0, inputOwner: "model", geometryOwner: "human", secureInput: false, status: "running", attached: true, rows: pane.rows, cols: pane.cols });
                        this.sessions.set(session.id, session);
                        _j.label = 10;
                    case 10:
                        _j.trys.push([10, 12, , 15]);
                        return [4 /*yield*/, this.persistSessions()];
                    case 11:
                        _j.sent();
                        return [3 /*break*/, 15];
                    case 12:
                        error_4 = _j.sent();
                        // persistSessions failed: never leave a pane registered without a
                        // durable record.
                        this.sessions.delete(session.id);
                        return [4 /*yield*/, this.host.stop(session.paneID).catch(function () { return undefined; })];
                    case 13:
                        _j.sent();
                        return [4 /*yield*/, this.persistSessions().catch(function () { return undefined; })];
                    case 14:
                        _j.sent();
                        throw error_4;
                    case 15:
                        windowMode = (_h = this.options.windowMode) !== null && _h !== void 0 ? _h : "auto";
                        if (!(windowMode !== "windowless" && !background)) return [3 /*break*/, 32];
                        _j.label = 16;
                    case 16:
                        _j.trys.push([16, 26, , 31]);
                        if (!!this.hub) return [3 /*break*/, 18];
                        return [4 /*yield*/, this.attachToHub(session, true, true)];
                    case 17:
                        _j.sent();
                        return [3 /*break*/, 25];
                    case 18:
                        session.windowID = this.hub.muxWindowID;
                        session.muxWindowID = this.hub.muxWindowID;
                        known = new Set(this.sessions.values().map(function (s) { return s.paneID; }));
                        _i = 0;
                        return [4 /*yield*/, this.host.list()];
                    case 19:
                        _a = _j.sent();
                        _j.label = 20;
                    case 20:
                        if (!(_i < _a.length)) return [3 /*break*/, 23];
                        p = _a[_i];
                        if (!(!known.has(p.pane_id) && p.window_id === this.hub.muxWindowID)) return [3 /*break*/, 22];
                        return [4 /*yield*/, this.host.stop(p.pane_id).catch(function () { })];
                    case 21:
                        _j.sent();
                        _j.label = 22;
                    case 22:
                        _i++;
                        return [3 /*break*/, 20];
                    case 23: return [4 /*yield*/, this.host.focus(session.paneID)];
                    case 24:
                        _j.sent();
                        _j.label = 25;
                    case 25: return [3 /*break*/, 31];
                    case 26:
                        error_5 = _j.sent();
                        if (!(windowMode === "auto")) return [3 /*break*/, 27];
                        // No display, a stale DISPLAY, or a transient first-run attach
                        // failure: the pane is real and the model can keep using it, so
                        // degrade to windowless instead of rolling the start back. The
                        // timeline fact is the trace until Open terminal attaches a window.
                        this.audit(session, "started", "model");
                        return [3 /*break*/, 30];
                    case 27:
                        // Explicit `window`: the attach was required. A half-started
                        // session must not linger as "running": remove it and kill the
                        // pane so the next list/observe is consistent and a retry starts
                        // clean.
                        this.sessions.delete(session.id);
                        return [4 /*yield*/, this.host.stop(session.paneID).catch(function () { return undefined; })];
                    case 28:
                        _j.sent();
                        return [4 /*yield*/, this.persistSessions().catch(function () { return undefined; })];
                    case 29:
                        _j.sent();
                        throw error_5;
                    case 30: return [3 /*break*/, 31];
                    case 31: return [3 /*break*/, 33];
                    case 32:
                        // Windowless mode, or a start from a background session: the pane is
                        // real but windowless; the human opens it with Open terminal. The
                        // timeline fact is the only trace until then.
                        this.audit(session, "started", "model");
                        _j.label = 33;
                    case 33: return [2 /*return*/, session];
                }
            });
        });
    };
    /** I3: only the active session's panes are visible to the model surface. */
    NativeTerminalRegistry.prototype.sessionVisible = function (session) {
        return (this.activeSession === undefined ||
            session.sessionID === this.activeSession);
    };
    NativeTerminalRegistry.prototype.list = function () {
        var _this = this;
        return __spreadArray([], this.sessions.values(), true).filter(function (session) {
            return _this.sessionVisible(session);
        });
    };
    NativeTerminalRegistry.prototype.loadPersistedSessions = function () {
        var _a, _b, _c, _d, _e;
        if (!this.options.persistPath)
            return;
        try {
            if (!(0, node_fs_1.existsSync)(this.options.persistPath))
                return;
            var data = JSON.parse((0, node_fs_1.readFileSync)(this.options.persistPath, "utf8"));
            if (!data || typeof data !== "object")
                return;
            var manifest = data;
            var sessions = manifest.sessions;
            if (!Array.isArray(sessions))
                return;
            for (var _i = 0, sessions_1 = sessions; _i < sessions_1.length; _i++) {
                var raw = sessions_1[_i];
                if (!raw || typeof raw !== "object")
                    continue;
                var paneID = raw.paneID;
                var session = __assign(__assign({ id: raw.id, sessionID: raw.sessionID }, (raw.agentID
                    ? { agentID: raw.agentID }
                    : {})), { host: "wezterm", paneID: typeof paneID === "number" ? paneID : 0, windowID: raw.windowID, muxWindowID: raw.muxWindowID, tabID: raw.tabID, command: (_a = raw.command) !== null && _a !== void 0 ? _a : "", cwd: (_b = raw.cwd) !== null && _b !== void 0 ? _b : "", startedAt: (_c = raw.startedAt) !== null && _c !== void 0 ? _c : new Date().toISOString(), revision: 0, inputOwner: (_d = raw
                        .inputOwner) !== null && _d !== void 0 ? _d : "model", geometryOwner: "human", secureInput: Boolean(raw.secureInput), status: (_e = raw
                        .status) !== null && _e !== void 0 ? _e : "exited", attached: Boolean(raw.attached), cursor_x: raw.cursor_x, cursor_y: raw.cursor_y, rows: raw.rows, cols: raw.cols });
                this.sessions.set(session.id, session);
            }
        }
        catch (_f) {
            // ignore corrupt manifest; empty sessions will be rebuilt on start
        }
    };
    NativeTerminalRegistry.prototype.persistSessions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.options.persistPath)
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(this.options.persistPath), { recursive: true })];
                    case 2:
                        _b.sent();
                        data = JSON.stringify({
                            sessions: Array.from(this.sessions.values()).map(function (s) { return (__assign(__assign({ id: s.id, sessionID: s.sessionID }, (s.agentID ? { agentID: s.agentID } : {})), { paneID: s.paneID, windowID: s.windowID, muxWindowID: s.muxWindowID, tabID: s.tabID, command: s.command, cwd: s.cwd, startedAt: s.startedAt, status: s.status, inputOwner: s.inputOwner, secureInput: s.secureInput, rows: s.rows, cols: s.cols, attached: s.attached, cursor_x: s.cursor_x, cursor_y: s.cursor_y })); }),
                            hub: this.hub,
                        });
                        return [4 /*yield*/, (0, promises_1.writeFile)(this.options.persistPath, data, { mode: 384 })];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _b.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.isHumanInputOwner = function (id) {
        return this.get(id).inputOwner === "human";
    };
    NativeTerminalRegistry.prototype.reconcile = function () {
        return __awaiter(this, arguments, void 0, function (options) {
            var _this = this;
            var _a;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!options.force && performance.now() - this.lastReconcileAt < 2000)
                            return [2 /*return*/, this.list()];
                        (_a = this.reconcileInFlight) !== null && _a !== void 0 ? _a : (this.reconcileInFlight = this.reconcileNow().finally(function () {
                            _this.reconcileInFlight = undefined;
                        }));
                        return [4 /*yield*/, this.reconcileInFlight];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.reconcileNow = function () {
        return __awaiter(this, void 0, void 0, function () {
            var panes, error_6, muxAlive, _a, _i, _b, session, paneMap, attached, _c, _d, _e, session, pane;
            var _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0:
                        _p.trys.push([0, 2, , 10]);
                        return [4 /*yield*/, this.host.list()];
                    case 1:
                        panes = _p.sent();
                        return [3 /*break*/, 10];
                    case 2:
                        error_6 = _p.sent();
                        muxAlive = true;
                        _p.label = 3;
                    case 3:
                        _p.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, ((_g = (_f = this.host).isAlive) === null || _g === void 0 ? void 0 : _g.call(_f))];
                    case 4:
                        muxAlive = _p.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _a = _p.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        if (!(muxAlive === false)) return [3 /*break*/, 9];
                        return [4 /*yield*/, ((_j = (_h = this.host).resetMuxReady) === null || _j === void 0 ? void 0 : _j.call(_h))];
                    case 7:
                        _p.sent();
                        for (_i = 0, _b = this.sessions.values(); _i < _b.length; _i++) {
                            session = _b[_i];
                            if (session.status !== "exited") {
                                session.status = "exited";
                                session.attached = false;
                                session.revision += 1;
                                this.notifyRevision(session.id);
                                this.audit(session, "exit", "system");
                            }
                        }
                        return [4 /*yield*/, this.persistSessions()];
                    case 8:
                        _p.sent();
                        return [2 /*return*/, this.list()];
                    case 9: throw error_6;
                    case 10:
                        paneMap = new Map(panes.map(function (pane) { return [pane.pane_id, pane]; }));
                        _c = Set.bind;
                        return [4 /*yield*/, ((_l = (_k = this.host).listClients) === null || _l === void 0 ? void 0 : _l.call(_k))];
                    case 11:
                        attached = new (_c.apply(Set, [void 0, (_o = (_m = (_p.sent())) === null || _m === void 0 ? void 0 : _m.map(function (client) { return client.focused_pane_id; })) !== null && _o !== void 0 ? _o : []]))();
                        this.lastReconcileAt = performance.now();
                        for (_d = 0, _e = this.sessions.values(); _d < _e.length; _d++) {
                            session = _e[_d];
                            pane = paneMap.get(session.paneID);
                            if (!pane) {
                                if (session.status !== "exited") {
                                    session.revision += 1;
                                    this.notifyRevision(session.id);
                                    this.audit(session, "exit", "system");
                                }
                                session.status = "exited";
                                session.attached = false;
                                session.mayWaitForHuman = false;
                                continue;
                            }
                            session.rows = pane.rows;
                            session.cols = pane.cols;
                            session.cursor_x = pane.cursor_x;
                            session.cursor_y = pane.cursor_y;
                            session.attached = attached.has(session.paneID);
                            session.mayWaitForHuman = this.deriveMayWaitForHuman(session);
                        }
                        return [4 /*yield*/, this.persistSessions()];
                    case 12:
                        _p.sent();
                        return [2 /*return*/, this.list()];
                }
            });
        });
    };
    /**
     * TERM-M.3 route 3: the conservative weak fact. The model wrote, the pane
     * produced output after that write, that output was the last activity, and
     * the pane has been silent for the grace period. Deliberately no content
     * inspection: a long-running computation also reads true, which is why the
     * fact says "may".
     */
    NativeTerminalRegistry.prototype.deriveMayWaitForHuman = function (session) {
        var _a;
        if (session.status !== "running")
            return false;
        if (session.inputOwner !== "model")
            return false;
        var lastModelWriteAt = session.lastModelWriteAt;
        var lastOutputAt = session.lastOutputAt;
        if (!lastModelWriteAt || !lastOutputAt)
            return false;
        // Output found at or after the model's write counts; a strict `<=` would
        // make the fact depend on millisecond ordering between the write and the
        // read that discovers the output.
        if (lastOutputAt < lastModelWriteAt)
            return false;
        var graceMs = (_a = this.options.mayWaitGraceMs) !== null && _a !== void 0 ? _a : 15000;
        return Date.now() - lastOutputAt >= graceMs;
    };
    NativeTerminalRegistry.prototype.read = function (id, options) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        session = this.get(id);
                        this.assertSessionOwner(session, options === null || options === void 0 ? void 0 : options.sessionID);
                        return [4 /*yield*/, this.reconcile()];
                    case 1:
                        _a.sent();
                        this.assertReadable(session);
                        return [4 /*yield*/, this.readSession(session, options)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.snapshot = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var session, _a, text, highlightRanges;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        session = this.get(id);
                        return [4 /*yield*/, this.reconcile()];
                    case 1:
                        _f.sent();
                        this.assertReadable(session);
                        return [4 /*yield*/, this.readSession(session)];
                    case 2:
                        _a = _f.sent(), text = _a.text, highlightRanges = _a.highlightRanges;
                        return [2 /*return*/, {
                                text: text,
                                cursorX: (_b = session.cursor_x) !== null && _b !== void 0 ? _b : 0,
                                cursorY: (_c = session.cursor_y) !== null && _c !== void 0 ? _c : 0,
                                rows: (_d = session.rows) !== null && _d !== void 0 ? _d : 0,
                                cols: (_e = session.cols) !== null && _e !== void 0 ? _e : 0,
                                revision: session.revision,
                                status: session.status,
                                inputOwner: session.inputOwner,
                                highlightRanges: highlightRanges,
                            }];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.write = function (id_1, data_1) {
        return __awaiter(this, arguments, void 0, function (id, data, options) {
            var session, writtenBytes, keys, previous_1, previous, cancelled, delivery, error_7;
            var _this = this;
            var _a, _b, _c, _d;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        session = this.get(id);
                        this.assertSessionOwner(session, options.sessionID);
                        return [4 /*yield*/, this.reconcile()];
                    case 1:
                        _e.sent();
                        this.assertRunning(session);
                        if (session.inputOwner !== "model")
                            throw new Error("terminal input is controlled by a human");
                        if (session.secureInput)
                            throw new Error("terminal is accepting secure human input");
                        writtenBytes = new TextEncoder().encode(data).byteLength;
                        if (options.idempotencyKey) {
                            keys = (_a = this.idempotency.get(id)) !== null && _a !== void 0 ? _a : new Map();
                            previous_1 = keys.get(options.idempotencyKey);
                            if (previous_1 !== undefined) {
                                if (previous_1 !== data)
                                    throw new Error("terminal idempotency key was reused with different input");
                                return [2 /*return*/, { writtenBytes: writtenBytes, delivery: "duplicate" }];
                            }
                            keys.set(options.idempotencyKey, data);
                            this.idempotency.set(id, keys);
                            while (keys.size > 256)
                                keys.delete(keys.keys().next().value);
                        }
                        previous = (_b = this.modelWrites.get(id)) !== null && _b !== void 0 ? _b : Promise.resolve();
                        cancelled = false;
                        delivery = previous.then(function () { return __awaiter(_this, void 0, void 0, function () {
                            var _i, _a, chunk;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _i = 0, _a = modelInputChunks(data);
                                        _b.label = 1;
                                    case 1:
                                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                                        chunk = _a[_i];
                                        if (session.inputOwner !== "model") {
                                            cancelled = true;
                                            return [2 /*return*/];
                                        }
                                        return [4 /*yield*/, this.host.write(session.paneID, chunk)];
                                    case 2:
                                        _b.sent();
                                        _b.label = 3;
                                    case 3:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); });
                        this.modelWrites.set(id, delivery.catch(function () { return undefined; }));
                        _e.label = 2;
                    case 2:
                        _e.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, delivery];
                    case 3:
                        _e.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_7 = _e.sent();
                        if (options.idempotencyKey)
                            (_c = this.idempotency.get(id)) === null || _c === void 0 ? void 0 : _c.delete(options.idempotencyKey);
                        throw error_7;
                    case 5:
                        if (cancelled) {
                            if (options.idempotencyKey)
                                (_d = this.idempotency.get(id)) === null || _d === void 0 ? void 0 : _d.delete(options.idempotencyKey);
                            return [2 /*return*/, { writtenBytes: writtenBytes, delivery: "cancelled" }];
                        }
                        session.revision += 1;
                        session.lastModelWriteAt = Date.now();
                        this.audit(session, "write", "model");
                        this.notifyRevision(session.id);
                        return [2 /*return*/, { writtenBytes: writtenBytes, delivery: "accepted" }];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.openHub = function () {
        return __awaiter(this, void 0, void 0, function () {
            var firstSession;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!!this.hub) return [3 /*break*/, 2];
                        firstSession = this.list().find(function (session) { return session.status === "running"; });
                        if (!firstSession)
                            throw new Error("no running native terminal session");
                        return [4 /*yield*/, this.attachToHub(firstSession, true, false)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/, this.hub];
                    case 2: return [4 /*yield*/, ((_b = (_a = this.host).openHub) === null || _b === void 0 ? void 0 : _b.call(_a))];
                    case 3:
                        _c.sent();
                        return [2 /*return*/, this.hub];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.cleanupStalePanes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var known, hubWindowID, _i, _a, pane;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.host.list || !this.host.stop)
                            return [2 /*return*/];
                        known = new Set(this.sessions.values().map(function (session) { return session.paneID; }));
                        hubWindowID = (_b = this.hub) === null || _b === void 0 ? void 0 : _b.muxWindowID;
                        _i = 0;
                        return [4 /*yield*/, this.host.list()];
                    case 1:
                        _a = _c.sent();
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        pane = _a[_i];
                        if (!(!known.has(pane.pane_id) && pane.window_id !== hubWindowID)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.host.stop(pane.pane_id)];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.attachToHub = function (session_1, launch_1) {
        return __awaiter(this, arguments, void 0, function (session, launch, selectTarget) {
            var environment, pane, error_8;
            var _a;
            if (selectTarget === void 0) { selectTarget = false; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.host.open)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, this.cleanupStalePanes()];
                    case 1:
                        _b.sent();
                        environment = this.humanInputBridge
                            ? {
                                NATALIA_NATIVE_INPUT_ENDPOINT: this.humanInputBridge.endpoint,
                                NATALIA_NATIVE_INPUT_TOKEN: this.humanInputBridge.token,
                            }
                            : undefined;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 8]);
                        return [4 /*yield*/, this.host.open(session.paneID, {
                                environment: environment,
                                muxWindowID: (_a = this.hub) === null || _a === void 0 ? void 0 : _a.muxWindowID,
                                launch: launch,
                                discardBootstrapPanes: this.hub === undefined,
                            })];
                    case 3:
                        pane = _b.sent();
                        return [3 /*break*/, 8];
                    case 4:
                        error_8 = _b.sent();
                        if (!(this.hub &&
                            error_8 instanceof Error &&
                            /window.*not found|not found.*window|not found on this server/i.test(error_8.message))) return [3 /*break*/, 6];
                        this.hub = undefined;
                        return [4 /*yield*/, this.host.open(session.paneID, {
                                environment: environment,
                                muxWindowID: undefined,
                                launch: launch,
                                discardBootstrapPanes: true,
                            })];
                    case 5:
                        pane = _b.sent();
                        return [3 /*break*/, 7];
                    case 6: throw error_8;
                    case 7: return [3 /*break*/, 8];
                    case 8:
                        if (!this.hub)
                            this.hub = { workspace: "natalia", muxWindowID: pane.window_id };
                        session.windowID = pane.window_id;
                        session.muxWindowID = pane.window_id;
                        session.tabID = pane.tab_id;
                        session.rows = pane.rows;
                        session.cols = pane.cols;
                        if (!(selectTarget && this.hub)) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.host.focus(session.paneID)];
                    case 9:
                        _b.sent();
                        _b.label = 10;
                    case 10: return [2 /*return*/, pane];
                }
            });
        });
    };
    /**
     * Refuses an action that would disturb a human who is entering a secret.
     *
     * `secureInput` already guarantees the bytes are never seen by us — the native
     * host writes them through its own path. It did not guarantee the *surroundings*:
     * a pane appearing, a pane dying or a resize all re-lay out the multiplexer window
     * the human is typing into, which can move the prompt, redraw over it, or steal
     * the focus mid-password.
     *
     * Writing to another pane is deliberately still allowed: it changes no layout, and
     * refusing all model output during a password prompt would stall unrelated work.
     */
    NativeTerminalRegistry.prototype.assertNoHumanSecureInput = function (action, actor) {
        if (actor !== "model")
            return;
        var holder = this.list().find(function (session) { return session.secureInput && session.inputOwner === "human"; });
        if (holder)
            throw new Error("".concat(action, " refused while a human is entering secure input on terminal ").concat(holder.id));
    };
    NativeTerminalRegistry.prototype.claimHumanInput = function (id, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        session = this.get(id);
                        this.assertSessionOwner(session, sessionID);
                        this.assertRunning(session);
                        if (session.secureInput && session.inputOwner !== "human")
                            throw new Error("secure input requires human terminal control");
                        // The host claims before every native pane write. Only the first accepted
                        // claim is an ownership transition; subsequent human keystrokes must not
                        // churn revisions, audit events, or the TUI timeline.
                        if (session.inputOwner === "human")
                            return [2 /*return*/, session];
                        // A native host retains and writes the bytes through its original pane path
                        // after this synchronous ownership transition. Natalia never sees them.
                        session.inputOwner = "human";
                        session.revision += 1;
                        this.notifyRevision(session.id);
                        return [4 /*yield*/, this.reconcile()];
                    case 1:
                        _a.sent();
                        this.assertRunning(session);
                        this.audit(session, "write", "human", session.secureInput);
                        return [2 /*return*/, session];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.attach = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        session = this.get(id);
                        this.assertRunning(session);
                        return [4 /*yield*/, this.openHub()];
                    case 1:
                        _a.sent();
                        this.audit(session, "attach", "human");
                        return [2 /*return*/, session];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.detach = function (id) {
        var session = this.get(id);
        if (session.secureInput)
            throw new Error("secure input must end before detaching");
        session.inputOwner = "model";
        session.revision += 1;
        this.notifyRevision(session.id);
        this.audit(session, "detach", "human");
        return session;
    };
    NativeTerminalRegistry.prototype.releaseHumanControl = function (id, sessionID) {
        var session = this.get(id);
        this.assertSessionOwner(session, sessionID);
        if (session.secureInput)
            throw new Error("secure input must end before returning control to model");
        session.inputOwner = "model";
        session.revision += 1;
        this.notifyRevision(session.id);
        this.audit(session, "detach", "human");
        return session;
    };
    NativeTerminalRegistry.prototype.beginSecureInput = function (id, sessionID) {
        var session = this.get(id);
        this.assertSessionOwner(session, sessionID);
        this.assertRunning(session);
        if (session.inputOwner !== "human")
            throw new Error("secure input requires human terminal control");
        session.secureInput = true;
        session.revision += 1;
        this.notifyRevision(session.id);
        this.audit(session, "secure_input", "human");
        return session;
    };
    NativeTerminalRegistry.prototype.endSecureInput = function (id, sessionID) {
        var session = this.get(id);
        this.assertSessionOwner(session, sessionID);
        session.secureInput = false;
        session.revision += 1;
        this.notifyRevision(session.id);
        this.audit(session, "secure_input", "human");
        return session;
    };
    NativeTerminalRegistry.prototype.observe = function (id_1, afterRevision_1) {
        return __awaiter(this, arguments, void 0, function (id, afterRevision, options) {
            var session, timeoutMs, deadline, revisionBeforeRead, _a, text, cursorX, cursorY, rows, cols, highlightRanges;
            var _b, _c, _d, _e, _f;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        session = this.get(id);
                        timeoutMs = Math.max(1, Math.min((_b = options.timeoutMs) !== null && _b !== void 0 ? _b : 5000, 30000));
                        deadline = performance.now() + timeoutMs;
                        _g.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.reconcile()];
                    case 2:
                        _g.sent();
                        if (session.status === "exited")
                            return [2 /*return*/, {
                                    session: session,
                                    text: "",
                                    cursorX: (_c = session.cursor_x) !== null && _c !== void 0 ? _c : 0,
                                    cursorY: (_d = session.cursor_y) !== null && _d !== void 0 ? _d : 0,
                                    rows: (_e = session.rows) !== null && _e !== void 0 ? _e : 0,
                                    cols: (_f = session.cols) !== null && _f !== void 0 ? _f : 0,
                                    highlightRanges: [],
                                    afterRevision: afterRevision,
                                    changed: session.revision > afterRevision,
                                    reason: "exited",
                                    exited: true,
                                }];
                        revisionBeforeRead = session.revision;
                        return [4 /*yield*/, this.readSession(session, { maxLines: options.maxLines })];
                    case 3:
                        _a = _g.sent(), text = _a.text, cursorX = _a.cursorX, cursorY = _a.cursorY, rows = _a.rows, cols = _a.cols, highlightRanges = _a.highlightRanges;
                        if (session.revision > afterRevision)
                            return [2 /*return*/, {
                                    session: session,
                                    text: text,
                                    cursorX: cursorX,
                                    cursorY: cursorY,
                                    rows: rows,
                                    cols: cols,
                                    highlightRanges: highlightRanges,
                                    afterRevision: afterRevision,
                                    changed: true,
                                    reason: session.revision > revisionBeforeRead
                                        ? "screen_changed"
                                        : "session_activity",
                                }];
                        if (performance.now() >= deadline)
                            return [2 /*return*/, {
                                    session: session,
                                    text: text,
                                    cursorX: cursorX,
                                    cursorY: cursorY,
                                    rows: rows,
                                    cols: cols,
                                    highlightRanges: highlightRanges,
                                    afterRevision: afterRevision,
                                    changed: false,
                                    reason: "timeout",
                                }];
                        return [4 /*yield*/, this.waitForRevision(session.id, Math.max(10, Math.min(500, deadline - performance.now())))];
                    case 4:
                        _g.sent();
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Resizes a pane on behalf of `actor`.
     *
     * The actor is passed in rather than assumed. It used to be recorded as `human`
     * unconditionally while the only caller was the model's resize tool, so every
     * model-driven resize appeared in the audit trail as something a person did —
     * an audit that answers "who did this" wrongly is worse than one that says
     * nothing.
     *
     * The check this replaces (`geometryOwner !== "human"`) could never fire:
     * `geometryOwner` is typed as the literal `"human"` and only ever assigned it. A
     * guard that cannot run reads like protection while providing none. If geometry
     * ownership should actually restrict the model, that is a product decision and
     * has to be modelled as a transition like `inputOwner` is, not as a constant.
     */
    NativeTerminalRegistry.prototype.resize = function (id_1, rows_1, cols_1) {
        return __awaiter(this, arguments, void 0, function (id, rows, cols, actor, sessionID) {
            var session;
            if (actor === void 0) { actor = "model"; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        session = this.get(id);
                        this.assertSessionOwner(session, sessionID);
                        return [4 /*yield*/, this.reconcile()];
                    case 1:
                        _a.sent();
                        this.assertRunning(session);
                        this.assertNoHumanSecureInput("resizing a terminal", actor);
                        if (!Number.isInteger(rows) || rows < 1 || rows > 500)
                            throw new Error("terminal rows must be an integer between 1 and 500");
                        if (!Number.isInteger(cols) || cols < 1 || cols > 500)
                            throw new Error("terminal cols must be an integer between 1 and 500");
                        return [4 /*yield*/, this.host.resize(session.paneID, rows, cols)];
                    case 2:
                        _a.sent();
                        session.rows = rows;
                        session.cols = cols;
                        session.revision += 1;
                        this.notifyRevision(session.id);
                        this.audit(session, "resize", actor);
                        return [2 /*return*/, session];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.stop = function (id_1) {
        return __awaiter(this, arguments, void 0, function (id, actor, sessionID) {
            var session, _a;
            if (actor === void 0) { actor = "system"; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        session = this.get(id);
                        this.assertSessionOwner(session, sessionID);
                        this.assertNoHumanSecureInput("stopping a terminal", actor === "system" ? "human" : actor);
                        if (!(session.status === "running")) return [3 /*break*/, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.host.stop(session.paneID)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        session.status = "exited";
                        session.revision += 1;
                        session.attached = false;
                        this.notifyRevision(session.id);
                        this.idempotency.delete(id);
                        this.modelWrites.delete(id);
                        this.audit(session, "exit", actor);
                        return [4 /*yield*/, this.persistSessions()];
                    case 5:
                        _b.sent();
                        return [2 /*return*/, session];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.stopForSession = function (sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var owned;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        owned = __spreadArray([], this.sessions.values(), true).filter(function (session) {
                            return session.sessionID === sessionID && session.status === "running";
                        });
                        return [4 /*yield*/, Promise.allSettled(owned.map(function (session) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.stop(session.id, "system")];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * TERM-M.3 route 2: the model explicitly declares that a pane needs a
     * human. Publishes the request as an audit fact and returns immediately —
     * the model is expected to go do something else and observe later (the (b)
     * semantics). `reason` is a fact that may reach the journal, so it is
     * bounded and must describe the kind of input needed, never screen content,
     * file content, or anything that looks like a secret.
     */
    NativeTerminalRegistry.prototype.requestHuman = function (id, reason, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = this.get(id);
                this.assertSessionOwner(session, sessionID);
                this.assertRunning(session);
                if (typeof reason !== "string" || reason.length === 0)
                    throw new Error("request_human requires a reason");
                if (reason.length > 240)
                    throw new Error("request_human reason must be 240 characters or fewer; describe the kind of input needed, never screen content or secrets");
                this.audit(session, "request_human", "model", undefined, reason);
                return [2 /*return*/, session];
            });
        });
    };
    NativeTerminalRegistry.prototype.dispose = function () {
        return __awaiter(this, void 0, void 0, function () {
            var running;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        running = __spreadArray([], this.sessions.values(), true).filter(function (session) { return session.status === "running"; });
                        return [4 /*yield*/, Promise.allSettled(running.map(function (session) { return _this.stop(session.id); }))];
                    case 1:
                        _c.sent();
                        return [4 /*yield*/, this.persistSessions()];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, ((_b = (_a = this.host).dispose) === null || _b === void 0 ? void 0 : _b.call(_a))];
                    case 3:
                        _c.sent();
                        this.sessions.clear();
                        this.modelWrites.clear();
                        this.idempotency.clear();
                        this.revisionWaiters.clear();
                        this.hub = undefined;
                        return [2 /*return*/];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.session = function (id) {
        return this.get(id);
    };
    /**
     * Terminal device backing a pane. The runtime uses it to confirm which program
     * is actually in the foreground, instead of inferring that from the screen.
     */
    NativeTerminalRegistry.prototype.ttyName = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var session, panes;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        session = this.get(id);
                        return [4 /*yield*/, this.host.list()];
                    case 1:
                        panes = _b.sent();
                        return [2 /*return*/, (_a = panes.find(function (pane) { return pane.pane_id === session.paneID; })) === null || _a === void 0 ? void 0 : _a.tty_name];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.markObserved = function (id, text, revision) {
        var session = this.get(id);
        session.lastObservedText = text;
        session.lastObservedRevision = revision;
    };
    NativeTerminalRegistry.prototype.get = function (id) {
        var session = this.sessions.get(id);
        // I3: a pane that exists but belongs to another session is indistinguishable
        // from an unknown id, so cross-session probing cannot even learn existence.
        if (!session || !this.sessionVisible(session))
            throw new Error("native terminal session not found: ".concat(id));
        return session;
    };
    NativeTerminalRegistry.prototype.readSession = function (session, options) {
        return __awaiter(this, void 0, void 0, function () {
            var paneID, text, selectionJson, highlightsJson, error_9, msg, highlightRanges, parsedSelection, selection, _i, _a, r, parsedHighlights, highlights, _b, _c, r;
            var _d;
            var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            return __generator(this, function (_s) {
                switch (_s.label) {
                    case 0:
                        paneID = session.paneID;
                        _s.label = 1;
                    case 1:
                        _s.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.all([
                                this.host.read(paneID, options),
                                this.host.read(paneID, { format: "selection" }),
                                this.host.read(paneID, { format: "highlights" }),
                            ])];
                    case 2:
                        _d = _s.sent(), text = _d[0], selectionJson = _d[1], highlightsJson = _d[2];
                        return [3 /*break*/, 4];
                    case 3:
                        error_9 = _s.sent();
                        msg = error_9 instanceof Error ? error_9.message : String(error_9);
                        if (/pane.*(?:not found|doesn.t exist|unavailable)|window.*(?:not found|doesn.t exist)/i.test(msg)) {
                            session.status = "exited";
                            session.attached = false;
                            session.revision += 1;
                            this.notifyRevision(session.id);
                            return [2 /*return*/, {
                                    text: "",
                                    cursorX: 0,
                                    cursorY: 0,
                                    rows: 1,
                                    cols: 80,
                                    highlightRanges: [],
                                }];
                        }
                        throw error_9;
                    case 4:
                        if (text !== session.lastText) {
                            session.lastText = text;
                            session.revision += 1;
                            // The pane produced output after the model's last write: this is the
                            // timestamp the TERM-M.3 route-3 weak fact keys on.
                            session.lastOutputAt = Date.now();
                            this.notifyRevision(session.id);
                        }
                        highlightRanges = [];
                        try {
                            parsedSelection = JSON.parse(selectionJson);
                            selection = parsedSelection.selection;
                            if (selection && Array.isArray(selection.ranges)) {
                                for (_i = 0, _a = selection.ranges; _i < _a.length; _i++) {
                                    r = _a[_i];
                                    highlightRanges.push({
                                        startRow: (_e = Number(r.startRow)) !== null && _e !== void 0 ? _e : 0,
                                        startCol: (_f = Number(r.startCol)) !== null && _f !== void 0 ? _f : 0,
                                        endRow: (_g = Number(r.endRow)) !== null && _g !== void 0 ? _g : 0,
                                        endCol: (_h = Number(r.endCol)) !== null && _h !== void 0 ? _h : 0,
                                    });
                                }
                            }
                        }
                        catch (_t) {
                            // ignore parse errors
                        }
                        try {
                            parsedHighlights = JSON.parse(highlightsJson);
                            highlights = parsedHighlights.highlights;
                            if (highlights && Array.isArray(highlights.ranges)) {
                                for (_b = 0, _c = highlights.ranges; _b < _c.length; _b++) {
                                    r = _c[_b];
                                    highlightRanges.push({
                                        startRow: (_j = Number(r.startRow)) !== null && _j !== void 0 ? _j : 0,
                                        startCol: (_k = Number(r.startCol)) !== null && _k !== void 0 ? _k : 0,
                                        endRow: (_l = Number(r.endRow)) !== null && _l !== void 0 ? _l : 0,
                                        endCol: (_m = Number(r.endCol)) !== null && _m !== void 0 ? _m : 0,
                                    });
                                }
                            }
                        }
                        catch (_u) {
                            // ignore parse errors
                        }
                        return [2 /*return*/, {
                                text: text,
                                cursorX: (_o = session.cursor_x) !== null && _o !== void 0 ? _o : 0,
                                cursorY: (_p = session.cursor_y) !== null && _p !== void 0 ? _p : 0,
                                rows: (_q = session.rows) !== null && _q !== void 0 ? _q : 0,
                                cols: (_r = session.cols) !== null && _r !== void 0 ? _r : 0,
                                highlightRanges: highlightRanges,
                            }];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.assertRunning = function (session) {
        if (session.status !== "running")
            throw new Error("terminal session has exited");
    };
    NativeTerminalRegistry.prototype.waitForRevision = function (id, timeoutMs) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve) {
                            var _a;
                            var waiters = (_a = _this.revisionWaiters.get(id)) !== null && _a !== void 0 ? _a : new Set();
                            var wake = function () {
                                clearTimeout(timer);
                                waiters.delete(wake);
                                if (!waiters.size)
                                    _this.revisionWaiters.delete(id);
                                resolve();
                            };
                            var timer = setTimeout(wake, timeoutMs);
                            waiters.add(wake);
                            _this.revisionWaiters.set(id, waiters);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NativeTerminalRegistry.prototype.notifyRevision = function (id) {
        var _a;
        for (var _i = 0, _b = (_a = this.revisionWaiters.get(id)) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
            var wake = _b[_i];
            wake();
        }
    };
    NativeTerminalRegistry.prototype.assertReadable = function (session) {
        this.assertRunning(session);
        if (session.secureInput)
            throw new Error("terminal output is hidden during secure human input");
    };
    NativeTerminalRegistry.prototype.audit = function (session, action, actor, redacted, detail) {
        var _a, _b;
        if (redacted === void 0) { redacted = false; }
        (_b = (_a = this.options).onAudit) === null || _b === void 0 ? void 0 : _b.call(_a, {
            id: session.id,
            sessionID: session.sessionID,
            cwd: session.cwd,
            action: action,
            actor: actor,
            at: new Date().toISOString(),
            redacted: action === "write" ? redacted : undefined,
            detail: detail,
        });
    };
    return NativeTerminalRegistry;
}());
exports.NativeTerminalRegistry = NativeTerminalRegistry;
function modelInputChunks(data) {
    // Each chunk starts a `wezterm cli send-text` process. Avoid a process spawn
    // per handful of characters while still bounding a single command payload.
    var characters = __spreadArray([], data, true);
    var chunks = [];
    for (var index = 0; index < characters.length; index += 1024)
        chunks.push(characters.slice(index, index + 1024).join(""));
    return chunks;
}
function parsePane(value) {
    if (!value || typeof value !== "object")
        throw new Error("WezTerm returned an invalid pane entry");
    var pane = value;
    for (var _i = 0, _a = ["pane_id", "window_id", "tab_id"]; _i < _a.length; _i++) {
        var field = _a[_i];
        if (!Number.isSafeInteger(pane[field]))
            throw new Error("WezTerm pane is missing numeric ".concat(field));
    }
    return {
        pane_id: pane.pane_id,
        window_id: pane.window_id,
        tab_id: pane.tab_id,
        title: typeof pane.title === "string" ? pane.title : undefined,
        cwd: typeof pane.cwd === "string" ? pane.cwd : undefined,
        cursor_x: typeof pane.cursor_x === "number" ? pane.cursor_x : undefined,
        cursor_y: typeof pane.cursor_y === "number" ? pane.cursor_y : undefined,
        is_active: typeof pane.is_active === "boolean" ? pane.is_active : undefined,
        tty_name: typeof pane.tty_name === "string" ? pane.tty_name : undefined,
        rows: typeof pane.size === "object" &&
            pane.size !== null &&
            typeof pane.size.rows === "number"
            ? pane.size.rows
            : undefined,
        cols: typeof pane.size === "object" &&
            pane.size !== null &&
            typeof pane.size.cols === "number"
            ? pane.size.cols
            : undefined,
    };
}
function runWezTermCommand(executable_1, args_1, stdin_1, environment_1) {
    return __awaiter(this, arguments, void 0, function (executable, args, stdin, environment, timeoutMs) {
        var worker;
        if (timeoutMs === void 0) { timeoutMs = 5000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    worker = new node_worker_threads_1.Worker(new URL(import.meta.url.endsWith(".ts")
                        ? "./wezterm-command-worker.ts"
                        : "./wezterm-command-worker.js", import.meta.url), {
                        workerData: { executable: executable, args: args, stdin: stdin, environment: environment },
                    });
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var settled = false;
                            var finish = function (result) {
                                if (settled)
                                    return;
                                settled = true;
                                clearTimeout(timeout);
                                void worker.terminate();
                                result();
                            };
                            var timeout = setTimeout(function () {
                                finish(function () {
                                    return reject(new Error("WezTerm command timed out after ".concat(timeoutMs, "ms: ").concat(args.join(" "))));
                                });
                            }, timeoutMs);
                            var workerEvents = worker;
                            workerEvents.once("message", function (message) {
                                var result = message;
                                if (typeof result.error === "string") {
                                    var errorMessage_1 = result.error;
                                    return finish(function () { return reject(new Error(errorMessage_1)); });
                                }
                                if (typeof result.stdout !== "string" ||
                                    typeof result.stderr !== "string" ||
                                    typeof result.exitCode !== "number")
                                    return finish(function () {
                                        return reject(new Error("invalid WezTerm command response"));
                                    });
                                var stdout = result.stdout;
                                var stderr = result.stderr;
                                var exitCode = result.exitCode;
                                finish(function () {
                                    return resolve({
                                        stdout: stdout,
                                        stderr: stderr,
                                        exitCode: exitCode,
                                    });
                                });
                            });
                            workerEvents.once("error", function (error) { return finish(function () { return reject(error); }); });
                            workerEvents.once("exit", function (code) {
                                if (code !== 0)
                                    finish(function () {
                                        return reject(new Error("WezTerm command worker exited: ".concat(code)));
                                    });
                            });
                        })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function launchWezTermGUI(executable, args, environment) {
    return __awaiter(this, void 0, void 0, function () {
        var env, _i, _a, _b, key, value, child;
        return __generator(this, function (_c) {
            env = __assign({}, process.env);
            for (_i = 0, _a = Object.entries(environment !== null && environment !== void 0 ? environment : {}); _i < _a.length; _i++) {
                _b = _a[_i], key = _b[0], value = _b[1];
                if (value === undefined)
                    delete env[key];
                else
                    env[key] = value;
            }
            child = Bun.spawn({
                cmd: __spreadArray([executable], args, true),
                env: env,
                stdin: "ignore",
                stdout: "ignore",
                stderr: "ignore",
            });
            child.unref();
            return [2 /*return*/];
        });
    });
}
