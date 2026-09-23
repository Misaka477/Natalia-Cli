"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wireGovernanceLedger = wireGovernanceLedger;
/**
 * Framework subsystem composition — initialize/framework-governance-ledger.ts.
 *
 * The governance ledger (constitution, decision, evidence and completion
 * writers) is a framework-internal subsystem, not a plugin: this module
 * constructs the controller directly and contributes it as the
 * `governance-ledger.controller` service. It depends on the work-ledger
 * subsystem, which is wired before it.
 */
var governance_ledger_1 = require("@natalia/governance-ledger");
var governance_ledger_2 = require("@natalia/governance-ledger");
function wireGovernanceLedger(ctx) {
    var registry = ctx.state.capabilityRegistry;
    var owner = registry.registerOwner({
        id: "natalia-governance-ledger",
        name: "Governance Ledger",
        version: "1.0.0",
        scope: "workspace",
        grants: ["services"],
    });
    ctx.state.serviceDirectory.provide(governance_ledger_2.governanceLedgerController, (0, governance_ledger_1.createGovernanceLedgerController)());
}
