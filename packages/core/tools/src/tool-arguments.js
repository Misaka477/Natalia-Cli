"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseToolArguments = parseToolArguments;
exports.tryParseToolArguments = tryParseToolArguments;
/** Parse the raw JSON arguments emitted for a tool call. */
function parseToolArguments(input) {
    if (!input.trim())
        return {};
    return JSON.parse(input);
}
/** Best-effort object parsing for policy and presentation paths. */
function tryParseToolArguments(input) {
    try {
        var parsed = parseToolArguments(input);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            return parsed;
    }
    catch (_a) {
        // The execution boundary reports malformed arguments in detail.
    }
    return {};
}
