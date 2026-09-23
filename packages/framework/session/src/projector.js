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
exports.FACT_TERMINAL_LIMIT = exports.PROJECTION_STATE_VERSION = void 0;
exports.modelVisibleEvents = modelVisibleEvents;
exports.projectSession = projectSession;
exports.initProjection = initProjection;
exports.applyProjection = applyProjection;
exports.viewProjection = viewProjection;
exports.foldProjection = foldProjection;
exports.restoreProjection = restoreProjection;
exports.serializeProjectionState = serializeProjectionState;
exports.deserializeProjectionState = deserializeProjectionState;
exports.selectedModelFromEvents = selectedModelFromEvents;
exports.reasoningEffortFromEvents = reasoningEffortFromEvents;
exports.chatModelProfileFromEvents = chatModelProfileFromEvents;
exports.permissionModeFromEvents = permissionModeFromEvents;
exports.permissionProfileFromEvents = permissionProfileFromEvents;
exports.selectedAgentFromEvents = selectedAgentFromEvents;
exports.projectSessionMessages = projectSessionMessages;
exports.projectTurnMessage = projectTurnMessage;
exports.projectTurnMessages = projectTurnMessages;
exports.encodeMessageCursor = encodeMessageCursor;
exports.decodeMessageCursor = decodeMessageCursor;
exports.settleInterruptedTurns = settleInterruptedTurns;
exports.projectedGoal = projectedGoal;
exports.nextContextInstructionsRevision = nextContextInstructionsRevision;
exports.projectedRuntimeNotices = projectedRuntimeNotices;
exports.projectedConstitutionRules = projectedConstitutionRules;
exports.projectedWorkContracts = projectedWorkContracts;
exports.projectedConstitutionOverrides = projectedConstitutionOverrides;
exports.latestSessionSnapshot = latestSessionSnapshot;
exports.projectedDriftFindings = projectedDriftFindings;
exports.projectedCanonicalTools = projectedCanonicalTools;
exports.projectedCapabilities = projectedCapabilities;
exports.projectedWorkGraphNodes = projectedWorkGraphNodes;
exports.projectedWorkGraphEdges = projectedWorkGraphEdges;
exports.projectedEvidenceRecords = projectedEvidenceRecords;
exports.projectedCompletions = projectedCompletions;
exports.projectedDecisionRecords = projectedDecisionRecords;
exports.projectedMailboxMessages = projectedMailboxMessages;
exports.projectedChatMessages = projectedChatMessages;
exports.projectedNaviChatMessages = projectedNaviChatMessages;
exports.projectedNiaChatMessages = projectedNiaChatMessages;
exports.normalizeCollaborationEvent = normalizeCollaborationEvent;
exports.projectedCollabMessages = projectedCollabMessages;
exports.projectedPlanDocs = projectedPlanDocs;
exports.settleInterruptedTurnIDs = settleInterruptedTurnIDs;
exports.emptySessionTurnFactState = emptySessionTurnFactState;
exports.applySessionTurnFact = applySessionTurnFact;
exports.emptySessionConstitutionFactState = emptySessionConstitutionFactState;
exports.applySessionConstitutionFact = applySessionConstitutionFact;
exports.sessionConstitutionRulesFrom = sessionConstitutionRulesFrom;
exports.sessionConstitutionOverridesFrom = sessionConstitutionOverridesFrom;
exports.emptySessionDriftFactState = emptySessionDriftFactState;
exports.applySessionDriftFact = applySessionDriftFact;
exports.sessionDriftFindingsFrom = sessionDriftFindingsFrom;
exports.emptySessionMailboxFactState = emptySessionMailboxFactState;
exports.applySessionMailboxFact = applySessionMailboxFact;
exports.sessionMailboxMessagesFrom = sessionMailboxMessagesFrom;
exports.emptySessionDecisionFactState = emptySessionDecisionFactState;
exports.applySessionDecisionFact = applySessionDecisionFact;
exports.sessionDecisionRecordsFrom = sessionDecisionRecordsFrom;
exports.emptySessionWorkContractFactState = emptySessionWorkContractFactState;
exports.applySessionWorkContractFact = applySessionWorkContractFact;
exports.sessionWorkContractsFrom = sessionWorkContractsFrom;
exports.emptySessionIntelligenceFactState = emptySessionIntelligenceFactState;
exports.applySessionIntelligenceFact = applySessionIntelligenceFact;
exports.sessionIntelligenceFactsFrom = sessionIntelligenceFactsFrom;
exports.sessionIntelligenceFactsFromEvents = sessionIntelligenceFactsFromEvents;
exports.isCollaborationStreamEvent = isCollaborationStreamEvent;
exports.emptySessionFactState = emptySessionFactState;
exports.applySessionFactEvent = applySessionFactEvent;
exports.sessionFactStateFromEvents = sessionFactStateFromEvents;
exports.sessionFactActiveTurnIDs = sessionFactActiveTurnIDs;
exports.sessionFactConstitutionRules = sessionFactConstitutionRules;
exports.sessionFactWorkContracts = sessionFactWorkContracts;
exports.sessionFactConstitutionOverrides = sessionFactConstitutionOverrides;
exports.sessionFactDriftFindings = sessionFactDriftFindings;
exports.sessionFactEvidenceRecords = sessionFactEvidenceRecords;
exports.sessionFactCompletions = sessionFactCompletions;
exports.evictTerminalFacts = evictTerminalFacts;
exports.sessionFactHumanValidation = sessionFactHumanValidation;
exports.sessionFactMailboxMessages = sessionFactMailboxMessages;
exports.sessionFactDecisionRecords = sessionFactDecisionRecords;
exports.sessionFactLatestSnapshot = sessionFactLatestSnapshot;
exports.sessionFactCollabMessages = sessionFactCollabMessages;
exports.sessionFactCollaborationEvents = sessionFactCollaborationEvents;
exports.sessionFactIntelligenceFacts = sessionFactIntelligenceFacts;
exports.sessionFactNaviChatMessages = sessionFactNaviChatMessages;
exports.sessionFactNiaChatMessages = sessionFactNiaChatMessages;
var goal_1 = require("@natalia/goal");
var inbox_1 = require("./inbox");
/** Selects the model-visible durable context after the latest epoch baseline. */
function modelVisibleEvents(events) {
    var checkpointIndex = events.reduce(function (latest, event, index) {
        return event.type === "context.checkpoint" ? index : latest;
    }, -1);
    if (checkpointIndex < 0)
        return events;
    return events.slice(checkpointIndex + 1);
}
/**
 * Projects append-only runtime events without attempting to replay an
 * incomplete provider/tool turn after restart.
 */
function projectSession(session) {
    var active = new Set();
    var completed = new Set();
    for (var _i = 0, _a = session.events; _i < _a.length; _i++) {
        var event_1 = _a[_i];
        if (event_1.type === "turn.submitted") {
            active.add(event_1.id);
            continue;
        }
        if (event_1.type === "turn.finished") {
            active.delete(event_1.id);
            completed.add(event_1.id);
        }
    }
    // A crashed turn may contain partial model/tool state. Keep its durable
    // audit events on disk, but do not feed its input back into a new model turn.
    var replayable = session.events.filter(function (event) { return !belongsToInterruptedTurn(event, active); });
    return {
        activeTurnIDs: __spreadArray([], active, true),
        completedTurnIDs: __spreadArray([], completed, true),
        pendingInputs: (0, inbox_1.admittedInputs)(session).filter(function (input) { return !input.promotedAt; }),
        replayableEvents: replayable,
        goal: projectedGoal(session.events),
        selectedAgent: selectedAgentFromEvents(replayable),
        selectedModel: selectedModelFromEvents(replayable),
        reasoningEffort: reasoningEffortFromEvents(replayable),
        chatModelProfile: chatModelProfileFromEvents(replayable),
        permissionMode: permissionModeFromEvents(replayable),
        permissionProfile: permissionProfileFromEvents(replayable),
    };
}
/**
 * Version of the durable projection fold. Bump this whenever the fold's state
 * shape or semantics change so a persisted checkpoint from an older build is
 * discarded rather than mis-replayed.
 */
exports.PROJECTION_STATE_VERSION = 1;
function initProjection() {
    return {
        version: exports.PROJECTION_STATE_VERSION,
        events: [],
        activeTurnIDs: new Set(),
        completedTurnIDs: new Set(),
        goal: undefined,
    };
}
/** Folds one event into the projection state in place and returns it. */
function applyProjection(state, event) {
    state.events.push(event);
    if (event.type === "turn.submitted")
        state.activeTurnIDs.add(event.id);
    else if (event.type === "turn.finished") {
        state.activeTurnIDs.delete(event.id);
        state.completedTurnIDs.add(event.id);
    }
    state.goal = (0, goal_1.foldGoalStep)(state.goal, event);
    return state;
}
/**
 * Materializes the view from a folded state. `inbox` carries the pending-input
 * slice (session state, not event-derived). Scalar selections are read from the
 * replayable surface exactly as `projectSession` does, so a checkpoint resumed
 * from a stored sequence plus a tail replay is indistinguishable from a full
 * projection.
 */
function viewProjection(state, inbox) {
    if (inbox === void 0) { inbox = []; }
    var replayable = state.events.filter(function (event) { return !belongsToInterruptedTurn(event, state.activeTurnIDs); });
    return {
        activeTurnIDs: __spreadArray([], state.activeTurnIDs, true),
        completedTurnIDs: __spreadArray([], state.completedTurnIDs, true),
        pendingInputs: inbox.filter(function (input) { return !input.promotedAt; }),
        replayableEvents: replayable,
        goal: state.goal,
        selectedAgent: selectedAgentFromEvents(replayable),
        selectedModel: selectedModelFromEvents(replayable),
        reasoningEffort: reasoningEffortFromEvents(replayable),
        chatModelProfile: chatModelProfileFromEvents(replayable),
        permissionMode: permissionModeFromEvents(replayable),
        permissionProfile: permissionProfileFromEvents(replayable),
    };
}
/** Convenience: fold a full event log in one call (equivalent to projectSession). */
function foldProjection(events, inbox) {
    if (inbox === void 0) { inbox = []; }
    var state = initProjection();
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_2 = events_1[_i];
        applyProjection(state, event_2);
    }
    return viewProjection(state, inbox);
}
/**
 * Restores a session projection through the cold-read ladder: prefer a persisted
 * disk checkpoint replayed over the tail (B), and fail soft to a full projection
 * (C) when no usable checkpoint exists. The in-memory tier (A) is the caller's
 * already-loaded exec; this helper owns the disk+tail and full-fallback tiers so
 * a missing, stale-versioned, or corrupt checkpoint never regresses attach.
 */
function restoreProjection(sessionID, session, store) {
    var _a;
    var checkpoint = store.loadProjectionCheckpoint(sessionID);
    if (checkpoint) {
        var state = deserializeProjectionState(checkpoint.serializedState);
        if (state) {
            for (var _i = 0, _b = store.eventsAfter(sessionID, checkpoint.lastSeq); _i < _b.length; _i++) {
                var event_3 = _b[_i];
                applyProjection(state, event_3);
            }
            return viewProjection(state, (_a = session.inbox) !== null && _a !== void 0 ? _a : []);
        }
    }
    return projectSession(session);
}
function serializeProjectionState(state) {
    var payload = __assign({ version: state.version, events: state.events, activeTurnIDs: __spreadArray([], state.activeTurnIDs, true), completedTurnIDs: __spreadArray([], state.completedTurnIDs, true) }, (state.goal === undefined ? {} : { goal: state.goal }));
    return JSON.stringify(payload);
}
/**
 * Restores a persisted projection checkpoint. A row written by an older
 * `PROJECTION_STATE_VERSION` (or a corrupt payload) is discarded so the caller
 * fails soft to a full projection instead of mis-replaying stale state.
 */
function deserializeProjectionState(json) {
    var _a, _b;
    var payload;
    try {
        payload = JSON.parse(json);
    }
    catch (_c) {
        return undefined;
    }
    if (payload.version !== exports.PROJECTION_STATE_VERSION)
        return undefined;
    if (!Array.isArray(payload.events))
        return undefined;
    // The set fields feed `new Set(...)`; a same-version payload carrying a
    // non-array there would throw instead of failing soft, so guard them too.
    if (payload.activeTurnIDs !== undefined &&
        !Array.isArray(payload.activeTurnIDs))
        return undefined;
    if (payload.completedTurnIDs !== undefined &&
        !Array.isArray(payload.completedTurnIDs))
        return undefined;
    return {
        version: payload.version,
        events: payload.events,
        activeTurnIDs: new Set((_a = payload.activeTurnIDs) !== null && _a !== void 0 ? _a : []),
        completedTurnIDs: new Set((_b = payload.completedTurnIDs) !== null && _b !== void 0 ? _b : []),
        goal: payload.goal,
    };
}
function belongsToInterruptedTurn(event, active) {
    if (!("id" in event) || typeof event.id !== "string")
        return false;
    return __spreadArray([], active, true).some(function (turnID) { return event.id === turnID || event.id.startsWith("".concat(turnID, ":")); });
}
function selectedModelFromEvents(events) {
    for (var _i = 0, _a = __spreadArray([], events, true).reverse(); _i < _a.length; _i++) {
        var event_4 = _a[_i];
        if (event_4.type === "model.selection")
            return { modelID: event_4.modelID, variant: event_4.variant };
    }
    return undefined;
}
function reasoningEffortFromEvents(events) {
    for (var _i = 0, _a = __spreadArray([], events, true).reverse(); _i < _a.length; _i++) {
        var event_5 = _a[_i];
        if (event_5.type === "model.reasoning.set")
            return event_5.reasoningEffort;
    }
    return undefined;
}
function chatModelProfileFromEvents(events) {
    var profile;
    for (var _i = 0, events_2 = events; _i < events_2.length; _i++) {
        var event_6 = events_2[_i];
        if (event_6.type === "navi.chat.model.profile") {
            profile = profile !== null && profile !== void 0 ? profile : {};
            profile.navi = event_6.profile;
            continue;
        }
        if (event_6.type === "nia.chat.model.profile") {
            profile = profile !== null && profile !== void 0 ? profile : {};
            profile.nia = event_6.profile;
            continue;
        }
        if (event_6.type === "chat.model.profile") {
            profile = profile !== null && profile !== void 0 ? profile : {};
            profile[event_6.channel] = event_6.profile;
        }
    }
    return profile;
}
function permissionModeFromEvents(events) {
    for (var _i = 0, _a = __spreadArray([], events, true).reverse(); _i < _a.length; _i++) {
        var event_7 = _a[_i];
        if (event_7.type === "session.permission.mode")
            return event_7.mode;
    }
    return undefined;
}
function permissionProfileFromEvents(events) {
    for (var _i = 0, _a = __spreadArray([], events, true).reverse(); _i < _a.length; _i++) {
        var event_8 = _a[_i];
        if (event_8.type === "session.permission.mode")
            return event_8.profile;
    }
    return undefined;
}
/** Returns the last committed, rather than pending, runtime agent selection. */
function selectedAgentFromEvents(events) {
    for (var _i = 0, _a = __spreadArray([], events, true).reverse(); _i < _a.length; _i++) {
        var event_9 = _a[_i];
        if (event_9.type === "agent.selection" && !event_9.pending)
            return event_9.name;
    }
    return undefined;
}
/**
 * Projects durable events into stable user-turn messages. A message page never
 * splits a turn, so a consumer can group user, reasoning, tool, and interactive
 * rows before it applies its own measured virtualization.
 */
function projectSessionMessages(session, options) {
    var _a, _b;
    if (options === void 0) { options = {}; }
    var order = options.cursor
        ? decodeMessageCursor(options.cursor).order
        : ((_a = options.order) !== null && _a !== void 0 ? _a : "desc");
    if (options.cursor && options.order)
        throw new Error("message cursor cannot be combined with order");
    var messages = projectTurnMessages(session.events);
    var ordered = order === "asc" ? messages : __spreadArray([], messages, true).reverse();
    var limit = Math.min(200, Math.max(1, (_b = options.limit) !== null && _b !== void 0 ? _b : 100));
    var start = messagePageStart(ordered, options.cursor, limit);
    var data = ordered.slice(start, start + limit);
    return {
        data: data,
        cursor: {
            previous: start > 0 && data[0]
                ? encodeMessageCursor({
                    order: order,
                    direction: "previous",
                    anchor: data[0].id,
                })
                : undefined,
            next: start + data.length < ordered.length && data.at(-1)
                ? encodeMessageCursor({
                    order: order,
                    direction: "next",
                    anchor: data.at(-1).id,
                })
                : undefined,
        },
    };
}
function messagePageStart(messages, cursor, limit) {
    if (!cursor)
        return 0;
    var value = decodeMessageCursor(cursor);
    var index = messages.findIndex(function (message) { return message.id === value.anchor; });
    if (index < 0)
        throw new Error("message cursor anchor is no longer available");
    if (value.direction === "next")
        return index + 1;
    return Math.max(0, index - limit);
}
/**
 * Historical static history can contain a late durable `thinking.done` after
 * a `content.partial` batch that belongs to the following answer. The partials
 * are an early durable copy of the same content step, so restore the logical
 * order `thinking.done -> content.partial -> content.done` when the partial
 * text reconstructs that answer. Do not cross tool/other barriers.
 *
 * New provider-runner writes stamp `thinking.done` with the provider attempt
 * and publish it before the first content chunk, so only un-stamped historical
 * records are normalized here. This keeps a real answer-then-reasoning stream
 * in the order the model produced it.
 */
function normalizeTurnEventOrder(events) {
    var out = [];
    var pendingPartials = [];
    var partialText = function () {
        return pendingPartials
            .map(function (event) { var _a; return ("text" in event ? ((_a = event.text) !== null && _a !== void 0 ? _a : "") : ""); })
            .join("");
    };
    var matchesDone = function (event) {
        if (!("text" in event) || typeof event.text !== "string")
            return false;
        var partial = partialText();
        if (!partial)
            return false;
        return (event.text === partial ||
            event.text.startsWith(partial) ||
            partial.startsWith(event.text));
    };
    var flushPartials = function () {
        if (pendingPartials.length === 0)
            return;
        out.push.apply(out, pendingPartials);
        pendingPartials = [];
    };
    for (var index = 0; index < events.length; index++) {
        var event_10 = events[index];
        if (event_10.type === "content.partial") {
            pendingPartials.push(event_10);
            continue;
        }
        if (pendingPartials.length > 0 &&
            event_10.type === "thinking.done" &&
            event_10.attempt === undefined) {
            var barrier = events
                .slice(index + 1)
                .find(function (candidate) {
                return candidate.type === "content.done" ||
                    candidate.type === "tool.update" ||
                    candidate.type === "turn.finished";
            });
            if ((barrier === null || barrier === void 0 ? void 0 : barrier.type) === "content.done" && matchesDone(barrier)) {
                // Keep the partials pending; emit them before their content.done.
                out.push(event_10);
                continue;
            }
            flushPartials();
            out.push(event_10);
            continue;
        }
        if (event_10.type === "content.done" && pendingPartials.length > 0) {
            if (matchesDone(event_10)) {
                flushPartials();
                out.push(event_10);
                continue;
            }
            flushPartials();
        }
        flushPartials();
        out.push(event_10);
    }
    flushPartials();
    return out;
}
function projectTurnMessage(submitted, events) {
    var rowIDCounts = new Map();
    var rows = normalizeTurnEventOrder(events).flatMap(function (candidate) {
        var _a;
        var kind = projectedRowKind(candidate, submitted.id);
        if (!kind)
            return [];
        var baseID = projectedRowID(candidate, submitted.id);
        var occurrence = (_a = rowIDCounts.get(baseID)) !== null && _a !== void 0 ? _a : 0;
        rowIDCounts.set(baseID, occurrence + 1);
        return [
            {
                // Durable rows can repeat the same event type/id within one turn
                // (multiple provider steps, partial/done pairs). The row id is a
                // consumer-facing key, so keep the first id stable and disambiguate
                // later occurrences instead of returning duplicates.
                id: occurrence === 0 ? baseID : "".concat(baseID, ":").concat(occurrence),
                turnID: submitted.id,
                kind: kind,
                event: candidate,
            },
        ];
    });
    var terminal = rows.findLast(function (row) { return row.event.type === "turn.finished"; });
    return {
        id: submitted.id,
        turnID: submitted.id,
        submitted: submitted,
        rows: rows,
        stopReason: (terminal === null || terminal === void 0 ? void 0 : terminal.event.type) === "turn.finished"
            ? terminal.event.stopReason
            : undefined,
    };
}
/**
 * Projects all submitted turns in one event pass. The former implementation
 * scanned the complete journal once per turn, which made JSON-mode history
 * projection quadratic while producing the same row membership.
 */
function projectTurnMessages(events) {
    var _a, _b;
    var byID = new Map();
    var ordered = [];
    for (var _i = 0, events_3 = events; _i < events_3.length; _i++) {
        var event_11 = events_3[_i];
        if (event_11.type === "turn.submitted" && !byID.has(event_11.id)) {
            byID.set(event_11.id, { submitted: event_11, rows: [] });
            ordered.push(event_11.id);
        }
    }
    var currentTurnID;
    var rowIDCounts = new Map();
    for (var _c = 0, _d = normalizeTurnEventOrder(events); _c < _d.length; _c++) {
        var event_12 = _d[_c];
        if (event_12.type === "turn.submitted" && byID.has(event_12.id))
            currentTurnID = event_12.id;
        var turnID = projectedTurnID(event_12, byID, currentTurnID);
        if (!turnID)
            continue;
        var message = byID.get(turnID);
        var kind = projectedRowKind(event_12, turnID);
        if (!kind)
            continue;
        var baseID = projectedRowID(event_12, turnID);
        var counts = (_a = rowIDCounts.get(turnID)) !== null && _a !== void 0 ? _a : new Map();
        rowIDCounts.set(turnID, counts);
        var occurrence = (_b = counts.get(baseID)) !== null && _b !== void 0 ? _b : 0;
        counts.set(baseID, occurrence + 1);
        message.rows.push({
            id: occurrence === 0 ? baseID : "".concat(baseID, ":").concat(occurrence),
            turnID: turnID,
            kind: kind,
            event: event_12,
        });
    }
    return ordered.map(function (id) {
        var message = byID.get(id);
        var terminal = message.rows.findLast(function (row) { return row.event.type === "turn.finished"; });
        return {
            id: id,
            turnID: id,
            submitted: message.submitted,
            rows: message.rows,
            stopReason: (terminal === null || terminal === void 0 ? void 0 : terminal.event.type) === "turn.finished"
                ? terminal.event.stopReason
                : undefined,
        };
    });
}
function projectedTurnID(event, messages, currentTurnID) {
    if (event.type === "policy.decision")
        return messages.has(event.turnID) ? event.turnID : undefined;
    if (event.type === "turn.input")
        return messages.has(event.turnID) ? event.turnID : undefined;
    // `input.*` events describe a durable admission, not a turn row. Without this
    // they would attach to the started turn carrying the same id.
    if (event.type.startsWith("input."))
        return undefined;
    // Collaboration messages carry their identity under `message.id`, not a
    // top-level `id` prefixed by the turn. They still belong to the turn that was
    // open when they were emitted, so attach them by event-stream order.
    if (event.type === "natalia.collab.message")
        return currentTurnID;
    if (!("id" in event) || typeof event.id !== "string")
        return undefined;
    var candidate = event.id;
    while (candidate) {
        if (messages.has(candidate))
            return candidate;
        var separator = candidate.lastIndexOf(":");
        if (separator < 0)
            return undefined;
        candidate = candidate.slice(0, separator);
    }
    return undefined;
}
function projectedRowKind(event, turnID) {
    if (event.type === "turn.submitted" && event.id === turnID)
        return event.internal ? "system" : "user";
    if (event.type === "policy.decision" && event.turnID === turnID)
        return "system";
    if (event.type === "turn.input")
        return event.internal ? "system" : "user";
    if (event.type === "natalia.collab.message")
        return "system";
    if (!("id" in event) || typeof event.id !== "string")
        return undefined;
    if (event.id !== turnID && !event.id.startsWith("".concat(turnID, ":")))
        return undefined;
    if (event.type === "thinking.delta" || event.type === "thinking.done")
        return "thinking";
    if (event.type === "content.delta" ||
        event.type === "content.done" ||
        event.type === "content.partial")
        return "assistant";
    if (event.type === "tool.update")
        return "tool";
    if (event.type === "approval.request" || event.type === "approval.response")
        return "approval";
    if (event.type === "question.request" || event.type === "question.response")
        return "question";
    return "system";
}
function projectedRowID(event, turnID) {
    var _a;
    if (event.type === "turn.input")
        return "".concat(event.turnID, ":user:").concat(event.inputID);
    if (event.type === "natalia.collab.message")
        return "".concat(turnID, ":collab:").concat(event.message.id);
    if (event.type === "policy.decision")
        return "".concat(turnID, ":policy:").concat((_a = event.toolCallID) !== null && _a !== void 0 ? _a : event.toolName, ":").concat(event.decision);
    if ("id" in event && typeof event.id === "string")
        return "".concat(event.id, ":").concat(event.type);
    return "".concat(turnID, ":").concat(event.type);
}
function encodeMessageCursor(input) {
    return Buffer.from(JSON.stringify(__assign({ version: 1 }, input))).toString("base64url");
}
function decodeMessageCursor(cursor) {
    try {
        var value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (value.version !== 1 ||
            (value.order !== "asc" && value.order !== "desc") ||
            (value.direction !== "previous" && value.direction !== "next") ||
            typeof value.anchor !== "string" ||
            !value.anchor)
            throw new Error("invalid message cursor");
        return value;
    }
    catch (_a) {
        throw new Error("invalid message cursor");
    }
}
/**
 * Settles only interactive requests owned by a crashed turn. Provider and tool
 * execution cannot be resumed safely without a durable continuation record.
 */
function settleInterruptedTurns(session) {
    var _a;
    var activeTurnIDs = projectSession(session).activeTurnIDs;
    if (!activeTurnIDs.length)
        return [];
    var pendingApprovals = new Set();
    var pendingQuestions = new Set();
    for (var _i = 0, _b = session.events; _i < _b.length; _i++) {
        var event_13 = _b[_i];
        if (event_13.type === "approval.request")
            pendingApprovals.add(event_13.id);
        if (event_13.type === "approval.response")
            pendingApprovals.delete(event_13.id);
        if (event_13.type === "question.request")
            pendingQuestions.add(event_13.id);
        if (event_13.type === "question.response")
            pendingQuestions.delete(event_13.id);
    }
    var settled = settleInterruptedTurnIDs(activeTurnIDs, __spreadArray([], pendingApprovals, true), __spreadArray([], pendingQuestions, true));
    (_a = session.events).push.apply(_a, settled);
    return settled;
}
/**
 * Projects the current same-session goal from the journal. The result is always
 * `disarmed`: continuation authority is process-local and never reconstructed
 * by replay (see the goal subsystem plan).
 */
function projectedGoal(events) {
    return (0, goal_1.foldGoal)(events);
}
/**
 * The next `context.instructions` revision for a session (ADR Phase C):
 * one past the highest revision already in the journal, so a later change
 * supersedes an earlier one without mutating history.
 */
function nextContextInstructionsRevision(events) {
    var max = 0;
    for (var _i = 0, events_4 = events; _i < events_4.length; _i++) {
        var event_14 = events_4[_i];
        if (event_14.type === "context.instructions" && event_14.revision > max)
            max = event_14.revision;
    }
    return max + 1;
}
/**
 * Projects the runtime notices from the journal (ADR Phase C): the latest
 * prompt-level instruction change per kind. A later `context.instructions`
 * event supersedes an earlier same-kind notice by revision — the projection
 * never mutates history, it just reports the current state per kind.
 */
function projectedRuntimeNotices(events) {
    var latest = new Map();
    for (var _i = 0, events_5 = events; _i < events_5.length; _i++) {
        var event_15 = events_5[_i];
        if (event_15.type !== "context.instructions")
            continue;
        var existing = latest.get(event_15.kind);
        if (existing && existing.revision >= event_15.revision)
            continue;
        latest.set(event_15.kind, __assign({ noticeID: event_15.id, kind: event_15.kind, revision: event_15.revision, at: event_15.at, summary: event_15.summary }, (event_15.detail ? { detail: event_15.detail } : {})));
    }
    return __spreadArray([], latest.values(), true).sort(function (left, right) {
        return left.at.localeCompare(right.at);
    });
}
function projectedConstitutionRules(events) {
    var state = emptySessionConstitutionFactState();
    for (var _i = 0, events_6 = events; _i < events_6.length; _i++) {
        var event_16 = events_6[_i];
        applySessionConstitutionFact(state, event_16);
    }
    return sessionConstitutionRulesFrom(state);
}
/**
 * Projects the work contracts from the journal (EI §8.2): the latest accepted
 * contract or draft per plan. Used by the handoff gate, which refuses to hand
 * off a plan the user has not committed to.
 */
function projectedWorkContracts(events) {
    var state = emptySessionWorkContractFactState();
    for (var _i = 0, events_7 = events; _i < events_7.length; _i++) {
        var event_17 = events_7[_i];
        applySessionWorkContractFact(state, event_17);
    }
    return sessionWorkContractsFrom(state);
}
function projectedConstitutionOverrides(events, now) {
    if (now === void 0) { now = Date.now(); }
    var state = emptySessionConstitutionFactState();
    for (var _i = 0, events_8 = events; _i < events_8.length; _i++) {
        var event_18 = events_8[_i];
        applySessionConstitutionFact(state, event_18);
    }
    return sessionConstitutionOverridesFrom(state, now);
}
function latestSessionSnapshot(events) {
    var latest;
    for (var _i = 0, events_9 = events; _i < events_9.length; _i++) {
        var event_19 = events_9[_i];
        if (event_19.type === "session.snapshot")
            latest = event_19;
    }
    return latest;
}
function projectedDriftFindings(events) {
    var state = emptySessionDriftFactState();
    for (var _i = 0, events_10 = events; _i < events_10.length; _i++) {
        var event_20 = events_10[_i];
        applySessionDriftFact(state, event_20);
    }
    return sessionDriftFindingsFrom(state);
}
function projectedCanonicalTools(events) {
    var tools = new Map();
    for (var _i = 0, events_11 = events; _i < events_11.length; _i++) {
        var event_21 = events_11[_i];
        if (event_21.type === "tool.registered")
            tools.set(event_21.name, event_21);
        if (event_21.type === "tool.unregistered")
            tools.delete(event_21.name);
    }
    return __spreadArray([], tools.values(), true).filter(function (e) {
        return e.type === "tool.registered";
    });
}
function projectedCapabilities(events) {
    var loaded = new Map();
    for (var _i = 0, events_12 = events; _i < events_12.length; _i++) {
        var event_22 = events_12[_i];
        if (event_22.type === "capability.loaded")
            loaded.set(event_22.id, {
                id: event_22.id,
                name: event_22.name,
                manifest: {
                    apiVersion: event_22.apiVersion,
                    id: event_22.id,
                    name: event_22.name,
                    version: event_22.version,
                    scope: event_22.scope,
                    grants: event_22.grants,
                },
            });
        if (event_22.type === "capability.unloaded")
            loaded.delete(event_22.id);
    }
    return __spreadArray([], loaded.values(), true);
}
function projectedWorkGraphNodes(events) {
    return events.filter(function (event) {
        return event.type === "workgraph.node_added";
    });
}
function projectedWorkGraphEdges(events) {
    return events.filter(function (event) {
        return event.type === "workgraph.edge_added";
    });
}
function projectedEvidenceRecords(events) {
    return events.filter(function (event) {
        return event.type === "evidence.recorded";
    });
}
/** Completion cards (P2 E4), in journal order. */
function projectedCompletions(events) {
    return events.filter(function (event) {
        return event.type === "completion.recorded";
    });
}
function projectedDecisionRecords(events) {
    var state = emptySessionDecisionFactState();
    for (var _i = 0, events_13 = events; _i < events_13.length; _i++) {
        var event_23 = events_13[_i];
        applySessionDecisionFact(state, event_23);
    }
    return sessionDecisionRecordsFrom(state);
}
function projectedMailboxMessages(events) {
    var state = emptySessionMailboxFactState();
    for (var _i = 0, events_14 = events; _i < events_14.length; _i++) {
        var event_24 = events_14[_i];
        applySessionMailboxFact(state, event_24);
    }
    return sessionMailboxMessagesFrom(state);
}
function stripChatChannel(message) {
    var _channel = message.channel, rest = __rest(message, ["channel"]);
    return rest;
}
function projectedChatMessages(events) {
    var _a, _b, _c, _d;
    var messages = [];
    var thinkingByMessage = new Map();
    var _loop_1 = function (event_25) {
        var channel = chatEventChannel(event_25);
        if (!channel)
            return "continue";
        if (isChatThinkingDelta(event_25)) {
            var key = "".concat(channel, ":").concat(event_25.messageID);
            var existing = thinkingByMessage.get(key);
            if (existing) {
                existing.text += event_25.text;
            }
            else {
                var thinking = {
                    messageID: event_25.messageID,
                    role: "chat",
                    text: event_25.text,
                    // Chat deltas do not carry a timestamp. Keeping journal order avoids
                    // making replay depend on the wall clock used by the projector.
                    at: "",
                    channel: channel,
                    kind: "thinking",
                };
                thinkingByMessage.set(key, thinking);
                messages.push(thinking);
            }
            return "continue";
        }
        if (isChatThinkingDone(event_25)) {
            var key = "".concat(channel, ":").concat(event_25.messageID);
            var existing = thinkingByMessage.get(key);
            if (existing) {
                // The durable settlement is the complete record. It supersedes any
                // live-only delta captured by a caller that projects both streams.
                existing.text = event_25.text;
            }
            else {
                var thinking = {
                    messageID: event_25.messageID,
                    role: "chat",
                    text: event_25.text,
                    at: "",
                    channel: channel,
                    kind: "thinking",
                };
                thinkingByMessage.set(key, thinking);
                messages.push(thinking);
            }
            return "continue";
        }
        if (isChatMessageSettlement(event_25)) {
            messages.push(__assign({ messageID: event_25.messageID, role: event_25.role, text: event_25.text, at: event_25.at, channel: channel, kind: "message" }, (event_25.attachments ? { attachments: event_25.attachments } : {})));
            return "continue";
        }
        if (isChatToolUsed(event_25)) {
            messages.push({
                messageID: event_25.messageID,
                role: "chat",
                text: event_25.summary,
                at: event_25.at,
                channel: channel,
                kind: "tool",
                tool: __assign(__assign(__assign(__assign({ eventID: event_25.id, name: event_25.toolName, status: event_25.status, summary: event_25.summary }, (event_25.result !== undefined ? { result: event_25.result } : {})), (event_25.argumentsRaw !== undefined
                    ? { argumentsRaw: event_25.argumentsRaw }
                    : {})), (event_25.startedAt !== undefined
                    ? { startedAt: event_25.startedAt }
                    : {})), (event_25.endedAt !== undefined ? { endedAt: event_25.endedAt } : {})),
            });
            return "continue";
        }
        if (isChatRollback(event_25)) {
            var boundary = messages.findIndex(function (message) {
                return message.messageID === event_25.toMessageID &&
                    message.channel === channel;
            });
            if (boundary !== -1) {
                for (var index = messages.length - 1; index >= 0; index -= 1)
                    if (((_a = messages[index]) === null || _a === void 0 ? void 0 : _a.channel) === channel && index > boundary)
                        messages.splice(index, 1);
            }
            else {
                for (var index = messages.length - 1; index >= 0; index -= 1)
                    if (((_b = messages[index]) === null || _b === void 0 ? void 0 : _b.channel) === channel)
                        messages.splice(index, 1);
            }
            thinkingByMessage.clear();
            for (var _e = 0, messages_1 = messages; _e < messages_1.length; _e++) {
                var message = messages_1[_e];
                if (message.kind === "thinking")
                    thinkingByMessage.set("".concat(message.channel, ":").concat(message.messageID), message);
            }
        }
        if (isChatCompacted(event_25)) {
            var boundary = messages.findIndex(function (message) {
                return message.messageID === event_25.compactedThroughMessageID &&
                    message.channel === channel;
            });
            if (boundary !== -1) {
                for (var index = messages.length - 1; index >= 0; index -= 1)
                    if (((_c = messages[index]) === null || _c === void 0 ? void 0 : _c.channel) === channel && index >= boundary)
                        messages.splice(index, 1);
            }
            else {
                for (var index = messages.length - 1; index >= 0; index -= 1)
                    if (((_d = messages[index]) === null || _d === void 0 ? void 0 : _d.channel) === channel)
                        messages.splice(index, 1);
            }
            messages.push({
                messageID: event_25.messageID,
                role: "chat",
                text: "[\u5DF2\u538B\u7F29\u7684\u804A\u5929\u5386\u53F2]\n".concat(event_25.summary),
                at: event_25.at,
                channel: channel,
                kind: "compaction",
            });
        }
    };
    for (var _i = 0, events_15 = events; _i < events_15.length; _i++) {
        var event_25 = events_15[_i];
        _loop_1(event_25);
    }
    return messages.map(stripChatChannel);
}
function projectedNaviChatMessages(events) {
    return projectNaviChatMessages(events);
}
function projectedNiaChatMessages(events) {
    return projectNiaChatMessages(events);
}
function projectNaviChatMessages(events) {
    return projectChatStream(events, "navi", isNaviChatEvent);
}
function projectNiaChatMessages(events) {
    return projectChatStream(events, "nia", isNiaChatEvent);
}
function collabChatRow(event, channel) {
    var message = normalizeCollaborationEvent(event);
    if (!message)
        return undefined;
    if (channel === "navi" && message.from !== "live_chat")
        return undefined;
    if (channel === "nia" && message.from !== "nia")
        return undefined;
    var from = message.from === "main_agent"
        ? "Natalia"
        : message.from === "live_chat"
            ? "Navi"
            : "Nia";
    var to = message.to === "main_agent"
        ? "Natalia"
        : message.to === "live_chat"
            ? "Navi"
            : "Nia";
    var text = message.kind === "response"
        ? "Natalia ".concat(message.decision, " the suggestion").concat(message.reason ? " (".concat(message.reason, ")") : "")
        : "".concat(from, " \u2192 ").concat(to, ": ").concat(message.text);
    return {
        messageID: message.id,
        role: "system",
        text: text,
        at: message.at,
        channel: channel,
        kind: "collab",
    };
}
function projectChatStream(events, channel, owns) {
    var messages = [];
    var thinkingByMessage = new Map();
    var _loop_2 = function (event_26) {
        var collab = collabChatRow(event_26, channel);
        if (collab) {
            messages.push(collab);
            return "continue";
        }
        if (!owns(event_26))
            return "continue";
        if (isChatThinkingDelta(event_26)) {
            var existing = thinkingByMessage.get(event_26.messageID);
            if (existing)
                existing.text += event_26.text;
            else {
                var thinking = {
                    messageID: event_26.messageID,
                    role: "chat",
                    text: event_26.text,
                    at: "",
                    channel: channel,
                    kind: "thinking",
                };
                thinkingByMessage.set(event_26.messageID, thinking);
                messages.push(thinking);
            }
            return "continue";
        }
        if (isChatThinkingDone(event_26)) {
            var existing = thinkingByMessage.get(event_26.messageID);
            if (existing)
                existing.text = event_26.text;
            else {
                var thinking = {
                    messageID: event_26.messageID,
                    role: "chat",
                    text: event_26.text,
                    at: "",
                    channel: channel,
                    kind: "thinking",
                };
                thinkingByMessage.set(event_26.messageID, thinking);
                messages.push(thinking);
            }
            return "continue";
        }
        if (isChatMessageSettlement(event_26)) {
            messages.push(__assign({ messageID: event_26.messageID, role: event_26.role, text: event_26.text, at: event_26.at, channel: channel, kind: "message" }, (event_26.attachments ? { attachments: event_26.attachments } : {})));
            return "continue";
        }
        if (isChatToolUsed(event_26)) {
            messages.push({
                messageID: event_26.messageID,
                role: "chat",
                text: event_26.summary,
                at: event_26.at,
                channel: channel,
                kind: "tool",
                tool: __assign(__assign(__assign(__assign({ eventID: event_26.id, name: event_26.toolName, status: event_26.status, summary: event_26.summary }, (event_26.result !== undefined ? { result: event_26.result } : {})), (event_26.argumentsRaw !== undefined
                    ? { argumentsRaw: event_26.argumentsRaw }
                    : {})), (event_26.startedAt !== undefined
                    ? { startedAt: event_26.startedAt }
                    : {})), (event_26.endedAt !== undefined ? { endedAt: event_26.endedAt } : {})),
            });
            return "continue";
        }
        if (isChatRollback(event_26)) {
            var boundary = messages.findIndex(function (message) { return message.messageID === event_26.toMessageID; });
            messages.splice(boundary === -1 ? 0 : boundary + 1);
            thinkingByMessage.clear();
            for (var _a = 0, messages_2 = messages; _a < messages_2.length; _a++) {
                var message = messages_2[_a];
                if (message.kind === "thinking")
                    thinkingByMessage.set(message.messageID, message);
            }
            return "continue";
        }
        if (isChatCompacted(event_26)) {
            var boundary = messages.findIndex(function (message) { return message.messageID === event_26.compactedThroughMessageID; });
            messages.splice(boundary === -1 ? 0 : boundary);
            messages.push({
                messageID: event_26.messageID,
                role: "chat",
                text: "[\u5DF2\u538B\u7F29\u7684\u804A\u5929\u5386\u53F2]\n".concat(event_26.summary),
                at: event_26.at,
                channel: channel,
                kind: "compaction",
            });
        }
    };
    for (var _i = 0, events_16 = events; _i < events_16.length; _i++) {
        var event_26 = events_16[_i];
        _loop_2(event_26);
    }
    return messages.map(stripChatChannel);
}
function isNaviChatEvent(event) {
    return (event.type.startsWith("navi.chat.") ||
        (event.type.startsWith("chat.") &&
            event.channel !== "nia"));
}
function isNiaChatEvent(event) {
    return (event.type.startsWith("nia.chat.") ||
        (event.type.startsWith("chat.") &&
            event.channel === "nia"));
}
function chatEventChannel(event) {
    var _a;
    if (event.type.startsWith("navi.chat."))
        return "navi";
    if (event.type.startsWith("nia.chat."))
        return "nia";
    if (event.type.startsWith("chat."))
        return (_a = event.channel) !== null && _a !== void 0 ? _a : "navi";
    return undefined;
}
function isChatCompacted(event) {
    return (event.type === "navi.chat.compacted" || event.type === "nia.chat.compacted");
}
function isChatThinkingDelta(event) {
    return (event.type === "navi.chat.thinking.delta" ||
        event.type === "nia.chat.thinking.delta" ||
        event.type === "chat.thinking.delta");
}
function isChatToolUsed(event) {
    return (event.type === "navi.chat.tool.used" ||
        event.type === "nia.chat.tool.used" ||
        event.type === "chat.tool.used");
}
function isChatMessageSettlement(event) {
    return (event.type === "navi.chat.message.new" ||
        event.type === "nia.chat.message.new" ||
        event.type === "navi.chat.message.added" ||
        event.type === "nia.chat.message.added" ||
        event.type === "chat.message.added");
}
function isChatThinkingDone(event) {
    return (event.type === "navi.chat.thinking.done" ||
        event.type === "nia.chat.thinking.done");
}
function isChatRollback(event) {
    return (event.type === "navi.chat.rollback" ||
        event.type === "nia.chat.rollback" ||
        event.type === "chat.rollback");
}
function normalizeCollaborationEvent(event, targets) {
    var _a, _b, _c, _d, _e;
    if (targets === void 0) { targets = new Map(); }
    if (event.type === "collab.message" ||
        event.type === "natalia.collab.message" ||
        event.type === "navi.collab.message" ||
        event.type === "nia.collab.message")
        return event.message;
    if (event.type === "collab.suggestion")
        return __assign(__assign({ id: event.id, threadID: event.id, kind: "suggestion", from: event.from, to: event.to, text: event.suggestion, expectsReply: true, priority: event.priority }, (event.rationale ? { rationale: event.rationale } : {})), { at: event.at });
    if (event.type === "collab.notice")
        return {
            id: event.id,
            threadID: event.id,
            kind: "notice",
            from: event.from,
            to: event.to,
            text: event.notice,
            expectsReply: false,
            noticeType: event.noticeType,
            at: event.at,
        };
    if (event.type === "collab.question")
        return {
            id: event.id,
            threadID: event.id,
            kind: "question",
            from: event.from,
            to: event.to,
            text: event.question,
            expectsReply: true,
            at: event.at,
        };
    if (event.type === "collab.answer")
        return {
            id: event.id,
            threadID: (_b = (_a = targets.get(event.questionID)) === null || _a === void 0 ? void 0 : _a.threadID) !== null && _b !== void 0 ? _b : event.questionID,
            replyToID: event.questionID,
            kind: "answer",
            from: event.from,
            to: event.to,
            text: event.answer,
            expectsReply: false,
            at: event.at,
        };
    if (event.type === "collab.chat")
        return __assign(__assign({ id: event.id, threadID: event.threadID }, (event.replyToID ? { replyToID: event.replyToID } : {})), { kind: "chat", from: event.from, to: event.to, text: event.text, expectsReply: event.expectsReply, round: event.round, at: event.at });
    if (event.type === "collab.response")
        return __assign(__assign({ id: event.id, threadID: (_d = (_c = targets.get(event.messageID)) === null || _c === void 0 ? void 0 : _c.threadID) !== null && _d !== void 0 ? _d : event.messageID, replyToID: event.messageID, kind: "response", from: "main_agent", to: "live_chat", text: (_e = event.reason) !== null && _e !== void 0 ? _e : event.decision, expectsReply: false, decision: event.decision }, (event.reason ? { reason: event.reason } : {})), { at: event.at });
    return undefined;
}
function projectedCollabMessages(events) {
    var targets = new Map();
    for (var _i = 0, events_17 = events; _i < events_17.length; _i++) {
        var event_27 = events_17[_i];
        var message = normalizeCollaborationEvent(event_27, targets);
        if (message && !targets.has(message.id))
            targets.set(message.id, message);
    }
    var normalized = events
        .map(function (event) { return normalizeCollaborationEvent(event, targets); })
        .filter(function (message) { return Boolean(message); });
    var unique = normalized.filter(function (message, index) {
        return normalized.findIndex(function (candidate) { return candidate.id === message.id; }) ===
            index;
    });
    var replied = new Set();
    for (var _a = 0, unique_1 = unique; _a < unique_1.length; _a++) {
        var message = unique_1[_a];
        if (!message.replyToID)
            continue;
        var target = targets.get(message.replyToID);
        if (target &&
            target.expectsReply &&
            target.threadID === message.threadID &&
            target.from === message.to &&
            target.to === message.from &&
            ((message.kind === "answer" && target.kind === "question") ||
                (message.kind === "response" && target.kind === "suggestion") ||
                (message.kind === "chat" && target.kind === "chat")))
            replied.add(target.id);
    }
    return unique.map(function (message) { return (__assign(__assign(__assign({}, message), { status: replied.has(message.id)
            ? "replied"
            : message.expectsReply
                ? "pending"
                : "informational" }), (message.kind === "answer" ? { questionID: message.replyToID } : {}))); });
}
function projectedPlanDocs(events) {
    var plans = new Map();
    for (var _i = 0, events_18 = events; _i < events_18.length; _i++) {
        var event_28 = events_18[_i];
        if (event_28.type === "plan.doc.created") {
            plans.set(event_28.planID, {
                planID: event_28.planID,
                title: event_28.title,
                documentPath: event_28.documentPath,
                createdBy: event_28.createdBy,
                createdAt: event_28.createdAt,
                updatedAt: event_28.createdAt,
                status: event_28.status,
            });
            continue;
        }
        if (event_28.type === "plan.doc.deleted") {
            plans.delete(event_28.planID);
            continue;
        }
        if (event_28.type !== "plan.doc.updated" &&
            event_28.type !== "plan.doc.marked" &&
            event_28.type !== "plan.doc.status")
            continue;
        var plan = plans.get(event_28.planID);
        if (!plan)
            continue;
        switch (event_28.type) {
            case "plan.doc.updated":
                plan.updatedAt = event_28.updatedAt;
                if (event_28.reason)
                    plan.status = plan.status;
                break;
            case "plan.doc.marked":
                plan.markedAt = event_28.markedAt;
                plan.updatedAt = event_28.markedAt;
                break;
            case "plan.doc.status":
                plan.status = event_28.status;
                plan.updatedAt = event_28.at;
                break;
        }
    }
    return __spreadArray([], plans.values(), true);
}
function settleInterruptedTurnIDs(activeTurnIDs, pendingApprovalIDs, pendingQuestionIDs) {
    var settled = [];
    for (var _i = 0, pendingApprovalIDs_1 = pendingApprovalIDs; _i < pendingApprovalIDs_1.length; _i++) {
        var requestID = pendingApprovalIDs_1[_i];
        if (requestBelongsToInterruptedTurn(requestID, activeTurnIDs))
            settled.push({
                type: "approval.response",
                id: requestID,
                decision: "reject",
                feedback: "interrupted turn cannot continue after runtime restart",
            });
    }
    for (var _a = 0, pendingQuestionIDs_1 = pendingQuestionIDs; _a < pendingQuestionIDs_1.length; _a++) {
        var requestID = pendingQuestionIDs_1[_a];
        if (requestBelongsToInterruptedTurn(requestID, activeTurnIDs))
            settled.push({
                type: "question.response",
                id: requestID,
                answers: [],
                rejected: true,
            });
    }
    for (var _b = 0, activeTurnIDs_1 = activeTurnIDs; _b < activeTurnIDs_1.length; _b++) {
        var id = activeTurnIDs_1[_b];
        settled.push({ type: "turn.finished", id: id, stopReason: "error" });
    }
    return settled;
}
function requestBelongsToInterruptedTurn(requestID, turnIDs) {
    return turnIDs.some(function (turnID) {
        return requestID === turnID ||
            requestID.startsWith("".concat(turnID, ":")) ||
            requestID.includes(":".concat(turnID, ":"));
    });
}
function emptySessionTurnFactState() {
    return { activeTurnIDs: new Set(), completedTurnIDs: new Set() };
}
function applySessionTurnFact(state, event) {
    if (event.type === "turn.submitted") {
        state.activeTurnIDs.add(event.id);
        return;
    }
    if (event.type === "turn.finished") {
        state.activeTurnIDs.delete(event.id);
        state.completedTurnIDs.add(event.id);
    }
}
function emptySessionConstitutionFactState() {
    return { rules: new Map(), disabled: new Set(), overrides: [] };
}
function applySessionConstitutionFact(state, event) {
    if (event.type === "constitution.rule_added") {
        if (!state.rules.has(event.ruleID))
            state.rules.set(event.ruleID, event);
        state.disabled.delete(event.ruleID);
        return;
    }
    if (event.type === "constitution.rule_updated") {
        // A disable is reversible (enabled:false) and keeps the rule in the
        // journal; only rule_removed is the durable tombstone.
        if (event.enabled === false)
            state.disabled.add(event.ruleID);
        else if (event.enabled === true)
            state.disabled.delete(event.ruleID);
        var existing = state.rules.get(event.ruleID);
        if (!existing)
            return;
        state.rules.set(event.ruleID, __assign(__assign(__assign(__assign(__assign(__assign({}, existing), (event.statement ? { statement: event.statement } : {})), (event.priority ? { priority: event.priority } : {})), (event.enforcement ? { enforcement: event.enforcement } : {})), (event.overridePolicy ? { overridePolicy: event.overridePolicy } : {})), (event.appliesTo ? { appliesTo: event.appliesTo } : {})));
        return;
    }
    if (event.type === "constitution.rule_removed") {
        // The tombstone stays in the journal (history is complete); the effective
        // set simply drops the rule.
        state.rules.delete(event.ruleID);
        state.disabled.delete(event.ruleID);
        return;
    }
    if (event.type === "constitution.override_granted")
        state.overrides.push(event);
}
function sessionConstitutionRulesFrom(state) {
    return __spreadArray([], state.rules.values(), true).filter(function (rule) { return !state.disabled.has(rule.ruleID); });
}
/** Overrides are time-filtered at read time, so the fold stays deterministic. */
function sessionConstitutionOverridesFrom(state, now) {
    if (now === void 0) { now = Date.now(); }
    return state.overrides.filter(function (event) {
        if (!event.expiresAt)
            return true;
        var expires = Date.parse(event.expiresAt);
        return !Number.isFinite(expires) || expires > now;
    });
}
function emptySessionDriftFactState() {
    return { findings: new Map() };
}
function applySessionDriftFact(state, event) {
    var _a;
    if (event.type === "drift.finding_opened") {
        state.findings.set(event.findingID, __assign({ findingID: event.findingID, severity: event.severity, confidence: event.confidence, originalObjective: event.originalObjective, currentActivity: event.currentActivity, evidence: event.evidence, applicableConstraints: event.applicableConstraints, status: "open", reopenedCount: 0, contractVersion: event.contractVersion, ruleHits: (_a = event.ruleHits) !== null && _a !== void 0 ? _a : [] }, (event.planID ? { planID: event.planID } : {})));
        return;
    }
    if (event.type === "drift.finding_updated") {
        var existing = state.findings.get(event.findingID);
        // An update carries no objective or evidence, so a finding that was never
        // opened cannot be reconstructed from it alone.
        if (!existing)
            return;
        // A reopen (翻案) is a user lifting a terminal disposition back to open; count
        // it so the card can show "reopened N times" as a rule-tuning signal.
        var reopened = existing.status !== "open" && event.status === "open"
            ? existing.reopenedCount + 1
            : existing.reopenedCount;
        state.findings.set(event.findingID, __assign(__assign(__assign({}, existing), { status: event.status, reopenedCount: reopened }), (event.rationale === undefined ? {} : { rationale: event.rationale })));
    }
}
function sessionDriftFindingsFrom(state) {
    return __spreadArray([], state.findings.values(), true);
}
function emptySessionMailboxFactState() {
    return { messages: new Map() };
}
function applySessionMailboxFact(state, event) {
    if (event.type === "mailbox.queued") {
        state.messages.set(event.messageID, __assign(__assign({ messageID: event.messageID, source: event.source, priority: event.priority, intent: event.intent, text: event.text, safeSummary: event.safeSummary }, (event.relatedPlanID ? { relatedPlanID: event.relatedPlanID } : {})), { deliveryPolicy: event.deliveryPolicy, createdAt: event.createdAt, status: "queued" }));
        return;
    }
    if (event.type === "mailbox.delivered") {
        var message = state.messages.get(event.messageID);
        if (message)
            message.status = "delivered";
        return;
    }
    if (event.type === "mailbox.acknowledged") {
        var message = state.messages.get(event.messageID);
        if (message)
            message.status = "acknowledged";
        return;
    }
    if (event.type === "mailbox.deferred") {
        var message = state.messages.get(event.messageID);
        if (message) {
            message.status = "deferred";
            message.reason = event.reason;
        }
        return;
    }
    if (event.type === "mailbox.superseded") {
        var message = state.messages.get(event.messageID);
        if (message) {
            message.status = "superseded";
            message.reason = event.reason;
        }
    }
}
function sessionMailboxMessagesFrom(state) {
    return __spreadArray([], state.messages.values(), true);
}
function emptySessionDecisionFactState() {
    return { records: [], seen: new Set() };
}
function applySessionDecisionFact(state, event) {
    if (event.type !== "decision.recorded")
        return;
    if (state.seen.has(event.id))
        return;
    state.seen.add(event.id);
    state.records.push(event);
}
function sessionDecisionRecordsFrom(state) {
    return state.records;
}
function emptySessionWorkContractFactState() {
    return { contracts: new Map() };
}
function applySessionWorkContractFact(state, event) {
    if (event.type === "work_contract.drafted") {
        state.contracts.set(event.planID, __assign(__assign(__assign(__assign({ planID: event.planID, version: event.planVersion }, (event.scope ? { scope: event.scope } : {})), (event.verification ? { verification: event.verification } : {})), (event.constraints ? { constraints: event.constraints } : {})), { status: "draft" }));
        return;
    }
    if (event.type === "work_contract.accepted") {
        state.contracts.set(event.planID, __assign(__assign(__assign(__assign(__assign({ planID: event.planID, version: event.planVersion }, (event.scope ? { scope: event.scope } : {})), (event.verification ? { verification: event.verification } : {})), (event.constraints ? { constraints: event.constraints } : {})), { status: "current", acceptedBy: event.acceptedBy, acceptedAt: event.acceptedAt }), (event.unverifiable ? { unverifiable: true } : {})));
        return;
    }
    // A plan document edit invalidates a draft extracted from an older
    // revision; an accepted contract is the user's commitment and survives
    // until a new one is approved. The update carries the document's new
    // revision, so a draft is stale only when the document moved past the
    // version it was extracted from (revision > planVersion); re-proposing
    // against the current revision clears the marker.
    if (event.type === "plan.doc.updated") {
        var contract = state.contracts.get(event.planID);
        if (contract &&
            contract.status === "draft" &&
            event.revision > contract.version)
            contract.stale = true;
    }
}
function sessionWorkContractsFrom(state) {
    return __spreadArray([], state.contracts.values(), true);
}
function emptySessionIntelligenceFactState() {
    return {
        changedFiles: 0,
        validatedChanges: 0,
        terminalActions: new Map(),
        sandboxStatuses: new Map(),
        journalEvents: [],
        humanValidationByTask: new Map(),
    };
}
function applySessionIntelligenceFact(state, event) {
    var _a, _b;
    if (event.type === "workgraph.node_added") {
        if (event.kind === "workspace_change")
            state.changedFiles += 1;
        return;
    }
    if (event.type === "evidence.recorded") {
        state.validatedChanges += (_b = (_a = event.changes) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        state.journalEvents.push(event);
        return;
    }
    if (event.type === "completion.recorded") {
        state.journalEvents.push(event);
        return;
    }
    if (event.type === "completion.human_validation") {
        state.humanValidationByTask.set(event.taskID, event.validation);
        return;
    }
    if (event.type === "content.done") {
        if (event.text)
            state.latestOutput = event.text;
        return;
    }
    if (event.type === "terminal.timeline") {
        state.terminalActions.set(event.id, event.action);
        return;
    }
    if (event.type === "sandbox.update") {
        state.sandboxStatuses.set(event.id, event.status);
    }
}
function sessionIntelligenceFactsFrom(state) {
    return __assign(__assign({ changedFiles: state.changedFiles, validatedChanges: state.validatedChanges, unvalidatedChanges: Math.max(0, state.changedFiles - state.validatedChanges) }, (state.latestOutput ? { latestOutput: state.latestOutput } : {})), { hasPTY: __spreadArray([], state.terminalActions.values(), true).some(function (action) { return action !== "exit"; }), hasSandbox: __spreadArray([], state.sandboxStatuses.values(), true).some(function (status) {
            return status !== "deleted" && status !== "stopped" && status !== "failed";
        }) });
}
function sessionIntelligenceFactsFromEvents(events) {
    var state = emptySessionIntelligenceFactState();
    for (var _i = 0, events_19 = events; _i < events_19.length; _i++) {
        var event_29 = events_19[_i];
        applySessionIntelligenceFact(state, event_29);
    }
    return sessionIntelligenceFactsFrom(state);
}
/** Events the collaboration / collab-snapshot projections consume. */
function isCollaborationStreamEvent(event) {
    return (event.type.startsWith("collab.") ||
        event.type.includes(".collab.") ||
        event.type.startsWith("plan.doc.") ||
        event.type.startsWith("mailbox."));
}
/** Would `projectChatStream` render this event on the `navi` channel? */
function naviChatStreamEvent(event) {
    var collab = normalizeCollaborationEvent(event);
    if (collab)
        return collab.from === "live_chat";
    return isNaviChatEvent(event);
}
/** Would `projectChatStream` render this event on the `nia` channel? */
function niaChatStreamEvent(event) {
    var collab = normalizeCollaborationEvent(event);
    if (collab)
        return collab.from === "nia";
    return isNiaChatEvent(event);
}
function emptySessionFactState() {
    return {
        turns: emptySessionTurnFactState(),
        constitution: emptySessionConstitutionFactState(),
        workContracts: emptySessionWorkContractFactState(),
        drift: emptySessionDriftFactState(),
        mailbox: emptySessionMailboxFactState(),
        decisions: emptySessionDecisionFactState(),
        intelligence: emptySessionIntelligenceFactState(),
        collaborationEvents: [],
        naviChatEvents: [],
        niaChatEvents: [],
    };
}
function applySessionFactEvent(state, event) {
    applySessionTurnFact(state.turns, event);
    applySessionConstitutionFact(state.constitution, event);
    applySessionWorkContractFact(state.workContracts, event);
    applySessionDriftFact(state.drift, event);
    applySessionMailboxFact(state.mailbox, event);
    applySessionDecisionFact(state.decisions, event);
    applySessionIntelligenceFact(state.intelligence, event);
    if (event.type === "session.snapshot")
        state.latestSnapshot = event;
    if (isCollaborationStreamEvent(event))
        state.collaborationEvents.push(event);
    if (naviChatStreamEvent(event))
        state.naviChatEvents.push(event);
    if (niaChatStreamEvent(event))
        state.niaChatEvents.push(event);
}
function sessionFactStateFromEvents(events) {
    var state = emptySessionFactState();
    for (var _i = 0, events_20 = events; _i < events_20.length; _i++) {
        var event_30 = events_20[_i];
        applySessionFactEvent(state, event_30);
    }
    return state;
}
function sessionFactActiveTurnIDs(state) {
    return __spreadArray([], state.turns.activeTurnIDs, true);
}
function sessionFactConstitutionRules(state) {
    return sessionConstitutionRulesFrom(state.constitution);
}
function sessionFactWorkContracts(state) {
    return sessionWorkContractsFrom(state.workContracts);
}
function sessionFactConstitutionOverrides(state, now) {
    if (now === void 0) { now = Date.now(); }
    return sessionConstitutionOverridesFrom(state.constitution, now);
}
function sessionFactDriftFindings(state) {
    return sessionDriftFindingsFrom(state.drift);
}
/**
 * The evidence slice from the hot fact state (B6): `evidence.recorded` events
 * folded into the intelligence slice, read without rescanning the journal.
 */
function sessionFactEvidenceRecords(state) {
    return state.intelligence.journalEvents.filter(function (event) {
        return event.type === "evidence.recorded";
    });
}
/**
 * The completion slice from the hot fact state (B6): `completion.recorded`
 * events folded into the intelligence slice.
 */
function sessionFactCompletions(state) {
    return state.intelligence.journalEvents.filter(function (event) {
        return event.type === "completion.recorded";
    });
}
/** The terminal-keep count for the hot fact state (EI Phase 1 "降档"). */
exports.FACT_TERMINAL_LIMIT = 200;
var ACTIVE_EVIDENCE_STATUS = new Set(["planned", "implemented", "validated"]);
/**
 * EI Phase 1 "降档" (RINA boundary): bound the hot fact state's *terminal*
 * entries so memory does not grow with the whole session. `降档≠丢失` — the
 * entries are not deleted from the journal; a read that needs them pages the
 * durable store (the intelligence surface reconstructs when
 * `factStateTerminalEvicted` is set).
 *
 * - evidence: active statuses (planned/implemented/validated) kept in full;
 *   terminal kept to the most recent `limit`.
 * - completion: kept to the most recent `limit`.
 * - decision: kept to the most recent `limit`.
 * - drift: open/disputed kept in full (their dedup depends on the open set);
 *   terminal kept to the most recent `limit`.
 *
 * Mutates `state` and returns whether anything was evicted. Pure otherwise.
 */
function evictTerminalFacts(state, limit) {
    if (limit === void 0) { limit = exports.FACT_TERMINAL_LIMIT; }
    var evicted = false;
    var journal = state.intelligence.journalEvents;
    var evidence = journal.filter(function (event) { return event.type === "evidence.recorded"; });
    var completions = journal.filter(function (event) { return event.type === "completion.recorded"; });
    var activeEvidence = evidence.filter(function (event) {
        return ACTIVE_EVIDENCE_STATUS.has(event.status);
    });
    var terminalEvidence = evidence.filter(function (event) { return !ACTIVE_EVIDENCE_STATUS.has(event.status); });
    var keptEvidence = new Set(__spreadArray(__spreadArray([], activeEvidence, true), terminalEvidence.slice(-limit), true));
    var keptCompletions = new Set(completions.slice(-limit));
    if (keptEvidence.size !== evidence.length ||
        keptCompletions.size !== completions.length) {
        state.intelligence.journalEvents = journal.filter(function (event) {
            return event.type === "evidence.recorded"
                ? keptEvidence.has(event)
                : event.type === "completion.recorded"
                    ? keptCompletions.has(event)
                    : true;
        });
        evicted = true;
    }
    if (state.decisions.records.length > limit) {
        state.decisions.records = state.decisions.records.slice(-limit);
        evicted = true;
    }
    var findings = __spreadArray([], state.drift.findings.values(), true);
    var isOpen = function (status) { return status === "open" || status === "disputed"; };
    var openFindings = findings.filter(function (finding) { return isOpen(finding.status); });
    var terminalFindings = findings.filter(function (finding) { return !isOpen(finding.status); });
    if (terminalFindings.length > limit) {
        var keep = new Set(__spreadArray(__spreadArray([], openFindings, true), terminalFindings.slice(-limit), true));
        for (var _i = 0, _a = state.drift.findings; _i < _a.length; _i++) {
            var _b = _a[_i], id = _b[0], finding = _b[1];
            if (!keep.has(finding)) {
                state.drift.findings.delete(id);
                evicted = true;
            }
        }
    }
    return evicted;
}
/** EI Phase 0: the latest human validation note per completion taskID. */
function sessionFactHumanValidation(state) {
    return state.intelligence.humanValidationByTask;
}
function sessionFactMailboxMessages(state) {
    return sessionMailboxMessagesFrom(state.mailbox);
}
function sessionFactDecisionRecords(state) {
    return sessionDecisionRecordsFrom(state.decisions);
}
function sessionFactLatestSnapshot(state) {
    return state.latestSnapshot;
}
function sessionFactCollabMessages(state) {
    return projectedCollabMessages(state.collaborationEvents);
}
/** The complete collaboration slice (collab + plan.doc + mailbox events). */
function sessionFactCollaborationEvents(state) {
    return state.collaborationEvents;
}
function sessionFactIntelligenceFacts(state) {
    return sessionIntelligenceFactsFrom(state.intelligence);
}
function sessionFactNaviChatMessages(state) {
    return projectedNaviChatMessages(state.naviChatEvents);
}
function sessionFactNiaChatMessages(state) {
    return projectedNiaChatMessages(state.niaChatEvents);
}
