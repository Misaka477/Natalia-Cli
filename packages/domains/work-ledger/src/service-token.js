"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workLedgerController = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The work ledger controller token; lives with the mechanism. */
exports.workLedgerController = (0, runtime_services_1.defineService)("work-ledger.controller", { scope: "workspace", capability: "services" });
