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
exports.SELF_PROTECTION_RULES = void 0;
exports.constitutionPathMatch = constitutionPathMatch;
exports.seedConstitutionRules = seedConstitutionRules;
exports.recordDecision = recordDecision;
exports.validateConstitutionRuleProposal = validateConstitutionRuleProposal;
exports.buildProposedConstitutionRule = buildProposedConstitutionRule;
exports.buildPromotedConstitutionRule = buildPromotedConstitutionRule;
exports.buildUserConstitutionRule = buildUserConstitutionRule;
exports.buildConstitutionRuleUpdate = buildConstitutionRuleUpdate;
exports.buildConstitutionRuleRemoved = buildConstitutionRuleRemoved;
/**
 * Minimal constitution-rule path matching (EI §8.1 a/p/c wiring; the static
 * contract pre-check for the "契约 handoff 撞 constitution" open question
 * shares this one implementation): a rule's `appliesTo.paths` pattern matches
 * a path when the glob covers it. `*` matches within a segment, `**` matches
 * across segments; a bare directory pattern matches everything under it. Every
 * other character — including `?` — is literal, so a path or pattern carrying
 * `?` matches exactly (it is not a regex quantifier or a wildcard).
 * Pure and deterministic.
 */
function constitutionPathMatch(pattern, path) {
    var normalizedPattern = pattern.replace(/\\/gu, "/").replace(/^\.\//u, "");
    var normalizedPath = path.replace(/\\/gu, "/").replace(/^\.\//u, "");
    // Escape regex metacharacters (including `?`, which is literal here, not a
    // quantifier), then expand `**/`, `**` and `*`. `**` and `**/` go through
    // placeholders so their expansion (`.*`) is not re-matched by the `*` step —
    // expanding `**` straight to `.*` let the following `*` rule turn it into
    // `.[^/]*`, which silently broke a trailing/mid `**` (e.g. `src/**`).
    var GLOBSTAR = "\u0000";
    var DOUBLESTAR = "\u0001";
    var source = normalizedPattern
        .replace(/[.+^${}()|[\]\\?]/gu, "\\$&")
        .replace(/\*\*\//gu, GLOBSTAR)
        .replace(/\*\*/gu, DOUBLESTAR)
        .replace(/\*/gu, "[^/]*");
    var body = source
        .split(GLOBSTAR)
        .join("(?:.*/)?")
        .split(DOUBLESTAR)
        .join(".*");
    var regex = new RegExp("^".concat(body, "$"), "u");
    if (regex.test(normalizedPath))
        return true;
    // A directory pattern ("src/") also matches everything under it.
    return (normalizedPattern.endsWith("/") &&
        normalizedPath.startsWith(normalizedPattern));
}
/**
 * The built-in runtime self-protection rules, migrated verbatim from the
 * runtime's hard-coded matcher. This is the single source of truth for the rule
 * metadata; the runtime tool-execution path keeps the regex matcher and looks these up.
 */
exports.SELF_PROTECTION_RULES = [
    {
        ruleID: "C-TERM-001",
        statement: "禁止直接杀掉 wezterm-mux-server",
        enforcement: "deny",
    },
    {
        ruleID: "C-TERM-002",
        statement: "禁止删除 Natalia 运行时目录",
        enforcement: "deny",
    },
    {
        ruleID: "C-TERM-003",
        statement: "禁止删除 Natalia 临时目录",
        enforcement: "deny",
    },
    {
        ruleID: "C-REL-001",
        statement: "git 写操作强制审批",
        enforcement: "approval",
        overridePolicy: "user_scoped",
    },
    {
        ruleID: "C-REL-002",
        statement: "未知副作用不自动 replay",
        enforcement: "deny",
    },
];
/**
 * Builds the `constitution.rule_added` events for the self-protection rules,
 * skipping any ruleID already present in the journal. Called on every session
 * boot so the rules are durable facts in every new session, and harmless on
 * replay (the journal already holds them).
 */
function seedConstitutionRules(events) {
    var _a;
    var effective = new Map();
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        if (event_1.type === "constitution.rule_added") {
            if (!effective.has(event_1.ruleID))
                effective.set(event_1.ruleID, {
                    statement: event_1.statement,
                    priority: event_1.priority,
                    enforcement: event_1.enforcement,
                    overridePolicy: event_1.overridePolicy,
                });
            continue;
        }
        if (event_1.type === "constitution.rule_updated") {
            var current = effective.get(event_1.ruleID);
            if (!current)
                continue;
            effective.set(event_1.ruleID, __assign(__assign(__assign(__assign(__assign({}, current), (event_1.statement ? { statement: event_1.statement } : {})), (event_1.priority ? { priority: event_1.priority } : {})), (event_1.enforcement ? { enforcement: event_1.enforcement } : {})), (event_1.overridePolicy
                ? { overridePolicy: event_1.overridePolicy }
                : {})));
        }
    }
    var seeded = [];
    for (var _b = 0, SELF_PROTECTION_RULES_1 = exports.SELF_PROTECTION_RULES; _b < SELF_PROTECTION_RULES_1.length; _b++) {
        var rule = SELF_PROTECTION_RULES_1[_b];
        var overridePolicy = (_a = rule.overridePolicy) !== null && _a !== void 0 ? _a : "forbidden";
        var current = effective.get(rule.ruleID);
        if (!current) {
            seeded.push({
                type: "constitution.rule_added",
                id: "constitution:".concat(rule.ruleID.toLowerCase()),
                ruleID: rule.ruleID,
                statement: rule.statement,
                scope: "release",
                priority: "critical",
                source: "policy",
                enforcement: rule.enforcement,
                overridePolicy: overridePolicy,
            });
            continue;
        }
        if (current.statement === rule.statement &&
            current.enforcement === rule.enforcement &&
            current.overridePolicy === overridePolicy)
            continue;
        seeded.push({
            type: "constitution.rule_updated",
            id: "constitution:update:".concat(rule.ruleID.toLowerCase()),
            ruleID: rule.ruleID,
            statement: rule.statement,
            priority: "critical",
            enforcement: rule.enforcement,
            overridePolicy: overridePolicy,
        });
    }
    return seeded;
}
/**
 * Constructs a `decision.recorded` event. The decision text and rationale are
 * durable facts (they may reach the journal); alternatives and consequences are
 * optional and must be safe prose — never tool output, file content or secrets.
 */
function recordDecision(input) {
    return __assign(__assign(__assign(__assign(__assign(__assign(__assign({ type: "decision.recorded", id: input.id, decision: input.decision }, (input.scope ? { scope: input.scope } : {})), (input.rationale ? { rationale: input.rationale } : {})), (input.alternatives ? { alternatives: input.alternatives } : {})), (input.consequences ? { consequences: input.consequences } : {})), (input.linkedPlans ? { linkedPlans: input.linkedPlans } : {})), (input.linkedConstraints
        ? { linkedConstraints: input.linkedConstraints }
        : {})), { status: "accepted" });
}
/**
 * Validates a model rule proposal before the gate (EI §3.8 P-1.c):
 *
 * - `deny` / `approval` require a non-empty `appliesTo` — a hard rule the
 *   runtime matcher cannot execute is not a rule, it is a slogan;
 * - `scope: "release"` is rejected — the runtime self-protection rules are not
 *   a model's to touch.
 *
 * Returns the rejection reasons; an empty array means the proposal is valid.
 */
function validateConstitutionRuleProposal(proposal) {
    var _a, _b, _c, _d, _e;
    var problems = [];
    if (!proposal.statement.trim())
        problems.push("statement must be non-empty");
    if (proposal.scope !== undefined &&
        proposal.scope !== "project" &&
        proposal.scope !== "package")
        problems.push("scope \"".concat(proposal.scope, "\" is not user-owned; only project or package rules can be proposed"));
    if (proposal.enforcement === "deny" || proposal.enforcement === "approval") {
        var anchor = proposal.appliesTo;
        var anchored = ((_b = (_a = anchor === null || anchor === void 0 ? void 0 : anchor.tools) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0 ||
            ((_d = (_c = anchor === null || anchor === void 0 ? void 0 : anchor.paths) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0) > 0 ||
            Boolean((_e = anchor === null || anchor === void 0 ? void 0 : anchor.commandPattern) === null || _e === void 0 ? void 0 : _e.trim());
        if (!anchored)
            problems.push("".concat(proposal.enforcement, " rules require a non-empty appliesTo (tools, paths or commandPattern)"));
    }
    return problems;
}
/**
 * Builds a `constitution.rule_added` event for a user-approved model proposal
 * (EI §3.8 P-1.c): `source: "agent_proposed"` + the user's approval is the
 * provenance; the rule is permanent (no once/session semantics — a one-time
 * exemption is `override_granted`'s job).
 */
function buildProposedConstitutionRule(input) {
    var _a, _b;
    return __assign({ type: "constitution.rule_added", id: input.id, ruleID: input.ruleID, statement: input.proposal.statement, scope: input.proposal.scope === "package" ? "package" : "project", priority: (_a = input.proposal.priority) !== null && _a !== void 0 ? _a : "high", source: "agent_proposed", enforcement: input.proposal.enforcement, overridePolicy: "user_explicit", 
        // EI §3.7.5: the builder runs only after the user gate Allow, so the rule
        // is user-approved by construction; provenance records who proposed it.
        proposedBy: (_b = input.proposedBy) !== null && _b !== void 0 ? _b : "agent", approvedBy: "user" }, (input.proposal.appliesTo
        ? { appliesTo: input.proposal.appliesTo }
        : {}));
}
/**
 * Builds the `constitution.rule_added` event that promotes a parsed document
 * rule into the executable journal (EI §3.8 P-1.c "promote"): a user lifts a
 * soft constitution/AGENTS section (with its enforcement/appliesTo annotation)
 * into a hard rule. Provenance is `source: "user"` — a promote is a direct
 * user action, not a model proposal, so it needs no approval gate. A
 * deny/approval rule still requires a non-empty appliesTo anchor (the same
 * hard-rule invariant the proposal path enforces); the caller validates first.
 */
function buildPromotedConstitutionRule(input) {
    var _a;
    return __assign({ type: "constitution.rule_added", id: input.id, ruleID: input.ruleID, statement: input.statement, scope: "project", priority: (_a = input.priority) !== null && _a !== void 0 ? _a : "medium", source: "user", enforcement: input.enforcement, overridePolicy: "user_explicit" }, (input.appliesTo ? { appliesTo: input.appliesTo } : {}));
}
/**
 * Builds a `constitution.rule_added` event for a user-created rule (EI §3.8
 * P-1.c, user-owned): the user adds a rule directly from the UI (no model
 * proposal, no gate), so provenance is `source: "user"`. A deny/approval rule
 * requires a non-empty appliesTo anchor — the caller validates first.
 */
function buildUserConstitutionRule(input) {
    var _a;
    return __assign({ type: "constitution.rule_added", id: input.id, ruleID: input.ruleID, statement: input.statement, scope: input.scope === "package" ? "package" : "project", priority: (_a = input.priority) !== null && _a !== void 0 ? _a : "medium", source: "user", enforcement: input.enforcement, overridePolicy: "user_explicit" }, (input.appliesTo ? { appliesTo: input.appliesTo } : {}));
}
/**
 * Builds a `constitution.rule_updated` event (EI §3.8 P-1.c): any subset of the
 * rule's fields may change — `enabled` disables/re-enables it, `statement` /
 * `enforcement` / `priority` / `appliesTo` tighten or edit it. All fields are
 * optional. A disable is reversible and keeps the rule in the journal; only
 * `rule_removed` is the durable tombstone.
 */
function buildConstitutionRuleUpdate(input) {
    var nonEmpty = function (anchor) {
        var _a, _b;
        return anchor &&
            (((_a = anchor.tools) === null || _a === void 0 ? void 0 : _a.length) || ((_b = anchor.paths) === null || _b === void 0 ? void 0 : _b.length) || anchor.commandPattern);
    };
    return __assign(__assign(__assign(__assign(__assign({ type: "constitution.rule_updated", id: input.id, ruleID: input.ruleID }, (input.enabled !== undefined ? { enabled: input.enabled } : {})), (input.statement ? { statement: input.statement } : {})), (input.priority ? { priority: input.priority } : {})), (input.enforcement ? { enforcement: input.enforcement } : {})), (nonEmpty(input.appliesTo) ? { appliesTo: input.appliesTo } : {}));
}
/**
 * Builds the append-only `constitution.rule_removed` tombstone (EI §3.8
 * P-1.c): the journal keeps the full history of the rule's life, the
 * projection only drops it from the effective set. `removedBy` is always a
 * user — a model never deletes or weakens an existing rule.
 */
function buildConstitutionRuleRemoved(input) {
    return {
        type: "constitution.rule_removed",
        id: input.id,
        ruleID: input.ruleID,
        removedAt: input.removedAt,
        removedBy: "user",
    };
}
