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
var runtime_1 = require("@natalia/runtime");
var subagent_result_gate_1 = require("../src/runtime/initialize/subagent-result-gate");
(0, bun_test_1.test)("resultNeedsExpansion is exact at the threshold", function () {
    // `>=` not `>`: an answer of exactly the minimum length is acceptable.
    (0, bun_test_1.expect)((0, subagent_result_gate_1.resultNeedsExpansion)("x".repeat(199), 200)).toBe(true);
    (0, bun_test_1.expect)((0, subagent_result_gate_1.resultNeedsExpansion)("x".repeat(200), 200)).toBe(false);
});
(0, bun_test_1.test)("resultNeedsExpansion counts trimmed length", function () {
    // Padding is not content.
    (0, bun_test_1.expect)((0, subagent_result_gate_1.resultNeedsExpansion)("\n\n   ".concat("x".repeat(50), "   \n"), 200)).toBe(true);
});
(0, bun_test_1.test)("a gate of zero or less is disabled", function () {
    (0, bun_test_1.expect)((0, subagent_result_gate_1.resultNeedsExpansion)("Done.", 0)).toBe(false);
    (0, bun_test_1.expect)((0, subagent_result_gate_1.resultNeedsExpansion)("Done.", -1)).toBe(false);
});
(0, bun_test_1.test)("an empty answer is short enough to need expansion", function () {
    // No special case: an empty final answer after real work is as useless as a
    // one-word one.
    (0, bun_test_1.expect)((0, subagent_result_gate_1.resultNeedsExpansion)("", 200)).toBe(true);
    (0, bun_test_1.expect)((0, subagent_result_gate_1.resultNeedsExpansion)("   \n  ", 200)).toBe(true);
});
(0, bun_test_1.test)("the gate asks once and keeps the longer answer", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, asked, expanded, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new runtime_1.ContextLedger();
                expanded = "Read three files (".concat("detail ".repeat(40), ")and updated two.");
                return [4 /*yield*/, (0, subagent_result_gate_1.ensureUsableResult)({
                        ledger: ledger,
                        setStatus: function () { },
                        step: 3,
                        output: "Done.",
                        minChars: 200,
                        runStep: function (step) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                asked = step;
                                return [2 /*return*/, { output: expanded, calls: [] }];
                            });
                        }); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBe(expanded);
                (0, bun_test_1.expect)(asked).toBe(4);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the ask reaches the model as a ledger turn, naming what is missing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, entries;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new runtime_1.ContextLedger();
                return [4 /*yield*/, (0, subagent_result_gate_1.ensureUsableResult)({
                        ledger: ledger,
                        setStatus: function () { },
                        step: 1,
                        output: "ok",
                        minChars: 200,
                        runStep: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ output: "a longer answer than before", calls: [] })];
                        }); }); },
                    })];
            case 1:
                _a.sent();
                entries = ledger.snapshot().entries;
                (0, bun_test_1.expect)(entries).toHaveLength(1);
                (0, bun_test_1.expect)(entries[0].role).toBe("user");
                (0, bun_test_1.expect)(entries[0].content).toBe(subagent_result_gate_1.RESULT_TOO_BRIEF_PROMPT);
                // It names the missing detail rather than asking for "more", which a model
                // answers by restating the same sentence at greater length.
                (0, bun_test_1.expect)(entries[0].content).toContain("technical details");
                (0, bun_test_1.expect)(entries[0].content).toContain("findings and analysis");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a second one-liner is not an improvement, so the original stands", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new runtime_1.ContextLedger();
                return [4 /*yield*/, (0, subagent_result_gate_1.ensureUsableResult)({
                        ledger: ledger,
                        setStatus: function () { },
                        step: 1,
                        output: "Done.",
                        minChars: 200,
                        runStep: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ output: "ok done, slightly longer", calls: [] })];
                        }); }); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBe("Done.");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the gate asks at most once, however short the follow-up is", function () { return __awaiter(void 0, void 0, void 0, function () {
    var turns, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                turns = 0;
                return [4 /*yield*/, (0, subagent_result_gate_1.ensureUsableResult)({
                        ledger: new runtime_1.ContextLedger(),
                        setStatus: function () { },
                        step: 1,
                        output: "Done.",
                        minChars: 200,
                        runStep: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                turns += 1;
                                return [2 /*return*/, { output: "still brief", calls: [] }];
                            });
                        }); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(turns).toBe(1);
                (0, bun_test_1.expect)(result).toBe("Done.");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an answer already long enough is returned untouched, with no extra turn", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ledger, turns, output, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ledger = new runtime_1.ContextLedger();
                turns = 0;
                output = "x".repeat(500);
                return [4 /*yield*/, (0, subagent_result_gate_1.ensureUsableResult)({
                        ledger: ledger,
                        setStatus: function () { },
                        step: 1,
                        output: output,
                        minChars: 200,
                        runStep: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                turns += 1;
                                return [2 /*return*/, { output: "unused", calls: [] }];
                            });
                        }); },
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBe(output);
                (0, bun_test_1.expect)(turns).toBe(0);
                (0, bun_test_1.expect)(ledger.snapshot().entries).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
