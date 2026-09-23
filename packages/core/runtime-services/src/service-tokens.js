"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeDiagnostics = exports.sandboxService = exports.subagentsService = exports.terminalInput = exports.skillsInput = exports.mcpInput = exports.localToolsInput = exports.terminalController = exports.mcpService = exports.localToolsReload = exports.teamBehavior = exports.skillService = void 0;
var service_token_1 = require("./service-token");
/** The skills registry the runtime reads discovered skills through. */
exports.skillService = (0, service_token_1.defineService)("skills.service", {
    scope: "workspace",
    capability: "services",
});
/** The team behavior surface collaboration tools consult. */
exports.teamBehavior = (0, service_token_1.defineService)("team.behavior", { scope: "workspace", capability: "services" });
/** The reload hook the local-tools plugin exposes for config changes. */
exports.localToolsReload = (0, service_token_1.defineService)("localTools.reload", { scope: "workspace", capability: "services" });
/** The MCP hub: server registry, connection lifecycle, tool surface. */
exports.mcpService = (0, service_token_1.defineService)("mcp.service", {
    scope: "workspace",
    capability: "services",
});
/** The native terminal controller the tool pipeline drives panes through. */
exports.terminalController = (0, service_token_1.defineService)("terminal.controller", { scope: "workspace", capability: "services" });
/**
 * The four host inputs official plugins receive at setup. Each plugin package
 * used to re-declare the wire name and a duplicate of the input type; the
 * token plus the contract type above are now the single home, so manifest
 * `requires`, `api.services.get`, and the framework's provide site all speak
 * one spelling.
 */
/** Roots and trust callbacks the local-tools plugin discovers families from. */
exports.localToolsInput = (0, service_token_1.defineService)("localTools.input", {
    scope: "workspace",
    capability: "services",
});
/** MCP server registry view for the MCP plugin. */
exports.mcpInput = (0, service_token_1.defineService)("mcp.input", {
    scope: "workspace",
    capability: "services",
});
/** Discovery roots and hooks for the skills plugin. */
exports.skillsInput = (0, service_token_1.defineService)("skills.input", {
    scope: "workspace",
    capability: "services",
});
/** Controller construction input for the native-terminal plugin. */
exports.terminalInput = (0, service_token_1.defineService)("terminal.input", {
    scope: "workspace",
    capability: "services",
});
/**
 * Engine-internal services that cross the plugin boundary: official plugins
 * require them at setup (`manifest.requires`), so their tokens live here
 * beside the contract types rather than in the mechanism packages — the same
 * rule as the host inputs, applied in the provide direction.
 */
/** Subagent registry the team plugin fans work out through. */
exports.subagentsService = (0, service_token_1.defineService)("subagents.service", { scope: "workspace", capability: "services" });
/** Sandbox controller the team plugin scopes its runs in. */
exports.sandboxService = (0, service_token_1.defineService)("sandbox.service", {
    scope: "workspace",
    capability: "services",
});
/**
 * The domain-invariant layer's service (Discovery D1). The token lives
 * with the other boundary tokens: runtime-diagnostics must stay free of
 * this package's dependency fan-out (it already reaches framework/session
 * through here — a token declared there would close a reference cycle).
 */
exports.runtimeDiagnostics = (0, service_token_1.defineService)("runtime.diagnostics", { scope: "process", capability: "services" });
