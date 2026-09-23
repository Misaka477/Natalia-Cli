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
exports.PROSE_RELEVANCE_THRESHOLD = exports.DRIFT_FAILURE_LOOP_THRESHOLD = exports.DRIFT_NO_PROGRESS_WINDOW = exports.DRIFT_PROGRESS_MARKERS = exports.DRIFT_CONTRACT_VERSION = exports.DRIFT_FINDING_WRITER_OWNER = void 0;
exports.buildDriftFindingUpdate = buildDriftFindingUpdate;
exports.buildDriftFinding = buildDriftFinding;
exports.proseRelevanceQuestion = proseRelevanceQuestion;
exports.pathInScope = pathInScope;
exports.targetDriftAbsorbedByScope = targetDriftAbsorbedByScope;
exports.createDriftEvaluator = createDriftEvaluator;
exports.DRIFT_FINDING_WRITER_OWNER = "DriftEvaluator";
/**
 * The evaluation contract version (EI §8.6). Bumped when the rule set or the
 * scoring changes, so a finding is always judge-able against the contract
 * that opened it — a contractVersion mismatch means the finding predates the
 * current rules and must not be silently re-interpreted.
 */
exports.DRIFT_CONTRACT_VERSION = 2;
var FORBIDDEN_DRIFT_FACT_KEYS = new Set([
    "content",
    "diff",
    "patch",
    "command",
    "args",
    "arguments",
    "result",
    "output",
    "thinking",
    "reasoning",
    "context",
    "error",
    "stderr",
    "stdout",
]);
function assertSecretSafeDriftFact(fact) {
    for (var _i = 0, _a = Object.keys(fact); _i < _a.length; _i++) {
        var key = _a[_i];
        if (FORBIDDEN_DRIFT_FACT_KEYS.has(key))
            throw new Error("drift fact carries a forbidden field: ".concat(key));
    }
}
/** The action kinds that count as forward progress (EI Phase 2 no-progress). */
exports.DRIFT_PROGRESS_MARKERS = new Set([
    "workspace_change",
    "evidence.recorded",
    "plan_step",
    "completion.recorded",
]);
/** The no-progress window: this many recent actions with no marker fires it. */
exports.DRIFT_NO_PROGRESS_WINDOW = 8;
/** The failure-loop threshold: this many identical failures fires it. */
exports.DRIFT_FAILURE_LOOP_THRESHOLD = 3;
/** Redact secret-shaped tokens from anything that crosses into a finding. */
function redact(text) {
    return text.replace(/\b(?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*[^\s,;]+/giu, function (match) { return "".concat(match.split(/[:=]/u)[0], "=[REDACTED]"); });
}
/**
 * A finding's status transition (P7 D3: rationale acknowledgement). The Main
 * Agent acknowledges a finding as explained (with a rationale), disputes it,
 * or declares a sanctioned detour; the user dismisses it or the work corrects
 * it. `rationale` is safe prose — never a command, content or secret — and is
 * redacted before journaling.
 */
function buildDriftFindingUpdate(input) {
    var event = __assign({ type: "drift.finding_updated", id: input.id, findingID: input.findingID, status: input.status }, (input.rationale ? { rationale: redact(input.rationale) } : {}));
    assertSecretSafeDriftFact(event);
    return event;
}
function buildDriftFinding(input) {
    var _a;
    var event = __assign(__assign({ type: "drift.finding_opened", id: input.id, findingID: input.findingID, severity: input.severity, confidence: input.confidence, originalObjective: redact(input.originalObjective), currentActivity: redact(input.currentActivity), evidence: input.evidence.map(redact), applicableConstraints: input.applicableConstraints.map(redact), contractVersion: (_a = input.contractVersion) !== null && _a !== void 0 ? _a : exports.DRIFT_CONTRACT_VERSION }, (input.ruleHits ? { ruleHits: input.ruleHits } : {})), (input.planID ? { planID: input.planID } : {}));
    assertSecretSafeDriftFact(event);
    return event;
}
/**
 * CJK-aware token extraction (EI §8.6): Latin words split on non-word
 * characters; CJK text has no word separators, so it is split into
 * overlapping bigrams (plus unigrams for single-character coverage). The old
 * word-only metric scored Chinese objectives as zero overlap — the single
 * largest false-positive source.
 */
function tokens(text) {
    var set = new Set();
    var words = text.toLowerCase().split(/\W+/u).filter(Boolean);
    for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
        var word = words_1[_i];
        set.add(word);
    }
    var cjkRuns = text.toLowerCase().match(/[\u4e00-\u9fff\u3040-\u30ff]+/gu);
    for (var _a = 0, _b = cjkRuns !== null && cjkRuns !== void 0 ? cjkRuns : []; _a < _b.length; _a++) {
        var run = _b[_a];
        for (var index = 0; index < run.length; index += 1)
            set.add(run[index]);
        for (var index = 0; index + 1 < run.length; index += 1)
            set.add(run.slice(index, index + 2));
    }
    return set;
}
/**
 * Token-set containment, 0..1 (CJK-aware): the fraction of `right`'s tokens
 * that appear in `left`. Asymmetric on purpose — NOT Jaccard, so a long
 * objective does not dilute a short on-topic activity. Test-pinned by
 * proseRelevanceQuestion.
 */
function overlap(left, right) {
    var leftTokens = tokens(left);
    var rightTokens = tokens(right);
    if (!rightTokens.size || !leftTokens.size)
        return 0;
    var hits = 0;
    for (var _i = 0, rightTokens_1 = rightTokens; _i < rightTokens_1.length; _i++) {
        var token = rightTokens_1[_i];
        if (leftTokens.has(token))
            hits += 1;
    }
    return hits / rightTokens.size;
}
/**
 * Bounds a comma-joined activity list by ITEM count, never mid-item (EI §2
 * principle 2: the finding carries refs, and a char slice would cut
 * "deleted:path" into "dele"). The list keeps its first `maxItems` entries and
 * states how many were dropped, so the card is bounded but never lies about
 * what it shows.
 */
/**
 * How many activity refs a finding keeps. High enough that a normal turn's
 * change set is stored whole (so the card can offer "view all"), with a safety
 * net for a pathological turn; beyond it the dropped count is stated.
 */
var MAX_ACTIVITY_REFS = 500;
function boundActivity(text, maxItems) {
    var items = text
        .split(",")
        .map(function (entry) { return entry.trim(); })
        .filter(function (entry) { return entry.length > 0; });
    if (items.length <= 1 || items.length <= maxItems)
        return text;
    return "".concat(items.slice(0, maxItems).join(", "), ", \u2026+").concat(items.length - maxItems, " more");
}
/** The prose-relevance 问通道 threshold (EI Phase 2): below this overlap, ask. */
exports.PROSE_RELEVANCE_THRESHOLD = 0.15;
/**
 * The prose-relevance 问通道 (EI Phase 2, 机制 3): when there is no accepted
 * contract (so the judge channel is silent) and the main agent's recent activity
 * barely relates to the goal objective, ASK — do not judge. Returns a question
 * prompt, or undefined when on-track or a contract governs. This is a 问 (an
 * interaction), not a finding: it is not journaled and is shown for the current
 * turn only. The objective_activity_mismatch rule that used to open an advisory
 * finding here is the false-positive source this replaces.
 */
function proseRelevanceQuestion(signal) {
    if (signal.contract)
        return undefined;
    var objective = signal.objective.trim();
    var activity = signal.currentActivity.trim();
    if (!objective || !activity)
        return undefined;
    if (overlap(objective, activity) >= exports.PROSE_RELEVANCE_THRESHOLD)
        return undefined;
    var clip = function (value) {
        return value.length > 120 ? "".concat(value.slice(0, 120), "\u2026") : value;
    };
    return "\u4F60\u6700\u8FD1\u5728\u505A\u300C".concat(clip(activity), "\u300D\uFF0C\u4E0E\u76EE\u6807\u300C").concat(clip(objective), "\u300D\u7684\u5173\u8054\u4E0D\u5927\u2014\u2014\u786E\u8BA4\u5728\u63A8\u8FDB\u76EE\u6807\u5417\uFF1F");
}
function constraintViolationRule() {
    // Constraint-adjacent words: when the current activity touches something a
    // constraint forbids, flag it. The constraint sentence itself is the
    // evidence, never a command or content.
    var forbiddenWords = new Set([
        "commit",
        "push",
        "delete",
        "remove",
        "rewrite",
        "ignore",
        "skip",
        "bypass",
    ]);
    return {
        name: "constraint_violation_signal",
        severity: "high",
        match: function (signal) {
            var _a, _b;
            var activity = signal.currentActivity.toLowerCase();
            // The R's committed constraints join the session's applicable ones:
            // the user's own constraint is as binding as a seeded rule.
            var constraints = __spreadArray(__spreadArray([], signal.applicableConstraints, true), ((_b = (_a = signal.contract) === null || _a === void 0 ? void 0 : _a.constraints) !== null && _b !== void 0 ? _b : []), true).filter(function (constraint) {
                return constraint.split(/\W+/u).some(function (word) { return forbiddenWords.has(word); });
            });
            if (!constraints.length)
                return undefined;
            var activityHits = __spreadArray([], forbiddenWords, true).filter(function (word) {
                return activity.includes(word);
            });
            if (!activityHits.length)
                return undefined;
            return {
                confidence: 0.75 + 0.05 * Math.min(activityHits.length, 5),
                evidence: [
                    "constraint:".concat(constraints[0].slice(0, 120)),
                    "activity_signal:".concat(activityHits.join(",")),
                ],
            };
        },
    };
}
function evidenceGapRule() {
    return {
        name: "evidence_gap",
        severity: "warning",
        match: function (signal) {
            var _a, _b;
            // An objective (or committed verification) that says "verify"/"test"/
            // "check" but has collected no evidence refs and changed files is a
            // completion gap.
            var verification = __spreadArray([
                signal.objective
            ], ((_b = (_a = signal.contract) === null || _a === void 0 ? void 0 : _a.verification) !== null && _b !== void 0 ? _b : []), true).join(" ");
            if (!/verify|test|check|validate/iu.test(verification))
                return undefined;
            if (signal.evidenceRefs.length > 0)
                return undefined;
            if (!signal.changes.length)
                return undefined;
            return {
                confidence: 0.7,
                evidence: ["completion:no_evidence_refs"],
            };
        },
    };
}
/**
 * D4 `dependency_signal`: a change to a dependency manifest or lockfile when
 * the objective has nothing to do with dependencies is a mild drift signal.
 */
var DEPENDENCY_MANIFESTS = [
    "package.json",
    "bun.lock",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.toml",
    "Cargo.lock",
    "requirements.txt",
    "pyproject.toml",
];
function dependencyRule() {
    return {
        name: "dependency_signal",
        severity: "advisory",
        match: function (signal) {
            var depChange = signal.changes.find(function (change) {
                return DEPENDENCY_MANIFESTS.some(function (manifest) { var _a; return change.path === manifest || ((_a = change.path) === null || _a === void 0 ? void 0 : _a.endsWith("/".concat(manifest))); });
            });
            if (!depChange)
                return undefined;
            if (/\bdependen\w*|install\w*|lockfile|manifest\w*/iu.test(signal.objective))
                return undefined;
            return {
                confidence: 0.55,
                evidence: ["dependency:".concat(depChange.path)],
            };
        },
    };
}
/**
 * D4 `target_drift`: a change lands outside the directory the objective names
 * (e.g. objective says "src" but the change touched "dist"). The objective's
 * quoted path segments — and the R's committed scope — are the expected
 * targets.
 */
/**
 * True when `path` sits inside one of the scope targets (equal, or nested
 * under it). Shared by the target_drift rule and the contract-revision
 * auto-correction so the two never disagree about what "inside the scope"
 * means.
 */
function pathInScope(path, scope) {
    return scope.some(function (target) {
        return Boolean(target) && (path === target || path.startsWith("".concat(target, "/")));
    });
}
/**
 * EI §3.4 auto-correction: a target_drift finding is corrected when a contract
 * revision absorbs every path it flagged into the new scope — the reference
 * frame moved to meet the work, so the finding's premise is gone (the same way
 * an approved detour does). Pure; the caller owns the journal write.
 */
function targetDriftAbsorbedByScope(input) {
    var _a;
    if (input.finding.planID !== input.planID)
        return false;
    var outside = ((_a = input.finding.evidence) !== null && _a !== void 0 ? _a : [])
        .filter(function (entry) { return entry.startsWith("outside_target:"); })
        .map(function (entry) { return entry.slice("outside_target:".length); });
    if (!outside.length)
        return false;
    return outside.every(function (changedPath) { return pathInScope(changedPath, input.scope); });
}
function targetDriftRule() {
    return {
        name: "target_drift",
        severity: "advisory",
        match: function (signal) {
            var _a, _b;
            var targets = __spreadArray(__spreadArray([], __spreadArray([], signal.objective.matchAll(/"([^"]+)"/gu), true).map(function (match) {
                return match[1].replace(/^\.\//u, "").replace(/\/$/u, "");
            }), true), ((_b = (_a = signal.contract) === null || _a === void 0 ? void 0 : _a.scope) !== null && _b !== void 0 ? _b : []), true);
            if (!targets.length || !signal.changes.length)
                return undefined;
            var outside = signal.changes.filter(function (change) { return change.path && !pathInScope(change.path, targets); });
            if (!outside.length)
                return undefined;
            return {
                confidence: 0.6,
                evidence: outside.map(function (change) { return "outside_target:".concat(change.path); }),
            };
        },
    };
}
/**
 * The advisory "no reference frame" finding (EI §3.8 P-1.b): changes exist
 * but the user has not committed to a WorkContract. It is deliberately
 * advisory-only and named, so a UI can show "no commitment yet" instead of a
 * drift score against nothing.
 */
function unverifiableRule() {
    return {
        name: "unverifiable_no_contract",
        severity: "advisory",
        match: function (signal) {
            if (signal.contract)
                return undefined;
            if (!signal.changes.length)
                return undefined;
            return {
                confidence: 0.5,
                evidence: ["reference:no_accepted_contract"],
            };
        },
    };
}
/**
 * No-progress window (EI Phase 2, 机制 2 — an L4 runtime behaviour signal that
 * runs even without a contract). If the last `DRIFT_NO_PROGRESS_WINDOW` actions
 * carry no progress marker (only plain tool_call actions), the work is spinning
 * without advancing → an advisory finding. Counts only, never content.
 */
function noProgressRule() {
    return {
        name: "no_progress",
        severity: "advisory",
        sessionScoped: true,
        match: function (signal) {
            var _a;
            var actions = (_a = signal.recentActions) !== null && _a !== void 0 ? _a : [];
            if (actions.length < exports.DRIFT_NO_PROGRESS_WINDOW)
                return undefined;
            var tail = actions.slice(-exports.DRIFT_NO_PROGRESS_WINDOW);
            if (tail.some(function (action) { return exports.DRIFT_PROGRESS_MARKERS.has(action.kind); }))
                return undefined;
            return {
                confidence: 0.6,
                evidence: [
                    "no_progress:last_".concat(exports.DRIFT_NO_PROGRESS_WINDOW, "_actions"),
                    "marker:none",
                ],
            };
        },
    };
}
/**
 * Consecutive failure loop (EI Phase 2, 机制 2 — L4). The same
 * (toolName + normalized key) failing ≥ threshold times means the agent is stuck
 * retrying the same thing → a warning. The key is secret-safe (a hash); only the
 * tool name and the count are carried as evidence.
 */
function failureLoopRule() {
    return {
        name: "failure_loop",
        severity: "warning",
        sessionScoped: true,
        match: function (signal) {
            var _a, _b;
            var failures = (_a = signal.recentFailures) !== null && _a !== void 0 ? _a : [];
            var counts = new Map();
            for (var _i = 0, failures_1 = failures; _i < failures_1.length; _i++) {
                var failure = failures_1[_i];
                var id = "".concat(failure.toolName, "::").concat(failure.key);
                var entry = (_b = counts.get(id)) !== null && _b !== void 0 ? _b : {
                    toolName: failure.toolName,
                    count: 0,
                };
                entry.count += 1;
                counts.set(id, entry);
            }
            for (var _c = 0, _d = counts.values(); _c < _d.length; _c++) {
                var entry = _d[_c];
                if (entry.count >= exports.DRIFT_FAILURE_LOOP_THRESHOLD) {
                    return {
                        confidence: 0.7,
                        evidence: [
                            "failure_loop:".concat(entry.toolName, ":").concat(entry.count, "x"),
                            "threshold:".concat(exports.DRIFT_FAILURE_LOOP_THRESHOLD),
                        ],
                    };
                }
            }
            return undefined;
        },
    };
}
/**
 * Constitution conflict (EI Phase 2 判定矩阵, L0 high/判): a change that matches
 * a deny constitution rule is the strongest divergence signal. The approval
 * layer already intercepts the tool call; this finding records the conflict for
 * the audit trail / Work Graph / Nia audit.
 */
/**
 * An open domain-invariant violation near this turn (Discovery D3
 * linkage: D2 -> R6). Session-scoped like the other behaviour signals: a
 * broken data relation needs no WorkContract to be a fact, and the
 * evaluator still has no write power — the finding only escalates to the
 * review surfaces.
 */
function invariantViolationRule() {
    return {
        name: "invariant_violation",
        severity: "warning",
        sessionScoped: true,
        match: function (signal) {
            var _a;
            var hits = (_a = signal.invariantHits) !== null && _a !== void 0 ? _a : [];
            if (!hits.length)
                return undefined;
            return {
                confidence: 0.75,
                evidence: hits.map(function (hit) { return "invariant:".concat(hit.code, "@").concat(hit.at); }),
            };
        },
    };
}
function constitutionConflictRule() {
    return {
        name: "constitution_conflict",
        severity: "high",
        match: function (signal) {
            var _a;
            var denyHits = ((_a = signal.constitutionHits) !== null && _a !== void 0 ? _a : []).filter(function (hit) { return hit.enforcement === "deny"; });
            if (!denyHits.length)
                return undefined;
            return {
                confidence: 0.9,
                evidence: denyHits.map(function (hit) { return "constitution:".concat(hit.ruleID); }),
            };
        },
    };
}
function createDriftEvaluator(input) {
    var _a;
    var minimumConfidence = (_a = input.minimumConfidence) !== null && _a !== void 0 ? _a : 0.5;
    var rules = [
        constraintViolationRule(),
        evidenceGapRule(),
        dependencyRule(),
        targetDriftRule(),
        unverifiableRule(),
        noProgressRule(),
        failureLoopRule(),
        constitutionConflictRule(),
        invariantViolationRule(),
    ];
    /**
     * Evaluate a turn's signals against the rules. Returns the findings to open,
     * each ready to publish. Findings already open (per `openFindingIDs`) are not
     * reopened — a finding is one fact per divergence, not one per evaluation.
     * D4: a rule result below `minimumConfidence` is not opened (false-positive
     * tuning — weak signals should not spam the ledger).
     */
    function runRules(rulesToRun, signal) {
        var _a, _b, _c, _d;
        var open = input.openFindingIDs();
        var findings = [];
        for (var _i = 0, rulesToRun_1 = rulesToRun; _i < rulesToRun_1.length; _i++) {
            var rule = rulesToRun_1[_i];
            var result = rule.match(signal);
            if (!result)
                continue;
            if (result.confidence < minimumConfidence)
                continue;
            var findingID = rule.sessionScoped
                ? "drift:".concat(rule.name, ":session:").concat((_a = signal.sessionID) !== null && _a !== void 0 ? _a : "")
                : "drift:".concat(rule.name, ":").concat((_b = signal.turnID) !== null && _b !== void 0 ? _b : "session", ":").concat((_c = signal.sessionID) !== null && _c !== void 0 ? _c : "");
            if (open.has(findingID))
                continue;
            findings.push(buildDriftFinding(__assign({ id: "drift:".concat(Date.now().toString(36), ":").concat(rule.name), findingID: findingID, severity: rule.severity, confidence: result.confidence, originalObjective: signal.objective.slice(0, 200), currentActivity: boundActivity(signal.currentActivity, MAX_ACTIVITY_REFS), evidence: result.evidence, applicableConstraints: signal.applicableConstraints, contractVersion: exports.DRIFT_CONTRACT_VERSION, 
                // Each finding carries only its own rule hit — a per-rule finding
                // must not inherit the hits of rules that fired before it.
                ruleHits: [{ rule: rule.name, confidence: result.confidence }] }, (((_d = signal.contract) === null || _d === void 0 ? void 0 : _d.planID)
                ? { planID: signal.contract.planID }
                : {}))));
        }
        return findings;
    }
    function evaluate(signal) {
        return runRules(rules, signal);
    }
    /**
     * Evaluate only the L4 behaviour signals (no-progress / failure loop) — used
     * at turn-end when there were no workspace changes, so a spinning agent still
     * opens a finding without the contract/objective rules firing on an empty
     * activity.
     */
    function evaluateBehavior(signal) {
        return runRules(rules.filter(function (rule) { return rule.sessionScoped; }), signal);
    }
    return { evaluate: evaluate, evaluateBehavior: evaluateBehavior };
}
