"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactionDisplayLine = compactionDisplayLine;
function compactionDisplayLine(event) {
    var _a;
    if (event.type === "context.status") {
        return "Context ".concat(event.used, "/").concat(event.max, " source=").concat(event.source, " threshold=").concat(event.thresholdPercent, "% reserved=").concat(event.reserved);
    }
    if (event.type === "compaction.begin") {
        return "Compacting after ".concat(event.trigger, ": ").concat(event.beforeTokens, "/").concat(event.maxTokens, ", reserved ").concat(event.reservedTokens);
    }
    if (event.type === "compaction.end") {
        return event.success
            ? "Compaction complete: ".concat(event.beforeTokens, " -> ").concat(event.afterTokens, " tokens in ").concat(event.durationMs, "ms")
            : "Compaction failed atomically: ".concat((_a = event.error) !== null && _a !== void 0 ? _a : "unknown");
    }
    if (event.type === "context.limit.recovery") {
        return event.compacted
            ? "Context-limit recovery compacted once; retrying original step"
            : "Context-limit recovery requested";
    }
    return undefined;
}
