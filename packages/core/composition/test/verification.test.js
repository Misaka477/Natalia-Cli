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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_1 = require("../src/index");
/**
 * The verification gate (study §4.3): every face all-must-pass, one journal
 * record of what was checked. Each test breaks exactly one face so the
 * verdict's honesty is observable, not assumed.
 */
var FORBIDDEN = {
    id: "C-REL-001",
    statement: "git 写操作强制审批",
    scope: "release",
    priority: "critical",
    source: "policy",
    enforcement: "deny",
    overridePolicy: "forbidden",
    evidenceRefs: [],
};
var SCOPED = {
    id: "C-REL-099",
    statement: "提案需带证据",
    scope: "task",
    priority: "medium",
    source: "user",
    enforcement: "warn",
    overridePolicy: "user_scoped",
    evidenceRefs: [],
};
var CONFIG = { version: 3 };
function candidate(policyRows) {
    return (0, index_1.buildGeneration)({
        config: CONFIG,
        catalog: [],
        policyRows: policyRows,
    });
}
var passingFaces = {
    guards: function () { return ({ check: "guards", ok: true }); },
    smoke: function () { return ({ check: "smoke", ok: true }); },
    nia: function () { return ({ check: "nia", ok: true }); },
};
function publishLog() {
    var events = [];
    return { events: events, publish: function (event) { return events.push(event); } };
}
(0, bun_test_1.test)("a candidate carrying the active rules passes every face", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, events, publish, verdict;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = publishLog(), events = _a.events, publish = _a.publish;
                return [4 /*yield*/, (0, index_1.runVerificationGate)({
                        candidateID: "gen-candidate",
                        candidate: candidate([FORBIDDEN, SCOPED]),
                        activeRules: [FORBIDDEN, SCOPED],
                        faces: passingFaces,
                        publish: publish,
                    })];
            case 1:
                verdict = _b.sent();
                (0, bun_test_1.expect)(verdict.verdict).toBe("passed");
                (0, bun_test_1.expect)(verdict.checks.map(function (check) { return check.check; })).toEqual([
                    "constitution",
                    "guards",
                    "smoke",
                    "nia",
                ]);
                (0, bun_test_1.expect)(events).toMatchObject([
                    {
                        type: "composition.verified",
                        candidateID: "gen-candidate",
                        verdict: "passed",
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("dropping a forbidden rule fails the constitution face by name", function () {
    var check = (0, index_1.constitutionCheck)(candidate([SCOPED]), [FORBIDDEN, SCOPED]);
    (0, bun_test_1.expect)(check.ok).toBe(false);
    (0, bun_test_1.expect)(check.detail).toContain("C-REL-001");
    (0, bun_test_1.expect)(check.detail).toContain("dropped");
});
(0, bun_test_1.test)("weakening a forbidden rule's enforcement fails", function () {
    var weakened = __assign(__assign({}, FORBIDDEN), { enforcement: "approval" });
    var check = (0, index_1.constitutionCheck)(candidate([weakened]), [FORBIDDEN]);
    (0, bun_test_1.expect)(check.ok).toBe(false);
    (0, bun_test_1.expect)(check.detail).toContain("deny -> approval");
});
(0, bun_test_1.test)("rewording a forbidden statement fails; scoped medium rules are free", function () {
    var reworded = __assign(__assign({}, FORBIDDEN), { statement: "…" });
    var check = (0, index_1.constitutionCheck)(candidate([reworded, __assign(__assign({}, SCOPED), { statement: "changed" })]), [FORBIDDEN, SCOPED]);
    (0, bun_test_1.expect)(check.ok).toBe(false);
    (0, bun_test_1.expect)(check.detail).toContain("C-REL-001: statement changed");
    // SCOPED is medium + user_scoped: the gate is not a policy straitjacket,
    // it is the non-rollback rule for what the user marked untouchable.
    (0, bun_test_1.expect)(check.detail).not.toContain("C-REL-099");
});
(0, bun_test_1.test)("one failing face fails the verdict and the journal says which", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, events, publish, verdict, recorded;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = publishLog(), events = _a.events, publish = _a.publish;
                return [4 /*yield*/, (0, index_1.runVerificationGate)({
                        candidateID: "gen-bad",
                        candidate: candidate([FORBIDDEN]),
                        activeRules: [FORBIDDEN],
                        faces: __assign(__assign({}, passingFaces), { smoke: function () { return ({
                                check: "smoke",
                                ok: false,
                                detail: "runtime failed to boot",
                            }); } }),
                        publish: publish,
                    })];
            case 1:
                verdict = _b.sent();
                (0, bun_test_1.expect)(verdict.verdict).toBe("failed");
                recorded = events.find(function (event) { return event.type === "composition.verified"; });
                (0, bun_test_1.expect)(recorded).toMatchObject({ verdict: "failed" });
                (0, bun_test_1.expect)(recorded
                    .checks).toContainEqual({
                    check: "smoke",
                    ok: false,
                    detail: "runtime failed to boot",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a face that throws is a failed gate, not a crashed gate", function () { return __awaiter(void 0, void 0, void 0, function () {
    var verdict;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, index_1.runVerificationGate)({
                    candidateID: "gen-throw",
                    candidate: candidate([]),
                    activeRules: [],
                    faces: __assign(__assign({}, passingFaces), { nia: function () {
                            throw new Error("audit provider unavailable");
                        } }),
                })];
            case 1:
                verdict = _a.sent();
                // Promise.all rejects on a throwing face — the gate must translate that
                // into a failed verdict so the switch decision always has a verdict.
                (0, bun_test_1.expect)(verdict.verdict).toBe("failed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the guards face reports the failing guard by script name", function () { return __awaiter(void 0, void 0, void 0, function () {
    var face, check;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                face = (0, index_1.guardsFace)({
                    repoRoot: "/repo",
                    run: function (script) { return ({
                        status: script === "guard:deps" ? 1 : 0,
                        output: script === "guard:deps" ? "service graph: cycle" : "ok",
                    }); },
                });
                return [4 /*yield*/, face(candidate([]))];
            case 1:
                check = _a.sent();
                (0, bun_test_1.expect)(check.check).toBe("guards");
                (0, bun_test_1.expect)(check.ok).toBe(false);
                (0, bun_test_1.expect)(check.detail).toContain("guard:deps");
                (0, bun_test_1.expect)(check.detail).toContain("service graph: cycle");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the guards face runs exactly the verify chain's guards", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ran, face;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ran = [];
                face = (0, index_1.guardsFace)({
                    repoRoot: "/repo",
                    run: function (script) {
                        ran.push(script);
                        return { status: 0, output: "" };
                    },
                });
                return [4 /*yield*/, face(candidate([]))];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(ran).toEqual(__spreadArray([], index_1.GUARD_SCRIPTS, true));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("buildGeneration sorts policy rows, so order never changes the id", function () {
    var a = (0, index_1.buildGeneration)({
        config: CONFIG,
        catalog: [],
        policyRows: [FORBIDDEN, SCOPED],
    });
    var b = (0, index_1.buildGeneration)({
        config: CONFIG,
        catalog: [],
        policyRows: [SCOPED, FORBIDDEN],
    });
    (0, bun_test_1.expect)(JSON.stringify(a)).toBe(JSON.stringify(b));
});
