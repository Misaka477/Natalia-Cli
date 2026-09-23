"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPEAT_MAX = exports.REPEAT_WINDOW_MS = void 0;
exports.repeatKey = repeatKey;
exports.recordRepeat = recordRepeat;
exports.clearRepeat = clearRepeat;
/**
 * Sliding-window repeated tool-call guard.
 *
 * Unlike the old exact-count guard, this keeps a per-session (or per-subagent)
 * sliding window of timestamps for each normalized tool signature. A call is
 * blocked only when the same normalized tool call appears more than
 * `REPEAT_MAX` times inside `REPEAT_WINDOW_MS`.
 *
 * The key is normalized before comparison:
 * - JSON arguments are parsed and re-serialized;
 * - absolute workspace paths are replaced with a stable `<workspace>` marker;
 * - non-JSON raw argument strings also get the same workspace-path replacement.
 */
exports.REPEAT_WINDOW_MS = Math.max(1000, Number((_a = process.env.NATALIA_REPEAT_WINDOW_MS) !== null && _a !== void 0 ? _a : 60000));
exports.REPEAT_MAX = Math.max(1, Number((_b = process.env.NATALIA_REPEAT_MAX) !== null && _b !== void 0 ? _b : 10));
function normalizeString(value, workspaceRoot) {
    if (workspaceRoot && value.includes(workspaceRoot))
        return value.split(workspaceRoot).join("<workspace>");
    return value;
}
function normalizeValue(value, workspaceRoot) {
    if (typeof value === "string")
        return normalizeString(value, workspaceRoot);
    if (Array.isArray(value))
        return value.map(function (item) { return normalizeValue(item, workspaceRoot); });
    if (value && typeof value === "object") {
        var normalized = {};
        for (var _i = 0, _a = Object.entries(value); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], item = _b[1];
            normalized[key] = normalizeValue(item, workspaceRoot);
        }
        return normalized;
    }
    return value;
}
function repeatKey(toolName, rawArguments, workspaceRoot) {
    try {
        var parsed = JSON.parse(rawArguments);
        return "".concat(toolName, "\0").concat(JSON.stringify(normalizeValue(parsed, workspaceRoot)));
    }
    catch (_a) {
        return "".concat(toolName, "\0").concat(normalizeString(rawArguments, workspaceRoot));
    }
}
function recordRepeat(store, key, now) {
    var _a;
    if (now === void 0) { now = Date.now(); }
    var cutoff = now - exports.REPEAT_WINDOW_MS;
    var recent = ((_a = store.get(key)) !== null && _a !== void 0 ? _a : []).filter(function (at) { return at >= cutoff; });
    recent.push(now);
    store.set(key, recent);
    return {
        count: recent.length,
        blocked: recent.length > exports.REPEAT_MAX,
    };
}
function clearRepeat(store, key) {
    store.delete(key);
}
