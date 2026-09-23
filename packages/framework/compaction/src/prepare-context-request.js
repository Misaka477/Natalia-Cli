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
exports.prepareContextRequest = prepareContextRequest;
var runtime_1 = require("@natalia/runtime");
function prepareContextRequest(input) {
    return __awaiter(this, void 0, void 0, function () {
        var ledger, meter, scope, budget, preserve, pruneOptions, outbound, measure, hasCompactableRange, decide, publishSurface, pruned, outcome_1, measured, decision, outcome;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    ledger = input.ledger, meter = input.meter, scope = input.scope, budget = input.budget;
                    preserve = {
                        recentMessages: (_c = (_b = (_a = input.preserve) === null || _a === void 0 ? void 0 : _a.recentMessages) !== null && _b !== void 0 ? _b : budget.preservedRecentMessages) !== null && _c !== void 0 ? _c : 10,
                        recentTokens: (_e = (_d = input.preserve) === null || _d === void 0 ? void 0 : _d.recentTokens) !== null && _e !== void 0 ? _e : budget.preservedRecentTokens,
                    };
                    pruneOptions = input.prune
                        ? ((_f = input.pruneOptions) !== null && _f !== void 0 ? _f : budget.prune)
                        : undefined;
                    outbound = input.outbound;
                    measure = function () {
                        return meter.measureRequest(scope, {
                            system: input.system,
                            tools: input.tools,
                            messages: outbound,
                            contextWindow: input.contextWindow,
                        });
                    };
                    hasCompactableRange = function () {
                        return (0, runtime_1.selectCompactableRange)(ledger.snapshot().entries, preserve).hasRange;
                    };
                    decide = function (measured) {
                        return (0, runtime_1.decideCompaction)({
                            requestTokens: measured.totalTokens,
                            headerTokens: measured.headerTokens,
                            surfaceTokens: measured.messageTokens,
                            max: budget.max,
                            reserved: budget.reserved,
                            thresholdPercent: budget.thresholdPercent,
                            hasCompactableRange: hasCompactableRange(),
                        });
                    };
                    publishSurface = function (measured) {
                        input.emitStatus(measured);
                        input.emitSnapshot(measured);
                    };
                    pruned = 0;
                    // Model-free prune is cheap and keeps old tool results bounded; it runs on
                    // the turn's first request only (see {@link PrepareContextRequestInput.prune}).
                    // Only the expensive LLM summarize stays gated behind the decision below.
                    if (pruneOptions) {
                        outcome_1 = ledger.pruneToolResults(pruneOptions);
                        pruned = outcome_1.pruned;
                        if (pruned > 0)
                            outbound = input.rebuildOutbound(ledger.snapshot().entries, "prune");
                    }
                    measured = measure();
                    decision = decide(measured);
                    publishSurface(measured);
                    if (decision === "none" || decision === "nothing_to_compact") {
                        return [2 /*return*/, {
                                outbound: outbound,
                                decision: decision,
                                compacted: false,
                                pruned: pruned,
                                used: measured.totalTokens,
                            }];
                    }
                    return [4 /*yield*/, (0, runtime_1.compactContext)(ledger, (0, runtime_1.providerCompactor)(input.provider, input.signal), __assign(__assign(__assign(__assign(__assign(__assign({ id: "".concat(input.id, ":preflight:").concat((_g = input.step) !== null && _g !== void 0 ? _g : 0), trigger: decision === "ratio" ? "ratio" : "reserved", maxTokens: budget.max, thresholdPercent: budget.thresholdPercent, reservedTokens: budget.reserved, preservedRecentMessages: (_h = preserve.recentMessages) !== null && _h !== void 0 ? _h : 10 }, (preserve.recentTokens === undefined
                            ? {}
                            : { preservedRecentTokens: preserve.recentTokens })), (input.prefixMessages ? { prefixMessages: input.prefixMessages } : {})), (input.instruction ? { instruction: input.instruction } : {})), (input.userInstruction
                            ? { userInstruction: input.userInstruction }
                            : {})), (input.compactionEnabled === undefined
                            ? {}
                            : { enabled: input.compactionEnabled })), { beforeTokens: measured.totalTokens, retry: __assign(__assign({}, ((_j = input.retry) !== null && _j !== void 0 ? _j : {})), { signal: input.signal }), onEvent: input.publish, now: input.now }))];
                case 1:
                    outcome = _l.sent();
                    if (outcome.compacted) {
                        // The provider usage anchor described the pre-compaction surface; drop it
                        // so the re-measure prices the rewritten request instead of reusing a
                        // stale (now-too-large) sample.
                        meter.clear(scope);
                        outbound = input.rebuildOutbound(ledger.snapshot().entries, "compact");
                        measured = measure();
                        (_k = input.onCompacted) === null || _k === void 0 ? void 0 : _k.call(input);
                        publishSurface(measured);
                    }
                    return [2 /*return*/, {
                            outbound: outbound,
                            decision: decision,
                            compacted: outcome.compacted,
                            pruned: pruned,
                            used: measured.totalTokens,
                        }];
            }
        });
    });
}
