"use strict";
/**
 * Per-endpoint capability declarations, and the single rule that resolves them.
 *
 * The rule: **a capability is on only when the endpoint declares it on.** There
 * are no adapter-level defaults that turn something on. The asymmetry decides
 * it — an undeclared capability that stays off costs one unused optimisation,
 * while one that is wrongly assumed on makes every request fail with a 400 from
 * a parameter the deployment never accepted. Guessing from a model id or a base
 * URL is exactly how that happens.
 *
 * The one thing not gated here is each format's own native caching mechanism:
 * `cache_control` on the Anthropic system block is part of the Messages spec, so
 * the adapter emits it the way it emits `stream: true`. Everything below is an
 * optional extension layered on top of a format, and every one of those is
 * gated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CACHE_RETENTION = void 0;
exports.resolveEndpointCapabilities = resolveEndpointCapabilities;
exports.anthropicCacheControl = anthropicCacheControl;
/**
 * Resolve declared capabilities into definite values.
 *
 * Every flag defaults to `false` and every string to `undefined`, so a caller
 * that reads the resolved value never has to remember which fields are optional
 * and what an absent one means. Spreading an undeclared object is therefore
 * equivalent to declaring nothing, which is the safe case.
 */
function resolveEndpointCapabilities(declared) {
    var _a, _b, _c, _d, _e;
    return {
        supportsLongCacheRetention: (_a = declared === null || declared === void 0 ? void 0 : declared.supportsLongCacheRetention) !== null && _a !== void 0 ? _a : false,
        supportsCacheControlOnTools: (_b = declared === null || declared === void 0 ? void 0 : declared.supportsCacheControlOnTools) !== null && _b !== void 0 ? _b : false,
        sendSessionAffinityHeaders: (_c = declared === null || declared === void 0 ? void 0 : declared.sendSessionAffinityHeaders) !== null && _c !== void 0 ? _c : false,
        sessionAffinityFormat: declared === null || declared === void 0 ? void 0 : declared.sessionAffinityFormat,
        supportsPromptCacheKey: (_d = declared === null || declared === void 0 ? void 0 : declared.supportsPromptCacheKey) !== null && _d !== void 0 ? _d : false,
        promptCacheKeyField: declared === null || declared === void 0 ? void 0 : declared.promptCacheKeyField,
        supportsExplicitPromptCacheMode: (_e = declared === null || declared === void 0 ? void 0 : declared.supportsExplicitPromptCacheMode) !== null && _e !== void 0 ? _e : false,
    };
}
/** Default retention: the provider's own short window. */
exports.DEFAULT_CACHE_RETENTION = "short";
/**
 * The cache-control marker to send, or `undefined` to send none.
 *
 * `none` opts out entirely — a legitimate choice when diagnosing whether the
 * cache is what is slow. `long` is only honoured when the endpoint declared it
 * accepts long retention; otherwise it degrades to `short` rather than sending a
 * `ttl` the deployment rejects.
 */
function anthropicCacheControl(input) {
    if (input.retention === "none")
        return undefined;
    if (input.retention === "long" && input.supportsLongCacheRetention)
        return { type: "ephemeral", ttl: "1h" };
    return { type: "ephemeral" };
}
