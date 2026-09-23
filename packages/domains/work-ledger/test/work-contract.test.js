"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var session_1 = require("@anthelia/session");
var work_contract_1 = require("../src/work-contract");
var now = "2026-09-16T00:00:00.000Z";
(0, bun_test_1.test)("a drafted contract carries its plan version and source", function () {
    var event = (0, work_contract_1.buildWorkContractDrafted)({
        id: "wc:plan:1:1",
        planID: "plan:1",
        planVersion: 3,
        scope: ["packages/framework/runtime/src"],
        verification: ["bun test packages/framework/runtime"],
        draftedAt: now,
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "work_contract.drafted",
        planID: "plan:1",
        planVersion: 3,
        scope: ["packages/framework/runtime/src"],
        verification: ["bun test packages/framework/runtime"],
        source: "model",
    });
    // Empty field arrays are omitted, not emitted as [].
    (0, bun_test_1.expect)(event.constraints).toBeUndefined();
});
(0, bun_test_1.test)("an accepted contract is always user-approved", function () {
    var event = (0, work_contract_1.buildWorkContractAccepted)({
        id: "wc:plan:1:accepted",
        planID: "plan:1",
        planVersion: 3,
        scope: ["packages/framework/runtime/src"],
        acceptedAt: now,
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "work_contract.accepted",
        acceptedBy: "user",
    });
    (0, bun_test_1.expect)(event.acceptedBy).toBe("user");
    (0, bun_test_1.expect)(event.unverifiable).toBeUndefined();
});
(0, bun_test_1.test)("an all-empty draft is unverifiable, not invalid", function () {
    (0, bun_test_1.expect)((0, work_contract_1.isUnverifiableContract)({})).toBe(true);
    (0, bun_test_1.expect)((0, work_contract_1.isUnverifiableContract)({ scope: [], verification: [], constraints: [] })).toBe(true);
    (0, bun_test_1.expect)((0, work_contract_1.isUnverifiableContract)({ scope: ["src"] })).toBe(false);
    // An unverifiable acceptance keeps the flow working (advisory-only).
    var event = (0, work_contract_1.buildWorkContractAccepted)({
        id: "wc:plan:2:accepted",
        planID: "plan:2",
        planVersion: 1,
        acceptedAt: now,
        unverifiable: true,
    });
    (0, bun_test_1.expect)(event.unverifiable).toBe(true);
});
(0, bun_test_1.test)("placeholders are rejected with a reason", function () {
    (0, bun_test_1.expect)((0, work_contract_1.validateWorkContractFields)({})).toEqual([]);
    (0, bun_test_1.expect)((0, work_contract_1.validateWorkContractFields)({
        scope: ["packages/framework/runtime/src"],
    })).toEqual([]);
    var problems = (0, work_contract_1.validateWorkContractFields)({
        scope: ["all"],
        verification: ["相关"],
        constraints: ["x"],
    });
    (0, bun_test_1.expect)(problems).toHaveLength(3);
    (0, bun_test_1.expect)(problems[0]).toContain('scope entry "all" is a placeholder');
    (0, bun_test_1.expect)(problems[1]).toContain("placeholder");
    (0, bun_test_1.expect)(problems[2]).toContain("placeholder");
    (0, bun_test_1.expect)((0, work_contract_1.isPlaceholderContractValue)("all")).toBe(true);
    (0, bun_test_1.expect)((0, work_contract_1.isPlaceholderContractValue)("EVERYTHING")).toBe(true);
    (0, bun_test_1.expect)((0, work_contract_1.isPlaceholderContractValue)("相关")).toBe(true);
    (0, bun_test_1.expect)((0, work_contract_1.isPlaceholderContractValue)("a")).toBe(true);
    (0, bun_test_1.expect)((0, work_contract_1.isPlaceholderContractValue)("src/parser.ts")).toBe(false);
    (0, bun_test_1.expect)((0, work_contract_1.isPlaceholderContractValue)("改代码后跑 typecheck")).toBe(false);
});
(0, bun_test_1.test)("a provided but empty field is rejected", function () {
    var problems = (0, work_contract_1.validateWorkContractFields)({ scope: [] });
    (0, bun_test_1.expect)(problems).toHaveLength(1);
    (0, bun_test_1.expect)(problems[0]).toContain("scope was provided but is empty");
});
function contractEvents() {
    return [
        (0, work_contract_1.buildWorkContractDrafted)({
            id: "wc:plan:1:1",
            planID: "plan:1",
            planVersion: 1,
            scope: ["packages/a"],
            draftedAt: now,
        }),
    ];
}
(0, bun_test_1.test)("replay yields the draft / current / none three-state contract view", function () {
    var state = (0, session_1.emptySessionWorkContractFactState)();
    // none: no contract for this plan yet.
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([]);
    for (var _i = 0, _a = contractEvents(); _i < _a.length; _i++) {
        var event_1 = _a[_i];
        (0, session_1.applySessionWorkContractFact)(state, event_1);
    }
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([
        {
            planID: "plan:1",
            version: 1,
            scope: ["packages/a"],
            status: "draft",
        },
    ]);
    (0, session_1.applySessionWorkContractFact)(state, (0, work_contract_1.buildWorkContractAccepted)({
        id: "wc:plan:1:accepted",
        planID: "plan:1",
        planVersion: 1,
        scope: ["packages/a"],
        acceptedAt: now,
    }));
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([
        {
            planID: "plan:1",
            version: 1,
            scope: ["packages/a"],
            status: "current",
            acceptedBy: "user",
            acceptedAt: now,
        },
    ]);
});
(0, bun_test_1.test)("repeated drafts keep the latest one", function () {
    var state = (0, session_1.emptySessionWorkContractFactState)();
    (0, session_1.applySessionWorkContractFact)(state, (0, work_contract_1.buildWorkContractDrafted)({
        id: "wc:plan:1:1",
        planID: "plan:1",
        planVersion: 1,
        scope: ["packages/a"],
        draftedAt: now,
    }));
    (0, session_1.applySessionWorkContractFact)(state, (0, work_contract_1.buildWorkContractDrafted)({
        id: "wc:plan:1:2",
        planID: "plan:1",
        planVersion: 1,
        scope: ["packages/b"],
        constraints: ["no new dependency"],
        draftedAt: now,
    }));
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([
        {
            planID: "plan:1",
            version: 1,
            scope: ["packages/b"],
            constraints: ["no new dependency"],
            status: "draft",
        },
    ]);
});
(0, bun_test_1.test)("a plan document edit past the draft's version marks it stale; a re-proposed draft clears it", function () {
    var state = (0, session_1.emptySessionWorkContractFactState)();
    for (var _i = 0, _a = contractEvents(); _i < _a.length; _i++) {
        var event_2 = _a[_i];
        (0, session_1.applySessionWorkContractFact)(state, event_2);
    }
    // The document moved to revision 2; the draft was extracted from revision 1.
    (0, session_1.applySessionWorkContractFact)(state, {
        type: "plan.doc.updated",
        id: "plan:1:updated:2",
        planID: "plan:1",
        revision: 2,
        updatedAt: now,
    });
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([
        {
            planID: "plan:1",
            version: 1,
            scope: ["packages/a"],
            status: "draft",
            stale: true,
        },
    ]);
    // Re-proposing against the new plan version clears the staleness.
    (0, session_1.applySessionWorkContractFact)(state, (0, work_contract_1.buildWorkContractDrafted)({
        id: "wc:plan:1:2",
        planID: "plan:1",
        planVersion: 2,
        scope: ["packages/b"],
        draftedAt: now,
    }));
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([
        {
            planID: "plan:1",
            version: 2,
            scope: ["packages/b"],
            status: "draft",
        },
    ]);
});
(0, bun_test_1.test)("a plan document edit at or below the draft's version does not mark it stale", function () {
    var state = (0, session_1.emptySessionWorkContractFactState)();
    for (var _i = 0, _a = contractEvents(); _i < _a.length; _i++) {
        var event_3 = _a[_i];
        (0, session_1.applySessionWorkContractFact)(state, event_3);
    }
    // An update that does not move past the extracted revision (a touch or
    // re-mark at the same version) must not invalidate a draft bound to it.
    (0, session_1.applySessionWorkContractFact)(state, {
        type: "plan.doc.updated",
        id: "plan:1:updated:1",
        planID: "plan:1",
        revision: 1,
        updatedAt: now,
    });
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([
        {
            planID: "plan:1",
            version: 1,
            scope: ["packages/a"],
            status: "draft",
        },
    ]);
});
(0, bun_test_1.test)("a plan document edit never invalidates an accepted contract", function () {
    var state = (0, session_1.emptySessionWorkContractFactState)();
    (0, session_1.applySessionWorkContractFact)(state, (0, work_contract_1.buildWorkContractAccepted)({
        id: "wc:plan:1:accepted",
        planID: "plan:1",
        planVersion: 1,
        scope: ["packages/a"],
        acceptedAt: now,
    }));
    (0, session_1.applySessionWorkContractFact)(state, {
        type: "plan.doc.updated",
        id: "plan:1:updated:2",
        planID: "plan:1",
        revision: 2,
        updatedAt: now,
    });
    (0, bun_test_1.expect)((0, session_1.sessionWorkContractsFrom)(state)).toEqual([
        {
            planID: "plan:1",
            version: 1,
            scope: ["packages/a"],
            status: "current",
            acceptedBy: "user",
            acceptedAt: now,
        },
    ]);
});
(0, bun_test_1.test)("contracts for different plans stay independent", function () {
    var _a, _b;
    var state = (0, session_1.emptySessionWorkContractFactState)();
    (0, session_1.applySessionWorkContractFact)(state, (0, work_contract_1.buildWorkContractDrafted)({
        id: "wc:plan:1:1",
        planID: "plan:1",
        planVersion: 1,
        scope: ["packages/a"],
        draftedAt: now,
    }));
    (0, session_1.applySessionWorkContractFact)(state, (0, work_contract_1.buildWorkContractAccepted)({
        id: "wc:plan:2:accepted",
        planID: "plan:2",
        planVersion: 7,
        verification: ["bun test"],
        acceptedAt: now,
    }));
    var contracts = (0, session_1.sessionWorkContractsFrom)(state);
    (0, bun_test_1.expect)(contracts).toHaveLength(2);
    (0, bun_test_1.expect)((_a = contracts.find(function (contract) { return contract.planID === "plan:1"; })) === null || _a === void 0 ? void 0 : _a.status).toBe("draft");
    (0, bun_test_1.expect)((_b = contracts.find(function (contract) { return contract.planID === "plan:2"; })) === null || _b === void 0 ? void 0 : _b.status).toBe("current");
});
(0, bun_test_1.test)("task-type heuristics classify objectives into kinds (EI §8.8)", function () {
    (0, bun_test_1.expect)((0, work_contract_1.classifyTaskKind)("bump the runtime dependencies")).toBe("dependency");
    (0, bun_test_1.expect)((0, work_contract_1.classifyTaskKind)("rewrite the bash command parser")).toBe("parser");
    (0, bun_test_1.expect)((0, work_contract_1.classifyTaskKind)("add unit tests for the parser")).toBe("parser");
    (0, bun_test_1.expect)((0, work_contract_1.classifyTaskKind)("update the README")).toBe("docs");
    (0, bun_test_1.expect)((0, work_contract_1.classifyTaskKind)("add a typed HTTP client")).toBe("code");
    // The committed scope participates in the classification.
    (0, bun_test_1.expect)((0, work_contract_1.classifyTaskKind)("ship it", ["packages/x/package.json"])).toBe("dependency");
});
(0, bun_test_1.test)("the minimum-evidence matrix judges completion claims (EI §8.8)", function () {
    // A dependency change with no install/typecheck evidence is not judge-able.
    var depGap = (0, work_contract_1.evaluateCompletionCard)({
        objective: "bump the runtime dependencies",
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(depGap.kind).toBe("dependency");
    (0, bun_test_1.expect)(depGap.judgeable).toBe(false);
    (0, bun_test_1.expect)(depGap.missing).toContain("validation:install");
    // The right evidence closes the gaps.
    var depDone = (0, work_contract_1.evaluateCompletionCard)({
        objective: "bump the runtime dependencies",
        evidenceRefs: [],
        validations: [
            { command: "bun install", result: "passed" },
            { command: "bun run typecheck", result: "passed" },
        ],
    });
    (0, bun_test_1.expect)(depDone.judgeable).toBe(true);
    (0, bun_test_1.expect)(depDone.missing).toEqual([]);
    // A failed validation never counts.
    var depFailed = (0, work_contract_1.evaluateCompletionCard)({
        objective: "bump the runtime dependencies",
        evidenceRefs: [],
        validations: [{ command: "bun install", result: "failed" }],
    });
    (0, bun_test_1.expect)(depFailed.judgeable).toBe(false);
    // A docs-only change needs no runtime validation.
    var docs = (0, work_contract_1.evaluateCompletionCard)({
        objective: "update the README",
        evidenceRefs: [],
    });
    (0, bun_test_1.expect)(docs.kind).toBe("docs");
    (0, bun_test_1.expect)(docs.judgeable).toBe(true);
    // A parser change needs parser evidence specifically.
    var parser = (0, work_contract_1.evaluateCompletionCard)({
        objective: "rewrite the bash command parser",
        evidenceRefs: [],
        validations: [
            { command: "bun test packages/framework/runtime", result: "passed" },
        ],
    });
    (0, bun_test_1.expect)(parser.kind).toBe("parser");
    (0, bun_test_1.expect)(parser.missing).toContain("validation:parser");
});
(0, bun_test_1.test)("detour.requested carries the optimistic lock and deltas", function () {
    var event = (0, work_contract_1.buildDetourRequested)({
        id: "detour:1",
        detourID: "plan:1:detour:1",
        planID: "plan:1",
        currentVersion: 2,
        reason: "the fix also needs the shared util package",
        scopeDelta: ["packages/b"],
        verificationDelta: ["bun test packages/b"],
        requestedAt: "2026-09-17T00:00:00.000Z",
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "detour.requested",
        planID: "plan:1",
        currentVersion: 2,
        scopeDelta: ["packages/b"],
        verificationDelta: ["bun test packages/b"],
        requestedBy: "model",
    });
});
(0, bun_test_1.test)("detour.reviewed records Nia's reference verdict", function () {
    var event = (0, work_contract_1.buildDetourReviewed)({
        id: "detour:reviewed:1",
        detourID: "plan:1:detour:1",
        planID: "plan:1",
        verdict: "approve",
        reviewedBy: "nia",
        reviewedAt: "2026-09-17T00:01:00.000Z",
        rationale: "the util package is a legitimate dependency",
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "detour.reviewed",
        verdict: "approve",
        reviewedBy: "nia",
    });
});
(0, bun_test_1.test)("a detour must have a reason and at least one delta", function () {
    (0, bun_test_1.expect)((0, work_contract_1.validateDetour)({ reason: "", scopeDelta: ["packages/b"] }).some(function (problem) {
        return problem.includes("non-empty reason");
    })).toBe(true);
    (0, bun_test_1.expect)((0, work_contract_1.validateDetour)({ reason: "need it", scopeDelta: [] }).some(function (problem) {
        return problem.includes("at least one");
    })).toBe(true);
});
(0, bun_test_1.test)("a scopeDelta that overlaps the accepted scope is rejected", function () {
    var problems = (0, work_contract_1.validateDetour)({
        reason: "extend coverage",
        scopeDelta: ["packages/a"],
        currentScope: ["packages/a"],
    });
    (0, bun_test_1.expect)(problems.some(function (problem) { return problem.includes("overlaps"); })).toBe(true);
    // A non-overlapping delta is valid.
    (0, bun_test_1.expect)((0, work_contract_1.validateDetour)({
        reason: "extend coverage",
        scopeDelta: ["packages/b"],
        currentScope: ["packages/a"],
    })).toEqual([]);
});
(0, bun_test_1.test)("mergeDetourIntoContract unions the deltas into the next version", function () {
    var merged = (0, work_contract_1.mergeDetourIntoContract)({ scope: ["packages/a"], verification: ["bun test packages/a"] }, { scopeDelta: ["packages/b"], verificationDelta: ["bun test packages/b"] });
    (0, bun_test_1.expect)(merged).toEqual({
        scope: ["packages/a", "packages/b"],
        verification: ["bun test packages/a", "bun test packages/b"],
    });
    // Deduplication: a delta already present is not doubled.
    var deduped = (0, work_contract_1.mergeDetourIntoContract)({ scope: ["packages/a"] }, { scopeDelta: ["packages/a", "packages/b"] });
    (0, bun_test_1.expect)(deduped.scope).toEqual(["packages/a", "packages/b"]);
});
(0, bun_test_1.test)("classifyPathClass infers the class from the file path, not the objective", function () {
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["packages/framework/client/src/foo.ts"])).toBe("source");
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["packages/kernel/src/lib.rs"])).toBe("source");
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["packages/kernel/test/lib.test.ts"])).toBe("test");
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["docs/api-reference.md"])).toBe("docs");
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["package.json", "bun.lock"])).toBe("config");
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["tsconfig.json"])).toBe("config");
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["assets/logo.png"])).toBe("other");
    // A substring "test" in a source path must NOT be misread as a test change.
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["src/contest/entry.ts"])).toBe("source");
    // The highest-evidence class wins in a mixed set.
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)(["docs/readme.md", "src/a.ts"])).toBe("source");
    (0, bun_test_1.expect)((0, work_contract_1.classifyPathClass)([])).toBe("other");
});
(0, bun_test_1.test)("evaluateCompletionCard classifies by change path and requires validation for source", function () {
    // A source change with no passing validation -> gap (missing validation:any).
    var gap = (0, work_contract_1.evaluateCompletionCard)({
        objective: "whatever the model says",
        changes: ["packages/framework/client/src/foo.ts"],
        evidenceRefs: [],
        validations: [],
    });
    (0, bun_test_1.expect)(gap.classifiedBy).toBe("path");
    (0, bun_test_1.expect)(gap.kind).toBe("source");
    (0, bun_test_1.expect)(gap.judgeable).toBe(false);
    (0, bun_test_1.expect)(gap.missing).toContain("validation:any");
    // The same source change with a passing validation -> judge-able.
    var done = (0, work_contract_1.evaluateCompletionCard)({
        objective: "whatever the model says",
        changes: ["packages/framework/client/src/foo.ts"],
        evidenceRefs: [],
        validations: [
            { command: "bun test", result: "passed", safeSummary: "green" },
        ],
    });
    (0, bun_test_1.expect)(done.judgeable).toBe(true);
    (0, bun_test_1.expect)(done.missing).toEqual([]);
    // A docs change needs no validation, even with none recorded.
    var docs = (0, work_contract_1.evaluateCompletionCard)({
        objective: "update the readme",
        changes: ["docs/readme.md"],
        evidenceRefs: [],
        validations: [],
    });
    (0, bun_test_1.expect)(docs.kind).toBe("docs");
    (0, bun_test_1.expect)(docs.judgeable).toBe(true);
    // No change paths -> falls back to the objective classifier.
    var fallback = (0, work_contract_1.evaluateCompletionCard)({
        objective: "bump the runtime dependencies",
        evidenceRefs: [],
        validations: [],
    });
    (0, bun_test_1.expect)(fallback.classifiedBy).toBe("objective");
    (0, bun_test_1.expect)(fallback.kind).toBe("dependency");
});
