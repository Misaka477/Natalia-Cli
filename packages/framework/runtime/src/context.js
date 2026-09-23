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
exports.ContextLedger = exports.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS = void 0;
exports.estimateTokens = estimateTokens;
exports.compactionTrigger = compactionTrigger;
exports.decideCompaction = decideCompaction;
exports.contextThresholdTokens = contextThresholdTokens;
exports.assertContextBudgetInvariants = assertContextBudgetInvariants;
exports.selectCompactableRange = selectCompactableRange;
exports.resolveReservedOutputTokens = resolveReservedOutputTokens;
exports.contextStatusEvent = contextStatusEvent;
exports.contextStatusBuckets = contextStatusBuckets;
exports.preserveRecentWithToolPairs = preserveRecentWithToolPairs;
exports.preserveRecentTail = preserveRecentTail;
exports.preserveRecentWithToolPairsByTokens = preserveRecentWithToolPairsByTokens;
exports.pruneToolResultEntry = pruneToolResultEntry;
exports.largeToolResultContext = largeToolResultContext;
exports.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS = {
    thresholdChars: 8192,
    headChars: 4096,
    tailChars: 1024,
    protectRecentEntries: 1,
};
var ContextLedger = /** @class */ (function () {
    function ContextLedger() {
        this.entries = [];
        this.resources = [];
        this.journalOffset = 0;
        this.compactionGeneration = 0;
        this.revision = 0;
    }
    /** Monotonic entry-surface revision used to detect concurrent appends. */
    ContextLedger.prototype.surfaceRevision = function () {
        return this.revision;
    };
    ContextLedger.prototype.add = function (entry) {
        var _a;
        this.entries.push(__assign(__assign({}, entry), { tokens: (_a = entry.tokens) !== null && _a !== void 0 ? _a : estimateTokens(entry.content) }));
        this.journalOffset += 1;
        this.revision += 1;
    };
    ContextLedger.prototype.addMany = function (entries) {
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var entry = entries_1[_i];
            this.add(entry);
        }
    };
    ContextLedger.prototype.addResource = function (resource) {
        this.resources = this.resources.filter(function (item) { return item.id !== resource.id; });
        this.resources.push(resource);
        this.add({
            id: "resource:".concat(resource.id),
            role: "resource",
            content: "".concat(resource.kind, ":").concat(resource.id, " ").concat(resource.summary),
        });
    };
    ContextLedger.prototype.recordProviderUsage = function (inputTokens, outputTokens) {
        this.checkpoint = {
            messageCount: this.entries.length,
            tokens: inputTokens + outputTokens,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            source: "provider_usage",
        };
        this.journalOffset += 1;
    };
    ContextLedger.prototype.effectiveTokens = function () {
        if (!this.checkpoint)
            return this.entries.reduce(function (sum, entry) { var _a; return sum + ((_a = entry.tokens) !== null && _a !== void 0 ? _a : 0); }, 0);
        var pending = this.entries
            .slice(this.checkpoint.messageCount)
            .reduce(function (sum, entry) { var _a; return sum + ((_a = entry.tokens) !== null && _a !== void 0 ? _a : 0); }, 0);
        return this.checkpoint.tokens + pending;
    };
    /**
     * Deterministically trims old large tool results in-place before a provider
     * request. Journal events remain untouched; only this live ledger surface is
     * replaced, and the exact provider checkpoint is degraded to an estimate
     * because the prior usage no longer describes this transformed surface.
     */
    ContextLedger.prototype.pruneToolResults = function (options) {
        if (options === void 0) { options = {}; }
        var resolved = __assign(__assign({}, exports.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS), options);
        var beforeTokens = this.effectiveTokens();
        var protect = Math.max(0, Math.floor(resolved.protectRecentEntries));
        var cutoff = Math.max(0, this.entries.length - protect);
        var pruned = 0;
        this.entries = this.entries.map(function (entry, index) {
            if (index >= cutoff)
                return entry;
            var candidate = pruneToolResultEntry(entry, resolved);
            if (candidate !== entry)
                pruned += 1;
            return candidate;
        });
        if (!pruned)
            return { pruned: 0, beforeTokens: beforeTokens, afterTokens: beforeTokens };
        var tokens = this.entries.reduce(function (sum, entry) { var _a; return sum + ((_a = entry.tokens) !== null && _a !== void 0 ? _a : estimateTokens(entry.content)); }, 0);
        this.checkpoint = {
            messageCount: this.entries.length,
            tokens: tokens,
            source: "estimate",
        };
        this.revision += 1;
        return {
            pruned: pruned,
            beforeTokens: beforeTokens,
            afterTokens: this.effectiveTokens(),
        };
    };
    ContextLedger.prototype.status = function (input) {
        var _a;
        var used = this.effectiveTokens();
        var trigger = compactionTrigger({
            used: used,
            max: input.max,
            thresholdPercent: input.thresholdPercent,
            reserved: input.reserved,
        });
        return {
            used: used,
            max: input.max,
            source: ((_a = this.checkpoint) === null || _a === void 0 ? void 0 : _a.source) === "provider_usage" &&
                this.entries.length === this.checkpoint.messageCount
                ? "exact_checkpoint"
                : "pending_estimate",
            thresholdPercent: input.thresholdPercent,
            reserved: input.reserved,
            trigger: trigger,
        };
    };
    ContextLedger.prototype.snapshot = function () {
        return {
            entries: this.entries.map(function (entry) { return (__assign({}, entry)); }),
            checkpoint: this.checkpoint ? __assign({}, this.checkpoint) : undefined,
            resources: this.resources.map(function (resource) { return (__assign({}, resource)); }),
        };
    };
    ContextLedger.prototype.durableCheckpoint = function (step) {
        return __assign(__assign({}, this.snapshot()), { journalOffset: this.journalOffset, step: step, tokenEstimate: this.effectiveTokens(), compactionGeneration: this.compactionGeneration });
    };
    ContextLedger.prototype.restore = function (snapshot) {
        this.entries = snapshot.entries.map(function (entry) { return (__assign({}, entry)); });
        this.checkpoint = snapshot.checkpoint
            ? __assign({}, snapshot.checkpoint) : undefined;
        this.resources = snapshot.resources.map(function (resource) { return (__assign({}, resource)); });
        if ("journalOffset" in snapshot &&
            typeof snapshot.journalOffset === "number")
            this.journalOffset = snapshot.journalOffset;
        else
            this.journalOffset = this.entries.length;
        if ("compactionGeneration" in snapshot &&
            typeof snapshot.compactionGeneration === "number")
            this.compactionGeneration = snapshot.compactionGeneration;
        this.revision += 1;
    };
    ContextLedger.prototype.restoreDurableCheckpoint = function (checkpoint) {
        this.restore(checkpoint);
        this.journalOffset = checkpoint.journalOffset;
        this.compactionGeneration = checkpoint.compactionGeneration;
    };
    ContextLedger.prototype.journalStatus = function () {
        return {
            journalOffset: this.journalOffset,
            messageCount: this.entries.length,
            tokenEstimate: this.effectiveTokens(),
            compactionGeneration: this.compactionGeneration,
        };
    };
    ContextLedger.prototype.replaceAfterCompaction = function (summary, preserved, estimatedTokens, expectedRevision) {
        var _a, _b, _c;
        if (expectedRevision !== undefined && this.revision !== expectedRevision)
            throw new Error("context surface changed during compaction");
        // A leading system entry is the agent's own prompt, not conversation. The
        // main runner re-unshifts it after compaction but the subagent path rebuilds
        // straight from the ledger, so it has to survive here or the subagent loses
        // its instructions and nothing fails loudly. It is re-inserted ahead of the
        // summary unless the preserved tail already starts with it, so a tail that
        // covers the whole ledger does not gain a duplicate.
        var systemHead = ((_a = this.entries[0]) === null || _a === void 0 ? void 0 : _a.role) === "system" &&
            ((_b = preserved[0]) === null || _b === void 0 ? void 0 : _b.role) !== "system" &&
            ((_c = preserved[0]) === null || _c === void 0 ? void 0 : _c.id) !== this.entries[0].id
            ? [this.entries[0]]
            : [];
        this.entries = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], systemHead, true), [
            summary
        ], false), preserved, true), this.resources.map(resourceToContextEntry), true);
        this.checkpoint = {
            messageCount: this.entries.length,
            tokens: estimatedTokens !== null && estimatedTokens !== void 0 ? estimatedTokens : this.entries.reduce(function (sum, entry) { var _a; return sum + ((_a = entry.tokens) !== null && _a !== void 0 ? _a : 0); }, 0),
            source: "estimate",
        };
        this.compactionGeneration += 1;
        this.journalOffset += 1;
        this.revision += 1;
    };
    return ContextLedger;
}());
exports.ContextLedger = ContextLedger;
function estimateTokens(text) {
    return Math.max(1, Math.ceil(Array.from(text).length / 4));
}
function compactionTrigger(input) {
    if (input.used >= Math.floor((input.max * input.thresholdPercent) / 100))
        return "ratio";
    if (input.used + input.reserved >= input.max)
        return "reserved";
    return undefined;
}
/**
 * Pure preflight decision shared by the main, subagent, Navi and Nia paths.
 * `requestTokens` is the measured full request (header + surface); `headerTokens`
 * and `surfaceTokens` describe the canonical three-bucket envelope. The decision
 * never re-derives a budget: it only compares against `max`, `reserved` and
 * `thresholdPercent`, and refuses to summarize when `hasCompactableRange` is
 * false instead of inventing a MIN_COMPACTABLE_TOKENS guard.
 */
function decideCompaction(input) {
    var overRatio = input.requestTokens >=
        Math.floor((input.max * input.thresholdPercent) / 100);
    var overReserved = input.requestTokens + input.reserved >= input.max;
    if (!overRatio && !overReserved)
        return "none";
    if (!input.hasCompactableRange)
        return "nothing_to_compact";
    return overRatio ? "ratio" : "reserved";
}
/** The compaction boundary in tokens: the ratio of the window. */
function contextThresholdTokens(budget) {
    return Math.floor((budget.max * budget.thresholdPercent) / 100);
}
/**
 * Config-time invariant: `preservedRecentTokens` must sit below the compaction
 * threshold. Otherwise the preserved tail can never satisfy the trigger and
 * every step would compact in vain — fail fast instead of spinning.
 * `0` disables the absolute tail budget, so it is always valid.
 */
function assertContextBudgetInvariants(budget) {
    if (budget.preservedRecentTokens <= 0)
        return;
    var threshold = contextThresholdTokens(budget);
    if (budget.preservedRecentTokens >= threshold)
        throw new Error("invalid context budget: preservedRecentTokens (".concat(budget.preservedRecentTokens, ") ") +
            "must stay below the compaction threshold (".concat(threshold, " tokens = ") +
            "".concat(budget.thresholdPercent, "% of ").concat(budget.max, "); lower the preserved tail ") +
            "or raise context.compactionThresholdPercent");
}
/**
 * Split a ledger surface into the preserved recent suffix (with tool pairs
 * closed) and the compactable prefix. This is the single source of truth for
 * "is there anything to compact", shared by the decision and the summarizer so
 * they can never disagree about the compactable range.
 */
function selectCompactableRange(entries, options) {
    var _a;
    // Both constraints apply, and the tail is whichever reaches further back: a
    // message count cannot say how much context a turn holds, and a token budget
    // cannot say "always keep the last few exchanges".
    var preserved = preserveRecentTail(entries, {
        recentMessages: options.recentMessages,
        recentTokens: options.recentTokens,
    });
    var preservedIDs = new Set(preserved.map(function (entry) { return entry.id; }));
    // The leading system entry is the agent's own prompt and is never compacted:
    // a compaction that could swallow it would let the next one try again on the
    // same head, which is what made an early version of this settle only after
    // several passes.
    var systemHeadID = ((_a = entries[0]) === null || _a === void 0 ? void 0 : _a.role) === "system" ? entries[0].id : undefined;
    var compactable = entries.filter(function (entry) {
        return entry.role !== "resource" &&
            !preservedIDs.has(entry.id) &&
            entry.id !== systemHeadID;
    });
    var hasRange = compactable.length > 0 &&
        !compactable.every(function (entry) { return entry.role === "summary"; });
    return { preserved: preserved, compactable: compactable, hasRange: hasRange };
}
function resolveReservedOutputTokens(input) {
    if (typeof input.configuredReserved === "number") {
        return {
            tokens: input.configuredReserved,
            source: "config",
            diagnostic: "explicit context.reservedOutputTokens",
        };
    }
    if (input.explicitMaxOutputTokens && input.explicitMaxOutputTokens > 0) {
        return {
            tokens: input.explicitMaxOutputTokens,
            source: "explicit_output",
            diagnostic: "explicit model.maxOutputTokens",
        };
    }
    if (input.providerOutputLimit && input.providerOutputLimit > 0) {
        return {
            tokens: input.providerOutputLimit,
            source: "provider_metadata",
            diagnostic: "provider output metadata",
        };
    }
    if (input.catalogOutputLimit && input.catalogOutputLimit > 0) {
        return {
            tokens: input.catalogOutputLimit,
            source: "catalog",
            diagnostic: "known model output catalog",
        };
    }
    var tokens = Math.min(20000, Math.max(4096, Math.floor(input.contextWindow * 0.1)));
    return {
        tokens: tokens,
        source: "fallback_formula",
        diagnostic: "conservative formula min(20000,max(4096,context*0.1))",
    };
}
function contextStatusEvent(status) {
    return __assign({ type: "context.status" }, status);
}
/**
 * Builds the three-bucket view for a context.status event from a TokenMeter
 * projection, so `used` stays the legacy message face while `surfaceTokens`,
 * `requestTokens`, `headerTokens`, `systemTokens` and `toolsTokens` expose the
 * canonical system / tools / messages accounting. Returns undefined until the
 * request envelope has been measured at least once for that scope.
 */
function contextStatusBuckets(projection) {
    var systemTokens = projection.systemTokens, toolsTokens = projection.toolsTokens, messageTokens = projection.messageTokens;
    if (systemTokens === undefined ||
        toolsTokens === undefined ||
        messageTokens === undefined)
        return undefined;
    var headerTokens = systemTokens + toolsTokens;
    return {
        surfaceTokens: messageTokens,
        requestTokens: headerTokens + messageTokens,
        headerTokens: headerTokens,
        systemTokens: systemTokens,
        toolsTokens: toolsTokens,
    };
}
function closeToolPairs(entries, preserved) {
    var pairIDs = new Set(preserved.map(function (entry) { return entry.pairID; }).filter(Boolean));
    var seenPairRoles = new Set();
    var missingPairs = entries.filter(function (entry) {
        if (!entry.pairID || !pairIDs.has(entry.pairID))
            return false;
        if (preserved.some(function (item) { return item.id === entry.id; }))
            return false;
        // A malformed ledger can contain two calls or two results for one pair.
        // Close each side at most once so the rebuilt provider request never has a
        // duplicate tool_call_id.
        var key = "".concat(entry.pairID, ":").concat(entry.role);
        if (seenPairRoles.has(key))
            return false;
        seenPairRoles.add(key);
        return true;
    });
    return __spreadArray(__spreadArray([], missingPairs, true), preserved, true);
}
function preserveRecentWithToolPairs(entries, recentCount) {
    return closeToolPairs(entries, entries.slice(Math.max(0, entries.length - recentCount)));
}
/** Index of the first entry a count-based tail would keep. */
function countBasedStart(entries, recentCount) {
    return Math.max(0, entries.length - Math.max(0, recentCount));
}
/**
 * Index of the first entry a token-budget tail would keep.
 *
 * At least the newest entry is always kept, even when it alone exceeds the
 * budget, so compaction never drops the context of the step being prepared.
 */
function tokenBasedStart(entries, tokenBudget) {
    var _a;
    if (tokenBudget <= 0)
        return entries.length;
    var start = entries.length;
    var tokens = 0;
    for (var index = entries.length - 1; index >= 0; index -= 1) {
        var entry = entries[index];
        var entryTokens = (_a = entry.tokens) !== null && _a !== void 0 ? _a : estimateTokens(entry.content);
        if (start < entries.length && tokens + entryTokens > tokenBudget)
            break;
        tokens += entryTokens;
        start = index;
    }
    return start;
}
/**
 * Index of the first entry to keep so the tail ends with a user message.
 *
 * A tail made only of assistant replies and tool exchanges leaves the model
 * with no statement of what the user currently wants, and Anthropic accepts
 * such a request, so nothing fails loudly — the work simply drifts. Reaching
 * back to the last user message costs a bounded number of older entries.
 *
 * Only ever moves the start earlier, never trims a tail the other constraints
 * already produced.
 */
function userMessageStart(entries, from) {
    for (var index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].role !== "user")
            continue;
        // Already inside the tail: leave the count and token constraints alone.
        // Only a tail with no user message reaches further back.
        return index >= from ? from : index;
    }
    // The ledger holds no user message at all, so there is nothing to reach.
    return from;
}
/**
 * Retain the newest suffix that satisfies every constraint, keeping whichever
 * reaches furthest back.
 *
 * A count and a token budget are **unions, not alternatives**: a message count
 * cannot express how much context a turn holds, and a token budget cannot
 * express "always keep the last few exchanges". Taking the earlier of the two
 * start indices means each constraint is a floor, and the tail is whichever the
 * two imply.
 */
function preserveRecentTail(entries, options) {
    var _a, _b;
    var base = Math.min(countBasedStart(entries, (_a = options.recentMessages) !== null && _a !== void 0 ? _a : 0), tokenBasedStart(entries, (_b = options.recentTokens) !== null && _b !== void 0 ? _b : 0));
    var withUser = userMessageStart(entries, base);
    // Reaching back must not consume the whole compactable range: compaction that
    // never fires grows the context without bound, which is the failure this tail
    // exists to prevent. When the tail would have to swallow everything to gain a
    // user message, it goes without — the summary replacing the compacted region
    // carries the user's intent, so the tail is not left without it.
    var start = withUser > 0 ? withUser : base;
    return closeToolPairs(entries, entries.slice(start));
}
/**
 * Retains the newest suffix that fits a token budget. At least the newest
 * entry is retained even when it alone exceeds the budget, so compaction never
 * drops the current step's context. Tool-call/result pairs are closed after the
 * budget cut, which may add a bounded number of older entries.
 */
function preserveRecentWithToolPairsByTokens(entries, tokenBudget) {
    if (tokenBudget <= 0)
        return [];
    return closeToolPairs(entries, entries.slice(tokenBasedStart(entries, tokenBudget)));
}
var TOOL_RESULT_PRUNE_MARKER = "tool result truncated for context";
function pruneToolResultEntry(entry, options) {
    if (options === void 0) { options = exports.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS; }
    if (entry.role !== "tool_result" ||
        entry.content.length <= options.thresholdChars ||
        entry.content.includes(TOOL_RESULT_PRUNE_MARKER))
        return entry;
    var head = entry.content.slice(0, options.headChars);
    var tail = entry.content.slice(-options.tailChars);
    var omittedChars = entry.content.length - head.length - tail.length;
    var content = "".concat(head, "\n\n[").concat(TOOL_RESULT_PRUNE_MARKER, "; originalChars=").concat(entry.content.length, "; omittedChars=").concat(omittedChars, "]\n\n").concat(tail);
    if (content.length >= entry.content.length)
        return entry;
    return __assign(__assign({}, entry), { content: content, tokens: undefined });
}
function largeToolResultContext(entry, maxInlineChars) {
    var _a;
    if (maxInlineChars === void 0) { maxInlineChars = 2000; }
    if (entry.role !== "tool_result" || entry.content.length <= maxInlineChars)
        return entry;
    var head = entry.content.slice(0, Math.floor(maxInlineChars / 2));
    var tail = entry.content.slice(-Math.floor(maxInlineChars / 2));
    return __assign(__assign({}, entry), { content: "".concat(head, "\n\n[tool result stored as artifact ").concat((_a = entry.artifactRef) !== null && _a !== void 0 ? _a : entry.id, "; totalChars=").concat(entry.content.length, "]\n\n").concat(tail), tokens: undefined });
}
function resourceToContextEntry(resource) {
    return {
        id: "resource:".concat(resource.id),
        role: "resource",
        content: "".concat(resource.kind, ":").concat(resource.id, " ").concat(resource.summary),
    };
}
