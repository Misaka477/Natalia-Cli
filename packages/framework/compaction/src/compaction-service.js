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
exports.createCompactionService = createCompactionService;
var runtime_1 = require("@natalia/runtime");
var prepare_context_request_1 = require("./prepare-context-request");
function createCompactionService(input) {
    var compact = function (operation, trigger, options) {
        return (0, runtime_1.compactContext)(operation.ledger, (0, runtime_1.providerCompactor)(operation.provider, operation.signal), __assign(__assign(__assign(__assign({ id: operation.compactionID, trigger: trigger, maxTokens: operation.budget.max, thresholdPercent: operation.budget.thresholdPercent, reservedTokens: operation.budget.reserved, preservedRecentMessages: operation.preservedRecentMessages }, (operation.preservedRecentTokens === undefined
            ? {}
            : { preservedRecentTokens: operation.preservedRecentTokens })), (operation.prefixMessages
            ? { prefixMessages: operation.prefixMessages }
            : {})), { instruction: operation.instruction, onEvent: operation.onEvent, retry: { policy: input.retry.policy(), signal: operation.signal } }), options));
    };
    return {
        compactBeforeProviderStep: function (operation) {
            return __awaiter(this, void 0, void 0, function () {
                var trigger, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            trigger = (0, runtime_1.compactionTrigger)({
                                used: operation.usedTokens,
                                max: operation.budget.max,
                                thresholdPercent: operation.budget.thresholdPercent,
                                reserved: operation.budget.reserved,
                            });
                            if (!trigger)
                                return [2 /*return*/, { compacted: false, skipped: "nothing_to_compact" }];
                            _a = [{}];
                            return [4 /*yield*/, compact(operation, trigger, {
                                    enabled: operation.enabled,
                                    beforeTokens: operation.usedTokens,
                                })];
                        case 1: return [2 /*return*/, __assign.apply(void 0, [__assign.apply(void 0, _a.concat([(_b.sent())])), { trigger: trigger }])];
                    }
                });
            });
        },
        prepareContextRequest: function (request) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    return [2 /*return*/, (0, prepare_context_request_1.prepareContextRequest)(__assign(__assign({}, request), { retry: {
                                policy: (_b = (_a = request.retry) === null || _a === void 0 ? void 0 : _a.policy) !== null && _b !== void 0 ? _b : input.retry.policy(),
                                signal: request.signal,
                            } }))];
                });
            });
        },
        runWithContextLimitRecovery: function (operation) {
            return __awaiter(this, void 0, void 0, function () {
                var maxRetries, retries, error_1, outcome;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            maxRetries = Math.max(0, Math.floor((_a = operation.maxOverflowRetries) !== null && _a !== void 0 ? _a : 1));
                            retries = 0;
                            _f.label = 1;
                        case 1:
                            if (!true) return [3 /*break*/, 10];
                            _f.label = 2;
                        case 2:
                            _f.trys.push([2, 4, , 9]);
                            return [4 /*yield*/, operation.runStep()];
                        case 3: return [2 /*return*/, _f.sent()];
                        case 4:
                            error_1 = _f.sent();
                            if (error_1.kind !== "context_limit")
                                throw error_1;
                            if (retries >= maxRetries)
                                throw (0, runtime_1.providerError)({
                                    kind: "context_limit",
                                    message: "context-limit recovery retries exhausted (".concat(retries, ")"),
                                    cause: error_1,
                                });
                            retries += 1;
                            (_b = operation.onEvent) === null || _b === void 0 ? void 0 : _b.call(operation, {
                                type: "context.limit.recovery",
                                id: operation.id,
                                step: operation.step,
                                attempted: true,
                                compacted: false,
                                reason: "context_limit",
                            });
                            return [4 /*yield*/, compact(operation, "context_limit", {
                                    force: true,
                                })];
                        case 5:
                            outcome = _f.sent();
                            if (!(outcome.compacted === true)) return [3 /*break*/, 7];
                            return [4 /*yield*/, ((_c = operation.onCompacted) === null || _c === void 0 ? void 0 : _c.call(operation, outcome))];
                        case 6:
                            _f.sent();
                            _f.label = 7;
                        case 7:
                            (_d = operation.onEvent) === null || _d === void 0 ? void 0 : _d.call(operation, {
                                type: "context.limit.recovery",
                                id: operation.id,
                                step: operation.step,
                                attempted: true,
                                compacted: outcome.compacted,
                                reason: "context_limit",
                            });
                            return [4 /*yield*/, ((_e = operation.beforeRetry) === null || _e === void 0 ? void 0 : _e.call(operation, outcome))];
                        case 8:
                            _f.sent();
                            return [3 /*break*/, 9];
                        case 9: return [3 /*break*/, 1];
                        case 10: return [2 /*return*/];
                    }
                });
            });
        },
    };
}
