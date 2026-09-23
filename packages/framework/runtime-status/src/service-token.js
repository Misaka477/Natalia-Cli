"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusSnapshotController = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/** The runtime status snapshot controller token; lives with the mechanism. */
exports.statusSnapshotController = (0, runtime_services_1.defineService)("status.snapshot.controller", { scope: "workspace", capability: "services" });
