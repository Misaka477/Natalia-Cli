"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactToolOutput = redactToolOutput;
function redactToolOutput(output, redact) {
    if (!redact)
        return output;
    return output.replace(/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu, function (match) {
        return "".concat(match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1), "[REDACTED]");
    });
}
