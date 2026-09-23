"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERBOSE_OUTPUT_MAX_CHARS = void 0;
exports.boundVerboseOutput = boundVerboseOutput;
/**
 * Bounds one subagent's verbose log for hand-off to the parent.
 *
 * `formatOutput(verbose)` returns the whole audit trail, and a subagent that ran
 * many steps with tool output produces a great deal of it. Handing that to the
 * parent verbatim spends the parent's context on a history it rarely needs whole
 * — the same reason the concise path already truncates.
 *
 * The tail is kept, not the head: the most recent steps are what the parent acts
 * on, and the note says how much was dropped rather than hiding it, because a
 * log that silently ends early reads as a subagent that finished early.
 */
exports.VERBOSE_OUTPUT_MAX_CHARS = 8000;
/** How many of the newest steps fit in the budget, and what was dropped. */
function boundVerboseOutput(lines, maxChars) {
    if (maxChars === void 0) { maxChars = exports.VERBOSE_OUTPUT_MAX_CHARS; }
    if (maxChars <= 0)
        return lines.join("\n");
    var kept = [];
    var chars = 0;
    for (var index = lines.length - 1; index >= 0; index -= 1) {
        var line = lines[index];
        if (kept.length > 0 && chars + line.length + 1 > maxChars)
            break;
        kept.unshift(line);
        chars += line.length + 1;
    }
    var dropped = lines.length - kept.length;
    if (dropped === 0)
        return kept.join("\n");
    return "".concat(kept.join("\n"), "\n\u2026 (").concat(dropped, " earlier step").concat(dropped === 1 ? "" : "s", " omitted, ").concat(lines.length, " total)");
}
