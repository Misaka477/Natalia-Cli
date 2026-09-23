"use strict";
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
var bun_test_1 = require("bun:test");
var fixtures_1 = require("./fixtures");
var src_1 = require("../src");
var noSleep = function (_ms) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, undefined];
}); }); };
(0, bun_test_1.test)("provider adapter maps status codes to typed error kinds without string contains", function () {
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(408)).toBe("timeout");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(429)).toBe("rate_limit");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(500)).toBe("server");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(502)).toBe("server");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(503)).toBe("server");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(504)).toBe("server");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(401)).toBe("auth");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(403)).toBe("auth");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(400)).toBe("invalid_request");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(404)).toBe("invalid_request");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(422)).toBe("invalid_request");
    (0, bun_test_1.expect)((0, src_1.providerErrorFromHttp)({
        statusCode: 400,
        bodyCode: "context_length_exceeded",
    }).kind).toBe("context_limit");
});
(0, bun_test_1.test)("retry policy retries only transient provider-neutral kinds", function () {
    for (var _i = 0, _a = [
        "timeout",
        "connection",
        "empty_response",
        "rate_limit",
        "server",
    ]; _i < _a.length; _i++) {
        var kind = _a[_i];
        (0, bun_test_1.expect)((0, src_1.shouldRetryProviderError)((0, src_1.providerError)({ kind: kind, message: kind }))).toBe(true);
    }
    for (var _b = 0, _c = [
        "auth",
        "invalid_request",
        "context_limit",
        "cancel",
    ]; _b < _c.length; _b++) {
        var kind = _c[_b];
        (0, bun_test_1.expect)((0, src_1.shouldRetryProviderError)((0, src_1.providerError)({ kind: kind, message: kind }))).toBe(false);
    }
});
(0, bun_test_1.test)("backoff uses exponential jitter and bounded retry-after", function () {
    (0, bun_test_1.expect)((0, src_1.retryDelayMs)((0, src_1.providerError)({ kind: "timeout", message: "timeout" }), 1, undefined, function () { return 0; })).toBe(300);
    (0, bun_test_1.expect)((0, src_1.retryDelayMs)((0, src_1.providerError)({ kind: "timeout", message: "timeout" }), 2, undefined, function () { return 1; })).toBe(1101);
    (0, bun_test_1.expect)((0, src_1.retryDelayMs)((0, src_1.providerError)({ kind: "rate_limit", message: "429", retryAfterMs: 9000 }), 1)).toBe(5000);
    (0, bun_test_1.expect)((0, src_1.parseRetryAfterMs)("2")).toBe(2000);
    (0, bun_test_1.expect)((0, src_1.parseRetryAfterMilliseconds)("1250")).toBe(1250);
    (0, bun_test_1.expect)((0, src_1.providerErrorFromHttp)({
        statusCode: 429,
        retryAfter: "8",
        retryAfterMs: "1250",
    }).retryAfterMs).toBe(1250);
});
(0, bun_test_1.test)("cancellation interrupts retry backoff without another attempt", function () { return __awaiter(void 0, void 0, void 0, function () {
    var controller, attempts, events, running;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                controller = new AbortController();
                attempts = 0;
                events = [];
                running = (0, src_1.runWithRetry)({ id: "turn_cancel_backoff", operation: "llm_step", step: 1 }, function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        attempts++;
                        throw (0, src_1.providerError)({ kind: "server", message: "temporarily down" });
                    });
                }); }, {
                    signal: controller.signal,
                    timer: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, new Promise(function () { return undefined; })];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); },
                    random: function () { return 0; },
                    onEvent: function (event) { return events.push(event); },
                });
                return [4 /*yield*/, Bun.sleep(5)];
            case 1:
                _a.sent();
                controller.abort(new Error("user cancelled"));
                return [4 /*yield*/, (0, bun_test_1.expect)(running).rejects.toMatchObject({ kind: "cancel" })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(attempts).toBe(1);
                (0, bun_test_1.expect)(events.map(function (event) { return event.type; })).toEqual([
                    "step.retry",
                    "step.retry.exhausted",
                ]);
                (0, bun_test_1.expect)(events.at(-1)).toMatchObject({ reason: "cancel", retryable: false });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("N timeout attempts then success emit StepRetry and clear banner", function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, waits, events, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                provider = new fixtures_1.FakeRetryProvider(fixtures_1.retryScenarios.timeoutThenSuccess);
                waits = [];
                events = [];
                return [4 /*yield*/, runFakeScenario(provider, {
                        timer: function (ms) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                waits.push(ms);
                                return [2 /*return*/];
                            });
                        }); },
                        random: function () { return 0; },
                        onEvent: function (event) { return events.push(event.type); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual(["final"]);
                (0, bun_test_1.expect)(provider.attempts).toBe(3);
                (0, bun_test_1.expect)(waits).toEqual([300, 600]);
                (0, bun_test_1.expect)(events).toEqual(["step.retry", "step.retry", "step.retry.cleared"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("transient failures retry beyond the old attempt budget by default", function () { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, retries, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                attempts = 0;
                retries = [];
                return [4 /*yield*/, (0, src_1.runWithRetry)({ id: "turn_unlimited", operation: "llm_step", step: 1 }, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                        var attempt = _b.attempt, maxAttempts = _b.maxAttempts;
                        return __generator(this, function (_c) {
                            attempts = attempt;
                            (0, bun_test_1.expect)(maxAttempts).toBeNull();
                            if (attempt < 6)
                                throw (0, src_1.providerError)({ kind: "server", message: "temporarily down" });
                            return [2 /*return*/, "recovered"];
                        });
                    }); }, {
                        timer: noSleep,
                        random: function () { return 0; },
                        onEvent: function (event) {
                            if (event.type === "step.retry")
                                retries.push(event.maxAttempts);
                        },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBe("recovered");
                (0, bun_test_1.expect)(attempts).toBe(6);
                (0, bun_test_1.expect)(retries).toEqual([null, null, null, null, null]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("connection, 429, 503, empty and Retry-After fixtures retry", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _loop_1, _i, _a, _b, name_1, scenario;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _loop_1 = function (name_1, scenario) {
                    var provider, waits, result;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                provider = new fixtures_1.FakeRetryProvider(scenario);
                                waits = [];
                                return [4 /*yield*/, runFakeScenario(provider, {
                                        timer: function (ms) { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                waits.push(ms);
                                                return [2 /*return*/];
                                            });
                                        }); },
                                        random: function () { return 0; },
                                    })];
                            case 1:
                                result = _d.sent();
                                (0, bun_test_1.expect)(result.length, name_1).toBe(1);
                                (0, bun_test_1.expect)(provider.attempts, name_1).toBe(2);
                                if (name_1 === "rateLimitRetryAfter")
                                    (0, bun_test_1.expect)(waits).toEqual([1200]);
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, _a = Object.entries({
                    connectionThenSuccess: fixtures_1.retryScenarios.connectionThenSuccess,
                    rateLimitRetryAfter: fixtures_1.retryScenarios.rateLimitRetryAfter,
                    server503ThenSuccess: fixtures_1.retryScenarios.server503ThenSuccess,
                    emptyThenSuccess: fixtures_1.retryScenarios.emptyThenSuccess,
                });
                _c.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                _b = _a[_i], name_1 = _b[0], scenario = _b[1];
                return [5 /*yield**/, _loop_1(name_1, scenario)];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("think-only abnormal failed attempt transient content does not commit", function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, committed, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                provider = new fixtures_1.FakeRetryProvider(fixtures_1.retryScenarios.thinkOnlyThenSuccess);
                committed = [];
                return [4 /*yield*/, runFakeScenario(provider, {
                        onCommit: function (chunk) { return committed.push(chunk); },
                        timer: noSleep,
                        random: function () { return 0; },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual(["clean final"]);
                (0, bun_test_1.expect)(committed).toEqual(["clean final"]);
                (0, bun_test_1.expect)(committed).not.toContain("hidden failed thought");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("cancel, auth, invalid request and context limit do not retry", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _loop_2, _i, _a, kind;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _loop_2 = function (kind) {
                    var events;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                events = [];
                                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.runWithRetry)({ id: "turn_".concat(kind), operation: "llm_step", step: 1 }, function () { return __awaiter(void 0, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            throw (0, src_1.providerError)({ kind: kind, message: "".concat(kind, " secret-token") });
                                        });
                                    }); }, { timer: noSleep, onEvent: function (event) { return events.push(event.type); } })).rejects.toMatchObject({ kind: kind })];
                            case 1:
                                _c.sent();
                                (0, bun_test_1.expect)(events).toEqual(["step.retry.exhausted"]);
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, _a = [
                    "cancel",
                    "auth",
                    "invalid_request",
                    "context_limit",
                ];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                kind = _a[_i];
                return [5 /*yield**/, _loop_2(kind)];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("attempt exhausted emits redacted summary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, messages;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                provider = new fixtures_1.FakeRetryProvider(fixtures_1.retryScenarios.exhausted);
                messages = [];
                return [4 /*yield*/, (0, bun_test_1.expect)(runFakeScenario(provider, {
                        policy: { maxAttemptsPerStep: 3 },
                        timer: noSleep,
                        random: function () { return 0; },
                        onEvent: function (event) {
                            if (event.type === "step.retry.exhausted")
                                messages.push(event.message);
                        },
                    })).rejects.toMatchObject({ kind: "timeout" })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(provider.attempts).toBe(3);
                (0, bun_test_1.expect)(messages).toEqual(["timeout"]);
                (0, bun_test_1.expect)(messages.join(" ")).not.toContain("secret");
                return [2 /*return*/];
        }
    });
}); });
function runFakeScenario(provider_1) {
    return __awaiter(this, arguments, void 0, function (provider, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, src_1.runStreamingWithRetry)({ id: "turn_retry", operation: "llm_step", step: 1 }, function (_attempt, emitTransient) { return __awaiter(_this, void 0, void 0, function () {
                    var outcome;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, provider.complete(emitTransient)];
                            case 1:
                                outcome = _a.sent();
                                if (outcome.type === "error")
                                    throw toProviderError(outcome);
                                if (outcome.type === "think-only") {
                                    throw (0, src_1.providerError)({
                                        kind: "empty_response",
                                        message: "think-only abnormal response",
                                    });
                                }
                                return [2 /*return*/, outcome.chunks];
                        }
                    });
                }); }, options)];
        });
    });
}
function toProviderError(outcome) {
    var _a;
    return (0, src_1.providerError)({
        kind: outcome.kind,
        statusCode: outcome.statusCode,
        retryAfterMs: outcome.retryAfterMs,
        message: (_a = outcome.message) !== null && _a !== void 0 ? _a : outcome.kind,
    });
}
(0, bun_test_1.test)("billing failures are classified as quota rather than invalid requests", function () {
    // DeepSeek answers 402 with this body; OpenAI answers 429 with a quota code.
    (0, bun_test_1.expect)((0, src_1.providerErrorFromHttp)({ statusCode: 402, message: "Insufficient Balance" })
        .kind).toBe("quota");
    (0, bun_test_1.expect)((0, src_1.providerErrorFromHttp)({
        statusCode: 429,
        bodyCode: "insufficient_quota",
        message: "You exceeded your current quota",
    }).kind).toBe("quota");
    // A spent balance is final, so it must not consume the retry budget.
    (0, bun_test_1.expect)((0, src_1.shouldRetryProviderError)((0, src_1.providerErrorFromHttp)({
        statusCode: 402,
        message: "Insufficient Balance",
    }))).toBe(false);
    // A plain rate limit still retries.
    (0, bun_test_1.expect)((0, src_1.shouldRetryProviderError)((0, src_1.providerErrorFromHttp)({ statusCode: 429, message: "slow down" }))).toBe(true);
});
(0, bun_test_1.test)("an unrecognized status is reported as unknown, not as a bad request", function () {
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(418)).toBe("unknown");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(451)).toBe("unknown");
    // Claiming the request was invalid asserted a cause that was not established.
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(400)).toBe("invalid_request");
    (0, bun_test_1.expect)((0, src_1.mapHttpStatusToErrorKind)(503)).toBe("server");
});
