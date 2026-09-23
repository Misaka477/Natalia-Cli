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
exports.retryScenarios = exports.FakeRetryProvider = exports.FakeCompactor = void 0;
var FakeCompactor = /** @class */ (function () {
    function FakeCompactor(outcomes) {
        if (outcomes === void 0) { outcomes = [{ summary: "compact summary", tokens: 4 }]; }
        this.outcomes = outcomes;
        this.attempts = 0;
    }
    FakeCompactor.prototype.compact = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var outcome;
            var _a, _b;
            return __generator(this, function (_c) {
                outcome = this.outcomes[Math.min(this.attempts, this.outcomes.length - 1)];
                this.attempts += 1;
                if (outcome === "timeout")
                    throw new Error("compaction timeout");
                if (outcome === "failure")
                    throw new Error("compaction failed");
                return [2 /*return*/, {
                        summary: [
                            (_a = outcome === null || outcome === void 0 ? void 0 : outcome.summary) !== null && _a !== void 0 ? _a : "compact summary",
                            input.instruction,
                            input.resources.join("\n"),
                        ]
                            .filter(Boolean)
                            .join("\n"),
                        // Small by default: a compaction whose summary is not smaller than the
                        // span it replaces is rejected, and a fixture claiming a large summary
                        // for a small span would be asserting an impossible compaction.
                        tokens: (_b = outcome === null || outcome === void 0 ? void 0 : outcome.tokens) !== null && _b !== void 0 ? _b : 4,
                    }];
            });
        });
    };
    return FakeCompactor;
}());
exports.FakeCompactor = FakeCompactor;
var FakeRetryProvider = /** @class */ (function () {
    function FakeRetryProvider(outcomes) {
        this.outcomes = outcomes;
        this.attempts = 0;
    }
    FakeRetryProvider.prototype.complete = function (emitTransient) {
        return __awaiter(this, void 0, void 0, function () {
            var outcome, _i, _a, chunk;
            return __generator(this, function (_b) {
                outcome = this.outcomes[Math.min(this.attempts, this.outcomes.length - 1)];
                this.attempts += 1;
                if (!outcome)
                    return [2 /*return*/, { type: "success", chunks: ["ok"] }];
                if (outcome.type === "think-only") {
                    for (_i = 0, _a = outcome.chunks; _i < _a.length; _i++) {
                        chunk = _a[_i];
                        emitTransient === null || emitTransient === void 0 ? void 0 : emitTransient(chunk);
                    }
                }
                return [2 /*return*/, outcome];
            });
        });
    };
    return FakeRetryProvider;
}());
exports.FakeRetryProvider = FakeRetryProvider;
exports.retryScenarios = {
    timeoutThenSuccess: [
        { type: "error", kind: "timeout" },
        { type: "error", kind: "timeout" },
        { type: "success", chunks: ["final"] },
    ],
    connectionThenSuccess: [
        { type: "error", kind: "connection" },
        { type: "success", chunks: ["connected"] },
    ],
    rateLimitRetryAfter: [
        { type: "error", kind: "rate_limit", statusCode: 429, retryAfterMs: 1200 },
        { type: "success", chunks: ["limited-ok"] },
    ],
    server503ThenSuccess: [
        { type: "error", kind: "server", statusCode: 503 },
        { type: "success", chunks: ["server-ok"] },
    ],
    emptyThenSuccess: [
        { type: "error", kind: "empty_response" },
        { type: "success", chunks: ["non-empty"] },
    ],
    thinkOnlyThenSuccess: [
        { type: "think-only", chunks: ["hidden failed thought"] },
        { type: "success", chunks: ["clean final"] },
    ],
    cancel: [{ type: "error", kind: "cancel" }],
    exhausted: [
        { type: "error", kind: "timeout" },
        { type: "error", kind: "timeout" },
        { type: "error", kind: "timeout" },
    ],
};
