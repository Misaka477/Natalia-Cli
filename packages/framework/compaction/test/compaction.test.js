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
var context_ledger_1 = require("@natalia/context-ledger");
var retry_1 = require("@anthelia/retry");
var src_1 = require("../src");
(0, bun_test_1.test)("compaction service is constructed from retry and context-ledger dependencies", function () {
    var retry = (0, retry_1.createRetryService)({ policy: function () { return undefined; } });
    var contextLedgerFactory = (0, context_ledger_1.createContextLedgerFactory)();
    var service = (0, src_1.createCompactionService)({ retry: retry });
    (0, bun_test_1.expect)(service).toBeDefined();
    (0, bun_test_1.expect)(contextLedgerFactory.create()).toBeDefined();
});
(0, bun_test_1.test)("overflow recovery surfaces exhaustion when maxOverflowRetries is zero", function () { return __awaiter(void 0, void 0, void 0, function () {
    var retry, service, ledger, calls;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retry = (0, retry_1.createRetryService)({ policy: function () { return undefined; } });
                service = (0, src_1.createCompactionService)({ retry: retry });
                ledger = (0, context_ledger_1.createContextLedgerFactory)().create();
                ledger.add({ id: "old", role: "assistant", content: "old context" });
                calls = 0;
                return [4 /*yield*/, (0, bun_test_1.expect)(service.runWithContextLimitRecovery({
                        id: "turn-overflow",
                        step: 1,
                        compactionID: "compact-overflow",
                        ledger: ledger,
                        provider: {
                            provider: "fixture",
                            model: "fixture",
                            stream: function () {
                                return __asyncGenerator(this, arguments, function stream_1() {
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
                        budget: { max: 100, thresholdPercent: 80, reserved: 10 },
                        preservedRecentMessages: 0,
                        maxOverflowRetries: 0,
                        instruction: "",
                        runStep: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    calls += 1;
                                    throw { kind: "context_limit", message: "too long" };
                                });
                            });
                        },
                    })).rejects.toMatchObject({
                        kind: "context_limit",
                        message: bun_test_1.expect.stringContaining("retries exhausted (0)"),
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(calls).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compaction skips provider work below the configured threshold", function () { return __awaiter(void 0, void 0, void 0, function () {
    var retry, service, providerCalls, outcome;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                retry = (0, retry_1.createRetryService)({ policy: function () { return undefined; } });
                service = (0, src_1.createCompactionService)({ retry: retry });
                providerCalls = 0;
                return [4 /*yield*/, service.compactBeforeProviderStep({
                        compactionID: "compact-1",
                        ledger: (0, context_ledger_1.createContextLedgerFactory)().create(),
                        provider: {
                            provider: "fixture",
                            model: "fixture",
                            stream: function () {
                                return __asyncGenerator(this, arguments, function stream_2() {
                                    return __generator(this, function (_a) {
                                        providerCalls += 1;
                                        return [2 /*return*/];
                                    });
                                });
                            },
                        },
                        budget: { max: 1000, thresholdPercent: 80, reserved: 100 },
                        preservedRecentMessages: 4,
                        instruction: "",
                        usedTokens: 10,
                        enabled: true,
                    })];
            case 1:
                outcome = _a.sent();
                (0, bun_test_1.expect)(outcome).toEqual({ compacted: false, skipped: "nothing_to_compact" });
                (0, bun_test_1.expect)(providerCalls).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
