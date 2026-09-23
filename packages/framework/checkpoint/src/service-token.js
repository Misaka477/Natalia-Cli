"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkpointFactory = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * The checkpoint factory token; lives with the mechanism that implements it.
 */
exports.checkpointFactory = (0, runtime_services_1.defineService)("checkpoint.factory", { scope: "workspace", capability: "services" });
