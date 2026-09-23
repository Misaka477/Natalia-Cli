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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
function gate() {
    var release;
    var promise = new Promise(function (resolve) {
        release = resolve;
    });
    return { promise: promise, release: release };
}
function streamGate() {
    var blocked = gate();
    var entered = gate();
    return __assign(__assign({}, blocked), { started: entered.promise, markStarted: entered.release });
}
function releaseAll(gates) {
    for (var _i = 0, _a = gates.values(); _i < _a.length; _i++) {
        var value = _a[_i];
        value.release();
    }
}
function waitForGateOrAbort(gate, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!signal)
                        return [2 /*return*/, gate.promise];
                    if (signal.aborted)
                        throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new Error("aborted");
                    return [4 /*yield*/, Promise.race([
                            gate.promise,
                            new Promise(function (_, reject) {
                                signal.addEventListener("abort", function () { var _a; return reject((_a = signal.reason) !== null && _a !== void 0 ? _a : new Error("aborted")); }, { once: true });
                            }),
                        ])];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function eventType(event) {
    return event.type;
}
function chatMessages(request) {
    return request.messages
        .filter(function (message) { return message.role !== "system"; })
        .map(function (message) { return ({ role: message.role, content: message.content }); });
}
function providerForChat(requests, gates) {
    return {
        provider: "test-chat",
        model: "test-chat-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_1() {
                var system, channel, prompt, wait;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            system = String((_b = (_a = request.messages[0]) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : "");
                            channel = system.includes("<nia_chat_persona>") ? "nia" : "navi";
                            requests.push({ channel: channel, request: request });
                            prompt = (_c = request.messages.findLast(function (message) { return message.role === "user"; })) === null || _c === void 0 ? void 0 : _c.content;
                            wait = gates.get(channel);
                            return [4 /*yield*/, __await({ type: "thinking", text: "".concat(channel, "-thinking:") })];
                        case 1: return [4 /*yield*/, _f.sent()];
                        case 2:
                            _f.sent();
                            wait === null || wait === void 0 ? void 0 : wait.markStarted();
                            if (!wait) return [3 /*break*/, 4];
                            return [4 /*yield*/, __await(waitForGateOrAbort(wait, request.signal))];
                        case 3:
                            _f.sent();
                            _f.label = 4;
                        case 4:
                            if ((_d = request.signal) === null || _d === void 0 ? void 0 : _d.aborted)
                                throw (_e = request.signal.reason) !== null && _e !== void 0 ? _e : new Error("aborted");
                            return [4 /*yield*/, __await({ type: "content", text: "".concat(channel, ":").concat(prompt) })];
                        case 5: return [4 /*yield*/, _f.sent()];
                        case 6:
                            _f.sent();
                            return [4 /*yield*/, __await({
                                    type: "usage",
                                    inputTokens: 11,
                                    outputTokens: 7,
                                })];
                        case 7: return [4 /*yield*/, _f.sent()];
                        case 8:
                            _f.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 9: return [4 /*yield*/, _f.sent()];
                        case 10:
                            _f.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function makeClient(suffix, requests, gates, options) {
    return __awaiter(this, void 0, void 0, function () {
        var root, client;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("three-stream-".concat(suffix))];
                case 1:
                    root = _a.sent();
                    if (!(options === null || options === void 0 ? void 0 : options.maxStepsPerTurn)) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                            version: 3,
                            runtime: { maxStepsPerTurn: options.maxStepsPerTurn },
                        }))];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    client = (0, src_1.createRealRuntimeClient)({
                        workspaceRoot: root,
                        sessionID: "ses_three_stream_".concat(suffix),
                        provider: providerForChat(requests, gates),
                    });
                    client.start(function () { return undefined; });
                    return [2 /*return*/, { client: client, root: root }];
            }
        });
    });
}
(0, bun_test_1.test)("Navi and Nia run concurrently with independent event and thinking namespaces", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, gates, client, events, navi, nia;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                gates = new Map([
                    ["navi", streamGate()],
                    ["nia", streamGate()],
                ]);
                return [4 /*yield*/, makeClient("concurrent", requests, gates)];
            case 1:
                client = (_b.sent()).client;
                events = [];
                client.start(function (event) { return events.push(event); });
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                navi = client.naviChat.submit({ text: "navi first" });
                nia = client.niaChat.submit({ text: "nia first" });
                return [4 /*yield*/, Promise.all([gates.get("navi").started, gates.get("nia").started])];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                (0, bun_test_1.expect)(requests.map(function (_a) {
                    var channel = _a.channel;
                    return channel;
                })).toEqual(bun_test_1.expect.arrayContaining(["navi", "nia"]));
                (0, bun_test_1.expect)(events.filter(function (event) { return eventType(event).startsWith("chat."); })).toEqual([]);
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "navi.chat.thinking.delta"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "nia.chat.thinking.delta"; })).toBe(true);
                gates.get("navi").release();
                gates.get("nia").release();
                return [4 /*yield*/, Promise.all([navi, nia])];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "navi.chat.message.delta"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "nia.chat.message.delta"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "navi.chat.turn.finished"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "nia.chat.turn.finished"; })).toBe(true);
                (0, bun_test_1.expect)(events
                    .filter(function (event) { return eventType(event).startsWith("navi.chat."); })
                    .every(function (event) { return !eventType(event).startsWith("nia.chat."); })).toBe(true);
                return [3 /*break*/, 7];
            case 5:
                releaseAll(gates);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Navi and Nia provider usage feeds the session usage dashboard", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, client, events, naviUsage, niaUsage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                return [4 /*yield*/, makeClient("usage", requests, new Map())];
            case 1:
                client = (_b.sent()).client;
                events = [];
                client.start(function (event) { return events.push(event); });
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                return [4 /*yield*/, client.naviChat.submit({ text: "navi usage" })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.niaChat.submit({ text: "nia usage" })];
            case 4:
                _b.sent();
                naviUsage = events.filter(function (event) { return event.type === "navi.runtime.step_usage"; });
                niaUsage = events.filter(function (event) { return event.type === "nia.runtime.step_usage"; });
                (0, bun_test_1.expect)(naviUsage).toHaveLength(1);
                (0, bun_test_1.expect)(niaUsage).toHaveLength(1);
                (0, bun_test_1.expect)(naviUsage[0]).toMatchObject({
                    type: "navi.runtime.step_usage",
                    inputTokens: 11,
                    outputTokens: 7,
                });
                (0, bun_test_1.expect)(niaUsage[0]).toMatchObject({
                    type: "nia.runtime.step_usage",
                    inputTokens: 11,
                    outputTokens: 7,
                });
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pending user messages are drained only by their own stream and reach the provider", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, gates, client, naviBusy, niaBusy, queuedNavi, queuedNia, naviPending, niaPending;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                gates = new Map([
                    ["navi", streamGate()],
                    ["nia", streamGate()],
                ]);
                return [4 /*yield*/, makeClient("pending", requests, gates)];
            case 1:
                client = (_b.sent()).client;
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                naviBusy = client.naviChat.submit({ text: "navi busy" });
                niaBusy = client.niaChat.submit({ text: "nia busy" });
                return [4 /*yield*/, Promise.all([gates.get("navi").started, gates.get("nia").started])];
            case 3:
                _b.sent();
                queuedNavi = client.naviChat.submit({
                    text: "navi pending",
                });
                queuedNia = client.niaChat.submit({
                    text: "nia pending",
                });
                gates.get("navi").release();
                gates.get("nia").release();
                return [4 /*yield*/, Promise.all([naviBusy, niaBusy, queuedNavi, queuedNia])];
            case 4:
                _b.sent();
                naviPending = requests.find(function (_a) {
                    var channel = _a.channel, request = _a.request;
                    return channel === "navi" &&
                        chatMessages(request).some(function (message) { return message.content === "navi pending"; });
                });
                niaPending = requests.find(function (_a) {
                    var channel = _a.channel, request = _a.request;
                    return channel === "nia" &&
                        chatMessages(request).some(function (message) { return message.content === "nia pending"; });
                });
                (0, bun_test_1.expect)(naviPending).toBeDefined();
                (0, bun_test_1.expect)(niaPending).toBeDefined();
                (0, bun_test_1.expect)(chatMessages(naviPending.request).some(function (message) { return message.content === "nia pending"; })).toBe(false);
                (0, bun_test_1.expect)(chatMessages(niaPending.request).some(function (message) { return message.content === "navi pending"; })).toBe(false);
                return [3 /*break*/, 7];
            case 5:
                releaseAll(gates);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("identical queued Navi text is consumed once per message ID", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, gates, client, busy, first, second, drained;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                requests = [];
                gates = new Map([["navi", streamGate()]]);
                return [4 /*yield*/, makeClient("duplicate-pending", requests, gates)];
            case 1:
                client = (_c.sent()).client;
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 7, 9]);
                busy = client.naviChat.submit({ text: "busy" });
                return [4 /*yield*/, gates.get("navi").started];
            case 3:
                _c.sent();
                return [4 /*yield*/, client.naviChat.submit({
                        text: "same text",
                    })];
            case 4:
                first = _c.sent();
                return [4 /*yield*/, client.naviChat.submit({
                        text: "same text",
                    })];
            case 5:
                second = _c.sent();
                (0, bun_test_1.expect)(first.messageID).not.toBe(second.messageID);
                gates.get("navi").release();
                return [4 /*yield*/, busy];
            case 6:
                _c.sent();
                drained = (_a = requests.at(-1)) === null || _a === void 0 ? void 0 : _a.request;
                (0, bun_test_1.expect)(drained).toBeDefined();
                (0, bun_test_1.expect)(chatMessages(drained).filter(function (message) { return message.role === "user" && message.content === "same text"; })).toHaveLength(2);
                return [3 /*break*/, 9];
            case 7:
                releaseAll(gates);
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 8:
                _c.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a Navi message arriving after the last-step drain gets a follow-up provider step", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, gates, client, busy, pending;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                gates = new Map([["navi", streamGate()]]);
                return [4 /*yield*/, makeClient("last-step-pending", requests, gates, {
                        maxStepsPerTurn: 1,
                    })];
            case 1:
                client = (_b.sent()).client;
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 6, 8]);
                busy = client.naviChat.submit({ text: "last step" });
                return [4 /*yield*/, gates.get("navi").started];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.naviChat.submit({
                        text: "arrived after drain",
                    })];
            case 4:
                pending = _b.sent();
                gates.get("navi").release();
                return [4 /*yield*/, busy];
            case 5:
                _b.sent();
                (0, bun_test_1.expect)(pending.messageID).toBeTruthy();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                (0, bun_test_1.expect)(chatMessages(requests[1].request).some(function (message) {
                    return message.role === "user" && message.content === "arrived after drain";
                })).toBe(true);
                return [3 /*break*/, 8];
            case 6:
                releaseAll(gates);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
bun_test_1.test.each([
    ["navi", "nia"],
    ["nia", "navi"],
])("aborting %s does not abort %s", function (aborted, peer) { return __awaiter(void 0, void 0, void 0, function () {
    var requests, gates, client, chat, cancelled, survivor, _a, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                requests = [];
                gates = new Map([
                    [aborted, streamGate()],
                    [peer, streamGate()],
                ]);
                return [4 /*yield*/, makeClient("abort-".concat(aborted), requests, gates)];
            case 1:
                client = (_d.sent()).client;
                _d.label = 2;
            case 2:
                _d.trys.push([2, , 8, 10]);
                chat = aborted === "navi" ? client.naviChat : client.niaChat;
                cancelled = chat.submit({
                    text: "".concat(aborted, " abort"),
                });
                survivor = (peer === "navi" ? client.naviChat : client.niaChat).submit({
                    text: "".concat(peer, " peer"),
                });
                return [4 /*yield*/, Promise.all([gates.get(aborted).started, gates.get(peer).started])];
            case 3:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, chat.abort()];
            case 4:
                _a.apply(void 0, [_d.sent()]).toEqual({ aborted: true });
                gates.get(aborted).release();
                gates.get(peer).release();
                return [4 /*yield*/, survivor];
            case 5:
                _d.sent();
                return [4 /*yield*/, cancelled];
            case 6:
                _d.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (peer === "navi" ? client.naviChat : client.niaChat).abort()];
            case 7:
                _b.apply(void 0, [_d.sent()]).toEqual({ aborted: false });
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                return [3 /*break*/, 10];
            case 8:
                releaseAll(gates);
                return [4 /*yield*/, ((_c = client.dispose) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 9:
                _d.sent();
                return [7 /*endfinally*/];
            case 10: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Nia normal profile selects its configured model and reasoning for submit and wake", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, server, root, config, globalConfigPath, client, _a, marked, grokRequests, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                requests = [];
                server = Bun.serve({
                    port: 0,
                    fetch: function (request) {
                        return __awaiter(this, void 0, void 0, function () {
                            var _a, _b, openAI;
                            var _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _b = (_a = requests).push;
                                        _c = {
                                            path: new URL(request.url).pathname
                                        };
                                        return [4 /*yield*/, request.json()];
                                    case 1:
                                        _b.apply(_a, [(_c.body = (_d.sent()),
                                                _c)]);
                                        openAI = new URL(request.url).pathname.endsWith("/chat/completions");
                                        return [2 /*return*/, new Response(openAI
                                                ? 'data: {"choices":[{"delta":{"reasoning_content":"think","content":"ok"}}]}\n\ndata: [DONE]\n\n'
                                                : "event: message_stop\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } })];
                                }
                            });
                        });
                    },
                });
                return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("three-stream-profiles")];
            case 1:
                root = _d.sent();
                config = {
                    version: 3,
                    providers: {
                        grok: {
                            name: "Grok",
                            driver: "openai",
                            connection: {
                                apiKey: "test",
                                baseURL: "http://127.0.0.1:".concat(server.port, "/v1"),
                            },
                        },
                        qifengstep: {
                            name: "Step",
                            driver: "anthropic-compatible",
                            connection: {
                                apiKey: "test",
                                baseURL: "http://127.0.0.1:".concat(server.port, "/v1"),
                            },
                        },
                    },
                    catalog: {
                        providers: {
                            grok: { models: { "grok-4.6": { name: "Grok 4.6" } } },
                            qifengstep: { models: { "step-3.7-flash": { name: "Step 3.7" } } },
                        },
                    },
                    defaultModel: { provider: "qifengstep", model: "step-3.7-flash" },
                };
                globalConfigPath = (0, node_path_1.join)(root, ".natalia-test-global.json");
                return [4 /*yield*/, (0, promises_1.writeFile)(globalConfigPath, JSON.stringify(config))];
            case 2:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify(config))];
            case 3:
                _d.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_three_stream_profiles",
                    globalConfigPath: globalConfigPath,
                });
                client.start(function () { return undefined; });
                _d.label = 4;
            case 4:
                _d.trys.push([4, , 13, 15]);
                return [4 /*yield*/, client.niaChat.submit({ text: "establish execution" })];
            case 5:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, client.niaChat.setModelProfile({
                        normal: { modelID: "grok/grok-4.6", reasoningEffort: "high" },
                    })];
            case 6:
                _a.apply(void 0, [_d.sent()]).toEqual({ saved: true });
                return [4 /*yield*/, client.niaChat.submit({ text: "audit" })];
            case 7:
                _d.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/profile-audit.md",
                        content: "# Profile audit\n",
                        title: "Profile audit",
                    })];
            case 8:
                _d.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/profile-audit.md",
                    })];
            case 9:
                marked = _d.sent();
                return [4 /*yield*/, client.planDocUpdateStatus({
                        planID: marked.planID,
                        status: "awaiting_audit",
                    })];
            case 10:
                _d.sent();
                return [4 /*yield*/, Bun.sleep(25)];
            case 11:
                _d.sent();
                grokRequests = requests.filter(function (request) {
                    return request.path.endsWith("/chat/completions");
                });
                (0, bun_test_1.expect)(grokRequests).toHaveLength(2);
                (0, bun_test_1.expect)(grokRequests).toEqual(bun_test_1.expect.arrayContaining([
                    bun_test_1.expect.objectContaining({
                        body: bun_test_1.expect.objectContaining({
                            model: "grok-4.6",
                            reasoning_effort: "high",
                        }),
                    }),
                ]));
                _b = bun_test_1.expect;
                return [4 /*yield*/, client.niaChat.modelProfile()];
            case 12:
                _b.apply(void 0, [_d.sent()]).toMatchObject({
                    normal: { modelID: "grok/grok-4.6", reasoningEffort: "high" },
                });
                return [3 /*break*/, 15];
            case 13: return [4 /*yield*/, ((_c = client.dispose) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 14:
                _d.sent();
                server.stop(true);
                return [7 /*endfinally*/];
            case 15: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("awaiting audit wakes Nia through her normal profile and namespaced stream", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, wakeStarted, provider, root, client, events, marked, _a, wake;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                requests = [];
                wakeStarted = gate();
                provider = {
                    provider: "nia-wake-provider",
                    model: "nia-wake-model",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_2() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        requests.push(request);
                                        if (request.messages.some(function (message) {
                                            return message.role === "user" &&
                                                message.content.includes("Your audit wake request has arrived");
                                        }))
                                            wakeStarted.release();
                                        return [4 /*yield*/, __await({ type: "thinking", text: "nia-wake-thinking" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "content", text: "nia wake reply" })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("three-stream-nia-wake")];
            case 1:
                root = _c.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_three_stream_nia_wake",
                    provider: provider,
                });
                events = [];
                client.start(function (event) { return events.push(event); });
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 9, 11]);
                return [4 /*yield*/, client.niaChat.submit({ text: "establish execution" })];
            case 3:
                _c.sent();
                return [4 /*yield*/, client.niaChat.setModelProfile({
                        normal: { reasoningEffort: "high" },
                    })];
            case 4:
                _c.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/audit-target.md",
                        content: "# Audit target\n",
                        title: "Audit target",
                    })];
            case 5:
                _c.sent();
                return [4 /*yield*/, client.planDocMark({ path: "plans/audit-target.md" })];
            case 6:
                marked = _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, client.planDocUpdateStatus({
                        planID: marked.planID,
                        status: "awaiting_audit",
                    })];
            case 7:
                _a.apply(void 0, [_c.sent()]).toEqual({ updated: true });
                return [4 /*yield*/, wakeStarted.promise];
            case 8:
                _c.sent();
                wake = requests.find(function (request) {
                    return request.messages.some(function (message) {
                        return message.role === "user" &&
                            message.content.includes("Your audit wake request has arrived");
                    });
                });
                (0, bun_test_1.expect)(wake).toBeDefined();
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "nia.chat.thinking.delta"; })).toBe(true);
                return [3 /*break*/, 11];
            case 9: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 10:
                _c.sent();
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("main, Navi, and Nia publish thinking in their independent namespaces", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, gates, client, events;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                gates = new Map();
                return [4 /*yield*/, makeClient("thinking", requests, gates)];
            case 1:
                client = (_b.sent()).client;
                events = [];
                client.start(function (event) { return events.push(event); });
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 6, 8]);
                return [4 /*yield*/, client.submitAndWait("main thinking")];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.naviChat.submit({ text: "navi thinking" })];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.niaChat.submit({ text: "nia thinking" })];
            case 5:
                _b.sent();
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "thinking.delta"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "navi.chat.thinking.delta"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return eventType(event) === "nia.chat.thinking.delta"; })).toBe(true);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("durable thinking rows replay independently and never enter later chat prompts", function () { return __awaiter(void 0, void 0, void 0, function () {
    var initialRequests, root, sessionID, initial, naviRows, niaRows, replayRequests, reopened, reopenedReady, naviRows, niaRows;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                initialRequests = [];
                return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("three-stream-thinking-replay")];
            case 1:
                root = _c.sent();
                sessionID = "ses_three_stream_thinking_replay";
                initial = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    provider: providerForChat(initialRequests, new Map()),
                });
                initial.start(function () { return undefined; });
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 7, 9]);
                return [4 /*yield*/, initial.naviChat.submit({ text: "first navi" })];
            case 3:
                _c.sent();
                return [4 /*yield*/, initial.niaChat.submit({ text: "first nia" })];
            case 4:
                _c.sent();
                return [4 /*yield*/, initial.naviChat.messages()];
            case 5:
                naviRows = _c.sent();
                return [4 /*yield*/, initial.niaChat.messages()];
            case 6:
                niaRows = _c.sent();
                (0, bun_test_1.expect)(naviRows).toContainEqual(bun_test_1.expect.objectContaining({ kind: "thinking", text: "navi-thinking:" }));
                (0, bun_test_1.expect)(niaRows).toContainEqual(bun_test_1.expect.objectContaining({ kind: "thinking", text: "nia-thinking:" }));
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, ((_a = initial.dispose) === null || _a === void 0 ? void 0 : _a.call(initial))];
            case 8:
                _c.sent();
                return [7 /*endfinally*/];
            case 9:
                replayRequests = [];
                reopened = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    provider: providerForChat(replayRequests, new Map()),
                });
                reopenedReady = gate();
                reopened.start(function (event) {
                    if (event.type === "session.ready")
                        reopenedReady.release();
                });
                _c.label = 10;
            case 10:
                _c.trys.push([10, , 16, 18]);
                return [4 /*yield*/, reopenedReady.promise];
            case 11:
                _c.sent();
                return [4 /*yield*/, reopened.naviChat.messages()];
            case 12:
                naviRows = _c.sent();
                return [4 /*yield*/, reopened.niaChat.messages()];
            case 13:
                niaRows = _c.sent();
                (0, bun_test_1.expect)(naviRows.filter(function (row) { return row.kind === "thinking"; })).toEqual([
                    bun_test_1.expect.objectContaining({ text: "navi-thinking:" }),
                ]);
                (0, bun_test_1.expect)(niaRows.filter(function (row) { return row.kind === "thinking"; })).toEqual([
                    bun_test_1.expect.objectContaining({ text: "nia-thinking:" }),
                ]);
                return [4 /*yield*/, reopened.naviChat.submit({ text: "second navi" })];
            case 14:
                _c.sent();
                return [4 /*yield*/, reopened.niaChat.submit({ text: "second nia" })];
            case 15:
                _c.sent();
                (0, bun_test_1.expect)(replayRequests).toHaveLength(2);
                (0, bun_test_1.expect)(replayRequests.flatMap(function (_a) {
                    var request = _a.request;
                    return request.messages.filter(function (message) {
                        return message.content.endsWith("thinking:");
                    });
                })).toEqual([]);
                return [3 /*break*/, 18];
            case 16: return [4 /*yield*/, ((_b = reopened.dispose) === null || _b === void 0 ? void 0 : _b.call(reopened))];
            case 17:
                _c.sent();
                return [7 /*endfinally*/];
            case 18: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plan document paths are validated without masking the reason as internal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, provider, client;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("three-stream-plan-path")];
            case 1:
                root = _b.sent();
                provider = {
                    provider: "plan-path",
                    model: "plan-path",
                    stream: function () { return __asyncGenerator(this, arguments, function stream_3() { return __generator(this, function (_a) {
                        return [2 /*return*/];
                    }); }); },
                };
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_path",
                    provider: provider,
                });
                client.start(function () { return undefined; });
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                return [4 /*yield*/, (0, bun_test_1.expect)(client.planDocMark({ path: "/tmp/outside-plan.md" })).rejects.toMatchObject({
                        name: "RuntimeInvalidParams",
                        message: bun_test_1.expect.stringContaining("must be under .natalia/plans"),
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(client.planDocMark({ path: ".natalia/plans/missing.md" })).rejects.toMatchObject({
                        name: "RuntimeInvalidParams",
                        message: bun_test_1.expect.stringContaining("does not exist"),
                    })];
            case 4:
                _b.sent();
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
