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
exports.SUMMARY_ATTEMPTS = exports.MIN_SUMMARY_CHARS = void 0;
exports.missingSummarySections = missingSummarySections;
exports.providerCompactor = providerCompactor;
exports.compactContext = compactContext;
exports.recoverContextLimitOnce = recoverContextLimitOnce;
exports.buildCompactionPrompt = buildCompactionPrompt;
var errors_1 = require("./errors");
var context_1 = require("./context");
var retry_1 = require("./retry");
var provider_1 = require("./provider");
var COMPACTION_SUMMARY_TEMPLATE = "Use exactly this Markdown structure and keep every section:\n## Objective\n- The user's current goal.\n\n## Important Details\n- Constraints, decisions and reasons, exact identifiers, and facts needed to continue.\n\n## Work State\n### Completed\n- Finished and verified work.\n\n### Active\n- Work currently in progress.\n\n### Blocked\n- Blockers, failures, and unresolved unknowns.\n\n## Next Move\n1. The immediate concrete action.\n\n## Relevant Files\n- Exact path: why it matters.\n\nUse terse bullets. Write \"(none)\" when a section has no content.";
/**
 * The section headings a compaction summary must carry.
 *
 * The template asks for them and tells the model to write "(none)" rather than
 * drop one, but a request is not a guarantee. A summary missing `Next Move` or
 * `Active` still parses as markdown and still commits, and the work then resumes
 * with no statement of what was in progress — which is the whole reason
 * compaction exists. Checking the headings is the only part of the contract that
 * is cheap enough to verify on every compaction.
 */
var REQUIRED_SUMMARY_SECTIONS = [
    "## Objective",
    "## Important Details",
    "## Work State",
    "### Completed",
    "### Active",
    "### Blocked",
    "## Next Move",
    "## Relevant Files",
];
/** The required sections a summary is missing, in template order. */
function missingSummarySections(summary) {
    return REQUIRED_SUMMARY_SECTIONS.filter(function (heading) { return !summary.includes(heading); });
}
/**
 * Below this a summary is treated as a failed generation rather than a
 * successful one.
 *
 * A one-line summary of a hundred-thousand-token span throws away everything
 * compaction was supposed to preserve, and nothing downstream can tell it apart
 * from a good one — the context is simply gone.
 */
exports.MIN_SUMMARY_CHARS = 200;
/**
 * How many times a summary that fails the contract is regenerated.
 *
 * Exported because it bounds the cost of a compaction: a summary that cannot be
 * made valid costs this many provider calls before the compaction fails.
 */
exports.SUMMARY_ATTEMPTS = 2;
function assertSummaryContract(summary) {
    var missing = missingSummarySections(summary);
    if (missing.length > 0)
        throw new Error("compaction summary is missing required sections: ".concat(missing.join(", ")));
    if (summary.length < exports.MIN_SUMMARY_CHARS)
        throw new Error("compaction summary is too short to carry the compacted span " +
            "(".concat(summary.length, " chars, minimum ").concat(exports.MIN_SUMMARY_CHARS, ")"));
}
function providerCompactor(provider, signal) {
    return {
        compact: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var instruction, systemContent, requestMessages, lastError, attempt, summary, _a, _b, _c, chunk, e_1_1, trimmed;
                var _d, e_1, _e, _f;
                var _g, _h, _j, _k;
                return __generator(this, function (_l) {
                    switch (_l.label) {
                        case 0:
                            instruction = [
                                "Summarize this Natalia agent session for durable context compaction.",
                                "Keep user goals, decisions, file/tool facts, unresolved tasks, and rollback-relevant state.",
                                "If the entries contain an earlier summary, update that anchor: retain still-true details, remove stale details, and merge newer facts.",
                                "When combining a prior summary with newer entries:",
                                "- Carry forward objectives, constraints, user directives, decisions, and parallel workstreams from the prior summary even when the newer entries do not mention them. Drop only what is finished and no longer needed.",
                                "- The newer entries are more recent than the prior summary. Where they conflict, the newer entries win: state the corrected fact and drop the old claim.",
                                "- Move completed work from Active to Completed.",
                                "- If a blocker has been resolved, update the summary to reflect that while keeping any details still needed to continue.",
                                "- Update Objective and Next Move to reflect the current work state.",
                                "Preserve exact file paths, symbols, commands, errors, URLs, and identifiers. Do not invent facts or mention the compaction process.",
                                COMPACTION_SUMMARY_TEMPLATE,
                                input.instruction
                                    ? "Extra instruction: ".concat(input.instruction)
                                    : undefined,
                                // The workspace's standing preference, after the caller's direction and
                                // before the span: it qualifies what to keep, not what to summarize.
                                input.userInstruction
                                    ? "The user of this workspace also requires: ".concat(input.userInstruction)
                                    : undefined,
                                input.resources.length
                                    ? "Active resources:\n".concat(input.resources.join("\n"))
                                    : undefined,
                            ]
                                .filter(Boolean)
                                .join("\n\n");
                            systemContent = (_j = (_h = (_g = input.prefixMessages) === null || _g === void 0 ? void 0 : _g.find(function (message) { return message.role === "system"; })) === null || _h === void 0 ? void 0 : _h.content) !== null && _j !== void 0 ? _j : "You compact long coding-agent context into a faithful, concise operational summary. Do not invent facts.";
                            requestMessages = __spreadArray(__spreadArray(__spreadArray([], ((_k = input.prefixMessages) !== null && _k !== void 0 ? _k : []), true), input.messages, true), [
                                { role: "user", content: instruction },
                            ], false);
                            attempt = 1;
                            _l.label = 1;
                        case 1:
                            if (!(attempt <= exports.SUMMARY_ATTEMPTS)) return [3 /*break*/, 15];
                            signal === null || signal === void 0 ? void 0 : signal.throwIfAborted();
                            summary = "";
                            _l.label = 2;
                        case 2:
                            _l.trys.push([2, 7, 8, 13]);
                            _a = true, _b = (e_1 = void 0, __asyncValues(provider.stream({
                                messages: requestMessages,
                                signal: signal,
                            })));
                            _l.label = 3;
                        case 3: return [4 /*yield*/, _b.next()];
                        case 4:
                            if (!(_c = _l.sent(), _d = _c.done, !_d)) return [3 /*break*/, 6];
                            _f = _c.value;
                            _a = false;
                            chunk = _f;
                            if (chunk.type === "content")
                                summary += chunk.text;
                            _l.label = 5;
                        case 5:
                            _a = true;
                            return [3 /*break*/, 3];
                        case 6: return [3 /*break*/, 13];
                        case 7:
                            e_1_1 = _l.sent();
                            e_1 = { error: e_1_1 };
                            return [3 /*break*/, 13];
                        case 8:
                            _l.trys.push([8, , 11, 12]);
                            if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 10];
                            return [4 /*yield*/, _e.call(_b)];
                        case 9:
                            _l.sent();
                            _l.label = 10;
                        case 10: return [3 /*break*/, 12];
                        case 11:
                            if (e_1) throw e_1.error;
                            return [7 /*endfinally*/];
                        case 12: return [7 /*endfinally*/];
                        case 13:
                            trimmed = summary.trim();
                            if (!trimmed) {
                                lastError = new Error("provider compactor returned empty summary");
                                return [3 /*break*/, 14];
                            }
                            try {
                                assertSummaryContract(trimmed);
                                return [2 /*return*/, { summary: trimmed }];
                            }
                            catch (error) {
                                // A summary that drops a required section or is too short to carry
                                // the span is a failed generation, so it is regenerated rather than
                                // committed: the context it replaces cannot be recovered.
                                lastError = error;
                            }
                            _l.label = 14;
                        case 14:
                            attempt += 1;
                            return [3 /*break*/, 1];
                        case 15: throw lastError;
                    }
                });
            });
        },
    };
}
function compactContext(ledger, compactor, options) {
    return __awaiter(this, void 0, void 0, function () {
        var snapshot, expectedRevision, _a, preserved, compactedEntries, hasRange, retained, beforeTokens, started, attempts, onEvent, result, content, shadowedTokens, summaryTokens, summary, afterTokens, error_1, provider;
        var _this = this;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        return __generator(this, function (_v) {
            switch (_v.label) {
                case 0:
                    if (options.enabled === false &&
                        !options.force &&
                        options.trigger !== "manual") {
                        return [2 /*return*/, { compacted: false, skipped: "disabled" }];
                    }
                    snapshot = ledger.snapshot();
                    expectedRevision = ledger.surfaceRevision();
                    _a = (0, context_1.selectCompactableRange)(snapshot.entries, __assign(__assign({}, (options.preservedRecentTokens === undefined
                        ? {}
                        : { recentTokens: options.preservedRecentTokens })), { recentMessages: options.preservedRecentMessages })), preserved = _a.preserved, compactedEntries = _a.compactable, hasRange = _a.hasRange;
                    if (!hasRange)
                        return [2 /*return*/, { compacted: false, skipped: "nothing_to_compact" }];
                    retained = preserved.filter(function (entry) { return entry.role !== "resource"; });
                    beforeTokens = (_b = options.beforeTokens) !== null && _b !== void 0 ? _b : ledger.effectiveTokens();
                    started = (_d = (_c = options.now) === null || _c === void 0 ? void 0 : _c.call(options)) !== null && _d !== void 0 ? _d : new Date();
                    (_e = options.onEvent) === null || _e === void 0 ? void 0 : _e.call(options, {
                        type: "compaction.begin",
                        id: options.id,
                        trigger: options.trigger,
                        beforeTokens: beforeTokens,
                        maxTokens: options.maxTokens,
                        thresholdPercent: options.thresholdPercent,
                        reservedTokens: options.reservedTokens,
                        instruction: options.instruction,
                        attempt: 1,
                        startedAt: started.toISOString(),
                    });
                    attempts = 1;
                    onEvent = function (event) {
                        var _a;
                        if (event.type === "step.retry" && event.operation === "compaction")
                            attempts = event.attempt;
                        (_a = options.onEvent) === null || _a === void 0 ? void 0 : _a.call(options, event);
                    };
                    _v.label = 1;
                case 1:
                    _v.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, retry_1.runWithRetry)({ id: options.id, operation: "compaction", step: 0 }, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, compactor.compact(__assign(__assign({ 
                                        // The span as the provider will see it, with oversized tool results
                                        // bounded first so the summarizer is not handed a span the request
                                        // never carried.
                                        messages: (0, provider_1.contextEntriesToProviderMessages)(compactedEntries.map(function (entry) { return (0, context_1.largeToolResultContext)(entry); })), instruction: options.instruction }, (options.prefixMessages
                                        ? { prefixMessages: options.prefixMessages }
                                        : {})), { 
                                        // Active resources are re-injected as live entries after compaction;
                                        // summarizing them too would show the model stale duplicate state.
                                        resources: [] }))];
                            });
                        }); }, __assign(__assign({}, options.retry), { onEvent: onEvent }))];
                case 2:
                    result = _v.sent();
                    if (ledger.surfaceRevision() !== expectedRevision) {
                        (_f = options.onEvent) === null || _f === void 0 ? void 0 : _f.call(options, {
                            type: "compaction.end",
                            id: options.id,
                            trigger: options.trigger,
                            success: false,
                            beforeTokens: beforeTokens,
                            durationMs: Math.max(0, ((_h = (_g = options.now) === null || _g === void 0 ? void 0 : _g.call(options)) !== null && _h !== void 0 ? _h : new Date()).getTime() - started.getTime()),
                            attempts: attempts,
                            error: "surface_changed",
                        });
                        return [2 /*return*/, { compacted: false, skipped: "surface_changed" }];
                    }
                    content = buildCompactionPrompt(result.summary, options.instruction);
                    shadowedTokens = compactedEntries.reduce(function (sum, entry) { var _a; return sum + ((_a = entry.tokens) !== null && _a !== void 0 ? _a : (0, context_1.estimateTokens)(entry.content)); }, 0);
                    summaryTokens = (_j = result.tokens) !== null && _j !== void 0 ? _j : (0, context_1.estimateTokens)(content);
                    if (summaryTokens >= shadowedTokens) {
                        // Reported rather than thrown: the caller's next step still has to go out,
                        // and an oversized request fails there with a context-limit error that
                        // names the real problem. Throwing instead would take the turn down
                        // without that diagnostic. The begin already went out, so the end has to
                        // pair with it.
                        (_k = options.onEvent) === null || _k === void 0 ? void 0 : _k.call(options, {
                            type: "compaction.end",
                            id: options.id,
                            trigger: options.trigger,
                            success: false,
                            beforeTokens: beforeTokens,
                            durationMs: Math.max(0, ((_m = (_l = options.now) === null || _l === void 0 ? void 0 : _l.call(options)) !== null && _m !== void 0 ? _m : new Date()).getTime() - started.getTime()),
                            attempts: attempts,
                            error: "summary is not smaller than the span it replaces (".concat(summaryTokens, " >= ").concat(shadowedTokens, " tokens)"),
                        });
                        return [2 /*return*/, {
                                compacted: false,
                                skipped: "no_shrink",
                                shadowedTokens: shadowedTokens,
                                summaryTokens: summaryTokens,
                            }];
                    }
                    summary = {
                        id: "".concat(options.id, ":summary"),
                        role: "summary",
                        content: content,
                        tokens: summaryTokens,
                    };
                    ledger.replaceAfterCompaction(summary, retained, undefined, expectedRevision);
                    afterTokens = ledger.effectiveTokens();
                    (_o = options.onEvent) === null || _o === void 0 ? void 0 : _o.call(options, {
                        type: "compaction.end",
                        id: options.id,
                        trigger: options.trigger,
                        success: true,
                        beforeTokens: beforeTokens,
                        afterTokens: afterTokens,
                        durationMs: Math.max(0, ((_q = (_p = options.now) === null || _p === void 0 ? void 0 : _p.call(options)) !== null && _q !== void 0 ? _q : new Date()).getTime() - started.getTime()),
                        attempts: attempts,
                    });
                    return [2 /*return*/, { compacted: true, beforeTokens: beforeTokens, afterTokens: afterTokens }];
                case 3:
                    error_1 = _v.sent();
                    ledger.restore(snapshot);
                    provider = error_1;
                    (_r = options.onEvent) === null || _r === void 0 ? void 0 : _r.call(options, {
                        type: "compaction.end",
                        id: options.id,
                        trigger: options.trigger,
                        success: false,
                        beforeTokens: beforeTokens,
                        durationMs: Math.max(0, ((_t = (_s = options.now) === null || _s === void 0 ? void 0 : _s.call(options)) !== null && _t !== void 0 ? _t : new Date()).getTime() - started.getTime()),
                        attempts: attempts,
                        error: (_u = provider.kind) !== null && _u !== void 0 ? _u : "compaction_failed",
                    });
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function recoverContextLimitOnce(input) {
    return __awaiter(this, void 0, void 0, function () {
        var maxRetries, retries, error_2, compacted;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    maxRetries = Math.max(0, Math.floor((_a = input.maxOverflowRetries) !== null && _a !== void 0 ? _a : 1));
                    retries = 0;
                    _d.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 7];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, input.runStep()];
                case 3: return [2 /*return*/, _d.sent()];
                case 4:
                    error_2 = _d.sent();
                    if (!(error_2 instanceof Error) ||
                        error_2.kind !== "context_limit")
                        throw error_2;
                    if (retries >= maxRetries)
                        throw (0, errors_1.providerError)({
                            kind: "context_limit",
                            message: "context-limit recovery retries exhausted (".concat(retries, ")"),
                            cause: error_2,
                        });
                    retries += 1;
                    (_b = input.onEvent) === null || _b === void 0 ? void 0 : _b.call(input, {
                        type: "context.limit.recovery",
                        id: input.id,
                        step: input.step,
                        attempted: true,
                        compacted: false,
                        reason: "context_limit",
                    });
                    return [4 /*yield*/, compactContext(input.ledger, input.compactor, __assign(__assign({}, input.compact), { trigger: "context_limit", force: true, onEvent: input.onEvent }))];
                case 5:
                    compacted = _d.sent();
                    (_c = input.onEvent) === null || _c === void 0 ? void 0 : _c.call(input, {
                        type: "context.limit.recovery",
                        id: input.id,
                        step: input.step,
                        attempted: true,
                        compacted: compacted.compacted,
                        reason: "context_limit",
                    });
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 1];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function buildCompactionPrompt(summary, instruction) {
    return [
        "Natalia compacted context summary:",
        instruction ? "User compaction instruction: ".concat(instruction) : undefined,
        summary,
    ]
        .filter(Boolean)
        .join("\n\n");
}
