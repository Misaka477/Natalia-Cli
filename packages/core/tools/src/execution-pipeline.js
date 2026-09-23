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
exports.ToolExecutionPipeline = void 0;
/**
 * Composes the tool-execution stages in order and freezes the outcome.
 *
 * A stage registered later runs after the ones before it, so callers control
 * the order — the point of a waterfall. Guards are monotonic: once one denies,
 * the run stops and no later stage sees it, so no ordering of listeners can
 * turn a denial back into an allow.
 */
var ToolExecutionPipeline = /** @class */ (function () {
    function ToolExecutionPipeline() {
        this.pre = [];
        this.guards = [];
        this.post = [];
    }
    /** Appends a pre stage. */
    ToolExecutionPipeline.prototype.preStage = function (stage) {
        this.pre.push(stage);
        return this;
    };
    /** Appends a monotonic guard. */
    ToolExecutionPipeline.prototype.guard = function (stage) {
        this.guards.push(stage);
        return this;
    };
    /** Sets the execute wrapper (timeout/retry/metrics). Replaces any prior. */
    ToolExecutionPipeline.prototype.execute = function (fn) {
        this.executeFn = fn;
        return this;
    };
    /** Appends a post stage. */
    ToolExecutionPipeline.prototype.postStage = function (stage) {
        this.post.push(stage);
        return this;
    };
    /** Sets the final content invariant, applied exactly once. */
    ToolExecutionPipeline.prototype.finalize = function (fn) {
        this.finalizer = fn;
        return this;
    };
    ToolExecutionPipeline.prototype.run = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var decisions, _i, _a, stage, decision, _b, _c, guard, reason, raw, content, _d, _e, stage, decision;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        decisions = [];
                        _i = 0, _a = this.pre;
                        _f.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        stage = _a[_i];
                        return [4 /*yield*/, stage(input)];
                    case 2:
                        decision = _f.sent();
                        decisions.push(decision);
                        if (decision.decision === "deny")
                            return [2 /*return*/, { status: "denied", reason: decision.reason }];
                        if (decision.decision === "ask")
                            return [2 /*return*/, { status: "asking", decision: decision }];
                        _f.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        _b = 0, _c = this.guards;
                        _f.label = 5;
                    case 5:
                        if (!(_b < _c.length)) return [3 /*break*/, 8];
                        guard = _c[_b];
                        return [4 /*yield*/, guard(input)];
                    case 6:
                        reason = _f.sent();
                        if (reason !== undefined)
                            return [2 /*return*/, {
                                    status: "denied",
                                    reason: reason,
                                }];
                        _f.label = 7;
                    case 7:
                        _b++;
                        return [3 /*break*/, 5];
                    case 8:
                        if (!this.executeFn)
                            // A decision-only pipeline: every pre stage allowed, and there is nothing
                            // to execute. The caller that assembled only a decision chain reads the
                            // status and ignores the (empty) content.
                            return [2 /*return*/, {
                                    status: "allowed",
                                    result: Object.freeze({ content: "", raw: "", decisions: decisions }),
                                }];
                        return [4 /*yield*/, this.executeFn(input)];
                    case 9:
                        raw = _f.sent();
                        content = raw;
                        _d = 0, _e = this.post;
                        _f.label = 10;
                    case 10:
                        if (!(_d < _e.length)) return [3 /*break*/, 13];
                        stage = _e[_d];
                        return [4 /*yield*/, stage(input, content)];
                    case 11:
                        decision = _f.sent();
                        if (decision.decision === "block")
                            return [2 /*return*/, { status: "blocked", feedback: decision.feedback }];
                        if (decision.decision === "replace")
                            content = decision.content;
                        _f.label = 12;
                    case 12:
                        _d++;
                        return [3 /*break*/, 10];
                    case 13:
                        // The final content invariant runs exactly once.
                        if (this.finalizer)
                            content = this.finalizer(content);
                        return [2 /*return*/, {
                                status: "allowed",
                                result: Object.freeze({
                                    content: content,
                                    raw: raw,
                                    decisions: decisions,
                                }),
                            }];
                }
            });
        });
    };
    return ToolExecutionPipeline;
}());
exports.ToolExecutionPipeline = ToolExecutionPipeline;
