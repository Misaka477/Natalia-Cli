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
var config_1 = require("@natalia/config");
var runtime_1 = require("@natalia/runtime");
var compaction_1 = require("@anthelia/compaction");
var provider_model_1 = require("@anthelia/provider-model");
var runtime_services_1 = require("@natalia/runtime-services");
var collab_1 = require("@natalia/collab");
var collab_2 = require("@natalia/collab");
var collab_3 = require("@natalia/collab");
(0, bun_test_1.test)("Nia normal and Navi expert resolve independent adapters, models and thinking on submit and wake", function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, _i, _a, _b, id, driver, model, events, exec, sequence, ctx, navi, nia, wakeInputs, wakeController, requests, originalFetch, wake;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                config = (0, config_1.defaultConfigV3)();
                for (_i = 0, _a = [
                    ["qifengstep", "anthropic-compatible", "step-3.7-flash"],
                    ["grok", "openai-compatible", "grok-4.6"],
                    ["expert", "openai-compatible", "expert-model"],
                ]; _i < _a.length; _i++) {
                    _b = _a[_i], id = _b[0], driver = _b[1], model = _b[2];
                    config.providers[id] = {
                        name: id,
                        driver: driver,
                        enabled: true,
                        connection: { apiKey: "test-only", baseURL: "https://".concat(id, ".invalid/v1") },
                        requestDefaults: { stream: true, headers: {}, options: {} },
                    };
                    config.catalog.providers[id] = {
                        models: (_c = {},
                            _c[model] = {
                                name: model,
                                status: "stable",
                                source: "manual",
                                capabilities: {
                                    toolCall: true,
                                    reasoning: true,
                                    thinking: true,
                                    imageInput: false,
                                    videoInput: false,
                                },
                                limits: { contextWindow: 32768, maxOutputTokens: 16384 },
                            },
                            _c),
                    };
                    config.modelOverrides["".concat(id, "/").concat(model)] = {
                        enabled: true,
                        name: model,
                        requestDefaults: { temperature: null, topP: null, thinkingEnabled: true },
                        requestOptions: {},
                        headers: {},
                    };
                }
                config.defaultModel = { provider: "qifengstep", model: "step-3.7-flash" };
                events = [];
                exec = {
                    session: { id: "ses_model_streams", events: events },
                    // This harness owns the complete live event array, not a tail.
                    fullEventsLoaded: true,
                    tokenMeter: new runtime_1.TokenMeter(),
                    naviTokenMeter: new runtime_1.TokenMeter(),
                    niaTokenMeter: new runtime_1.TokenMeter(),
                    naviChatLedger: new runtime_1.ContextLedger(),
                    niaChatLedger: new runtime_1.ContextLedger(),
                    naviPendingQueue: [],
                    niaPendingQueue: [],
                    naviChatModelProfile: {
                        normal: { modelID: "expert/expert-model", reasoningEffort: "low" },
                        expert: {
                            modelID: "expert/expert-model",
                            variant: "expert-variant",
                            reasoningEffort: "xhigh",
                        },
                    },
                    niaChatModelProfile: {
                        normal: {
                            modelID: "grok/grok-4.6",
                            variant: "nia-variant",
                            reasoningEffort: "high",
                        },
                    },
                    provider: {
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                return __generator(this, function (_a) {
                                    throw new Error("main provider must not serve chat");
                                });
                            });
                        },
                    },
                };
                sequence = 0;
                ctx = {
                    state: {},
                    ports: {
                        getTsRuntimeConfig: function () { return config; },
                        getContextWindowResolver: function () { return ({
                            resolve: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, ({ contextWindow: 32768, source: "test" })];
                            }); }); },
                        }); },
                        resolveContextStatusConfig: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ({
                                        max: 32768,
                                        thresholdPercent: 85,
                                        reserved: 8000,
                                    })];
                            });
                        }); },
                        modelRefKeyForSelection: function () { return undefined; },
                        getChatDefaultProvider: function () { return undefined; },
                        providerFromEnvironment: function () { return undefined; },
                        publishForSession: function (_, event) {
                            events.push(event);
                        },
                        nextChatSequence: function () { return sequence++; },
                        naviChatPersona: function () { return "Navi only"; },
                        naviChatLiveContext: function () { return ""; },
                        niaChatPersona: function () { return "Nia only"; },
                        niaChatLiveContext: function () { return ""; },
                        naviChatTools: function () { return []; },
                        niaChatTools: function () { return []; },
                        effectiveMaxSteps: function () { return 1; },
                        redactToolOutput: function (text) { return text; },
                        getWorkspaceRoot: function () { return "/tmp/kilo"; },
                    },
                };
                navi = (0, collab_1.createNaviChatTurn)(ctx);
                nia = (0, collab_2.createNiaChatTurn)(ctx);
                wakeInputs = [];
                wakeController = {
                    runTurn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                    runNaviChatTurn: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    wakeInputs.push(input);
                                    return [4 /*yield*/, navi.runNaviChatTurn(__assign(__assign({}, input), { exec: exec }), new AbortController().signal)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    runNiaChatTurn: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    wakeInputs.push(input);
                                    return [4 /*yield*/, nia.runNiaChatTurn(__assign(__assign({}, input), { exec: exec }), new AbortController().signal)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    requestNaviWake: function () { return undefined; },
                    requestNiaWake: function () { return undefined; },
                    naviBusy: function () { return false; },
                    niaBusy: function () { return false; },
                    abortNavi: function () { return false; },
                    abortNia: function () { return false; },
                    dispose: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, undefined];
                    }); }); },
                };
                ctx.ports.resolveService = (function () {
                    return wakeController;
                });
                ctx.state.serviceDirectory = (0, runtime_services_1.createTestContext)([
                    compaction_1.compactionService.mock({
                        compactBeforeProviderStep: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ compacted: false })];
                        }); }); },
                        runWithContextLimitRecovery: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ recovered: false })];
                        }); }); },
                        prepareContextRequest: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ({
                                        outbound: input.outbound,
                                        decision: "none",
                                        compacted: false,
                                        pruned: 0,
                                        used: 0,
                                    })];
                            });
                        }); },
                    }),
                    provider_model_1.providerModelController.mock(wakeController),
                ]);
                requests = [];
                originalFetch = globalThis.fetch;
                globalThis.fetch = Object.assign(function (url, init) { return __awaiter(void 0, void 0, void 0, function () {
                    var body, sse;
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        requests.push({ url: String(url), body: body });
                        sse = String(url).endsWith("/messages")
                            ? [
                                {
                                    type: "content_block_delta",
                                    delta: { type: "thinking_delta", thinking: "step thinking" },
                                },
                                {
                                    type: "content_block_delta",
                                    delta: { type: "text_delta", text: "step answer" },
                                },
                                { type: "message_delta", delta: { stop_reason: "end_turn" } },
                            ]
                            : [
                                { choices: [{ delta: { reasoning_content: "grok thinking" } }] },
                                {
                                    choices: [
                                        { delta: { content: "grok answer" }, finish_reason: "stop" },
                                    ],
                                },
                            ];
                        return [2 /*return*/, new Response(sse.map(function (event) { return "data: ".concat(JSON.stringify(event), "\n\n"); }).join(""))];
                    });
                }); }, { preconnect: originalFetch.preconnect });
                _d.label = 1;
            case 1:
                _d.trys.push([1, , 6, 7]);
                return [4 /*yield*/, nia.runNiaChatTurn({ exec: exec, text: "audit", responseMessageID: "nia-submit" }, new AbortController().signal)];
            case 2:
                _d.sent();
                (0, bun_test_1.expect)(requests[0]).toMatchObject({
                    url: "https://grok.invalid/v1/chat/completions",
                    body: { model: "grok-4.6", reasoning_effort: "high" },
                });
                wake = (0, collab_3.createCollaborationWake)(ctx);
                return [4 /*yield*/, wake.wakeNia(exec)];
            case 3:
                _d.sent();
                (0, bun_test_1.expect)(requests[1]).toMatchObject({
                    url: "https://grok.invalid/v1/chat/completions",
                    body: { model: "grok-4.6", reasoning_effort: "high" },
                });
                (0, bun_test_1.expect)(wakeInputs[0]).toMatchObject({
                    model: { modelID: "grok/grok-4.6", variant: "nia-variant" },
                    reasoningEffort: "high",
                });
                exec.advisorPending = true;
                return [4 /*yield*/, wake.wakeNavi(exec)];
            case 4:
                _d.sent();
                (0, bun_test_1.expect)(requests[2]).toMatchObject({
                    url: "https://expert.invalid/v1/chat/completions",
                    body: { model: "expert-model", reasoning_effort: "xhigh" },
                });
                (0, bun_test_1.expect)(wakeInputs[1]).toMatchObject({
                    model: { modelID: "expert/expert-model", variant: "expert-variant" },
                    reasoningEffort: "xhigh",
                });
                (0, bun_test_1.expect)(exec.advisorPending).toBe(false);
                exec.niaChatModelProfile = { normal: { reasoningEffort: "high" } };
                return [4 /*yield*/, nia.runNiaChatTurn({ exec: exec, text: "default", responseMessageID: "nia-default" }, new AbortController().signal)];
            case 5:
                _d.sent();
                (0, bun_test_1.expect)(requests[3]).toMatchObject({
                    url: "https://qifengstep.invalid/v1/messages",
                    body: {
                        model: "step-3.7-flash",
                        thinking: { type: "enabled", budget_tokens: 8192 },
                    },
                });
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "nia.chat.thinking.done"; })).toHaveLength(3);
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "navi.chat.thinking.done"; })).toHaveLength(1);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "thinking.delta"; })).toBe(false);
                return [3 /*break*/, 7];
            case 6:
                globalThis.fetch = originalFetch;
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
