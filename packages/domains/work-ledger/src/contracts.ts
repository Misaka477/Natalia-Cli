import type { SessionID } from "@natalia/contracts";
import type { ServiceOperation } from "@natalia/runtime-services";

/** Work ledger contracts, moved from runtime-services with the token. */

export interface WorkLedgerController {
  buildPlanDocCreated: ServiceOperation;
  buildPlanDocUpdated: ServiceOperation;
  buildPlanDocMarked: ServiceOperation;
  buildPlanDocDeleted: ServiceOperation;
  buildPlanDocStatus: ServiceOperation;
  buildAuditRequested: ServiceOperation;
  evaluateDrift: ServiceOperation;
  evaluateBehaviorDrift: ServiceOperation;
  buildDriftFindingUpdate: ServiceOperation;
  buildWorkContractDrafted: ServiceOperation;
  buildWorkContractAccepted: ServiceOperation;
  buildDetourRequested: ServiceOperation;
  buildDetourReviewed: ServiceOperation;
  validateDetour: ServiceOperation;
  mergeDetourIntoContract: ServiceOperation;
  validateWorkContractFields: ServiceOperation;
  evaluateCompletionCard: ServiceOperation;
  agentActionNode: ServiceOperation;
  approvalEdge: ServiceOperation;
  approvalNode: ServiceOperation;
  completionNode: ServiceOperation;
  completionValidationEdge: ServiceOperation;
  checkpointNode: ServiceOperation;
  constitutionCheckEdge: ServiceOperation;
  constitutionRuleNode: ServiceOperation;
  decisionNode: ServiceOperation;
  externalWorkspaceChangeNode: ServiceOperation;
  toolCallEdge: ServiceOperation;
  toolCallNode: ServiceOperation;
  rollbackCheckpointEdge: ServiceOperation;
  workspaceChangeEdge: ServiceOperation;
  workspaceChangeNode: ServiceOperation;
}
