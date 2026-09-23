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
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var src_1 = require("../src");
function fakePty() {
    var processes = [];
    var nextPid = 1000;
    var factory = function () {
        var dataListeners = new Set();
        var exitListeners = new Set();
        var process = {
            pid: nextPid++,
            write: function (data) {
                for (var _i = 0, dataListeners_1 = dataListeners; _i < dataListeners_1.length; _i++) {
                    var listener = dataListeners_1[_i];
                    listener(data);
                }
            },
            resize: function () { },
            kill: function () {
                process.exit(0);
            },
            onData: function (listener) {
                dataListeners.add(listener);
                return {
                    dispose: function () {
                        dataListeners.delete(listener);
                    },
                };
            },
            onExit: function (listener) {
                exitListeners.add(listener);
                return {
                    dispose: function () {
                        exitListeners.delete(listener);
                    },
                };
            },
            emit: function (data) {
                for (var _i = 0, dataListeners_2 = dataListeners; _i < dataListeners_2.length; _i++) {
                    var listener = dataListeners_2[_i];
                    listener(data);
                }
            },
            exit: function (code) {
                if (code === void 0) { code = 0; }
                for (var _i = 0, exitListeners_1 = exitListeners; _i < exitListeners_1.length; _i++) {
                    var listener = exitListeners_1[_i];
                    listener({ exitCode: code });
                }
            },
        };
        processes.push(process);
        return process;
    };
    return { factory: factory, processes: processes };
}
function controllerInput(root, spawn, events) {
    if (events === void 0) { events = []; }
    return {
        workspaceRoot: root,
        publish: function (event) {
            events.push(event);
        },
        onPerformance: function () { return undefined; },
        runtimeID: function () { return "runtime-test"; },
        userRuntimeHome: function () { return undefined; },
        windowMode: function () { return "windowless"; },
        spawn: spawn,
    };
}
(0, bun_test_1.test)("pty controller start is idempotent per terminal id, not per natalia session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller, first, same, second, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-idempotent-"))];
            case 1:
                root = _c.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.init()];
            case 2:
                _c.sent();
                return [4 /*yield*/, controller.init()];
            case 3:
                _c.sent();
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_a",
                        sessionID: "ses_one",
                    })];
            case 4:
                first = _c.sent();
                return [4 /*yield*/, controller.start({
                        command: "zsh",
                        cwd: root,
                        id: "term_a",
                        sessionID: "ses_one",
                    })];
            case 5:
                same = _c.sent();
                return [4 /*yield*/, controller.start({
                        command: "zsh",
                        cwd: root,
                        id: "term_b",
                        sessionID: "ses_one",
                    })];
            case 6:
                second = _c.sent();
                (0, bun_test_1.expect)(same.id).toBe(first.id);
                (0, bun_test_1.expect)(second.id).not.toBe(first.id);
                (0, bun_test_1.expect)(first.host).toBe("pty");
                (0, bun_test_1.expect)(processes).toHaveLength(2);
                _b = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 7:
                _b.apply(void 0, [_c.sent()]).toHaveLength(2);
                return [4 /*yield*/, controller.close()];
            case 8:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller start with the same id returns the running session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller, first, second;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-same-id-"))];
            case 1:
                root = _b.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_web",
                    })];
            case 2:
                first = _b.sent();
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_web",
                    })];
            case 3:
                second = _b.sent();
                (0, bun_test_1.expect)(second.id).toBe(first.id);
                (0, bun_test_1.expect)(processes).toHaveLength(1);
                return [4 /*yield*/, controller.close()];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller write, read, resize, and observe", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, factory, controller, started, written, duplicate, again, snapshot, read, resized, observed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-io-"))];
            case 1:
                root = _a.sent();
                factory = fakePty().factory;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.start({ command: "cat", cwd: root })];
            case 2:
                started = _a.sent();
                return [4 /*yield*/, controller.write(started.id, "hello\n")];
            case 3:
                written = _a.sent();
                (0, bun_test_1.expect)(written).toEqual({ writtenBytes: 6, delivery: "accepted" });
                return [4 /*yield*/, controller.write(started.id, "hello\n", {
                        idempotencyKey: "k1",
                    })];
            case 4:
                duplicate = _a.sent();
                (0, bun_test_1.expect)(duplicate.delivery).toBe("accepted");
                return [4 /*yield*/, controller.write(started.id, "hello\n", {
                        idempotencyKey: "k1",
                    })];
            case 5:
                again = _a.sent();
                (0, bun_test_1.expect)(again.delivery).toBe("duplicate");
                return [4 /*yield*/, controller.snapshot(started.id)];
            case 6:
                snapshot = _a.sent();
                (0, bun_test_1.expect)(snapshot.text).toBe("hello\nhello\n");
                return [4 /*yield*/, controller.read(started.id)];
            case 7:
                read = _a.sent();
                (0, bun_test_1.expect)(read.text).toBe("hello\nhello\n");
                return [4 /*yield*/, controller.resize(started.id, 40, 120, "human")];
            case 8:
                resized = _a.sent();
                (0, bun_test_1.expect)(resized.rows).toBe(40);
                (0, bun_test_1.expect)(resized.cols).toBe(120);
                return [4 /*yield*/, controller.observe(started.id, 0, { timeoutMs: 50 })];
            case 9:
                observed = _a.sent();
                (0, bun_test_1.expect)(observed.changed).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 10:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller close kills remaining processes and rejects later start", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-close-"))];
            case 1:
                root = _c.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.start({ command: "bash", cwd: root, sessionID: "ses_a" })];
            case 2:
                _c.sent();
                return [4 /*yield*/, controller.close()];
            case 3:
                _c.sent();
                return [4 /*yield*/, controller.close()];
            case 4:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 5:
                _b.apply(void 0, [_c.sent()]).toEqual([]);
                (0, bun_test_1.expect)(processes[0].pid).toBeGreaterThan(0);
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.start({ command: "bash", cwd: root })).rejects.toThrow("terminal controller is closed")];
            case 6:
                _c.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.init()).rejects.toThrow("terminal controller is closed")];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller start without an id creates a new terminal each time", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller, first, second;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-default-"))];
            case 1:
                root = _b.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.start({ command: "bash", cwd: root })];
            case 2:
                first = _b.sent();
                return [4 /*yield*/, controller.start({ command: "bash", cwd: root })];
            case 3:
                second = _b.sent();
                (0, bun_test_1.expect)(second.id).not.toBe(first.id);
                (0, bun_test_1.expect)(processes).toHaveLength(2);
                return [4 /*yield*/, controller.close()];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller isolates sessions via setActiveSession", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller, a, b, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-isolate-"))];
            case 1:
                root = _e.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                controller.setActiveSession("ses_a");
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        sessionID: "ses_a",
                    })];
            case 2:
                a = _e.sent();
                controller.setActiveSession("ses_b");
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        sessionID: "ses_b",
                    })];
            case 3:
                b = _e.sent();
                (0, bun_test_1.expect)(a.id).not.toBe(b.id);
                (0, bun_test_1.expect)(processes).toHaveLength(2);
                _b = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 4:
                _b.apply(void 0, [_e.sent()]).toEqual([
                    bun_test_1.expect.objectContaining({ id: b.id }),
                ]);
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.read(a.id)).rejects.toThrow(/belongs to session/)];
            case 5:
                _e.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.write(a.id, "from-b\n")).rejects.toThrow(/belongs to session/)];
            case 6:
                _e.sent();
                controller.setActiveSession("ses_a");
                _c = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 7:
                _c.apply(void 0, [(_e.sent()).map(function (session) { return session.id; })]).toEqual([
                    a.id,
                ]);
                _d = bun_test_1.expect;
                return [4 /*yield*/, controller.read(a.id)];
            case 8:
                _d.apply(void 0, [(_e.sent()).text]).toBe("");
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.write(a.id, "from-a\n")).resolves.toMatchObject({
                        delivery: "accepted",
                    })];
            case 9:
                _e.sent();
                return [4 /*yield*/, controller.close()];
            case 10:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller subscribeOutput replays buffer then live chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller, started, chunks, unsubscribe;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-subscribe-"))];
            case 1:
                root = _b.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.start({ command: "cat", cwd: root })];
            case 2:
                started = _b.sent();
                return [4 /*yield*/, controller.write(started.id, "hello\n")];
            case 3:
                _b.sent();
                chunks = [];
                unsubscribe = controller.subscribeOutput(started.id, function (chunk) {
                    chunks.push(chunk);
                });
                (0, bun_test_1.expect)(chunks).toEqual(["hello\n"]);
                processes[0].emit("world\n");
                (0, bun_test_1.expect)(chunks).toEqual(["hello\n", "world\n"]);
                unsubscribe();
                processes[0].emit("ignored\n");
                (0, bun_test_1.expect)(chunks).toEqual(["hello\n", "world\n"]);
                return [4 /*yield*/, controller.close()];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("default python pty spawn runs an interactive shell", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, started, text, unsubscribe, deadline;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-python-pty-"))];
            case 1:
                root = _a.sent();
                controller = (0, src_1.createPtyTerminalController)({
                    workspaceRoot: root,
                    publish: function () { return undefined; },
                    onPerformance: function () { return undefined; },
                    runtimeID: function () { return "runtime-test"; },
                    userRuntimeHome: function () { return undefined; },
                    windowMode: function () { return "windowless"; },
                });
                return [4 /*yield*/, controller.start({
                        command: "printf '__PTY_READY__\\n'",
                        cwd: root,
                        sessionID: "ses_python_pty",
                    })];
            case 2:
                started = _a.sent();
                (0, bun_test_1.expect)(started.host).toBe("pty");
                text = "";
                unsubscribe = controller.subscribeOutput(started.id, function (chunk) {
                    text += chunk;
                });
                deadline = Date.now() + 8000;
                _a.label = 3;
            case 3:
                if (!(!text.includes("__PTY_READY__") && Date.now() < deadline)) return [3 /*break*/, 5];
                return [4 /*yield*/, Bun.sleep(50)];
            case 4:
                _a.sent();
                return [3 /*break*/, 3];
            case 5:
                unsubscribe();
                (0, bun_test_1.expect)(text).toContain("__PTY_READY__");
                return [4 /*yield*/, controller.close()];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); }, 15000);
(0, bun_test_1.test)("input written the instant a pty starts is not dropped by the bridge", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, started, text, unsubscribe, deadline;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-python-pty-race-"))];
            case 1:
                root = _a.sent();
                controller = (0, src_1.createPtyTerminalController)({
                    workspaceRoot: root,
                    publish: function () { return undefined; },
                    onPerformance: function () { return undefined; },
                    runtimeID: function () { return "runtime-test"; },
                    userRuntimeHome: function () { return undefined; },
                    windowMode: function () { return "windowless"; },
                });
                return [4 /*yield*/, controller.start({
                        // The managed pane shell wraps commands in a profile-sourcing `sh -lc`;
                        // the bash
                        // inside is interactive but must not read the developer's rc files to
                        // keep the test deterministic.
                        command: "exec bash --norc --noprofile",
                        cwd: root,
                        sessionID: "ses_python_pty_race",
                    })];
            case 2:
                started = _a.sent();
                (0, bun_test_1.expect)(started.host).toBe("pty");
                return [4 /*yield*/, controller.write(started.id, "printf '__PTY_READY__\\n'\n")];
            case 3:
                _a.sent();
                text = "";
                unsubscribe = controller.subscribeOutput(started.id, function (chunk) {
                    text += chunk;
                });
                deadline = Date.now() + 8000;
                _a.label = 4;
            case 4:
                if (!(!text.includes("__PTY_READY__") && Date.now() < deadline)) return [3 /*break*/, 6];
                return [4 /*yield*/, Bun.sleep(50)];
            case 5:
                _a.sent();
                return [3 /*break*/, 4];
            case 6:
                unsubscribe();
                (0, bun_test_1.expect)(text).toContain("__PTY_READY__");
                return [4 /*yield*/, controller.close()];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); }, 15000);
(0, bun_test_1.test)("pty controller caps running terminals per natalia session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-cap-"))];
            case 1:
                root = _b.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(__assign(__assign({}, controllerInput(root, factory)), { maxPerSession: 2 }));
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_1",
                        sessionID: "ses_cap",
                    })];
            case 2:
                _b.sent();
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_2",
                        sessionID: "ses_cap",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_3",
                        sessionID: "ses_cap",
                    })).rejects.toThrow("session already has 2 running terminals")];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(processes).toHaveLength(2);
                return [4 /*yield*/, controller.close()];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller recycles the oldest idle terminal when the cap is hit", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, factory, processes, controller, first, third, listed;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-idle-"))];
            case 1:
                root = _b.sent();
                _a = fakePty(), factory = _a.factory, processes = _a.processes;
                controller = (0, src_1.createPtyTerminalController)(__assign(__assign({}, controllerInput(root, factory)), { maxPerSession: 2, idleMs: 20 }));
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_old",
                        sessionID: "ses_idle",
                    })];
            case 2:
                first = _b.sent();
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_new",
                        sessionID: "ses_idle",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, Bun.sleep(30)];
            case 4:
                _b.sent();
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_third",
                        sessionID: "ses_idle",
                    })];
            case 5:
                third = _b.sent();
                (0, bun_test_1.expect)(third.id).toBe("term_third");
                (0, bun_test_1.expect)(processes).toHaveLength(3);
                return [4 /*yield*/, controller.list()];
            case 6:
                listed = (_b.sent()).filter(function (session) { return session.status === "running"; });
                (0, bun_test_1.expect)(listed.map(function (session) { return session.id; }).sort()).toEqual([
                    "term_new",
                    "term_third",
                ]);
                (0, bun_test_1.expect)(listed.find(function (session) { return session.id === first.id; })).toBeUndefined();
                return [4 /*yield*/, controller.close()];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller stopForSession kills every pane of that session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, factory, controller, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-stop-session-"))];
            case 1:
                root = _c.sent();
                factory = fakePty().factory;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "a1",
                        sessionID: "ses_a",
                    })];
            case 2:
                _c.sent();
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "a2",
                        sessionID: "ses_a",
                    })];
            case 3:
                _c.sent();
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "b1",
                        sessionID: "ses_b",
                    })];
            case 4:
                _c.sent();
                return [4 /*yield*/, controller.stopForSession("ses_a")];
            case 5:
                _c.sent();
                controller.setActiveSession("ses_a");
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 6:
                _a.apply(void 0, [(_c.sent()).filter(function (session) { return session.status === "running"; })]).toEqual([]);
                controller.setActiveSession("ses_b");
                _b = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 7:
                _b.apply(void 0, [(_c.sent())
                        .filter(function (session) { return session.status === "running"; })
                        .map(function (session) { return session.id; })]).toEqual(["b1"]);
                return [4 /*yield*/, controller.close()];
            case 8:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pty controller refuses to reuse a terminal id from another session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, factory, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-pty-owner-"))];
            case 1:
                root = _a.sent();
                factory = fakePty().factory;
                controller = (0, src_1.createPtyTerminalController)(controllerInput(root, factory));
                return [4 /*yield*/, controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_shared",
                        sessionID: "ses_a",
                    })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.start({
                        command: "bash",
                        cwd: root,
                        id: "term_shared",
                        sessionID: "ses_b",
                    })).rejects.toThrow("belongs to session ses_a")];
            case 3:
                _a.sent();
                return [4 /*yield*/, controller.close()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
