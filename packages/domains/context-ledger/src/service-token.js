"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextLedgerFactory = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The context ledger factory token; lives with the mechanism. */
exports.contextLedgerFactory = (0, runtime_services_1.defineService)("context-ledger.factory", { scope: "workspace", capability: "services" });
