"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationLog = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * The operation-log service (decisions §5: the runtime telemetry zone —
 * process-scoped, one per runtime instance, its own file and retention).
 */
exports.operationLog = (0, runtime_services_1.defineService)("operation.log", {
    scope: "process",
    capability: "services",
});
