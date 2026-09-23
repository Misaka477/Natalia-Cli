"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.governanceLedgerController = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The governance ledger controller token; lives with the mechanism. */
exports.governanceLedgerController = (0, runtime_services_1.defineService)("governance-ledger.controller", {
    scope: "workspace",
    capability: "services",
});
