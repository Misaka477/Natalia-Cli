"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionStoreController = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * The session store controller token; lives with the mechanism. With this one
 * landed, the central service-id table is empty and every service the runtime
 * resolves speaks its token.
 */
exports.sessionStoreController = (0, runtime_services_1.defineService)("session-store.controller", { scope: "workspace", capability: "services" });
