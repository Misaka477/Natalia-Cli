"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachmentService = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The attachment service token; lives with the mechanism. */
exports.attachmentService = (0, runtime_services_1.defineService)("attachment.service", { scope: "workspace", capability: "services" });
