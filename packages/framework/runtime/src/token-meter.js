"use strict";
/**
 * Shared request/surface token accounting used by compaction and context UI.
 *
 * The estimator is intentionally simple and deterministic: four characters per
 * token plus small structural overhead. Provider usage, when available, anchors
 * the current request; surface movement since that sample is repriced with the
 * same heuristic so compaction and context occupancy stay on one account.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenMeter = exports.TOKEN_METER_IMAGE_UNKNOWN_TOKENS = exports.TOKEN_METER_IMAGE_PIXELS_PER_TOKEN = exports.TOKEN_METER_ROLE_OVERHEAD = exports.TOKEN_METER_BLOCK_OVERHEAD = exports.TOKEN_METER_CHARS_PER_TOKEN = void 0;
exports.requestHeaderKey = requestHeaderKey;
exports.estimateTokenText = estimateTokenText;
exports.estimateMeterMessage = estimateMeterMessage;
exports.estimateVisualInput = estimateVisualInput;
exports.TOKEN_METER_CHARS_PER_TOKEN = 4;
exports.TOKEN_METER_BLOCK_OVERHEAD = 4;
exports.TOKEN_METER_ROLE_OVERHEAD = 4;
/**
 * Pixels per token for vision input, from the providers' published vision
 * accounting (Anthropic bills roughly width × height / 750). A meter that
 * ignored dimensions entirely would read a 5 MiB screenshot as zero and never
 * fire compaction, which is the bug this exists to fix.
 */
exports.TOKEN_METER_IMAGE_PIXELS_PER_TOKEN = 750;
/**
 * Assumed cost of one image whose dimensions are unknown.
 *
 * Sits above the largest image that can reach the meter after admission-time
 * scaling: with the default 1568px long-edge limit the maximum area is
 * 1568² ≈ 2.46 MP, which prices at ~3.3k tokens. A constant below that would
 * price a dimension-less image cheaper than a known large one, which is the
 * under-counting this whole estimator exists to prevent. Unknown dimensions are
 * the legacy inline-attachment path; scaled attachments always carry theirs.
 */
exports.TOKEN_METER_IMAGE_UNKNOWN_TOKENS = 4096;
/**
 * Stable identity of a request header (system + tools). Both `recordUsage` and
 * `measureRequest` derive this from the same envelope so a provider usage
 * sample is only reused when the header it priced is still current, and the
 * system prompt is never double-counted between header and messages.
 */
function requestHeaderKey(input) {
    var _a, _b;
    return JSON.stringify({
        system: (_a = input.system) !== null && _a !== void 0 ? _a : "",
        tools: (_b = input.tools) !== null && _b !== void 0 ? _b : null,
    });
}
function estimateTokenText(text) {
    if (text.length === 0)
        return 0;
    return Math.ceil(Array.from(text).length / exports.TOKEN_METER_CHARS_PER_TOKEN);
}
function estimateUnknown(value) {
    var _a;
    if (value === undefined || value === null)
        return 0;
    if (typeof value === "string")
        return estimateTokenText(value);
    try {
        return estimateTokenText((_a = JSON.stringify(value)) !== null && _a !== void 0 ? _a : "");
    }
    catch (_b) {
        return 0;
    }
}
function estimateToolCalls(calls) {
    var tokens = 0;
    for (var _i = 0, _a = calls !== null && calls !== void 0 ? calls : []; _i < _a.length; _i++) {
        var call = _a[_i];
        tokens += estimateUnknown(call.id);
        tokens += estimateUnknown(call.name);
        tokens += estimateUnknown(call.arguments);
        tokens += exports.TOKEN_METER_BLOCK_OVERHEAD;
    }
    return tokens;
}
function estimateContentBlocks(blocks) {
    var tokens = 0;
    for (var _i = 0, blocks_1 = blocks; _i < blocks_1.length; _i++) {
        var block = blocks_1[_i];
        if (block === null || block === undefined)
            continue;
        if (typeof block === "string") {
            tokens += estimateTokenText(block) + exports.TOKEN_METER_BLOCK_OVERHEAD;
            continue;
        }
        var record = block;
        if (record.type === "text" && typeof record.text === "string") {
            tokens += estimateTokenText(record.text) + exports.TOKEN_METER_BLOCK_OVERHEAD;
            continue;
        }
        if (record.type === "reasoning" && typeof record.text === "string") {
            tokens += estimateTokenText(record.text) + exports.TOKEN_METER_BLOCK_OVERHEAD;
            continue;
        }
        if (record.type === "tool-call") {
            tokens +=
                estimateUnknown(record.name) + estimateUnknown(record.arguments);
            tokens += exports.TOKEN_METER_BLOCK_OVERHEAD;
            continue;
        }
        if (record.type === "tool-result") {
            tokens += estimateContentBlocks(Array.isArray(record.content) ? record.content : []);
            tokens += exports.TOKEN_METER_BLOCK_OVERHEAD;
            continue;
        }
        tokens += exports.TOKEN_METER_BLOCK_OVERHEAD + estimateUnknown(record);
    }
    return tokens;
}
function estimateMeterMessage(message) {
    var tokens = exports.TOKEN_METER_ROLE_OVERHEAD;
    if (typeof message.content === "string") {
        tokens += estimateTokenText(message.content);
    }
    else if (Array.isArray(message.content)) {
        tokens += estimateContentBlocks(message.content);
    }
    tokens += estimateToolCalls(message.toolCalls);
    tokens += estimateUnknown(message.toolName);
    tokens += estimateUnknown(message.toolCallID);
    tokens += estimateVisualInput(message.images);
    tokens += estimateVisualInput(message.videos);
    return tokens;
}
/**
 * Price one message's image/video attachments by their published vision
 * accounting rather than their byte length.
 *
 * Without this a message carrying attachments costs only its text: the
 * compaction trigger reads the request total, so a session that accumulates
 * screenshots never compacts and eventually exceeds the real context window.
 *
 * There is deliberately no per-image ceiling. Attachment admission already
 * bounds the pixel count, and a ceiling below that bound under-counts — a
 * 1568px image (the post-scaling maximum) is ~2k tokens, and a GIF, which is
 * never scaled, can reach the full admission budget. Under-counting is the
 * failure this function exists to prevent, so the formula is allowed to run.
 */
function estimateVisualInput(attachments) {
    if (!(attachments === null || attachments === void 0 ? void 0 : attachments.length))
        return 0;
    var tokens = 0;
    for (var _i = 0, attachments_1 = attachments; _i < attachments_1.length; _i++) {
        var attachment = attachments_1[_i];
        tokens += exports.TOKEN_METER_BLOCK_OVERHEAD;
        var width = attachment.width;
        var height = attachment.height;
        if (typeof width !== "number" ||
            typeof height !== "number" ||
            width <= 0 ||
            height <= 0) {
            tokens += exports.TOKEN_METER_IMAGE_UNKNOWN_TOKENS;
            continue;
        }
        tokens += Math.ceil((width * height) / exports.TOKEN_METER_IMAGE_PIXELS_PER_TOKEN);
    }
    return tokens;
}
function usageTotal(usage) {
    var _a, _b;
    return (usage.inputTokens +
        usage.outputTokens +
        ((_a = usage.cacheReadInputTokens) !== null && _a !== void 0 ? _a : 0) +
        ((_b = usage.cacheCreationInputTokens) !== null && _b !== void 0 ? _b : 0));
}
function promptPressure(usage) {
    var _a, _b;
    return (usage.inputTokens +
        ((_a = usage.cacheReadInputTokens) !== null && _a !== void 0 ? _a : 0) +
        ((_b = usage.cacheCreationInputTokens) !== null && _b !== void 0 ? _b : 0));
}
/** Per-scope replay-aware request/surface token account. */
var TokenMeter = /** @class */ (function () {
    function TokenMeter() {
        this.states = new Map();
    }
    /** Estimate one provider message with the shared fixed heuristic. */
    TokenMeter.prototype.estimateMessage = function (message) {
        return estimateMeterMessage(message);
    };
    /** Estimate a complete request without mutating the scope's sampled anchor. */
    TokenMeter.prototype.estimateRequest = function (input) {
        var _a;
        return (estimateTokenText((_a = input.system) !== null && _a !== void 0 ? _a : "") +
            estimateUnknown(input.tools) +
            this.estimateMessages(input.messages));
    };
    /** Estimate only the model-visible message/tool surface. */
    TokenMeter.prototype.estimateMessages = function (messages) {
        var tokens = 0;
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            tokens += estimateMeterMessage(message);
        }
        return tokens;
    };
    /** Record the latest observed surface without changing provider usage. */
    TokenMeter.prototype.observeSurface = function (scope, messages) {
        var state = this.state(scope);
        state.surfaceTokens = this.estimateMessages(messages);
        return state.surfaceTokens;
    };
    /** Record the current route/model capacity for one scope. */
    TokenMeter.prototype.setContextWindow = function (scope, contextWindow) {
        var state = this.state(scope);
        if (contextWindow === undefined || contextWindow <= 0) {
            state.contextWindow = undefined;
            return;
        }
        state.contextWindow = contextWindow;
    };
    /**
     * Record the exact provider usage sample of the request identified by
     * `headerKey` and `surfaceTokens`. Headers must match before usage is reused
     * by measureRequest; the projected view still carries the sample forward.
     */
    TokenMeter.prototype.recordUsage = function (scope, usage, options) {
        var _a;
        var state = this.state(scope);
        state.usage = __assign({}, usage);
        state.pressureTokens = promptPressure(usage);
        state.sampledSurfaceTokens = (_a = options === null || options === void 0 ? void 0 : options.surfaceTokens) !== null && _a !== void 0 ? _a : state.surfaceTokens;
        state.sampledHeaderKey = options === null || options === void 0 ? void 0 : options.headerKey;
    };
    /**
     * Measure the request about to be sent for compaction.
     *
     * Exact provider usage is reused only when the sample's canonical header is
     * still current and its total is at least the current heuristic price. That
     * mirrors DSH's conservative anchor rule: stale or smaller samples never
     * make compaction believe the request is cheaper than the local estimate.
     */
    TokenMeter.prototype.measureRequest = function (scope, envelope) {
        var _a;
        var state = this.state(scope);
        state.surfaceTokens = this.estimateMessages(envelope.messages);
        if (envelope.contextWindow !== undefined)
            this.setContextWindow(scope, envelope.contextWindow);
        var systemTokens = estimateTokenText((_a = envelope.system) !== null && _a !== void 0 ? _a : "");
        var toolsTokens = estimateUnknown(envelope.tools);
        var headerTokens = systemTokens + toolsTokens;
        var estimatedTotal = headerTokens + state.surfaceTokens;
        var headerKey = requestHeaderKey(envelope);
        state.lastBuckets = { systemTokens: systemTokens, toolsTokens: toolsTokens };
        var exact = state.usage !== undefined &&
            state.sampledHeaderKey !== undefined &&
            state.sampledHeaderKey === headerKey
            ? usageTotal(state.usage)
            : undefined;
        var useProviderUsage = exact !== undefined && exact >= estimatedTotal;
        return __assign(__assign(__assign(__assign({ systemTokens: systemTokens, toolsTokens: toolsTokens, messageTokens: state.surfaceTokens, headerTokens: headerTokens, totalTokens: useProviderUsage ? exact : estimatedTotal }, (state.pressureTokens === undefined
            ? {}
            : { pressureTokens: state.pressureTokens })), (this.projectedTokens(scope) === undefined
            ? {}
            : { projectedTokens: this.projectedTokens(scope) })), (state.contextWindow === undefined
            ? {}
            : { contextWindow: state.contextWindow })), { source: useProviderUsage ? "provider_usage" : "estimate" });
    };
    /** Current UI-facing context projection for one scope. */
    TokenMeter.prototype.project = function (scope) {
        var state = this.state(scope);
        return __assign(__assign(__assign(__assign(__assign({}, (state.pressureTokens === undefined
            ? {}
            : { pressureTokens: state.pressureTokens })), (this.projectedTokens(scope) === undefined
            ? {}
            : { projectedTokens: this.projectedTokens(scope) })), (state.contextWindow === undefined
            ? {}
            : { contextWindow: state.contextWindow })), (state.lastBuckets === undefined
            ? {}
            : {
                systemTokens: state.lastBuckets.systemTokens,
                toolsTokens: state.lastBuckets.toolsTokens,
                messageTokens: state.surfaceTokens,
            })), { source: state.usage === undefined ? "estimate" : "provider_usage" });
    };
    /** Drop all per-scope accounting, e.g. after a session rollback. */
    TokenMeter.prototype.clear = function (scope) {
        if (scope === undefined)
            this.states.clear();
        else
            this.states.delete(scope);
    };
    TokenMeter.prototype.projectedTokens = function (scope) {
        var state = this.state(scope);
        if (state.pressureTokens === undefined ||
            state.sampledSurfaceTokens === undefined)
            return undefined;
        return Math.max(0, state.pressureTokens + state.surfaceTokens - state.sampledSurfaceTokens);
    };
    TokenMeter.prototype.state = function (scope) {
        var state = this.states.get(scope);
        if (state === undefined) {
            state = { surfaceTokens: 0 };
            this.states.set(scope, state);
        }
        return state;
    };
    return TokenMeter;
}());
exports.TokenMeter = TokenMeter;
