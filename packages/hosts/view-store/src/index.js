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
exports.deriveSessionUsageView = exports.selectWorkGraphNeighborhood = exports.selectUnattributedWorkGraphNodes = exports.selectWorkGraphByPlan = exports.buildWorkGraphNavigation = exports.buildWorkGraphFileNavigation = exports.buildWorkGraphForest = exports.applyConversationEvent = exports.applyNiaEvent = exports.applyNaviEvent = exports.applyNiaCollabEvent = exports.applyNaviCollabEvent = exports.applyNataliaCollabEvent = exports.applyWorkspaceEvent = exports.applyStatusEvent = exports.applyResourceEvent = exports.turnIDForTool = exports.toolStateID = exports.streamID = exports.segmentID = exports.newStream = exports.flushStream = exports.selectPrimaryActivity = exports.selectActiveActivities = exports.applyActivityEvent = exports.upsertBlock = exports.transcriptWatermark = exports.transcriptLimit = exports.terminalTranscriptChars = exports.terminalTimelineLimit = exports.subagentHistoryLimit = exports.streamSegmentChars = exports.policyDecisionLimit = exports.initialState = exports.emptySessionUsageStats = exports.displayText = exports.cloneState = exports.checkpointLimit = exports.boundTranscript = exports.appendBounded = void 0;
exports.applyEvent = applyEvent;
exports.reduceState = reduceState;
exports.projectEvents = projectEvents;
exports.hydrateProjectedMessages = hydrateProjectedMessages;
exports.hydrateNaviMessages = hydrateNaviMessages;
exports.hydrateNiaMessages = hydrateNiaMessages;
exports.hydrateRuntimeNotices = hydrateRuntimeNotices;
exports.beginNaviHydration = beginNaviHydration;
exports.beginNiaHydration = beginNiaHydration;
exports.hydrateSubagents = hydrateSubagents;
exports.hydrateSubagentHistory = hydrateSubagentHistory;
/**
 * `@natalia/view-store` — the pure TypeScript projection of a `RuntimeEvent`
 * stream into displayable state.
 *
 * This is the layer an externally built UI consumes so it does not have to
 * reimplement the runtime's event semantics. It is framework-free: no Solid, no
 * OpenTUI, no DOM. `applyEvent` mutates a plain object and `reduceState` returns
 * a new one by explicit copy rather than `structuredClone`, because cloning a
 * reactive proxy is what broke the first attempt at this layer.
 *
 * What this layer must never do:
 *   - execute tools
 *   - own session persistence
 *   - decide policy or approval
 *   - hold credentials
 *   - invent UI-only durable truth
 *
 * The last rule is why dialog stacks, pane focus, scroll anchors and keybindings
 * are absent: those belong to a specific UI. `pendingApprovals` and
 * `terminalApprovals` are present because they are runtime facts — this layer
 * reports them; the runtime decides them.
 *
 * Projections live in three modules so adding a surface is a local edit:
 * `conversation.ts` (turns, streaming, tools, interactive),
 * `resources.ts` (terminals, sandboxes, subagents, checkpoints, rollback, MCP,
 * plugins, capabilities) and `status.ts` (context, compaction, retries,
 * selections, policy, intelligence).
 *
 * Deliberately **not** projected, and why:
 *   - `dialog.open` / `dialog.close`, `terminal.pane.select` — UI-only state,
 *     owned by whichever UI renders it.
 *   - `drift.finding_opened` stays a session query until a second UI needs the
 *     live list in `facts`; constitution/decision/evidence/plan/mailbox/workgraph
 *     now have production writers and project here for any host.
 */
var state_1 = require("./state");
var activity_1 = require("./activity");
var conversation_1 = require("./conversation");
var resources_1 = require("./resources");
var status_1 = require("./status");
var workspace_1 = require("./workspace");
var state_2 = require("./state");
var state_3 = require("./state");
Object.defineProperty(exports, "appendBounded", { enumerable: true, get: function () { return state_3.appendBounded; } });
Object.defineProperty(exports, "boundTranscript", { enumerable: true, get: function () { return state_3.boundTranscript; } });
Object.defineProperty(exports, "checkpointLimit", { enumerable: true, get: function () { return state_3.checkpointLimit; } });
Object.defineProperty(exports, "cloneState", { enumerable: true, get: function () { return state_3.cloneState; } });
Object.defineProperty(exports, "displayText", { enumerable: true, get: function () { return state_3.displayText; } });
Object.defineProperty(exports, "emptySessionUsageStats", { enumerable: true, get: function () { return state_3.emptySessionUsageStats; } });
Object.defineProperty(exports, "initialState", { enumerable: true, get: function () { return state_3.initialState; } });
Object.defineProperty(exports, "policyDecisionLimit", { enumerable: true, get: function () { return state_3.policyDecisionLimit; } });
Object.defineProperty(exports, "streamSegmentChars", { enumerable: true, get: function () { return state_3.streamSegmentChars; } });
Object.defineProperty(exports, "subagentHistoryLimit", { enumerable: true, get: function () { return state_3.subagentHistoryLimit; } });
Object.defineProperty(exports, "terminalTimelineLimit", { enumerable: true, get: function () { return state_3.terminalTimelineLimit; } });
Object.defineProperty(exports, "terminalTranscriptChars", { enumerable: true, get: function () { return state_3.terminalTranscriptChars; } });
Object.defineProperty(exports, "transcriptLimit", { enumerable: true, get: function () { return state_3.transcriptLimit; } });
Object.defineProperty(exports, "transcriptWatermark", { enumerable: true, get: function () { return state_3.transcriptWatermark; } });
Object.defineProperty(exports, "upsertBlock", { enumerable: true, get: function () { return state_3.upsertBlock; } });
var activity_2 = require("./activity");
Object.defineProperty(exports, "applyActivityEvent", { enumerable: true, get: function () { return activity_2.applyActivityEvent; } });
Object.defineProperty(exports, "selectActiveActivities", { enumerable: true, get: function () { return activity_2.selectActiveActivities; } });
Object.defineProperty(exports, "selectPrimaryActivity", { enumerable: true, get: function () { return activity_2.selectPrimaryActivity; } });
var conversation_2 = require("./conversation");
Object.defineProperty(exports, "flushStream", { enumerable: true, get: function () { return conversation_2.flushStream; } });
Object.defineProperty(exports, "newStream", { enumerable: true, get: function () { return conversation_2.newStream; } });
Object.defineProperty(exports, "segmentID", { enumerable: true, get: function () { return conversation_2.segmentID; } });
Object.defineProperty(exports, "streamID", { enumerable: true, get: function () { return conversation_2.streamID; } });
Object.defineProperty(exports, "toolStateID", { enumerable: true, get: function () { return conversation_2.toolStateID; } });
Object.defineProperty(exports, "turnIDForTool", { enumerable: true, get: function () { return conversation_2.turnIDForTool; } });
/**
 * The projection composed in pieces, for a consumer migrating onto this layer one
 * concern at a time. A UI that still owns its own transcript can take the resource
 * facts from here without also taking the conversation model.
 */
var resources_2 = require("./resources");
Object.defineProperty(exports, "applyResourceEvent", { enumerable: true, get: function () { return resources_2.applyResourceEvent; } });
var status_2 = require("./status");
Object.defineProperty(exports, "applyStatusEvent", { enumerable: true, get: function () { return status_2.applyStatusEvent; } });
var workspace_2 = require("./workspace");
Object.defineProperty(exports, "applyWorkspaceEvent", { enumerable: true, get: function () { return workspace_2.applyWorkspaceEvent; } });
var conversation_3 = require("./conversation");
Object.defineProperty(exports, "applyNataliaCollabEvent", { enumerable: true, get: function () { return conversation_3.applyNataliaCollabEvent; } });
Object.defineProperty(exports, "applyNaviCollabEvent", { enumerable: true, get: function () { return conversation_3.applyNaviCollabEvent; } });
Object.defineProperty(exports, "applyNiaCollabEvent", { enumerable: true, get: function () { return conversation_3.applyNiaCollabEvent; } });
Object.defineProperty(exports, "applyNaviEvent", { enumerable: true, get: function () { return conversation_3.applyNaviEvent; } });
Object.defineProperty(exports, "applyNiaEvent", { enumerable: true, get: function () { return conversation_3.applyNiaEvent; } });
Object.defineProperty(exports, "applyConversationEvent", { enumerable: true, get: function () { return conversation_3.applyConversationEvent; } });
var graph_1 = require("./graph");
Object.defineProperty(exports, "buildWorkGraphForest", { enumerable: true, get: function () { return graph_1.buildWorkGraphForest; } });
Object.defineProperty(exports, "buildWorkGraphFileNavigation", { enumerable: true, get: function () { return graph_1.buildWorkGraphFileNavigation; } });
Object.defineProperty(exports, "buildWorkGraphNavigation", { enumerable: true, get: function () { return graph_1.buildWorkGraphNavigation; } });
Object.defineProperty(exports, "selectWorkGraphByPlan", { enumerable: true, get: function () { return graph_1.selectWorkGraphByPlan; } });
Object.defineProperty(exports, "selectUnattributedWorkGraphNodes", { enumerable: true, get: function () { return graph_1.selectUnattributedWorkGraphNodes; } });
Object.defineProperty(exports, "selectWorkGraphNeighborhood", { enumerable: true, get: function () { return graph_1.selectWorkGraphNeighborhood; } });
Object.defineProperty(exports, "deriveSessionUsageView", { enumerable: true, get: function () { return graph_1.deriveSessionUsageView; } });
/**
 * Mutates `state` in place. Unknown and deliberately unprojected events are
 * ignored rather than fatal, so a consumer built against an older contract keeps
 * working when the runtime adds an event.
 */
function applyEvent(state, event) {
    var _a;
    var _b;
    if (event.agentID) {
        // Events belonging to a subagent are projected into that subagent's own
        // isolated state, so the main Natalia/Navi transcript and the subagent
        // stream do not mix.
        var agentID = event.agentID;
        var child = ((_a = (_b = state.subagentStates)[agentID]) !== null && _a !== void 0 ? _a : (_b[agentID] = (0, state_2.initialState)()));
        applyEvent(child, __assign(__assign({}, event), { agentID: undefined }));
        (0, state_2.synchronizeStreamSlices)(state);
        return;
    }
    if ((0, workspace_1.applyWorkspaceEvent)(state, event))
        return;
    if ((0, conversation_1.applyConversationEvent)(state, event)) {
        (0, activity_1.applyActivityEvent)(state, event);
        (0, state_2.synchronizeStreamSlices)(state);
        return;
    }
    if ((0, conversation_1.applyNataliaCollabEvent)(state, event) ||
        (0, conversation_1.applyNaviCollabEvent)(state, event) ||
        (0, conversation_1.applyNiaCollabEvent)(state, event) ||
        (0, conversation_1.applyNaviEvent)(state, event) ||
        (0, conversation_1.applyNiaEvent)(state, event)) {
        (0, activity_1.applyActivityEvent)(state, event);
        (0, state_2.synchronizeStreamSlices)(state);
        return;
    }
    if ((0, resources_1.applyResourceEvent)(state, event)) {
        if (event.type === "rollback.end")
            truncateHistoryAfterRollback(state, event);
        (0, activity_1.applyActivityEvent)(state, event);
        (0, state_2.synchronizeStreamSlices)(state);
        return;
    }
    (0, status_1.applyStatusEvent)(state, event);
    (0, activity_1.applyActivityEvent)(state, event);
    (0, state_2.synchronizeStreamSlices)(state);
}
/**
 * A Main Agent checkpoint rollback is a return to a prior execution point.
 * Keep the rollback-fact resource projection intact, but also drop the visible
 * transcript rows for turns after that checkpoint so the UI does not show
 * work the runtime has undone.
 */
function truncateHistoryAfterRollback(state, event) {
    var checkpoint = state.checkpoints.find(function (candidate) { return candidate.id === event.checkpointID; });
    var turnID = checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.turnID;
    if (!turnID)
        return;
    var prefix = "".concat(turnID, ":");
    var index = state.messages.findIndex(function (block) {
        return block.id.startsWith(prefix);
    });
    if (index === -1)
        return;
    state.messages.splice(index);
    for (var _i = 0, _a = Object.keys(state.streams); _i < _a.length; _i++) {
        var key = _a[_i];
        if (!key.startsWith(prefix))
            delete state.streams[key];
    }
    for (var _b = 0, _c = Object.keys(state.streamPhases); _b < _c.length; _b++) {
        var key = _c[_b];
        if (!key.startsWith(prefix))
            delete state.streamPhases[key];
    }
    for (var _d = 0, _e = Object.keys(state.tools); _d < _e.length; _d++) {
        var key = _e[_d];
        if (!key.startsWith(prefix))
            delete state.tools[key];
    }
}
/**
 * Folds one event into a new state. The copy is explicit rather than
 * `structuredClone` so this stays safe when a caller keeps the previous state
 * behind a reactive proxy.
 */
function reduceState(state, event) {
    var next = (0, state_2.cloneState)(state);
    applyEvent(next, event);
    return next;
}
/** Folds a whole stream, which is how an external UI replays history. */
function projectEvents(events, from) {
    if (from === void 0) { from = (0, state_2.initialState)(); }
    var state = (0, state_2.cloneState)(from);
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        applyEvent(state, event_1);
    }
    return state;
}
/**
 * Rows that carry live/streaming state and must survive a durable hydration
 * merge: an in-flight answer, a thinking block, a tool card, or a
 * collaboration row. Completed rows can be replaced by the hydrated version.
 */
function isLiveHydrationRow(message) {
    return (message.pendingText.length > 0 ||
        message.role === "thinking" ||
        message.tool !== undefined ||
        message.status === "running" ||
        message.id.endsWith(":collab"));
}
/**
 * Hydrates UI transcript rows from server-projected messages. Used by UIs that
 * adopt message-page loading instead of replaying every raw session event.
 * Merges by message id so a live projection can keep its own streaming rows.
 */
/** The transcript row id is the render key; duplicates are never valid. */
function dedupeMessagesByID(messages) {
    var seen = new Set();
    var out = [];
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        if (seen.has(message.id))
            continue;
        seen.add(message.id);
        out.push(message);
    }
    return out;
}
function hydrateProjectedMessages(state, messages, direction, options) {
    if (direction === void 0) { direction = "older"; }
    if (options === void 0) { options = {}; }
    // Project every row in the page. The merge below deduplicates by row id, so
    // a turn that is already partly present still contributes its missing rows
    // (for example an answer row lost to a reconnect) instead of being skipped
    // wholesale because its user row survived.
    var projected = (0, state_2.initialState)();
    for (var _i = 0, messages_2 = messages; _i < messages_2.length; _i++) {
        var message = messages_2[_i];
        for (var _a = 0, _b = message.rows; _a < _b.length; _a++) {
            var row = _b[_a];
            applyEvent(projected, row.event);
        }
    }
    if (options.replace) {
        // An empty page must never wipe a transcript that was already projected
        // from replay or live events. A later non-empty page will replace it.
        if (messages.length === 0) {
            (0, state_2.synchronizeStreamSlices)(state);
            return false;
        }
        var incoming_1 = projected.messages.map(function (message) { return (__assign({}, message)); });
        var incomingIDs_1 = new Set(incoming_1.map(function (message) { return message.id; }));
        var liveRows = state.messages.filter(function (message) { return !incomingIDs_1.has(message.id) && isLiveHydrationRow(message); });
        // Hydration owns a contiguous event window. Do not destructively trim it
        // here: an earlier version capped `state.messages` with `boundTranscript`,
        // which made rows dropped inside the already-loaded page unreachable
        // because the server cursor only pages by turn.
        state.messages = dedupeMessagesByID(__spreadArray(__spreadArray([], incoming_1, true), liveRows, true));
        var liveStreams = Object.fromEntries(Object.entries(state.streams).filter(function (_a) {
            var id = _a[0];
            return !(id in projected.streams);
        }));
        var livePhases = Object.fromEntries(Object.entries(state.streamPhases).filter(function (_a) {
            var id = _a[0];
            return !(id in projected.streamPhases);
        }));
        var liveTools = Object.fromEntries(Object.entries(state.tools).filter(function (_a) {
            var id = _a[0];
            return !(id in projected.tools);
        }));
        state.streams = __assign(__assign({}, projected.streams), liveStreams);
        state.streamPhases = __assign(__assign({}, projected.streamPhases), livePhases);
        state.tools = __assign(__assign({}, projected.tools), liveTools);
        (0, state_2.synchronizeStreamSlices)(state);
        return false;
    }
    // Merge by row id. A missing row (for example an answer row that a
    // reconnect dropped) is contributed by the page, while an existing row is
    // only replaced when the page carries strictly more text, so a stale page
    // cannot roll a newer live row back.
    var stateByID = new Map(state.messages.map(function (message) { return [message.id, message]; }));
    var incoming = projected.messages.map(function (message) {
        var existing = stateByID.get(message.id);
        if (!existing)
            return __assign({}, message);
        var existingText = existing.text + existing.pendingText;
        var incomingText = message.text + message.pendingText;
        return existingText.length >= incomingText.length
            ? __assign({}, existing) : __assign({}, message);
    });
    if (!incoming.length)
        return false;
    var incomingIDs = new Set(incoming.map(function (message) { return message.id; }));
    var retained = state.messages.filter(function (message) { return !incomingIDs.has(message.id); });
    var merged = direction === "older"
        ? __spreadArray(__spreadArray([], incoming, true), retained, true) : __spreadArray(__spreadArray([], retained, true), incoming, true);
    state.messages = dedupeMessagesByID(merged);
    // Keep stream/tool state for hydrated turns when the live project has not
    // seen them yet.
    for (var _c = 0, _d = Object.keys(projected.streams); _c < _d.length; _c++) {
        var id = _d[_c];
        if (!(id in state.streams))
            state.streams[id] = projected.streams[id];
    }
    for (var _e = 0, _f = Object.keys(projected.streamPhases); _e < _f.length; _e++) {
        var id = _f[_e];
        if (!(id in state.streamPhases))
            state.streamPhases[id] = projected.streamPhases[id];
    }
    for (var _g = 0, _h = Object.keys(projected.tools); _g < _h.length; _g++) {
        var id = _h[_g];
        if (!(id in state.tools))
            state.tools[id] = projected.tools[id];
    }
    // Preserve interactive requests projected from the hydrated turns so a
    // message-first startup still surfaces pending approvals/questions.
    var approvalIDs = new Set(state.pendingApprovals.map(function (approval) { return approval.id; }));
    for (var _j = 0, _k = projected.pendingApprovals; _j < _k.length; _j++) {
        var approval = _k[_j];
        if (!approvalIDs.has(approval.id))
            state.pendingApprovals.push(approval);
    }
    var questionIDs = new Set(state.pendingQuestions.map(function (question) { return question.id; }));
    for (var _l = 0, _m = projected.pendingQuestions; _l < _m.length; _l++) {
        var question = _m[_l];
        if (!questionIDs.has(question.id))
            state.pendingQuestions.push(question);
    }
    if (!state.sessionID && projected.sessionID)
        state.sessionID = projected.sessionID;
    if (!state.title && projected.title)
        state.title = projected.title;
    (0, state_2.synchronizeStreamSlices)(state);
    return false;
}
/**
 * Hydrates the Live Work Chat rows from the durable chat projection. This is
 * the chat counterpart of `hydrateProjectedMessages`: it lets the UI reuse the
 * same lazy-loading path instead of replaying every raw chat event.
 */
function chatRowToBlock(row) {
    var _a, _b;
    if (row.kind === "thinking") {
        return {
            id: "chat:".concat(row.messageID, ":thinking"),
            role: "thinking",
            text: row.text,
            pendingText: "",
            reasoningVisible: true,
        };
    }
    if (row.kind === "tool" && row.tool) {
        var toolID = (_a = row.tool.eventID) !== null && _a !== void 0 ? _a : "".concat(row.tool.name, ":").concat(row.tool.status, ":").concat(row.messageID);
        return {
            id: "chat:".concat(toolID, ":tool"),
            role: "tool",
            text: row.tool.summary,
            pendingText: "",
            status: row.tool.status,
            tool: __assign(__assign(__assign(__assign({ name: row.tool.name, status: row.tool.status, summary: row.tool.summary }, (row.tool.result !== undefined ? { result: row.tool.result } : {})), { argumentsRaw: (_b = row.tool.argumentsRaw) !== null && _b !== void 0 ? _b : "" }), (row.tool.startedAt !== undefined
                ? { startedAt: row.tool.startedAt }
                : {})), (row.tool.endedAt !== undefined
                ? { endedAt: row.tool.endedAt }
                : {})),
        };
    }
    if (row.role === "system") {
        return {
            id: "chat:".concat(row.messageID, ":").concat(row.kind === "collab" ? "collab" : "system"),
            role: "system",
            text: row.text,
            pendingText: "",
        };
    }
    var internal = row.role === "user" && row.text.startsWith("(internal");
    return __assign({ id: internal
            ? "chat:".concat(row.messageID, ":system")
            : row.role === "user"
                ? "chat:".concat(row.messageID, ":user")
                : "chat:".concat(row.messageID, ":assistant"), role: internal
            ? "system"
            : row.role === "user"
                ? "user"
                : "assistant", text: row.text, pendingText: "" }, (row.attachments ? { attachments: row.attachments } : {}));
}
function hydrateNaviMessages(state, rows, options) {
    return applyAgentMessagePage(state.navi, rows, options);
}
function hydrateNiaMessages(state, rows, options) {
    return applyAgentMessagePage(state.nia, rows, options);
}
/**
 * Dual ingestion for the runtime notices (ADR Phase C): the server-projected
 * `notices` contract merges into the same `runtimeNotices` view the live
 * `context.instructions` event stream feeds, so a replayed session and a live
 * session converge. Later revisions supersede earlier same-kind notices; a
 * lower-revision projection result never clobbers a newer live event.
 */
function hydrateRuntimeNotices(state, notices) {
    var changed = false;
    var _loop_1 = function (notice) {
        var existing = state.runtimeNotices.find(function (candidate) { return candidate.kind === notice.kind; });
        if (existing && existing.revision >= notice.revision)
            return "continue";
        if (existing)
            state.runtimeNotices = state.runtimeNotices.filter(function (candidate) { return candidate.kind !== notice.kind; });
        state.runtimeNotices = __spreadArray(__spreadArray([], state.runtimeNotices, true), [__assign({}, notice)], false).sort(function (left, right) { return left.at.localeCompare(right.at); });
        changed = true;
    };
    for (var _i = 0, notices_1 = notices; _i < notices_1.length; _i++) {
        var notice = notices_1[_i];
        _loop_1(notice);
    }
    return changed;
}
function applyAgentMessagePage(target, rows, options) {
    var _a, _b;
    var replace = (_a = options === null || options === void 0 ? void 0 : options.replace) !== null && _a !== void 0 ? _a : (options === null || options === void 0 ? void 0 : options.direction) === undefined;
    return replace
        ? replaceAgentMessages(target, rows)
        : mergeAgentMessages(target, rows, (_b = options === null || options === void 0 ? void 0 : options.direction) !== null && _b !== void 0 ? _b : "newer");
}
/**
 * Merge one page of durable Chat rows into an already-paged stream. Existing
 * rows win over duplicates so a stale page can never roll back a live row or a
 * newer page.
 */
function mergeAgentMessages(target, rows, direction) {
    var incoming = rows.map(chatRowToBlock);
    var existing = new Set(target.messages.map(function (row) { return row.id; }));
    var additions = incoming.filter(function (row) { return !existing.has(row.id); });
    if (!additions.length)
        return false;
    target.messages = dedupeMessagesByID(direction === "older"
        ? __spreadArray(__spreadArray([], additions, true), target.messages, true) : __spreadArray(__spreadArray([], target.messages, true), additions, true));
    return true;
}
function replaceAgentMessages(target, rows) {
    var _a;
    var _b, _c;
    var incoming = rows.map(chatRowToBlock);
    var incomingIDs = new Set(incoming.map(function (row) { return row.id; }));
    var baseline = new Map((_c = (_b = target.hydrationBaseline) === null || _b === void 0 ? void 0 : _b.map(function (row) { return [row.id, row]; })) !== null && _c !== void 0 ? _c : []);
    // A successful snapshot is authoritative for rows unchanged since its request
    // began. Retain only post-request live changes, including same-ID deltas,
    // compaction, and rollback updates. A failed request never calls this method,
    // leaving the warm cache untouched.
    var liveChanges = target.messages.filter(function (row) {
        var before = baseline.get(row.id);
        return !before || JSON.stringify(before) !== JSON.stringify(row);
    });
    var _loop_2 = function (row) {
        var snapshot = incoming.find(function (candidate) { return candidate.id === row.id; });
        if (snapshot)
            snapshot.pendingText = row.pendingText;
    };
    for (var _i = 0, liveChanges_1 = liveChanges; _i < liveChanges_1.length; _i++) {
        var row = liveChanges_1[_i];
        _loop_2(row);
    }
    var liveOnly = target.messages.filter(function (row) {
        return !incomingIDs.has(row.id) &&
            (row.pendingText.length > 0 ||
                row.role === "thinking" ||
                row.tool !== undefined ||
                row.status === "running" ||
                row.id.endsWith(":collab"));
    });
    (_a = target.messages).splice.apply(_a, __spreadArray([0,
        target.messages.length], dedupeMessagesByID(__spreadArray(__spreadArray([], incoming, true), liveOnly, true)), false));
    delete target.hydrationBaseline;
    return true;
}
function beginNaviHydration(state) {
    state.navi.hydrationBaseline = state.navi.messages.map(function (row) { return (__assign({}, row)); });
}
function beginNiaHydration(state) {
    state.nia.hydrationBaseline = state.nia.messages.map(function (row) { return (__assign({}, row)); });
}
/**
 * Hydrates the current subagent registry into the projected subagent tree.
 * Existing live entries win over this lazy snapshot so a newer subagent.update
 * that arrived after the RPC still takes precedence.
 */
function hydrateSubagents(state, subagents) {
    if (!subagents.length)
        return false;
    var incoming = {};
    for (var _i = 0, subagents_1 = subagents; _i < subagents_1.length; _i++) {
        var subagent = subagents_1[_i];
        incoming[subagent.id] = subagent;
    }
    state.subagents = __assign(__assign({}, incoming), state.subagents);
    return true;
}
function hydrateSubagentHistory(state, history, options) {
    var _a, _b;
    var _c, _d;
    if (!history.length) {
        if ((options === null || options === void 0 ? void 0 : options.replace) && options.subagentID) {
            state.subagentHistory = __assign(__assign({}, state.subagentHistory), (_a = {}, _a[options.subagentID] = [], _a));
            return true;
        }
        return false;
    }
    var groups = new Map();
    var _loop_3 = function (event_2) {
        var key = (0, state_1.subagentHistoryRowKey)(event_2);
        var rows = (_c = groups.get(event_2.id)) !== null && _c !== void 0 ? _c : [];
        if (!rows.some(function (row) { return (0, state_1.subagentHistoryRowKey)(row) === key; }))
            rows.push(event_2);
        groups.set(event_2.id, rows);
    };
    for (var _i = 0, history_1 = history; _i < history_1.length; _i++) {
        var event_2 = history_1[_i];
        _loop_3(event_2);
    }
    var changed = false;
    for (var _e = 0, groups_1 = groups; _e < groups_1.length; _e++) {
        var _f = groups_1[_e], id = _f[0], incoming = _f[1];
        var existing = (options === null || options === void 0 ? void 0 : options.replace) ? [] : ((_d = state.subagentHistory[id]) !== null && _d !== void 0 ? _d : []);
        var ordered = (options === null || options === void 0 ? void 0 : options.direction) === "older"
            ? __spreadArray(__spreadArray([], incoming, true), existing, true) : __spreadArray(__spreadArray([], existing, true), incoming, true);
        var keyed = new Map();
        for (var _g = 0, ordered_1 = ordered; _g < ordered_1.length; _g++) {
            var row = ordered_1[_g];
            var key = (0, state_1.subagentHistoryRowKey)(row);
            if (!keyed.has(key))
                keyed.set(key, row);
        }
        state.subagentHistory = __assign(__assign({}, state.subagentHistory), (_b = {}, _b[id] = __spreadArray([], keyed.values(), true), _b));
        changed = true;
    }
    return changed;
}
