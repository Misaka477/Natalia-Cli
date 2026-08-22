import {
  buildDriftFindingUpdate,
  createDriftEvaluator,
} from "./drift-evaluator";
import { buildPlanDraftCreated, buildPlanTransition } from "./plan-ledger";
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

export type WorkLedgerController = {
  buildPlanDraftCreated: typeof buildPlanDraftCreated;
  buildPlanTransition: typeof buildPlanTransition;
  evaluateDrift: ReturnType<typeof createDriftEvaluator>["evaluate"];
  buildDriftFindingUpdate: typeof buildDriftFindingUpdate;
  agentActionNode: typeof agentActionNode;
  approvalEdge: typeof approvalEdge;
  approvalNode: typeof approvalNode;
  completionValidationEdge: typeof completionValidationEdge;
  checkpointNode: typeof checkpointNode;
  constitutionCheckEdge: typeof constitutionCheckEdge;
  constitutionRuleNode: typeof constitutionRuleNode;
  decisionNode: typeof decisionNode;
  externalWorkspaceChangeNode: typeof externalWorkspaceChangeNode;
  toolCallEdge: typeof toolCallEdge;
  toolCallNode: typeof toolCallNode;
  rollbackCheckpointEdge: typeof rollbackCheckpointEdge;
  workspaceChangeEdge: typeof workspaceChangeEdge;
  workspaceChangeNode: typeof workspaceChangeNode;
};

export function createWorkLedgerController(
  input: Parameters<typeof createDriftEvaluator>[0],
): WorkLedgerController {
  const driftEvaluator = createDriftEvaluator(input);
  return {
    buildPlanDraftCreated,
    buildPlanTransition,
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
