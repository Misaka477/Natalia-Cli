"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryDisplayLine = retryDisplayLine;
exports.providerErrorHint = providerErrorHint;
function retryDisplayLine(event) {
    var _a, _b, _c;
    if (event.type === "step.retry") {
        return "Retrying after ".concat(event.reason).concat(event.statusCode ? " (".concat(event.statusCode, ")") : "", " \u00B7 attempt ").concat(event.attempt, "/").concat((_a = event.maxAttempts) !== null && _a !== void 0 ? _a : "unlimited", " \u00B7 waiting ").concat(formatWait(event.waitMs));
    }
    if (event.type === "step.retry.cleared") {
        return "Retry recovered after ".concat(event.attempts, " attempts");
    }
    if (event.type === "step.retry.exhausted") {
        // Saying "exhausted" after one of three attempts described the wrong cause:
        // the attempt budget was never reached because the failure was final.
        var cause = event.retryable === false
            ? "Not retryable after ".concat(event.attempts, "/").concat((_b = event.maxAttempts) !== null && _b !== void 0 ? _b : "unlimited")
            : "Retry exhausted after ".concat(event.attempts, "/").concat((_c = event.maxAttempts) !== null && _c !== void 0 ? _c : "unlimited");
        var hint = providerErrorHint(event.reason);
        return "".concat(cause, ": ").concat(event.message).concat(hint ? " \u00B7 ".concat(hint) : "");
    }
    return undefined;
}
/**
 * Turns a failure kind into the next thing worth doing. The kinds themselves
 * stay free of prose so other consumers can word this differently, and a kind
 * with no useful action returns nothing rather than filler.
 */
function providerErrorHint(kind) {
    if (kind === "quota")
        return "the provider account is out of credit; top it up or switch provider with /models";
    if (kind === "auth")
        return "check the provider API key in .natalia/config.json";
    if (kind === "context_limit")
        return "the conversation is too long for this model; compact it or start a new session";
    if (kind === "rate_limit")
        return "the provider is rate limiting; retry later";
    if (kind === "connection" || kind === "timeout")
        return "check network access to the provider endpoint";
    return undefined;
}
function formatWait(ms) {
    if (ms < 1000)
        return "".concat(ms, "ms");
    return "".concat((ms / 1000).toFixed(1), "s");
}
