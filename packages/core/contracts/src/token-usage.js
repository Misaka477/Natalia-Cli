"use strict";
/**
 * Token-usage vocabulary shared by the provider runner and every usage surface.
 *
 * Anthropic reports cached traffic in fields separate from `input_tokens`, and
 * `input_tokens` itself excludes anything the cache served. A rate computed as
 * `cacheRead / inputTokens` therefore divides by the *uncached remainder* and
 * reports absurd values — 100k read against 2k fresh input reads as 5000%.
 *
 * The provider trace and the session usage bar need the same number, so the
 * formula lives here once: a surface that derives its own rate is a surface
 * that can silently disagree with every other one.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.totalInputTokens = totalInputTokens;
exports.cacheHitRate = cacheHitRate;
/** Total input-side tokens the request cost, cached traffic included. */
function totalInputTokens(usage) {
    var _a, _b;
    return (usage.inputTokens +
        ((_a = usage.cacheReadInputTokens) !== null && _a !== void 0 ? _a : 0) +
        ((_b = usage.cacheCreationInputTokens) !== null && _b !== void 0 ? _b : 0));
}
/**
 * Share of the request's input that the prefix cache served, 0..1.
 *
 * The denominator counts cache writes because they are paid for: a session
 * that writes millions of cached tokens while reading few is not a high
 * hit-rate session, and a read-only denominator would report it as one.
 * Returns 0 when the request carried no input at all.
 */
function cacheHitRate(usage) {
    var _a;
    var total = totalInputTokens(usage);
    return total > 0 ? ((_a = usage.cacheReadInputTokens) !== null && _a !== void 0 ? _a : 0) / total : 0;
}
