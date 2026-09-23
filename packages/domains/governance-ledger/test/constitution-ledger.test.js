"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var constitution_ledger_1 = require("../src/constitution-ledger");
(0, bun_test_1.test)("the self-protection rules are the runtime's real rule metadata", function () {
    (0, bun_test_1.expect)(constitution_ledger_1.SELF_PROTECTION_RULES.map(function (rule) { return rule.ruleID; })).toEqual([
        "C-TERM-001",
        "C-TERM-002",
        "C-TERM-003",
        "C-REL-001",
        "C-REL-002",
    ]);
});
(0, bun_test_1.test)("seeding a fresh journal publishes all three rules as durable facts", function () {
    var _a, _b;
    var seeded = (0, constitution_ledger_1.seedConstitutionRules)([]);
    (0, bun_test_1.expect)(seeded).toHaveLength(5);
    for (var _i = 0, seeded_1 = seeded; _i < seeded_1.length; _i++) {
        var rule = seeded_1[_i];
        (0, bun_test_1.expect)(rule.type).toBe("constitution.rule_added");
        if (rule.type !== "constitution.rule_added")
            continue;
        (0, bun_test_1.expect)(rule.scope).toBe("release");
        (0, bun_test_1.expect)(rule.priority).toBe("critical");
        (0, bun_test_1.expect)(rule.source).toBe("policy");
        (0, bun_test_1.expect)(rule.enforcement).toBe(rule.ruleID === "C-REL-001" ? "approval" : "deny");
    }
    (0, bun_test_1.expect)(seeded.map(function (rule) { return rule.ruleID; })).toEqual([
        "C-TERM-001",
        "C-TERM-002",
        "C-TERM-003",
        "C-REL-001",
        "C-REL-002",
    ]);
    (0, bun_test_1.expect)((_a = seeded.find(function (rule) { return rule.ruleID === "C-REL-001"; })) === null || _a === void 0 ? void 0 : _a.overridePolicy).toBe("user_scoped");
    (0, bun_test_1.expect)((_b = seeded.find(function (rule) { return rule.ruleID === "C-REL-002"; })) === null || _b === void 0 ? void 0 : _b.overridePolicy).toBe("forbidden");
});
(0, bun_test_1.test)("seeding is idempotent: a journal that already holds a rule is not reseeded", function () {
    var existing = [
        {
            type: "constitution.rule_added",
            id: "constitution:c-term-001",
            ruleID: "C-TERM-001",
            statement: "禁止直接杀掉 wezterm-mux-server",
            scope: "release",
            priority: "critical",
            source: "policy",
            enforcement: "deny",
            overridePolicy: "forbidden",
        },
    ];
    var seeded = (0, constitution_ledger_1.seedConstitutionRules)(existing);
    (0, bun_test_1.expect)(seeded.map(function (rule) { return rule.ruleID; })).toEqual([
        "C-TERM-002",
        "C-TERM-003",
        "C-REL-001",
        "C-REL-002",
    ]);
});
(0, bun_test_1.test)("seeding migrates the old C-REL-001 deny rule to forced approval", function () {
    var existing = [
        {
            type: "constitution.rule_added",
            id: "constitution:c-rel-001",
            ruleID: "C-REL-001",
            statement: "默认不 commit/push",
            scope: "release",
            priority: "critical",
            source: "policy",
            enforcement: "deny",
            overridePolicy: "user_scoped",
        },
    ];
    var seeded = (0, constitution_ledger_1.seedConstitutionRules)(existing);
    (0, bun_test_1.expect)(seeded).toEqual(bun_test_1.expect.arrayContaining([
        bun_test_1.expect.objectContaining({
            type: "constitution.rule_updated",
            ruleID: "C-REL-001",
            enforcement: "approval",
        }),
    ]));
});
(0, bun_test_1.test)("recordDecision builds an accepted durable decision", function () {
    var event = (0, constitution_ledger_1.recordDecision)({
        id: "decision:abc",
        decision: "workspace isolation is not container/VM security",
        rationale: ["the sandbox is a workspace boundary"],
        alternatives: [{ option: "VM per sandbox", rejectedReason: "too heavy" }],
        consequences: ["callers must not assume a kernel boundary"],
        linkedConstraints: ["C-TERM-001"],
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "decision.recorded",
        id: "decision:abc",
        status: "accepted",
        decision: "workspace isolation is not container/VM security",
        rationale: ["the sandbox is a workspace boundary"],
        alternatives: [{ option: "VM per sandbox", rejectedReason: "too heavy" }],
        consequences: ["callers must not assume a kernel boundary"],
        linkedConstraints: ["C-TERM-001"],
    });
});
(0, bun_test_1.test)("recordDecision stays minimal when optional fields are omitted", function () {
    var event = (0, constitution_ledger_1.recordDecision)({
        id: "decision:min",
        decision: "default no commit/push",
    });
    (0, bun_test_1.expect)(event.status).toBe("accepted");
    (0, bun_test_1.expect)("rationale" in event).toBe(false);
    (0, bun_test_1.expect)("alternatives" in event).toBe(false);
    (0, bun_test_1.expect)("consequences" in event).toBe(false);
});
(0, bun_test_1.test)("a model proposal must carry a structured anchor for hard enforcement", function () {
    // deny without appliesTo is a slogan, not a rule the matcher can execute.
    (0, bun_test_1.expect)((0, constitution_ledger_1.validateConstitutionRuleProposal)({
        statement: "never force push",
        enforcement: "deny",
    })).toEqual([
        "deny rules require a non-empty appliesTo (tools, paths or commandPattern)",
    ]);
    (0, bun_test_1.expect)((0, constitution_ledger_1.validateConstitutionRuleProposal)({
        statement: "never force push",
        enforcement: "approval",
        appliesTo: { tools: [] },
    })).toHaveLength(1);
    (0, bun_test_1.expect)((0, constitution_ledger_1.validateConstitutionRuleProposal)({
        statement: "never force push",
        enforcement: "deny",
        appliesTo: { tools: ["run_shell"], commandPattern: "git push.*--force" },
    })).toEqual([]);
});
(0, bun_test_1.test)("a model proposal cannot target release scope", function () {
    (0, bun_test_1.expect)((0, constitution_ledger_1.validateConstitutionRuleProposal)({
        statement: "relax the terminal guard",
        enforcement: "deny",
        scope: "release",
        appliesTo: { paths: ["packages/framework/runtime"] },
    })).toEqual([
        'scope "release" is not user-owned; only project or package rules can be proposed',
    ]);
    (0, bun_test_1.expect)((0, constitution_ledger_1.validateConstitutionRuleProposal)({
        statement: "keep runtime covered",
        enforcement: "warn",
        scope: "project",
    })).toEqual([]);
});
(0, bun_test_1.test)("an approved model proposal lands as agent_proposed provenance", function () {
    var event = (0, constitution_ledger_1.buildProposedConstitutionRule)({
        id: "constitution:rule:prompt-1",
        ruleID: "P-TEST-001",
        proposal: {
            statement: "no new runtime dependencies",
            enforcement: "deny",
            appliesTo: { paths: ["packages/framework/runtime/src"] },
            scope: "project",
        },
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "constitution.rule_added",
        ruleID: "P-TEST-001",
        scope: "project",
        source: "agent_proposed",
        enforcement: "deny",
        overridePolicy: "user_explicit",
        appliesTo: { paths: ["packages/framework/runtime/src"] },
    });
});
(0, bun_test_1.test)("a disable is reversible and a removal is a durable tombstone", function () {
    var disabled = (0, constitution_ledger_1.buildConstitutionRuleUpdate)({
        id: "constitution:update:prompt-1",
        ruleID: "P-TEST-001",
        enabled: false,
    });
    (0, bun_test_1.expect)(disabled).toEqual({
        type: "constitution.rule_updated",
        id: "constitution:update:prompt-1",
        ruleID: "P-TEST-001",
        enabled: false,
    });
    var removed = (0, constitution_ledger_1.buildConstitutionRuleRemoved)({
        id: "constitution:removed:prompt-1",
        ruleID: "P-TEST-001",
        removedAt: "2026-09-16T00:00:00.000Z",
    });
    (0, bun_test_1.expect)(removed).toEqual({
        type: "constitution.rule_removed",
        id: "constitution:removed:prompt-1",
        ruleID: "P-TEST-001",
        removedAt: "2026-09-16T00:00:00.000Z",
        removedBy: "user",
    });
});
(0, bun_test_1.test)("constitutionPathMatch honours * within a segment and ** across segments", function () {
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src/*.ts", "src/a.ts")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src/*.ts", "src/a/b.ts")).toBe(false);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src/**/x", "src/a/b/x")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("**/x", "a/b/x")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src/**", "src/a/b.ts")).toBe(true);
});
(0, bun_test_1.test)("constitutionPathMatch treats a trailing-slash pattern as a directory prefix", function () {
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src/", "src/a.ts")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src/", "src/a/b.ts")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src/", "other/a.ts")).toBe(false);
    // No trailing slash is an exact match, not a directory.
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src", "src/a.ts")).toBe(false);
});
(0, bun_test_1.test)("constitutionPathMatch treats ? and regex metacharacters as literal", function () {
    // A literal "?" must match itself, never act as a regex quantifier.
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("a?b", "a?b")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("a?b", "ab")).toBe(false);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("file(1).ts", "file(1).ts")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("a.b", "a.b")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("a.b", "axb")).toBe(false);
});
(0, bun_test_1.test)("constitutionPathMatch normalizes backslashes and a leading ./", function () {
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("src\\a.ts", "src/a.ts")).toBe(true);
    (0, bun_test_1.expect)((0, constitution_ledger_1.constitutionPathMatch)("./src/a.ts", "src/a.ts")).toBe(true);
});
