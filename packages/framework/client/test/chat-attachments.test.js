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
var runtime_services_1 = require("@natalia/runtime-services");
var provider_model_1 = require("@anthelia/provider-model");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var config_1 = require("@natalia/config");
var runtime_1 = require("@natalia/runtime");
var attachments_1 = require("@anthelia/attachments");
var collab_1 = require("@natalia/collab");
var collab_2 = require("@natalia/collab");
var collab_3 = require("@natalia/collab");
function pngBytes(width, height) {
    if (width === void 0) { width = 1; }
    if (height === void 0) { height = 1; }
    var bytes = Buffer.alloc(24, 0x61);
    Buffer.from("89504e470d0a1a0a", "hex").copy(bytes, 0);
    bytes.writeUInt32BE(13, 8);
    bytes.write("IHDR", 12, "ascii");
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return bytes;
}
function makeHarness() {
    return __awaiter(this, arguments, void 0, function (input) {
        var root, config, requests, provider, events, sequence, attachmentService, exec, ctx;
        var _this = this;
        var _a, _b, _c, _d;
        if (input === void 0) { input = {}; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chat-attachment-"))];
                case 1:
                    root = _e.sent();
                    config = (0, config_1.defaultConfigV3)();
                    config.providers.local = {
                        name: "Local",
                        driver: "openai",
                        enabled: true,
                        connection: { apiKey: "test-only" },
                        requestDefaults: { stream: true, headers: {}, options: {} },
                    };
                    config.catalog.providers.local = {
                        models: {
                            chat: {
                                name: "chat",
                                status: "stable",
                                source: "manual",
                                capabilities: {
                                    toolCall: true,
                                    reasoning: true,
                                    thinking: true,
                                    imageInput: (_a = input.imageInput) !== null && _a !== void 0 ? _a : false,
                                    videoInput: (_b = input.videoInput) !== null && _b !== void 0 ? _b : false,
                                },
                                limits: { contextWindow: "auto", maxOutputTokens: null },
                            },
                        },
                    };
                    config.defaultModel = { provider: "local", model: "chat" };
                    requests = [];
                    provider = {
                        provider: "fake",
                        model: "chat",
                        imageInput: (_c = input.providerImageInput) !== null && _c !== void 0 ? _c : true,
                        videoInput: (_d = input.providerVideoInput) !== null && _d !== void 0 ? _d : true,
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            requests.push(request);
                                            return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done", finishReason: "stop" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    };
                    events = [];
                    sequence = 0;
                    attachmentService = (0, attachments_1.createAttachmentService)(root);
                    exec = {
                        session: { id: "ses_chat_attachment", events: events },
                        // This is an in-memory test event log, not a fast-attach tail: tell the
                        // fact-state completion path there is no store page left to fetch.
                        fullEventsLoaded: true,
                        tokenMeter: new runtime_1.TokenMeter(),
                        naviTokenMeter: new runtime_1.TokenMeter(),
                        niaTokenMeter: new runtime_1.TokenMeter(),
                        naviChatLedger: new runtime_1.ContextLedger(),
                        niaChatLedger: new runtime_1.ContextLedger(),
                        naviPendingQueue: [],
                        niaPendingQueue: [],
                    };
                    ctx = {
                        // The chat turn path resolves services through the directory now; the
                        // hand-rolled port stub stays for the paths still on ports.
                        state: {
                            // The chat turn path resolves services through the directory now; the
                            // attachment service has a real double, everything else stays absent.
                            serviceDirectory: (0, runtime_services_1.createTestContext)([
                                attachments_1.attachmentService.mock(attachmentService),
                            ]),
                        },
                        ports: {
                            getTsRuntimeConfig: function () { return config; },
                            getContextWindowResolver: function () { return ({
                                resolve: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, ({ contextWindow: 200000, source: "test" })];
                                }); }); },
                            }); },
                            resolveContextStatusConfig: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, ({
                                            max: 200000,
                                            thresholdPercent: 85,
                                            reserved: 20000,
                                        })];
                                });
                            }); },
                            modelRefKeyForSelection: function () { return "local/chat"; },
                            getChatDefaultProvider: function () { return provider; },
                            providerFromEnvironment: function () { return undefined; },
                            publishForSession: function (_exec, event) {
                                events.push(event);
                            },
                            nextChatSequence: function () { return sequence++; },
                            nextPlanSequence: function () { return sequence++; },
                            naviChatPersona: function () { return "<navi_chat_persona>Navi</navi_chat_persona>"; },
                            naviChatLiveContext: function () { return ""; },
                            niaChatPersona: function () { return "<nia_chat_persona>Nia</nia_chat_persona>"; },
                            niaChatLiveContext: function () { return ""; },
                            naviChatTools: function () { return []; },
                            niaChatTools: function () { return []; },
                            effectiveMaxSteps: function () { return 1; },
                            redactToolOutput: function (text) { return text; },
                            getWorkspaceRoot: function () { return root; },
                            getReady: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, undefined];
                            }); }); },
                            rememberTitleInput: function () { return undefined; },
                            resolveService: function (name) {
                                return name === attachments_1.attachmentService.id ? attachmentService : undefined;
                            },
                        },
                    };
                    return [2 /*return*/, {
                            root: root,
                            config: config,
                            events: events,
                            requests: requests,
                            exec: exec,
                            ctx: ctx,
                            provider: provider,
                            store: function (paths) { return attachmentService.store(paths); },
                        }];
            }
        });
    });
}
function runChannel(channel, harness, input) {
    return __awaiter(this, void 0, void 0, function () {
        var event, signal, turnInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event = __assign({ type: channel === "navi"
                            ? "navi.chat.message.new"
                            : "nia.chat.message.new", id: "".concat(input.responseMessageID, ":user"), messageID: "".concat(input.responseMessageID, ":user"), role: "user", text: input.text, at: new Date().toISOString() }, (input.attachments ? { attachments: input.attachments } : {}));
                    harness.events.push(event);
                    signal = new AbortController().signal;
                    turnInput = __assign(__assign({}, input), { exec: harness.exec });
                    if (!(channel === "navi")) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, collab_1.createNaviChatTurn)(harness.ctx).runNaviChatTurn(turnInput, signal)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, (0, collab_2.createNiaChatTurn)(harness.ctx).runNiaChatTurn(turnInput, signal)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function lastUser(request) {
    return request.messages.findLast(function (message) { return message.role === "user"; });
}
function userMessages(request) {
    return request.messages.filter(function (message) { return message.role === "user"; });
}
(0, bun_test_1.test)("Navi and Nia lower idle text attachments into provider content", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, channel, harness, attachment, user;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = ["navi", "nia"];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 7];
                channel = _a[_i];
                return [4 /*yield*/, makeHarness()];
            case 2:
                harness = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(harness.root, "notes.txt"), "evidence\n")];
            case 3:
                _b.sent();
                return [4 /*yield*/, harness.store(["notes.txt"])];
            case 4:
                attachment = (_b.sent())[0];
                return [4 /*yield*/, runChannel(channel, harness, {
                        text: "look",
                        responseMessageID: "".concat(channel, "-text"),
                        attachments: [attachment],
                    })];
            case 5:
                _b.sent();
                user = lastUser(harness.requests[0]);
                (0, bun_test_1.expect)(user === null || user === void 0 ? void 0 : user.content).toContain("[Attachment: notes.txt]\nevidence");
                _b.label = 6;
            case 6:
                _i++;
                return [3 /*break*/, 1];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Navi and Nia replay prior attachments into later provider turns", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, channel, harness, attachment, secondUser;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = ["navi", "nia"];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 8];
                channel = _a[_i];
                return [4 /*yield*/, makeHarness()];
            case 2:
                harness = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(harness.root, "history.txt"), "evidence")];
            case 3:
                _b.sent();
                return [4 /*yield*/, harness.store(["history.txt"])];
            case 4:
                attachment = (_b.sent())[0];
                return [4 /*yield*/, runChannel(channel, harness, {
                        text: "first",
                        responseMessageID: "".concat(channel, "-history-1"),
                        attachments: [attachment],
                    })];
            case 5:
                _b.sent();
                return [4 /*yield*/, runChannel(channel, harness, {
                        text: "second",
                        responseMessageID: "".concat(channel, "-history-2"),
                    })];
            case 6:
                _b.sent();
                secondUser = userMessages(harness.requests[1]).find(function (message) {
                    return message.content.includes("first");
                });
                (0, bun_test_1.expect)(secondUser === null || secondUser === void 0 ? void 0 : secondUser.content).toContain("[Attachment: history.txt]\nevidence");
                _b.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 1];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Navi and Nia attach images only when the model and provider both support them", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, channel, supported, supportedAttachment, supportedUser, unsupported, unsupportedAttachment, unsupportedUser;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = ["navi", "nia"];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 11];
                channel = _a[_i];
                return [4 /*yield*/, makeHarness({ imageInput: true })];
            case 2:
                supported = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(supported.root, "image.png"), pngBytes())];
            case 3:
                _b.sent();
                return [4 /*yield*/, supported.store(["image.png"])];
            case 4:
                supportedAttachment = (_b.sent())[0];
                return [4 /*yield*/, runChannel(channel, supported, {
                        text: "look",
                        responseMessageID: "".concat(channel, "-image-supported"),
                        attachments: [supportedAttachment],
                    })];
            case 5:
                _b.sent();
                supportedUser = lastUser(supported.requests[0]);
                (0, bun_test_1.expect)(supportedUser === null || supportedUser === void 0 ? void 0 : supportedUser.images).toHaveLength(1);
                (0, bun_test_1.expect)(supportedUser === null || supportedUser === void 0 ? void 0 : supportedUser.content).not.toContain("[Attached image/png:");
                return [4 /*yield*/, makeHarness({
                        imageInput: false,
                        providerImageInput: true,
                    })];
            case 6:
                unsupported = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(unsupported.root, "image.png"), pngBytes())];
            case 7:
                _b.sent();
                return [4 /*yield*/, unsupported.store(["image.png"])];
            case 8:
                unsupportedAttachment = (_b.sent())[0];
                return [4 /*yield*/, runChannel(channel, unsupported, {
                        text: "look",
                        responseMessageID: "".concat(channel, "-image-unsupported"),
                        attachments: [unsupportedAttachment],
                    })];
            case 9:
                _b.sent();
                unsupportedUser = lastUser(unsupported.requests[0]);
                (0, bun_test_1.expect)(unsupportedUser === null || unsupportedUser === void 0 ? void 0 : unsupportedUser.images).toBeUndefined();
                (0, bun_test_1.expect)(unsupportedUser === null || unsupportedUser === void 0 ? void 0 : unsupportedUser.content).toContain("[Attached image/png: image.png]");
                _b.label = 10;
            case 10:
                _i++;
                return [3 /*break*/, 1];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Navi and Nia attach videos only when the model and provider both support them", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, channel, supported, supportedAttachment, supportedUser, unsupported, unsupportedAttachment, unsupportedUser;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = ["navi", "nia"];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 11];
                channel = _a[_i];
                return [4 /*yield*/, makeHarness({ videoInput: true })];
            case 2:
                supported = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(supported.root, "clip.mp4"), Buffer.from("0000001866747970", "hex"))];
            case 3:
                _b.sent();
                return [4 /*yield*/, supported.store(["clip.mp4"])];
            case 4:
                supportedAttachment = (_b.sent())[0];
                return [4 /*yield*/, runChannel(channel, supported, {
                        text: "watch",
                        responseMessageID: "".concat(channel, "-video-supported"),
                        attachments: [supportedAttachment],
                    })];
            case 5:
                _b.sent();
                supportedUser = lastUser(supported.requests[0]);
                (0, bun_test_1.expect)(supportedUser === null || supportedUser === void 0 ? void 0 : supportedUser.videos).toHaveLength(1);
                (0, bun_test_1.expect)(supportedUser === null || supportedUser === void 0 ? void 0 : supportedUser.content).not.toContain("[Attached video/mp4:");
                return [4 /*yield*/, makeHarness({
                        videoInput: false,
                        providerVideoInput: true,
                    })];
            case 6:
                unsupported = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(unsupported.root, "clip.mp4"), Buffer.from("0000001866747970", "hex"))];
            case 7:
                _b.sent();
                return [4 /*yield*/, unsupported.store(["clip.mp4"])];
            case 8:
                unsupportedAttachment = (_b.sent())[0];
                return [4 /*yield*/, runChannel(channel, unsupported, {
                        text: "watch",
                        responseMessageID: "".concat(channel, "-video-unsupported"),
                        attachments: [unsupportedAttachment],
                    })];
            case 9:
                _b.sent();
                unsupportedUser = lastUser(unsupported.requests[0]);
                (0, bun_test_1.expect)(unsupportedUser === null || unsupportedUser === void 0 ? void 0 : unsupportedUser.videos).toBeUndefined();
                (0, bun_test_1.expect)(unsupportedUser === null || unsupportedUser === void 0 ? void 0 : unsupportedUser.content).toContain("[Attached video/mp4: clip.mp4]");
                _b.label = 10;
            case 10:
                _i++;
                return [3 /*break*/, 1];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("busy chat queues carry attachments and drain them per message", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, channel, harness, _b, one, two, queue, users;
    var _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _i = 0, _a = ["navi", "nia"];
                _e.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 8];
                channel = _a[_i];
                return [4 /*yield*/, makeHarness()];
            case 2:
                harness = _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(harness.root, "one.txt"), "first")];
            case 3:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(harness.root, "two.txt"), "second")];
            case 4:
                _e.sent();
                return [4 /*yield*/, harness.store(["one.txt", "two.txt"])];
            case 5:
                _b = _e.sent(), one = _b[0], two = _b[1];
                queue = channel === "navi"
                    ? harness.exec.naviPendingQueue
                    : harness.exec.niaPendingQueue;
                queue.push({
                    messageID: "pending-one",
                    text: "first pending",
                    attachments: [one],
                }, {
                    messageID: "pending-two",
                    text: "second pending",
                    attachments: [two],
                });
                return [4 /*yield*/, runChannel(channel, harness, {
                        text: "start",
                        responseMessageID: "".concat(channel, "-pending"),
                    })];
            case 6:
                _e.sent();
                users = userMessages(harness.requests[0]);
                (0, bun_test_1.expect)((_c = users[users.length - 2]) === null || _c === void 0 ? void 0 : _c.content).toContain("[Attachment: one.txt]\nfirst");
                (0, bun_test_1.expect)((_d = users[users.length - 1]) === null || _d === void 0 ? void 0 : _d.content).toContain("[Attachment: two.txt]\nsecond");
                _e.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 1];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Navi and Nia busy submits store the same attachments in their pending queue", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _loop_1, _i, _a, channel;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _loop_1 = function (channel) {
                    var harness, attachmentService, controller, surface, queue;
                    return __generator(this, function (_f) {
                        switch (_f.label) {
                            case 0: return [4 /*yield*/, makeHarness()];
                            case 1:
                                harness = _f.sent();
                                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(harness.root, "queued.txt"), "queued")];
                            case 2:
                                _f.sent();
                                attachmentService = (0, attachments_1.createAttachmentService)(harness.root);
                                controller = {
                                    runTurn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                        return [2 /*return*/, undefined];
                                    }); }); },
                                    runNaviChatTurn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                        return [2 /*return*/, undefined];
                                    }); }); },
                                    runNiaChatTurn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                        return [2 /*return*/, undefined];
                                    }); }); },
                                    requestNaviWake: function () { return undefined; },
                                    requestNiaWake: function () { return undefined; },
                                    naviBusy: function () { return true; },
                                    niaBusy: function () { return true; },
                                    abortNavi: function () { return false; },
                                    abortNia: function () { return false; },
                                    dispose: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                        return [2 /*return*/, undefined];
                                    }); }); },
                                };
                                harness.ctx.ports.getExecutionBySession = function () {
                                    return new Map([[harness.exec.session.id, harness.exec]]);
                                };
                                harness.ctx.ports.ensureExecution = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, harness.exec];
                                }); }); };
                                harness.ctx.ports.resolveService = (function (name) {
                                    if (name === attachments_1.attachmentService.id)
                                        return attachmentService;
                                    return undefined;
                                });
                                harness.ctx.state.serviceDirectory = (0, runtime_services_1.createTestContext)([
                                    provider_model_1.providerModelController.mock(controller),
                                    attachments_1.attachmentService.mock(attachmentService),
                                ]);
                                surface = channel === "navi"
                                    ? (0, collab_3.createNaviChatSurface)(harness.ctx)
                                    : (0, collab_3.createNiaChatSurface)(harness.ctx);
                                return [4 /*yield*/, surface.submit({
                                        text: "busy",
                                        sessionID: harness.exec.session.id,
                                        attachments: ["queued.txt"],
                                    })];
                            case 3:
                                _f.sent();
                                queue = channel === "navi"
                                    ? harness.exec.naviPendingQueue
                                    : harness.exec.niaPendingQueue;
                                (0, bun_test_1.expect)(queue).toHaveLength(1);
                                (0, bun_test_1.expect)((_d = (_c = (_b = queue[0]) === null || _b === void 0 ? void 0 : _b.attachments) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.filename).toBe("queued.txt");
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, _a = ["navi", "nia"];
                _e.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                channel = _a[_i];
                return [5 /*yield**/, _loop_1(channel)];
            case 2:
                _e.sent();
                _e.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("chat PDF attachments are diagnosed and never reach the provider", function () { return __awaiter(void 0, void 0, void 0, function () {
    var harness, pdf, user;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, makeHarness({ imageInput: true, videoInput: true })];
            case 1:
                harness = _a.sent();
                pdf = {
                    id: "att_pdf",
                    path: ".natalia/attachments/att_pdf-report.pdf",
                    filename: "report.pdf",
                    mediaType: "application/pdf",
                    byteLength: 4,
                    sha256: "pdf-hash",
                };
                return [4 /*yield*/, runChannel("navi", harness, {
                        text: "read",
                        responseMessageID: "navi-pdf",
                        attachments: [pdf],
                    })];
            case 2:
                _a.sent();
                user = lastUser(harness.requests[0]);
                (0, bun_test_1.expect)(user === null || user === void 0 ? void 0 : user.images).toBeUndefined();
                (0, bun_test_1.expect)(user === null || user === void 0 ? void 0 : user.videos).toBeUndefined();
                (0, bun_test_1.expect)(user === null || user === void 0 ? void 0 : user.content).not.toContain("report.pdf");
                (0, bun_test_1.expect)(harness.events.some(function (event) {
                    return event.type === "diagnostic" &&
                        event.message.includes("Unsupported attachment report.pdf");
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
