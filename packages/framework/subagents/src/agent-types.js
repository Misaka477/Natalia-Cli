"use strict";
/**
 * Rendering and resolving the configured agent types that `agent_spawn` offers.
 *
 * The configured agents are the subagent types: each carries its own tool
 * restrictions and system prompt. Advertising them without saying what tools
 * each one has leaves the model guessing — it cannot tell a read-only explorer
 * from a full implementer, which is the one distinction the choice turns on.
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeToolAccess = describeToolAccess;
exports.renderSubagentTypes = renderSubagentTypes;
exports.resolveSubagentType = resolveSubagentType;
/**
 * The tool access an agent type grants, as a single line.
 *
 * An explicit allow-list is reported as itself. Otherwise the type is "all
 * available" narrowed by its exclusions, which is the shape most agents use and
 * reads better than a list of every tool name. No count: the count would make
 * the description depend on the order tools are registered in, and that order is
 * part of the request prefix.
 */
function describeToolAccess(agent) {
    var _a, _b;
    var allowed = (_a = agent.allowedTools) !== null && _a !== void 0 ? _a : [];
    if (allowed.length > 0)
        return "tools: ".concat(allowed.join(", "));
    var excluded = (_b = agent.excludedTools) !== null && _b !== void 0 ? _b : [];
    if (excluded.length === 0)
        return "tools: all available";
    return "tools: all except ".concat(excluded.join(", "));
}
/**
 * Render the spawnable agent types for a tool description.
 *
 * Empty when nothing is configured: a section listing nothing is worse than no
 * section, because it reads as "there are types and they are not documented".
 */
function renderSubagentTypes(agents) {
    var spawnable = agents.filter(function (agent) { var _a; return ((_a = agent.mode) !== null && _a !== void 0 ? _a : "primary") === "subagent" && agent.description; });
    if (spawnable.length === 0)
        return "";
    var lines = spawnable.map(function (agent) {
        return "- ".concat(agent.name, ": ").concat(agent.description, " (").concat(describeToolAccess(agent), ")");
    });
    return __spreadArray([
        "",
        "Pass one of these as `type` to spawn a configured agent type; omit `type` " +
            "to spawn a general subagent with every tool."
    ], lines, true).join("\n");
}
/**
 * Resolve a requested type name against the configured agents.
 *
 * Throws on an unknown name rather than silently falling back to a general
 * subagent: a caller that asked for a read-only explorer and got a full
 * implementer has not been served, and nothing downstream would say so.
 */
function resolveSubagentType(name, agents) {
    var match = agents.find(function (agent) { return agent.name === name; });
    if (!match)
        throw new Error("unknown subagent type \"".concat(name, "\"; configured types: ") +
            (agents.length ? agents.map(function (agent) { return agent.name; }).join(", ") : "none"));
    return match;
}
