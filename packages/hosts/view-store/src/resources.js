"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
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
exports.applyResourceEvent = applyResourceEvent;
var state_1 = require("./state");
/**
 * Keeps the visible tail of a transcript and says how much was dropped, so a
 * consumer never silently renders a truncated scrollback as if it were complete.
 */
function boundTerminalTranscript(event) {
    var transcript = event.transcript;
    if (!transcript || transcript.length <= state_1.terminalTranscriptChars)
        return event;
    var omitted = transcript.length - state_1.terminalTranscriptChars;
    return __assign(__assign({}, event), { transcript: "... ".concat(omitted, " earlier chars omitted from live pane ...\n").concat(transcript.slice(-state_1.terminalTranscriptChars)) });
}
function sameTimelineEntry(previous, next) {
    return (previous.at === next.at &&
        previous.actor === next.actor &&
        previous.action === next.action &&
        previous.status === next.status);
}
/**
 * The fields a republished update is compared on. This list is load-bearing: the
 * comparison below is built from it, so a field that is not listed is not
 * compared and a change to it would be dropped.
 */
var comparedTerminalFields = [
    "status",
    "attached",
    "rows",
    "cols",
    "activity",
    "tail",
    "transcript",
    "command",
    "cwd",
    "prompt",
    "lastAction",
    "target",
    "ownership",
    "approvalID",
    "revision",
    "lastOutputAt",
    "viewers",
    "inputOwner",
    "geometryOwner",
    // The execution this pane state was published from. A record left on a stale
    // episode attributes the pane to the wrong run.
    "episodeID",
    // The session that published the update; a pane left on a stale session
    // would render under the wrong ownership.
    "sessionID",
    // Child-owned terminal updates are isolated by their subagent projection.
    "agentID",
];
/**
 * Fields deliberately left out of the comparison, each with a reason:
 *   - `type` and `id` select the record; two updates being compared always agree.
 *   - `screen` is a pure function of `revision`: the terminal registry's
 *     `screenSnapshot()` caches one snapshot per revision, so the frame cannot
 *     change without `revision` changing, and `revision` is compared.
 *     Deep-comparing a cell grid on every keystroke would cost more than the
 *     dedupe saves.
 */
var uncomparedTerminalFields = [
    "type",
    "id",
    "screen",
    "workspaceID",
];
/** Structural equality for the small JSON values these fields hold. */
function sameObservedValue(previous, next) {
    if (previous === next)
        return true;
    if (typeof previous !== "object" ||
        typeof next !== "object" ||
        previous === null ||
        next === null)
        return false;
    if (Array.isArray(previous) !== Array.isArray(next))
        return false;
    if (Array.isArray(previous) && Array.isArray(next))
        return (previous.length === next.length &&
            previous.every(function (item, index) { return sameObservedValue(item, next[index]); }));
    var previousKeys = Object.keys(previous);
    var nextKeys = Object.keys(next);
    if (previousKeys.length !== nextKeys.length)
        return false;
    return previousKeys.every(function (key) {
        return key in next &&
            sameObservedValue(previous[key], next[key]);
    });
}
/**
 * True when nothing a consumer can observe changed, so the republish can be
 * dropped. Input and geometry ownership are part of this: a UI renders who holds
 * the keyboard, and a projection that stored a stale owner would tell the user
 * the model is typing when a person is.
 */
function sameTerminalState(previous, next) {
    return comparedTerminalFields.every(function (field) {
        return sameObservedValue(previous[field], next[field]);
    });
}
/** Returns true when the event belongs to this projection. */
function applyResourceEvent(state, event) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var _o, _p;
    switch (event.type) {
        case "terminal.update": {
            var previous = state.terminals[event.id];
            var next = boundTerminalTranscript(event);
            // A pane republishes on every keystroke, so an update that changes nothing
            // a consumer can see is dropped rather than forcing a re-render.
            if (previous && sameTerminalState(previous, next))
                return true;
            state.terminals = __assign(__assign({}, state.terminals), (_a = {}, _a[event.id] = next, _a));
            return true;
        }
        case "terminal.timeline": {
            var existing = (_o = state.terminalTimeline[event.id]) !== null && _o !== void 0 ? _o : [];
            // Replaying history re-delivers events a consumer may already hold, so an
            // entry identical in time, actor, action and outcome is the same entry, not a
            // second occurrence. Without this, every reconnect doubles the timeline.
            if (existing.some(function (entry) { return sameTimelineEntry(entry, event); }))
                return true;
            state.terminalTimeline = __assign(__assign({}, state.terminalTimeline), (_b = {}, _b[event.id] = (0, state_1.appendBounded)(existing, event, state_1.terminalTimelineLimit), _b));
            return true;
        }
        case "terminal.approval":
            // Keyed by approval id, not terminal id: one pane can have several
            // approvals over its life and a UI needs to resolve the right one.
            state.terminalApprovals = __assign(__assign({}, state.terminalApprovals), (_c = {}, _c[event.approvalID] = event, _c));
            return true;
        case "terminal.action":
            return true;
        case "terminal.viewer":
            return true;
        case "sandbox.update":
            state.sandboxes = __assign(__assign({}, state.sandboxes), (_d = {}, _d[event.id] = event, _d));
            return true;
        case "sandbox.diff":
            state.sandboxDiffs = __assign(__assign({}, state.sandboxDiffs), (_e = {}, _e[event.id] = event, _e));
            return true;
        case "sandbox.audit":
            (0, state_1.upsertBlock)(state, "sandbox:".concat(event.id, ":").concat(event.action), "system", event.message, event.approvalRequired ? "approval_required" : undefined);
            return true;
        case "subagent.update": {
            state.subagents = __assign(__assign({}, state.subagents), (_f = {}, _f[event.id] = event, _f));
            var list = (_p = state.subagentHistory[event.id]) !== null && _p !== void 0 ? _p : [];
            var key_1 = (0, state_1.subagentHistoryRowKey)(event);
            if (!list.some(function (item) { return (0, state_1.subagentHistoryRowKey)(item) === key_1; }))
                state.subagentHistory = __assign(__assign({}, state.subagentHistory), (_g = {}, _g[event.id] = __spreadArray(__spreadArray([], list, true), [event], false), _g));
            return true;
        }
        case "checkpoint.created":
            state.checkpoints = (0, state_1.appendBounded)(state.checkpoints, event, state_1.checkpointLimit);
            return true;
        case "checkpoint.failed":
            // An incomplete checkpoint is a rollback-safety fact, so say so rather
            // than dropping it.
            (0, state_1.upsertBlock)(state, "checkpoint:failed:".concat(event.reason), "system", event.incomplete
                ? "checkpoint incomplete (".concat(event.reason, "): ").concat(event.message)
                : "checkpoint failed (".concat(event.reason, "): ").concat(event.message), "failed");
            return true;
        case "checkpoint.unavailable":
            (0, state_1.upsertBlock)(state, "checkpoint:unavailable", "system", "checkpoints unavailable (".concat(event.reason, "): ").concat(event.suggestion), event.disabledByConfig ? "disabled" : "unavailable");
            return true;
        case "rollback.previewed":
            state.rollback = {
                checkpointID: event.preview.checkpointID,
                state: "previewed",
            };
            return true;
        case "rollback.begin":
            state.rollback = {
                checkpointID: event.checkpointID,
                safetyCheckpointID: event.safetyCheckpointID,
                state: "running",
                dryRun: event.dryRun,
            };
            return true;
        case "rollback.end":
            state.rollback = {
                checkpointID: event.checkpointID,
                safetyCheckpointID: event.safetyCheckpointID,
                state: "completed",
                restoredFiles: event.restoredFiles,
                deletedFiles: event.deletedFiles,
            };
            return true;
        case "rollback.failed":
            state.rollback = {
                checkpointID: event.checkpointID,
                safetyCheckpointID: event.safetyCheckpointID,
                state: "failed",
                message: event.message,
                recovered: event.recovered,
            };
            return true;
        case "snapshot.created":
            (0, state_1.upsertBlock)(state, "snapshot:".concat(event.id), "system", "snapshot ".concat(event.id, ": ").concat(event.files.join(", ")), "created");
            return true;
        case "mcp.status":
            state.mcp = __assign(__assign({}, state.mcp), (_h = {}, _h[event.server] = event, _h));
            return true;
        case "plugin.update":
            state.plugins = __assign(__assign({}, state.plugins), (_j = {}, _j[event.id] = event, _j));
            return true;
        case "projections.updated":
            state.pluginProjections = event.contributions.map(function (entry) { return (__assign({}, entry)); });
            return true;
        case "capability.loaded":
            state.capabilities = __assign(__assign({}, state.capabilities), (_k = {}, _k[event.id] = event, _k));
            return true;
        case "capability.unloaded": {
            var _q = state.capabilities, _r = event.id, _removed = _q[_r], rest = __rest(_q, [typeof _r === "symbol" ? _r : _r + ""]);
            state.capabilities = rest;
            return true;
        }
        case "workgraph.node_added":
            state.workGraphNodes = __assign(__assign({}, state.workGraphNodes), (_l = {}, _l[event.nodeID] = event, _l));
            return true;
        case "workgraph.edge_added":
            state.workGraphEdges = __assign(__assign({}, state.workGraphEdges), (_m = {}, _m[event.id] = event, _m));
            return true;
        default:
            return false;
    }
}
