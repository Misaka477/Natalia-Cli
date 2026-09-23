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
var fixtures_1 = require("./fixtures");
var src_1 = require("../src");
(0, bun_test_1.test)("context accounting combines provider exact checkpoint with pending estimate", function () {
    var ledger = new src_1.ContextLedger();
    ledger.add({
        id: "sys",
        role: "system",
        content: "system prompt",
        tokens: 10,
    });
    ledger.add({
        id: "tool",
        role: "tool_result",
        content: "tool output",
        tokens: 20,
    });
    ledger.recordProviderUsage(100, 25);
    (0, bun_test_1.expect)(ledger.status({
        max: 200,
        thresholdPercent: 85,
        reserved: 50,
    }).source).toBe("exact_checkpoint");
    ledger.add({
        id: "dyn",
        role: "dynamic",
        content: "dynamic injection",
        tokens: 7,
    });
    ledger.addResource({
        kind: "agent",
        id: "agent-1",
        summary: "running subagent",
    });
    var status = ledger.status({
        max: 200,
        thresholdPercent: 85,
        reserved: 50,
    });
    (0, bun_test_1.expect)(status.used).toBeGreaterThanOrEqual(132);
    (0, bun_test_1.expect)(status.source).toBe("pending_estimate");
    (0, bun_test_1.expect)(status.trigger).toBeUndefined();
    (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.role; })).toContain("resource");
});
(0, bun_test_1.test)("reserved output resolver prioritizes provider, explicit, catalog and fallback formula", function () {
    (0, bun_test_1.expect)((0, src_1.resolveReservedOutputTokens)({
        contextWindow: 32000,
        configuredReserved: 1234,
    }).source).toBe("config");
    (0, bun_test_1.expect)((0, src_1.resolveReservedOutputTokens)({
        contextWindow: 32000,
        configuredReserved: "auto",
        providerOutputLimit: 4096,
    }).tokens).toBe(4096);
    (0, bun_test_1.expect)((0, src_1.resolveReservedOutputTokens)({
        contextWindow: 32000,
        configuredReserved: "auto",
        explicitMaxOutputTokens: 2048,
    }).source).toBe("explicit_output");
    (0, bun_test_1.expect)((0, src_1.resolveReservedOutputTokens)({
        contextWindow: 32000,
        configuredReserved: "auto",
        catalogOutputLimit: 8192,
    }).source).toBe("catalog");
    (0, bun_test_1.expect)((0, src_1.resolveReservedOutputTokens)({
        contextWindow: 32000,
        configuredReserved: "auto",
    }).tokens).toBe(4096);
    (0, bun_test_1.expect)((0, src_1.resolveReservedOutputTokens)({
        contextWindow: 200000,
        configuredReserved: "auto",
    }).tokens).toBe(20000);
});
(0, bun_test_1.test)("compaction trigger uses ratio or reserved budget and respects disabled config", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, before, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                (0, bun_test_1.expect)((0, src_1.compactionTrigger)({
                    used: 86,
                    max: 100,
                    thresholdPercent: 85,
                    reserved: 1,
                })).toBe("ratio");
                (0, bun_test_1.expect)((0, src_1.compactionTrigger)({
                    used: 70,
                    max: 100,
                    thresholdPercent: 85,
                    reserved: 31,
                })).toBe("reserved");
                ledger = ledgerWithMessages(10);
                before = ledger.snapshot();
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor(), {
                        id: "cmp_disabled",
                        trigger: "ratio",
                        enabled: false,
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 2,
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual({ compacted: false, skipped: "disabled" });
                (0, bun_test_1.expect)(ledger.snapshot()).toEqual(before);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("manual compaction works while disabled and preserves tool-call/result pairing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, events, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "u1", role: "user", content: "old", tokens: 10 });
                ledger.add({
                    id: "call",
                    role: "tool_call",
                    content: "call",
                    pairID: "p1",
                    tokens: 10,
                });
                ledger.add({
                    id: "result",
                    role: "tool_result",
                    content: "result",
                    pairID: "p1",
                    tokens: 10,
                });
                ledger.add({ id: "a1", role: "assistant", content: "recent", tokens: 10 });
                events = [];
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor([{ summary: "manual summary", tokens: 4 }]), {
                        id: "cmp_manual",
                        trigger: "manual",
                        enabled: false,
                        maxTokens: 1000,
                        thresholdPercent: 85,
                        reservedTokens: 100,
                        preservedRecentMessages: 2,
                        instruction: "keep tool evidence",
                        onEvent: function (event) { return events.push(event.type); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result.compacted).toBe(true);
                (0, bun_test_1.expect)(events).toContain("compaction.begin");
                (0, bun_test_1.expect)(events).toContain("compaction.end");
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "cmp_manual:summary",
                    "call",
                    "result",
                    "a1",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction summarizes only entries older than the preserved tail", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, compactedIDs, compactor;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(4);
                compactedIDs = [];
                compactor = {
                    compact: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // The span arrives as provider messages, so identify it by content.
                                compactedIDs = input.messages.map(function (message) { return message.content; });
                                return [2 /*return*/, { summary: "old context" }];
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, compactor, {
                        id: "cmp_head_only",
                        trigger: "ratio",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 2,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(compactedIDs).toEqual(["message 0", "message 1"]);
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "cmp_head_only:summary",
                    "m2",
                    "m3",
                ]);
                (0, bun_test_1.expect)(ledger.status({ max: 100, thresholdPercent: 85, reserved: 10 }).source).toBe("pending_estimate");
                return [2 /*return*/];
        }
    });
}); });
/** A summary that satisfies the compaction contract, for stub providers. */
var CONFORMING_SUMMARY = [
    "## Objective",
    "- Keep the tests honest.",
    "",
    "## Important Details",
    "- The contract is enforced now.",
    "",
    "## Work State",
    "### Completed",
    "- (none)",
    "",
    "### Active",
    "- Verifying the prompt shape.",
    "",
    "### Blocked",
    "- (none)",
    "",
    "## Next Move",
    "1. Assert the prompt.",
    "",
    "## Relevant Files",
    "- packages/framework/runtime/src/compaction.ts: the contract.",
].join("\n");
(0, bun_test_1.test)("provider compaction requests a structured, updateable work-state summary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider, prompt;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_1() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [
                            { role: "user", content: "Earlier state" },
                            { role: "user", content: "New requirement" },
                        ],
                        resources: [],
                    })];
            case 1:
                _c.sent();
                prompt = (_b = (_a = request === null || request === void 0 ? void 0 : request.messages.at(-1)) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : "";
                (0, bun_test_1.expect)(prompt).toContain("update that anchor");
                (0, bun_test_1.expect)(prompt).toContain("## Objective");
                (0, bun_test_1.expect)(prompt).toContain("### Completed");
                (0, bun_test_1.expect)(prompt).not.toContain("Earlier state");
                (0, bun_test_1.expect)(prompt).not.toContain("New requirement");
                // The replayed span leads, one message per entry, in order.
                (0, bun_test_1.expect)(request === null || request === void 0 ? void 0 : request.messages.slice(0, 2)).toEqual([
                    { role: "user", content: "Earlier state" },
                    { role: "user", content: "New requirement" },
                ]);
                (0, bun_test_1.expect)(prompt).toContain("### Active");
                (0, bun_test_1.expect)(prompt).toContain("### Blocked");
                (0, bun_test_1.expect)(prompt).toContain("## Next Move");
                (0, bun_test_1.expect)(prompt).toContain("## Relevant Files");
                // The span's own text never enters the instruction: it is replayed as
                // messages ahead of it, which is what lets the prefix cache cover it.
                (0, bun_test_1.expect)(prompt).not.toContain("summary: Earlier state");
                (0, bun_test_1.expect)(prompt).not.toContain("user: New requirement");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider compaction reuses the routed system prefix", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_2() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "New requirement" }],
                        resources: [],
                        prefixMessages: [
                            { role: "system", content: "Original routed system prompt" },
                        ],
                    })];
            case 1:
                _b.sent();
                // The routed system prompt leads, the span is replayed verbatim, and the
                // instruction closes the request — so the span's bytes match what the routed
                // request carried and the prefix cache can cover them.
                (0, bun_test_1.expect)(request === null || request === void 0 ? void 0 : request.messages[0]).toMatchObject({
                    role: "system",
                    content: "Original routed system prompt",
                });
                (0, bun_test_1.expect)(request === null || request === void 0 ? void 0 : request.messages[1]).toMatchObject({
                    role: "user",
                    content: "New requirement",
                });
                (0, bun_test_1.expect)((_a = request === null || request === void 0 ? void 0 : request.messages.at(-1)) === null || _a === void 0 ? void 0 : _a.content).toContain("Summarize this Natalia agent session");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction skips when every entry belongs to the preserved tail", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, called, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(2);
                called = false;
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, {
                        compact: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    called = true;
                                    return [2 /*return*/, { summary: "unused" }];
                                });
                            });
                        },
                    }, {
                        id: "cmp_nothing",
                        trigger: "ratio",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 2,
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual({
                    compacted: false,
                    skipped: "nothing_to_compact",
                });
                (0, bun_test_1.expect)(called).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction does not repeatedly summarize an existing summary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, called, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({
                    id: "summary",
                    role: "summary",
                    content: "already compacted",
                    tokens: 10,
                });
                called = false;
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, {
                        compact: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    called = true;
                                    return [2 /*return*/, { summary: "nested summary" }];
                                });
                            });
                        },
                    }, {
                        id: "cmp_summary_only",
                        trigger: "ratio",
                        maxTokens: 10,
                        thresholdPercent: 50,
                        reservedTokens: 1,
                        preservedRecentMessages: 0,
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual({
                    compacted: false,
                    skipped: "nothing_to_compact",
                });
                (0, bun_test_1.expect)(called).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction estimates retained context instead of compactor API usage", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "old", role: "user", content: "x".repeat(400000) });
                ledger.add({ id: "recent", role: "user", content: "recent", tokens: 2 });
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor([{ summary: "small summary" }]), {
                        id: "cmp_usage",
                        trigger: "manual",
                        maxTokens: 10000,
                        thresholdPercent: 85,
                        reservedTokens: 1000,
                        preservedRecentMessages: 1,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(ledger.effectiveTokens()).toBeLessThan(200);
                (0, bun_test_1.expect)(ledger.status({ max: 10000, thresholdPercent: 85, reserved: 1000 })
                    .trigger).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction retains attachment metadata only for preserved user entries", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({
                    id: "old-user",
                    role: "user",
                    content: "old image",
                    attachments: [
                        {
                            id: "att_old",
                            path: ".natalia/attachments/att_old-image.png",
                            filename: "old.png",
                            mediaType: "image/png",
                            byteLength: 8,
                            sha256: "old",
                        },
                    ],
                });
                ledger.add({
                    id: "recent-user",
                    role: "user",
                    content: "recent image",
                    attachments: [
                        {
                            id: "att_recent",
                            path: ".natalia/attachments/att_recent-image.png",
                            filename: "recent.png",
                            mediaType: "image/png",
                            byteLength: 8,
                            sha256: "recent",
                        },
                    ],
                });
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor([{ summary: "summary", tokens: 2 }]), {
                        id: "cmp_attachment",
                        trigger: "manual",
                        maxTokens: 1000,
                        thresholdPercent: 85,
                        reservedTokens: 100,
                        preservedRecentMessages: 1,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(ledger
                    .snapshot()
                    .entries.flatMap(function (entry) { var _a; return (_a = entry.attachments) !== null && _a !== void 0 ? _a : []; })
                    .map(function (attachment) { return attachment.id; })).toEqual(["att_recent"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction failure is atomic and retry events use M9 policy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, before, events, compactor;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(5);
                before = ledger.snapshot();
                events = [];
                compactor = {
                    compact: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw (0, src_1.providerError)({ kind: "timeout", message: "compaction timeout" });
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.compactContext)(ledger, compactor, {
                        id: "cmp_fail",
                        trigger: "ratio",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 2,
                        retry: {
                            policy: { maxAttemptsPerStep: 3 },
                            timer: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, undefined];
                            }); }); },
                            random: function () { return 0; },
                        },
                        onEvent: function (event) { return events.push(event.type); },
                    })).rejects.toMatchObject({ kind: "timeout" })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(ledger.snapshot()).toEqual(before);
                (0, bun_test_1.expect)(events.filter(function (type) { return type === "step.retry"; })).toHaveLength(2);
                (0, bun_test_1.expect)(events).toContain("compaction.end");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("context-limit recovery compacts once then retries original step without loop", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, calls, events, value;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(8);
                calls = 0;
                events = [];
                return [4 /*yield*/, (0, src_1.recoverContextLimitOnce)({
                        id: "turn_ctx",
                        step: 2,
                        ledger: ledger,
                        compactor: new fixtures_1.FakeCompactor([{ summary: "recovered", tokens: 50 }]),
                        compact: {
                            id: "cmp_ctx",
                            maxTokens: 1000,
                            thresholdPercent: 85,
                            reservedTokens: 100,
                            preservedRecentMessages: 2,
                            retry: { timer: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, undefined];
                                }); }); }, random: function () { return 0; } },
                        },
                        onEvent: function (event) { return events.push(event.type); },
                        runStep: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls += 1;
                                    if (calls === 1)
                                        throw (0, src_1.providerError)({ kind: "context_limit", message: "too long" });
                                    return [2 /*return*/, "ok"];
                                });
                            });
                        },
                    })];
            case 1:
                value = _a.sent();
                (0, bun_test_1.expect)(value).toBe("ok");
                (0, bun_test_1.expect)(calls).toBe(2);
                (0, bun_test_1.expect)(events).toContain("context.limit.recovery");
                (0, bun_test_1.expect)(events).toContain("compaction.begin");
                (0, bun_test_1.expect)(events).toContain("compaction.end");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("context-limit recovery reports when no old context can be compacted", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, recoveries, calls, value;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(1);
                recoveries = [];
                calls = 0;
                return [4 /*yield*/, (0, src_1.recoverContextLimitOnce)({
                        id: "turn_no_head",
                        step: 1,
                        ledger: ledger,
                        compactor: new fixtures_1.FakeCompactor(),
                        compact: {
                            id: "cmp_no_head",
                            maxTokens: 100,
                            thresholdPercent: 85,
                            reservedTokens: 10,
                            preservedRecentMessages: 2,
                        },
                        runStep: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls += 1;
                                    if (calls === 1)
                                        throw (0, src_1.providerError)({ kind: "context_limit", message: "too long" });
                                    return [2 /*return*/, "retried"];
                                });
                            });
                        },
                        onEvent: function (event) {
                            if (event.type === "context.limit.recovery")
                                recoveries.push(event.compacted);
                        },
                    })];
            case 1:
                value = _a.sent();
                (0, bun_test_1.expect)(value).toBe("retried");
                (0, bun_test_1.expect)(recoveries).toEqual([false, false]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("resource reinjection, session restore and event replay remain deterministic", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, restored;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(4);
                ledger.addResource({
                    kind: "workflow",
                    id: "wf-1",
                    summary: "pending workflow",
                });
                restored = new src_1.ContextLedger();
                restored.restore(ledger.snapshot());
                return [4 /*yield*/, (0, src_1.compactContext)(restored, new fixtures_1.FakeCompactor([{ summary: "with resources", tokens: 4 }]), {
                        id: "cmp_restore",
                        trigger: "manual",
                        maxTokens: 1000,
                        thresholdPercent: 85,
                        reservedTokens: 100,
                        preservedRecentMessages: 1,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(restored
                    .snapshot()
                    .entries.filter(function (entry) { return entry.content.includes("workflow:wf-1"); })).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("large tool result context representation separates artifact from UI text", function () {
    var entry = (0, src_1.largeToolResultContext)({
        id: "tool_big",
        role: "tool_result",
        content: "x".repeat(5000),
        artifactRef: "artifact://tool_big",
    });
    (0, bun_test_1.expect)(entry.content.length).toBeLessThan(2500);
    (0, bun_test_1.expect)(entry.content).toContain("artifact://tool_big");
    (0, bun_test_1.expect)(entry.content).toContain("totalChars=5000");
});
function ledgerWithMessages(count) {
    var ledger = new src_1.ContextLedger();
    for (var index = 0; index < count; index++) {
        ledger.add({
            id: "m".concat(index),
            role: index % 2 ? "assistant" : "user",
            content: "message ".concat(index),
            tokens: 10,
        });
    }
    return ledger;
}
(0, bun_test_1.test)("preserveRecentWithToolPairs restores missing paired call", function () {
    var entries = [
        { id: "call", role: "tool_call", content: "call", pairID: "p" },
        { id: "middle", role: "assistant", content: "middle" },
        { id: "result", role: "tool_result", content: "result", pairID: "p" },
    ];
    (0, bun_test_1.expect)((0, src_1.preserveRecentWithToolPairs)(entries, 1).map(function (entry) { return entry.id; })).toEqual(["call", "result"]);
});
(0, bun_test_1.test)("preserveRecentWithToolPairsByTokens keeps the newest suffix and closes tool pairs", function () {
    var entries = [
        { id: "call", role: "tool_call", content: "call", pairID: "p", tokens: 10 },
        {
            id: "middle",
            role: "assistant",
            content: "middle",
            tokens: 10,
        },
        {
            id: "result",
            role: "tool_result",
            content: "result",
            pairID: "p",
            tokens: 10,
        },
        { id: "newest", role: "assistant", content: "newest", tokens: 10 },
    ];
    (0, bun_test_1.expect)((0, src_1.preserveRecentWithToolPairsByTokens)(entries, 20).map(function (entry) { return entry.id; })).toEqual(["call", "result", "newest"]);
    (0, bun_test_1.expect)((0, src_1.preserveRecentWithToolPairsByTokens)(entries, 5).map(function (entry) { return entry.id; })).toEqual(["newest"]);
    (0, bun_test_1.expect)((0, src_1.preserveRecentWithToolPairsByTokens)(entries, 0)).toEqual([]);
});
(0, bun_test_1.test)("compaction keeps whichever of the message count and token budget reaches further back", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, compactedIDs, compactor;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(4);
                compactedIDs = [];
                compactor = {
                    compact: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                compactedIDs = input.messages.map(function (message) { return message.content; });
                                return [2 /*return*/, { summary: "budgeted summary" }];
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, compactor, {
                        id: "cmp_budget",
                        trigger: "ratio",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 2,
                        preservedRecentTokens: 15,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(compactedIDs).toEqual(["message 0", "message 1"]);
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "cmp_budget:summary",
                    "m2",
                    "m3",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction lets a generous token budget keep more than the message count", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, compactedIDs, compactor;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(4);
                compactedIDs = [];
                compactor = {
                    compact: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                compactedIDs = input.messages.map(function (message) { return message.content; });
                                return [2 /*return*/, { summary: "budgeted summary" }];
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, compactor, {
                        id: "cmp_budget_tokens",
                        trigger: "ratio",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 1,
                        preservedRecentTokens: 10000,
                    })];
            case 1:
                _a.sent();
                // Nothing is compactable once the whole ledger fits the tail.
                (0, bun_test_1.expect)(compactedIDs).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pruneToolResultEntry shrinks old oversized tool output and is idempotent", function () {
    var entry = {
        id: "big",
        role: "tool_result",
        content: "x".repeat(9000),
        tokens: 2250,
    };
    var pruned = (0, src_1.pruneToolResultEntry)(entry);
    (0, bun_test_1.expect)(pruned).not.toBe(entry);
    (0, bun_test_1.expect)(pruned.content.length).toBeLessThan(entry.content.length);
    (0, bun_test_1.expect)(pruned.content).toContain("tool result truncated for context");
    (0, bun_test_1.expect)(pruned.content).toContain("originalChars=9000");
    (0, bun_test_1.expect)((0, src_1.pruneToolResultEntry)(pruned)).toBe(pruned);
    var small = {
        id: "small",
        role: "tool_result",
        content: "short output",
    };
    (0, bun_test_1.expect)((0, src_1.pruneToolResultEntry)(small)).toBe(small);
});
(0, bun_test_1.test)("ContextLedger pruneToolResults protects the newest entry and lowers effectiveTokens", function () {
    var _a, _b;
    var ledger = new src_1.ContextLedger();
    ledger.add({
        id: "old-big",
        role: "tool_result",
        content: "x".repeat(9000),
        tokens: 2250,
    });
    ledger.add({
        id: "newest",
        role: "assistant",
        content: "newest turn",
        tokens: 10,
    });
    var before = ledger.effectiveTokens();
    var outcome = ledger.pruneToolResults();
    (0, bun_test_1.expect)(outcome.pruned).toBe(1);
    (0, bun_test_1.expect)(outcome.afterTokens).toBeLessThan(before);
    (0, bun_test_1.expect)((_a = ledger.snapshot().entries[0]) === null || _a === void 0 ? void 0 : _a.content).toContain("tool result truncated for context");
    (0, bun_test_1.expect)((_b = ledger.snapshot().entries[1]) === null || _b === void 0 ? void 0 : _b.content).toBe("newest turn");
    (0, bun_test_1.expect)(ledger.status({ max: 1000, thresholdPercent: 85, reserved: 10 }).source).toBe("pending_estimate");
});
(0, bun_test_1.test)("ContextLedger pruneToolResults is idempotent: a second pass rewrites nothing", function () {
    // Pruning rewrites live entries, and every provider request writes a
    // prefix-cache breakpoint at the end of its stable region. A second prune
    // that changed already-pruned bytes would invalidate the prefix the request
    // just cached, so idempotence is what limits the rewrite to one event/entry.
    var ledger = new src_1.ContextLedger();
    ledger.add({
        id: "old-big",
        role: "tool_result",
        content: "x".repeat(9000),
        tokens: 2250,
    });
    ledger.add({ id: "newest", role: "assistant", content: "newest", tokens: 4 });
    var first = ledger.pruneToolResults();
    var afterFirst = ledger.snapshot().entries.map(function (entry) { return entry.content; });
    var second = ledger.pruneToolResults();
    var afterSecond = ledger.snapshot().entries.map(function (entry) { return entry.content; });
    (0, bun_test_1.expect)(first.pruned).toBe(1);
    (0, bun_test_1.expect)(second.pruned).toBe(0);
    (0, bun_test_1.expect)(afterSecond).toEqual(afterFirst);
});
(0, bun_test_1.test)("ContextLedger pruneToolResults leaves the protected newest entry alone on every pass", function () {
    var _a, _b;
    var ledger = new src_1.ContextLedger();
    ledger.add({
        id: "old-big",
        role: "tool_result",
        content: "x".repeat(9000),
        tokens: 2250,
    });
    ledger.add({
        id: "newest-big",
        role: "tool_result",
        content: "y".repeat(9000),
        tokens: 2250,
    });
    ledger.pruneToolResults();
    (0, bun_test_1.expect)((_a = ledger.snapshot().entries[0]) === null || _a === void 0 ? void 0 : _a.content).toContain("tool result truncated for context");
    (0, bun_test_1.expect)((_b = ledger.snapshot().entries[1]) === null || _b === void 0 ? void 0 : _b.content).toBe("y".repeat(9000));
});
(0, bun_test_1.test)("compaction aborts when the ledger surface changes during summarization", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, events, compactor, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = ledgerWithMessages(4);
                events = [];
                compactor = {
                    compact: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                ledger.add({
                                    id: "late-arrival",
                                    role: "user",
                                    content: "arrived while the summary ran",
                                    tokens: 5,
                                });
                                return [2 /*return*/, { summary: "stale summary" }];
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, compactor, {
                        id: "cmp_surface_changed",
                        trigger: "manual",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 2,
                        onEvent: function (event) { return events.push(event); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual({ compacted: false, skipped: "surface_changed" });
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "m0",
                    "m1",
                    "m2",
                    "m3",
                    "late-arrival",
                ]);
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "compaction.end",
                    success: false,
                    error: "surface_changed",
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("recoverContextLimitOnce bounds overflow retries and reports exhaustion", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = 0;
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.recoverContextLimitOnce)({
                        id: "turn_overflow_exhausted",
                        step: 1,
                        ledger: ledgerWithMessages(2),
                        compactor: new fixtures_1.FakeCompactor([{ summary: "summary" }]),
                        compact: {
                            id: "cmp_overflow_exhausted",
                            maxTokens: 100,
                            thresholdPercent: 85,
                            reservedTokens: 10,
                            preservedRecentMessages: 0,
                        },
                        maxOverflowRetries: 0,
                        runStep: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls += 1;
                                    throw (0, src_1.providerError)({
                                        kind: "context_limit",
                                        message: "too long",
                                    });
                                });
                            });
                        },
                    })).rejects.toMatchObject({
                        kind: "context_limit",
                        message: bun_test_1.expect.stringContaining("retries exhausted (0)"),
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(calls).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("decideCompaction returns none below both thresholds", function () {
    (0, bun_test_1.expect)((0, src_1.decideCompaction)({
        requestTokens: 1000,
        headerTokens: 200,
        surfaceTokens: 800,
        max: 100000,
        reserved: 4096,
        thresholdPercent: 85,
        hasCompactableRange: true,
    })).toBe("none");
});
(0, bun_test_1.test)("decideCompaction returns ratio on full-request pressure", function () {
    (0, bun_test_1.expect)((0, src_1.decideCompaction)({
        requestTokens: 90000,
        headerTokens: 10000,
        surfaceTokens: 80000,
        max: 100000,
        reserved: 4096,
        thresholdPercent: 85,
        hasCompactableRange: true,
    })).toBe("ratio");
});
(0, bun_test_1.test)("decideCompaction returns reserved when request plus output would not fit", function () {
    // Below the 85% ratio threshold (85000) but request + reserved (20000) would
    // exceed the 100k window, so the hard capacity guard fires instead.
    (0, bun_test_1.expect)((0, src_1.decideCompaction)({
        requestTokens: 84000,
        headerTokens: 5000,
        surfaceTokens: 79000,
        max: 100000,
        reserved: 20000,
        thresholdPercent: 85,
        hasCompactableRange: true,
    })).toBe("reserved");
});
(0, bun_test_1.test)("decideCompaction refuses to summarize without a compactable range", function () {
    // Over pressure, but the only foldable content is already a summary.
    (0, bun_test_1.expect)((0, src_1.decideCompaction)({
        requestTokens: 90000,
        headerTokens: 10000,
        surfaceTokens: 80000,
        max: 100000,
        reserved: 4096,
        thresholdPercent: 85,
        hasCompactableRange: false,
    })).toBe("nothing_to_compact");
});
(0, bun_test_1.test)("decideCompaction uses the conservative 32k reserve instead of a flat 20k", function () {
    // A 32k window reserves 4096, so a ~28k request is under the reserved guard
    // and only trips at the ratio threshold; a flat 20k reserve would wrongly fire.
    (0, bun_test_1.expect)((0, src_1.decideCompaction)({
        requestTokens: 20000,
        headerTokens: 4096,
        surfaceTokens: 15904,
        max: 32000,
        reserved: 4096,
        thresholdPercent: 85,
        hasCompactableRange: true,
    })).toBe("none");
});
(0, bun_test_1.test)("selectCompactableRange splits preserved suffix from compactable prefix", function () {
    var ledger = new src_1.ContextLedger();
    for (var index = 0; index < 6; index++)
        ledger.add({
            id: "m".concat(index),
            role: index % 2 ? "assistant" : "user",
            content: "message ".concat(index),
        });
    var range = (0, src_1.selectCompactableRange)(ledger.snapshot().entries, {
        recentMessages: 2,
    });
    (0, bun_test_1.expect)(range.preserved.map(function (entry) { return entry.id; })).toEqual(["m4", "m5"]);
    (0, bun_test_1.expect)(range.compactable.map(function (entry) { return entry.id; })).toEqual([
        "m0",
        "m1",
        "m2",
        "m3",
    ]);
    (0, bun_test_1.expect)(range.hasRange).toBe(true);
});
(0, bun_test_1.test)("selectCompactableRange reports no range when only a summary remains", function () {
    var ledger = new src_1.ContextLedger();
    ledger.add({ id: "s", role: "summary", content: "prior summary" });
    ledger.add({ id: "u", role: "user", content: "latest" });
    var range = (0, src_1.selectCompactableRange)(ledger.snapshot().entries, {
        recentMessages: 5,
    });
    (0, bun_test_1.expect)(range.compactable).toEqual([]);
    (0, bun_test_1.expect)(range.hasRange).toBe(false);
});
(0, bun_test_1.test)("contextThresholdTokens derives the compaction boundary from the budget", function () {
    (0, bun_test_1.expect)((0, src_1.contextThresholdTokens)({ max: 100000, thresholdPercent: 85 })).toBe(85000);
    (0, bun_test_1.expect)((0, src_1.contextThresholdTokens)({ max: 99, thresholdPercent: 90 })).toBe(89);
});
(0, bun_test_1.test)("assertContextBudgetInvariants rejects a preserved tail above the threshold", function () {
    var base = {
        max: 10000,
        reserved: 1000,
        reservedSource: "fallback_formula",
        thresholdPercent: 80,
        preservedRecentMessages: 10,
        maxOverflowRetries: 1,
        prune: src_1.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS,
    };
    // 8_000 is the threshold: a preserved tail at or above it can never trigger.
    (0, bun_test_1.expect)(function () {
        return (0, src_1.assertContextBudgetInvariants)(__assign(__assign({}, base), { preservedRecentTokens: 8000 }));
    }).toThrow(/preservedRecentTokens/);
    // Below the threshold is the valid configuration.
    (0, bun_test_1.expect)(function () {
        return (0, src_1.assertContextBudgetInvariants)(__assign(__assign({}, base), { preservedRecentTokens: 2000 }));
    }).not.toThrow();
    // 0 disables the absolute tail budget and is always valid.
    (0, bun_test_1.expect)(function () {
        return (0, src_1.assertContextBudgetInvariants)(__assign(__assign({}, base), { preservedRecentTokens: 0 }));
    }).not.toThrow();
});
(0, bun_test_1.test)("compaction keeps the ledger's leading system entry", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, index, result, entries;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({
                    id: "system",
                    role: "system",
                    content: "subagent system prompt",
                    tokens: 10,
                });
                ledger.add({
                    id: "task",
                    role: "user",
                    content: "the delegated task",
                    tokens: 10,
                });
                for (index = 0; index < 12; index++)
                    ledger.add({
                        id: "m".concat(index),
                        role: index % 2 ? "assistant" : "user",
                        content: "message ".concat(index),
                        tokens: 10,
                    });
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor(), {
                        id: "cmp_system_head",
                        trigger: "manual",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 4,
                        onEvent: function () { },
                    })];
            case 1:
                result = _c.sent();
                (0, bun_test_1.expect)(result.compacted).toBe(true);
                entries = ledger.snapshot().entries;
                (0, bun_test_1.expect)((_a = entries[0]) === null || _a === void 0 ? void 0 : _a.role).toBe("system");
                (0, bun_test_1.expect)((_b = entries[0]) === null || _b === void 0 ? void 0 : _b.content).toBe("subagent system prompt");
                // Retaining it must not duplicate it when the preserved tail already covers
                // the whole ledger, which is the only case where preserved[0] is that entry.
                (0, bun_test_1.expect)(entries.filter(function (entry) { return entry.id === "system"; })).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction settles after one pass even with a leading system entry", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, index, first, rangeAfter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({
                    id: "system",
                    role: "system",
                    content: "system prompt",
                    tokens: 10,
                });
                ledger.add({ id: "u1", role: "user", content: "the task", tokens: 10 });
                for (index = 0; index < 12; index++)
                    ledger.add({
                        id: "m".concat(index),
                        role: index % 2 ? "assistant" : "user",
                        content: "message ".concat(index),
                        tokens: 10,
                    });
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor(), {
                        id: "cmp_settle",
                        trigger: "manual",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 4,
                        onEvent: function () { },
                    })];
            case 1:
                first = _a.sent();
                rangeAfter = (0, src_1.selectCompactableRange)(ledger.snapshot().entries, {
                    recentMessages: 4,
                });
                (0, bun_test_1.expect)(first.compacted).toBe(true);
                (0, bun_test_1.expect)(rangeAfter.hasRange).toBe(false);
                (0, bun_test_1.expect)(rangeAfter.compactable.every(function (entry) { return entry.role === "summary"; })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("preserveRecentTail unions the count and token constraints", function () {
    // Ten entries of 10 tokens each. A count of 3 reaches back 30 tokens' worth;
    // a budget of 60 reaches back 6 entries. The union keeps the further one.
    var ledger = new src_1.ContextLedger();
    for (var index = 0; index < 10; index++)
        ledger.add({
            id: "m".concat(index),
            role: "user",
            content: "x".repeat(40),
            tokens: 10,
        });
    var byCount = (0, src_1.preserveRecentTail)(ledger.snapshot().entries, {
        recentMessages: 3,
    });
    var byTokens = (0, src_1.preserveRecentTail)(ledger.snapshot().entries, {
        recentTokens: 60,
    });
    var both = (0, src_1.preserveRecentTail)(ledger.snapshot().entries, {
        recentMessages: 3,
        recentTokens: 60,
    });
    (0, bun_test_1.expect)(byCount.map(function (e) { return e.id; })).toEqual(["m7", "m8", "m9"]);
    (0, bun_test_1.expect)(byTokens.map(function (e) { return e.id; })).toEqual([
        "m4",
        "m5",
        "m6",
        "m7",
        "m8",
        "m9",
    ]);
    // The union is the longer of the two, not one of them.
    (0, bun_test_1.expect)(both.map(function (e) { return e.id; })).toEqual(byTokens.map(function (e) { return e.id; }));
});
(0, bun_test_1.test)("preserveRecentTail reaches back for a user message the tail would lack", function () {
    // A tail of replies and tool exchanges says nothing about what the user wants.
    // The last user message is deliberately not the first entry, so reaching it
    // still leaves something to compact — which is what makes the reach
    // worthwhile rather than self-defeating.
    var ledger = new src_1.ContextLedger();
    ledger.add({ id: "m0", role: "assistant", content: "earlier", tokens: 5 });
    ledger.add({ id: "u", role: "user", content: "do the thing", tokens: 5 });
    ledger.add({
        id: "c",
        role: "tool_call",
        content: "call",
        pairID: "p",
        tokens: 5,
    });
    ledger.add({
        id: "r",
        role: "tool_result",
        content: "res",
        pairID: "p",
        tokens: 5,
    });
    ledger.add({ id: "a", role: "assistant", content: "done", tokens: 5 });
    var tail = (0, src_1.preserveRecentTail)(ledger.snapshot().entries, {
        recentMessages: 2,
    });
    // The count alone would keep only the result and the reply.
    (0, bun_test_1.expect)(tail.map(function (e) { return e.id; })).toEqual(["u", "c", "r", "a"]);
    (0, bun_test_1.expect)(tail.some(function (e) { return e.role === "user"; })).toBe(true);
});
(0, bun_test_1.test)("preserveRecentTail never lets the user-message rule swallow the compactable range", function () {
    // Reaching back to the only user message would leave nothing to compact, and
    // compaction that never fires grows the context without bound.
    var ledger = new src_1.ContextLedger();
    ledger.add({ id: "u", role: "user", content: "the only message", tokens: 5 });
    ledger.add({
        id: "c",
        role: "tool_call",
        content: "call",
        pairID: "p",
        tokens: 5,
    });
    ledger.add({
        id: "r",
        role: "tool_result",
        content: "res",
        pairID: "p",
        tokens: 5,
    });
    ledger.add({ id: "a", role: "assistant", content: "done", tokens: 5 });
    var tail = (0, src_1.preserveRecentTail)(ledger.snapshot().entries, {
        recentMessages: 2,
    });
    // The count's own tail stands, so the user message stays compactable. The
    // tool call joins it because closing the pair is not optional.
    (0, bun_test_1.expect)(tail.map(function (e) { return e.id; })).toEqual(["c", "r", "a"]);
});
(0, bun_test_1.test)("preserveRecentTail keeps a tail that already holds a user message exactly as constrained", function () {
    var ledger = new src_1.ContextLedger();
    for (var index = 0; index < 6; index++)
        ledger.add({
            id: "m".concat(index),
            role: index % 2 ? "assistant" : "user",
            content: "x",
            tokens: 1,
        });
    var tail = (0, src_1.preserveRecentTail)(ledger.snapshot().entries, {
        recentMessages: 2,
    });
    // m4 is a user message, so the guarantee adds nothing and the count decides.
    (0, bun_test_1.expect)(tail.map(function (e) { return e.id; })).toEqual(["m4", "m5"]);
});
(0, bun_test_1.test)("a disabled token budget leaves the count as the only constraint", function () {
    var ledger = new src_1.ContextLedger();
    for (var index = 0; index < 6; index++)
        ledger.add({ id: "m".concat(index), role: "user", content: "x", tokens: 1 });
    var tail = (0, src_1.preserveRecentTail)(ledger.snapshot().entries, {
        recentMessages: 2,
        recentTokens: 0,
    });
    (0, bun_test_1.expect)(tail.map(function (e) { return e.id; })).toEqual(["m4", "m5"]);
});
(0, bun_test_1.test)("missingSummarySections names every absent heading in template order", function () {
    (0, bun_test_1.expect)((0, src_1.missingSummarySections)(CONFORMING_SUMMARY)).toEqual([]);
    (0, bun_test_1.expect)((0, src_1.missingSummarySections)("## Objective\n- x\n## Next Move\n1. y")).toEqual([
        "## Important Details",
        "## Work State",
        "### Completed",
        "### Active",
        "### Blocked",
        "## Relevant Files",
    ]);
});
(0, bun_test_1.test)("a compactor regenerates a summary that drops a required section", function () { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, provider, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                attempts = 0;
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_3() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        attempts += 1;
                                        return [4 /*yield*/, __await({
                                                type: "content",
                                                text: attempts === 1
                                                    ? "## Objective\n- only the objective, nothing else"
                                                    : CONFORMING_SUMMARY,
                                            })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "work" }],
                        resources: [],
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(attempts).toBe(2);
                (0, bun_test_1.expect)(result.summary).toBe(CONFORMING_SUMMARY);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a compactor regenerates a summary too short to carry the span", function () { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, provider, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                attempts = 0;
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_4() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        attempts += 1;
                                        return [4 /*yield*/, __await({
                                                type: "content",
                                                text: attempts === 1 ? "done." : CONFORMING_SUMMARY,
                                            })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "work" }],
                        resources: [],
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(attempts).toBe(2);
                (0, bun_test_1.expect)(result.summary.length).toBeGreaterThan(src_1.MIN_SUMMARY_CHARS);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a compactor that never satisfies the contract fails instead of committing it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, provider;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                attempts = 0;
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function () {
                        return __asyncGenerator(this, arguments, function stream_5() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        attempts += 1;
                                        return [4 /*yield*/, __await({ type: "content", text: "still too short" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                // A stub this short fails both checks; the section check runs first, so the
                // message names whichever contract it broke rather than the last one tried.
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "work" }],
                        resources: [],
                    })).rejects.toThrow(/missing required sections|too short/)];
            case 1:
                // A stub this short fails both checks; the section check runs first, so the
                // message names whichever contract it broke rather than the last one tried.
                _a.sent();
                // Bounded: a summary that cannot be made valid costs this many calls and then
                // fails, rather than retrying until the request times out.
                (0, bun_test_1.expect)(attempts).toBe(src_1.SUMMARY_ATTEMPTS);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the compaction prompt spells out how to merge a prior summary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider, prompt;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_6() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [
                            { role: "user", content: "Earlier state" },
                            { role: "user", content: "New requirement" },
                        ],
                        resources: [],
                    })];
            case 1:
                _c.sent();
                prompt = (_b = (_a = request === null || request === void 0 ? void 0 : request.messages.at(-1)) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : "";
                // The prior summary is discarded by the merge, so what must survive has to be
                // carried deliberately — and a conflict resolves toward the newer entries.
                (0, bun_test_1.expect)(prompt).toContain("update that anchor");
                (0, bun_test_1.expect)(prompt).toContain("the newer entries win");
                (0, bun_test_1.expect)(prompt).toContain("Move completed work from Active to Completed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a compaction that would not shrink anything is rejected", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, events, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "u1", role: "user", content: "old", tokens: 50 });
                ledger.add({ id: "a1", role: "assistant", content: "newer", tokens: 50 });
                events = [];
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor([{ summary: "a very long summary indeed", tokens: 500 }]), {
                        id: "cmp_no_shrink",
                        trigger: "manual",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 1,
                        onEvent: function (event) { return events.push(event.type); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result.compacted).toBe(false);
                // The failure is reported rather than swallowed, and the ledger is untouched.
                (0, bun_test_1.expect)(events).toContain("compaction.end");
                (0, bun_test_1.expect)(ledger.snapshot().entries.map(function (entry) { return entry.id; })).toEqual([
                    "u1",
                    "a1",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a compaction whose summary is smaller than the span commits", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({
                    id: "u1",
                    role: "user",
                    content: "x".repeat(4000),
                    tokens: 1000,
                });
                ledger.add({ id: "a1", role: "assistant", content: "newer", tokens: 10 });
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor([{ summary: "short", tokens: 20 }]), {
                        id: "cmp_shrinks",
                        trigger: "manual",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 1,
                        onEvent: function () { },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result.compacted).toBe(true);
                (0, bun_test_1.expect)(ledger.snapshot().entries[0].role).toBe("summary");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the shrink check compares against the replaced span, not the whole ledger", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "u1", role: "user", content: "x".repeat(400), tokens: 100 });
                ledger.add({
                    id: "keep",
                    role: "assistant",
                    content: "y".repeat(4000),
                    tokens: 1000,
                });
                ledger.add({
                    id: "u2",
                    role: "user",
                    content: "z".repeat(4000),
                    tokens: 1000,
                });
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, new fixtures_1.FakeCompactor([{ summary: "small", tokens: 50 }]), {
                        id: "cmp_span",
                        trigger: "manual",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        preservedRecentMessages: 2,
                        onEvent: function () { },
                    })];
            case 1:
                result = _a.sent();
                // The tail alone is far larger than the summary, yet the compaction stands
                // because only u1 was replaced.
                (0, bun_test_1.expect)(result.compacted).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the summarization call replays the span so its prefix matches the routed request", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, routedMessages, compactedMessages, compactor;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new src_1.ContextLedger();
                ledger.add({ id: "u1", role: "user", content: "first request", tokens: 10 });
                ledger.add({
                    id: "c1",
                    role: "tool_call",
                    content: 'read_file {"p":"a"}',
                    pairID: "p1",
                    tokens: 10,
                });
                ledger.add({
                    id: "r1",
                    role: "tool_result",
                    content: "file body",
                    pairID: "p1",
                    tokens: 10,
                });
                ledger.add({ id: "a1", role: "assistant", content: "read it", tokens: 10 });
                ledger.add({ id: "u2", role: "user", content: "second request", tokens: 10 });
                routedMessages = (0, src_1.contextEntriesToProviderMessages)(ledger.snapshot().entries);
                compactedMessages = [];
                compactor = {
                    compact: function (input) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                compactedMessages = input.messages;
                                return [2 /*return*/, { summary: CONFORMING_SUMMARY, tokens: 4 }];
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.compactContext)(ledger, compactor, {
                        id: "cmp_prefix",
                        trigger: "manual",
                        maxTokens: 100,
                        thresholdPercent: 85,
                        reservedTokens: 10,
                        // Preserve only the last message, so the span is the first four.
                        preservedRecentMessages: 1,
                        onEvent: function () { },
                    })];
            case 1:
                _a.sent();
                // Every summarised message is byte-identical to what the routed request sent,
                // in the same order, with nothing added ahead of them.
                (0, bun_test_1.expect)(compactedMessages.length).toBeGreaterThan(1);
                (0, bun_test_1.expect)(compactedMessages).toEqual(routedMessages.slice(0, compactedMessages.length));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the summarization instruction is the last message of its own request", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider, messages;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_7() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [
                            { role: "user", content: "older turn" },
                            { role: "assistant", content: "reply" },
                        ],
                        resources: [],
                    })];
            case 1:
                _b.sent();
                messages = (_a = request === null || request === void 0 ? void 0 : request.messages) !== null && _a !== void 0 ? _a : [];
                (0, bun_test_1.expect)(messages).toHaveLength(3);
                (0, bun_test_1.expect)(messages[0]).toEqual({ role: "user", content: "older turn" });
                (0, bun_test_1.expect)(messages[1]).toEqual({ role: "assistant", content: "reply" });
                (0, bun_test_1.expect)(messages[2].content).toContain("Summarize this Natalia agent session");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the summarization call reuses the routed system prompt as its own system message", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_8() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "older turn" }],
                        resources: [],
                        prefixMessages: [{ role: "system", content: "the routed system prompt" }],
                    })];
            case 1:
                _a.sent();
                // Same system bytes, same position: the cacheable prefix starts identically.
                (0, bun_test_1.expect)(request === null || request === void 0 ? void 0 : request.messages[0]).toEqual({
                    role: "system",
                    content: "the routed system prompt",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the user's instruction is layered onto the compaction prompt", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider, prompt;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_9() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "work" }],
                        resources: [],
                        instruction: "Compact the older chat history.",
                        userInstruction: "Always preserve changelog dates and ticket ids.",
                    })];
            case 1:
                _c.sent();
                prompt = (_b = (_a = request === null || request === void 0 ? void 0 : request.messages.at(-1)) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : "";
                (0, bun_test_1.expect)(prompt).toContain("Compact the older chat history.");
                // Layered alongside the caller's direction rather than replacing it.
                (0, bun_test_1.expect)(prompt).toContain("The user of this workspace also requires: Always preserve changelog dates and ticket ids.");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("with no user instruction the prompt is unchanged", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_10() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "work" }],
                        resources: [],
                    })];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((_a = request === null || request === void 0 ? void 0 : request.messages.at(-1)) === null || _a === void 0 ? void 0 : _a.content).not.toContain("The user of this workspace also requires");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the user instruction rides before the span, so it qualifies what to keep", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, provider, messages, instructionIndex, spanIndex;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                provider = {
                    provider: "test",
                    model: "test",
                    stream: function (input) {
                        return __asyncGenerator(this, arguments, function stream_11() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        request = input;
                                        return [4 /*yield*/, __await({ type: "content", text: CONFORMING_SUMMARY })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                return [4 /*yield*/, (0, src_1.providerCompactor)(provider).compact({
                        messages: [{ role: "user", content: "the span content" }],
                        resources: [],
                        userInstruction: "keep the ticket ids",
                    })];
            case 1:
                _b.sent();
                messages = (_a = request === null || request === void 0 ? void 0 : request.messages) !== null && _a !== void 0 ? _a : [];
                instructionIndex = messages.findLastIndex(function (m) {
                    return m.content.includes("keep the ticket ids");
                });
                spanIndex = messages.findLastIndex(function (m) {
                    return m.content.includes("the span content");
                });
                (0, bun_test_1.expect)(instructionIndex).toBeGreaterThan(spanIndex);
                return [2 /*return*/];
        }
    });
}); });
