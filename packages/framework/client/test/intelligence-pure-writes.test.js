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
var bun_test_1 = require("bun:test");
var intelligence_1 = require("../src/runtime/engineering-intelligence/intelligence");
var runtime_services_1 = require("@natalia/runtime-services");
var governance_ledger_1 = require("@natalia/governance-ledger");
var work_ledger_1 = require("@natalia/work-ledger");
var session_1 = require("@anthelia/session");
/**
 * Pure intelligence writes must not pull the full journal: they only need the
 * live execution (session id / active turn) and the ledgers. The fake service
 * deliberately has no `loadFullAsync`, so any accidental
 * `ensureSessionFullEvents()` would throw.
 */
function harness() {
    var _this = this;
    var published = [];
    var decisionSequence = 0;
    var exec = {
        session: { id: "ses_pure_writes", events: [] },
        activeTurnID: "turn_1",
    };
    var ledger = {
        seedConstitutionRules: function () { return []; },
        recordDecision: function (input) { return ({
            type: "decision.recorded",
            id: input.id,
            decision: input.decision,
            status: "proposed",
        }); },
        decisionNode: function (input) { return ({
            type: "workgraph.node_added",
            id: "wg:decision:".concat(input.decisionID),
            nodeID: "wg:decision:".concat(input.decisionID),
            kind: "decision",
            summary: input.decision,
            sessionID: input.sessionID,
        }); },
        evaluateDrift: function () { return []; },
        buildCompletionRecorded: function (input) { return ({
            type: "completion.recorded",
            id: input.id,
            taskID: input.taskID,
            objective: "objective",
            changeSummary: "summary",
            validations: [],
        }); },
        buildAuditRequested: function (input) { return ({
            type: "audit.requested",
            id: input.id,
            triggerEventID: input.triggerEventID,
            planID: "plan:1",
            planVersion: 1,
            round: 1,
            scope: "completion_recorded",
            at: "2026-01-01T00:00:00.000Z",
        }); },
        completionValidationEdge: function () { return ({
            type: "workgraph.edge_added",
            id: "wg:edge:1",
            fromNodeID: "wg:change:1",
            toNodeID: "wg:completion:1",
            kind: "validated_by",
        }); },
        boundValidationOutcome: function () { return undefined; },
        buildHumanValidation: function () { return undefined; },
        buildEvidenceRecorded: function () { return undefined; },
        evidenceStatusForPlanState: function () { return undefined; },
        validateConstitutionRuleProposal: function () { return []; },
        buildProposedConstitutionRule: function () { return undefined; },
        buildPromotedConstitutionRule: function () { return undefined; },
        buildConstitutionRuleUpdate: function () { return undefined; },
        buildUserConstitutionRule: function () { return undefined; },
        buildConstitutionRuleRemoved: function () { return undefined; },
        // WorkLedgerController face of the same double (the port stub answered
        // every lookup with it; the directory needs it registered per token).
        buildPlanDocCreated: function () { return undefined; },
        buildPlanDocUpdated: function () { return undefined; },
        buildPlanDocMarked: function () { return undefined; },
        buildPlanDocDeleted: function () { return undefined; },
        buildPlanDocStatus: function () { return undefined; },
        evaluateBehaviorDrift: function () { return []; },
        buildWorkContractDrafted: function () { return undefined; },
        buildWorkContractAccepted: function () { return undefined; },
        buildDetourRequested: function () { return undefined; },
        buildDetourReviewed: function () { return undefined; },
        validateDetour: function () { return []; },
        mergeDetourIntoContract: function () { return undefined; },
        validateWorkContractFields: function () { return []; },
        evaluateCompletionCard: function () { return undefined; },
        agentActionNode: function () { return undefined; },
        approvalEdge: function () { return undefined; },
        approvalNode: function () { return undefined; },
        completionNode: function () { return undefined; },
        checkpointNode: function () { return undefined; },
        constitutionCheckEdge: function () { return undefined; },
        constitutionRuleNode: function () { return undefined; },
        externalWorkspaceChangeNode: function () { return undefined; },
        toolCallEdge: function () { return undefined; },
        toolCallNode: function () { return undefined; },
        rollbackCheckpointEdge: function () { return undefined; },
        buildDriftFindingUpdate: function () { return undefined; },
        workspaceChangeEdge: function () { return undefined; },
        workspaceChangeNode: function () { return undefined; },
    };
    var ctx = {
        state: {
            pluginStoreRoot: "/tmp/natalia-pure-writes",
            serviceDirectory: (0, runtime_services_1.createTestContext)([
                governance_ledger_1.governanceLedgerController.mock(ledger),
                work_ledger_1.workLedgerController.mock(ledger),
            ]),
        },
        ports: {
            getReady: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, undefined];
            }); }); },
            getExecutionBySession: function () { return new Map([["ses_pure_writes", exec]]); },
            getActiveExec: function () { return exec; },
            resolveService: function () { return ledger; },
            publishForSession: function (_exec, event) {
                published.push(event);
            },
            nextDecisionSequence: function () { return (decisionSequence += 1); },
            nextCompletionSequence: function () { return 1; },
            nextPlanSequence: function () { return 1; },
            requestNiaWake: function () { return undefined; },
            getWorkspaceRoot: function () { return "/tmp"; },
        },
    };
    return {
        surface: (0, intelligence_1.createIntelligenceSurface)(ctx, {}),
        published: published,
    };
}
(0, bun_test_1.test)("recordDecision records without loading full history", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, surface, published, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness(), surface = _a.surface, published = _a.published;
                return [4 /*yield*/, surface.recordDecision({ decision: "Use the shared session window" }, "ses_pure_writes")];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result).toEqual({ recorded: true });
                (0, bun_test_1.expect)(published.filter(function (e) { return e.type === "decision.recorded"; })).toHaveLength(1);
                (0, bun_test_1.expect)(published.filter(function (e) { return e.type === "workgraph.node_added" && e.kind === "decision"; })).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("evaluateDrift records without loading full history", function () { return __awaiter(void 0, void 0, void 0, function () {
    var surface, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                surface = harness().surface;
                return [4 /*yield*/, surface.evaluateDrift({ objective: "ship", currentActivity: "testing" }, "ses_pure_writes")];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual({ opened: 0 });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("recordCompletion records without loading full history", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, surface, published, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness(), surface = _a.surface, published = _a.published;
                return [4 /*yield*/, surface.recordCompletion({
                        taskID: "task_1",
                        objective: "ship",
                        changeSummary: "did the thing",
                    }, "ses_pure_writes")];
            case 1:
                result = _b.sent();
                (0, bun_test_1.expect)(result.recorded).toBe(true);
                (0, bun_test_1.expect)(published.filter(function (e) { return e.type === "completion.recorded"; })).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("acknowledgeDriftFinding reads a complete hot state without a full load", function () { return __awaiter(void 0, void 0, void 0, function () {
    var published, earlier, exec, ledger, ctx, surface, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                published = [];
                earlier = {
                    type: "drift.finding_opened",
                    id: "drift:1",
                    findingID: "DF-1",
                    severity: "warning",
                    confidence: 0.5,
                    originalObjective: "objective",
                    currentActivity: "activity",
                    evidence: [],
                    applicableConstraints: [],
                    contractVersion: 2,
                };
                exec = {
                    // A tail-only base: folding the journal here would miss the finding.
                    session: { id: "ses_hot_state", events: [] },
                    factState: (0, session_1.sessionFactStateFromEvents)([earlier]),
                    factStateComplete: true,
                };
                ledger = {
                    buildDriftFindingUpdate: function (input) { return (__assign({ type: "drift.finding_updated", id: input.id, findingID: input.findingID, status: input.status }, (input.rationale ? { rationale: input.rationale } : {}))); },
                    seedConstitutionRules: function () { return []; },
                    recordDecision: function () { return undefined; },
                    decisionNode: function () { return undefined; },
                    evaluateDrift: function () { return []; },
                    buildCompletionRecorded: function () { return undefined; },
                    buildAuditRequested: function () { return undefined; },
                    completionValidationEdge: function () { return undefined; },
                    boundValidationOutcome: function () { return undefined; },
                    buildHumanValidation: function () { return undefined; },
                    buildEvidenceRecorded: function () { return undefined; },
                    evidenceStatusForPlanState: function () { return undefined; },
                    validateConstitutionRuleProposal: function () { return []; },
                    buildProposedConstitutionRule: function () { return undefined; },
                    buildPromotedConstitutionRule: function () { return undefined; },
                    buildConstitutionRuleUpdate: function () { return undefined; },
                    buildUserConstitutionRule: function () { return undefined; },
                    buildConstitutionRuleRemoved: function () { return undefined; },
                    buildPlanDocCreated: function () { return undefined; },
                    buildPlanDocUpdated: function () { return undefined; },
                    buildPlanDocMarked: function () { return undefined; },
                    buildPlanDocDeleted: function () { return undefined; },
                    buildPlanDocStatus: function () { return undefined; },
                    evaluateBehaviorDrift: function () { return []; },
                    buildWorkContractDrafted: function () { return undefined; },
                    buildWorkContractAccepted: function () { return undefined; },
                    buildDetourRequested: function () { return undefined; },
                    buildDetourReviewed: function () { return undefined; },
                    validateDetour: function () { return []; },
                    mergeDetourIntoContract: function () { return undefined; },
                    validateWorkContractFields: function () { return []; },
                    evaluateCompletionCard: function () { return undefined; },
                    agentActionNode: function () { return undefined; },
                    approvalEdge: function () { return undefined; },
                    approvalNode: function () { return undefined; },
                    completionNode: function () { return undefined; },
                    checkpointNode: function () { return undefined; },
                    constitutionCheckEdge: function () { return undefined; },
                    constitutionRuleNode: function () { return undefined; },
                    externalWorkspaceChangeNode: function () { return undefined; },
                    toolCallEdge: function () { return undefined; },
                    toolCallNode: function () { return undefined; },
                    rollbackCheckpointEdge: function () { return undefined; },
                    workspaceChangeEdge: function () { return undefined; },
                    workspaceChangeNode: function () { return undefined; },
                };
                ctx = {
                    state: {
                        pluginStoreRoot: "/tmp/natalia-hot-state",
                        serviceDirectory: (0, runtime_services_1.createTestContext)([
                            governance_ledger_1.governanceLedgerController.mock(ledger),
                            work_ledger_1.workLedgerController.mock(ledger),
                        ]),
                    },
                    ports: {
                        getReady: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, undefined];
                        }); }); },
                        getExecutionBySession: function () { return new Map([["ses_hot_state", exec]]); },
                        getActiveExec: function () { return exec; },
                        resolveService: function () { return ({
                            buildDriftFindingUpdate: function (input) { return (__assign({ type: "drift.finding_updated", id: input.id, findingID: input.findingID, status: input.status }, (input.rationale ? { rationale: input.rationale } : {}))); },
                        }); },
                        publishForSession: function (_exec, event) {
                            published.push(event);
                        },
                    },
                };
                surface = (0, intelligence_1.createIntelligenceSurface)(ctx, {});
                return [4 /*yield*/, surface.acknowledgeDriftFinding({ findingID: "DF-1", status: "explained" }, "ses_hot_state")];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toEqual({ acknowledged: true });
                (0, bun_test_1.expect)(published.filter(function (e) { return e.type === "drift.finding_updated"; })).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
