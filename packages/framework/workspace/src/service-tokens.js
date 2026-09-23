"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceWriteLock = exports.workspaceMutations = exports.workspaceFiles = void 0;
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * Workspace service tokens. Same shape as the engine's other mechanism
 * packages: typed faces over the wire names the runtime resolves, living in
 * the package that owns the mechanism.
 */
exports.workspaceFiles = (0, runtime_services_1.defineService)("workspace.files", { scope: "workspace", capability: "services" });
exports.workspaceMutations = (0, runtime_services_1.defineService)("workspace.mutations", { scope: "workspace", capability: "services" });
exports.workspaceWriteLock = (0, runtime_services_1.defineService)("workspace.writeLock", { scope: "workspace", capability: "services" });
