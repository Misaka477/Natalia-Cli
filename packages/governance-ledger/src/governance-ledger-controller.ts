import { recordDecision, seedConstitutionRules } from "./constitution-ledger";
import {
  boundValidationOutcome,
  buildCompletionRecorded,
  buildEvidenceRecorded,
  evidenceStatusForPlanState,
} from "./evidence-ledger";
import type { GovernanceLedgerController } from "@natalia/runtime-services";

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
