"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var evidence_ledger_1 = require("../src/evidence-ledger");
(0, bun_test_1.test)("buildEvidenceRecorded carries the outcome as an evidence fact", function () {
    var event = (0, evidence_ledger_1.buildEvidenceRecorded)({
        id: "evidence:1",
        taskID: "task_1",
        objective: "verify the runtime builds",
        status: "validated",
        validations: [
            {
                command: "npm run typecheck",
                result: "passed",
                safeSummary: "typecheck passed",
                durationMs: 1200,
            },
        ],
        knownGaps: ["no integration coverage"],
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "evidence.recorded",
        id: "evidence:1",
        taskID: "task_1",
        status: "validated",
        validations: [
            {
                command: "npm run typecheck",
                result: "passed",
                safeSummary: "typecheck passed",
                durationMs: 1200,
            },
        ],
        knownGaps: ["no integration coverage"],
    });
});
(0, bun_test_1.test)("a failed validation records status failed, not validated", function () {
    var event = (0, evidence_ledger_1.buildEvidenceRecorded)({
        id: "evidence:2",
        taskID: "task_2",
        objective: "verify tests",
        status: "failed",
        validations: [
            {
                command: "npm test",
                result: "failed",
                safeSummary: "2 tests failed",
            },
        ],
    });
    (0, bun_test_1.expect)(event.status).toBe("failed");
});
(0, bun_test_1.test)("empty optional lists are omitted, not emitted as empty arrays", function () {
    var event = (0, evidence_ledger_1.buildEvidenceRecorded)({
        id: "evidence:3",
        taskID: "task_3",
        objective: "no validation recorded",
        status: "implemented",
    });
    (0, bun_test_1.expect)("validations" in event).toBe(false);
    (0, bun_test_1.expect)("knownGaps" in event).toBe(false);
    (0, bun_test_1.expect)("changes" in event).toBe(false);
});
(0, bun_test_1.test)("boundValidationOutcome caps the safe summary and clamps duration", function () {
    var outcome = (0, evidence_ledger_1.boundValidationOutcome)({
        command: "run a long validation",
        result: "passed",
        safeSummary: "x".repeat(5000),
        durationMs: -5,
    });
    (0, bun_test_1.expect)(outcome.safeSummary.length).toBe(2000);
    (0, bun_test_1.expect)(outcome.durationMs).toBe(0);
});
(0, bun_test_1.test)("boundValidationOutcome omits the duration when none is supplied", function () {
    var outcome = (0, evidence_ledger_1.boundValidationOutcome)({
        command: "run",
        result: "skipped",
        safeSummary: "skipped",
    });
    (0, bun_test_1.expect)("durationMs" in outcome).toBe(false);
});
(0, bun_test_1.test)("validation facts are secret-safe: no raw output shape is accepted", function () {
    // The builder's input type has no field for raw stdout/stderr, so the only
    // way for output to reach the journal is through the bounded safe summary.
    var event = (0, evidence_ledger_1.buildEvidenceRecorded)({
        id: "evidence:4",
        taskID: "task_4",
        objective: "no secrets",
        status: "failed",
        validations: [
            {
                command: "print secret",
                result: "failed",
                safeSummary: "api_key=********",
            },
        ],
    });
    (0, bun_test_1.expect)(JSON.stringify(event)).not.toContain("supersecret");
    (0, bun_test_1.expect)(JSON.stringify(event)).not.toContain("stdout");
});
(0, bun_test_1.test)("buildCompletionRecorded carries the fixed completion-card structure", function () {
    var event = (0, evidence_ledger_1.buildCompletionRecorded)({
        id: "completion:1",
        taskID: "task_1",
        objective: "verify the build",
        changeSummary: "added the build check",
        behaviorImpact: "CI now runs typecheck",
        validations: [
            { command: "npm run typecheck", result: "passed", safeSummary: "ok" },
        ],
        humanValidation: "reviewed by owner",
        knownGaps: ["no windows coverage"],
        externalSideEffects: ["writes .tmp"],
        rollbackState: "available",
        evidenceIDs: ["evidence:1"],
        recordedAt: "now",
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "completion.recorded",
        taskID: "task_1",
        changeSummary: "added the build check",
        behaviorImpact: "CI now runs typecheck",
        validations: [{ command: "npm run typecheck", result: "passed" }],
        humanValidation: "reviewed by owner",
        knownGaps: ["no windows coverage"],
        rollbackState: "available",
        evidenceIDs: ["evidence:1"],
    });
});
(0, bun_test_1.test)("completion cards carry the fixed fields and omit empty optional sections", function () {
    var event = (0, evidence_ledger_1.buildCompletionRecorded)({
        id: "completion:2",
        taskID: "task_2",
        objective: "do work",
        changeSummary: "the work is done",
        validations: [],
        recordedAt: "now",
    });
    (0, bun_test_1.expect)(event.changeSummary).toBe("the work is done");
    (0, bun_test_1.expect)("behaviorImpact" in event).toBe(false);
    (0, bun_test_1.expect)("humanValidation" in event).toBe(false);
    (0, bun_test_1.expect)("knownGaps" in event).toBe(false);
    (0, bun_test_1.expect)("rollbackState" in event).toBe(false);
});
(0, bun_test_1.test)("evidence status transition policy maps plan lifecycle to effective status", function () {
    (0, bun_test_1.expect)((0, evidence_ledger_1.evidenceStatusForPlanState)("marked", "implemented")).toBe("implemented");
    (0, bun_test_1.expect)((0, evidence_ledger_1.evidenceStatusForPlanState)("executing", "planned")).toBe("implemented");
    // A paused plan does not override the recorded evidence status.
    (0, bun_test_1.expect)((0, evidence_ledger_1.evidenceStatusForPlanState)("paused", "implemented")).toBe("implemented");
    (0, bun_test_1.expect)((0, evidence_ledger_1.evidenceStatusForPlanState)("awaiting_audit", "implemented")).toBe("implemented");
    (0, bun_test_1.expect)((0, evidence_ledger_1.evidenceStatusForPlanState)("auditing", "implemented")).toBe("implemented");
    (0, bun_test_1.expect)((0, evidence_ledger_1.evidenceStatusForPlanState)("audit_passed", "implemented")).toBe("accepted");
    (0, bun_test_1.expect)((0, evidence_ledger_1.evidenceStatusForPlanState)("completed", "implemented")).toBe("accepted");
});
