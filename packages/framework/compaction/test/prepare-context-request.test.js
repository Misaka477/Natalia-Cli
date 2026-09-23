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
var src_1 = require("../src");
var TRUNCATION_MARKER = "tool result truncated for context";
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
function scriptedProvider(counter, summary) {
    if (summary === void 0) { summary = CONFORMING_SUMMARY; }
    return {
        provider: "scripted",
        model: "scripted",
        stream: function () {
            return __asyncGenerator(this, arguments, function stream_1() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            counter.calls += 1;
                            return [4 /*yield*/, __await({ type: "content", text: summary })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 3: return [4 /*yield*/, _a.sent()];
                        case 4:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function makeLedger() {
    var ledger = new runtime_1.ContextLedger();
    ledger.add({ id: "sys", role: "system", content: "system prompt" });
    return ledger;
}
function rebuild(entries) {
    return (0, runtime_1.contextEntriesToProviderMessages)(entries);
}
function collectEvents(sink) {
    return {
        emitStatus: function (measured) {
            sink.push({
                type: "context.status",
                used: measured.totalTokens,
                max: 0,
                source: "pending_estimate",
                thresholdPercent: 0,
                reserved: 0,
            });
        },
        emitSnapshot: function (measured) {
            sink.push({
                type: "context.snapshot",
                usedTokens: measured.totalTokens,
                source: "estimate",
                at: new Date().toISOString(),
            });
        },
    };
}
var baseInput = function (overrides) { return (__assign({ id: "turn-1", scope: "main", system: "system prompt", tools: undefined, contextWindow: 100000, budget: { max: 100000, thresholdPercent: 85, reserved: 4096 }, 
    // Every scenario here is a turn's first provider request, which is the only
    // request allowed to rewrite the ledger. `prune: false` tests the opposite.
    prune: true, preserve: { recentMessages: 1 }, rebuildOutbound: rebuild }, overrides)); };
(0, bun_test_1.test)("prepareContextRequest leaves an under-threshold request untouched and never calls the LLM", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, meter, provider, events, _a, emitStatus, emitSnapshot, outbound, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ledger = makeLedger();
                ledger.add({ id: "u1", role: "user", content: "hi" });
                meter = new runtime_1.TokenMeter();
                provider = scriptedProvider({ calls: 0 });
                events = [];
                _a = collectEvents(events), emitStatus = _a.emitStatus, emitSnapshot = _a.emitSnapshot;
                outbound = rebuild(ledger.snapshot().entries);
                return [4 /*yield*/, (0, src_1.prepareContextRequest)(baseInput({
                        ledger: ledger,
                        meter: meter,
                        outbound: outbound,
                        provider: provider,
                        publish: function (event) { return events.push(event); },
                        emitStatus: emitStatus,
                        emitSnapshot: emitSnapshot,
                    }))];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.decision).toBe("none");
                (0, bun_test_1.expect)(result.compacted).toBe(false);
                (0, bun_test_1.expect)(result.pruned).toBe(0);
                (0, bun_test_1.expect)(provider.stream).toBeDefined();
                // No compaction events emitted.
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "compaction.begin"; })).toBe(false);
                // A context surface was still published for the UI.
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "context.status"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "context.snapshot"; })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("prepareContextRequest prunes model-free before summarizing and rebuilds the truncated outbound", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, meter, provider, events, _a, emitStatus, emitSnapshot, outbound, result, rebuiltText;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ledger = makeLedger();
                // A large old tool result big enough to cross the 85% threshold (~340k chars)
                // so the prune path runs; pruning collapses it far below the threshold.
                ledger.add({
                    id: "c1",
                    role: "tool_call",
                    content: "shell x",
                    pairID: "c1",
                });
                ledger.add({
                    id: "r1",
                    role: "tool_result",
                    content: "x".repeat(400000),
                    pairID: "c1",
                });
                ledger.add({ id: "u1", role: "user", content: "latest question" });
                meter = new runtime_1.TokenMeter();
                provider = scriptedProvider({ calls: 0 });
                events = [];
                _a = collectEvents(events), emitStatus = _a.emitStatus, emitSnapshot = _a.emitSnapshot;
                outbound = rebuild(ledger.snapshot().entries);
                return [4 /*yield*/, (0, src_1.prepareContextRequest)(baseInput({
                        ledger: ledger,
                        meter: meter,
                        outbound: outbound,
                        provider: provider,
                        pruneOptions: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
                        publish: function (event) { return events.push(event); },
                        emitStatus: emitStatus,
                        emitSnapshot: emitSnapshot,
                    }))];
            case 1:
                result = _b.sent();
                // The oversized tool result was pruned, which drops the request below the
                // threshold, so the summarizer is never reached.
                (0, bun_test_1.expect)(result.pruned).toBeGreaterThan(0);
                (0, bun_test_1.expect)(result.compacted).toBe(false);
                rebuiltText = result.outbound
                    .map(function (message) { return message.content; })
                    .join("\n");
                (0, bun_test_1.expect)(rebuiltText).toContain(TRUNCATION_MARKER);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("prepareContextRequest refuses to prune a later request of the same turn", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, meter, events, _a, emitStatus, emitSnapshot, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ledger = makeLedger();
                ledger.add({ id: "c1", role: "tool_call", content: "shell x", pairID: "c1" });
                ledger.add({
                    id: "r1",
                    role: "tool_result",
                    content: "x".repeat(400000),
                    pairID: "c1",
                });
                ledger.add({ id: "u1", role: "user", content: "latest question" });
                meter = new runtime_1.TokenMeter();
                events = [];
                _a = collectEvents(events), emitStatus = _a.emitStatus, emitSnapshot = _a.emitSnapshot;
                return [4 /*yield*/, (0, src_1.prepareContextRequest)(baseInput({
                        ledger: ledger,
                        meter: meter,
                        outbound: rebuild(ledger.snapshot().entries),
                        provider: scriptedProvider({ calls: 0 }),
                        prune: false,
                        pruneOptions: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
                        publish: function (event) { return events.push(event); },
                        emitStatus: emitStatus,
                        emitSnapshot: emitSnapshot,
                    }))];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.pruned).toBe(0);
                (0, bun_test_1.expect)(result.outbound.map(function (message) { return message.content; }).join("\n")).not.toContain(TRUNCATION_MARKER);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("prepareContextRequest summarizes when pressure survives pruning", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, index, meter, counter, provider, events, _a, emitStatus, emitSnapshot, outbound, result, hasSummary;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ledger = makeLedger();
                // No tool results to prune; the pressure is genuine message surface that
                // exceeds the 85% threshold (~340k chars).
                for (index = 0; index < 60; index++)
                    ledger.add({
                        id: "m".concat(index),
                        role: index % 2 ? "assistant" : "user",
                        content: "message ".concat(index, " ").concat("y".repeat(8000)),
                    });
                meter = new runtime_1.TokenMeter();
                counter = { calls: 0 };
                provider = scriptedProvider(counter);
                events = [];
                _a = collectEvents(events), emitStatus = _a.emitStatus, emitSnapshot = _a.emitSnapshot;
                outbound = rebuild(ledger.snapshot().entries);
                return [4 /*yield*/, (0, src_1.prepareContextRequest)(baseInput({
                        ledger: ledger,
                        meter: meter,
                        outbound: outbound,
                        provider: provider,
                        pruneOptions: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
                        publish: function (event) { return events.push(event); },
                        emitStatus: emitStatus,
                        emitSnapshot: emitSnapshot,
                    }))];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(counter.calls).toBe(1);
                (0, bun_test_1.expect)(result.compacted).toBe(true);
                (0, bun_test_1.expect)(["ratio", "reserved"]).toContain(result.decision);
                hasSummary = result.outbound.some(function (message) {
                    return message.content.includes(CONFORMING_SUMMARY);
                });
                (0, bun_test_1.expect)(hasSummary).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "compaction.begin"; })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "compaction.end"; })).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("prepareContextRequest does not call the LLM when only a summary remains", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, meter, counter, provider, events, _a, emitStatus, emitSnapshot, outbound, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ledger = makeLedger();
                ledger.add({ id: "s", role: "summary", content: "prior summary" });
                ledger.add({ id: "u1", role: "user", content: "z".repeat(400000) });
                meter = new runtime_1.TokenMeter();
                counter = { calls: 0 };
                provider = scriptedProvider(counter);
                events = [];
                _a = collectEvents(events), emitStatus = _a.emitStatus, emitSnapshot = _a.emitSnapshot;
                outbound = rebuild(ledger.snapshot().entries);
                return [4 /*yield*/, (0, src_1.prepareContextRequest)(baseInput({
                        ledger: ledger,
                        meter: meter,
                        outbound: outbound,
                        provider: provider,
                        // Preserve everything except the summary, so the only foldable content is
                        // the summary itself -> nothing to compact.
                        preserve: { recentMessages: 100 },
                        publish: function (event) { return events.push(event); },
                        emitStatus: emitStatus,
                        emitSnapshot: emitSnapshot,
                    }))];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(counter.calls).toBe(0);
                (0, bun_test_1.expect)(result.decision).toBe("nothing_to_compact");
                (0, bun_test_1.expect)(result.compacted).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("prepareContextRequest does not re-summarize when a prior compaction left only a summary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, index, meter, counter, provider, events, _a, emitStatus, emitSnapshot, build, first, second;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                ledger = makeLedger();
                for (index = 0; index < 60; index++)
                    ledger.add({
                        id: "m".concat(index),
                        role: index % 2 ? "assistant" : "user",
                        content: "message ".concat(index, " ").concat("y".repeat(8000)),
                    });
                meter = new runtime_1.TokenMeter();
                counter = { calls: 0 };
                provider = scriptedProvider(counter, CONFORMING_SUMMARY.replace("- The contract is enforced now.", "- ".concat("z".repeat(400000))));
                events = [];
                _a = collectEvents(events), emitStatus = _a.emitStatus, emitSnapshot = _a.emitSnapshot;
                build = function () {
                    return baseInput({
                        ledger: ledger,
                        meter: meter,
                        provider: provider,
                        // Preserve nothing, so the compactable range is the whole surface; after
                        // one compaction it collapses to a lone summary.
                        preserve: { recentMessages: 0 },
                        outbound: rebuild(ledger.snapshot().entries),
                        publish: function (event) { return events.push(event); },
                        emitStatus: emitStatus,
                        emitSnapshot: emitSnapshot,
                    });
                };
                return [4 /*yield*/, (0, src_1.prepareContextRequest)(build())];
            case 1:
                first = _b.sent();
                (0, bun_test_1.expect)(first.compacted).toBe(true);
                (0, bun_test_1.expect)(counter.calls).toBe(1);
                return [4 /*yield*/, (0, src_1.prepareContextRequest)(build())];
            case 2:
                second = _b.sent();
                (0, bun_test_1.expect)(second.compacted).toBe(false);
                (0, bun_test_1.expect)(second.decision).toBe("nothing_to_compact");
                (0, bun_test_1.expect)(counter.calls).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("prepareContextRequest derives the preserved tail and prune options from the budget", function () { return __awaiter(void 0, void 0, void 0, function () {
    var big, ledger, meter, events, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                big = "x".repeat(400);
                ledger = new runtime_1.ContextLedger();
                ledger.add({ id: "u1", role: "user", content: big, tokens: 120 });
                meter = new runtime_1.TokenMeter();
                events = [];
                return [4 /*yield*/, (0, src_1.prepareContextRequest)({
                        id: "budget-policy",
                        step: 0,
                        ledger: ledger,
                        meter: meter,
                        scope: "main",
                        system: undefined,
                        tools: undefined,
                        contextWindow: 100,
                        budget: {
                            max: 100,
                            thresholdPercent: 50,
                            reserved: 10,
                            preservedRecentMessages: 5,
                            preservedRecentTokens: 0,
                            prune: runtime_1.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS,
                        },
                        prune: true,
                        outbound: [{ role: "user", content: big }],
                        rebuildOutbound: function () { return [{ role: "user", content: big }]; },
                        provider: {
                            provider: "scripted",
                            model: "m1",
                            stream: function () {
                                return __asyncGenerator(this, arguments, function stream_2() {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, __await({ type: "content", text: "summary" })];
                                            case 1: return [4 /*yield*/, _a.sent()];
                                            case 2:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                });
                            },
                        },
                        publish: function (event) { return events.push(event); },
                        emitStatus: function () { },
                        emitSnapshot: function () { },
                    })];
            case 1:
                result = _a.sent();
                // The single entry sits inside the preserved tail, so there is nothing to
                // compact and no summarizer round trip happens.
                (0, bun_test_1.expect)(result.decision).toBe("nothing_to_compact");
                (0, bun_test_1.expect)(result.compacted).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
