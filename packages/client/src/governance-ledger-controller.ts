import { recordDecision, seedConstitutionRules } from "./constitution-ledger";
import {
  boundValidationOutcome,
  buildCompletionRecorded,
  buildEvidenceRecorded,
  evidenceStatusForPlanState,
} from "./evidence-ledger";

export type { PlanLifecycleState } from "./evidence-ledger";

export type GovernanceLedgerController = {
  seedConstitutionRules: typeof seedConstitutionRules;
  recordDecision: typeof recordDecision;
  boundValidationOutcome: typeof boundValidationOutcome;
  buildCompletionRecorded: typeof buildCompletionRecorded;
  buildEvidenceRecorded: typeof buildEvidenceRecorded;
  evidenceStatusForPlanState: typeof evidenceStatusForPlanState;
};

export function createGovernanceLedgerController(): GovernanceLedgerController {
  return {
    seedConstitutionRules,
    recordDecision,
    boundValidationOutcome,
    buildCompletionRecorded,
    buildEvidenceRecorded,
    evidenceStatusForPlanState,
  };
}
