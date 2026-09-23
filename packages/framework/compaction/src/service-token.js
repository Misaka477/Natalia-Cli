"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactionService = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The compaction service token; lives with the mechanism that implements it. */
exports.compactionService = (0, runtime_services_1.defineService)("compaction.service", { scope: "workspace", capability: "services" });
