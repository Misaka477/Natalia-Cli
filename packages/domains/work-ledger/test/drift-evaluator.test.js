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
var src_1 = require("../src");
function makeEvaluator(open) {
    if (open === void 0) { open = new Set(); }
    return (0, src_1.createDriftEvaluator)({ openFindingIDs: function () { return open; } });
}
(0, bun_test_1.test)("the drift finding writer owner is fixed", function () {
    (0, bun_test_1.expect)(src_1.DRIFT_FINDING_WRITER_OWNER).toBe("DriftEvaluator");
});
(0, bun_test_1.test)("no drift when activity overlaps the objective", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "add a typed HTTP client",
        currentActivity: "adding a typed HTTP client",
        applicableConstraints: [],
        changes: [
            { action: "modified", path: "src/http.ts", summary: "typed client" },
        ],
        evidenceRefs: ["validated"],
        contract: {
            planID: "plan:1",
            scope: [],
            verification: [],
            constraints: [],
        },
    });
    (0, bun_test_1.expect)(findings).toEqual([]);
});
(0, bun_test_1.test)("no accepted contract opens an advisory unverifiable finding", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "implement user authentication",
        currentActivity: "refactoring the css theme",
        applicableConstraints: [],
        changes: [{ action: "modified", path: "src/theme.css" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(findings).toHaveLength(1);
    var finding = findings[0];
    (0, bun_test_1.expect)(finding.type).toBe("drift.finding_opened");
    (0, bun_test_1.expect)(finding.severity).toBe("advisory");
    (0, bun_test_1.expect)(finding.confidence).toBeGreaterThan(0.4);
    (0, bun_test_1.expect)(finding.originalObjective).toContain("authentication");
    (0, bun_test_1.expect)(finding.currentActivity).toContain("css theme");
    (0, bun_test_1.expect)(finding.evidence).toContain("reference:no_accepted_contract");
});
(0, bun_test_1.test)("a long activity list is bounded by item, never mid-item", function () {
    var evaluator = makeEvaluator();
    // A normal turn's change set is stored whole — the finding keeps every ref so
    // the card can offer "view all" with nothing lost at the data layer.
    var normal = Array.from({ length: 40 }, function (_, index) { return "deleted:packages/kernel/src/file_".concat(index, ".rs"); });
    var whole = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_items",
        objective: "implement user authentication",
        currentActivity: normal.join(", "),
        applicableConstraints: [],
        changes: [{ path: "src/lib.rs", action: "modified" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(whole).toHaveLength(1);
    (0, bun_test_1.expect)(whole[0].currentActivity).toContain("file_39.rs");
    (0, bun_test_1.expect)(whole[0].currentActivity).not.toContain("more");
    // A pathological turn past the cap is bounded by ITEM (never mid-item), with
    // the dropped count stated — so the card is bounded but never cuts a ref in
    // half ("deleted:" -> "dele") and never lies about what it dropped.
    var pathological = Array.from({ length: 600 }, function (_, index) { return "deleted:packages/kernel/src/file_".concat(index, ".rs"); });
    var bounded = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_items_cap",
        objective: "implement user authentication",
        currentActivity: pathological.join(", "),
        applicableConstraints: [],
        changes: [{ path: "src/lib.rs", action: "modified" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(bounded).toHaveLength(1);
    var finding = bounded[0];
    (0, bun_test_1.expect)(finding.currentActivity).toContain("file_499.rs");
    (0, bun_test_1.expect)(finding.currentActivity).not.toContain("file_500.rs");
    (0, bun_test_1.expect)(finding.currentActivity).toContain("\u2026+100 more");
});
(0, bun_test_1.test)("a forbidden activity signal opens a high finding with the constraint", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "finish the docs",
        currentActivity: "commit the generated files to the repo",
        applicableConstraints: ["never commit generated files"],
        changes: [{ action: "added", path: "dist/out.js" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(findings.length).toBeGreaterThan(0);
    var finding = findings.find(function (f) { return f.severity === "high"; });
    (0, bun_test_1.expect)(finding).toBeDefined();
    (0, bun_test_1.expect)(finding === null || finding === void 0 ? void 0 : finding.severity).toBe("high");
    (0, bun_test_1.expect)(finding === null || finding === void 0 ? void 0 : finding.applicableConstraints[0]).toContain("never commit");
    (0, bun_test_1.expect)(finding === null || finding === void 0 ? void 0 : finding.evidence.some(function (entry) { return entry.startsWith("constraint:"); })).toBe(true);
});
(0, bun_test_1.test)("a verify objective with no evidence and changed files opens a warning", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "verify the build passes",
        currentActivity: "verify the build passes",
        applicableConstraints: [],
        changes: [{ action: "modified", path: "src/lib.ts" }],
        evidenceRefs: [],
    });
    var finding = findings.find(function (f) { return f.severity === "warning"; });
    (0, bun_test_1.expect)(finding).toBeDefined();
    (0, bun_test_1.expect)(finding === null || finding === void 0 ? void 0 : finding.evidence).toContain("completion:no_evidence_refs");
});
(0, bun_test_1.test)("an already-open finding is not reopened", function () {
    var findingID = "drift:unverifiable_no_contract:t_1:ses_1";
    var evaluator = makeEvaluator(new Set([findingID]));
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "implement authentication",
        currentActivity: "refactoring css",
        applicableConstraints: [],
        changes: [{ action: "modified", path: "src/theme.css" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(findings.some(function (f) { return f.findingID === findingID; })).toBe(false);
});
(0, bun_test_1.test)("drift findings carry no secrets", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "implement authentication",
        currentActivity: "commit api_key=supersecret to the repo",
        applicableConstraints: ["never commit secrets"],
        changes: [{ action: "added", path: "config.json" }],
        evidenceRefs: [],
    });
    var serialized = JSON.stringify(findings);
    (0, bun_test_1.expect)(serialized).not.toContain("supersecret");
});
(0, bun_test_1.test)("buildDriftFindingUpdate records the rationale acknowledgement", function () {
    var event = (0, src_1.buildDriftFindingUpdate)({
        id: "drift:abc:drift:x",
        findingID: "drift:x",
        status: "explained",
        rationale: "the css refactor was a prerequisite",
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "drift.finding_updated",
        findingID: "drift:x",
        status: "explained",
        rationale: "the css refactor was a prerequisite",
    });
});
(0, bun_test_1.test)("buildDriftFindingUpdate redacts secrets from the rationale", function () {
    var event = (0, src_1.buildDriftFindingUpdate)({
        id: "drift:abc:drift:y",
        findingID: "drift:y",
        status: "dismissed",
        rationale: "api_key=supersecret is not involved",
    });
    (0, bun_test_1.expect)(JSON.stringify(event)).not.toContain("supersecret");
    (0, bun_test_1.expect)(event.rationale).toContain("[REDACTED]");
});
(0, bun_test_1.test)("a dependency manifest change unrelated to the objective opens an advisory", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "implement the credential handler",
        currentActivity: "implement the credential handler",
        applicableConstraints: [],
        changes: [{ action: "modified", path: "package.json" }],
        evidenceRefs: ["validated"],
    });
    var dep = findings.find(function (f) { return f.findingID.includes("dependency_signal"); });
    (0, bun_test_1.expect)(dep).toBeDefined();
    (0, bun_test_1.expect)(dep === null || dep === void 0 ? void 0 : dep.severity).toBe("advisory");
    (0, bun_test_1.expect)(dep === null || dep === void 0 ? void 0 : dep.evidence).toContain("dependency:package.json");
});
(0, bun_test_1.test)("a dependency change when the objective is about dependencies opens nothing", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "update the dependencies and lockfile",
        currentActivity: "update the dependencies and lockfile",
        applicableConstraints: [],
        changes: [{ action: "modified", path: "bun.lock" }],
        evidenceRefs: [],
        contract: {
            planID: "plan:1",
            scope: [],
            verification: [],
            constraints: [],
        },
    });
    (0, bun_test_1.expect)(findings).toEqual([]);
});
(0, bun_test_1.test)("a change outside the objective's named target opens a target_drift advisory", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: 'refactor the "src/auth" module',
        currentActivity: 'refactor the "src/auth" module',
        applicableConstraints: [],
        changes: [{ action: "modified", path: "dist/out.js" }],
        evidenceRefs: [],
        contract: {
            planID: "plan:1",
            scope: [],
            verification: [],
            constraints: [],
        },
    });
    var drift = findings.find(function (f) { return f.findingID.includes("target_drift"); });
    (0, bun_test_1.expect)(drift).toBeDefined();
    (0, bun_test_1.expect)(drift === null || drift === void 0 ? void 0 : drift.evidence.some(function (entry) { return entry.startsWith("outside_target:"); })).toBe(true);
});
(0, bun_test_1.test)("a change inside the objective's named target opens nothing", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: 'refactor the "src/auth" module',
        currentActivity: 'refactor the "src/auth" module',
        applicableConstraints: [],
        changes: [{ action: "modified", path: "src/auth/credential.ts" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(findings.some(function (f) { return f.findingID.includes("target_drift"); })).toBe(false);
});
(0, bun_test_1.test)("minimumConfidence tuning suppresses weak signals", function () {
    var evaluator = (0, src_1.createDriftEvaluator)({
        openFindingIDs: function () { return new Set(); },
        minimumConfidence: 0.8,
    });
    // dependency_signal has confidence 0.55 and target_drift 0.6: both below 0.8.
    var findings = evaluator.evaluate({
        sessionID: "ses_1",
        turnID: "t_1",
        objective: "implement the credential handler",
        currentActivity: "implement the credential handler",
        applicableConstraints: [],
        changes: [{ action: "modified", path: "package.json" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(findings).toEqual([]);
});
(0, bun_test_1.test)("CJK objectives score overlap instead of reading as zero (EI §8.6)", function () {
    // The old word-only metric split Chinese into zero tokens, so every CJK
    // objective looked like total mismatch. The CJK-aware metric now scores the
    // bigram overlap, so an on-track activity asks no prose-relevance question.
    var question = (0, src_1.proseRelevanceQuestion)({
        objective: "把运行时提示词改成静态加运行时上下文",
        currentActivity: "把运行时提示词改成静态加运行时上下文的改动",
        applicableConstraints: [],
        changes: [{ path: "packages/framework/runtime/src", action: "edit" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(question).toBeUndefined();
});
(0, bun_test_1.test)("proseRelevanceQuestion asks when there is no contract and the activity is unrelated", function () {
    // No contract + unrelated activity -> the 问通道 asks; it is not a finding.
    var question = (0, src_1.proseRelevanceQuestion)({
        sessionID: "ses_1",
        objective: "implement user authentication",
        currentActivity: "writing cooking recipes documentation",
        applicableConstraints: [],
        changes: [{ path: "docs/recipes.md", action: "edit" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(question).toContain("关联不大");
    (0, bun_test_1.expect)(question).toContain("implement user authentication");
    // With a contract the judge channel governs, so no prose question.
    (0, bun_test_1.expect)((0, src_1.proseRelevanceQuestion)({
        objective: "implement user authentication",
        currentActivity: "writing cooking recipes documentation",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        contract: {
            planID: "plan:1",
            scope: [],
            verification: [],
            constraints: [],
        },
    })).toBeUndefined();
});
(0, bun_test_1.test)("an accepted contract is the R: scope matches are not drift and its constraints bind", function () {
    var evaluate = (0, src_1.createDriftEvaluator)({
        openFindingIDs: function () { return new Set(); },
    }).evaluate;
    // The activity matches the committed scope even though the objective
    // sentence does not — no mismatch finding.
    var scopeFindings = evaluate({
        objective: "rewrite the entire runtime",
        currentActivity: "edit:packages/framework/runtime/src",
        applicableConstraints: [],
        changes: [
            { path: "packages/framework/runtime/src/provider.ts", action: "edit" },
        ],
        evidenceRefs: [],
        contract: {
            planID: "plan:1",
            scope: ["packages/framework/runtime/src"],
            verification: [],
            constraints: ["never commit directly"],
        },
    });
    // A contract governs the judge channel, so no prose-relevance question.
    (0, bun_test_1.expect)((0, src_1.proseRelevanceQuestion)({
        objective: "rewrite the entire runtime",
        currentActivity: "edit:packages/framework/runtime/src",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        contract: {
            planID: "plan:1",
            scope: ["packages/framework/runtime/src"],
            verification: [],
            constraints: [],
        },
    })).toBeUndefined();
    // The contract's own constraint is as binding as a seeded rule.
    var constraintFindings = evaluate({
        objective: "ship the change",
        currentActivity: "git commit the change",
        applicableConstraints: [],
        changes: [{ path: "src", action: "edit" }],
        evidenceRefs: [],
        contract: {
            planID: "plan:1",
            scope: [],
            verification: [],
            constraints: ["never commit directly"],
        },
    });
    var constraintFinding = constraintFindings.find(function (f) {
        var _a;
        return f.severity === "high" &&
            ((_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (h) { return h.rule === "constraint_violation_signal"; }));
    });
    (0, bun_test_1.expect)(constraintFinding).toBeDefined();
    // The contract's own constraint is the evidence — the session's
    // applicableConstraints stays empty because the rule fired on the R.
    (0, bun_test_1.expect)(constraintFinding.evidence.join("\n")).toContain("never commit directly");
    (0, bun_test_1.expect)(constraintFinding.planID).toBe("plan:1");
});
(0, bun_test_1.test)("changes without a contract produce only the advisory unverifiable finding (EI §3.8 P-1.b)", function () {
    var evaluate = (0, src_1.createDriftEvaluator)({
        openFindingIDs: function () { return new Set(); },
    }).evaluate;
    var findings = evaluate({
        objective: "edit the app",
        currentActivity: "edit the app:src/app.ts",
        applicableConstraints: [],
        changes: [{ path: "src/app.ts", action: "edit" }],
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(findings).toHaveLength(1);
    (0, bun_test_1.expect)(findings[0]).toMatchObject({
        severity: "advisory",
    });
    (0, bun_test_1.expect)(findings[0].planID).toBeUndefined();
    (0, bun_test_1.expect)(findings[0].ruleHits).toEqual([
        { rule: "unverifiable_no_contract", confidence: 0.5 },
    ]);
    (0, bun_test_1.expect)(findings[0].evidence).toContain("reference:no_accepted_contract");
});
(0, bun_test_1.test)("every finding carries contractVersion and ruleHits (EI §8.6)", function () {
    var evaluate = (0, src_1.createDriftEvaluator)({
        openFindingIDs: function () { return new Set(); },
    }).evaluate;
    var findings = evaluate({
        objective: "verify the parser",
        currentActivity: "edit:12 actions without parser files",
        applicableConstraints: [],
        changes: [{ path: "packages/x/src", action: "edit" }],
        evidenceRefs: [],
        contract: {
            planID: "plan:1",
            scope: [],
            verification: [],
            constraints: [],
        },
    });
    var evidenceGap = findings.find(function (finding) { var _a; return (_a = finding.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (hit) { return hit.rule === "evidence_gap"; }); });
    (0, bun_test_1.expect)(evidenceGap).toBeDefined();
    (0, bun_test_1.expect)(evidenceGap.contractVersion).toBe(src_1.DRIFT_CONTRACT_VERSION);
    (0, bun_test_1.expect)(evidenceGap.ruleHits.some(function (hit) { return hit.rule === "evidence_gap"; })).toBe(true);
});
(0, bun_test_1.test)("no-progress window opens an advisory finding after K actions with no marker", function () {
    var evaluator = makeEvaluator();
    // 8 plain tool_call actions, no progress marker.
    var actions = Array.from({ length: 8 }, function () { return ({
        kind: "tool_call",
    }); });
    var findings = evaluator.evaluate({
        sessionID: "ses_np",
        turnID: "t_np",
        objective: "ship the feature",
        currentActivity: "reading files",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        recentActions: actions,
    });
    var finding = findings.find(function (f) { var _a; return (_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (h) { return h.rule === "no_progress"; }); });
    (0, bun_test_1.expect)(finding).toBeDefined();
    (0, bun_test_1.expect)(finding.severity).toBe("advisory");
    // Session-scoped: the findingID carries no turnID.
    (0, bun_test_1.expect)(finding.findingID).toBe("drift:no_progress:session:ses_np");
});
(0, bun_test_1.test)("no-progress does not fire when a progress marker is in the window", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_np",
        turnID: "t_np",
        objective: "ship the feature",
        currentActivity: "reading files",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        recentActions: __spreadArray(__spreadArray([], Array.from({ length: 7 }, function () { return ({ kind: "tool_call" }); }), true), [
            { kind: "workspace_change" },
        ], false),
    });
    (0, bun_test_1.expect)(findings.some(function (f) { var _a; return (_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (h) { return h.rule === "no_progress"; }); })).toBe(false);
});
(0, bun_test_1.test)("no-progress does not fire before the window is full", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_np",
        turnID: "t_np",
        objective: "ship the feature",
        currentActivity: "reading files",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        recentActions: Array.from({ length: 7 }, function () { return ({
            kind: "tool_call",
        }); }),
    });
    (0, bun_test_1.expect)(findings.some(function (f) { var _a; return (_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (h) { return h.rule === "no_progress"; }); })).toBe(false);
});
(0, bun_test_1.test)("failure loop opens a warning at the threshold and carries only the tool name + count", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_fl",
        turnID: "t_fl",
        objective: "fix the build",
        currentActivity: "retrying the same command",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        recentFailures: [
            { toolName: "run_shell", key: "abc123" },
            { toolName: "run_shell", key: "abc123" },
            { toolName: "run_shell", key: "abc123" },
        ],
    });
    var finding = findings.find(function (f) { var _a; return (_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (h) { return h.rule === "failure_loop"; }); });
    (0, bun_test_1.expect)(finding).toBeDefined();
    (0, bun_test_1.expect)(finding.severity).toBe("warning");
    (0, bun_test_1.expect)(finding.findingID).toBe("drift:failure_loop:session:ses_fl");
    // Evidence carries the tool name + count, never the raw key/args.
    (0, bun_test_1.expect)(finding.evidence.some(function (e) { return e.includes("failure_loop:run_shell:3x"); })).toBe(true);
    (0, bun_test_1.expect)(finding.evidence.some(function (e) { return e.includes("abc123"); })).toBe(false);
});
(0, bun_test_1.test)("failure loop does not fire below the threshold or across different keys", function () {
    var evaluator = makeEvaluator();
    var below = evaluator.evaluate({
        sessionID: "ses_fl",
        turnID: "t_fl",
        objective: "fix the build",
        currentActivity: "retrying",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        recentFailures: [
            { toolName: "run_shell", key: "abc123" },
            { toolName: "run_shell", key: "abc123" },
        ],
    });
    (0, bun_test_1.expect)(below.some(function (f) { var _a; return (_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (h) { return h.rule === "failure_loop"; }); })).toBe(false);
    var distinct = evaluator.evaluate({
        sessionID: "ses_fl",
        turnID: "t_fl",
        objective: "fix the build",
        currentActivity: "retrying",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        recentFailures: [
            { toolName: "run_shell", key: "abc123" },
            { toolName: "run_shell", key: "def456" },
            { toolName: "run_shell", key: "ghi789" },
        ],
    });
    (0, bun_test_1.expect)(distinct.some(function (f) { var _a; return (_a = f.ruleHits) === null || _a === void 0 ? void 0 : _a.some(function (h) { return h.rule === "failure_loop"; }); })).toBe(false);
});
(0, bun_test_1.test)("a change matching a deny constitution rule opens a high constitution_conflict finding", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_cc",
        turnID: "t_cc",
        objective: "ship the change",
        currentActivity: "edit:secrets.env",
        applicableConstraints: [],
        changes: [{ path: "secrets.env", action: "modified" }],
        evidenceRefs: [],
        constitutionHits: [{ ruleID: "C-TERM-001", enforcement: "deny" }],
    });
    var finding = findings.find(function (f) { var _a; return ((_a = f.ruleHits) !== null && _a !== void 0 ? _a : []).some(function (h) { return h.rule === "constitution_conflict"; }); });
    (0, bun_test_1.expect)(finding).toBeDefined();
    (0, bun_test_1.expect)(finding.severity).toBe("high");
    (0, bun_test_1.expect)(finding.evidence).toContain("constitution:C-TERM-001");
});
(0, bun_test_1.test)("a warn/approval constitution hit does not open a conflict finding", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_cc",
        turnID: "t_cc",
        objective: "ship the change",
        currentActivity: "edit:foo.ts",
        applicableConstraints: [],
        changes: [{ path: "foo.ts", action: "modified" }],
        evidenceRefs: [],
        constitutionHits: [{ ruleID: "C-X", enforcement: "warn" }],
    });
    (0, bun_test_1.expect)(findings.some(function (f) { var _a; return ((_a = f.ruleHits) !== null && _a !== void 0 ? _a : []).some(function (h) { return h.rule === "constitution_conflict"; }); })).toBe(false);
});
(0, bun_test_1.test)("pathInScope matches the target itself and anything nested under it", function () {
    (0, bun_test_1.expect)((0, src_1.pathInScope)("packages/a", ["packages/a"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.pathInScope)("packages/a/x.ts", ["packages/a"])).toBe(true);
    (0, bun_test_1.expect)((0, src_1.pathInScope)("packages/b/x.ts", ["packages/a"])).toBe(false);
    // A prefix without a path boundary is not a scope hit.
    (0, bun_test_1.expect)((0, src_1.pathInScope)("packages/ab/x.ts", ["packages/a"])).toBe(false);
});
(0, bun_test_1.test)("a target_drift finding is auto-corrected only when the scope absorbs it", function () {
    var finding = {
        planID: "plan_1",
        evidence: [
            "outside_target:packages/b/x.ts",
            "outside_target:packages/b/y.ts",
        ],
    };
    // The revised scope covers every flagged path -> the premise is gone.
    (0, bun_test_1.expect)((0, src_1.targetDriftAbsorbedByScope)({
        finding: finding,
        planID: "plan_1",
        scope: ["packages/a", "packages/b"],
    })).toBe(true);
    // One path left outside -> not corrected.
    (0, bun_test_1.expect)((0, src_1.targetDriftAbsorbedByScope)({
        finding: {
            planID: "plan_1",
            evidence: ["outside_target:packages/b/x.ts"],
        },
        planID: "plan_1",
        scope: ["packages/a"],
    })).toBe(false);
    // A different plan, a non-target_drift finding, or a planless finding: never.
    (0, bun_test_1.expect)((0, src_1.targetDriftAbsorbedByScope)({
        finding: finding,
        planID: "plan_2",
        scope: ["packages/b"],
    })).toBe(false);
    (0, bun_test_1.expect)((0, src_1.targetDriftAbsorbedByScope)({
        finding: {
            planID: "plan_1",
            evidence: ["reference:no_accepted_contract"],
        },
        planID: "plan_1",
        scope: ["packages/b"],
    })).toBe(false);
    (0, bun_test_1.expect)((0, src_1.targetDriftAbsorbedByScope)({
        finding: { evidence: ["outside_target:packages/b/x.ts"] },
        planID: "plan_1",
        scope: ["packages/b"],
    })).toBe(false);
});
(0, bun_test_1.test)("target_drift evidence shape matches the auto-correction parser", function () {
    var evaluator = makeEvaluator();
    var findings = evaluator.evaluate({
        sessionID: "ses_td",
        turnID: "t_td",
        objective: "ship it",
        currentActivity: "modify:packages/b/x.ts",
        applicableConstraints: [],
        changes: [{ path: "packages/b/x.ts", action: "modified" }],
        evidenceRefs: [],
        contract: { planID: "plan_1", scope: ["packages/a"] },
    });
    var targetDrift = findings.find(function (f) { var _a; return ((_a = f.ruleHits) !== null && _a !== void 0 ? _a : []).some(function (h) { return h.rule === "target_drift"; }); });
    (0, bun_test_1.expect)(targetDrift).toBeDefined();
    (0, bun_test_1.expect)(Array.isArray(targetDrift.evidence)).toBe(true);
    (0, bun_test_1.expect)(targetDrift.evidence.some(function (entry) { return entry.startsWith("outside_target:"); })).toBe(true);
    (0, bun_test_1.expect)(targetDrift.planID).toBe("plan_1");
});
(0, bun_test_1.test)("an open invariant violation is a drift signal — the D3 linkage", function () { return __awaiter(void 0, void 0, void 0, function () {
    var evaluator, base, withHits;
    return __generator(this, function (_a) {
        evaluator = makeEvaluator();
        base = {
            sessionID: "ses_inv",
            turnID: "t_inv",
            objective: "fix the parser",
            currentActivity: "rewriting config",
            applicableConstraints: [],
            changes: [],
            evidenceRefs: [],
            recentActions: [{ kind: "tool_call" }],
            recentFailures: [],
        };
        withHits = evaluator.evaluateBehavior(__assign(__assign({}, base), { invariantHits: [
                {
                    code: "session.projection_incomplete",
                    at: "2026-01-01T00:00:00.000Z",
                    detail: "ses_inv ran turns",
                },
            ] }));
        (0, bun_test_1.expect)(withHits).toHaveLength(1);
        (0, bun_test_1.expect)(withHits[0]).toMatchObject({
            severity: "warning",
        });
        (0, bun_test_1.expect)(withHits[0].ruleHits).toEqual([
            { rule: "invariant_violation", confidence: 0.75 },
        ]);
        // Secret-safe citation only: code + timestamp, never the detail prose.
        (0, bun_test_1.expect)(withHits[0].evidence).toEqual([
            "invariant:session.projection_incomplete@2026-01-01T00:00:00.000Z",
        ]);
        (0, bun_test_1.expect)(withHits[0].evidence.join()).not.toContain("ran turns");
        // No open violations -> this rule stays quiet.
        (0, bun_test_1.expect)(evaluate(base)).toEqual([]);
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("an already-open invariant finding is not reopened", function () {
    var open = new Set(["drift:invariant_violation:session:ses_inv"]);
    var evaluator = (0, src_1.createDriftEvaluator)({ openFindingIDs: function () { return open; } });
    var findings = evaluator.evaluateBehavior({
        sessionID: "ses_inv",
        turnID: "t_2",
        objective: "o",
        currentActivity: "",
        applicableConstraints: [],
        changes: [],
        evidenceRefs: [],
        invariantHits: [{ code: "c", at: "2026-01-01T00:00:00.000Z", detail: "d" }],
    });
    (0, bun_test_1.expect)(findings).toEqual([]); // one fact per divergence, not per evaluation
});
function evaluate(signal) {
    return makeEvaluator().evaluate(signal);
}
