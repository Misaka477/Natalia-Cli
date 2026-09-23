"use strict";
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
exports.checkContractAgainstConstitution = checkContractAgainstConstitution;
var governance_ledger_1 = require("@natalia/governance-ledger");
/**
 * Strips prose decoration around a token (backticks, quotes, brackets, and
 * trailing sentence punctuation) so `edit `.env` now` yields `.env`.
 */
function cleanToken(raw) {
    return raw.replace(/^[\s"'`([{<]+/u, "").replace(/[\s"'`)\]}>.,;:!?]+$/u, "");
}
/**
 * True when a token names a path: it carries a path separator (`/`), a
 * leading dot (`.env`, `.github/workflows`), or is a glob (`src/**`). Prose
 * entries ("no new runtime dependency", "delete the old evaluator") yield no
 * tokens, so the check stays silent unless the entry really names a path.
 */
function looksLikePathToken(token) {
    return (token.includes("/") ||
        (token.startsWith(".") && token.length > 1) ||
        token.includes("*"));
}
/** The path-like tokens one contract entry declares, decoration stripped. */
function entryPathTokens(entry) {
    var tokens = new Set();
    for (var _i = 0, _a = entry.split(/\s+/u); _i < _a.length; _i++) {
        var raw = _a[_i];
        var token = cleanToken(raw);
        if (token && looksLikePathToken(token))
            tokens.add(token);
    }
    return __spreadArray([], tokens, true);
}
/**
 * Checks contract entries against the effective deny constitution rules and
 * returns one conflict per (entry, matching path token, rule). Only deny rules
 * with a non-empty `appliesTo.paths` anchor participate; a token that is
 * itself a glob (or a bare directory) also conflicts when a deny pattern
 * lives under its literal prefix — the declared scope then covers the deny
 * path even if the token is broader.
 */
function checkContractAgainstConstitution(input) {
    var denyRules = input.rules.filter(function (rule) { var _a, _b; return rule.enforcement === "deny" && ((_b = (_a = rule.appliesTo) === null || _a === void 0 ? void 0 : _a.paths) === null || _b === void 0 ? void 0 : _b.length); });
    if (!denyRules.length)
        return [];
    var conflicts = [];
    var seen = new Set();
    for (var _i = 0, _a = input.entries; _i < _a.length; _i++) {
        var entry = _a[_i];
        var _loop_1 = function (token) {
            for (var _d = 0, denyRules_1 = denyRules; _d < denyRules_1.length; _d++) {
                var rule = denyRules_1[_d];
                var matched = rule.appliesTo.paths.some(function (pattern) {
                    return (0, governance_ledger_1.constitutionPathMatch)(pattern, token) ||
                        tokenUnderGlobPrefix(token, pattern);
                });
                if (!matched)
                    continue;
                var key = "".concat(rule.ruleID, "|").concat(entry, "|").concat(token);
                if (seen.has(key))
                    continue;
                seen.add(key);
                conflicts.push({ ruleID: rule.ruleID, entry: entry, path: token });
            }
        };
        for (var _b = 0, _c = entryPathTokens(entry); _b < _c.length; _b++) {
            var token = _c[_b];
            _loop_1(token);
        }
    }
    return conflicts;
}
/**
 * True when a token's literal directory prefix covers a deny pattern: the
 * token `src/**` or `src/` declares the whole `src/` subtree, so a deny
 * pattern anchored anywhere under it (`src/legacy/**`) is a contradiction.
 * Tokens with no glob and no trailing slash are plain paths and handled by
 * `constitutionPathMatch` alone.
 */
function tokenUnderGlobPrefix(token, pattern) {
    var prefix = token;
    if (prefix.endsWith("/")) {
        // already a directory
    }
    else if (prefix.includes("**")) {
        prefix = prefix.slice(0, prefix.indexOf("**"));
    }
    else if (prefix.includes("*")) {
        // A single-segment glob token (`src/*`) is still a path-level token; the
        // deny pattern must match it exactly under its own segments, which
        // constitutionPathMatch already covers in the pattern→token direction.
        return false;
    }
    else {
        return false;
    }
    if (!prefix)
        return false;
    var normalizedPrefix = prefix.replace(/^\.\//u, "");
    var normalizedPattern = pattern.replace(/^\.\//u, "");
    return normalizedPattern.startsWith(normalizedPrefix);
}
