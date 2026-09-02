import {
  buildDriftFindingUpdate,
  createDriftEvaluator,
} from "./drift-evaluator";
import {
  buildPlanDocCreated,
  buildPlanDocDeleted,
  buildPlanDocMarked,
  buildPlanDocStatus,
  buildPlanDocUpdated,
} from "./plan-registry";
import {
  agentActionNode,
  approvalEdge,
  approvalNode,
  completionValidationEdge,
  checkpointNode,
  constitutionCheckEdge,
  constitutionRuleNode,
  decisionNode,
  externalWorkspaceChangeNode,
  toolCallEdge,
  toolCallNode,
  rollbackCheckpointEdge,
  workspaceChangeEdge,
  workspaceChangeNode,
} from "./work-graph";
import type { WorkLedgerController } from "@natalia/runtime-services";

export function createWorkLedgerController(
  input: Parameters<typeof createDriftEvaluator>[0],
): WorkLedgerController {
  const driftEvaluator = createDriftEvaluator(input);
  return {
    buildPlanDocCreated,
    buildPlanDocDeleted,
    buildPlanDocMarked,
    buildPlanDocStatus,
    buildPlanDocUpdated,
    evaluateDrift: driftEvaluator.evaluate,
    buildDriftFindingUpdate,
    agentActionNode,
    approvalEdge,
    approvalNode,
    completionValidationEdge,
    checkpointNode,
    constitutionCheckEdge,
    constitutionRuleNode,
    decisionNode,
    externalWorkspaceChangeNode,
    toolCallEdge,
    toolCallNode,
    rollbackCheckpointEdge,
    workspaceChangeEdge,
    workspaceChangeNode,
  };
}
