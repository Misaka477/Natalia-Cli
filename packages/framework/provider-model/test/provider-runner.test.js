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
var runtime_1 = require("@natalia/runtime");
var tools_1 = require("@anthelia/tools");
var provider_runner_1 = require("../src/provider-runner");
var retry_1 = require("@anthelia/retry");
var attachments_1 = require("@anthelia/attachments");
var compaction_1 = require("@anthelia/compaction");
function content(text) {
    return { type: "content", text: text };
}
/**
 * Completes a partial test budget with the ContextBudget policy defaults, so
 * fixtures only spell out the fields a test actually varies (plan §2.3).
 */
function withBudgetDefaults(budget) {
    return __assign({ reservedSource: "config", preservedRecentMessages: 10, preservedRecentTokens: 0, maxOverflowRetries: 1, prune: runtime_1.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS }, budget);
}
function thinking(text) {
    return { type: "thinking", text: text };
}
function toolCall(calls) {
    return { type: "tool_call", calls: calls };
}
function usage(inputTokens, outputTokens) {
    return { type: "usage", inputTokens: inputTokens, outputTokens: outputTokens };
}
function makeHarness(provider, options) {
    var _this = this;
    var events = [];
    var ledger = new runtime_1.ContextLedger();
    var checkpoints = [];
    var executedCalls = [];
    var activeAbort;
    var activeTurnID;
    var lastUsage;
    var retry = (0, retry_1.createRetryService)({
        policy: function () {
            var _a;
            return (_a = options === null || options === void 0 ? void 0 : options.retryPolicy) !== null && _a !== void 0 ? _a : {
                maxAttemptsPerStep: 1,
                initialBackoffMs: 1,
                maxBackoffMs: 1,
                jitterMs: 0,
                maxRetryAfterMs: 1,
            };
        },
    });
    var runner = (0, provider_runner_1.createProviderRunner)(__assign(__assign({ provider: function () { return provider; }, session: function () { return undefined; }, context: function () { return ledger; }, tools: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.tools) !== null && _a !== void 0 ? _a : new tools_1.ToolRegistry(); }, attachmentReferences: function () { return new Map(); }, attachments: (0, attachments_1.createAttachmentService)("/tmp/ws"), compaction: (0, compaction_1.createCompactionService)({ retry: retry }), mcp: function () { return undefined; }, agentRegistry: function () { return undefined; }, activeAbort: function () { return activeAbort; }, setActiveAbort: function (controller) {
            activeAbort = controller;
        }, activeTurnID: function () { return activeTurnID; }, setActiveTurnID: function (id) {
            activeTurnID = id;
        }, selectedAgent: function () { return undefined; }, setSelectedAgent: function () { return undefined; }, pendingAgent: function () { return undefined; }, setPendingAgent: function () { return undefined; }, selectedModel: function () { return undefined; }, modelCapabilities: function () { return ({
            toolCall: true,
            reasoning: true,
            thinking: true,
            imageInput: false,
            videoInput: false,
        }); }, setActiveModelCapabilities: function () { return undefined; }, permissionMode: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.permissionMode) !== null && _a !== void 0 ? _a : "auto"; }, workspaceRoot: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.workspaceRoot) !== null && _a !== void 0 ? _a : "/tmp/ws"; }, tsRuntimeConfig: function () {
            return (options === null || options === void 0 ? void 0 : options.preservedRecentMessages) === undefined
                ? undefined
                : {
                    version: 3,
                    instructions: { enabled: true },
                    defaultAgentMode: "",
                    agentModes: {},
                    context: {
                        preservedRecentMessages: options.preservedRecentMessages,
                    },
                };
        }, runtimeContextConfig: function () {
            var _a;
            // The budget is the canonical source (plan §2.3) and is derived from the
            // ts config, so the harness option that models
            // `tsRuntimeConfig().context.preservedRecentMessages` is applied last.
            var explicit = (_a = options === null || options === void 0 ? void 0 : options.runtimeContextConfig) !== null && _a !== void 0 ? _a : {
                max: 200000,
                thresholdPercent: 85,
                reserved: 8192,
            };
            var budget = withBudgetDefaults(explicit);
            var preservedRecentMessages = options === null || options === void 0 ? void 0 : options.preservedRecentMessages;
            return preservedRecentMessages === undefined
                ? budget
                : __assign(__assign({}, budget), { preservedRecentMessages: preservedRecentMessages });
        }, activeSkill: function () { return undefined; }, skillsList: function () { return []; }, takeLiveUserMessages: function () { var _a, _b; return (_b = (_a = options === null || options === void 0 ? void 0 : options.takeLiveUserMessages) === null || _a === void 0 ? void 0 : _a.call(options)) !== null && _b !== void 0 ? _b : []; }, takeStepInputs: function (step) { var _a, _b; return (_b = (_a = options === null || options === void 0 ? void 0 : options.takeStepInputs) === null || _a === void 0 ? void 0 : _a.call(options, step)) !== null && _b !== void 0 ? _b : []; }, hasPendingStepInputs: function () { var _a, _b; return (_b = (_a = options === null || options === void 0 ? void 0 : options.hasPendingStepInputs) === null || _a === void 0 ? void 0 : _a.call(options)) !== null && _b !== void 0 ? _b : false; }, isTurnAnnounced: function (id) { var _a, _b; return (_b = (_a = options === null || options === void 0 ? void 0 : options.isTurnAnnounced) === null || _a === void 0 ? void 0 : _a.call(options, id)) !== null && _b !== void 0 ? _b : false; }, markTurnAnnounced: function (id) { var _a; return (_a = options === null || options === void 0 ? void 0 : options.markTurnAnnounced) === null || _a === void 0 ? void 0 : _a.call(options, id); }, naviSuggestions: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.naviSuggestions) !== null && _a !== void 0 ? _a : []; }, naviIntro: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.naviIntro) !== null && _a !== void 0 ? _a : false; }, naviAnswers: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.naviAnswers) !== null && _a !== void 0 ? _a : []; }, naviChats: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.naviChats) !== null && _a !== void 0 ? _a : []; }, activePlan: function () { return options === null || options === void 0 ? void 0 : options.activePlan; }, projectDocuments: function () { return options === null || options === void 0 ? void 0 : options.projectDocuments; } }, ((options === null || options === void 0 ? void 0 : options.tokenMeter) ? { tokenMeter: function () { return options.tokenMeter; } } : {})), { retry: retry, lastProviderUsage: function () { return lastUsage; }, setLastProviderUsage: function (usage) {
            lastUsage = usage;
        }, publish: function (event) { return events.push(event); }, applyAgentPolicy: function () { return undefined; }, applyAgentProvider: function () { return undefined; }, persistInboxPromotion: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, undefined];
        }); }); }, createTurnCheckpoint: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                checkpoints.push({ reason: input.reason, step: input.step });
                return [2 /*return*/];
            });
        }); }, isToolAllowed: function () { return true; }, setInFlightOperation: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, undefined];
        }); }); }, executeToolCalls: function (turnID, calls, assistant, _materialized, reasoning) { return __awaiter(_this, void 0, void 0, function () {
            var _i, calls_1, call;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                for (_i = 0, calls_1 = calls; _i < calls_1.length; _i++) {
                    call = calls_1[_i];
                    executedCalls.push({ call: call });
                }
                return [2 /*return*/, [
                        __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ role: "assistant", content: assistant }, ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.content) !== undefined
                            ? { reasoningContent: reasoning.content }
                            : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.field) ? { reasoningField: reasoning.field } : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.signature)
                            ? { reasoningSignature: reasoning.signature }
                            : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.redacted) ? { reasoningRedacted: true } : {})), (((_a = reasoning === null || reasoning === void 0 ? void 0 : reasoning.blocks) === null || _a === void 0 ? void 0 : _a.length)
                            ? { reasoningBlocks: reasoning.blocks }
                            : {})), (((_b = reasoning === null || reasoning === void 0 ? void 0 : reasoning.parts) === null || _b === void 0 ? void 0 : _b.length)
                            ? { contentParts: reasoning.parts }
                            : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.providerMetadata)
                            ? { providerMetadata: reasoning.providerMetadata }
                            : {})), ((reasoning === null || reasoning === void 0 ? void 0 : reasoning.textSignature)
                            ? { textSignature: reasoning.textSignature }
                            : {})), { toolCalls: calls }),
                        {
                            role: "tool",
                            toolCallID: (_d = (_c = calls[0]) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : "call_1",
                            toolName: (_f = (_e = calls[0]) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : "read_file",
                            content: "ok",
                        },
                    ]];
            });
        }); }, reloadConfig: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, ({ providerReconfigured: false })];
        }); }); }, runtimeStatusSnapshot: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, ({
                        type: "diagnostic",
                        level: "info",
                        message: "snapshot",
                    })];
            });
        }); }, effectiveMaxSteps: function () { var _a; return (_a = options === null || options === void 0 ? void 0 : options.maxSteps) !== null && _a !== void 0 ? _a : 10; }, waitIfPaused: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, undefined];
        }); }); }, waitingHuman: function () { return undefined; } }));
    return {
        runner: runner,
        events: events,
        ledger: ledger,
        checkpoints: checkpoints,
        executedCalls: executedCalls,
        abortController: function () { return activeAbort; },
        activeTurnID: function () { return activeTurnID; },
    };
}
var turn = {
    id: "t1",
    text: "hello",
    attachments: [],
    resources: [],
    agents: [],
};
(0, bun_test_1.test)("Natalia main transcript receives Anthropic thinking without chat events", function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, _a, runner, events;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                provider = new runtime_1.AnthropicProvider({
                    apiKey: "test-only",
                    model: "step-3.7-flash",
                    maxTokens: 4096,
                    fetch: (function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Response([
                                    {
                                        type: "content_block_start",
                                        index: 0,
                                        content_block: { type: "thinking", thinking: "main " },
                                    },
                                    {
                                        type: "content_block_delta",
                                        index: 0,
                                        delta: { type: "thinking_delta", thinking: "reasoning" },
                                    },
                                    { type: "content_block_stop", index: 0 },
                                    {
                                        type: "content_block_start",
                                        index: 1,
                                        content_block: { type: "text", text: "" },
                                    },
                                    {
                                        type: "content_block_delta",
                                        index: 1,
                                        delta: { type: "text_delta", text: "main answer" },
                                    },
                                    { type: "message_delta", delta: { stop_reason: "end_turn" } },
                                ]
                                    .map(function (event) { return "data: ".concat(JSON.stringify(event), "\n\n"); })
                                    .join(""))];
                        });
                    }); }),
                });
                _a = makeHarness(provider), runner = _a.runner, events = _a.events;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _c.sent();
                (0, bun_test_1.expect)(events
                    .filter(function (event) { return event.type === "thinking.delta"; })
                    .map(function (event) { return event.text; })
                    .join("")).toBe("main reasoning");
                (0, bun_test_1.expect)((_b = events.find(function (event) { return event.type === "content.done"; })) === null || _b === void 0 ? void 0 : _b.text).toBe("main answer");
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type.startsWith("navi.chat.") ||
                        event.type.startsWith("nia.chat.");
                })).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a turn streams content and usage, finishes done, and clears turn state", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runner, events, ledger, checkpoints, abortController, activeTurnID, finished, done, roles;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_1() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await(thinking("reasoning…"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(content("hello "))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await(content("world"))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [4 /*yield*/, __await(usage(10, 5))];
                                    case 7: return [4 /*yield*/, _a.sent()];
                                    case 8:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }), runner = _a.runner, events = _a.events, ledger = _a.ledger, checkpoints = _a.checkpoints, abortController = _a.abortController, activeTurnID = _a.activeTurnID;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                finished = events.find(function (event) {
                    return event.type === "turn.finished";
                });
                (0, bun_test_1.expect)(finished === null || finished === void 0 ? void 0 : finished.stopReason).toBe("done");
                (0, bun_test_1.expect)(finished === null || finished === void 0 ? void 0 : finished.reason).toBeUndefined();
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "thinking.delta"; })).toBe(true);
                done = events.find(function (event) {
                    return event.type === "content.done";
                });
                (0, bun_test_1.expect)(done === null || done === void 0 ? void 0 : done.text).toBe("hello world");
                (0, bun_test_1.expect)(checkpoints).toEqual([{ reason: "turn_begin", step: 1 }]);
                roles = ledger.snapshot().entries.map(function (entry) { return entry.role; });
                (0, bun_test_1.expect)(roles).toContain("user");
                (0, bun_test_1.expect)(roles).toContain("assistant");
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "context.checkpoint"; })).toBe(true);
                // The finally block must release the turn-shaped state.
                (0, bun_test_1.expect)(abortController()).toBeUndefined();
                (0, bun_test_1.expect)(activeTurnID()).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("thinking.done is published before the first content delta", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runner, events, types, thinkingDoneIndex, contentDeltaIndex, thinkingDone;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_2() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await(thinking("reasoning only"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(content("answer"))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }), runner = _a.runner, events = _a.events;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                types = events.map(function (event) { return event.type; });
                thinkingDoneIndex = types.indexOf("thinking.done");
                contentDeltaIndex = types.indexOf("content.delta");
                (0, bun_test_1.expect)(thinkingDoneIndex).toBeGreaterThanOrEqual(0);
                (0, bun_test_1.expect)(contentDeltaIndex).toBeGreaterThanOrEqual(0);
                (0, bun_test_1.expect)(thinkingDoneIndex).toBeLessThan(contentDeltaIndex);
                thinkingDone = events.find(function (event) {
                    return event.type === "thinking.done";
                });
                (0, bun_test_1.expect)(thinkingDone === null || thinkingDone === void 0 ? void 0 : thinkingDone.text).toBe("reasoning only");
                (0, bun_test_1.expect)(thinkingDone === null || thinkingDone === void 0 ? void 0 : thinkingDone.attempt).toBe(1);
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "thinking.done"; })).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("no provider and no reconfigured reload finishes with an error diagnostic", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runner, events, checkpoints, finished;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = makeHarness(undefined), runner = _a.runner, events = _a.events, checkpoints = _a.checkpoints;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                finished = events.find(function (event) {
                    return event.type === "turn.finished";
                });
                (0, bun_test_1.expect)(finished === null || finished === void 0 ? void 0 : finished.stopReason).toBe("error");
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "diagnostic" &&
                        event.level === "error" &&
                        event.message.includes("No real provider configured");
                })).toBe(true);
                (0, bun_test_1.expect)(checkpoints).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("tool calls with an empty final answer emit a deterministic fallback", function () { return __awaiter(void 0, void 0, void 0, function () {
    var streamCalls, _a, runner, events, executedCalls, finished;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                streamCalls = 0;
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_3() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        if (!(streamCalls === 1)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, __await(toolCall([
                                                { id: "call_1", name: "read_file", arguments: '{"path":"a"}' },
                                            ]))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        });
                    },
                }), runner = _a.runner, events = _a.events, executedCalls = _a.executedCalls;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(streamCalls).toBe(2);
                (0, bun_test_1.expect)(executedCalls.map(function (entry) { return entry.call.name; })).toEqual(["read_file"]);
                finished = events.find(function (event) {
                    return event.type === "turn.finished";
                });
                (0, bun_test_1.expect)(finished === null || finished === void 0 ? void 0 : finished.stopReason).toBe("done");
                // The turn reports done, but the model never produced a closing answer: the
                // runtime substituted its fallback, and a consumer must be able to tell.
                (0, bun_test_1.expect)(finished === null || finished === void 0 ? void 0 : finished.reason).toBe("missing_final_response");
                (0, bun_test_1.expect)(events
                    .filter(function (event) {
                    return event.type === "content.delta";
                })
                    .map(function (event) { return event.text; })
                    .join("")).toContain("Tool execution completed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("complete textual tool calls are normalized and executed once", function () { return __awaiter(void 0, void 0, void 0, function () {
    var streamCalls, _a, runner, events, executedCalls;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                streamCalls = 0;
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_4() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        if (!(streamCalls === 1)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, __await(content("Inspecting. <tool_call><function=read_file><parameter=path>&quot;a.txt&quot;</parameter></function></tool_call>"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 3: return [2 /*return*/, _a.sent()];
                                    case 4: return [4 /*yield*/, __await(content("Finished."))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }), runner = _a.runner, events = _a.events, executedCalls = _a.executedCalls;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(executedCalls).toEqual([
                    {
                        call: {
                            id: "raw_xml_tool_0",
                            name: "read_file",
                            arguments: '{"path":"a.txt"}',
                        },
                    },
                ]);
                (0, bun_test_1.expect)(events
                    .filter(function (event) {
                    return event.type === "content.delta";
                })
                    .map(function (event) { return event.text; })).toEqual(["Inspecting. ", "Finished."]);
                (0, bun_test_1.expect)(events.filter(function (event) {
                    return event.type === "diagnostic" &&
                        event.message.includes("native tool calling required");
                })).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("assistant reasoning_content is preserved for the tool-call follow-up", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, streamCalls, runner, assistant;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                streamCalls = 0;
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_5() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        requests.push(request);
                                        if (!(streamCalls === 1)) return [3 /*break*/, 6];
                                        return [4 /*yield*/, __await(thinking("deepseek reasoning"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a.txt"}',
                                                },
                                            ]))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 5: return [2 /*return*/, _a.sent()];
                                    case 6: return [4 /*yield*/, __await(content("done"))];
                                    case 7: return [4 /*yield*/, _a.sent()];
                                    case 8:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                assistant = (_a = requests[1]) === null || _a === void 0 ? void 0 : _a.messages.find(function (message) { var _a; return message.role === "assistant" && ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length); });
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.reasoningContent).toBe("deepseek reasoning");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("signed thinking and tool-call thought signatures survive the tool-call follow-up", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, streamCalls, runner, assistant;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                requests = [];
                streamCalls = 0;
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_6() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        requests.push(request);
                                        if (!(streamCalls === 1)) return [3 /*break*/, 6];
                                        return [4 /*yield*/, __await({ type: "thinking", text: "signed plan", signature: "sig-1" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a.txt"}',
                                                    thoughtSignature: "tool-sig",
                                                },
                                            ]))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 5: return [2 /*return*/, _a.sent()];
                                    case 6: return [4 /*yield*/, __await(content("done"))];
                                    case 7: return [4 /*yield*/, _a.sent()];
                                    case 8:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _d.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                assistant = (_a = requests[1]) === null || _a === void 0 ? void 0 : _a.messages.find(function (message) { var _a; return message.role === "assistant" && ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length); });
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.reasoningContent).toBe("signed plan");
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.reasoningSignature).toBe("sig-1");
                (0, bun_test_1.expect)((_c = (_b = assistant === null || assistant === void 0 ? void 0 : assistant.toolCalls) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.thoughtSignature).toBe("tool-sig");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("multiple signed thinking blocks survive the tool-call follow-up", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, streamCalls, runner, assistant;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                streamCalls = 0;
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_7() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        requests.push(request);
                                        if (!(streamCalls === 1)) return [3 /*break*/, 12];
                                        return [4 /*yield*/, __await({ type: "thinking", text: "plan A", blockIndex: 0 })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({
                                                type: "thinking",
                                                text: "",
                                                signature: "sig-A",
                                                blockIndex: 0,
                                            })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "thinking", text: "plan B", blockIndex: 1 })];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [4 /*yield*/, __await({
                                                type: "thinking",
                                                text: "",
                                                signature: "sig-B",
                                                blockIndex: 1,
                                            })];
                                    case 7: return [4 /*yield*/, _a.sent()];
                                    case 8:
                                        _a.sent();
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a.txt"}',
                                                },
                                            ]))];
                                    case 9: return [4 /*yield*/, _a.sent()];
                                    case 10:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 11: return [2 /*return*/, _a.sent()];
                                    case 12: return [4 /*yield*/, __await(content("done"))];
                                    case 13: return [4 /*yield*/, _a.sent()];
                                    case 14:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                assistant = (_a = requests[1]) === null || _a === void 0 ? void 0 : _a.messages.find(function (message) { var _a; return message.role === "assistant" && ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length); });
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.reasoningBlocks).toEqual([
                    { text: "plan A", signature: "sig-A" },
                    { text: "plan B", signature: "sig-B" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider content parts survive the tool-call follow-up in order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, streamCalls, runner, assistant;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                streamCalls = 0;
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_8() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        requests.push(request);
                                        if (!(streamCalls === 1)) return [3 /*break*/, 10];
                                        return [4 /*yield*/, __await({ type: "thinking", text: "plan", blockIndex: 0 })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "content", text: "visible " })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "content", text: "answer" })];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a.txt"}',
                                                    thoughtSignature: "call-sig",
                                                },
                                            ]))];
                                    case 7: return [4 /*yield*/, _a.sent()];
                                    case 8:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 9: return [2 /*return*/, _a.sent()];
                                    case 10: return [4 /*yield*/, __await(content("done"))];
                                    case 11: return [4 /*yield*/, _a.sent()];
                                    case 12:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                assistant = (_a = requests[1]) === null || _a === void 0 ? void 0 : _a.messages.find(function (message) { var _a; return message.role === "assistant" && ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length); });
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.contentParts).toEqual([
                    { type: "thinking", text: "plan" },
                    { type: "text", text: "visible answer" },
                    {
                        type: "tool_call",
                        id: "call_1",
                        name: "read_file",
                        arguments: '{"path":"a.txt"}',
                        thoughtSignature: "call-sig",
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider metadata survives the tool-call follow-up", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, streamCalls, providerMetadata, runner, assistant;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                streamCalls = 0;
                providerMetadata = {
                    openrouter: {
                        reasoning_details: [
                            { type: "reasoning.text", text: "thinking", index: 0 },
                        ],
                    },
                };
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_9() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        requests.push(request);
                                        if (!(streamCalls === 1)) return [3 /*break*/, 8];
                                        return [4 /*yield*/, __await({ type: "content", text: "answer" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({
                                                type: "done",
                                                finishReason: "tool_calls",
                                                providerMetadata: providerMetadata,
                                            })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a.txt"}',
                                                },
                                            ]))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 7: return [2 /*return*/, _a.sent()];
                                    case 8: return [4 /*yield*/, __await(content("done"))];
                                    case 9: return [4 /*yield*/, _a.sent()];
                                    case 10:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                assistant = (_a = requests[1]) === null || _a === void 0 ? void 0 : _a.messages.find(function (message) { var _a; return message.role === "assistant" && ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length); });
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.providerMetadata).toEqual(providerMetadata);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini text part signatures survive the tool-call follow-up", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, streamCalls, runner, assistant;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                streamCalls = 0;
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_10() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        requests.push(request);
                                        if (!(streamCalls === 1)) return [3 /*break*/, 6];
                                        return [4 /*yield*/, __await({
                                                type: "content",
                                                text: "visible answer",
                                                textSignature: "text-sig",
                                            })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a.txt"}',
                                                },
                                            ]))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 5: return [2 /*return*/, _a.sent()];
                                    case 6: return [4 /*yield*/, __await(content("done"))];
                                    case 7: return [4 /*yield*/, _a.sent()];
                                    case 8:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                assistant = (_a = requests[1]) === null || _a === void 0 ? void 0 : _a.messages.find(function (message) { var _a; return message.role === "assistant" && ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length); });
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.content).toBe("visible answer");
                (0, bun_test_1.expect)(assistant === null || assistant === void 0 ? void 0 : assistant.textSignature).toBe("text-sig");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the configured final step preserves XML-like text without another request", function () { return __awaiter(void 0, void 0, void 0, function () {
    var streamCalls, requests, _a, runner, events, executedCalls;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                streamCalls = 0;
                requests = [];
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_11() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        requests.push(request);
                                        if (!(streamCalls === 1)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a"}',
                                                },
                                            ]))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 3: return [2 /*return*/, _a.sent()];
                                    case 4: return [4 /*yield*/, __await(content("<function=run_shell><parameter=command>git status</parameter></function>"))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, { maxSteps: 2 }), runner = _a.runner, events = _a.events, executedCalls = _a.executedCalls;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _d.sent();
                (0, bun_test_1.expect)(executedCalls.map(function (entry) { return entry.call.name; })).toEqual(["read_file"]);
                (0, bun_test_1.expect)(streamCalls).toBe(2);
                (0, bun_test_1.expect)(requests[1]).toMatchObject({ tools: undefined, toolChoice: "none" });
                (0, bun_test_1.expect)(events
                    .filter(function (event) {
                    return event.type === "content.delta";
                })
                    .map(function (event) { return event.text; })).toEqual([
                    "<function=run_shell><parameter=command>git status</parameter></function>",
                ]);
                (0, bun_test_1.expect)((_b = events.find(function (event) {
                    return event.type === "turn.finished";
                })) === null || _b === void 0 ? void 0 : _b.reason).toBeUndefined();
                (0, bun_test_1.expect)((_c = requests[1]) === null || _c === void 0 ? void 0 : _c.messages.some(function (message) {
                    return message.content.includes("MAXIMUM STEPS REACHED");
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("structured calls on the configured final step are ignored with fallback text", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, _a, runner, events, executedCalls;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_12() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        requests.push(request);
                                        return [4 /*yield*/, __await(toolCall([
                                                { id: "call_forbidden", name: "read_file", arguments: "{}" },
                                            ]))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, { maxSteps: 1 }), runner = _a.runner, events = _a.events, executedCalls = _a.executedCalls;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(1);
                (0, bun_test_1.expect)(requests[0]).toMatchObject({ tools: undefined, toolChoice: "none" });
                (0, bun_test_1.expect)(executedCalls).toEqual([]);
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "content.delta" &&
                        event.text.includes("Tool execution completed");
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("malformed textual tool calls fail after bounded corrections", function () { return __awaiter(void 0, void 0, void 0, function () {
    var streamCalls, _a, runner, events, executedCalls;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                streamCalls = 0;
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_13() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        return [4 /*yield*/, __await(content("<tool_call><function=read_file><parameter=path>a.txt</function></tool_call>"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }), runner = _a.runner, events = _a.events, executedCalls = _a.executedCalls;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _c.sent();
                (0, bun_test_1.expect)(streamCalls).toBe(3);
                (0, bun_test_1.expect)(executedCalls).toEqual([]);
                (0, bun_test_1.expect)((_b = events.find(function (event) {
                    return event.type === "turn.finished";
                })) === null || _b === void 0 ? void 0 : _b.stopReason).toBe("error");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a hard provider finish reason fails instead of completing ready", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runner, events, finished;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_14() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await(content("partial response"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "done", finishReason: "length" })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }), runner = _a.runner, events = _a.events;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                finished = events.find(function (event) {
                    return event.type === "turn.finished";
                });
                (0, bun_test_1.expect)(finished === null || finished === void 0 ? void 0 : finished.stopReason).toBe("error");
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "diagnostic" &&
                        event.message.includes("provider stopped before completing");
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("aborting the turn mid-stream finishes cancelled with a warning", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, runner, events, abortController, running, finished;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_15() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await(content("half an answer"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(new Promise(function (resolve) {
                                                var _a;
                                                (_a = request.signal) === null || _a === void 0 ? void 0 : _a.addEventListener("abort", function () { return resolve(); });
                                            }))];
                                    case 3:
                                        _a.sent();
                                        throw new Error("stream aborted");
                                }
                            });
                        });
                    },
                }), runner = _a.runner, events = _a.events, abortController = _a.abortController;
                running = runner.runTurn(turn);
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
            case 1:
                _c.sent();
                (_b = abortController()) === null || _b === void 0 ? void 0 : _b.abort();
                return [4 /*yield*/, running];
            case 2:
                _c.sent();
                finished = events.find(function (event) {
                    return event.type === "turn.finished";
                });
                (0, bun_test_1.expect)(finished === null || finished === void 0 ? void 0 : finished.stopReason).toBe("cancelled");
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "diagnostic" && event.level === "warning"; })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a retried partial stream is attempt-stamped and only successful usage commits", function () { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, _a, runner, events, ledger;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                attempts = 0;
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_16() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        attempts++;
                                        if (!(attempts === 1)) return [3 /*break*/, 5];
                                        return [4 /*yield*/, __await(content("discarded partial"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(usage(90, 9))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        throw (0, runtime_1.providerError)({ kind: "server", message: "temporary outage" });
                                    case 5: return [4 /*yield*/, __await(content("clean answer"))];
                                    case 6: return [4 /*yield*/, _a.sent()];
                                    case 7:
                                        _a.sent();
                                        return [4 /*yield*/, __await(usage(10, 2))];
                                    case 8: return [4 /*yield*/, _a.sent()];
                                    case 9:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    retryPolicy: {
                        maxAttemptsPerStep: 2,
                        initialBackoffMs: 1,
                        maxBackoffMs: 1,
                        jitterMs: 0,
                        maxRetryAfterMs: 1,
                    },
                }), runner = _a.runner, events = _a.events, ledger = _a.ledger;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(events
                    .filter(function (event) {
                    return event.type === "content.delta";
                })
                    .map(function (event) { return ({ text: event.text, attempt: event.attempt }); })).toEqual([
                    { text: "discarded partial", attempt: 1 },
                    { text: "clean answer", attempt: 2 },
                ]);
                (0, bun_test_1.expect)(ledger.snapshot().checkpoint).toMatchObject({
                    inputTokens: 10,
                    outputTokens: 2,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the main agent keeps retrying transient failures until recovery", function () { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, _a, runner, events;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                attempts = 0;
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_17() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        attempts++;
                                        if (attempts < 6)
                                            throw (0, runtime_1.providerError)({ kind: "server", message: "temporary outage" });
                                        return [4 /*yield*/, __await(content("recovered after prolonged outage"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    retryPolicy: {
                        maxAttemptsPerStep: null,
                        initialBackoffMs: 1,
                        maxBackoffMs: 1,
                        jitterMs: 0,
                        maxRetryAfterMs: 1,
                    },
                }), runner = _a.runner, events = _a.events;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(attempts).toBe(6);
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "step.retry"; })).toHaveLength(5);
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "step.retry.cleared",
                    attempts: 6,
                }));
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "turn.finished",
                    stopReason: "done",
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("context-limit recovery keeps compacted context and recovered tool results for later steps", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, requests, _a, runner, ledger, index;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                calls = 0;
                requests = [];
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_18() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        calls++;
                                        requests.push(request);
                                        if (calls === 1)
                                            throw (0, runtime_1.providerError)({ kind: "context_limit", message: "too long" });
                                        if (!(calls === 2)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, __await(content(CONFORMING_SUMMARY))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 3: return [2 /*return*/, _a.sent()];
                                    case 4:
                                        if (!(calls === 3)) return [3 /*break*/, 8];
                                        return [4 /*yield*/, __await(toolCall([
                                                { id: "call_recovered", name: "read_file", arguments: "{}" },
                                            ]))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 7: return [2 /*return*/, _a.sent()];
                                    case 8:
                                        (0, bun_test_1.expect)(request.messages.some(function (message) {
                                            return message.role === "system" &&
                                                message.content.includes(CONFORMING_SUMMARY);
                                        })).toBe(true);
                                        (0, bun_test_1.expect)(request.messages.some(function (message) {
                                            return message.role === "tool" &&
                                                message.toolCallID === "call_recovered" &&
                                                message.content === "ok";
                                        })).toBe(true);
                                        return [4 /*yield*/, __await(content("recovered final"))];
                                    case 9: return [4 /*yield*/, _a.sent()];
                                    case 10:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, { preservedRecentMessages: 0 }), runner = _a.runner, ledger = _a.ledger;
                for (index = 0; index < 3; index++)
                    ledger.add({
                        id: "old-".concat(index),
                        role: index % 2 ? "assistant" : "user",
                        content: "old context ".concat(index),
                    });
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(calls).toBe(4);
                (0, bun_test_1.expect)(requests).toHaveLength(4);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("context-limit recovery clears the stale token anchor before publishing the compacted snapshot", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, meter, staleSurface, _a, runner, ledger, events, index, compactionEndIndex, snapshots, compacted;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                calls = 0;
                meter = new runtime_1.TokenMeter();
                meter.setContextWindow("main", 1000000);
                staleSurface = meter.observeSurface("main", [
                    { role: "user", content: "x".repeat(4000) },
                ]);
                meter.recordUsage("main", { inputTokens: 900000, outputTokens: 0 }, { headerKey: "stale", surfaceTokens: staleSurface });
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_19() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        calls++;
                                        if (calls === 1)
                                            throw (0, runtime_1.providerError)({ kind: "context_limit", message: "too long" });
                                        return [4 /*yield*/, __await(content(CONFORMING_SUMMARY))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, { preservedRecentMessages: 0, tokenMeter: meter }), runner = _a.runner, ledger = _a.ledger, events = _a.events;
                // Large enough that a conforming summary is genuinely smaller, so the shrink
                // check lets the compaction through and this test can observe the anchor.
                for (index = 0; index < 3; index++)
                    ledger.add({
                        id: "old-".concat(index),
                        role: index % 2 ? "assistant" : "user",
                        content: "old context ".concat(index, " ").concat("y".repeat(20000)),
                        tokens: 5000,
                    });
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _c.sent();
                compactionEndIndex = events.findIndex(function (event) { return event.type === "compaction.end" && event.success; });
                (0, bun_test_1.expect)(compactionEndIndex).toBeGreaterThanOrEqual(0);
                snapshots = events
                    .slice(compactionEndIndex + 1)
                    .filter(function (event) {
                    return event.type === "context.snapshot";
                });
                (0, bun_test_1.expect)(snapshots.length).toBeGreaterThan(0);
                compacted = snapshots.at(-1);
                (0, bun_test_1.expect)(compacted.usedTokens).toBeLessThan(10000);
                (0, bun_test_1.expect)((_b = compacted.projectedTokens) !== null && _b !== void 0 ? _b : 0).toBeLessThan(10000);
                return [2 /*return*/];
        }
    });
}); });
/** A summary satisfying the compaction contract, for stub providers. */
var CONFORMING_SUMMARY = [
    "## Objective",
    "- Keep the request honest.",
    "",
    "## Important Details",
    "- The contract is enforced now.",
    "",
    "## Work State",
    "### Completed",
    "- (none)",
    "",
    "### Active",
    "- Compacting the request.",
    "",
    "### Blocked",
    "- (none)",
    "",
    "## Next Move",
    "1. Rebuild the outbound.",
    "",
    "## Relevant Files",
    "- packages/framework/runtime/src/compaction.ts: the contract.",
].join("\n");
(0, bun_test_1.test)("provider steps compact proactively before dispatching an oversized request", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, _a, runner, ledger, events, begin;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_20() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        requests.push(request);
                                        if (!(requests.length === 1)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, __await(content(CONFORMING_SUMMARY))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 3: return [2 /*return*/, _a.sent()];
                                    case 4:
                                        (0, bun_test_1.expect)(request.messages.some(function (message) {
                                            return message.role === "system" &&
                                                message.content.includes(CONFORMING_SUMMARY);
                                        })).toBe(true);
                                        (0, bun_test_1.expect)(request.messages.some(function (message) { return message.role === "user" && message.content === "hello"; })).toBe(true);
                                        return [4 /*yield*/, __await(content("done"))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    runtimeContextConfig: withBudgetDefaults({
                        max: 100,
                        thresholdPercent: 50,
                        reserved: 10,
                    }),
                    preservedRecentMessages: 0,
                }), runner = _a.runner, ledger = _a.ledger, events = _a.events;
                // The compacted span has to be genuinely larger than any conforming summary,
                // or the shrink check correctly refuses the compaction and there is nothing
                // left for this test to observe.
                ledger.add({
                    id: "old-1",
                    role: "assistant",
                    content: "x".repeat(40000),
                    tokens: 10000,
                });
                ledger.add({
                    id: "old-2",
                    role: "user",
                    content: "older follow-up",
                    tokens: 10,
                });
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(2);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "compaction.begin" && event.trigger === "ratio"; })).toBe(true);
                begin = events.find(function (event) {
                    return event.type === "compaction.begin";
                });
                (0, bun_test_1.expect)(begin === null || begin === void 0 ? void 0 : begin.beforeTokens).toBeGreaterThanOrEqual(100);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "context.checkpoint"; })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider steps prune old oversized tool results before dispatch", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, _a, runner, ledger, events, old;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                requests = [];
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_21() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        requests.push(request);
                                        return [4 /*yield*/, __await(content("done"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    runtimeContextConfig: withBudgetDefaults({
                        max: 200000,
                        thresholdPercent: 85,
                        reserved: 8192,
                    }),
                }), runner = _a.runner, ledger = _a.ledger, events = _a.events;
                ledger.add({
                    id: "call",
                    role: "tool_call",
                    content: "read_big {}",
                    pairID: "p1",
                    tokens: 10,
                });
                ledger.add({
                    id: "old-big",
                    role: "tool_result",
                    content: "x".repeat(9000),
                    pairID: "p1",
                    tokens: 2250,
                });
                ledger.add({
                    id: "recent",
                    role: "assistant",
                    content: "recent context",
                    tokens: 10,
                });
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _c.sent();
                (0, bun_test_1.expect)(requests).toHaveLength(1);
                old = (_b = requests[0]) === null || _b === void 0 ? void 0 : _b.messages.find(function (message) {
                    return message.content.includes("tool result truncated for context");
                });
                (0, bun_test_1.expect)(old).toBeDefined();
                (0, bun_test_1.expect)(old === null || old === void 0 ? void 0 : old.content).toContain("originalChars=9000");
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "compaction.begin"; })).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider message estimates exclude binary data URLs", function () {
    var base = (0, provider_runner_1.estimateProviderMessages)([{ role: "user", content: "read it" }]);
    var encoded = "A".repeat(2000000);
    var image = (0, provider_runner_1.estimateProviderMessages)([
        {
            role: "user",
            content: "read it",
            images: [
                { mediaType: "image/png", dataURL: "data:image/png;base64,".concat(encoded) },
            ],
        },
    ]);
    (0, bun_test_1.expect)(image).toBe(base + 256);
});
(0, bun_test_1.test)("provider estimates price durable attachment refs by metadata, not bytes", function () {
    var base = (0, provider_runner_1.estimateProviderMessages)([{ role: "user", content: "read it" }]);
    var ref = {
        id: "att_1",
        path: ".natalia/attachments/att_1-image.png",
        filename: "image.png",
        mediaType: "image/png",
        byteLength: 5000000,
        sha256: "a".repeat(64),
    };
    var estimate = (0, provider_runner_1.estimateProviderMessages)([
        { role: "user", content: "read it", images: [ref] },
    ]);
    (0, bun_test_1.expect)(estimate).toBe(base + (0, runtime_1.estimateTokens)(JSON.stringify(ref)));
    (0, bun_test_1.expect)(estimate).toBeLessThan(base + 256);
});
(0, bun_test_1.test)("a turn keeps the context budget snapshotted with its active model", function () { return __awaiter(void 0, void 0, void 0, function () {
    var runtimeContextConfig, calls, _a, runner, events;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                runtimeContextConfig = withBudgetDefaults({
                    max: 100000,
                    thresholdPercent: 50,
                    reserved: 1000,
                });
                calls = 0;
                _a = makeHarness({
                    provider: "scripted",
                    model: "model-at-turn-start",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_22() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        calls += 1;
                                        if (!(calls === 1)) return [3 /*break*/, 4];
                                        runtimeContextConfig.max = 10;
                                        return [4 /*yield*/, __await(toolCall([
                                                { id: "call_1", name: "read_file", arguments: "{}" },
                                            ]))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 3: return [2 /*return*/, _a.sent()];
                                    case 4: return [4 /*yield*/, __await(content("done"))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, { runtimeContextConfig: runtimeContextConfig }), runner = _a.runner, events = _a.events;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(calls).toBe(2);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "compaction.begin"; })).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("live user messages inject as ordinary tagged user turns", function () { return __awaiter(void 0, void 0, void 0, function () {
    var live, seen, runner;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                live = [
                    { source: "user", text: "[user] focus on the docs task first" },
                ];
                seen = [];
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_23() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        seen.push(request.messages
                                            .filter(function (message) { return message.role === "user"; })
                                            .map(function (message) { return message.content; })
                                            .join("\n"));
                                        return [4 /*yield*/, __await(content("acknowledged"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    takeLiveUserMessages: function () {
                        var next = live;
                        live = [];
                        return next;
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(seen[0]).toContain("hello");
                (0, bun_test_1.expect)(seen[0]).toContain("[user] focus on the docs task first");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a next-step that arrives mid-turn keeps the loop alive and lands in the ledger", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, arrived, injected, _a, runner, ledger, secondUserText;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                arrived = false;
                injected = false;
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_24() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        requests.push(request.messages.map(function (message) { return ({
                                            role: message.role,
                                            content: message.content,
                                        }); }));
                                        // Simulate a user submitting `next-step` while the model is answering
                                        // the first step.
                                        arrived = true;
                                        return [4 /*yield*/, __await(content(requests.length === 1 ? "first answer" : "after injection"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    takeStepInputs: function (step) {
                        // Nothing was queued before step 0; the input appears at the next step.
                        if (step === 0 || injected)
                            return [];
                        injected = true;
                        return [{ id: "in_1", text: "also do X" }];
                    },
                    hasPendingStepInputs: function () { return arrived && !injected; },
                }), runner = _a.runner, ledger = _a.ledger;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests.length).toBe(2);
                secondUserText = requests[1]
                    .filter(function (message) { return message.role === "user"; })
                    .map(function (message) { return message.content; });
                (0, bun_test_1.expect)(secondUserText).toContain("also do X");
                (0, bun_test_1.expect)(ledger
                    .snapshot()
                    .entries.some(function (entry) { return entry.id === "in_1:user" && entry.content === "also do X"; })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pending Navi chat renders as a required direct reply without becoming user intent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var systemPrompt, userMessages, runner, runtimeContext;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                systemPrompt = "";
                userMessages = [];
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_25() {
                            var system;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        system = request.messages.find(function (message) { return message.role === "system"; });
                                        if (system && typeof system.content === "string")
                                            systemPrompt = system.content;
                                        userMessages = request.messages
                                            .filter(function (message) { return message.role === "user"; })
                                            .map(function (message) { return message.content; });
                                        return [4 /*yield*/, __await(content("replying to Navi"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    naviIntro: true,
                    naviChats: [
                        {
                            id: "collab:chat:pending",
                            threadID: "collab:chat:thread",
                            from: "live_chat",
                            to: "main_agent",
                            text: "Did you account for the empty case?",
                            round: 2,
                            expectsReply: true,
                            status: "pending",
                        },
                    ],
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _a.sent();
                // ADR D1/D2: collaboration is dynamic context, never system prompt content.
                (0, bun_test_1.expect)(systemPrompt).not.toContain("<navi_chat>");
                runtimeContext = userMessages.join("\n");
                (0, bun_test_1.expect)(runtimeContext).toContain('<runtime_context source="collab"');
                (0, bun_test_1.expect)(runtimeContext).toContain("<navi_chat>");
                (0, bun_test_1.expect)(runtimeContext).toContain("messageID: collab:chat:pending");
                (0, bun_test_1.expect)(runtimeContext).toContain("round 2 · REPLY_REQUIRED");
                (0, bun_test_1.expect)(runtimeContext).toContain("[Navi → you, untrusted data]");
                (0, bun_test_1.expect)(runtimeContext).toContain("must receive one direct collab_chat reply");
                (0, bun_test_1.expect)(runtimeContext).toContain("Every reply continues the thread");
                (0, bun_test_1.expect)(runtimeContext).toContain("Never report that Navi has not replied");
                (0, bun_test_1.expect)(runtimeContext).not.toContain("<pending_user_intents>");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an active plan renders as a NextPlanHandoff in the runtime context, not the system", function () { return __awaiter(void 0, void 0, void 0, function () {
    var systemPrompt, userMessages, runner, runtimeContext;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                systemPrompt = "";
                userMessages = [];
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_26() {
                            var system;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        system = request.messages.find(function (message) { return message.role === "system"; });
                                        if (system && typeof system.content === "string")
                                            systemPrompt = system.content;
                                        userMessages = request.messages
                                            .filter(function (message) { return message.role === "user"; })
                                            .map(function (message) { return message.content; });
                                        return [4 /*yield*/, __await(content("working on the plan"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    activePlan: {
                        planID: "plan:1",
                        version: 5,
                        title: "Switch to Bun-native HTTP",
                        objective: "replace the fetch wrapper",
                        steps: [
                            {
                                id: "s1",
                                title: "introduce the server",
                                verification: "typecheck",
                            },
                        ],
                        constraints: ["keep loopback default"],
                        verification: ["typecheck"],
                        riskNotes: ["port conflicts"],
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(systemPrompt).not.toContain("<next_plan_handoff>");
                runtimeContext = userMessages.join("\n");
                (0, bun_test_1.expect)(runtimeContext).toContain('<runtime_context source="plan" authority="user" trust="untrusted"');
                (0, bun_test_1.expect)(runtimeContext).toContain("<next_plan_handoff>");
                (0, bun_test_1.expect)(runtimeContext).toContain("plan:1 v5: Switch to Bun-native HTTP");
                (0, bun_test_1.expect)(runtimeContext).toContain("replace the fetch wrapper");
                (0, bun_test_1.expect)(runtimeContext).toContain("s1: introduce the server");
                (0, bun_test_1.expect)(runtimeContext).toContain("keep loopback default");
                (0, bun_test_1.expect)(runtimeContext).toContain("port conflicts");
                (0, bun_test_1.expect)(runtimeContext).toContain("</next_plan_handoff>");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the static system prompt is byte-identical across workspaces and permission modes (ADR D1)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var collect, first, second, _i, _a, dynamic;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                collect = function (options) { return __awaiter(void 0, void 0, void 0, function () {
                    var system, runner;
                    var _a, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                system = "";
                                runner = makeHarness({
                                    provider: "scripted",
                                    model: "m1",
                                    stream: function (request) {
                                        return __asyncGenerator(this, arguments, function stream_27() {
                                            var systemMessage;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        systemMessage = request.messages.find(function (message) { return message.role === "system"; });
                                                        if (systemMessage && typeof systemMessage.content === "string")
                                                            system = systemMessage.content;
                                                        return [4 /*yield*/, __await(content("ok"))];
                                                    case 1: return [4 /*yield*/, _a.sent()];
                                                    case 2:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        });
                                    },
                                }, {
                                    workspaceRoot: (_a = options === null || options === void 0 ? void 0 : options.workspaceRoot) !== null && _a !== void 0 ? _a : "/tmp/ws-a",
                                    permissionMode: (_b = options === null || options === void 0 ? void 0 : options.permissionMode) !== null && _b !== void 0 ? _b : "auto",
                                    naviIntro: true,
                                    activePlan: {
                                        planID: "plan:1",
                                        version: 2,
                                        title: "t",
                                        objective: "o",
                                        steps: [],
                                        constraints: [],
                                        verification: [],
                                        riskNotes: [],
                                    },
                                }).runner;
                                return [4 /*yield*/, runner.runTurn(turn)];
                            case 1:
                                _c.sent();
                                return [2 /*return*/, system];
                        }
                    });
                }); };
                return [4 /*yield*/, collect()];
            case 1:
                first = _b.sent();
                return [4 /*yield*/, collect({
                        workspaceRoot: "/tmp/ws-b",
                        permissionMode: "ask",
                    })];
            case 2:
                second = _b.sent();
                (0, bun_test_1.expect)(first.length).toBeGreaterThan(0);
                (0, bun_test_1.expect)(second).toBe(first);
                // Dynamic facts must not leak into the static system.
                for (_i = 0, _a = [
                    "Working directory",
                    "Workspace root folder",
                    "Permission mode",
                    "<navi_chat>",
                    "<next_plan_handoff>",
                ]; _i < _a.length; _i++) {
                    dynamic = _a[_i];
                    (0, bun_test_1.expect)(first).not.toContain(dynamic);
                }
                // The authority model is a static global convention (ADR D9).
                (0, bun_test_1.expect)(first).toContain("<authority_model>");
                (0, bun_test_1.expect)(first).toContain("Fail-closed gates");
                (0, bun_test_1.expect)(first).toContain("highest revision is the current state");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("environment details move to the runtime context and precede the user request (ADR D2/D6)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var shapes, runner, messages, system, contextIndex, requestIndex;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                shapes = [];
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_28() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        shapes.push(request.messages.map(function (message) { return ({
                                            role: message.role,
                                            content: message.content,
                                        }); }));
                                        return [4 /*yield*/, __await(content("ok"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, { permissionMode: "ask" }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _a.sent();
                messages = shapes[0];
                system = messages.find(function (message) { return message.role === "system"; });
                (0, bun_test_1.expect)(system).toBeDefined();
                (0, bun_test_1.expect)(system.content).not.toContain("Working directory");
                contextIndex = messages.findIndex(function (message) {
                    return message.role === "user" &&
                        message.content.includes('<runtime_context source="environment"');
                });
                (0, bun_test_1.expect)(contextIndex).toBeGreaterThan(0);
                requestIndex = messages.findIndex(function (message) { return message.role === "user" && message.content === "hello"; });
                (0, bun_test_1.expect)(requestIndex).toBeGreaterThan(contextIndex);
                (0, bun_test_1.expect)(messages[contextIndex].content).toContain("Permission mode: ask");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("constitution/AGENTS documents inject with explicit per-section enforcement (EI §3.8 P-1.c)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var shapes, runner, injected, systemMsg;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                shapes = [];
                runner = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_29() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        shapes.push(request.messages.map(function (m) { return m.content; }).join("\n"));
                                        return [4 /*yield*/, __await(content("ok"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    permissionMode: "ask",
                    projectDocuments: {
                        hash: "constitution:abc",
                        documents: [
                            {
                                source: "constitution",
                                path: ".natalia/constitution.md",
                                content: "# Rules",
                                hash: "abc",
                                rules: [
                                    {
                                        id: "constitution:never-force-push:1",
                                        source: "constitution",
                                        section: "Never force-push",
                                        statement: "Force-pushing rewrites shared history.",
                                        enforcement: "deny",
                                        annotated: true,
                                        appliesTo: { commandPattern: "git push --force" },
                                    },
                                    {
                                        id: "constitution:small-prs:2",
                                        source: "constitution",
                                        section: "Small PRs",
                                        statement: "Prefer small pull requests.",
                                        enforcement: "warn",
                                        annotated: false,
                                    },
                                ],
                            },
                        ],
                    },
                }).runner;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _a.sent();
                injected = shapes[0];
                (0, bun_test_1.expect)(injected).toContain("<constitution_rules>");
                (0, bun_test_1.expect)(injected).toContain("[deny] Force-pushing rewrites shared history.");
                (0, bun_test_1.expect)(injected).toContain("[warn] Prefer small pull requests.");
                (0, bun_test_1.expect)(injected).toContain('appliesTo: {"commandPattern":"git push --force"}');
                // The raw content still rides along for grounding.
                (0, bun_test_1.expect)(injected).toContain("# Rules");
                systemMsg = injected
                    .split("\n")
                    .find(function (line) { return line === "SYSTEM_PLACEHOLDER"; });
                (0, bun_test_1.expect)(systemMsg).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a mid-turn step input appends a fresh runtime context instead of mutating the system (ADR D3/D6)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, arrived, injected, naviChats, _a, runner, ledger, contexts, revisions;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                requests = [];
                arrived = false;
                injected = false;
                naviChats = [];
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_30() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        requests.push(request.messages.map(function (message) { return ({
                                            role: message.role,
                                            content: message.content,
                                        }); }));
                                        arrived = true;
                                        // A collaboration reply arrives while the turn is in flight.
                                        naviChats.push({
                                            id: "collab:chat:late",
                                            threadID: "collab:chat:thread",
                                            from: "live_chat",
                                            to: "main_agent",
                                            text: "late reply",
                                            round: 3,
                                            expectsReply: false,
                                            status: "sent",
                                        });
                                        return [4 /*yield*/, __await(content(requests.length === 1 ? "first" : "after injection"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    naviIntro: true,
                    naviChats: naviChats,
                    takeStepInputs: function (step) {
                        if (step === 0 || injected)
                            return [];
                        injected = true;
                        return [{ id: "in_1", text: "also do X" }];
                    },
                    hasPendingStepInputs: function () { return arrived && !injected; },
                }), runner = _a.runner, ledger = _a.ledger;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(requests.length).toBe(2);
                // The system message is never mutated mid-turn.
                (0, bun_test_1.expect)(requests[1][0].content).toBe(requests[0][0].content);
                contexts = requests[1]
                    .filter(function (message) {
                    return message.role === "user" &&
                        message.content.includes('<runtime_context source="collab"');
                })
                    .map(function (message) { return message.content; });
                (0, bun_test_1.expect)(contexts.length).toBeGreaterThanOrEqual(2);
                revisions = contexts.map(function (content) { var _a, _b; return Number((_b = (_a = /revision="(\d+)"/u.exec(content)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : "0"); });
                (0, bun_test_1.expect)(Math.max.apply(Math, revisions)).toBeGreaterThan(Math.min.apply(Math, revisions));
                (0, bun_test_1.expect)(contexts.join("\n")).toContain("collab:chat:late");
                (0, bun_test_1.expect)(requests[1].some(function (message) { return message.role === "user" && message.content === "also do X"; })).toBe(true);
                (0, bun_test_1.expect)(ledger
                    .snapshot()
                    .entries.some(function (entry) { return entry.id === "in_1:user" && entry.content === "also do X"; })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an already-announced turn is not re-announced", function () { return __awaiter(void 0, void 0, void 0, function () {
    var announced, _a, runner, events;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                announced = new Set(["t1"]);
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_31() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await(content("done"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, {
                    isTurnAnnounced: function (id) { return announced.has(id); },
                    markTurnAnnounced: function (id) { return announced.add(id); },
                }), runner = _a.runner, events = _a.events;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "turn.submitted"; })).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("duplicate provider tool_call_ids are remapped before execution", function () { return __awaiter(void 0, void 0, void 0, function () {
    var streamCalls, provider, _a, runner, events, executedCalls;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                streamCalls = 0;
                provider = {
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_32() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        if (!(streamCalls === 1)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, __await(toolCall([
                                                { id: "call_dup", name: "read_file", arguments: "{}" },
                                                { id: "call_dup", name: "glob", arguments: "{}" },
                                            ]))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 3: return [2 /*return*/, _a.sent()];
                                    case 4: return [4 /*yield*/, __await(content("done"))];
                                    case 5: return [4 /*yield*/, _a.sent()];
                                    case 6:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                _a = makeHarness(provider, {
                    maxSteps: 4,
                }), runner = _a.runner, events = _a.events, executedCalls = _a.executedCalls;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(executedCalls.map(function (_a) {
                    var call = _a.call;
                    return call.id;
                })).toEqual([
                    "call_dup",
                    "call_dup#1",
                ]);
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "diagnostic" &&
                        event.message.includes("duplicate tool_call_id");
                })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider usage commits the last step instead of summing every step", function () { return __awaiter(void 0, void 0, void 0, function () {
    var streamCalls, _a, runner, ledger;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                streamCalls = 0;
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_33() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        streamCalls += 1;
                                        if (!(streamCalls === 1)) return [3 /*break*/, 6];
                                        return [4 /*yield*/, __await(toolCall([
                                                {
                                                    id: "call_1",
                                                    name: "read_file",
                                                    arguments: '{"path":"a.txt"}',
                                                },
                                            ]))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(usage(100, 5))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 5: return [2 /*return*/, _a.sent()];
                                    case 6: return [4 /*yield*/, __await(content("done"))];
                                    case 7: return [4 /*yield*/, _a.sent()];
                                    case 8:
                                        _a.sent();
                                        return [4 /*yield*/, __await(usage(120, 7))];
                                    case 9: return [4 /*yield*/, _a.sent()];
                                    case 10:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }), runner = _a.runner, ledger = _a.ledger;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(streamCalls).toBe(2);
                // The prompt size of the second request describes the live context. Summing
                // both requests' prompt tokens (220) makes the ledger believe the window is
                // far larger than it is and forces a bogus compaction.
                (0, bun_test_1.expect)(ledger.snapshot().checkpoint).toMatchObject({
                    inputTokens: 120,
                    outputTokens: 7,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("main-path request metering counts advertised tools and exposes the three buckets", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, meter, _a, runner, events, snapshot, status;
    var _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                registry = new tools_1.ToolRegistry();
                registry.set("big_tool", {
                    name: "big_tool",
                    requiresApproval: false,
                    description: "d".repeat(4000),
                    parameters: {
                        type: "object",
                        properties: {
                            payload: { type: "string", description: "p".repeat(4000) },
                        },
                    },
                    execute: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, "ok"];
                    }); }); },
                });
                meter = new runtime_1.TokenMeter();
                _a = makeHarness({
                    provider: "scripted",
                    model: "m1",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_34() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, __await(content("done"))];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await(usage(120, 7))];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                }, { tools: registry, tokenMeter: meter }), runner = _a.runner, events = _a.events;
                return [4 /*yield*/, runner.runTurn(turn)];
            case 1:
                _f.sent();
                snapshot = events.find(function (event) {
                    return event.type === "context.snapshot";
                });
                (0, bun_test_1.expect)(snapshot).toBeDefined();
                // The advertised tool schema is part of the request header and must be
                // measured as its own bucket, not folded into the message surface.
                (0, bun_test_1.expect)(snapshot.toolsTokens).toBeGreaterThan(0);
                (0, bun_test_1.expect)(snapshot.systemTokens).toBeGreaterThan(0);
                (0, bun_test_1.expect)(snapshot.messageTokens).toBeGreaterThanOrEqual(0);
                status = events.find(function (event) {
                    return event.type === "context.status" && event.toolsTokens !== undefined;
                });
                (0, bun_test_1.expect)(status).toBeDefined();
                (0, bun_test_1.expect)(status.headerTokens).toBe(((_b = status.systemTokens) !== null && _b !== void 0 ? _b : 0) + ((_c = status.toolsTokens) !== null && _c !== void 0 ? _c : 0));
                (0, bun_test_1.expect)(status.requestTokens).toBe(((_d = status.headerTokens) !== null && _d !== void 0 ? _d : 0) + ((_e = status.surfaceTokens) !== null && _e !== void 0 ? _e : 0));
                return [2 /*return*/];
        }
    });
}); });
