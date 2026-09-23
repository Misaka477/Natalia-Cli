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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderConcurrencyLimiter = void 0;
exports.withProviderConcurrency = withProviderConcurrency;
/**
 * Per-provider concurrency limiting — the fan-out ceiling.
 *
 * N parallel sub-agents each call the provider; without a cap they trip rate
 * limits (429s) and hammer the provider. This is a semaphore keyed by provider
 * id: a stream acquires a slot before starting and releases it when the stream
 * ends, so excess requests queue instead of racing. The caps are user
 * configured (`runtime.providerConcurrency`); an absent provider is unlimited.
 */
var ProviderConcurrencyLimiter = /** @class */ (function () {
    function ProviderConcurrencyLimiter(caps) {
        this.caps = caps;
        this.active = new Map();
        this.queues = new Map();
    }
    /** Acquires a slot for a provider; returns the release function. */
    ProviderConcurrencyLimiter.prototype.acquire = function (provider, signal) {
        return __awaiter(this, void 0, void 0, function () {
            var cap, active;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                            throw cancellationError();
                        cap = (_a = this.caps[provider]) !== null && _a !== void 0 ? _a : Infinity;
                        if (cap === Infinity)
                            return [2 /*return*/, function () { return undefined; }];
                        active = (_b = this.active.get(provider)) !== null && _b !== void 0 ? _b : 0;
                        if (active < cap) {
                            this.active.set(provider, active + 1);
                            return [2 /*return*/, function () { return _this.release(provider); }];
                        }
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var _a;
                                var queue = (_a = _this.queues.get(provider)) !== null && _a !== void 0 ? _a : [];
                                var waiter = { resolve: resolve, reject: reject, signal: signal };
                                waiter.abort = function () {
                                    var index = queue.indexOf(waiter);
                                    if (index >= 0)
                                        queue.splice(index, 1);
                                    reject(cancellationError());
                                };
                                queue.push(waiter);
                                _this.queues.set(provider, queue);
                                signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", waiter.abort, { once: true });
                                if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                                    waiter.abort();
                            })];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        });
    };
    /** In-flight requests for a provider. */
    ProviderConcurrencyLimiter.prototype.activeCount = function (provider) {
        var _a;
        return (_a = this.active.get(provider)) !== null && _a !== void 0 ? _a : 0;
    };
    /** The configured cap for a provider (Infinity when unlimited). */
    ProviderConcurrencyLimiter.prototype.capFor = function (provider) {
        var _a;
        return (_a = this.caps[provider]) !== null && _a !== void 0 ? _a : Infinity;
    };
    ProviderConcurrencyLimiter.prototype.release = function (provider) {
        var _this = this;
        var _a, _b, _c, _d;
        var active = ((_a = this.active.get(provider)) !== null && _a !== void 0 ? _a : 1) - 1;
        if (active <= 0)
            this.active.delete(provider);
        else
            this.active.set(provider, active);
        var queue = this.queues.get(provider);
        while (queue === null || queue === void 0 ? void 0 : queue.length) {
            var next = queue.shift();
            (_b = next.signal) === null || _b === void 0 ? void 0 : _b.removeEventListener("abort", next.abort);
            if ((_c = next.signal) === null || _c === void 0 ? void 0 : _c.aborted)
                continue;
            this.active.set(provider, ((_d = this.active.get(provider)) !== null && _d !== void 0 ? _d : 0) + 1);
            next.resolve(function () { return _this.release(provider); });
            break;
        }
        if (!(queue === null || queue === void 0 ? void 0 : queue.length))
            this.queues.delete(provider);
    };
    return ProviderConcurrencyLimiter;
}());
exports.ProviderConcurrencyLimiter = ProviderConcurrencyLimiter;
function cancellationError() {
    return new DOMException("provider request cancelled", "AbortError");
}
/**
 * Wraps a provider stream with a concurrency slot: the slot is acquired before
 * the first chunk and released when the stream ends (success or throw).
 */
function withProviderConcurrency(limiter, provider, run, signal) {
    return __asyncGenerator(this, arguments, function withProviderConcurrency_1() {
        var release;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, __await(limiter.acquire(provider, signal))];
                case 1:
                    release = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 5, 6]);
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(run())))];
                case 3: return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    release();
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
