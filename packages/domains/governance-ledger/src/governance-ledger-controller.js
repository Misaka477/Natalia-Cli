"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGovernanceLedgerController = createGovernanceLedgerController;
var constitution_ledger_1 = require("./constitution-ledger");
var evidence_ledger_1 = require("./evidence-ledger");
function createGovernanceLedgerController() {
    return {
        seedConstitutionRules: constitution_ledger_1.seedConstitutionRules,
        recordDecision: constitution_ledger_1.recordDecision,
        boundValidationOutcome: evidence_ledger_1.boundValidationOutcome,
        buildCompletionRecorded: evidence_ledger_1.buildCompletionRecorded,
        buildEvidenceRecorded: evidence_ledger_1.buildEvidenceRecorded,
        buildHumanValidation: evidence_ledger_1.buildHumanValidation,
        evidenceStatusForPlanState: evidence_ledger_1.evidenceStatusForPlanState,
        validateConstitutionRuleProposal: constitution_ledger_1.validateConstitutionRuleProposal,
        buildProposedConstitutionRule: constitution_ledger_1.buildProposedConstitutionRule,
        buildPromotedConstitutionRule: constitution_ledger_1.buildPromotedConstitutionRule,
        buildConstitutionRuleUpdate: constitution_ledger_1.buildConstitutionRuleUpdate,
        buildUserConstitutionRule: constitution_ledger_1.buildUserConstitutionRule,
        buildConstitutionRuleRemoved: constitution_ledger_1.buildConstitutionRuleRemoved,
    };
}
