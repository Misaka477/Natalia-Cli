"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolPolicy = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The tool policy service token; lives with the mechanism. */
exports.toolPolicy = (0, runtime_services_1.defineService)("tool.policy", {
    scope: "workspace",
    capability: "services",
});
