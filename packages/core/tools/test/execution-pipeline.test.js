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
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
function input(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ name: "probe", args: {}, context: { workspaceRoot: "/tmp" } }, overrides);
}
(0, bun_test_1.test)("an allowed run executes, finalizes once, and freezes the result", function () { return __awaiter(void 0, void 0, void 0, function () {
    var finalizes, pipeline, run;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                finalizes = 0;
                pipeline = new src_1.ToolExecutionPipeline()
                    .execute(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, "raw"];
                }); }); })
                    .finalize(function (content) {
                    finalizes++;
                    return content.toUpperCase();
                });
                return [4 /*yield*/, pipeline.run(input())];
            case 1:
                run = _a.sent();
                (0, bun_test_1.expect)(run.status).toBe("allowed");
                if (run.status !== "allowed")
                    return [2 /*return*/];
                (0, bun_test_1.expect)(run.result.content).toBe("RAW");
                (0, bun_test_1.expect)(run.result.raw).toBe("raw");
                (0, bun_test_1.expect)(finalizes).toBe(1);
                // The result is frozen: an observer cannot rewrite it.
                (0, bun_test_1.expect)(Object.isFrozen(run.result)).toBe(true);
                (0, bun_test_1.expect)(function () {
                    run.result.content = "mutated";
                }).toThrow();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the first deny in the pre waterfall stops the run", function () { return __awaiter(void 0, void 0, void 0, function () {
    var executed, pipeline, run;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                executed = false;
                pipeline = new src_1.ToolExecutionPipeline()
                    .preStage(function () { return ({ decision: "allow" }); })
                    .preStage(function () { return ({ decision: "deny", reason: "policy" }); })
                    .preStage(function () { return ({ decision: "deny", reason: "unreachable" }); })
                    .execute(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        executed = true;
                        return [2 /*return*/, "never"];
                    });
                }); });
                return [4 /*yield*/, pipeline.run(input())];
            case 1:
                run = _a.sent();
                (0, bun_test_1.expect)(run).toEqual({ status: "denied", reason: "policy" });
                (0, bun_test_1.expect)(executed).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an ask decision halts for approval before execution", function () { return __awaiter(void 0, void 0, void 0, function () {
    var executed, pipeline, run;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                executed = false;
                pipeline = new src_1.ToolExecutionPipeline()
                    .preStage(function () { return ({ decision: "ask", reason: "side effect" }); })
                    .execute(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        executed = true;
                        return [2 /*return*/, "x"];
                    });
                }); });
                return [4 /*yield*/, pipeline.run(input())];
            case 1:
                run = _a.sent();
                (0, bun_test_1.expect)(run).toMatchObject({ status: "asking" });
                if (run.status === "asking")
                    (0, bun_test_1.expect)(run.decision.reason).toBe("side effect");
                (0, bun_test_1.expect)(executed).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("monotonic guards can only deny and cannot be undone", function () { return __awaiter(void 0, void 0, void 0, function () {
    var executed, pipeline, run;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                executed = false;
                pipeline = new src_1.ToolExecutionPipeline()
                    .guard(function () { return undefined; })
                    .guard(function () { return "read-only workspace"; })
                    .guard(function () { return "unreachable: a later guard cannot re-allow"; })
                    .execute(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        executed = true;
                        return [2 /*return*/, "x"];
                    });
                }); });
                return [4 /*yield*/, pipeline.run(input())];
            case 1:
                run = _a.sent();
                (0, bun_test_1.expect)(run).toEqual({ status: "denied", reason: "read-only workspace" });
                (0, bun_test_1.expect)(executed).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("post stages accept, replace and block in order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var blocked, _a, replaced, run, laterRan, stopped, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                blocked = new src_1.ToolExecutionPipeline()
                    .execute(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, "content"];
                }); }); })
                    .postStage(function () { return ({ decision: "block", feedback: "rejected by lint" }); });
                _a = bun_test_1.expect;
                return [4 /*yield*/, blocked.run(input())];
            case 1:
                _a.apply(void 0, [_c.sent()]).toEqual({
                    status: "blocked",
                    feedback: "rejected by lint",
                });
                replaced = new src_1.ToolExecutionPipeline()
                    .execute(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, "content"];
                }); }); })
                    .postStage(function () { return ({ decision: "replace", content: "redacted" }); });
                return [4 /*yield*/, replaced.run(input())];
            case 2:
                run = _c.sent();
                (0, bun_test_1.expect)(run.status).toBe("allowed");
                if (run.status === "allowed")
                    (0, bun_test_1.expect)(run.result.content).toBe("redacted");
                laterRan = false;
                stopped = new src_1.ToolExecutionPipeline()
                    .execute(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, "content"];
                }); }); })
                    .postStage(function () { return ({ decision: "block", feedback: "stop" }); })
                    .postStage(function () {
                    laterRan = true;
                    return { decision: "replace", content: "nope" };
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, stopped.run(input())];
            case 3:
                _b.apply(void 0, [(_c.sent()).status]).toBe("blocked");
                (0, bun_test_1.expect)(laterRan).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reordering the pre stages changes the outcome", function () { return __awaiter(void 0, void 0, void 0, function () {
    var a, b, bFirst, _a, aFirst, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                a = function (i) {
                    return i.name === "probe"
                        ? { decision: "allow" }
                        : { decision: "allow" };
                };
                b = function () { return ({ decision: "deny", reason: "b denies" }); };
                bFirst = new src_1.ToolExecutionPipeline().preStage(b).preStage(a);
                _a = bun_test_1.expect;
                return [4 /*yield*/, bFirst.run(input())];
            case 1:
                _a.apply(void 0, [(_c.sent()).status]).toBe("denied");
                aFirst = new src_1.ToolExecutionPipeline().preStage(a).preStage(b);
                _b = bun_test_1.expect;
                return [4 /*yield*/, aFirst.run(input())];
            case 2:
                _b.apply(void 0, [(_c.sent()).status]).toBe("denied");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a decision-only pipeline allows without an execute stage", function () { return __awaiter(void 0, void 0, void 0, function () {
    var run;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, new src_1.ToolExecutionPipeline()
                    .preStage(function () { return ({ decision: "allow" }); })
                    .run(input())];
            case 1:
                run = _a.sent();
                (0, bun_test_1.expect)(run.status).toBe("allowed");
                if (run.status === "allowed")
                    (0, bun_test_1.expect)(run.result.content).toBe("");
                return [2 /*return*/];
        }
    });
}); });
