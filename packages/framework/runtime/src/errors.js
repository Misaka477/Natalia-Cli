"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderError = void 0;
exports.providerError = providerError;
exports.asProviderError = asProviderError;
exports.mapHttpStatusToErrorKind = mapHttpStatusToErrorKind;
exports.providerErrorFromHttp = providerErrorFromHttp;
exports.parseRetryAfterMilliseconds = parseRetryAfterMilliseconds;
exports.parseRetryAfterMs = parseRetryAfterMs;
exports.redactedProviderMessage = redactedProviderMessage;
var ProviderError = /** @class */ (function (_super) {
    __extends(ProviderError, _super);
    function ProviderError(input) {
        var _this = _super.call(this, input.message) || this;
        _this.name = "ProviderError";
        _this.kind = input.kind;
        _this.statusCode = input.statusCode;
        _this.retryAfterMs = input.retryAfterMs;
        _this.cause = input.cause;
        return _this;
    }
    return ProviderError;
}(Error));
exports.ProviderError = ProviderError;
function providerError(input) {
    return new ProviderError(input);
}
function asProviderError(error) {
    if (error instanceof ProviderError)
        return error;
    if (error instanceof DOMException && error.name === "AbortError") {
        return providerError({
            kind: "timeout",
            message: "provider request timed out",
            cause: error,
        });
    }
    return providerError({
        kind: "connection",
        message: "provider connection failed",
        cause: error,
    });
}
function mapHttpStatusToErrorKind(statusCode) {
    if (statusCode === 408)
        return "timeout";
    if (statusCode === 429)
        return "rate_limit";
    if (statusCode === 402)
        return "quota";
    if ([500, 502, 503, 504].includes(statusCode))
        return "server";
    if (statusCode === 401 || statusCode === 403)
        return "auth";
    if ([400, 404, 422].includes(statusCode))
        return "invalid_request";
    // Anything else below 500 is not known to be the caller's fault. Reporting it
    // as an invalid request asserted something untrue about the request, which
    // made a billing failure read like a malformed call.
    return statusCode >= 500 ? "server" : "unknown";
}
/**
 * Providers disagree on how a spent balance arrives: some answer 402, others
 * 429 with a quota code, so the body has to be consulted as well as the status.
 */
function isQuotaError(bodyCode, message) {
    if (bodyCode === "insufficient_quota" ||
        bodyCode === "insufficient_balance" ||
        bodyCode === "billing_hard_limit_reached")
        return true;
    return /insufficient[_ -]?(?:quota|balance|credit)|quota[_ -]?exceeded|exceeded[^.]*\bquota\b|out of credit|billing/iu.test(message !== null && message !== void 0 ? message : "");
}
function providerErrorFromHttp(input) {
    var _a, _b, _c;
    var kind = isContextLimitError(input.bodyCode, input.message)
        ? "context_limit"
        : isQuotaError(input.bodyCode, input.message)
            ? "quota"
            : mapHttpStatusToErrorKind(input.statusCode);
    return providerError({
        kind: kind,
        statusCode: input.statusCode,
        retryAfterMs: (_a = parseRetryAfterMilliseconds(input.retryAfterMs)) !== null && _a !== void 0 ? _a : parseRetryAfterMs(input.retryAfter),
        message: (_c = (_b = input.message) !== null && _b !== void 0 ? _b : input.statusText) !== null && _c !== void 0 ? _c : "provider HTTP ".concat(input.statusCode),
    });
}
function parseRetryAfterMilliseconds(value) {
    if (!value)
        return undefined;
    var milliseconds = Number(value);
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
        return undefined;
    return Math.round(milliseconds);
}
function isContextLimitError(bodyCode, message) {
    if (bodyCode === "context_length_exceeded")
        return true;
    return /context[_ -]?(length|limit)|maximum context|too many tokens/iu.test(message !== null && message !== void 0 ? message : "");
}
function parseRetryAfterMs(value, now) {
    if (now === void 0) { now = Date.now(); }
    if (!value)
        return undefined;
    var seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0)
        return Math.round(seconds * 1000);
    var date = Date.parse(value);
    if (!Number.isFinite(date))
        return undefined;
    return Math.max(0, date - now);
}
function redactedProviderMessage(error) {
    return "".concat(error.kind).concat(error.statusCode ? " (".concat(error.statusCode, ")") : "");
}
