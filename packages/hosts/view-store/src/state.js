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
exports.transcriptWatermark = exports.transcriptLimit = exports.terminalTranscriptChars = exports.constitutionOverrideLimit = exports.constitutionConflictLimit = exports.driftFindingLimit = exports.decisionLimit = exports.completionLimit = exports.invariantFindingLimit = exports.evidenceLimit = exports.checkpointLimit = exports.policyDecisionLimit = exports.subagentHistoryLimit = exports.terminalTimelineLimit = exports.streamSegmentChars = void 0;
exports.subagentHistoryRowKey = subagentHistoryRowKey;
exports.emptySessionUsageStats = emptySessionUsageStats;
exports.initialState = initialState;
exports.cloneState = cloneState;
exports.synchronizeStreamSlices = synchronizeStreamSlices;
exports.displayText = displayText;
exports.upsertBlock = upsertBlock;
exports.appendBounded = appendBounded;
exports.boundTranscript = boundTranscript;
/**
 * Character budget for forced segmentation. Semantic boundaries (tools,
 * thinking phases, durable content.done) still split; a long contiguous answer
 * no longer splits just because it crossed an arbitrary character count.
 */
exports.streamSegmentChars = Number.POSITIVE_INFINITY;
/**
 * Bounds on the histories a long session accumulates. A projection that grows
 * without limit is a leak in every consumer that holds it.
 */
exports.terminalTimelineLimit = 200;
exports.subagentHistoryLimit = 100;
exports.policyDecisionLimit = 200;
exports.checkpointLimit = 200;
exports.evidenceLimit = 200;
/** Open invariant findings are edge-lifecycle objects; bounded like evidence. */
exports.invariantFindingLimit = 200;
exports.completionLimit = 100;
exports.decisionLimit = 200;
exports.driftFindingLimit = 200;
exports.constitutionConflictLimit = 50;
exports.constitutionOverrideLimit = 100;
/**
 * A terminal's transcript grows for as long as the pane lives, so the projection
 * keeps a bounded tail with an explicit note about what was dropped. Storing the
 * event as-is would grow without limit for the whole session.
 */
exports.terminalTranscriptChars = 12000;
/**
 * Stable identity for one subagent history row. `subagent.update.id` is the
 * subagent id, not a unique event id, so using it directly collapses a whole
 * history into one row. This key keeps every status/log event distinct while
 * staying stable across replayed pages.
 */
function subagentHistoryRowKey(event) {
    var _a, _b, _c, _d, _e, _f, _g;
    return JSON.stringify([
        event.id,
        event.event,
        event.status,
        (_a = event.phase) !== null && _a !== void 0 ? _a : "",
        (_b = event.continuation) !== null && _b !== void 0 ? _b : "",
        (_d = (_c = event.lastActivityAt) !== null && _c !== void 0 ? _c : event.startedAt) !== null && _d !== void 0 ? _d : "",
        (_e = event.activityDetail) !== null && _e !== void 0 ? _e : "",
        (_f = event.text) !== null && _f !== void 0 ? _f : "",
        (_g = event.task) !== null && _g !== void 0 ? _g : "",
    ]);
}
function emptySessionUsageStats() {
    return {
        steps: 0,
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        llmMs: 0,
        toolMs: 0,
        ttftMs: 0,
        ttftSteps: 0,
        decodeMs: 0,
    };
}
function initialState() {
    var messages = [];
    var streams = {};
    var streamPhases = {};
    var tools = {};
    var pendingApprovals = [];
    var pendingQuestions = [];
    var pendingInputs = [];
    var pendingInteractives = [];
    var activities = {};
    var subagents = {};
    var subagentHistory = {};
    var subagentStates = {};
    return {
        workspaces: [],
        sessions: [],
        title: "New session",
        status: "booting",
        footer: "Ready",
        statusSegments: [
            "mode:runtime",
            "model:not-connected",
            "provider:not-connected",
        ],
        messages: messages,
        paused: false,
        streams: streams,
        streamPhases: streamPhases,
        tools: tools,
        pendingApprovals: pendingApprovals,
        pendingQuestions: pendingQuestions,
        pendingInputs: pendingInputs,
        pendingInteractives: pendingInteractives,
        activities: activities,
        natalia: {
            messages: messages,
            streams: streams,
            streamPhases: streamPhases,
            tools: tools,
            pendingApprovals: pendingApprovals,
            pendingQuestions: pendingQuestions,
            activities: activities,
            paused: false,
        },
        navi: { messages: [], streams: {}, streamPhases: {} },
        nia: { messages: [], streams: {}, streamPhases: {} },
        terminals: {},
        terminalTimeline: {},
        terminalApprovals: {},
        sandboxes: {},
        sandboxDiffs: {},
        subagents: subagents,
        subagentHistory: subagentHistory,
        subagentStates: subagentStates,
        subagentStream: {
            active: subagents,
            history: subagentHistory,
            states: subagentStates,
        },
        mcp: {},
        plugins: {},
        capabilities: {},
        checkpoints: [],
        policyDecisions: [],
        workGraphNodes: {},
        workGraphEdges: {},
        pluginProjections: [],
        constitutionRules: {},
        constitutionOverrides: [],
        constitutionConflicts: [],
        decisions: [],
        evidence: [],
        invariantFindings: [],
        completions: [],
        driftFindings: [],
        mailbox: {},
        plans: {},
        runtimeNotices: [],
        sessionUsage: emptySessionUsageStats(),
        usageByChannel: {
            main: emptySessionUsageStats(),
            navi: emptySessionUsageStats(),
            nia: emptySessionUsageStats(),
        },
        workContracts: {},
    };
}
/**
 * Copies enough of the state that `applyEvent` cannot mutate the previous one.
 * Explicit rather than `structuredClone` because cloning a reactive proxy is
 * what broke the first attempt at this layer.
 */
function cloneState(state) {
    return __assign(__assign(__assign(__assign({}, state), { workspaces: state.workspaces.map(function (entry) { return (__assign({}, entry)); }), sessions: state.sessions.map(function (entry) { return (__assign({}, entry)); }), statusSegments: __spreadArray([], state.statusSegments, true), messages: state.messages.map(function (block) { return (__assign(__assign({}, block), (block.tool ? { tool: __assign({}, block.tool) } : {}))); }), streams: mapRecord(state.streams, function (value) { return (__assign({}, value)); }), streamPhases: __assign({}, state.streamPhases), tools: mapRecord(state.tools, function (value) { return (__assign({}, value)); }), pendingApprovals: __spreadArray([], state.pendingApprovals, true), pendingQuestions: __spreadArray([], state.pendingQuestions, true), pendingInputs: state.pendingInputs.map(function (input) { return (__assign({}, input)); }), pendingInteractives: state.pendingInteractives.map(function (input) { return (__assign({}, input)); }), activities: mapRecord(state.activities, function (value) { return (__assign({}, value)); }), natalia: cloneNataliaStream(state.natalia), navi: cloneAgentStream(state.navi), nia: cloneAgentStream(state.nia), terminals: __assign({}, state.terminals), terminalTimeline: mapRecord(state.terminalTimeline, function (value) { return __spreadArray([], value, true); }), terminalApprovals: __assign({}, state.terminalApprovals), sandboxes: __assign({}, state.sandboxes), sandboxDiffs: __assign({}, state.sandboxDiffs), subagents: __assign({}, state.subagents), subagentHistory: mapRecord(state.subagentHistory, function (value) { return __spreadArray([], value, true); }), subagentStates: mapRecord(state.subagentStates, function (value) {
            return cloneState(value);
        }), subagentStream: {
            active: __assign({}, state.subagentStream.active),
            history: mapRecord(state.subagentStream.history, function (value) { return __spreadArray([], value, true); }),
            states: mapRecord(state.subagentStream.states, function (value) {
                return cloneState(value);
            }),
        }, mcp: __assign({}, state.mcp), plugins: __assign({}, state.plugins), capabilities: __assign({}, state.capabilities), checkpoints: __spreadArray([], state.checkpoints, true), policyDecisions: __spreadArray([], state.policyDecisions, true), workGraphNodes: __assign({}, state.workGraphNodes), workGraphEdges: __assign({}, state.workGraphEdges), pluginProjections: __spreadArray([], state.pluginProjections, true), constitutionRules: __assign({}, state.constitutionRules), constitutionOverrides: __spreadArray([], state.constitutionOverrides, true), constitutionConflicts: __spreadArray([], state.constitutionConflicts, true), decisions: __spreadArray([], state.decisions, true), evidence: __spreadArray([], state.evidence, true), invariantFindings: __spreadArray([], state.invariantFindings, true), completions: __spreadArray([], state.completions, true), driftFindings: state.driftFindings.map(function (finding) { return (__assign(__assign({}, finding), (finding.ruleHits
            ? { ruleHits: finding.ruleHits.map(function (hit) { return (__assign({}, hit)); }) }
            : {}))); }), mailbox: mapRecord(state.mailbox, function (value) { return (__assign({}, value)); }), plans: mapRecord(state.plans, function (value) { return (__assign({}, value)); }), runtimeNotices: state.runtimeNotices.map(function (notice) { return (__assign({}, notice)); }), sessionUsage: __assign({}, state.sessionUsage), usageByChannel: {
            main: __assign({}, state.usageByChannel.main),
            navi: __assign({}, state.usageByChannel.navi),
            nia: __assign({}, state.usageByChannel.nia),
        }, workContracts: mapRecord(state.workContracts, function (value) { return (__assign({}, value)); }) }), (state.goal
        ? {
            goal: __assign(__assign(__assign({}, state.goal), (state.goal.blockedReason
                ? { blockedReason: __assign({}, state.goal.blockedReason) }
                : {})), (state.goal.lastStop
                ? { lastStop: __assign({}, state.goal.lastStop) }
                : {})),
        }
        : {})), (state.rollback ? { rollback: __assign({}, state.rollback) } : {}));
}
function cloneNataliaStream(state) {
    return __assign(__assign({}, cloneAgentStream(state)), { paused: state.paused, tools: mapRecord(state.tools, function (value) { return (__assign({}, value)); }), pendingApprovals: __spreadArray([], state.pendingApprovals, true), pendingQuestions: __spreadArray([], state.pendingQuestions, true), activities: mapRecord(state.activities, function (value) { return (__assign({}, value)); }) });
}
/** Keeps legacy projector internals and the public stream slices coherent. */
function synchronizeStreamSlices(state) {
    Object.assign(state.natalia, {
        messages: state.messages,
        streams: state.streams,
        streamPhases: state.streamPhases,
        activeTurn: state.activeTurn,
        paused: state.paused,
        tools: state.tools,
        pendingApprovals: state.pendingApprovals,
        pendingQuestions: state.pendingQuestions,
        activities: state.activities,
        context: state.context,
    });
    Object.assign(state.subagentStream, {
        active: state.subagents,
        history: state.subagentHistory,
        states: state.subagentStates,
    });
}
function cloneAgentStream(state) {
    return __assign(__assign(__assign(__assign({}, state), { messages: state.messages.map(function (block) { return (__assign(__assign({}, block), (block.tool ? { tool: __assign({}, block.tool) } : {}))); }), streams: mapRecord(state.streams, function (value) { return (__assign({}, value)); }), streamPhases: __assign({}, state.streamPhases) }), (state.activity ? { activity: __assign({}, state.activity) } : {})), (state.hydrationBaseline
        ? {
            hydrationBaseline: state.hydrationBaseline.map(function (block) { return (__assign({}, block)); }),
        }
        : {}));
}
/** What a UI should display for a block: confirmed text plus streaming tail. */
function displayText(block) {
    return block.text + block.pendingText;
}
function upsertBlock(state, id, role, text, status, extra) {
    var block = state.messages.find(function (item) { return item.id === id; });
    if (block) {
        block.text = text;
        if (status !== undefined)
            block.status = status;
        if (extra)
            Object.assign(block, extra);
        return;
    }
    state.messages.push(__assign({ id: id, role: role, text: text, pendingText: "", status: status }, extra));
}
/** Appends to a bounded history, dropping the oldest entries past the cap. */
function appendBounded(list, entry, limit) {
    var next = __spreadArray(__spreadArray([], list, true), [entry], false);
    return next.length > limit ? next.slice(next.length - limit) : next;
}
function mapRecord(record, map) {
    var next = {};
    for (var key in record)
        next[key] = map(record[key]);
    return next;
}
/**
 * Transcript eviction.
 *
 * `messages` is deliberately unbounded: a transcript is the record, and silently
 * dropping conversation is a policy decision that belongs to the consumer, not to
 * a shared projection. A long-lived UI does need to evict, so the rule that makes
 * eviction safe lives here rather than being re-derived by every consumer:
 * **evict whole user turns only**. Dropping a partial turn leaves an assistant
 * reply with no prompt above it, which reads as the assistant answering nothing.
 *
 * Durable history stays reloadable by cursor, so eviction loses nothing permanent.
 */
exports.transcriptLimit = 300;
exports.transcriptWatermark = 240;
/**
 * Generic over the row type: eviction only needs to know which rows begin a user
 * turn, so a consumer with a richer block shape can use this without converting.
 */
function boundTranscript(messages, direction, limit, watermark) {
    var _a, _b, _c;
    if (limit === void 0) { limit = exports.transcriptLimit; }
    if (watermark === void 0) { watermark = exports.transcriptWatermark; }
    if (messages.length <= limit)
        return { messages: messages, evicted: false };
    var excess = messages.length - watermark;
    if (direction === "older") {
        // Trimming the oldest end: walk back to a user turn boundary.
        var start = messages.length;
        var removed = 0;
        while (start > 0) {
            start--;
            removed++;
            if (removed >= excess && ((_a = messages[start]) === null || _a === void 0 ? void 0 : _a.role) === "user")
                break;
        }
        if (start === 0 && removed === messages.length)
            // No user turn boundary exists. Fall back to ordinary bounded trimming:
            // keep the newest watermark rows instead of wiping the transcript.
            return {
                messages: messages.slice(Math.max(0, messages.length - watermark)),
                evicted: true,
            };
        return { messages: messages.slice(0, start), evicted: true };
    }
    // Keep the newest end while allowing the rendered window to breathe between
    // `watermark` and `limit` rows. Search backwards from the target removal
    // point for a user-turn boundary inside that range. Walking *forward* for
    // the next user can overshoot badly (a tool-heavy turn can leave far fewer
    // than `watermark` rendered rows), which made history appear missing.
    var minCut = Math.max(0, messages.length - limit);
    var cut = Math.min(Math.max(0, excess), messages.length);
    while (cut > minCut && ((_b = messages[cut]) === null || _b === void 0 ? void 0 : _b.role) !== "user")
        cut -= 1;
    if (cut < minCut || ((_c = messages[cut]) === null || _c === void 0 ? void 0 : _c.role) !== "user")
        return {
            messages: messages.slice(Math.max(0, messages.length - watermark)),
            evicted: true,
        };
    return { messages: messages.slice(cut), evicted: true };
}
