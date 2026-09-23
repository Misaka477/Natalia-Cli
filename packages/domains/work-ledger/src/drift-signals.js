"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRIFT_SIGNAL_WINDOW = void 0;
exports.deriveDriftBehaviorSignals = deriveDriftBehaviorSignals;
/** How many recent events to scan for behaviour signals. */
exports.DRIFT_SIGNAL_WINDOW = 40;
/** A pure FNV-1a hash of a string, as a short base36 key (no node crypto dep). */
function hashKey(text) {
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
/**
 * Derive the behaviour signals from a session's recent events. `tool.update`
 * events with status "failed" become failure-loop entries; progress-marker
 * events (evidence / completion / plan step) and tool calls become actions.
 */
function deriveDriftBehaviorSignals(events, options) {
    var _a, _b;
    var window = (_a = options === null || options === void 0 ? void 0 : options.window) !== null && _a !== void 0 ? _a : exports.DRIFT_SIGNAL_WINDOW;
    var tail = events.slice(-window);
    var recentActions = [];
    var recentFailures = [];
    for (var _i = 0, tail_1 = tail; _i < tail_1.length; _i++) {
        var event_1 = tail_1[_i];
        switch (event_1.type) {
            case "evidence.recorded":
                recentActions.push({ kind: "evidence.recorded" });
                break;
            case "completion.recorded":
                recentActions.push({ kind: "completion.recorded" });
                break;
            case "plan.doc.updated":
                recentActions.push({ kind: "plan_step" });
                break;
            case "tool.update": {
                recentActions.push({ kind: "tool_call" });
                if (event_1.status === "failed") {
                    recentFailures.push({
                        toolName: event_1.name,
                        key: hashKey((_b = event_1.argumentsDelta) !== null && _b !== void 0 ? _b : ""),
                    });
                }
                break;
            }
            default:
                break;
        }
    }
    return { recentActions: recentActions, recentFailures: recentFailures };
}
