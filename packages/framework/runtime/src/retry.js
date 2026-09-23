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
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRetryPolicy = void 0;
exports.shouldRetryProviderError = shouldRetryProviderError;
exports.retryDelayMs = retryDelayMs;
exports.runWithRetry = runWithRetry;
exports.runStreamingWithRetry = runStreamingWithRetry;
var errors_1 = require("./errors");
exports.defaultRetryPolicy = {
    maxAttemptsPerStep: null,
    initialBackoffMs: 300,
    maxBackoffMs: 5000,
    jitterMs: 500,
    maxRetryAfterMs: 5000,
};
function shouldRetryProviderError(error) {
    if (error.kind === "timeout")
        return true;
    if (error.kind === "connection")
        return true;
    if (error.kind === "empty_response")
        return true;
    if (error.kind === "rate_limit")
        return true;
    if (error.kind === "server")
        return true;
    return false;
}
function retryDelayMs(error, retryIndex, policy, random) {
    if (policy === void 0) { policy = exports.defaultRetryPolicy; }
    if (random === void 0) { random = Math.random; }
    var retryAfter = error.retryAfterMs;
    if (retryAfter !== undefined)
        return Math.min(retryAfter, policy.maxRetryAfterMs);
    var exponential = policy.initialBackoffMs * Math.pow(2, Math.max(0, retryIndex - 1));
    var base = Math.min(exponential, policy.maxBackoffMs);
    var jitter = policy.jitterMs > 0 ? Math.floor(random() * (policy.jitterMs + 1)) : 0;
    return Math.min(base + jitter, policy.maxBackoffMs);
}
function runWithRetry(context_1, fn_1) {
    return __awaiter(this, arguments, void 0, function (context, fn, options) {
        var policy, timer, random, attempt, result, error_1, cancelled, providerError_1, canRetry, exhausted, waitMs, error_2, cancelled;
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    policy = __assign(__assign({}, exports.defaultRetryPolicy), options.policy);
                    timer = (_a = options.timer) !== null && _a !== void 0 ? _a : (function (ms) { return Bun.sleep(ms); });
                    random = (_b = options.random) !== null && _b !== void 0 ? _b : Math.random;
                    attempt = 1;
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 3, , 8]);
                    throwIfAborted(options.signal);
                    return [4 /*yield*/, fn({
                            attempt: attempt,
                            maxAttempts: policy.maxAttemptsPerStep,
                        })];
                case 2:
                    result = _j.sent();
                    if (attempt > 1) {
                        (_c = options.onEvent) === null || _c === void 0 ? void 0 : _c.call(options, {
                            type: "step.retry.cleared",
                            id: context.id,
                            operation: context.operation,
                            step: context.step,
                            attempts: attempt,
                        });
                    }
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _j.sent();
                    if ((_d = options.signal) === null || _d === void 0 ? void 0 : _d.aborted) {
                        cancelled = cancellationError(options.signal);
                        if (attempt > 1)
                            (_e = options.onEvent) === null || _e === void 0 ? void 0 : _e.call(options, {
                                type: "step.retry.exhausted",
                                id: context.id,
                                operation: context.operation,
                                step: context.step,
                                attempts: attempt,
                                maxAttempts: policy.maxAttemptsPerStep,
                                reason: cancelled.kind,
                                retryable: false,
                                message: (0, errors_1.redactedProviderMessage)(cancelled),
                            });
                        throw cancelled;
                    }
                    providerError_1 = (0, errors_1.asProviderError)(error_1);
                    canRetry = shouldRetryProviderError(providerError_1);
                    exhausted = policy.maxAttemptsPerStep !== null &&
                        attempt >= policy.maxAttemptsPerStep;
                    if (!canRetry || exhausted) {
                        (_f = options.onEvent) === null || _f === void 0 ? void 0 : _f.call(options, {
                            type: "step.retry.exhausted",
                            id: context.id,
                            operation: context.operation,
                            step: context.step,
                            attempts: attempt,
                            maxAttempts: policy.maxAttemptsPerStep,
                            reason: providerError_1.kind,
                            retryable: canRetry,
                            statusCode: providerError_1.statusCode,
                            message: (0, errors_1.redactedProviderMessage)(providerError_1),
                        });
                        throw providerError_1;
                    }
                    waitMs = retryDelayMs(providerError_1, attempt, policy, random);
                    (_g = options.onEvent) === null || _g === void 0 ? void 0 : _g.call(options, {
                        type: "step.retry",
                        id: context.id,
                        operation: context.operation,
                        step: context.step,
                        attempt: attempt + 1,
                        maxAttempts: policy.maxAttemptsPerStep,
                        waitMs: waitMs,
                        reason: providerError_1.kind,
                        statusCode: providerError_1.statusCode,
                    });
                    _j.label = 4;
                case 4:
                    _j.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, waitForRetry(waitMs, timer, options.signal)];
                case 5:
                    _j.sent();
                    return [3 /*break*/, 7];
                case 6:
                    error_2 = _j.sent();
                    cancelled = (0, errors_1.asProviderError)(error_2);
                    (_h = options.onEvent) === null || _h === void 0 ? void 0 : _h.call(options, {
                        type: "step.retry.exhausted",
                        id: context.id,
                        operation: context.operation,
                        step: context.step,
                        attempts: attempt,
                        maxAttempts: policy.maxAttemptsPerStep,
                        reason: cancelled.kind,
                        retryable: false,
                        statusCode: cancelled.statusCode,
                        message: (0, errors_1.redactedProviderMessage)(cancelled),
                    });
                    throw cancelled;
                case 7: return [3 /*break*/, 8];
                case 8:
                    attempt++;
                    return [3 /*break*/, 1];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function waitForRetry(waitMs, timer, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var abort;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!signal) return [3 /*break*/, 2];
                    return [4 /*yield*/, timer(waitMs)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    throwIfAborted(signal);
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, , 5, 6]);
                    return [4 /*yield*/, Promise.race([
                            timer(waitMs),
                            new Promise(function (_resolve, reject) {
                                abort = function () { return reject(cancellationError(signal)); };
                                signal.addEventListener("abort", abort, { once: true });
                            }),
                        ])];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    if (abort)
                        signal.removeEventListener("abort", abort);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function throwIfAborted(signal) {
    if (signal === null || signal === void 0 ? void 0 : signal.aborted)
        throw cancellationError(signal);
}
function cancellationError(signal) {
    return (0, errors_1.providerError)({
        kind: "cancel",
        message: "provider request cancelled",
        cause: signal.reason,
    });
}
function runStreamingWithRetry(context_1, fn_1) {
    return __awaiter(this, arguments, void 0, function (context, fn, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, runWithRetry(context, function (attempt) { return __awaiter(_this, void 0, void 0, function () {
                    var transient, committed, output, _i, output_1, chunk;
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                transient = [];
                                return [4 /*yield*/, fn(attempt, function (chunk) { return transient.push(chunk); })];
                            case 1:
                                committed = _b.sent();
                                output = committed.length ? committed : transient;
                                for (_i = 0, output_1 = output; _i < output_1.length; _i++) {
                                    chunk = output_1[_i];
                                    (_a = options.onCommit) === null || _a === void 0 ? void 0 : _a.call(options, chunk, attempt.attempt);
                                }
                                return [2 /*return*/, output];
                        }
                    });
                }); }, options)];
        });
    });
}
