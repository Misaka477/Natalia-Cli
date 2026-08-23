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
import type { WorkLedgerController } from "@natalia/runtime-services";

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
