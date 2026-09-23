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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
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
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var worker_1 = require("../src/worker");
var capability_1 = require("@natalia/capability");
function waitForWorker(predicate_1) {
    return __awaiter(this, arguments, void 0, function (predicate, timeoutMs, label) {
        var elapsed;
        if (timeoutMs === void 0) { timeoutMs = 5000; }
        if (label === void 0) { label = "condition"; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    elapsed = 0;
                    _a.label = 1;
                case 1:
                    if (!(elapsed < timeoutMs)) return [3 /*break*/, 4];
                    if (predicate())
                        return [2 /*return*/];
                    return [4 /*yield*/, Bun.sleep(10)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    elapsed += 10;
                    return [3 /*break*/, 1];
                case 4: throw new Error("timed out waiting for ".concat(label));
            }
        });
    });
}
(0, bun_test_1.test)("worker transport: submit after cancel starts the next turn instead of queueing forever", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, requests, release, createRuntime, channel, client, events;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-worker-cancel-submit-"))];
            case 1:
                root = _b.sent();
                requests = [];
                createRuntime = function () {
                    return (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                        workspaceRoot: root,
                        sessionID: "ses_worker_cancel_submit",
                        provider: {
                            provider: "test",
                            model: "test",
                            stream: function (request) {
                                return __asyncGenerator(this, arguments, function stream_1() {
                                    var text;
                                    var _a, _b;
                                    return __generator(this, function (_c) {
                                        switch (_c.label) {
                                            case 0:
                                                text = (_b = (_a = request.messages.at(-1)) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : "";
                                                requests.push(text);
                                                if (!(text === "first")) return [3 /*break*/, 2];
                                                return [4 /*yield*/, __await(new Promise(function (resolve) { return (release = resolve); }))];
                                            case 1:
                                                _c.sent();
                                                _c.label = 2;
                                            case 2: return [4 /*yield*/, __await({ type: "done" })];
                                            case 3: return [4 /*yield*/, _c.sent()];
                                            case 4:
                                                _c.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                });
                            },
                        },
                    });
                };
                channel = new MessageChannel();
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, createRuntime());
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                events = [];
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submit("first")];
            case 2:
                _b.sent();
                return [4 /*yield*/, waitForWorker(function () { return requests.includes("first"); }, 5000, "first turn")];
            case 3:
                _b.sent();
                client.cancel("stop");
                _b.label = 4;
            case 4:
                if (!!release) return [3 /*break*/, 6];
                return [4 /*yield*/, Bun.sleep(1)];
            case 5:
                _b.sent();
                return [3 /*break*/, 4];
            case 6:
                release === null || release === void 0 ? void 0 : release();
                return [4 /*yield*/, waitForWorker(function () {
                        return events.some(function (event) {
                            return event.type === "turn.finished" || event.type === "turn.cancelled";
                        });
                    })];
            case 7:
                _b.sent();
                // The second submit must be admitted and woken even though the previous
                // turn's drain may still be settling in the worker.
                return [4 /*yield*/, client.submit("second")];
            case 8:
                // The second submit must be admitted and woken even though the previous
                // turn's drain may still be settling in the worker.
                _b.sent();
                return [4 /*yield*/, waitForWorker(function () { return requests.includes("second"); }, 5000, "the second turn to reach the provider")];
            case 9:
                _b.sent();
                (0, bun_test_1.expect)(requests.filter(function (text) { return text === "first"; })).toHaveLength(1);
                (0, bun_test_1.expect)(requests).toContain("second");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 10:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("worker client buffers runtime events published before start", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, sink, host, client, events;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                channel = new MessageChannel();
                host = {
                    start: function (handler) {
                        sink = handler;
                    },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        type: "turn.submitted",
                                        id: "turn_buffered",
                                        text: text,
                                        byteLength: text.length,
                                        lineCount: 1,
                                        sha256: "test",
                                    }];
                            });
                        });
                    },
                    cancel: function () { },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snapshot_worker",
                        files: [],
                    }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                // The worker can start and emit early events before the TUI mounts and calls
                // start(). Buffering them keeps workspace/session switches from losing the
                // initial session.ready/history stream.
                sink === null || sink === void 0 ? void 0 : sink({
                    type: "session.ready",
                    sessionID: "ses_buffered",
                });
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 0); })];
            case 1:
                _a.sent();
                events = [];
                client.start(function (event) { return events.push(event); });
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "session.ready",
                    sessionID: "ses_buffered",
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("worker RuntimeClient transport remains behind contracts boundary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, sink, host, client, events;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                channel = new MessageChannel();
                host = {
                    start: function (handler) {
                        sink = handler;
                    },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            var event;
                            return __generator(this, function (_a) {
                                event = {
                                    type: "turn.submitted",
                                    id: "turn_worker",
                                    text: text,
                                    byteLength: text.length,
                                    lineCount: 1,
                                    sha256: "test",
                                };
                                sink === null || sink === void 0 ? void 0 : sink(event);
                                return [2 /*return*/, event];
                            });
                        });
                    },
                    cancel: function () { },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snapshot_worker",
                        files: [],
                    }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                events = [];
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, (0, bun_test_1.expect)(client.submit("worker prompt")).resolves.toMatchObject({
                        text: "worker prompt",
                    })];
            case 1:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 0); })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({ type: "turn.submitted", text: "worker prompt" }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failing notification is reported instead of crashing the host", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, sink, host, client, events, rejections, onRejection;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                channel = new MessageChannel();
                host = {
                    start: function (handler) {
                        sink = handler;
                    },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        type: "turn.submitted",
                                        id: "turn_reject",
                                        text: text,
                                        byteLength: text.length,
                                        lineCount: 1,
                                        sha256: "test",
                                    }];
                            });
                        });
                    },
                    // The real failure this reproduces is a teardown error surfacing through a
                    // notification, which used to become an unhandled rejection.
                    cancel: function () {
                        throw new Error("kill() failed: ESRCH: No such process");
                    },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snapshot_reject",
                        files: [],
                    }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                events = [];
                client.start(function (event) { return events.push(event); });
                rejections = [];
                onRejection = function (reason) { return rejections.push(reason); };
                process.on("unhandledRejection", onRejection);
                _a.label = 1;
            case 1:
                _a.trys.push([1, , 3, 4]);
                client.cancel("stop");
                return [4 /*yield*/, Bun.sleep(50)];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                process.off("unhandledRejection", onRejection);
                return [7 /*endfinally*/];
            case 4:
                (0, bun_test_1.expect)(rejections).toEqual([]);
                (0, bun_test_1.expect)(events.filter(function (event) {
                    return event.type === "diagnostic" && event.message.includes("cancel failed");
                }).length).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("config reload replaces the worker runtime and keeps event forwarding", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, disposed, submitted, generation, createHost, first, client, events, submission, result;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                channel = new MessageChannel();
                disposed = [];
                submitted = [];
                generation = 0;
                createHost = function () {
                    var id = "host-".concat(++generation);
                    var sink;
                    return {
                        start: function (handler) {
                            sink = handler;
                        },
                        submit: function (text) {
                            return __awaiter(this, void 0, void 0, function () {
                                var event;
                                return __generator(this, function (_a) {
                                    submitted.push("".concat(id, ":").concat(text));
                                    event = {
                                        type: "turn.submitted",
                                        id: "turn-".concat(id),
                                        text: "".concat(id, ":").concat(text),
                                        byteLength: text.length,
                                        lineCount: 1,
                                        sha256: "test",
                                    };
                                    sink === null || sink === void 0 ? void 0 : sink(event);
                                    return [2 /*return*/, event];
                                });
                            });
                        },
                        runtimeStatus: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, { type: "status.snapshot", permissions: "ask" }];
                                });
                            });
                        },
                        dispose: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    disposed.push(id);
                                    return [2 /*return*/];
                                });
                            });
                        },
                        cancel: function () { },
                        snapshot: function () { return ({
                            type: "snapshot.created",
                            id: "snapshot-".concat(id),
                            files: [],
                        }); },
                        diagnostic: function () { },
                        lastSubmission: function () { return undefined; },
                        respondApproval: function () {
                            return { accepted: true };
                        },
                        respondQuestion: function () {
                            return { accepted: true };
                        },
                    };
                };
                first = createHost();
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, first, { reload: createHost });
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                events = [];
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, Promise.race([
                        (_a = client.reloadConfig) === null || _a === void 0 ? void 0 : _a.call(client),
                        Bun.sleep(1000).then(function () {
                            throw new Error("config reload request timed out");
                        }),
                    ])];
            case 1:
                _b.sent();
                submission = Promise.race([
                    client.submit("after reload"),
                    Bun.sleep(1000).then(function () {
                        throw new Error("submit after config reload timed out (".concat(submitted.join(", "), ")"));
                    }),
                ]);
                return [4 /*yield*/, submission];
            case 2:
                result = _b.sent();
                (0, bun_test_1.expect)(result).toMatchObject({ text: "host-2:after reload" });
                return [4 /*yield*/, Bun.sleep(0)];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(disposed).toEqual(["host-1"]);
                (0, bun_test_1.expect)(submitted).toEqual(["host-2:after reload"]);
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({ text: "host-2:after reload" }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("config reload preserves a busy runtime instead of cancelling it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, disposed, host, client;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                channel = new MessageChannel();
                disposed = false;
                host = {
                    start: function () { },
                    submit: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new Error("not used");
                            });
                        });
                    },
                    canReloadConfig: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { allowed: false, reason: "turn is running" }];
                            });
                        });
                    },
                    dispose: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                disposed = true;
                                return [2 /*return*/];
                            });
                        });
                    },
                    cancel: function () { },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snapshot_busy",
                        files: [],
                    }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host, { reload: function () { return host; } });
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function () { return undefined; });
                // Being told "not now" is an ordinary answer, so it arrives as a value. It used
                // to be thrown, which made a busy runtime indistinguishable from a broken
                // channel for any caller that only saw the rejection.
                return [4 /*yield*/, (0, bun_test_1.expect)((_a = client.reloadConfig) === null || _a === void 0 ? void 0 : _a.call(client)).resolves.toEqual({
                        applied: false,
                        reason: "turn is running",
                    })];
            case 1:
                // Being told "not now" is an ordinary answer, so it arrives as a value. It used
                // to be thrown, which made a busy runtime indistinguishable from a broken
                // channel for any caller that only saw the rejection.
                _b.sent();
                // The point of the test is unchanged: a busy runtime is preserved, not rebuilt.
                (0, bun_test_1.expect)(disposed).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("config reload applies changed permission profiles to the same worker client", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, configPath, writeProfile, channel, createRuntime, client, _a, _b, _c;
    var _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-worker-reload-"))];
            case 1:
                root = _j.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _j.sent();
                configPath = (0, node_path_1.join)(root, ".natalia", "config.json");
                writeProfile = function (approval_1) {
                    var args_1 = [];
                    for (var _i = 1; _i < arguments.length; _i++) {
                        args_1[_i - 1] = arguments[_i];
                    }
                    return __awaiter(void 0, __spreadArray([approval_1], args_1, true), void 0, function (approval, agents) {
                        if (agents === void 0) { agents = {}; }
                        return __generator(this, function (_a) {
                            return [2 /*return*/, (0, promises_1.writeFile)(configPath, JSON.stringify({
                                    version: 3,
                                    defaultAgentMode: "active",
                                    agentModes: { active: { approval: approval } },
                                    agents: agents,
                                }))];
                        });
                    });
                };
                return [4 /*yield*/, writeProfile("ask")];
            case 3:
                _j.sent();
                channel = new MessageChannel();
                createRuntime = function () {
                    return (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                        workspaceRoot: root,
                        sessionID: "ses_worker_reload",
                        provider: {
                            provider: "test",
                            model: "test",
                            stream: function () {
                                return __asyncGenerator(this, arguments, function stream_2() {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, __await({ type: "done" })];
                                            case 1: return [4 /*yield*/, _a.sent()];
                                            case 2:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                });
                            },
                        },
                    });
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, createRuntime(), {
                    reload: createRuntime,
                });
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function () { return undefined; });
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_d = client.runtimeStatus) === null || _d === void 0 ? void 0 : _d.call(client))];
            case 4:
                _a.apply(void 0, [_j.sent()]).toMatchObject({ permissions: "ask" });
                return [4 /*yield*/, writeProfile("read_only", {
                        reviewer: { description: "Reloaded reviewer" },
                    })];
            case 5:
                _j.sent();
                return [4 /*yield*/, ((_e = client.reloadConfig) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 6:
                _j.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, ((_f = client.runtimeStatus) === null || _f === void 0 ? void 0 : _f.call(client))];
            case 7:
                _b.apply(void 0, [_j.sent()]).toMatchObject({
                    permissions: "read_only",
                });
                _c = bun_test_1.expect;
                return [4 /*yield*/, ((_g = client.agents) === null || _g === void 0 ? void 0 : _g.call(client))];
            case 8:
                _c.apply(void 0, [_j.sent()]).toContainEqual(bun_test_1.expect.objectContaining({
                    name: "reviewer",
                    description: "Reloaded reviewer",
                }));
                return [4 /*yield*/, ((_h = client.dispose) === null || _h === void 0 ? void 0 : _h.call(client))];
            case 9:
                _j.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the worker channel carries the runtime's answer instead of assuming one", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, host, client, _a, _b, _c, _d;
    var _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                channel = new MessageChannel();
                host = {
                    start: function () { },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        type: "turn.submitted",
                                        id: "turn_outcome",
                                        text: text,
                                        byteLength: text.length,
                                        lineCount: 1,
                                        sha256: "test",
                                    }];
                            });
                        });
                    },
                    cancel: function () { },
                    pause: function () {
                        return { paused: false, reason: "no turn has been submitted" };
                    },
                    resume: function () {
                        return { resumed: false, reason: "the turn is not paused" };
                    },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snapshot_outcome",
                        files: [],
                    }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    respondApproval: function () {
                        return {
                            accepted: false,
                            reason: "the approval request is no longer pending",
                        };
                    },
                    respondQuestion: function () {
                        return {
                            accepted: false,
                            reason: "the question request is no longer pending",
                        };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function () { return undefined; });
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_e = client.pause) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 1:
                _a.apply(void 0, [_h.sent()]).toEqual({
                    paused: false,
                    reason: "no turn has been submitted",
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, ((_f = client.resume) === null || _f === void 0 ? void 0 : _f.call(client))];
            case 2:
                _b.apply(void 0, [_h.sent()]).toMatchObject({ resumed: false });
                _c = bun_test_1.expect;
                return [4 /*yield*/, client.respondApproval({ requestID: "apr_gone", decision: "once" })];
            case 3:
                _c.apply(void 0, [_h.sent()]).toEqual({
                    accepted: false,
                    reason: "the approval request is no longer pending",
                });
                _d = bun_test_1.expect;
                return [4 /*yield*/, client.respondQuestion({
                        requestID: "qst_gone",
                        answers: [["no"]],
                        rejected: false,
                    })];
            case 4:
                _d.apply(void 0, [_h.sent()]).toMatchObject({ accepted: false });
                return [4 /*yield*/, ((_g = client.dispose) === null || _g === void 0 ? void 0 : _g.call(client))];
            case 5:
                _h.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the worker channel routes the MCP surface", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, catalog, host, client, _a, _b, _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                channel = new MessageChannel();
                catalog = {
                    prompts: [{ server: "fixture", name: "review" }],
                    resources: [],
                };
                host = {
                    start: function () { },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        type: "turn.submitted",
                                        id: "turn_mcp",
                                        text: text,
                                        byteLength: text.length,
                                        lineCount: 1,
                                        sha256: "test",
                                    }];
                            });
                        });
                    },
                    cancel: function () { },
                    snapshot: function () { return ({ type: "snapshot.created", id: "snap_mcp", files: [] }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    mcpCatalog: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, catalog];
                            });
                        });
                    },
                    getMcpPrompt: function (server, name, _arguments, workspaceID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { server: server, name: name, workspaceID: workspaceID }];
                            });
                        });
                    },
                    readMcpResource: function (server, uri, workspaceID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { server: server, uri: uri, workspaceID: workspaceID }];
                            });
                        });
                    },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function () { return undefined; });
                (0, bun_test_1.expect)(typeof client.mcpCatalog).toBe("function");
                _a = bun_test_1.expect;
                return [4 /*yield*/, client.mcpCatalog()];
            case 1:
                _a.apply(void 0, [_e.sent()]).toEqual(catalog);
                _b = bun_test_1.expect;
                return [4 /*yield*/, client.getMcpPrompt("fixture", "review", undefined, "ws_remote")];
            case 2:
                _b.apply(void 0, [_e.sent()]).toEqual({
                    server: "fixture",
                    name: "review",
                    workspaceID: "ws_remote",
                });
                _c = bun_test_1.expect;
                return [4 /*yield*/, client.readMcpResource("fixture", "x://y", "ws_remote")];
            case 3:
                _c.apply(void 0, [_e.sent()]).toEqual({
                    server: "fixture",
                    uri: "x://y",
                    workspaceID: "ws_remote",
                });
                return [4 /*yield*/, ((_d = client.dispose) === null || _d === void 0 ? void 0 : _d.call(client))];
            case 4:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the worker channel routes permission profile management", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, reasoningEffort, host, client, _a, _b, _c, _d;
    var _e, _f, _g, _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                channel = new MessageChannel();
                host = {
                    start: function () { },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        type: "turn.submitted",
                                        id: "turn_permission",
                                        text: text,
                                        byteLength: text.length,
                                        lineCount: 1,
                                        sha256: "test",
                                    }];
                            });
                        });
                    },
                    cancel: function () { },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snap_permission",
                        files: [],
                    }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    permissionList: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    default: "ask",
                                    profiles: [
                                        {
                                            name: "ask",
                                            description: "Ask before actions",
                                            approval: "ask",
                                        },
                                    ],
                                })];
                        });
                    }); },
                    permissionSave: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    saved: input.name === "strict",
                                    applied: true,
                                })];
                        });
                    }); },
                    permissionDelete: function (name) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ deleted: name !== "ask" })];
                    }); }); },
                    reasoningEffort: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, reasoningEffort];
                    }); }); },
                    setReasoningEffort: function (effort) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            reasoningEffort = effort;
                            return [2 /*return*/];
                        });
                    }); },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function () { return undefined; });
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_e = client.permissionList) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 1:
                _a.apply(void 0, [_l.sent()]).toEqual({
                    default: "ask",
                    profiles: [
                        {
                            name: "ask",
                            description: "Ask before actions",
                            approval: "ask",
                        },
                    ],
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, ((_f = client.permissionSave) === null || _f === void 0 ? void 0 : _f.call(client, {
                        name: "strict",
                        profile: { description: "Strict profile", approval: "ask" },
                    }))];
            case 2:
                _b.apply(void 0, [_l.sent()]).toEqual({ saved: true, applied: true });
                _c = bun_test_1.expect;
                return [4 /*yield*/, ((_g = client.permissionDelete) === null || _g === void 0 ? void 0 : _g.call(client, "ask"))];
            case 3:
                _c.apply(void 0, [_l.sent()]).toEqual({ deleted: false });
                return [4 /*yield*/, ((_h = client.setReasoningEffort) === null || _h === void 0 ? void 0 : _h.call(client, "high"))];
            case 4:
                _l.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, ((_j = client.reasoningEffort) === null || _j === void 0 ? void 0 : _j.call(client))];
            case 5:
                _d.apply(void 0, [_l.sent()]).toBe("high");
                return [4 /*yield*/, ((_k = client.dispose) === null || _k === void 0 ? void 0 : _k.call(client))];
            case 6:
                _l.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("worker teardown releases workspace capability storage once", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, capabilities, channel, client;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-worker-host-dispose-"))];
            case 1:
                root = _b.sent();
                capabilities = new capability_1.CapabilityHost({ workspaceRoot: root });
                capabilities.registerOwner({
                    id: "review",
                    name: "Review",
                    version: "1",
                    scope: "workspace",
                    grants: [],
                });
                channel = new MessageChannel();
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, (0, plugin_test_helpers_1.createOfficialRuntimeClient)({ workspaceRoot: root }), { disposeHost: function () { return capabilities.dispose(); } });
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function () { return undefined; });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(capabilities.has("review")).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the worker channel routes the sandbox, agent-select and fork surface", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, host, client, _a, _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                channel = new MessageChannel();
                host = {
                    start: function () { },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        type: "turn.submitted",
                                        id: "turn_surface",
                                        text: text,
                                        byteLength: text.length,
                                        lineCount: 1,
                                        sha256: "test",
                                    }];
                            });
                        });
                    },
                    cancel: function () { },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snap_surface",
                        files: [],
                    }); },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    sandboxList: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            id: "box_1",
                                            root: "/r/box_1",
                                            isolationLevel: "workspace",
                                            changedFiles: 2,
                                            runningResources: 1,
                                            envAllowlist: [],
                                        },
                                    ]];
                            });
                        });
                    },
                    sandboxDiff: function (id) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ kind: "modify", path: "".concat(id, "/a.ts"), oldPath: undefined }]];
                            });
                        });
                    },
                    sandboxResources: function (id) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        {
                                            id: "srv",
                                            sandboxID: id,
                                            command: "sleep 60",
                                            pid: 42,
                                            status: "running",
                                            outputPath: "/r/srv.out",
                                            startedAt: "2026-08-12T00:00:00.000Z",
                                        },
                                    ]];
                            });
                        });
                    },
                    sandboxResourceOutput: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, "output of ".concat(input.resourceID)];
                            });
                        });
                    },
                    sandboxResourceStop: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        id: input.resourceID,
                                        sandboxID: input.id,
                                        command: "sleep 60",
                                        pid: 42,
                                        status: "stopped",
                                        outputPath: "/r/srv.out",
                                        startedAt: "2026-08-12T00:00:00.000Z",
                                    }];
                            });
                        });
                    },
                    sandboxMerge: function (id) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [{ kind: "add", path: "".concat(id, "/b.ts"), oldPath: undefined }]];
                            });
                        });
                    },
                    sandboxDelete: function (id) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { pendingChanges: [], runningResources: [] }];
                            });
                        });
                    },
                    selectAgent: function (name) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, { outcome: "applied", selected: name }];
                            });
                        });
                    },
                    sessionFork: function (id, turnID) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, {
                                        id: "".concat(id, "_fork"),
                                        title: "fork",
                                        createdAt: "2026-08-12T00:00:00.000Z",
                                        pinned: false,
                                        events: 0,
                                        pendingInputs: 0,
                                        cancelled: false,
                                        resumable: true,
                                    }];
                            });
                        });
                    },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function () { return undefined; });
                (0, bun_test_1.expect)(typeof client.sandboxList).toBe("function");
                (0, bun_test_1.expect)(typeof client.sessionFork).toBe("function");
                _a = bun_test_1.expect;
                return [4 /*yield*/, client.sandboxList()];
            case 1:
                _a.apply(void 0, [_g.sent()]).toEqual([
                    {
                        id: "box_1",
                        root: "/r/box_1",
                        isolationLevel: "workspace",
                        changedFiles: 2,
                        runningResources: 1,
                        envAllowlist: [],
                    },
                ]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, client.sandboxMerge("box_1")];
            case 2:
                _b.apply(void 0, [_g.sent()]).toEqual([
                    { kind: "add", path: "box_1/b.ts", oldPath: undefined },
                ]);
                _c = bun_test_1.expect;
                return [4 /*yield*/, client.sandboxResourceOutput({ id: "box_1", resourceID: "srv" })];
            case 3:
                _c.apply(void 0, [_g.sent()]).toBe("output of srv");
                _d = bun_test_1.expect;
                return [4 /*yield*/, client.selectAgent("helper")];
            case 4:
                _d.apply(void 0, [_g.sent()]).toEqual({
                    outcome: "applied",
                    selected: "helper",
                });
                _e = bun_test_1.expect;
                return [4 /*yield*/, client.sessionFork("ses_a", "turn_1")];
            case 5:
                _e.apply(void 0, [_g.sent()]).toEqual({
                    id: "ses_a_fork",
                    title: "fork",
                    createdAt: "2026-08-12T00:00:00.000Z",
                    pinned: false,
                    events: 0,
                    pendingInputs: 0,
                    cancelled: false,
                    resumable: true,
                });
                _f = bun_test_1.expect;
                return [4 /*yield*/, client.sandboxDelete("box_1")];
            case 6:
                _f.apply(void 0, [_g.sent()]).toEqual({
                    pendingChanges: [],
                    runningResources: [],
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("fact-domain read queries and mailbox writes route through the channel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var channel, sink, host, client, _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0:
                channel = new MessageChannel();
                host = {
                    start: function (handler) {
                        sink = handler;
                    },
                    submit: function (text) {
                        return __awaiter(this, void 0, void 0, function () {
                            var event;
                            return __generator(this, function (_a) {
                                event = {
                                    type: "turn.submitted",
                                    id: "turn_worker_facts",
                                    text: text,
                                    byteLength: text.length,
                                    lineCount: 1,
                                    sha256: "test",
                                };
                                sink === null || sink === void 0 ? void 0 : sink(event);
                                return [2 /*return*/, event];
                            });
                        });
                    },
                    cancel: function () { },
                    diagnostic: function () { },
                    lastSubmission: function () { return undefined; },
                    snapshot: function () { return ({
                        type: "snapshot.created",
                        id: "snapshot_worker_facts",
                        files: [],
                    }); },
                    respondApproval: function () {
                        return { accepted: true };
                    },
                    respondQuestion: function () {
                        return { accepted: true };
                    },
                    sessionSnapshot: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    agentStatus: "running",
                                    changedFiles: 1,
                                    unvalidatedChanges: 1,
                                    hasPTY: false,
                                    hasSandbox: false,
                                })];
                        });
                    }); },
                    planDocList: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, [
                                    {
                                        planID: "plan:1",
                                        title: "t",
                                        documentPath: ".natalia/plans/plan_1.md",
                                        status: "executing",
                                        createdBy: "main_agent",
                                        createdAt: "2026-08-12T00:00:00.000Z",
                                        updatedAt: "2026-08-12T00:00:00.000Z",
                                        revision: 1,
                                    },
                                ]];
                        });
                    }); },
                    planDocStatus: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ status: "executing" })];
                    }); }); },
                    mailboxList: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, []];
                    }); }); },
                    mailboxSend: function (input) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ queued: true, messageID: "mailbox:1" })];
                    }); }); },
                    mailboxAcknowledge: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ acknowledged: true })];
                    }); }); },
                    driftFindings: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    items: [],
                                    returned: 0,
                                    total: 0,
                                    truncated: false,
                                })];
                        });
                    }); },
                    completions: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    items: [],
                                    returned: 0,
                                    total: 0,
                                    truncated: false,
                                })];
                        });
                    }); },
                    constitutionRules: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, []];
                    }); }); },
                    decisionRecords: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    items: [],
                                    returned: 0,
                                    total: 0,
                                    truncated: false,
                                })];
                        });
                    }); },
                    evidenceRecords: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    items: [],
                                    returned: 0,
                                    total: 0,
                                    truncated: false,
                                })];
                        });
                    }); },
                    naviChat: {
                        submit: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ messageID: "chat:m1" })];
                        }); }); },
                        messages: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, [
                                        { messageID: "chat:m1", role: "user", text: "hi", at: "now" },
                                    ]];
                            });
                        }); },
                        rollback: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ rolledBackTo: "chat:m1", removed: 1 })];
                        }); }); },
                    },
                    niaChat: {
                        submit: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ messageID: "chat:n1" })];
                        }); }); },
                        messages: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, []];
                        }); }); },
                        rollback: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ rolledBackTo: "chat:n1", removed: 0 })];
                        }); }); },
                    },
                };
                (0, worker_1.attachRuntimeClientWorker)(channel.port1, host);
                client = (0, worker_1.createWorkerRuntimeClient)(channel.port2);
                client.start(function (event) { return sink === null || sink === void 0 ? void 0 : sink(event); });
                _a = bun_test_1.expect;
                return [4 /*yield*/, client.sessionSnapshot()];
            case 1:
                _a.apply(void 0, [_p.sent()]).toMatchObject({
                    agentStatus: "running",
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, client.planDocList()];
            case 2:
                _b.apply(void 0, [_p.sent()]).toHaveLength(1);
                _c = bun_test_1.expect;
                return [4 /*yield*/, client.planDocStatus("plan:1")];
            case 3:
                _c.apply(void 0, [_p.sent()]).toEqual({
                    status: "executing",
                });
                _d = bun_test_1.expect;
                return [4 /*yield*/, client.mailboxSend({ intent: "clarification", text: "hi" })];
            case 4:
                _d.apply(void 0, [_p.sent()]).toEqual({
                    queued: true,
                    messageID: "mailbox:1",
                });
                _e = bun_test_1.expect;
                return [4 /*yield*/, client.mailboxList()];
            case 5:
                _e.apply(void 0, [_p.sent()]).toEqual([]);
                _f = bun_test_1.expect;
                return [4 /*yield*/, client.mailboxAcknowledge("mailbox:1")];
            case 6:
                _f.apply(void 0, [_p.sent()]).toEqual({
                    acknowledged: true,
                });
                _g = bun_test_1.expect;
                return [4 /*yield*/, client.driftFindings()];
            case 7:
                _g.apply(void 0, [_p.sent()]).toMatchObject({
                    items: [],
                    returned: 0,
                    total: 0,
                    truncated: false,
                });
                _h = bun_test_1.expect;
                return [4 /*yield*/, client.completions()];
            case 8:
                _h.apply(void 0, [_p.sent()]).toMatchObject({
                    items: [],
                    returned: 0,
                    total: 0,
                    truncated: false,
                });
                _j = bun_test_1.expect;
                return [4 /*yield*/, client.constitutionRules()];
            case 9:
                _j.apply(void 0, [_p.sent()]).toEqual([]);
                _k = bun_test_1.expect;
                return [4 /*yield*/, client.decisionRecords()];
            case 10:
                _k.apply(void 0, [_p.sent()]).toMatchObject({
                    items: [],
                    returned: 0,
                    total: 0,
                    truncated: false,
                });
                _l = bun_test_1.expect;
                return [4 /*yield*/, client.evidenceRecords()];
            case 11:
                _l.apply(void 0, [_p.sent()]).toMatchObject({
                    items: [],
                    returned: 0,
                    total: 0,
                    truncated: false,
                });
                _m = bun_test_1.expect;
                return [4 /*yield*/, client.naviChat.messages()];
            case 12:
                _m.apply(void 0, [_p.sent()]).toEqual([
                    { messageID: "chat:m1", role: "user", text: "hi", at: "now" },
                ]);
                _o = bun_test_1.expect;
                return [4 /*yield*/, client.naviChat.rollback({ toMessageID: "chat:m1" })];
            case 13:
                _o.apply(void 0, [_p.sent()]).toEqual({
                    rolledBackTo: "chat:m1",
                    removed: 1,
                });
                return [2 /*return*/];
        }
    });
}); });
