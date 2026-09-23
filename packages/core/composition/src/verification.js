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
exports.GUARD_SCRIPTS = void 0;
exports.guardsFace = guardsFace;
exports.constitutionCheck = constitutionCheck;
exports.runVerificationGate = runVerificationGate;
var node_child_process_1 = require("node:child_process");
/**
 * The architecture guards, exactly the set the plan and study name for
 * the candidate gate (imports/deps/contract/suppressions). The verify
 * chain's test-hygiene guards are deliberately NOT here: they judge the
 * repository's test suite, not a candidate's composition — and running
 * them from inside a test necessarily flags that test's own live
 * workspaces as residue.
 */
exports.GUARD_SCRIPTS = [
    "guard:imports",
    "guard:contract",
    "guard:deps",
    "guard:suppressions",
];
var spawnGuard = function (script, cwd) {
    var _a, _b, _c;
    var result = (0, node_child_process_1.spawnSync)("npm", ["run", script], {
        cwd: cwd,
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
    });
    return {
        status: (_a = result.status) !== null && _a !== void 0 ? _a : 1,
        output: "".concat((_b = result.stdout) !== null && _b !== void 0 ? _b : "").concat((_c = result.stderr) !== null && _c !== void 0 ? _c : ""),
    };
};
/**
 * The architecture face: runs each guard script in the repo. A guard that
 * fails surfaces with its own output, aggregated under one face check — the
 * switch reads a single ok per face, and the evidence is not lost.
 */
function guardsFace(options) {
    var _a;
    var run = (_a = options.run) !== null && _a !== void 0 ? _a : spawnGuard;
    return function () {
        var perGuard = exports.GUARD_SCRIPTS.map(function (script) {
            var _a = run(script, options.repoRoot), status = _a.status, output = _a.output;
            return {
                script: script,
                ok: status === 0,
                detail: output.slice(-2000).trim() || "exit ".concat(status),
            };
        });
        var failed = perGuard.filter(function (guard) { return !guard.ok; });
        return __assign({ check: "guards", ok: failed.length === 0 }, (failed.length
            ? {
                detail: failed
                    .map(function (guard) { return "".concat(guard.script, ": ").concat(guard.detail); })
                    .join("\n"),
            }
            : {}));
    };
}
/**
 * The constitution face's verdict: every active critical/high rule the user
 * marked `forbidden` must still be carried by the candidate with the same
 * statement and enforcement — the study's non-rollback rule (a candidate
 * may add policy, never subtract protection). Missing, reworded, or
 * weakened rows all fail, each by name.
 */
function constitutionCheck(candidate, activeRules) {
    var carried = new Map(candidate.policyRows.map(function (rule) { return [rule.id, rule]; }));
    var violations = [];
    for (var _i = 0, activeRules_1 = activeRules; _i < activeRules_1.length; _i++) {
        var rule = activeRules_1[_i];
        if (rule.overridePolicy !== "forbidden")
            continue;
        if (rule.priority !== "critical" && rule.priority !== "high")
            continue;
        var row = carried.get(rule.id);
        if (!row) {
            violations.push("".concat(rule.id, ": dropped by the candidate"));
            continue;
        }
        if (row.enforcement !== rule.enforcement)
            violations.push("".concat(rule.id, ": enforcement ").concat(rule.enforcement, " -> ").concat(row.enforcement));
        if (row.statement !== rule.statement)
            violations.push("".concat(rule.id, ": statement changed"));
    }
    return __assign({ check: "constitution", ok: violations.length === 0 }, (violations.length ? { detail: violations.join("; ") } : {}));
}
/**
 * Runs every face of the gate (in parallel — they are independent) and
 * publishes the journal's `composition.verified` record of what was checked.
 * The verdict is all-must-pass; nothing here decides to switch (that is the
 * orchestrator's job, after approval).
 */
function runVerificationGate(input) {
    return __awaiter(this, void 0, void 0, function () {
        var runFace, results, verdict;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    runFace = function (name, face) { return __awaiter(_this, void 0, void 0, function () {
                        var error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, face()];
                                case 1: return [2 /*return*/, _a.sent()];
                                case 2:
                                    error_1 = _a.sent();
                                    return [2 /*return*/, {
                                            check: name,
                                            ok: false,
                                            detail: error_1 instanceof Error ? error_1.message : String(error_1),
                                        }];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, Promise.all([
                            runFace("constitution", function () {
                                return constitutionCheck(input.candidate, input.activeRules);
                            }),
                            runFace("guards", function () { return input.faces.guards(input.candidate); }),
                            runFace("smoke", function () { return input.faces.smoke(input.candidate); }),
                            runFace("nia", function () { return input.faces.nia(input.candidate); }),
                        ])];
                case 1:
                    results = _b.sent();
                    verdict = {
                        verdict: results.every(function (check) { return check.ok; }) ? "passed" : "failed",
                        checks: results,
                    };
                    (_a = input.publish) === null || _a === void 0 ? void 0 : _a.call(input, {
                        type: "composition.verified",
                        candidateID: input.candidateID,
                        verdict: verdict.verdict,
                        checks: verdict.checks,
                    });
                    return [2 /*return*/, verdict];
            }
        });
    });
}
