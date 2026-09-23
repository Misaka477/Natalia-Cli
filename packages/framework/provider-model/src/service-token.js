"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerModelController = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The provider/model controller token; lives with the mechanism. */
exports.providerModelController = (0, runtime_services_1.defineService)("provider-model.controller", { scope: "workspace", capability: "services" });
