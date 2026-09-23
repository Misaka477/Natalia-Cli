"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminalApprovalScope = terminalApprovalScope;
exports.terminalInputRisk = terminalInputRisk;
exports.readOnlyToolMessage = readOnlyToolMessage;
var tools_1 = require("@anthelia/tools");
function terminalApprovalScope(toolName, rawArguments) {
    var args = (0, tools_1.tryParseToolArguments)(rawArguments);
    var terminalID = typeof args.id === "string" ? args.id : undefined;
    if (!terminalID)
        return undefined;
    if (![
        "interactive_terminal_write",
        "interactive_terminal_send_line",
        "interactive_terminal_keys",
    ].includes(toolName))
        return undefined;
    var risk = terminalInputRisk(toolName, args);
    return {
        terminalID: terminalID,
        risk: risk,
        scope: "terminal:".concat(terminalID, ":").concat(risk === "terminal_low" ? "low-risk" : "high-risk"),
        ttlMs: 30 * 60 * 1000,
    };
}
function terminalInputRisk(toolName, args) {
    if (toolName === "interactive_terminal_keys") {
        var keys = Array.isArray(args.keys)
            ? args.keys
            : args.key === undefined
                ? []
                : [{ key: args.key, modifiers: args.modifiers }];
        return keys.every(function (value) {
            if (!value || typeof value !== "object")
                return false;
            var key = value;
            var modifiers = Array.isArray(key.modifiers) ? key.modifiers : [];
            return (modifiers.length === 0 &&
                typeof key.key === "string" &&
                /^[\p{L}\p{N}\p{P}\p{S}\s]$/u.test(key.key));
        })
            ? "terminal_low"
            : "terminal_high";
    }
    var input = typeof args.text === "string" ? args.text : args.input;
    if (typeof input !== "string")
        return "terminal_high";
    return /(?:\brm\b|\bsudo\b|\bcurl\b|\bwget\b|\bssh\b|\bscp\b|\b(?:git\s+push|npm\s+publish)\b|>|\bchmod\b|\bkill\b)/iu.test(input)
        ? "terminal_high"
        : "terminal_low";
}
function readOnlyToolMessage(toolName) {
    return "tool denied by read-only permission mode: ".concat(toolName);
}
