"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.turnController = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The turn orchestration controller token; lives with the mechanism. */
exports.turnController = (0, runtime_services_1.defineService)("turn.controller", {
    scope: "workspace",
    capability: "services",
});
