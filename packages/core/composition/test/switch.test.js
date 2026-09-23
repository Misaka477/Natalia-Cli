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
var contracts_1 = require("@natalia/contracts");
var index_1 = require("../src/index");
/**
 * The switch orchestration (study §4.3): every side effect crosses a seam,
 * so each invariant gets a direct assertion — gate before approval, no
 * apply without a grant, deferred by default (rule 1), verbatim restore on
 * a failed health check, incident in the journal.
 */
var CONFIG_A = contracts_1.configV3Schema.parse({ version: 3 });
var CONFIG_B = contracts_1.configV3Schema.parse({
    version: 3,
    runtime: { permissions: { mode: "read_only" } },
});
var RULE = {
    id: "C-SW-001",
    statement: "切换必须过闸",
    scope: "release",
    priority: "critical",
    source: "policy",
    enforcement: "deny",
    overridePolicy: "forbidden",
    evidenceRefs: [],
};
function faces(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ guards: function () { return ({ check: "guards", ok: true }); }, smoke: function () { return ({ check: "smoke", ok: true }); }, nia: function () { return ({ check: "nia", ok: true }); } }, overrides);
}
function harness(overrides) {
    var _this = this;
    if (overrides === void 0) { overrides = {}; }
    var events = [];
    var applied = [];
    var calls = { approval: 0, reload: 0, health: 0 };
    var input = __assign({ candidateID: "gen-candidate", candidate: (0, index_1.buildGeneration)({
            config: CONFIG_B,
            catalog: [],
            policyRows: [RULE],
        }), activeRules: [RULE], faces: faces(), reason: "test switch", currentGenerationID: "gen-current", currentConfig: CONFIG_A, requestApproval: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                calls.approval += 1;
                return [2 /*return*/, "granted"];
            });
        }); }, applyConfig: function (config) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                applied.push(config);
                return [2 /*return*/];
            });
        }); }, reloadRuntime: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                calls.reload += 1;
                return [2 /*return*/];
            });
        }); }, healthCheck: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                calls.health += 1;
                return [2 /*return*/, { ok: true }];
            });
        }); }, publish: function (event) { return events.push(event); } }, overrides);
    return { input: input, events: events, applied: applied, calls: calls };
}
function switchedEvents(events) {
    return events.filter(function (event) { return event.type === "composition.switched"; });
}
(0, bun_test_1.test)("a failed gate stops everything: no approval, no apply, no switch", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, events, applied, calls, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness({
                    faces: faces({
                        smoke: function () { return ({ check: "smoke", ok: false, detail: "boot failed" }); },
                    }),
                    when: "now",
                }), input = _a.input, events = _a.events, applied = _a.applied, calls = _a.calls;
                return [4 /*yield*/, (0, index_1.switchGeneration)(input)];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.stage).toBe("gate-failed");
                (0, bun_test_1.expect)(result.switched).toBe(false);
                (0, bun_test_1.expect)(calls.approval).toBe(0); // the gate runs BEFORE the human is asked
                (0, bun_test_1.expect)(applied).toHaveLength(0);
                (0, bun_test_1.expect)(switchedEvents(events)).toHaveLength(0);
                (0, bun_test_1.expect)(events.find(function (event) { return event.type === "composition.verified"; })).toMatchObject({ verdict: "failed" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a refused approval applies nothing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, events, applied, calls, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness({
                    when: "now",
                    requestApproval: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.approval += 1;
                            return [2 /*return*/, "refused"];
                        });
                    }); },
                }), input = _a.input, events = _a.events, applied = _a.applied, calls = _a.calls;
                return [4 /*yield*/, (0, index_1.switchGeneration)(input)];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.stage).toBe("approval-refused");
                (0, bun_test_1.expect)(applied).toHaveLength(0);
                (0, bun_test_1.expect)(switchedEvents(events)).toHaveLength(0);
                (0, bun_test_1.expect)(events.find(function (event) { return event.type === "composition.verified"; })).toMatchObject({ verdict: "passed" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("now: apply, live reload, switch journal, healthy done", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, events, applied, calls, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness({ when: "now" }), input = _a.input, events = _a.events, applied = _a.applied, calls = _a.calls;
                return [4 /*yield*/, (0, index_1.switchGeneration)(input)];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.stage).toBe("applied");
                (0, bun_test_1.expect)(result.switched).toBe(true);
                (0, bun_test_1.expect)(applied).toEqual([CONFIG_B]);
                (0, bun_test_1.expect)(calls.reload).toBe(1);
                (0, bun_test_1.expect)(switchedEvents(events)).toMatchObject([
                    { from: "gen-current", to: "gen-candidate" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failed health check rolls back verbatim and records the incident", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, events, applied, calls, result, incident;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness({
                    when: "now",
                    healthCheck: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.health += 1;
                            return [2 /*return*/, { ok: false, detail: "config reload diagnostics after switch" }];
                        });
                    }); },
                }), input = _a.input, events = _a.events, applied = _a.applied, calls = _a.calls;
                return [4 /*yield*/, (0, index_1.switchGeneration)(input)];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.stage).toBe("rolled-back");
                (0, bun_test_1.expect)(result.switched).toBe(false);
                // Candidate first, then the PREVIOUS config object restored verbatim.
                (0, bun_test_1.expect)(applied).toHaveLength(2);
                (0, bun_test_1.expect)(applied[0]).toBe(CONFIG_B);
                (0, bun_test_1.expect)(applied[1]).toBe(CONFIG_A);
                (0, bun_test_1.expect)(calls.reload).toBe(2);
                (0, bun_test_1.expect)(switchedEvents(events)).toMatchObject([
                    { from: "gen-current", to: "gen-candidate" },
                    { from: "gen-candidate", to: "gen-current" },
                ]);
                incident = events.find(function (event) { return event.type === "diagnostic"; });
                (0, bun_test_1.expect)(incident).toMatchObject({
                    level: "error",
                    message: bun_test_1.expect.stringContaining("rolled back to the previous composition"),
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("deferred by default (rule 1): the source updates, nothing claims a switch", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, events, applied, calls, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness(), input = _a.input, events = _a.events, applied = _a.applied, calls = _a.calls;
                return [4 /*yield*/, (0, index_1.switchGeneration)(input)];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.stage).toBe("deferred");
                (0, bun_test_1.expect)(result.switched).toBe(false);
                (0, bun_test_1.expect)(applied).toEqual([CONFIG_B]); // durable source updated
                (0, bun_test_1.expect)(calls.reload).toBe(0); // live runtime untouched
                (0, bun_test_1.expect)(switchedEvents(events)).toHaveLength(0); // the next boot's producer journals the switch it performs
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an immediate switch without a health check is refused loudly", function () { return __awaiter(void 0, void 0, void 0, function () {
    var input;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                input = harness({ when: "now", healthCheck: undefined }).input;
                return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.switchGeneration)(input)).rejects.toThrow(/requires reloadRuntime and healthCheck/u)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
