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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var provider_concurrency_1 = require("../src/provider-concurrency");
(0, bun_test_1.test)("a provider without a configured cap is unlimited", function () { return __awaiter(void 0, void 0, void 0, function () {
    var limiter, release;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                limiter = new provider_concurrency_1.ProviderConcurrencyLimiter({});
                (0, bun_test_1.expect)(limiter.capFor("openai")).toBe(Infinity);
                return [4 /*yield*/, limiter.acquire("openai")];
            case 1:
                release = _a.sent();
                return [4 /*yield*/, limiter.acquire("openai")];
            case 2:
                _a.sent();
                return [4 /*yield*/, limiter.acquire("openai")];
            case 3:
                _a.sent();
                release();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the cap queues excess requests and releases them in order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var limiter, order, a, b, thirdStarted, third, thirdRelease;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                limiter = new provider_concurrency_1.ProviderConcurrencyLimiter({ deepseek: 2 });
                order = [];
                return [4 /*yield*/, limiter.acquire("deepseek")];
            case 1:
                a = _a.sent();
                return [4 /*yield*/, limiter.acquire("deepseek")];
            case 2:
                b = _a.sent();
                thirdStarted = false;
                third = limiter.acquire("deepseek").then(function (release) {
                    thirdStarted = true;
                    return release;
                });
                (0, bun_test_1.expect)(thirdStarted).toBe(false);
                a();
                return [4 /*yield*/, third];
            case 3:
                thirdRelease = _a.sent();
                (0, bun_test_1.expect)(thirdStarted).toBe(true);
                (0, bun_test_1.expect)(limiter.activeCount("deepseek")).toBe(2);
                b();
                thirdRelease();
                (0, bun_test_1.expect)(limiter.activeCount("deepseek")).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("per-provider caps are independent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var limiter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                limiter = new provider_concurrency_1.ProviderConcurrencyLimiter({ deepseek: 1, openai: 3 });
                return [4 /*yield*/, limiter.acquire("deepseek")];
            case 1:
                _a.sent();
                // deepseek is full but openai still has 3 slots.
                return [4 /*yield*/, limiter.acquire("openai")];
            case 2:
                // deepseek is full but openai still has 3 slots.
                _a.sent();
                return [4 /*yield*/, limiter.acquire("openai")];
            case 3:
                _a.sent();
                return [4 /*yield*/, limiter.acquire("openai")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(limiter.activeCount("deepseek")).toBe(1);
                (0, bun_test_1.expect)(limiter.activeCount("openai")).toBe(3);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("withProviderConcurrency holds the slot for the whole stream", function () { return __awaiter(void 0, void 0, void 0, function () {
    function stream() {
        return __asyncGenerator(this, arguments, function stream_1() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await(1)];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await(2)];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var limiter, out, _a, _b, _c, value, e_1_1;
    var _d, e_1, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                limiter = new provider_concurrency_1.ProviderConcurrencyLimiter({ test: 1 });
                out = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_concurrency_1.withProviderConcurrency)(limiter, "test", stream));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                value = _f;
                out.push(value);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_1_1 = _g.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_1) throw e_1.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(out).toEqual([1, 2]);
                // The slot was released after the stream ended.
                (0, bun_test_1.expect)(limiter.activeCount("test")).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a cancelled queued request never acquires a provider slot", function () { return __awaiter(void 0, void 0, void 0, function () {
    var limiter, release, controller, queued;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                limiter = new provider_concurrency_1.ProviderConcurrencyLimiter({ test: 1 });
                return [4 /*yield*/, limiter.acquire("test")];
            case 1:
                release = _a.sent();
                controller = new AbortController();
                queued = limiter.acquire("test", controller.signal);
                controller.abort();
                return [4 /*yield*/, (0, bun_test_1.expect)(queued).rejects.toMatchObject({ name: "AbortError" })];
            case 2:
                _a.sent();
                release();
                (0, bun_test_1.expect)(limiter.activeCount("test")).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
