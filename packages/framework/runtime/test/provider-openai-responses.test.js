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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var provider_1 = require("../src/provider");
/** Drive the adapter and capture both the request body and the emitted chunks. */
function runResponses(input) {
    return __awaiter(this, void 0, void 0, function () {
        var sent, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_1_1;
        var _this = this;
        var _d, e_1, _e, _f;
        var _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    sent = {};
                    fetchImpl = Object.assign(function (_url, init) { return __awaiter(_this, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            sent = JSON.parse(String((_a = init === null || init === void 0 ? void 0 : init.body) !== null && _a !== void 0 ? _a : "{}"));
                            return [2 /*return*/, new Response(input.sse, {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect });
                    provider = new provider_1.OpenAIResponsesProvider(__assign(__assign(__assign({ apiKey: "test-key", model: "gpt-test", fetch: fetchImpl }, (input.capabilities ? { capabilities: input.capabilities } : {})), (input.sessionID ? { sessionID: input.sessionID } : {})), (input.cacheRetention ? { cacheRetention: input.cacheRetention } : {})));
                    chunks = [];
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 6, 7, 12]);
                    _a = true, _b = __asyncValues(provider.stream(__assign(__assign({ messages: (_g = input.messages) !== null && _g !== void 0 ? _g : [{ role: "user", content: "hi" }] }, (input.toolChoice ? { toolChoice: input.toolChoice } : {})), (input.tools ? { tools: input.tools } : {}))));
                    _h.label = 2;
                case 2: return [4 /*yield*/, _b.next()];
                case 3:
                    if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                    _f = _c.value;
                    _a = false;
                    chunk = _f;
                    chunks.push(chunk);
                    _h.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_1_1 = _h.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _h.trys.push([7, , 10, 11]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _e.call(_b)];
                case 8:
                    _h.sent();
                    _h.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12: return [2 /*return*/, { body: sent, chunks: chunks }];
            }
        });
    });
}
var SSE = function (events) {
    return events.map(function (event) { return "data: ".concat(event, "\n\n"); }).join("") + "data: [DONE]\n\n";
};
(0, bun_test_1.test)("Responses sends input items, not a messages array", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([
                        JSON.stringify({ type: "response.output_text.delta", delta: "ok" }),
                        JSON.stringify({
                            type: "response.completed",
                            response: {
                                id: "resp_1",
                                usage: { input_tokens: 10, output_tokens: 2 },
                            },
                        }),
                    ]),
                    messages: [
                        { role: "system", content: "be terse" },
                        { role: "user", content: "hello" },
                    ],
                })];
            case 1:
                body = (_a.sent()).body;
                (0, bun_test_1.expect)(body).not.toHaveProperty("messages");
                (0, bun_test_1.expect)(body.input).toEqual([
                    { role: "system", content: [{ type: "input_text", text: "be terse" }] },
                    { role: "user", content: [{ type: "input_text", text: "hello" }] },
                ]);
                (0, bun_test_1.expect)(body.store).toBe(false);
                (0, bun_test_1.expect)(body.stream).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses lifts tool calls into function_call items keyed by call_id", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([
                        JSON.stringify({ type: "response.output_text.delta", delta: "ok" }),
                    ]),
                    messages: [
                        { role: "user", content: "read it" },
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [
                                { id: "call_1", name: "read_file", arguments: '{"p":"a"}' },
                            ],
                        },
                        {
                            role: "tool",
                            content: "file body",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                })];
            case 1:
                body = (_a.sent()).body;
                (0, bun_test_1.expect)(body.input).toEqual([
                    { role: "user", content: [{ type: "input_text", text: "read it" }] },
                    {
                        type: "function_call",
                        call_id: "call_1",
                        name: "read_file",
                        arguments: '{"p":"a"}',
                    },
                    { type: "function_call_output", call_id: "call_1", output: "file body" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses emits content, tool calls and usage from the event stream", function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunks, texts;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([
                        JSON.stringify({ type: "response.created", response: { id: "resp_9" } }),
                        JSON.stringify({ type: "response.output_text.delta", delta: "hel" }),
                        JSON.stringify({ type: "response.output_text.delta", delta: "lo" }),
                        JSON.stringify({
                            type: "response.output_item.added",
                            output_index: 0,
                            item: {
                                id: "fc_1",
                                type: "function_call",
                                call_id: "call_7",
                                name: "grep",
                            },
                        }),
                        JSON.stringify({
                            type: "response.function_call_arguments.delta",
                            output_index: 0,
                            delta: '{"q":',
                        }),
                        JSON.stringify({
                            type: "response.function_call_arguments.delta",
                            output_index: 0,
                            delta: '"x"}',
                        }),
                        JSON.stringify({
                            type: "response.function_call_arguments.done",
                            output_index: 0,
                            arguments: '{"q":"x"}',
                        }),
                        JSON.stringify({
                            type: "response.completed",
                            response: {
                                id: "resp_9",
                                usage: {
                                    input_tokens: 500,
                                    output_tokens: 12,
                                    total_tokens: 512,
                                    input_tokens_details: { cached_tokens: 400 },
                                },
                            },
                        }),
                    ]),
                })];
            case 1:
                chunks = (_a.sent()).chunks;
                texts = chunks
                    .filter(function (chunk) { return chunk.type === "content"; })
                    .map(function (chunk) { return chunk.text; })
                    .join("");
                (0, bun_test_1.expect)(texts).toBe("hello");
                (0, bun_test_1.expect)(chunks).toContainEqual({
                    type: "tool_call",
                    calls: [{ id: "call_7", name: "grep", arguments: '{"q":"x"}' }],
                });
                // `input_tokens` on this family INCLUDES cached tokens, so they are
                // subtracted — unlike Anthropic, whose input_tokens excludes them.
                (0, bun_test_1.expect)(chunks.find(function (chunk) { return chunk.type === "usage"; })).toEqual({
                    type: "usage",
                    inputTokens: 100,
                    outputTokens: 12,
                    cacheReadInputTokens: 400,
                });
                (0, bun_test_1.expect)(chunks.find(function (chunk) { return chunk.type === "done"; })).toMatchObject({
                    finishReason: "stop",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses subtracts cache-write tokens too, and reports them separately", function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunks;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([
                        JSON.stringify({
                            type: "response.completed",
                            response: {
                                usage: {
                                    input_tokens: 1000,
                                    output_tokens: 5,
                                    input_tokens_details: {
                                        cached_tokens: 300,
                                        cache_write_tokens: 200,
                                    },
                                },
                            },
                        }),
                    ]),
                })];
            case 1:
                chunks = (_a.sent()).chunks;
                (0, bun_test_1.expect)(chunks.find(function (chunk) { return chunk.type === "usage"; })).toEqual({
                    type: "usage",
                    inputTokens: 500,
                    outputTokens: 5,
                    cacheReadInputTokens: 300,
                    cacheCreationInputTokens: 200,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses sends no cache parameter when the endpoint declared none", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({ sse: SSE([]) })];
            case 1:
                body = (_a.sent()).body;
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_key");
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_retention");
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_options");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses sends only the retention shape the endpoint accepts", function () { return __awaiter(void 0, void 0, void 0, function () {
    var legacy, modern, modernShort;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([]),
                    capabilities: { supportsLongCacheRetention: true },
                })];
            case 1:
                legacy = _a.sent();
                (0, bun_test_1.expect)(legacy.body.prompt_cache_retention).toBe("24h");
                (0, bun_test_1.expect)(legacy.body).not.toHaveProperty("prompt_cache_options");
                return [4 /*yield*/, runResponses({
                        sse: SSE([]),
                        capabilities: {
                            supportsExplicitPromptCacheMode: true,
                            supportsLongCacheRetention: true,
                        },
                    })];
            case 2:
                modern = _a.sent();
                (0, bun_test_1.expect)(modern.body.prompt_cache_options).toEqual({
                    mode: "explicit",
                    ttl: "30m",
                });
                (0, bun_test_1.expect)(modern.body).not.toHaveProperty("prompt_cache_retention");
                return [4 /*yield*/, runResponses({
                        sse: SSE([]),
                        capabilities: { supportsExplicitPromptCacheMode: true },
                    })];
            case 3:
                modernShort = _a.sent();
                (0, bun_test_1.expect)(modernShort.body.prompt_cache_options).toEqual({ mode: "explicit" });
                (0, bun_test_1.expect)(modernShort.body).not.toHaveProperty("prompt_cache_retention");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses sends a session key whenever one is configured", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([]),
                    capabilities: { supportsPromptCacheKey: true },
                    sessionID: "ses_abc",
                })];
            case 1:
                body = (_a.sent()).body;
                (0, bun_test_1.expect)(body.prompt_cache_key).toBe("ses_abc");
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_retention");
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_options");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses clamps max_output_tokens up to the API minimum", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchImpl, captured, provider, _a, _b, _c, _chunk, e_2_1;
    var _d, e_2, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_url, init) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a;
                    return __generator(this, function (_b) {
                        captured = JSON.parse(String((_a = init === null || init === void 0 ? void 0 : init.body) !== null && _a !== void 0 ? _a : "{}"));
                        return [2 /*return*/, new Response(SSE([]), {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                captured = {};
                provider = new provider_1.OpenAIResponsesProvider({
                    apiKey: "k",
                    model: "m",
                    fetch: fetchImpl,
                    maxTokens: 4,
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [{ role: "user", content: "hi" }],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                ;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_2_1 = _g.sent();
                e_2 = { error: e_2_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_2) throw e_2.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(captured.max_output_tokens).toBe(16);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses maps an incomplete response to a length finish", function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunks;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([
                        JSON.stringify({
                            type: "response.incomplete",
                            response: { usage: { input_tokens: 9, output_tokens: 1 } },
                        }),
                    ]),
                })];
            case 1:
                chunks = (_a.sent()).chunks;
                (0, bun_test_1.expect)(chunks.find(function (chunk) { return chunk.type === "done"; })).toMatchObject({
                    finishReason: "length",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Responses retention none suppresses every cache parameter", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runResponses({
                    sse: SSE([]),
                    sessionID: "ses_abc",
                    capabilities: {
                        supportsPromptCacheKey: true,
                        supportsLongCacheRetention: true,
                    },
                    cacheRetention: "none",
                })];
            case 1:
                body = (_a.sent()).body;
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_key");
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_retention");
                (0, bun_test_1.expect)(body).not.toHaveProperty("prompt_cache_options");
                return [2 /*return*/];
        }
    });
}); });
