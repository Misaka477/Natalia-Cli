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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var plugin_1 = require("@natalia/plugin");
var src_1 = require("../src");
var runtime_services_1 = require("@natalia/runtime-services");
var tools_1 = require("@anthelia/tools");
function terminalRegistry() {
    var _a;
    var registry = new tools_1.ToolRegistry();
    for (var _i = 0, _b = (0, src_1.terminalTools)(); _i < _b.length; _i++) {
        var tool = _b[_i];
        registry.set(tool.name, tool);
    }
    for (var _c = 0, _d = Object.entries((_a = (0, src_1.terminalToolFamily)().aliases) !== null && _a !== void 0 ? _a : {}); _c < _d.length; _c++) {
        var _e = _d[_c], alias = _e[0], target = _e[1];
        registry.addAlias(alias, target);
    }
    return registry;
}
(0, bun_test_1.test)("the terminal plugin owns its tools and aliases and unloads cleanly", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry, _i, _a, tool, _b, _c, tool;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                tools = new tools_1.ToolRegistry();
                registry = (0, plugin_1.createPluginRegistry)({ tools: tools });
                return [4 /*yield*/, registry.load((0, src_1.createTerminalPlugin)({
                        workspaceRoot: "/tmp",
                        publish: function () { return undefined; },
                        onPerformance: function () { return undefined; },
                        runtimeID: function () { return "runtime-test"; },
                        userRuntimeHome: function () { return undefined; },
                        windowMode: function () { return "auto"; },
                    }))];
            case 1:
                _d.sent();
                (0, bun_test_1.expect)(registry.list()[0]).toMatchObject({
                    id: src_1.TERMINAL_PLUGIN_ID,
                    scope: "session",
                });
                for (_i = 0, _a = (0, src_1.terminalTools)(); _i < _a.length; _i++) {
                    tool = _a[_i];
                    (0, bun_test_1.expect)(tools.has(tool.name)).toBe(true);
                }
                (0, bun_test_1.expect)(tools.has("interactive_start")).toBe(true);
                return [4 /*yield*/, registry.unload(src_1.TERMINAL_PLUGIN_ID)];
            case 2:
                _d.sent();
                for (_b = 0, _c = (0, src_1.terminalTools)(); _b < _c.length; _b++) {
                    tool = _c[_b];
                    (0, bun_test_1.expect)(tools.has(tool.name)).toBe(false);
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("omitted backend uses the in-process PTY controller", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, services, plugin, controller;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                tools = new tools_1.ToolRegistry();
                services = new Map();
                plugin = (0, src_1.createTerminalPlugin)({
                    workspaceRoot: "/tmp",
                    publish: function () { return undefined; },
                    onPerformance: function () { return undefined; },
                    runtimeID: function () { return "runtime-test"; },
                    userRuntimeHome: function () { return undefined; },
                    windowMode: function () { return "auto"; },
                });
                return [4 /*yield*/, plugin.setup({
                        config: {},
                        tools: {
                            register: function (tool) {
                                tools.set(tool.name, tool);
                                return function () { return tools.delete(tool.name); };
                            },
                            registerAlias: function (alias, target) {
                                return tools.addAlias(alias, target);
                            },
                        },
                        services: {
                            provide: function (name, value) {
                                services.set(name, value);
                                return function () { return services.delete(name); };
                            },
                            get: function () { return undefined; },
                            on: function () { return function () { return undefined; }; },
                        },
                        events: { on: function () { return function () { return undefined; }; } },
                        commands: { register: function () { return function () { return undefined; }; } },
                        resources: { register: function () { return function () { return undefined; }; } },
                        projections: { register: function () { return function () { return undefined; }; } },
                        workflows: { register: function () { return function () { return undefined; }; } },
                        settingsSchema: { register: function () { return function () { return undefined; }; } },
                        adapters: {
                            register: function () { return function () { return undefined; }; },
                            registerUi: function () { return function () { return undefined; }; },
                        },
                        scheduler: { add: function () { return function () { return undefined; }; } },
                        effects: {
                            signal: new AbortController().signal,
                            run: function (effect) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, effect(new AbortController().signal)];
                            }); }); },
                        },
                    })];
            case 1:
                _b.sent();
                controller = services.get(runtime_services_1.terminalController.id);
                (0, bun_test_1.expect)(typeof controller.subscribeOutput).toBe("function");
                return [4 /*yield*/, controller.close()];
            case 2:
                _b.sent();
                return [4 /*yield*/, ((_a = plugin.dispose) === null || _a === void 0 ? void 0 : _a.call(plugin))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("interactive Terminal tools keep model I/O on one native host pane", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, writes, nativeTerminal, context, tools, startResult, started, _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-interactive-"))];
            case 1:
                root = _m.sent();
                writes = [];
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "native terminal output"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_tools" }, context)];
            case 2:
                startResult = _m.sent();
                started = JSON.parse(startResult);
                (0, bun_test_1.expect)(started).toMatchObject({
                    id: "tty_tools",
                    status: "running",
                    paneID: 73,
                });
                return [4 /*yield*/, tools
                        .get("interactive_terminal_write")
                        .execute({ id: "tty_tools", input: "tool input\n" }, context)];
            case 3:
                _m.sent();
                _a = bun_test_1.expect;
                _c = (_b = JSON).parse;
                return [4 /*yield*/, tools
                        .get("interactive_terminal_send_line")
                        .execute({ id: "tty_tools", text: "atomic command", idempotencyKey: "line_1" }, context)];
            case 4:
                _a.apply(void 0, [_c.apply(_b, [_m.sent()])]).toMatchObject({ writtenBytes: 15, submitted: true, delivery: "accepted" });
                _d = bun_test_1.expect;
                _f = (_e = JSON).parse;
                return [4 /*yield*/, tools.get("interactive_terminal_write").execute({
                        id: "tty_tools",
                        input: "idempotent input\n",
                        idempotencyKey: "write_1",
                    }, context)];
            case 5:
                _d.apply(void 0, [_f.apply(_e, [_m.sent()])]).toMatchObject({ delivery: "accepted" });
                _g = bun_test_1.expect;
                _j = (_h = JSON).parse;
                return [4 /*yield*/, tools.get("interactive_terminal_write").execute({
                        id: "tty_tools",
                        input: "idempotent input\n",
                        idempotencyKey: "write_1",
                    }, context)];
            case 6:
                _g.apply(void 0, [_j.apply(_h, [_m.sent()])]).toMatchObject({ delivery: "duplicate" });
                return [4 /*yield*/, tools
                        .get("interactive_terminal_keys")
                        .execute({ id: "tty_tools", key: "ctrl-c" }, context)];
            case 7:
                _m.sent();
                return [4 /*yield*/, nativeTerminal.openHub()];
            case 8:
                _m.sent();
                return [4 /*yield*/, nativeTerminal.claimHumanInput("tty_tools")];
            case 9:
                _m.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(tools
                        .get("interactive_terminal_write")
                        .execute({ id: "tty_tools", input: "must not interleave" }, context)).rejects.toThrow("controlled by a human")];
            case 10:
                _m.sent();
                nativeTerminal.releaseHumanControl("tty_tools");
                _k = bun_test_1.expect;
                return [4 /*yield*/, tools
                        .get("interactive_terminal_read")
                        .execute({ id: "tty_tools" }, context)];
            case 11:
                _k.apply(void 0, [_m.sent()]).toContain("native terminal output");
                (0, bun_test_1.expect)(writes.join("")).toBe("tool input\natomic command\ridempotent input\n\x03");
                (0, bun_test_1.expect)(tools.has("interactive_start")).toBe(true);
                (0, bun_test_1.expect)(tools.has("interactive_send_line")).toBe(true);
                (0, bun_test_1.expect)(tools.has("interactive_terminal_attach")).toBe(false);
                (0, bun_test_1.expect)(tools.has("interactive_terminal_detach")).toBe(false);
                (0, bun_test_1.expect)(tools.has("interactive_attach")).toBe(false);
                (0, bun_test_1.expect)(tools.has("interactive_detach")).toBe(false);
                (0, bun_test_1.expect)((_l = tools.get("interactive_start")) === null || _l === void 0 ? void 0 : _l.name).toBe("interactive_terminal_start");
                (0, bun_test_1.expect)(__spreadArray([], tools.keys(), true)).not.toContain("interactive_start");
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_tools" }, context)];
            case 12:
                _m.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("encodes normalized native terminal key sequences", function () {
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "enter" })).toBe("\r");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "Esc" })).toBe("\x1b");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "ArrowUp", modifiers: ["ctrl"] })).toBe("\x1b[1;5A");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "Delete", modifiers: ["alt", "shift"] })).toBe("\x1b[3;4~");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "F12", repeat: 2 })).toBe("\x1b[24~\x1b[24~");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "c", modifiers: ["ctrl", "alt"] })).toBe("\x1b\x03");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ text: "你好", repeat: 2 })).toBe("你好你好");
    (0, bun_test_1.expect)(function () { return (0, tools_1.encodeTerminalKey)({ key: "Unknown" }); }).toThrow("unsupported terminal key");
    (0, bun_test_1.expect)(function () {
        return (0, tools_1.encodeTerminalKey)({ key: "Enter", modifiers: ["ctrl"] });
    }).toThrow("not encodable");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "V" })).toBe("V");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ key: "A", modifiers: ["ctrl"] })).toBe("\x01");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ text: "vim" })).toBe("vim");
    (0, bun_test_1.expect)((0, tools_1.encodeTerminalKey)({ text: "你好🚀" })).toBe("你好🚀");
});
(0, bun_test_1.test)("unified interactive terminal input tool sends text and key sequences", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, writes, nativeTerminal, context, tools;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-input-"))];
            case 1:
                root = _a.sent();
                writes = [];
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "native terminal output"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_input" }, context)];
            case 2:
                _a.sent();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_input")
                        .execute({ id: "tty_input", text: "vim" }, context)];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(writes.at(-1)).toBe("vim\r");
                return [4 /*yield*/, tools
                        .get("interactive_terminal_input")
                        .execute({ id: "tty_input", text: "vim", submit: false }, context)];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(writes.at(-1)).toBe("vim");
                return [4 /*yield*/, tools.get("interactive_terminal_input").execute({
                        id: "tty_input",
                        keys: [{ key: "ArrowUp" }, { key: "Enter" }],
                    }, context)];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(writes.at(-1)).toBe("\x1b[A\r");
                // Ordering lives inside the sequence, so text entries are sent in place.
                return [4 /*yield*/, tools.get("interactive_terminal_input").execute({
                        id: "tty_input",
                        keys: [{ key: "i" }, { text: "hello" }, { key: "Escape" }],
                    }, context)];
            case 6:
                // Ordering lives inside the sequence, so text entries are sent in place.
                _a.sent();
                (0, bun_test_1.expect)(writes.at(-1)).toBe("ihello\x1b");
                // Mixing the two fields cannot express order, and used to send every
                // character of text before the keys regardless of intent.
                return [4 /*yield*/, (0, bun_test_1.expect)(tools.get("interactive_terminal_input").execute({
                        id: "tty_input",
                        text: "vim",
                        keys: [{ key: "Escape" }],
                        submit: false,
                    }, context)).rejects.toThrow(/cannot be combined/u)];
            case 7:
                // Mixing the two fields cannot express order, and used to send every
                // character of text before the keys regardless of intent.
                _a.sent();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_input")
                        .execute({ id: "tty_input", text: "Vim" }, context)];
            case 8:
                _a.sent();
                (0, bun_test_1.expect)(writes.at(-1)).toBe("Vim\r");
                (0, bun_test_1.expect)(tools.has("interactive_input")).toBe(true);
                (0, bun_test_1.expect)(tools.has("interactive_terminal_input")).toBe(true);
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_input" }, context)];
            case 9:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("interactive terminal snapshot returns cursor and revision without afterRevision", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, nativeTerminal, context, tools, snap, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-snapshot-"))];
            case 1:
                root = _c.sent();
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "snapshot output"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_snapshot" }, context)];
            case 2:
                _c.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, tools
                        .get("interactive_terminal_snapshot")
                        .execute({ id: "tty_snapshot" }, context)];
            case 3:
                snap = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(snap).toMatchObject({
                    id: "tty_snapshot",
                    host: "wezterm",
                    text: "snapshot output",
                    cursorX: 0,
                    cursorY: 0,
                    rows: 24,
                    cols: 80,
                    status: "running",
                    inputOwner: "model",
                });
                (0, bun_test_1.expect)(typeof snap.revision).toBe("number");
                (0, bun_test_1.expect)(tools.has("interactive_snapshot")).toBe(true);
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_snapshot" }, context)];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal observe latest mode returns current state without waiting", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, nativeTerminal, context, tools, obs, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-observe-"))];
            case 1:
                root = _c.sent();
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "latest output"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_observe" }, context)];
            case 2:
                _c.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, tools
                        .get("terminal_observe")
                        .execute({ id: "tty_observe", afterRevision: 0, mode: "latest" }, context)];
            case 3:
                obs = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(obs).toMatchObject({
                    id: "tty_observe",
                    mode: "latest",
                    text: "latest output",
                    cursorX: 0,
                    cursorY: 0,
                    rows: 24,
                    cols: 80,
                    currentRevision: bun_test_1.expect.any(Number),
                });
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_observe" }, context)];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal observe tail mode returns only recent lines", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, nativeTerminal, context, tools, obs, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-observe-"))];
            case 1:
                root = _c.sent();
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "line1\nline2\nline3\nline4\nline5\n"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_tail" }, context)];
            case 2:
                _c.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, tools
                        .get("terminal_observe")
                        .execute({ id: "tty_tail", afterRevision: 0, mode: "tail", scrollbackRows: 3 }, context)];
            case 3:
                obs = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(obs.text).toBe("line3\nline4\nline5");
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_tail" }, context)];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal observe cursor mode returns lines around cursor", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, lines, nativeTerminal, context, tools, obs, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-observe-"))];
            case 1:
                root = _c.sent();
                lines = Array.from({ length: 30 }, function (_, i) { return "line".concat(i); }).join("\n") + "\n";
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                            cursor_x: 0,
                                            cursor_y: 15,
                                        },
                                    ]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, lines];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_cursor" }, context)];
            case 2:
                _c.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, tools
                        .get("terminal_observe")
                        .execute({ id: "tty_cursor", afterRevision: 0, mode: "cursor" }, context)];
            case 3:
                obs = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(obs.cursorY).toBe(15);
                (0, bun_test_1.expect)(obs.text).toContain(Array.from({ length: 11 }, function (_, i) { return "line".concat(i + 10); }).join("\n") + "\n");
                (0, bun_test_1.expect)(obs.text).not.toContain("line0");
                (0, bun_test_1.expect)(obs.text).not.toContain("line29");
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_cursor" }, context)];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal observe new_only mode returns only new text since last observation", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, readCall, nativeTerminal, context, tools, first, _a, _b, second, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-observe-"))];
            case 1:
                root = _e.sent();
                readCall = 0;
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                readCall += 1;
                                if (readCall === 1)
                                    return [2 /*return*/, "initial text\n"];
                                return [2 /*return*/, "initial text\nnew line 1\nnew line 2\n"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_new_only" }, context)];
            case 2:
                _e.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, tools
                        .get("terminal_observe")
                        .execute({ id: "tty_new_only", afterRevision: 0, mode: "new_only" }, context)];
            case 3:
                first = _b.apply(_a, [_e.sent()]);
                (0, bun_test_1.expect)(first.text).toBe("initial text\n");
                _d = (_c = JSON).parse;
                return [4 /*yield*/, tools.get("terminal_observe").execute({
                        id: "tty_new_only",
                        afterRevision: first.currentRevision,
                        mode: "new_only",
                    }, context)];
            case 4:
                second = _d.apply(_c, [_e.sent()]);
                (0, bun_test_1.expect)(second.text).toBe("new line 1\nnew line 2\n");
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_new_only" }, context)];
            case 5:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("interactive terminal input paste mode wraps text in bracketed paste escape sequences", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, writes, nativeTerminal, context, tools, result, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-paste-"))];
            case 1:
                root = _c.sent();
                writes = [];
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "native terminal output"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_paste" }, context)];
            case 2:
                _c.sent();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_input")
                        .execute({ id: "tty_paste", text: "hello world", paste: true }, context)];
            case 3:
                _c.sent();
                (0, bun_test_1.expect)(writes.at(-1)).toBe("\x1b[?2004hhello world\x1b[?2004l");
                _b = (_a = JSON).parse;
                return [4 /*yield*/, tools
                        .get("interactive_terminal_input")
                        .execute({ id: "tty_paste", text: "vim", paste: true }, context)];
            case 4:
                result = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(result.submitted).toBe(false);
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_paste" }, context)];
            case 5:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal observe afterRevision is optional and defaults to current state", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, nativeTerminal, context, tools, obs, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tools-observe-"))];
            case 1:
                root = _c.sent();
                nativeTerminal = new src_1.NativeTerminalRegistry({
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
                                return [2 /*return*/, [{ pane_id: 73, window_id: 3, tab_id: 5, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "no afterRevision output"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_no_ar" }, context)];
            case 2:
                _c.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, tools
                        .get("terminal_observe")
                        .execute({ id: "tty_no_ar", mode: "latest" }, context)];
            case 3:
                obs = _b.apply(_a, [_c.sent()]);
                (0, bun_test_1.expect)(obs.text).toBe("no afterRevision output");
                (0, bun_test_1.expect)(obs.currentRevision).toBe(obs.revision);
                return [4 /*yield*/, tools
                        .get("interactive_terminal_stop")
                        .execute({ id: "tty_no_ar" }, context)];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native terminal scrollback pages preserve CJK line boundaries and cursors", function () {
    var text = Array.from({ length: 4000 }, function (_, index) { return "\u7B2C".concat(index, "\u884C\n"); }).join("");
    var first = (0, tools_1.nativeTerminalReadPage)(text, { startLine: 100 });
    (0, bun_test_1.expect)(first).toMatchObject({
        truncated: true,
        totalBytes: new TextEncoder().encode(text).byteLength,
        endLine: 100 + first.deliveredLines - 1,
        nextStartLine: 100 + first.deliveredLines,
    });
    (0, bun_test_1.expect)(first.text.endsWith("\n")).toBe(true);
    (0, bun_test_1.expect)(new TextDecoder().decode(new TextEncoder().encode(first.text))).toBe(first.text);
    var final = (0, tools_1.nativeTerminalReadPage)("最后一行", { startLine: 4100 });
    (0, bun_test_1.expect)(final).toMatchObject({
        truncated: false,
        deliveredLines: 1,
        endLine: 4100,
        nextStartLine: undefined,
    });
});
(0, bun_test_1.test)("native terminal search pages bounded Unicode matches without screen transport", function () {
    var text = Array.from({ length: 200 }, function (_, index) { return "line ".concat(index).concat(index % 50 === 0 ? " 命中" : "", "\n"); }).join("");
    var result = (0, tools_1.nativeTerminalSearchPage)(text, {
        query: "命中",
        startLine: 500,
        endLine: 900,
        requestedEndLine: 900,
        maxMatches: 2,
    });
    (0, bun_test_1.expect)(result).toMatchObject({
        searchedRange: { startLine: 500, endLine: 699, scannedLines: 200 },
        matches: [
            { line: 500, text: "line 0 命中" },
            { line: 550, text: "line 50 命中" },
        ],
        truncatedMatches: true,
        nextCursor: { startLine: 700, endLine: 900 },
    });
    var final = (0, tools_1.nativeTerminalSearchPage)("one\n命中\n", {
        query: "命中",
        startLine: 900,
        endLine: 901,
        requestedEndLine: 901,
        maxMatches: 20,
    });
    (0, bun_test_1.expect)(final).toMatchObject({
        matches: [{ line: 901, text: "命中" }],
        nextCursor: undefined,
    });
});
(0, bun_test_1.test)("terminal_observe latest reports a point-in-time read, not a wait outcome", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, nativeTerminal, context, tools, latest, _a, _b, _c, repeated, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-observe-latest-"))];
            case 1:
                root = _g.sent();
                nativeTerminal = new src_1.NativeTerminalRegistry({
                    kind: "wezterm",
                    executable: "wezterm",
                    spawn: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pane_id: 91, window_id: 1, tab_id: 1 }];
                            });
                        });
                    },
                    list: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ pane_id: 91, window_id: 1, tab_id: 1, rows: 24, cols: 80 }]];
                            });
                        });
                    },
                    read: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "screen contents"];
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
                context = { workspaceRoot: root, terminal: nativeTerminal };
                tools = terminalRegistry();
                return [4 /*yield*/, tools
                        .get("interactive_terminal_start")
                        .execute({ command: "cat", id: "tty_latest" }, context)];
            case 2:
                _g.sent();
                _b = (_a = JSON).parse;
                _c = String;
                return [4 /*yield*/, tools
                        .get("terminal_observe")
                        .execute({ id: "tty_latest", mode: "latest" }, context)];
            case 3:
                latest = _b.apply(_a, [_c.apply(void 0, [_g.sent()])]);
                // Nothing waited, so no deadline can have passed. Reporting "timeout" made a
                // freshly read screen look like a stale frame.
                (0, bun_test_1.expect)(latest.reason).toBe("latest");
                (0, bun_test_1.expect)(latest.text).toContain("screen contents");
                _e = (_d = JSON).parse;
                _f = String;
                return [4 /*yield*/, tools.get("terminal_observe").execute({
                        id: "tty_latest",
                        mode: "latest",
                        afterRevision: latest.currentRevision,
                    }, context)];
            case 4:
                repeated = _e.apply(_d, [_f.apply(void 0, [_g.sent()])]);
                (0, bun_test_1.expect)(repeated.reason).toBe("latest");
                (0, bun_test_1.expect)(repeated.changed).toBe(false);
                (0, bun_test_1.expect)(repeated.text).toContain("screen contents");
                return [2 /*return*/];
        }
    });
}); });
