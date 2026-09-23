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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATH_CLASS_EVIDENCE = exports.MINIMUM_EVIDENCE_MATRIX = void 0;
exports.isPlaceholderContractValue = isPlaceholderContractValue;
exports.validateWorkContractFields = validateWorkContractFields;
exports.isUnverifiableContract = isUnverifiableContract;
exports.buildWorkContractDrafted = buildWorkContractDrafted;
exports.buildWorkContractAccepted = buildWorkContractAccepted;
exports.classifyPathClass = classifyPathClass;
exports.classifyTaskKind = classifyTaskKind;
exports.evaluateCompletionCard = evaluateCompletionCard;
exports.buildDetourRequested = buildDetourRequested;
exports.buildDetourReviewed = buildDetourReviewed;
exports.validateDetour = validateDetour;
exports.mergeDetourIntoContract = mergeDetourIntoContract;
/** Pure generic words that carry no commitment, in either language. */
var GENERIC_PLACEHOLDERS = new Set([
    "all",
    "everything",
    "anything",
    "any",
    "none",
    "n/a",
    "na",
    "tbd",
    "todo",
    "misc",
    "various",
    "stuff",
    "things",
    "everything else",
    "all files",
    "全部",
    "所有",
    "任何",
    "一切",
    "相关",
    "待定",
    "未定",
    "略",
]);
/** True when a single field value carries no real commitment. */
function isPlaceholderContractValue(value) {
    var trimmed = value.trim();
    if (trimmed.length <= 1)
        return true;
    return GENERIC_PLACEHOLDERS.has(trimmed.toLowerCase());
}
/**
 * Validates a proposed draft's fields (EI §8.2 runtime validation):
 *
 * - a provided field must be a non-empty array (an empty array provided means
 *   the proposer did not actually extract anything);
 * - no value may be a placeholder (single character or a pure generic word).
 *
 * Returns the rejection reasons; an empty array means the draft is valid.
 * An all-empty draft is NOT invalid — it produces an `unverifiable` acceptance
 * (advisory-only judgment), per EI §3.8 P-1.b.
 */
function validateWorkContractFields(fields) {
    var problems = [];
    for (var _i = 0, _a = ["scope", "verification", "constraints"]; _i < _a.length; _i++) {
        var field = _a[_i];
        var values = fields[field];
        if (values === undefined)
            continue;
        if (!Array.isArray(values) || values.length === 0) {
            problems.push("".concat(field, " was provided but is empty; omit it or extract concrete entries"));
            continue;
        }
        for (var _b = 0, values_1 = values; _b < values_1.length; _b++) {
            var value = values_1[_b];
            if (typeof value !== "string" || !value.trim()) {
                problems.push("".concat(field, " contains an empty entry"));
                continue;
            }
            if (isPlaceholderContractValue(value))
                problems.push("".concat(field, " entry \"").concat(value.trim().slice(0, 40), "\" is a placeholder; extract concrete entries"));
        }
    }
    return problems;
}
/** True when the draft extracted no structured fields at all. */
function isUnverifiableContract(fields) {
    var _a, _b, _c, _d, _e, _f;
    return (!((_b = (_a = fields.scope) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : false) &&
        !((_d = (_c = fields.verification) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : false) &&
        !((_f = (_e = fields.constraints) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : false));
}
/**
 * Builds a `work_contract.drafted` event. Repeatable: a rejected draft is
 * re-proposed with the user's feedback folded in, and the projection keeps the
 * latest draft per plan. Empty field arrays are omitted rather than emitted as
 * `[]` so a consumer can tell "nothing extracted" from "empty extraction".
 */
function buildWorkContractDrafted(input) {
    return __assign(__assign(__assign(__assign({ type: "work_contract.drafted", id: input.id, planID: input.planID, planVersion: input.planVersion }, (input.scope && input.scope.length ? { scope: input.scope } : {})), (input.verification && input.verification.length
        ? { verification: input.verification }
        : {})), (input.constraints && input.constraints.length
        ? { constraints: input.constraints }
        : {})), { draftedAt: input.draftedAt, source: "model" });
}
/**
 * Builds the user-approved `work_contract.accepted` event — the R drift is
 * judged against. `acceptedBy` is always "user": only a user confirmation
 * makes a contract judge-able (EI §3.3 铁律). `unverifiable` marks a plan
 * approved with no extractable fields (advisory-only judgment).
 */
function buildWorkContractAccepted(input) {
    return __assign(__assign(__assign(__assign(__assign({ type: "work_contract.accepted", id: input.id, planID: input.planID, planVersion: input.planVersion }, (input.scope && input.scope.length ? { scope: input.scope } : {})), (input.verification && input.verification.length
        ? { verification: input.verification }
        : {})), (input.constraints && input.constraints.length
        ? { constraints: input.constraints }
        : {})), { acceptedBy: "user", acceptedAt: input.acceptedAt }), (input.unverifiable ? { unverifiable: true } : {}));
}
/**
 * The minimum evidence matrix (EI §8.8): which validation evidence each task
 * kind needs before a completion claim is judge-able. `patterns` are matched
 * against the objective and committed scope; `requires` names the evidence
 * classes the completion card must show.
 */
exports.MINIMUM_EVIDENCE_MATRIX = {
    dependency: {
        patterns: /\bdependen\w*|install\w*|upgrade|bump|lockfile|manifest\w*|package\.json|bun\.lock|cargo|pyproject|requirements\b/iu,
        requires: ["validation:install", "validation:typecheck"],
        note: "a dependency change must show the install and typecheck evidence",
    },
    parser: {
        patterns: /\bparser|parsing|tokeniz\w*|lexer|grammar|AST\b/iu,
        requires: ["validation:parser"],
        note: "a parser change must show parser test evidence",
    },
    test: {
        patterns: /\btest|spec|coverage|assertion/iu,
        requires: ["validation:test"],
        note: "a test change must show the test-run evidence",
    },
    docs: {
        patterns: /\bdocs?\b|readme|documentation|comment\w*|constitution\.md|agents\.md/iu,
        requires: [],
        note: "a docs-only change needs no runtime validation",
    },
    config: {
        patterns: /\bconfig|settings?|\.env|tsconfig|permissionMode/iu,
        requires: ["validation:typecheck"],
        note: "a config change must show a typecheck or load check",
    },
    code: {
        patterns: /.*/u,
        requires: ["validation:test"],
        note: "a code change must show a test or equivalent validation",
    },
};
/** Classify one path by extension / layout. */
function pathClassOf(path) {
    var p = path.toLowerCase().replace(/\\/gu, "/");
    if (/\.(test|spec)\.[cm]?[jt]sx?$|__tests__\/|\/tests?\//iu.test(p))
        return "test";
    if (/\.(md|mdx|txt|rst|adoc)$/iu.test(p))
        return "docs";
    if (/(^|\/)(package\.json|package-lock\.json|bun\.lockb?|yarn\.lock|pnpm-lock\.ya?ml|tsconfig[^/]*\.json|deno\.json|\.env[^/]*)$/iu.test(p) ||
        /\.(ya?ml|toml|ini|cfg|conf)$/iu.test(p))
        return "config";
    if (/\.(ts|tsx|js|jsx|mjs|cjs|rs|go|py|rb|java|kt|kts|scala|c|cc|cpp|cxx|h|hpp|cs|swift|zig|nim|lua|php|ex|exs|erl|hs|ml|clj|dart)$/iu.test(p))
        return "source";
    return "other";
}
/**
 * Classify a change set into one path class (EI §8.8). The highest-evidence
 * requirement wins, so a mixed source+docs change is treated as source (it must
 * still be validated). An empty set is "other".
 */
function classifyPathClass(paths) {
    if (!paths.length)
        return "other";
    var classes = paths.map(pathClassOf);
    if (classes.includes("test"))
        return "test";
    if (classes.includes("source"))
        return "source";
    if (classes.includes("config"))
        return "config";
    if (classes.includes("docs"))
        return "docs";
    return "other";
}
/**
 * The path-class minimum-evidence matrix (EI §8.8 / Phase 4 E3): a source or
 * test change must show at least one passing validation; docs / config / other
 * need none (unverified is acceptable and labelled).
 */
exports.PATH_CLASS_EVIDENCE = {
    source: {
        requires: ["validation:any"],
        note: "a source change must show at least one passing validation",
    },
    test: {
        requires: ["validation:test"],
        note: "a test change must show the test-run evidence",
    },
    docs: { requires: [], note: "a docs change needs no runtime validation" },
    config: { requires: [], note: "a config change needs no runtime validation" },
    other: { requires: [], note: "no runtime validation required" },
};
/** Classifies an objective (+ optional committed scope) into a task kind. */
function classifyTaskKind(objective, scope) {
    if (scope === void 0) { scope = []; }
    var haystack = "".concat(objective, " ").concat(scope.join(" ")).toLowerCase();
    var kinds = ["dependency", "parser", "test", "docs", "config"];
    for (var _i = 0, kinds_1 = kinds; _i < kinds_1.length; _i++) {
        var kind = kinds_1[_i];
        if (exports.MINIMUM_EVIDENCE_MATRIX[kind].patterns.test(haystack))
            return kind;
    }
    return "code";
}
/**
 * The completion card's judgment (EI §8.8): given the task kind and the
 * evidence actually recorded, which required evidence classes are still
 * missing. An empty `missing` list means the completion claim is judge-able;
 * a docs-only task is always judge-able.
 */
function evaluateCompletionCard(input) {
    var _a, _b, _c, _d, _e;
    // Path-based classification is primary (EI §8.8: zero declaration, zero false
    // positive); the objective/scope text classifier is the fallback when no
    // change paths are known.
    var pathClass = ((_a = input.changes) === null || _a === void 0 ? void 0 : _a.length)
        ? classifyPathClass(input.changes)
        : undefined;
    var kind = pathClass !== null && pathClass !== void 0 ? pathClass : classifyTaskKind(input.objective, (_b = input.scope) !== null && _b !== void 0 ? _b : []);
    var matrix = pathClass
        ? exports.PATH_CLASS_EVIDENCE[pathClass]
        : exports.MINIMUM_EVIDENCE_MATRIX[kind];
    var present = new Set();
    for (var _i = 0, _f = input.evidenceRefs; _i < _f.length; _i++) {
        var reference = _f[_i];
        present.add(reference);
    }
    for (var _g = 0, _h = (_c = input.validations) !== null && _c !== void 0 ? _c : []; _g < _h.length; _g++) {
        var validation = _h[_g];
        var command = (_e = (_d = validation.command) === null || _d === void 0 ? void 0 : _d.toLowerCase()) !== null && _e !== void 0 ? _e : "";
        if (validation.result !== "passed")
            continue;
        present.add("validation:any");
        if (/bun install|npm install|pnpm install|yarn install/iu.test(command))
            present.add("validation:install");
        if (/tsc|typecheck/iu.test(command))
            present.add("validation:typecheck");
        if (/bun test|vitest|jest|pytest|go test|cargo test/iu.test(command)) {
            present.add("validation:test");
            if (/parser|tokeniz|lexer|grammar/iu.test(command))
                present.add("validation:parser");
        }
    }
    var missing = matrix.requires.filter(function (entry) { return !present.has(entry); });
    return {
        kind: kind,
        classifiedBy: pathClass ? "path" : "objective",
        requires: matrix.requires,
        missing: missing,
        judgeable: missing.length === 0,
        note: matrix.note,
    };
}
/**
 * Builds a `detour.requested` event (EI §3.4): the model declares it needs to
 * work outside the accepted contract's scope. `currentVersion` is the
 * optimistic lock against the accepted contract; the deltas are merged into a
 * new accepted contract (v+1) only after the user approves.
 */
function buildDetourRequested(input) {
    var _a, _b;
    return __assign(__assign(__assign({ type: "detour.requested", id: input.id, detourID: input.detourID, planID: input.planID, currentVersion: input.currentVersion, reason: input.reason, scopeDelta: input.scopeDelta }, (((_a = input.verificationDelta) === null || _a === void 0 ? void 0 : _a.length)
        ? { verificationDelta: input.verificationDelta }
        : {})), (((_b = input.constraintDelta) === null || _b === void 0 ? void 0 : _b.length)
        ? { constraintDelta: input.constraintDelta }
        : {})), { requestedAt: input.requestedAt, requestedBy: "model" });
}
/**
 * Builds a `detour.reviewed` event (EI §3.4): Nia's independent opinion
 * (approve / reject) or `unavailable` when Nia could not review. Nia's verdict
 * is always a reference; the user's approval lands as work_contract.accepted.
 */
function buildDetourReviewed(input) {
    return __assign(__assign({ type: "detour.reviewed", id: input.id, detourID: input.detourID, planID: input.planID, verdict: input.verdict }, (input.rationale ? { rationale: input.rationale } : {})), { reviewedBy: input.reviewedBy, reviewedAt: input.reviewedAt });
}
/**
 * Validates a detour declaration (EI §3.4): the reason must be non-empty and
 * at least one delta must be present (a detour that changes nothing is not a
 * detour). The scopeDelta must not overlap the accepted scope — a detour adds
 * new scope, it does not re-commit scope already covered. Returns the rejection
 * reasons; an empty array means the detour is valid.
 */
function validateDetour(input) {
    var _a, _b, _c, _d, _e;
    var problems = [];
    if (!input.reason.trim())
        problems.push("a detour requires a non-empty reason");
    var hasDelta = input.scopeDelta.length > 0 ||
        ((_b = (_a = input.verificationDelta) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0 ||
        ((_d = (_c = input.constraintDelta) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0) > 0;
    if (!hasDelta)
        problems.push("a detour requires at least one scope/verification/constraint delta");
    var _loop_1 = function (entry) {
        if (typeof entry !== "string" || !entry.trim()) {
            problems.push("scopeDelta contains an empty entry");
            return "continue";
        }
        if (isPlaceholderContractValue(entry))
            problems.push("scopeDelta entry \"".concat(entry.trim().slice(0, 40), "\" is a placeholder"));
        // A scopeDelta that overlaps the committed scope is not a detour — it is
        // already covered, so declaring it is a no-op the user should not gate on.
        if (((_e = input.currentScope) !== null && _e !== void 0 ? _e : []).some(function (existing) {
            return existing === entry.trim() ||
                entry.trim().startsWith("".concat(existing)) ||
                existing.startsWith(entry.trim());
        }))
            problems.push("scopeDelta entry \"".concat(entry.trim().slice(0, 40), "\" overlaps the accepted scope"));
    };
    for (var _i = 0, _f = input.scopeDelta; _i < _f.length; _i++) {
        var entry = _f[_i];
        _loop_1(entry);
    }
    return problems;
}
/**
 * Merges an approved detour's deltas into the accepted contract, producing the
 * next version's fields (EI §3.4): scope/verification/constraints are unions
 * (deduped, order-preserving). The objective direction never changes through a
 * detour — only the scope/verification/constraints increments are absorbed.
 */
function mergeDetourIntoContract(current, detour) {
    var _a, _b, _c, _d;
    var union = function () {
        var lists = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            lists[_i] = arguments[_i];
        }
        var seen = new Set();
        var result = [];
        for (var _a = 0, lists_1 = lists; _a < lists_1.length; _a++) {
            var list = lists_1[_a];
            for (var _b = 0, _c = list !== null && list !== void 0 ? list : []; _b < _c.length; _b++) {
                var entry = _c[_b];
                if (entry.trim() && !seen.has(entry)) {
                    seen.add(entry);
                    result.push(entry);
                }
            }
        }
        return result;
    };
    return __assign(__assign({ scope: union(current.scope, detour.scopeDelta) }, (((_a = current.verification) === null || _a === void 0 ? void 0 : _a.length) || ((_b = detour.verificationDelta) === null || _b === void 0 ? void 0 : _b.length)
        ? { verification: union(current.verification, detour.verificationDelta) }
        : {})), (((_c = current.constraints) === null || _c === void 0 ? void 0 : _c.length) || ((_d = detour.constraintDelta) === null || _d === void 0 ? void 0 : _d.length)
        ? { constraints: union(current.constraints, detour.constraintDelta) }
        : {}));
}
