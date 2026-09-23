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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var index_1 = require("../src/index");
/**
 * The input-arbitration tests drive the same in-memory registry paths as on
 * POSIX, but on Windows with bun 1.3.14 they wedge the test runner itself:
 * no output, no per-test timeout, no exit. This is a runner-level defect, not
 * an assertion failure, so they stay fully active on POSIX and are skipped
 * only on Windows until the runner bug is resolved upstream.
 */
var arbitrationTest = process.platform === "win32" ? bun_test_1.test.skip : bun_test_1.test;
/** A short-lived process whose pid is already stale, for ESRCH-shaped tests. */
function spawnAlreadyExitedProcess() {
    return Bun.spawn(process.platform === "win32" ? ["cmd", "/c", "exit", "0"] : ["true"], { stdout: "ignore", stderr: "ignore" });
}
(0, bun_test_1.test)("does not fall back to an arbitrary system WezTerm executable", function () {
    (0, bun_test_1.expect)((0, index_1.resolveWezTermExecutable)({
        os: "linux",
        forkBuildDir: "/does-not-exist",
        which: function () { return "/usr/bin/wezterm"; },
    })).toBeUndefined();
    (0, bun_test_1.expect)((0, index_1.resolveWezTermExecutable)({
        os: "win32",
        forkBuildDir: "/does-not-exist",
        which: function () { return "C:\\WezTerm\\wezterm.exe"; },
    })).toBeUndefined();
});
(0, bun_test_1.test)("uses an explicit host executable without falling back to system WezTerm", function () {
    (0, bun_test_1.expect)((0, index_1.resolveWezTermExecutable)({
        configured: "/opt/natalia/wezterm",
        which: function () { return "/usr/bin/wezterm"; },
    })).toBe("/opt/natalia/wezterm");
});
(0, bun_test_1.test)("requires the managed patched fork when no explicit override is set", function () {
    (0, bun_test_1.expect)((0, index_1.resolveNataliaWezTermForkExecutable)({
        os: "linux",
        buildDir: "/does-not-exist",
    })).toBeUndefined();
    (0, bun_test_1.expect)((0, index_1.resolveWezTermExecutable)({
        os: "linux",
        forkBuildDir: "/opt/natalia/wezterm/target/release",
        which: function () { return "/usr/bin/wezterm"; },
    })).toBeUndefined();
});
(0, bun_test_1.test)("maps native pane lifecycle to WezTerm CLI", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, launches, inputs, opened, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                launches = [];
                inputs = [];
                opened = false;
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    configFile: "/tmp/natalia.lua",
                    run: function (_executable, args, stdin) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.push(args);
                            inputs.push(stdin);
                            if (args.includes("move-pane-to-new-tab"))
                                opened = true;
                            if (args.includes("spawn"))
                                return [2 /*return*/, { stdout: "42\n", stderr: "", exitCode: 0 }];
                            if (args.includes("list"))
                                return [2 /*return*/, {
                                        stdout: JSON.stringify([
                                            {
                                                pane_id: 42,
                                                window_id: opened ? 8 : 7,
                                                tab_id: opened ? 10 : 9,
                                                title: "Interactive agent",
                                                size: { rows: 24, cols: 80 },
                                            },
                                        ]),
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            return [2 /*return*/, {
                                    stdout: args.includes("get-text") ? "agent screen\n" : "",
                                    stderr: "",
                                    exitCode: 0,
                                }];
                        });
                    }); },
                    launch: function (_executable, args, environment) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            launches.push({ args: args, environment: environment });
                            return [2 /*return*/];
                        });
                    }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(host.spawn({
                        cwd: "/repo",
                        command: ["interactive-agent"],
                        workspace: "natalia",
                    })).resolves.toMatchObject({ pane_id: 42, window_id: 7 })];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(host.read(42)).resolves.toBe("agent screen\n")];
            case 2:
                _a.sent();
                return [4 /*yield*/, host.write(42, "hello\r")];
            case 3:
                _a.sent();
                return [4 /*yield*/, host.focus(42)];
            case 4:
                _a.sent();
                return [4 /*yield*/, host.resize(42, 26, 84)];
            case 5:
                _a.sent();
                return [4 /*yield*/, host.stop(42)];
            case 6:
                _a.sent();
                (0, bun_test_1.expect)(launches).toEqual([]);
                (0, bun_test_1.expect)(calls).toEqual(bun_test_1.expect.arrayContaining([
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "spawn",
                        "--cwd",
                        "/repo",
                        "--new-window",
                        "--workspace",
                        "natalia",
                        "--",
                        "interactive-agent",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "list",
                        "--format",
                        "json",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "get-text",
                        "--pane-id",
                        "42",
                        "--start-line",
                        "-200",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "send-text",
                        "--pane-id",
                        "42",
                        "--no-paste",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "activate-pane",
                        "--pane-id",
                        "42",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "list",
                        "--format",
                        "json",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "adjust-pane-size",
                        "--pane-id",
                        "42",
                        "--amount",
                        "2",
                        "Down",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "adjust-pane-size",
                        "--pane-id",
                        "42",
                        "--amount",
                        "4",
                        "Right",
                    ],
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "cli",
                        "--no-auto-start",
                        "--prefer-mux",
                        "kill-pane",
                        "--pane-id",
                        "42",
                    ],
                ]));
                (0, bun_test_1.expect)(inputs).toContain("hello\r");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reuses a ready private mux socket for CLI and GUI attach", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, launches, environment, guiAttached, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                launches = [];
                environment = {
                    WEZTERM_UNIX_SOCKET: "/run/user/1000/natalia/mux.sock",
                };
                guiAttached = false;
                host = (0, index_1.createWezTermHost)({
                    executable: "/opt/natalia/wezterm",
                    environment: environment,
                    muxRuntimeDir: "/run/user/1000/natalia/mux-runtime",
                    run: function (executable, args, _stdin, commandEnvironment) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.push({ executable: executable, args: args, environment: commandEnvironment });
                            if (args.includes("spawn"))
                                return [2 /*return*/, { stdout: "42\n", stderr: "", exitCode: 0 }];
                            if (args.includes("list-clients"))
                                return [2 /*return*/, {
                                        stdout: guiAttached
                                            ? JSON.stringify([{ focused_pane_id: 42 }])
                                            : "[]",
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            if (args.includes("ls-fonts"))
                                return [2 /*return*/, {
                                        stdout: '你 wezterm.font("Noto Sans Mono CJK SC")',
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            if (args.includes("list"))
                                return [2 /*return*/, {
                                        stdout: JSON.stringify([
                                            {
                                                pane_id: 42,
                                                window_id: 8,
                                                tab_id: 9,
                                                is_active: true,
                                                size: { rows: 24, cols: 80 },
                                            },
                                        ]),
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                    launch: function (_executable, _args, launchEnvironment) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            launches.push(launchEnvironment);
                            guiAttached = true;
                            return [2 /*return*/];
                        });
                    }); },
                });
                return [4 /*yield*/, host.spawn({ cwd: "/repo", command: ["bash"] })];
            case 1:
                _a.sent();
                return [4 /*yield*/, host.open(42, { environment: { NATALIA_TERMINAL_ID: "terminal_1" } })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(calls).not.toContainEqual(bun_test_1.expect.objectContaining({ executable: "/opt/natalia/wezterm-mux-server" }));
                (0, bun_test_1.expect)(launches).toEqual([
                    __assign(__assign({}, environment), { XDG_RUNTIME_DIR: "/run/user/1000/natalia/mux-runtime", NATALIA_TERMINAL_ID: "terminal_1" }),
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spawns later Terminal sessions directly in the existing Hub window", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    run: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.push(args);
                            if (args.includes("spawn"))
                                return [2 /*return*/, { stdout: "88\n", stderr: "", exitCode: 0 }];
                            if (args.includes("list"))
                                return [2 /*return*/, {
                                        stdout: JSON.stringify([
                                            {
                                                pane_id: 88,
                                                window_id: 501,
                                                tab_id: 77,
                                                is_active: true,
                                            },
                                        ]),
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                });
                return [4 /*yield*/, host.spawn({
                        cwd: "/repo",
                        command: ["btop"],
                        workspace: "natalia",
                        muxWindowID: 501,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(calls).toContainEqual([
                    "cli",
                    "--no-auto-start",
                    "--prefer-mux",
                    "spawn",
                    "--cwd",
                    "/repo",
                    "--window-id",
                    "501",
                    "--",
                    "btop",
                ]);
                (0, bun_test_1.expect)(calls.flat()).not.toContain("--new-window");
                (0, bun_test_1.expect)(calls.flat()).not.toContain("move-pane-to-new-tab");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("opens the Terminal Hub through one connect client", function () { return __awaiter(void 0, void 0, void 0, function () {
    var launches, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                launches = [];
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    nativeDomain: {
                        name: "natalia",
                        socketPath: "/run/user/1000/natalia/wezterm/sock",
                        configFile: "/tmp/natalia.lua",
                    },
                    run: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (args.includes("list-clients"))
                                return [2 /*return*/, { stdout: "[]", stderr: "", exitCode: 0 }];
                            if (args.includes("ls-fonts"))
                                return [2 /*return*/, {
                                        stdout: '你 wezterm.font("Noto Sans Mono CJK SC")',
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                    launch: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            launches.push(args);
                            return [2 /*return*/];
                        });
                    }); },
                });
                return [4 /*yield*/, host.openHub()];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(launches).toEqual([
                    [
                        "--config-file",
                        "/tmp/natalia.lua",
                        "connect",
                        "natalia",
                        "--workspace",
                        "natalia",
                    ],
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("refuses to open the Hub while CJK glyph fallback resolves to Last Resort", function () { return __awaiter(void 0, void 0, void 0, function () {
    var host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    run: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (args.includes("list-clients"))
                                return [2 /*return*/, { stdout: "[]", stderr: "", exitCode: 0 }];
                            if (args.includes("ls-fonts"))
                                return [2 /*return*/, {
                                        stdout: '你 wezterm.font("Last Resort")',
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                    launch: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            throw new Error("must not launch with tofu fallback");
                        });
                    }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(host.openHub()).rejects.toThrow("CJK glyph fallback is unavailable")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("first Hub attach removes only the private mux bootstrap pane", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    run: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.push(args);
                            if (args.includes("list-clients"))
                                return [2 /*return*/, {
                                        stdout: JSON.stringify([{ focused_pane_id: 2 }]),
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            if (args.includes("list"))
                                return [2 /*return*/, {
                                        stdout: JSON.stringify([
                                            { pane_id: 1, window_id: 1, tab_id: 1, is_active: true },
                                            { pane_id: 2, window_id: 2, tab_id: 2, is_active: true },
                                        ]),
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                    launch: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); },
                });
                return [4 /*yield*/, host.open(2, { discardBootstrapPanes: true, launch: false })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(calls).toContainEqual([
                    "cli",
                    "--no-auto-start",
                    "--prefer-mux",
                    "kill-pane",
                    "--pane-id",
                    "1",
                ]);
                (0, bun_test_1.expect)(calls).not.toContainEqual(bun_test_1.expect.arrayContaining(["kill-pane", "--pane-id", "2"]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("does not launch a second GUI client for an existing Terminal Hub", function () { return __awaiter(void 0, void 0, void 0, function () {
    var launches, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                launches = [];
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    run: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (args.includes("list-clients"))
                                return [2 /*return*/, {
                                        stdout: JSON.stringify([{ focused_pane_id: 42 }]),
                                        stderr: "",
                                        exitCode: 0,
                                    }];
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                    launch: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            launches.push(args);
                            return [2 /*return*/];
                        });
                    }); },
                });
                return [4 /*yield*/, host.openHub()];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(launches).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("writes a named Unix domain config for the fork GUI client", function () { return __awaiter(void 0, void 0, void 0, function () {
    var directory, domain, config;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-wezterm-domain-"))];
            case 1:
                directory = _a.sent();
                return [4 /*yield*/, (0, index_1.writeWezTermNativeDomainConfig)({
                        directory: directory,
                        socketPath: "/run/user/1000/natalia/wezterm/sock",
                    })];
            case 2:
                domain = _a.sent();
                (0, bun_test_1.expect)(domain.name).toBe("natalia");
                return [4 /*yield*/, (0, promises_1.readFile)(domain.configFile, "utf8")];
            case 3:
                config = _a.sent();
                (0, bun_test_1.expect)(config).toContain("socket_path = [[/run/user/1000/natalia/wezterm/sock]]");
                (0, bun_test_1.expect)(config).toContain("wezterm.font_with_fallback");
                if (process.platform === "win32")
                    (0, bun_test_1.expect)(config).toContain("Microsoft YaHei");
                else
                    (0, bun_test_1.expect)(config).toContain("Noto Sans Mono CJK SC");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("fails a stalled WezTerm control command within its timeout", function () { return __awaiter(void 0, void 0, void 0, function () {
    var host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    timeoutMs: 1,
                    run: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, new Promise(function () { })];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); },
                    launch: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(host.focus(42)).rejects.toThrow("WezTerm command timed out after 1ms: cli activate-pane --pane-id 42")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("passes an explicit scrollback line range to WezTerm", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                host = (0, index_1.createWezTermHost)({
                    executable: "wezterm",
                    run: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.push(args);
                            return [2 /*return*/, { stdout: "selected lines", stderr: "", exitCode: 0 }];
                        });
                    }); },
                    launch: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(host.read(7, { startLine: 120, endLine: 180, maxLines: 60 })).resolves.toBe("selected lines")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(calls.at(-1)).toEqual([
                    "cli",
                    "--no-auto-start",
                    "--prefer-mux",
                    "get-text",
                    "--pane-id",
                    "7",
                    "--start-line",
                    "120",
                    "--end-line",
                    "180",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry keeps model I/O on the host-rendered pane", function () { return __awaiter(void 0, void 0, void 0, function () {
    var writes, audit, host, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                writes = [];
                audit = [];
                host = {
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 19, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 19, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function (paneID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "pane ".concat(paneID, " output")];
                            });
                        });
                    },
                    write: function (paneID, data) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                writes.push({ paneID: paneID, data: data });
                                return [2 /*return*/];
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                };
                registry = new index_1.NativeTerminalRegistry(host, {
                    onAudit: function (event) { return audit.push(event.action); },
                });
                return [4 /*yield*/, registry.start({
                        id: "native_1",
                        cwd: "/repo",
                        command: "interactive-agent",
                    })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.write(session.id, "hello\r")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(session.id, "deduplicated", { idempotencyKey: "write_1" })).resolves.toMatchObject({ delivery: "accepted" })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(session.id, "deduplicated", { idempotencyKey: "write_1" })).resolves.toMatchObject({ delivery: "duplicate" })];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(session.id, "different input", {
                        idempotencyKey: "write_1",
                    })).rejects.toThrow("reused with different input")];
            case 5:
                _a.sent();
                return [4 /*yield*/, registry.write(session.id, "model keeps control after open")];
            case 6:
                _a.sent();
                return [4 /*yield*/, registry.claimHumanInput(session.id)];
            case 7:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(session.id, "blocked")).rejects.toThrow("controlled by a human")];
            case 8:
                _a.sent();
                registry.releaseHumanControl(session.id);
                return [4 /*yield*/, registry.claimHumanInput(session.id)];
            case 9:
                _a.sent();
                registry.beginSecureInput(session.id);
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.read(session.id)).rejects.toThrow("hidden during secure")];
            case 10:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(session.id, "blocked")).rejects.toThrow("controlled by a human")];
            case 11:
                _a.sent();
                (0, bun_test_1.expect)(function () { return registry.releaseHumanControl(session.id); }).toThrow("secure input");
                registry.endSecureInput(session.id);
                registry.releaseHumanControl(session.id);
                return [4 /*yield*/, registry.write(session.id, "model again")];
            case 12:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.read(session.id)).resolves.toMatchObject({
                        text: "pane 19 output",
                        cursorX: 0,
                        cursorY: 0,
                        rows: 24,
                        cols: 80,
                    })];
            case 13:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.observe(session.id, 0)).resolves.toMatchObject({
                        changed: true,
                    })];
            case 14:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.stop(session.id)).resolves.toMatchObject({
                        paneID: 19,
                    })];
            case 15:
                _a.sent();
                (0, bun_test_1.expect)(writes.map(function (item) { return item.data; }).join("")).toBe("hello\rdeduplicatedmodel keeps control after openmodel again");
                (0, bun_test_1.expect)(registry.list()).toMatchObject([{ id: "native_1", status: "exited" }]);
                (0, bun_test_1.expect)(audit).toContain("secure_input");
                (0, bun_test_1.expect)(audit.filter(function (action) { return action === "detach"; }).length).toBe(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry observe returns typed exit info with cursor", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, session, obs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 73, window_id: 3, tab_id: 5 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            pane_id: 73,
                                            window_id: 3,
                                            tab_id: 5,
                                            rows: 24,
                                            cols: 80,
                                            cursor_x: 12,
                                            cursor_y: 8,
                                        },
                                    ]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "exit output"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.stop(session.id)];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.observe(session.id, 0)];
            case 3:
                obs = _a.sent();
                (0, bun_test_1.expect)(obs).toMatchObject({
                    reason: "exited",
                    exited: true,
                    cursorX: 12,
                    cursorY: 8,
                    rows: 24,
                    cols: 80,
                    changed: true,
                });
                (0, bun_test_1.expect)(obs.text).toBe("");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry dispose stops only its running panes and host", function () { return __awaiter(void 0, void 0, void 0, function () {
    var stopped, disposed, nextPane, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                stopped = [];
                disposed = 0;
                nextPane = 301;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var paneID;
                            return __generator(this, function (_a) {
                                paneID = nextPane++;
                                return [2 /*return*/, { pane_id: paneID, window_id: 1, tab_id: paneID }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [301, 302].map(function (paneID) { return ({
                                        pane_id: paneID,
                                        window_id: 1,
                                        tab_id: paneID,
                                        rows: 24,
                                        cols: 80,
                                    }); })];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function (paneID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                stopped.push(paneID);
                                return [2 /*return*/];
                            });
                        });
                    },
                    dispose: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                disposed += 1;
                                return [2 /*return*/];
                            });
                        });
                    },
                });
                return [4 /*yield*/, registry.start({ id: "terminal_a", cwd: "/repo", command: "cat" })];
            case 1:
                _a.sent();
                return [4 /*yield*/, registry.start({ id: "terminal_b", cwd: "/repo", command: "cat" })];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.dispose()];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(stopped.sort()).toEqual([301, 302]);
                (0, bun_test_1.expect)(disposed).toBe(1);
                (0, bun_test_1.expect)(registry.list()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native starts automatically place sessions in one Terminal Hub", function () { return __awaiter(void 0, void 0, void 0, function () {
    var nextPaneID, openCalls, spawnCalls, registry, first, second, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                nextPaneID = 101;
                openCalls = [];
                spawnCalls = [];
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            var paneID;
                            return __generator(this, function (_a) {
                                spawnCalls.push(input.muxWindowID);
                                paneID = nextPaneID++;
                                return [2 /*return*/, { pane_id: paneID, window_id: paneID, tab_id: paneID + 100 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [101, 102].map(function (paneID) { return ({
                                        pane_id: paneID,
                                        window_id: paneID,
                                        tab_id: paneID + 100,
                                        rows: 24,
                                        cols: 80,
                                    }); })];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function (paneID, options) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                openCalls.push({
                                    paneID: paneID,
                                    muxWindowID: options === null || options === void 0 ? void 0 : options.muxWindowID,
                                    launch: options === null || options === void 0 ? void 0 : options.launch,
                                });
                                return [2 /*return*/, {
                                        pane_id: paneID,
                                        window_id: 501,
                                        tab_id: paneID + 1000,
                                        rows: 24,
                                        cols: 80,
                                    }];
                            });
                        });
                    },
                    openHub: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({
                        id: "terminal_first",
                        cwd: "/repo",
                        command: "first",
                    })];
            case 1:
                first = _b.sent();
                return [4 /*yield*/, registry.start({
                        id: "terminal_second",
                        cwd: "/repo",
                        command: "second",
                    })];
            case 2:
                second = _b.sent();
                (0, bun_test_1.expect)(openCalls).toEqual([
                    { paneID: 101, launch: true, muxWindowID: undefined },
                ]);
                (0, bun_test_1.expect)(spawnCalls).toEqual([undefined, 501]);
                (0, bun_test_1.expect)(first).toMatchObject({ paneID: 101, tabID: 1101, muxWindowID: 501 });
                (0, bun_test_1.expect)(second).toMatchObject({ paneID: 102, tabID: 202, muxWindowID: 501 });
                _a = bun_test_1.expect;
                return [4 /*yield*/, registry.openHub()];
            case 3:
                _a.apply(void 0, [_b.sent()]).toEqual({
                    workspace: "natalia",
                    muxWindowID: 501,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native observe returns its own bounded timeout instead of tool timeout", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reads, lists, registry, session, revision, startedAt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                reads = 0;
                lists = 0;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 81, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                lists += 1;
                                return [2 /*return*/, [{ pane_id: 81, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                reads += 1;
                                return [2 /*return*/, "unchanged"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    openHub: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.read(session.id, { maxLines: 60 })];
            case 2:
                _a.sent();
                revision = registry
                    .list()
                    .find(function (item) { return item.id === session.id; }).revision;
                startedAt = performance.now();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.observe(session.id, revision, { maxLines: 60, timeoutMs: 25 })).resolves.toMatchObject({ changed: false, reason: "timeout" })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(performance.now() - startedAt).toBeLessThan(150);
                (0, bun_test_1.expect)(reads).toBeLessThanOrEqual(12);
                // One initial read plus one reconcile per bounded observe poll. Each read
                // now fetches text, selection and highlights in parallel, so the read count
                // roughly triples compared to the baseline. There must not be a second list
                // caused by observe calling the public read method.
                (0, bun_test_1.expect)(lists).toBeLessThanOrEqual(reads + 2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native observe wakes immediately for registry session activity", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, session, revision, startedAt, observation;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 82, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 82, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "unchanged"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.read(session.id)];
            case 2:
                _a.sent();
                revision = registry.list()[0].revision;
                startedAt = performance.now();
                observation = registry.observe(session.id, revision, {
                    timeoutMs: 1000,
                });
                return [4 /*yield*/, Bun.sleep(20)];
            case 3:
                _a.sent();
                return [4 /*yield*/, registry.write(session.id, "wake")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(observation).resolves.toMatchObject({
                        changed: true,
                        reason: "session_activity",
                    })];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(performance.now() - startedAt).toBeLessThan(450);
                return [2 /*return*/];
        }
    });
}); });
arbitrationTest("human input cancels unsent visible model input chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
    var writes, registry, session, modelWrite;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                writes = [];
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 41, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 41, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function (_paneID, data) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        writes.push(data);
                                        if (!(writes.length === 1)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, Bun.sleep(20)];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _a.sent();
                modelWrite = registry.write(session.id, "1".repeat(2048));
                return [4 /*yield*/, Bun.sleep(5)];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.claimHumanInput(session.id)];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(modelWrite).resolves.toMatchObject({ delivery: "cancelled" })];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(writes).toEqual(["1".repeat(1024)]);
                (0, bun_test_1.expect)(registry.list()).toMatchObject([{ inputOwner: "human" }]);
                return [2 /*return*/];
        }
    });
}); });
arbitrationTest("a cancelled idempotent model write may be retried after control returns", function () { return __awaiter(void 0, void 0, void 0, function () {
    var writes, registry, session, payload, first;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                writes = [];
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 43, window_id: 2, tab_id: 3 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 43, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function (_paneID, data) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        writes.push(data);
                                        if (!(writes.length === 1)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, Bun.sleep(20)];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _a.sent();
                payload = "1".repeat(2048);
                first = registry.write(session.id, payload, {
                    idempotencyKey: "retry-after-human",
                });
                return [4 /*yield*/, Bun.sleep(5)];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.claimHumanInput(session.id)];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(first).resolves.toMatchObject({ delivery: "cancelled" })];
            case 4:
                _a.sent();
                registry.releaseHumanControl(session.id);
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(session.id, payload, {
                        idempotencyKey: "retry-after-human",
                    })).resolves.toMatchObject({ delivery: "accepted" })];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(writes).toEqual([
                    "1".repeat(1024),
                    "1".repeat(1024),
                    "1".repeat(1024),
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reconcile marks a closed native pane exited without polling", function () { return __awaiter(void 0, void 0, void 0, function () {
    var visible, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                visible = true;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 31, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, visible
                                        ? [{ pane_id: 31, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]
                                        : []];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _a.sent();
                visible = false;
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(registry.list()).toMatchObject([
                    { id: session.id, status: "exited", geometryOwner: "human" },
                ]);
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(session.id, "late")).rejects.toThrow("exited")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.attach(session.id)).rejects.toThrow("exited")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.resize(session.id, 30, 100)).rejects.toThrow("exited")];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry attaches, detaches, and resizes the same pane", function () { return __awaiter(void 0, void 0, void 0, function () {
    var resized, audit, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resized = [];
                audit = [];
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function (paneID, rows, cols) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                resized.push([paneID, rows, cols]);
                                return [2 /*return*/];
                            });
                        });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                }, {
                    onAudit: function (event) { return audit.push(event); },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.write(session.id, "model input")];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.attach(session.id)];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(registry.list()).toMatchObject([{ inputOwner: "model" }]);
                return [4 /*yield*/, registry.claimHumanInput(session.id)];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(registry.list()).toMatchObject([{ inputOwner: "human" }]);
                (0, bun_test_1.expect)(registry.detach(session.id)).toMatchObject({ inputOwner: "model" });
                // A resize is attributed to whoever asked for it. This used to be recorded as
                // `human` unconditionally while the only caller was the model's resize tool, so
                // the audit answered "who did this" wrongly — worse than not answering.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.resize(session.id, 30, 100)).resolves.toMatchObject({
                        rows: 30,
                        cols: 100,
                    })];
            case 5:
                // A resize is attributed to whoever asked for it. This used to be recorded as
                // `human` unconditionally while the only caller was the model's resize tool, so
                // the audit answered "who did this" wrongly — worse than not answering.
                _a.sent();
                (0, bun_test_1.expect)(resized).toEqual([[37, 30, 100]]);
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.resize(session.id, 31, 101, "human")).resolves.toMatchObject({ rows: 31, cols: 101 })];
            case 6:
                _a.sent();
                return [4 /*yield*/, registry.stop(session.id, "human")];
            case 7:
                _a.sent();
                (0, bun_test_1.expect)(audit.map(function (_a) {
                    var action = _a.action, actor = _a.actor;
                    return ({ action: action, actor: actor });
                })).toEqual([
                    { action: "write", actor: "model" },
                    { action: "attach", actor: "human" },
                    { action: "write", actor: "human" },
                    { action: "detach", actor: "human" },
                    { action: "resize", actor: "model" },
                    { action: "resize", actor: "human" },
                    { action: "exit", actor: "human" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native snapshot text matches read text and includes cursor", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, session, read, snapshot;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            pane_id: 37,
                                            window_id: 2,
                                            tab_id: 3,
                                            rows: 24,
                                            cols: 80,
                                            cursor_x: 5,
                                            cursor_y: 3,
                                        },
                                    ]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "snapshot consistency check\n"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.read(session.id)];
            case 2:
                read = _a.sent();
                return [4 /*yield*/, registry.snapshot(session.id)];
            case 3:
                snapshot = _a.sent();
                (0, bun_test_1.expect)(snapshot.text).toBe(read.text);
                (0, bun_test_1.expect)(snapshot.cursorX).toBe(5);
                (0, bun_test_1.expect)(snapshot.cursorY).toBe(3);
                (0, bun_test_1.expect)(snapshot.rows).toBe(24);
                (0, bun_test_1.expect)(snapshot.cols).toBe(80);
                (0, bun_test_1.expect)(snapshot.revision).toBe(session.revision);
                return [4 /*yield*/, registry.stop(session.id)];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native snapshot includes highlightRanges when selection is active", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, session, snapshot;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            pane_id: 37,
                                            window_id: 2,
                                            tab_id: 3,
                                            rows: 24,
                                            cols: 80,
                                            cursor_x: 5,
                                            cursor_y: 3,
                                        },
                                    ]];
                            });
                        });
                    },
                    read: function (_paneID, options) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if ((options === null || options === void 0 ? void 0 : options.format) === "selection") {
                                    return [2 /*return*/, JSON.stringify({
                                            selection: {
                                                mode: "char",
                                                ranges: [
                                                    { startRow: 2, startCol: 4, endRow: 2, endCol: 10 },
                                                    { startRow: 3, startCol: 0, endRow: 3, endCol: 20 },
                                                ],
                                            },
                                        })];
                                }
                                if ((options === null || options === void 0 ? void 0 : options.format) === "highlights") {
                                    return [2 /*return*/, JSON.stringify({
                                            highlights: {
                                                mode: "highlights",
                                                ranges: [
                                                    { startRow: 2, startCol: 4, endRow: 2, endCol: 10 },
                                                    { startRow: 3, startCol: 0, endRow: 3, endCol: 20 },
                                                ],
                                            },
                                        })];
                                }
                                return [2 /*return*/, "selected text\n"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.snapshot(session.id)];
            case 2:
                snapshot = _a.sent();
                (0, bun_test_1.expect)(snapshot.text).toBe("selected text\n");
                (0, bun_test_1.expect)(snapshot.highlightRanges).toEqual([
                    { startRow: 2, startCol: 4, endRow: 2, endCol: 10 },
                    { startRow: 3, startCol: 0, endRow: 3, endCol: 20 },
                    { startRow: 2, startCol: 4, endRow: 2, endCol: 10 },
                    { startRow: 3, startCol: 0, endRow: 3, endCol: 20 },
                ]);
                return [4 /*yield*/, registry.stop(session.id)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native snapshot returns empty highlightRanges when selection is null", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, session, snapshot;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 41, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 41, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function (_paneID, options) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if ((options === null || options === void 0 ? void 0 : options.format) === "selection") {
                                    return [2 /*return*/, JSON.stringify({ selection: null })];
                                }
                                return [2 /*return*/, "no selection\n"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.snapshot(session.id)];
            case 2:
                snapshot = _a.sent();
                (0, bun_test_1.expect)(snapshot.highlightRanges).toEqual([]);
                return [4 /*yield*/, registry.stop(session.id)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native observe returns highlightRanges", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, session, obs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 42, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 42, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function (_paneID, options) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if ((options === null || options === void 0 ? void 0 : options.format) === "selection") {
                                    return [2 /*return*/, JSON.stringify({
                                            selection: {
                                                mode: "line",
                                                ranges: [{ startRow: 5, startCol: 0, endRow: 5, endCol: 79 }],
                                            },
                                        })];
                                }
                                if ((options === null || options === void 0 ? void 0 : options.format) === "highlights") {
                                    return [2 /*return*/, JSON.stringify({
                                            highlights: {
                                                mode: "highlights",
                                                ranges: [{ startRow: 5, startCol: 0, endRow: 5, endCol: 79 }],
                                            },
                                        })];
                                }
                                return [2 /*return*/, "observed\n"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.observe(session.id, 0)];
            case 2:
                obs = _a.sent();
                (0, bun_test_1.expect)(obs.highlightRanges).toEqual([
                    { startRow: 5, startCol: 0, endRow: 5, endCol: 79 },
                    { startRow: 5, startCol: 0, endRow: 5, endCol: 79 },
                ]);
                return [4 /*yield*/, registry.stop(session.id)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native model can continue to observe and write after human detach", function () { return __awaiter(void 0, void 0, void 0, function () {
    var writes, registry, session, beforeDetach, afterDetach;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                writes = [];
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 37, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, writes.join("")];
                            });
                        });
                    },
                    write: function (_paneID, data) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                writes.push(data);
                                return [2 /*return*/];
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.write(session.id, "model before human\r")];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.claimHumanInput(session.id)];
            case 3:
                _a.sent();
                return [4 /*yield*/, registry.observe(session.id, 0)];
            case 4:
                beforeDetach = _a.sent();
                (0, bun_test_1.expect)(beforeDetach.changed).toBe(true);
                registry.detach(session.id);
                return [4 /*yield*/, registry.write(session.id, "model after detach\r")];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(writes).toEqual(["model before human\r", "model after detach\r"]);
                return [4 /*yield*/, registry.observe(session.id, beforeDetach.afterRevision)];
            case 6:
                afterDetach = _a.sent();
                (0, bun_test_1.expect)(afterDetach.changed).toBe(true);
                (0, bun_test_1.expect)(afterDetach.text).toContain("model before human");
                (0, bun_test_1.expect)(afterDetach.text).toContain("model after detach");
                return [4 /*yield*/, registry.stop(session.id)];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reconcile updates attached from list-clients", function () { return __awaiter(void 0, void 0, void 0, function () {
    var listClientsCalls, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                listClientsCalls = [];
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 41, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 41, window_id: 2, tab_id: 3, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    listClients: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var value;
                            var _a;
                            return __generator(this, function (_b) {
                                value = (_a = listClientsCalls.at(-1)) !== null && _a !== void 0 ? _a : [{ focused_pane_id: 41 }];
                                listClientsCalls.push(value);
                                return [2 /*return*/, value];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        pane_id: 41,
                                        window_id: 501,
                                        tab_id: 1041,
                                        rows: 24,
                                        cols: 80,
                                    }];
                            });
                        });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                (0, bun_test_1.expect)(registry.session(session.id).attached).toBe(true);
                listClientsCalls.push([]);
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(registry.session(session.id).attached).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("cleanupStalePanes removes panes not belonging to current sessions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var stops, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                stops = [];
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 51, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        { pane_id: 51, window_id: 2, tab_id: 3, rows: 24, cols: 80 },
                                        { pane_id: 999, window_id: 2, tab_id: 4, rows: 24, cols: 80 },
                                    ]];
                            });
                        });
                    },
                    listClients: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function (paneID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                stops.push(paneID);
                                return [2 /*return*/];
                            });
                        });
                    },
                    open: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        pane_id: 51,
                                        window_id: 501,
                                        tab_id: 1051,
                                        rows: 24,
                                        cols: 80,
                                    }];
                            });
                        });
                    },
                });
                return [4 /*yield*/, registry.start({ command: "cat", cwd: "/repo" })];
            case 1:
                session = _a.sent();
                (0, bun_test_1.expect)(stops).toContain(999);
                (0, bun_test_1.expect)(stops).not.toContain(51);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("cross-runtime provenance recovery restores persisted session metadata", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, persistPath, listCalls, firstRegistry, firstSession, secondRegistry, recovered;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-terminal-provenance-"))];
            case 1:
                root = _a.sent();
                persistPath = (0, node_path_1.join)(root, "native-terminal-sessions.json");
                listCalls = [];
                firstRegistry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 61, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var value;
                            var _a;
                            return __generator(this, function (_b) {
                                value = (_a = listCalls.at(-1)) !== null && _a !== void 0 ? _a : [
                                    { pane_id: 61, window_id: 2, tab_id: 3, rows: 24, cols: 80 },
                                ];
                                listCalls.push(value);
                                return [2 /*return*/, value];
                            });
                        });
                    },
                    listClients: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ focused_pane_id: 61 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        pane_id: 61,
                                        window_id: 501,
                                        tab_id: 1061,
                                        rows: 24,
                                        cols: 80,
                                    }];
                            });
                        });
                    },
                }, { persistPath: persistPath });
                return [4 /*yield*/, firstRegistry.start({
                        id: "tty_provenance",
                        command: "bash",
                        cwd: "/repo",
                    })];
            case 2:
                firstSession = _a.sent();
                return [4 /*yield*/, firstRegistry.stop(firstSession.id)];
            case 3:
                _a.sent();
                return [4 /*yield*/, firstRegistry.dispose()];
            case 4:
                _a.sent();
                secondRegistry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 61, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var value;
                            var _a;
                            return __generator(this, function (_b) {
                                value = (_a = listCalls.at(-1)) !== null && _a !== void 0 ? _a : [
                                    { pane_id: 61, window_id: 2, tab_id: 3, rows: 24, cols: 80 },
                                ];
                                listCalls.push(value);
                                return [2 /*return*/, value];
                            });
                        });
                    },
                    listClients: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        pane_id: 61,
                                        window_id: 501,
                                        tab_id: 1061,
                                        rows: 24,
                                        cols: 80,
                                    }];
                            });
                        });
                    },
                }, { persistPath: persistPath });
                recovered = secondRegistry.session("tty_provenance");
                (0, bun_test_1.expect)(recovered).toMatchObject({
                    id: "tty_provenance",
                    paneID: 61,
                    windowID: 501,
                    muxWindowID: 501,
                    tabID: 1061,
                    status: "exited",
                    attached: false,
                    command: "bash",
                    cwd: "/repo",
                    rows: 24,
                    cols: 80,
                    inputOwner: "model",
                    secureInput: false,
                });
                (0, bun_test_1.expect)(secondRegistry.list()).toHaveLength(1);
                return [4 /*yield*/, secondRegistry.dispose()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("mux server unavailability marks running sessions as exited", function () { return __awaiter(void 0, void 0, void 0, function () {
    var listCalls, registry, session, read;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                listCalls = 0;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var pane;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.list()];
                                    case 1:
                                        pane = (_a.sent()).find(function (p) { return p.pane_id === 201; });
                                        return [2 /*return*/, pane];
                                }
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                listCalls += 1;
                                if (listCalls <= 2) {
                                    return [2 /*return*/, [
                                            {
                                                pane_id: 201,
                                                window_id: 1,
                                                tab_id: 201,
                                                rows: 24,
                                                cols: 80,
                                                cursor_x: 0,
                                                cursor_y: 0,
                                            },
                                        ]];
                                }
                                throw new Error("WezTerm mux connection refused");
                            });
                        });
                    },
                    isAlive: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, false];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "text"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    listClients: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ focused_pane_id: 201 }]];
                            });
                        });
                    },
                });
                return [4 /*yield*/, registry.start({
                        id: "mux-down",
                        command: "cat",
                        cwd: "/repo",
                    })];
            case 1:
                session = _a.sent();
                (0, bun_test_1.expect)(session.status).toBe("running");
                return [4 /*yield*/, registry.read(session.id)];
            case 2:
                read = _a.sent();
                (0, bun_test_1.expect)(read.text).toBe("text");
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(registry.session("mux-down").status).toBe("exited");
                (0, bun_test_1.expect)(registry.session("mux-down").attached).toBe(false);
                (0, bun_test_1.expect)(registry.session("mux-down").revision).toBeGreaterThan(1);
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.read(session.id)).rejects.toThrow("terminal session has exited")];
            case 4:
                _a.sent();
                return [4 /*yield*/, registry.stop(session.id)];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("mux server transient error does not falsely mark sessions exited", function () { return __awaiter(void 0, void 0, void 0, function () {
    var listCalls, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                listCalls = 0;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var pane;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.list()];
                                    case 1:
                                        pane = (_a.sent()).find(function (p) { return p.pane_id === 202; });
                                        return [2 /*return*/, pane];
                                }
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                listCalls += 1;
                                if (listCalls <= 1) {
                                    return [2 /*return*/, [
                                            { pane_id: 202, window_id: 1, tab_id: 202, rows: 24, cols: 80 },
                                        ]];
                                }
                                throw new Error("temporary JSON parse error");
                            });
                        });
                    },
                    isAlive: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, true];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "text"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({
                        id: "mux-transient",
                        command: "cat",
                        cwd: "/repo",
                    })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.reconcile({ force: true })).rejects.toThrow("temporary JSON parse error")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(registry.session("mux-transient").status).toBe("running");
                return [4 /*yield*/, registry.stop(session.id)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("mux recovery allows new sessions after prior sessions were marked exited", function () { return __awaiter(void 0, void 0, void 0, function () {
    var listCalls, registry, first, second, read;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                listCalls = 0;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var paneID, pane;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        paneID = listCalls < 3 ? 301 : 302;
                                        return [4 /*yield*/, this.list()];
                                    case 1:
                                        pane = (_a.sent()).find(function (p) { return p.pane_id === paneID; });
                                        return [2 /*return*/, pane];
                                }
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                listCalls += 1;
                                if (listCalls <= 2) {
                                    return [2 /*return*/, [
                                            { pane_id: 301, window_id: 1, tab_id: 301, rows: 24, cols: 80 },
                                        ]];
                                }
                                if (listCalls === 3) {
                                    throw new Error("mux down");
                                }
                                return [2 /*return*/, [{ pane_id: 302, window_id: 1, tab_id: 302, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    isAlive: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, listCalls < 3];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "text"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    listClients: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ focused_pane_id: listCalls < 3 ? 301 : 302 }]];
                            });
                        });
                    },
                });
                return [4 /*yield*/, registry.start({
                        id: "mux-recovery",
                        command: "cat",
                        cwd: "/repo",
                    })];
            case 1:
                first = _a.sent();
                (0, bun_test_1.expect)(first.status).toBe("running");
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(registry.session("mux-recovery").status).toBe("running");
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(registry.session("mux-recovery").status).toBe("exited");
                return [4 /*yield*/, registry.start({
                        id: "mux-recovery-2",
                        command: "bash",
                        cwd: "/repo",
                    })];
            case 4:
                second = _a.sent();
                (0, bun_test_1.expect)(second.status).toBe("running");
                (0, bun_test_1.expect)(second.paneID).toBe(302);
                return [4 /*yield*/, registry.read(second.id)];
            case 5:
                read = _a.sent();
                (0, bun_test_1.expect)(read.text).toBe("text");
                return [4 /*yield*/, registry.stop(second.id)];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("observe returns exited when mux dies", function () { return __awaiter(void 0, void 0, void 0, function () {
    var muxAlive, registry, session, obs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                muxAlive = true;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var pane;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.list()];
                                    case 1:
                                        pane = (_a.sent()).find(function (p) { return p.pane_id === 401; });
                                        return [2 /*return*/, pane];
                                }
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (!muxAlive)
                                    throw new Error("WezTerm mux connection refused");
                                return [2 /*return*/, [{ pane_id: 401, window_id: 1, tab_id: 401, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    isAlive: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, muxAlive];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "text"];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({
                        id: "mux-observe",
                        command: "cat",
                        cwd: "/repo",
                    })];
            case 1:
                session = _a.sent();
                muxAlive = false;
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.observe(session.id, 0)];
            case 3:
                obs = _a.sent();
                (0, bun_test_1.expect)(obs.exited).toBe(true);
                (0, bun_test_1.expect)(obs.highlightRanges).toEqual([]);
                return [4 /*yield*/, registry.stop(session.id)];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("dispose succeeds when the mux server is already gone", function () { return __awaiter(void 0, void 0, void 0, function () {
    var runtimeDir, deadProcess, host, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-mux-dispose-"))];
            case 1:
                runtimeDir = _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(runtimeDir, "wezterm"), { recursive: true })];
            case 2:
                _c.sent();
                deadProcess = spawnAlreadyExitedProcess();
                return [4 /*yield*/, deadProcess.exited];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(runtimeDir, "wezterm", "pid"), "".concat(deadProcess.pid, "\n"))];
            case 4:
                _c.sent();
                host = (0, index_1.createWezTermHost)({
                    executable: "/opt/natalia/wezterm",
                    environment: { WEZTERM_UNIX_SOCKET: (0, node_path_1.join)(runtimeDir, "sock") },
                    muxRuntimeDir: runtimeDir,
                    run: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ stdout: "", stderr: "", exitCode: 0 })];
                    }); }); },
                });
                return [4 /*yield*/, ((_b = host.dispose) === null || _b === void 0 ? void 0 : _b.call(host))];
            case 5:
                _c.sent();
                // The runtime directory is cleaned up as part of a successful dispose.
                _a = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(runtimeDir, "wezterm", "pid")).exists()];
            case 6:
                // The runtime directory is cleaned up as part of a successful dispose.
                _a.apply(void 0, [_c.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("dispose still reports failures it cannot interpret", function () { return __awaiter(void 0, void 0, void 0, function () {
    var runtimeDir, host, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-mux-dispose-fail-"))];
            case 1:
                runtimeDir = _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(runtimeDir, "wezterm"), { recursive: true })];
            case 2:
                _c.sent();
                // pid 1 is rejected before any signal is sent, so a permission failure is
                // simulated by pointing at a pid the test cannot signal.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(runtimeDir, "wezterm", "pid"), "not-a-pid\n")];
            case 3:
                // pid 1 is rejected before any signal is sent, so a permission failure is
                // simulated by pointing at a pid the test cannot signal.
                _c.sent();
                host = (0, index_1.createWezTermHost)({
                    executable: "/opt/natalia/wezterm",
                    environment: { WEZTERM_UNIX_SOCKET: (0, node_path_1.join)(runtimeDir, "sock") },
                    muxRuntimeDir: runtimeDir,
                    run: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ stdout: "", stderr: "", exitCode: 0 })];
                    }); }); },
                });
                // An unparseable pid is skipped rather than signalled, so dispose completes.
                return [4 /*yield*/, ((_b = host.dispose) === null || _b === void 0 ? void 0 : _b.call(host))];
            case 4:
                // An unparseable pid is skipped rather than signalled, so dispose completes.
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(runtimeDir, "wezterm", "pid")).exists()];
            case 5:
                _a.apply(void 0, [_c.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("mux liveness reports a failed connection as dead", function () { return __awaiter(void 0, void 0, void 0, function () {
    var exitCode, host, _a, _b;
    var _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                exitCode = 0;
                host = (0, index_1.createWezTermHost)({
                    executable: "/opt/natalia/wezterm",
                    environment: { WEZTERM_UNIX_SOCKET: "/run/user/1000/natalia/mux.sock" },
                    muxRuntimeDir: "/run/user/1000/natalia/mux-runtime",
                    run: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    stdout: "",
                                    stderr: 'failed to connect to Socket("/run/user/1000/natalia/mux.sock")',
                                    exitCode: exitCode,
                                })];
                        });
                    }); },
                });
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_c = host.isAlive) === null || _c === void 0 ? void 0 : _c.call(host))];
            case 1:
                _a.apply(void 0, [_e.sent()]).toBe(true);
                // The runner resolves with a non-zero code rather than throwing, so a probe
                // that ignored the code reported a dead server as alive and no recovery ever
                // ran.
                exitCode = 1;
                _b = bun_test_1.expect;
                return [4 /*yield*/, ((_d = host.isAlive) === null || _d === void 0 ? void 0 : _d.call(host))];
            case 2:
                _b.apply(void 0, [_e.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spawn restarts a mux server that died after a successful start", function () { return __awaiter(void 0, void 0, void 0, function () {
    var muxAlive, daemonizeCalls, host, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                muxAlive = true;
                daemonizeCalls = [];
                host = (0, index_1.createWezTermHost)({
                    os: "linux",
                    executable: "/opt/natalia/wezterm",
                    environment: { WEZTERM_UNIX_SOCKET: "/run/user/1000/natalia/mux.sock" },
                    muxRuntimeDir: "/run/user/1000/natalia/mux-runtime",
                    run: function (executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (executable.endsWith("wezterm-mux-server")) {
                                daemonizeCalls.push(daemonizeCalls.length);
                                muxAlive = true;
                                return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                            }
                            if (args.includes("spawn"))
                                return [2 /*return*/, { stdout: "7\n", stderr: "", exitCode: 0 }];
                            if (args.includes("list"))
                                return [2 /*return*/, {
                                        stdout: muxAlive
                                            ? JSON.stringify([
                                                {
                                                    pane_id: 7,
                                                    window_id: 1,
                                                    tab_id: 1,
                                                    is_active: true,
                                                    size: { rows: 24, cols: 80 },
                                                },
                                            ])
                                            : "",
                                        stderr: "",
                                        exitCode: muxAlive ? 0 : 1,
                                    }];
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                });
                return [4 /*yield*/, host.spawn({ cwd: "/tmp", command: ["bash"], workspace: "natalia" })];
            case 1:
                _c.sent();
                (0, bun_test_1.expect)(daemonizeCalls.length).toBe(0); // the probe found a live server
                // The server dies while the readiness promise stays resolved. Spawning used
                // to keep talking to the dead socket forever.
                muxAlive = false;
                return [4 /*yield*/, host.spawn({ cwd: "/tmp", command: ["bash"], workspace: "natalia" })];
            case 2:
                _c.sent();
                (0, bun_test_1.expect)(daemonizeCalls.length).toBe(1);
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_b = host.isAlive) === null || _b === void 0 ? void 0 : _b.call(host))];
            case 3:
                _a.apply(void 0, [_c.sent()]).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("starting a terminal after the mux died retires the stale sessions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var muxAlive, nextPane, registry, first, second, before;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                muxAlive = true;
                nextPane = 1;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var paneID;
                            return __generator(this, function (_a) {
                                paneID = nextPane;
                                nextPane = 1;
                                return [2 /*return*/, { pane_id: paneID, window_id: 1, tab_id: paneID }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (!muxAlive)
                                    throw new Error("failed to connect to Socket(...)");
                                return [2 /*return*/, [{ pane_id: 1, window_id: 1, tab_id: 1, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    isAlive: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, muxAlive];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({
                        id: "terminal_before",
                        cwd: "/repo",
                        command: "cat",
                    })];
            case 1:
                first = _a.sent();
                (0, bun_test_1.expect)(first.status).toBe("running");
                muxAlive = false;
                return [4 /*yield*/, registry.start({
                        id: "terminal_after",
                        cwd: "/repo",
                        command: "cat",
                    })];
            case 2:
                second = _a.sent();
                before = registry.list().find(function (item) { return item.id === "terminal_before"; });
                (0, bun_test_1.expect)(before === null || before === void 0 ? void 0 : before.status).toBe("exited");
                (0, bun_test_1.expect)(second.status).toBe("running");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a reversed read range is normalized before it reaches the terminal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ranges, host, bounds;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ranges = [];
                host = (0, index_1.createWezTermHost)({
                    executable: "/opt/natalia/wezterm",
                    run: function (_executable, args) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (args.includes("get-text"))
                                ranges.push(args);
                            return [2 /*return*/, { stdout: "", stderr: "", exitCode: 0 }];
                        });
                    }); },
                });
                return [4 /*yield*/, host.read(3, { startLine: 57, endLine: 8 })];
            case 1:
                _a.sent();
                return [4 /*yield*/, host.read(3, { startLine: 8, endLine: 57 })];
            case 2:
                _a.sent();
                return [4 /*yield*/, host.read(3, { startLine: -8, endLine: -57 })];
            case 3:
                _a.sent();
                bounds = ranges.map(function (args) { return [
                    args[args.indexOf("--start-line") + 1],
                    args[args.indexOf("--end-line") + 1],
                ]; });
                // Whichever way round the caller wrote it, the terminal receives ascending
                // bounds describing the same span.
                (0, bun_test_1.expect)(bounds).toEqual([
                    ["8", "57"],
                    ["8", "57"],
                    ["-57", "-8"],
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("stale mux runtime directories are reclaimed but live ones are kept", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, stale, live, mine, fresh, _i, _a, dir, dead, old, _b, _c, dir, reclaimed, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-reclaim-"))];
            case 1:
                root = _j.sent();
                stale = (0, node_path_1.join)(root, "stale");
                live = (0, node_path_1.join)(root, "live");
                mine = (0, node_path_1.join)(root, "mine");
                fresh = (0, node_path_1.join)(root, "fresh");
                _i = 0, _a = [stale, live, mine, fresh];
                _j.label = 2;
            case 2:
                if (!(_i < _a.length)) return [3 /*break*/, 5];
                dir = _a[_i];
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(dir, "wezterm"), { recursive: true })];
            case 3:
                _j.sent();
                _j.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5:
                dead = spawnAlreadyExitedProcess();
                return [4 /*yield*/, dead.exited];
            case 6:
                _j.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(stale, "wezterm", "pid"), "".concat(dead.pid, "\n"))];
            case 7:
                _j.sent();
                // A directory owned by a server that is still running.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(live, "wezterm", "pid"), "".concat(process.pid, "\n"))];
            case 8:
                // A directory owned by a server that is still running.
                _j.sent();
                // Our own directory is never a candidate.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(mine, "wezterm", "pid"), "".concat(dead.pid, "\n"))];
            case 9:
                // Our own directory is never a candidate.
                _j.sent();
                old = Date.now() - 3600000;
                _b = 0, _c = [stale, live, mine];
                _j.label = 10;
            case 10:
                if (!(_b < _c.length)) return [3 /*break*/, 13];
                dir = _c[_b];
                return [4 /*yield*/, (0, promises_1.utimes)(dir, new Date(old), new Date(old))];
            case 11:
                _j.sent();
                _j.label = 12;
            case 12:
                _b++;
                return [3 /*break*/, 10];
            case 13: return [4 /*yield*/, (0, index_1.reclaimStaleMuxRuntimeDirs)({
                    root: root,
                    keep: "mine",
                    olderThanMs: 600000,
                })];
            case 14:
                reclaimed = _j.sent();
                (0, bun_test_1.expect)(reclaimed).toBe(1);
                _d = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(stale, "wezterm", "pid")).exists()];
            case 15:
                _d.apply(void 0, [_j.sent()]).toBe(false);
                _e = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(live, "wezterm", "pid")).exists()];
            case 16:
                _e.apply(void 0, [_j.sent()]).toBe(true);
                _f = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(mine, "wezterm", "pid")).exists()];
            case 17:
                _f.apply(void 0, [_j.sent()]).toBe(true);
                // A directory younger than the grace period may belong to a runtime that has
                // not started its server yet.
                _g = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(fresh, "wezterm")).exists()];
            case 18:
                // A directory younger than the grace period may belong to a runtime that has
                // not started its server yet.
                _g.apply(void 0, [_j.sent()]).toBe(false);
                _h = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readdir)(root)];
            case 19:
                _h.apply(void 0, [(_j.sent()).sort()]).toEqual(["fresh", "live", "mine"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry reports the terminal device backing a pane", function () { return __awaiter(void 0, void 0, void 0, function () {
    var host, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                host = {
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 31, window_id: 1, tab_id: 1, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            pane_id: 31,
                                            window_id: 1,
                                            tab_id: 1,
                                            rows: 24,
                                            cols: 80,
                                            tty_name: "/dev/pts/9",
                                        },
                                        { pane_id: 32, window_id: 1, tab_id: 1, rows: 24, cols: 80 },
                                    ]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                };
                registry = new index_1.NativeTerminalRegistry(host, {
                    windowMode: "windowless",
                });
                return [4 /*yield*/, registry.start({ command: "bash", cwd: process.cwd() })];
            case 1:
                session = _a.sent();
                // The device name is what lets the runtime confirm the foreground program
                // instead of inferring it from the screen.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.ttyName(session.id)).resolves.toBe("/dev/pts/9")];
            case 2:
                // The device name is what lets the runtime confirm the foreground program
                // instead of inferring it from the screen.
                _a.sent();
                return [4 /*yield*/, registry.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry reports no terminal device when the host omits it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var host, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                host = {
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 41, window_id: 1, tab_id: 1, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 41, window_id: 1, tab_id: 1, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                };
                registry = new index_1.NativeTerminalRegistry(host, {
                    windowMode: "windowless",
                });
                return [4 /*yield*/, registry.start({ command: "bash", cwd: process.cwd() })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.ttyName(session.id)).resolves.toBeUndefined()];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
arbitrationTest("a human entering a secret is not disturbed by the model", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawned, paneID, registry, secret, other;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spawned = [];
                paneID = 40;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                paneID += 1;
                                spawned.push(paneID);
                                return [2 /*return*/, { pane_id: paneID, window_id: 2, tab_id: 3, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, spawned.map(function (pane) { return ({
                                        pane_id: pane,
                                        window_id: 2,
                                        tab_id: 3,
                                        rows: 24,
                                        cols: 80,
                                    }); })];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                });
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "ssh host" })];
            case 1:
                secret = _a.sent();
                return [4 /*yield*/, registry.start({ cwd: "/repo", command: "cat" })];
            case 2:
                other = _a.sent();
                return [4 /*yield*/, registry.claimHumanInput(secret.id)];
            case 3:
                _a.sent();
                registry.beginSecureInput(secret.id);
                // Everything that would move the window under the human's hands is refused,
                // including on a *different* pane, because the layout is shared.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.start({ cwd: "/repo", command: "top" })).rejects.toThrow(/secure input/u)];
            case 4:
                // Everything that would move the window under the human's hands is refused,
                // including on a *different* pane, because the layout is shared.
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.resize(other.id, 30, 100, "model")).rejects.toThrow(/secure input/u)];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.stop(other.id, "model")).rejects.toThrow(/secure input/u)];
            case 6:
                _a.sent();
                // Writing to another pane stays allowed: it changes no layout, and refusing all
                // model output during a password prompt would stall unrelated work.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.write(other.id, "still working\n")).resolves.toBeDefined()];
            case 7:
                // Writing to another pane stays allowed: it changes no layout, and refusing all
                // model output during a password prompt would stall unrelated work.
                _a.sent();
                // The human is never blocked from their own actions, including ending it.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.resize(other.id, 30, 100, "human")).resolves.toBeDefined()];
            case 8:
                // The human is never blocked from their own actions, including ending it.
                _a.sent();
                registry.endSecureInput(secret.id);
                // Once the secret is entered, the model can act again.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.start({ cwd: "/repo", command: "top" })).resolves.toBeDefined()];
            case 9:
                // Once the secret is entered, the model can act again.
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry isolates panes per active session (I3)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var nextPane, registry, a, b, c;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                nextPane = 401;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var paneID;
                            return __generator(this, function (_a) {
                                paneID = nextPane++;
                                return [2 /*return*/, { pane_id: paneID, window_id: 1, tab_id: paneID }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                }, { windowMode: "windowless" });
                return [4 /*yield*/, registry.start({
                        id: "i3_pane_a",
                        cwd: "/a",
                        command: "cat",
                        sessionID: "ses_i3_a",
                    })];
            case 1:
                a = _a.sent();
                return [4 /*yield*/, registry.start({
                        id: "i3_pane_b",
                        cwd: "/b",
                        command: "cat",
                        sessionID: "ses_i3_b",
                    })];
            case 2:
                b = _a.sent();
                // Unset active session keeps the legacy behaviour: everything visible.
                (0, bun_test_1.expect)(registry.list().map(function (session) { return session.id; })).toEqual([
                    "i3_pane_a",
                    "i3_pane_b",
                ]);
                registry.setActiveSession("ses_i3_a");
                (0, bun_test_1.expect)(registry.list().map(function (session) { return session.id; })).toEqual(["i3_pane_a"]);
                // A pane of another session is indistinguishable from an unknown id: no
                // existence probe, no leak of which session owns what.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.read("i3_pane_b")).rejects.toThrow("native terminal session not found")];
            case 3:
                // A pane of another session is indistinguishable from an unknown id: no
                // existence probe, no leak of which session owns what.
                _a.sent();
                registry.setActiveSession("ses_i3_b");
                (0, bun_test_1.expect)(registry.list().map(function (session) { return session.id; })).toEqual(["i3_pane_b"]);
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.read("i3_pane_a")).rejects.toThrow("native terminal session not found")];
            case 4:
                _a.sent();
                return [4 /*yield*/, registry.start({
                        id: "i3_pane_c",
                        cwd: "/c",
                        command: "cat",
                    })];
            case 5:
                c = _a.sent();
                (0, bun_test_1.expect)(c.sessionID).toBe("ses_i3_b");
                (0, bun_test_1.expect)(registry.list().map(function (session) { return session.id; })).toEqual([
                    "i3_pane_b",
                    "i3_pane_c",
                ]);
                registry.setActiveSession(undefined);
                (0, bun_test_1.expect)(registry.list()).toHaveLength(3);
                return [4 /*yield*/, registry.dispose()];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry request_human audits the explicit call with a bounded reason", function () { return __awaiter(void 0, void 0, void 0, function () {
    var audit, output, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                audit = [];
                output = "";
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 601, window_id: 1, tab_id: 601 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        { pane_id: 601, window_id: 1, tab_id: 601, rows: 24, cols: 80 },
                                    ]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, output];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                }, {
                    windowMode: "windowless",
                    onAudit: function (event) { return audit.push(event); },
                });
                return [4 /*yield*/, registry.start({
                        id: "rh_1",
                        cwd: "/repo",
                        command: "ssh host",
                    })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, registry.requestHuman(session.id, "needs the sudo password")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(audit.at(-1)).toEqual({
                    id: "rh_1",
                    cwd: "/repo",
                    action: "request_human",
                    actor: "model",
                    at: bun_test_1.expect.any(String),
                    detail: "needs the sudo password",
                });
                // The model's own statement is not an output fact: requesting a human does
                // not count as the pane producing output.
                (0, bun_test_1.expect)(session.mayWaitForHuman).toBeUndefined();
                return [4 /*yield*/, registry.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry request_human rejects empty, oversized, and exited-pane reasons", function () { return __awaiter(void 0, void 0, void 0, function () {
    var nextPane, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                nextPane = 602;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var paneID;
                            return __generator(this, function (_a) {
                                paneID = nextPane++;
                                return [2 /*return*/, { pane_id: paneID, window_id: 1, tab_id: paneID }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, []];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                }, { windowMode: "windowless" });
                return [4 /*yield*/, registry.start({
                        id: "rh_2",
                        cwd: "/repo",
                        command: "cat",
                    })];
            case 1:
                session = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.requestHuman(session.id, "")).rejects.toThrow("requires a reason")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.requestHuman(session.id, "x".repeat(241))).rejects.toThrow("240 characters or fewer")];
            case 3:
                _a.sent();
                // A 240-character reason is exactly at the limit and accepted.
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.requestHuman(session.id, "x".repeat(240))).resolves.toBeDefined()];
            case 4:
                // A 240-character reason is exactly at the limit and accepted.
                _a.sent();
                return [4 /*yield*/, registry.stop(session.id)];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.requestHuman(session.id, "still needs input")).rejects.toThrow("exited")];
            case 6:
                _a.sent();
                return [4 /*yield*/, registry.dispose()];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry mayWaitForHuman is a conservative weak fact", function () { return __awaiter(void 0, void 0, void 0, function () {
    var output, paneID, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                output = "";
                paneID = 603;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var id;
                            return __generator(this, function (_a) {
                                id = paneID++;
                                return [2 /*return*/, { pane_id: id, window_id: 1, tab_id: id }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            pane_id: paneID - 1,
                                            window_id: 1,
                                            tab_id: paneID - 1,
                                            rows: 24,
                                            cols: 80,
                                        },
                                    ]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, output];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                }, { windowMode: "windowless", mayWaitGraceMs: 30 });
                return [4 /*yield*/, registry.start({
                        id: "mw_1",
                        cwd: "/repo",
                        command: "ssh host",
                    })];
            case 1:
                session = _a.sent();
                // No model write yet: never suggests.
                output = "Password: ";
                return [4 /*yield*/, registry.read(session.id)];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(session.mayWaitForHuman).toBe(false);
                // Model writes; output arrives after; the pane is silent past the grace.
                return [4 /*yield*/, registry.write(session.id, "\r")];
            case 4:
                // Model writes; output arrives after; the pane is silent past the grace.
                _a.sent();
                output = "Password: \nenter password: ";
                return [4 /*yield*/, registry.read(session.id)];
            case 5:
                _a.sent();
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 6:
                _a.sent();
                (0, bun_test_1.expect)(session.mayWaitForHuman).toBe(false);
                return [4 /*yield*/, Bun.sleep(60)];
            case 7:
                _a.sent();
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 8:
                _a.sent();
                (0, bun_test_1.expect)(session.mayWaitForHuman).toBe(true);
                // The model writes again: the fact clears.
                return [4 /*yield*/, registry.write(session.id, "hunter2\n")];
            case 9:
                // The model writes again: the fact clears.
                _a.sent();
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 10:
                _a.sent();
                (0, bun_test_1.expect)(session.mayWaitForHuman).toBe(false);
                // Output again, grace passes, but a human now holds input: no suggestion.
                output = "Welcome to host";
                return [4 /*yield*/, registry.read(session.id)];
            case 11:
                _a.sent();
                return [4 /*yield*/, Bun.sleep(60)];
            case 12:
                _a.sent();
                registry.claimHumanInput(session.id);
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 13:
                _a.sent();
                (0, bun_test_1.expect)(session.mayWaitForHuman).toBe(false);
                registry.releaseHumanControl(session.id);
                // A computation that outlives the grace reads true too — content is never
                // inspected, which is exactly why the fact says "may".
                return [4 /*yield*/, registry.write(session.id, "make -j8\n")];
            case 14:
                // A computation that outlives the grace reads true too — content is never
                // inspected, which is exactly why the fact says "may".
                _a.sent();
                output = "Compiling...";
                return [4 /*yield*/, registry.read(session.id)];
            case 15:
                _a.sent();
                return [4 /*yield*/, Bun.sleep(60)];
            case 16:
                _a.sent();
                return [4 /*yield*/, registry.reconcile({ force: true })];
            case 17:
                _a.sent();
                (0, bun_test_1.expect)(session.mayWaitForHuman).toBe(true);
                return [4 /*yield*/, registry.dispose()];
            case 18:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("background starts neither open the hub nor steal focus (I1)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var focused, audit, nextPane, registry, bg, fg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                focused = [];
                audit = [];
                nextPane = 801;
                registry = new index_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var paneID;
                            return __generator(this, function (_a) {
                                paneID = nextPane++;
                                return [2 /*return*/, { pane_id: paneID, window_id: 1, tab_id: paneID }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            pane_id: nextPane - 1,
                                            window_id: 1,
                                            tab_id: nextPane - 1,
                                            rows: 24,
                                            cols: 80,
                                        },
                                    ]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function (paneID, options) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: paneID, window_id: 1, tab_id: paneID }];
                            });
                        });
                    },
                    focus: function (paneID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                focused.push(paneID);
                                return [2 /*return*/];
                            });
                        });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                }, { windowMode: "window", onAudit: function (e) { return audit.push(e); } });
                registry.setActiveSession("ses_fg");
                return [4 /*yield*/, registry.start({
                        id: "i1_bg",
                        cwd: "/repo",
                        command: "cat",
                        sessionID: "ses_bg",
                    })];
            case 1:
                bg = _a.sent();
                (0, bun_test_1.expect)(focused).toEqual([]);
                (0, bun_test_1.expect)(audit.at(-1)).toMatchObject({
                    action: "started",
                    actor: "model",
                });
                (0, bun_test_1.expect)(bg.attached).toBe(true);
                return [4 /*yield*/, registry.start({
                        id: "i1_fg",
                        cwd: "/repo",
                        command: "cat",
                        sessionID: "ses_fg",
                    })];
            case 2:
                fg = _a.sent();
                (0, bun_test_1.expect)(focused).toEqual([fg.paneID]);
                return [4 /*yield*/, registry.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry windowless mode never opens a window and records the timeline fact", function () { return __awaiter(void 0, void 0, void 0, function () {
    var audit, opened, host, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                audit = [];
                opened = 0;
                host = {
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 71, window_id: 1, tab_id: 71, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 71, window_id: 1, tab_id: 71, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function (paneID, _options) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                opened += 1;
                                return [2 /*return*/, { pane_id: paneID, window_id: 1, tab_id: paneID }];
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                };
                registry = new index_1.NativeTerminalRegistry(host, {
                    windowMode: "windowless",
                    onAudit: function (event) { return audit.push(event); },
                });
                return [4 /*yield*/, registry.start({
                        id: "wl_1",
                        cwd: "/repo",
                        command: "cat",
                    })];
            case 1:
                session = _a.sent();
                (0, bun_test_1.expect)(opened).toBe(0);
                (0, bun_test_1.expect)(audit.at(-1)).toMatchObject({
                    id: "wl_1",
                    action: "started",
                    actor: "model",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.read(session.id)).resolves.toMatchObject({ text: "" })];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry auto mode degrades to windowless when the window attach fails", function () { return __awaiter(void 0, void 0, void 0, function () {
    var audit, stopped, host, registry, session;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                audit = [];
                stopped = 0;
                host = {
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 72, window_id: 1, tab_id: 72, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 72, window_id: 1, tab_id: 72, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new Error("no display: WezTerm GUI could not start");
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                stopped += 1;
                                return [2 /*return*/];
                            });
                        });
                    },
                };
                registry = new index_1.NativeTerminalRegistry(host, {
                    onAudit: function (event) { return audit.push(event); },
                });
                return [4 /*yield*/, registry.start({
                        id: "auto_1",
                        cwd: "/repo",
                        command: "cat",
                    })];
            case 1:
                session = _a.sent();
                (0, bun_test_1.expect)(stopped).toBe(0);
                (0, bun_test_1.expect)(audit.at(-1)).toMatchObject({
                    id: "auto_1",
                    action: "started",
                    actor: "model",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.read(session.id)).resolves.toMatchObject({ text: "" })];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.dispose()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native registry explicit window mode fails loudly when the attach fails", function () { return __awaiter(void 0, void 0, void 0, function () {
    var audit, stopped, host, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                audit = [];
                stopped = 0;
                host = {
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 73, window_id: 1, tab_id: 73, rows: 24, cols: 80 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 73, window_id: 1, tab_id: 73, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ""];
                            });
                        });
                    },
                    write: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    open: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new Error("no display: WezTerm GUI could not start");
                            });
                        });
                    },
                    focus: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    resize: function () {
                        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); });
                    },
                    stop: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                stopped += 1;
                                return [2 /*return*/];
                            });
                        });
                    },
                };
                registry = new index_1.NativeTerminalRegistry(host, {
                    windowMode: "window",
                    onAudit: function (event) { return audit.push(event); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.start({ id: "win_1", cwd: "/repo", command: "cat" })).rejects.toThrow(/no display/u)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(stopped).toBe(1);
                (0, bun_test_1.expect)(registry.list()).toHaveLength(0);
                (0, bun_test_1.expect)(audit).toHaveLength(0);
                return [4 /*yield*/, registry.dispose()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
