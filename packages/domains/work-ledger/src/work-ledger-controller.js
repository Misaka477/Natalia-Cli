"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkLedgerController = createWorkLedgerController;
var drift_evaluator_1 = require("./drift-evaluator");
var plan_registry_1 = require("./plan-registry");
var work_contract_1 = require("./work-contract");
var work_graph_1 = require("./work-graph");
function createWorkLedgerController(input) {
    var driftEvaluator = (0, drift_evaluator_1.createDriftEvaluator)(input);
    return {
        buildPlanDocCreated: plan_registry_1.buildPlanDocCreated,
        buildPlanDocDeleted: plan_registry_1.buildPlanDocDeleted,
        buildPlanDocMarked: plan_registry_1.buildPlanDocMarked,
        buildPlanDocStatus: plan_registry_1.buildPlanDocStatus,
        buildPlanDocUpdated: plan_registry_1.buildPlanDocUpdated,
        buildAuditRequested: plan_registry_1.buildAuditRequested,
        evaluateDrift: driftEvaluator.evaluate,
        evaluateBehaviorDrift: driftEvaluator.evaluateBehavior,
        buildDriftFindingUpdate: drift_evaluator_1.buildDriftFindingUpdate,
        buildWorkContractDrafted: work_contract_1.buildWorkContractDrafted,
        buildWorkContractAccepted: work_contract_1.buildWorkContractAccepted,
        buildDetourRequested: work_contract_1.buildDetourRequested,
        buildDetourReviewed: work_contract_1.buildDetourReviewed,
        validateDetour: work_contract_1.validateDetour,
        mergeDetourIntoContract: work_contract_1.mergeDetourIntoContract,
        validateWorkContractFields: work_contract_1.validateWorkContractFields,
        evaluateCompletionCard: work_contract_1.evaluateCompletionCard,
        agentActionNode: work_graph_1.agentActionNode,
        approvalEdge: work_graph_1.approvalEdge,
        approvalNode: work_graph_1.approvalNode,
        completionNode: work_graph_1.completionNode,
        completionValidationEdge: work_graph_1.completionValidationEdge,
        checkpointNode: work_graph_1.checkpointNode,
        constitutionCheckEdge: work_graph_1.constitutionCheckEdge,
        constitutionRuleNode: work_graph_1.constitutionRuleNode,
        decisionNode: work_graph_1.decisionNode,
        externalWorkspaceChangeNode: work_graph_1.externalWorkspaceChangeNode,
        toolCallEdge: work_graph_1.toolCallEdge,
        toolCallNode: work_graph_1.toolCallNode,
        rollbackCheckpointEdge: work_graph_1.rollbackCheckpointEdge,
        workspaceChangeEdge: work_graph_1.workspaceChangeEdge,
        workspaceChangeNode: work_graph_1.workspaceChangeNode,
    };
}
