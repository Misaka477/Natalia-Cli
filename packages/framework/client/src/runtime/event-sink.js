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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
exports.mainTurnHasInfrastructureError = mainTurnHasInfrastructureError;
exports.createEventSink = createEventSink;
/**
 * Event publishing choke point — runtime/event-sink module.
 *
 * `publish` and `publishForSession` are the single writers of the runtime event
 * stream: they stamp episode/session ids, bucket diagnostics, track live output
 * and active tools, dispatch to plugins, push to the sink, persist durable
 * events, and trigger session snapshots and safe-boundary settlement. Reads
 * everything it needs from `RuntimeContext` at call time.
 */
var session_1 = require("@anthelia/session");
var contracts_1 = require("@natalia/contracts");
var collab_1 = require("@natalia/collab");
var collab_2 = require("@natalia/collab");
var goal_runtime_1 = require("./goal/goal-runtime");
var session_store_1 = require("@anthelia/session-store");
var substrate_1 = require("@anthelia/substrate");
var substrate_2 = require("@anthelia/substrate");
var runtime_services_1 = require("@natalia/runtime-services");
var operation_log_1 = require("@natalia/operation-log");
var INFRASTRUCTURE_ERROR_KINDS = new Set([
    "timeout",
    "connection",
    "rate_limit",
    "server",
    "auth",
    "invalid_request",
    "empty_response",
    "context_limit",
    "quota",
    "unknown",
    "cancel",
]);
function mainTurnHasInfrastructureError(exec, turnID) {
    var events = exec.session.events;
    var start = events.findIndex(function (event) { return event.type === "turn.submitted" && event.id === turnID; });
    var end = events.findIndex(function (event) { return event.type === "turn.finished" && event.id === turnID; });
    if (start < 0 || end < 0 || end <= start)
        return false;
    return events
        .slice(start, end)
        .some(function (event) {
        return event.type === "step.retry.exhausted" &&
            (event.id === turnID || event.id.startsWith("".concat(turnID, ":"))) &&
            INFRASTRUCTURE_ERROR_KINDS.has(event.reason);
    });
}
function createEventSink(ctx, options) {
    var _a, _b;
    var collabSnapshotScheduler = (0, collab_1.createCollabSnapshotScheduler)(ctx);
    ctx.ports.scheduleCollabSnapshot = collabSnapshotScheduler.schedule;
    var goalRuntime = (0, goal_runtime_1.createGoalRuntime)(ctx);
    // The goal tools ride in the main tool registry alongside the other framework
    // tools (sandbox, subagents, collaboration).
    for (var _i = 0, _c = goalRuntime.tools; _i < _c.length; _i++) {
        var tool = _c[_i];
        if (ctx.state.tools.get(tool.name))
            throw new Error("framework tool already registered: ".concat(tool.name));
        ctx.state.tools.set(tool.name, tool);
    }
    ctx.ports.goalControl = function (action, sessionID) {
        var id = sessionID !== null && sessionID !== void 0 ? sessionID : ctx.ports.getSessionID();
        if (!id)
            return Promise.resolve({
                ok: false,
                action: action,
                message: "no active session",
            });
        return goalRuntime.control(action, id);
    };
    ctx.ports.goalEdit = function (input, sessionID) {
        var id = sessionID !== null && sessionID !== void 0 ? sessionID : ctx.ports.getSessionID();
        if (!id)
            return Promise.resolve({
                ok: false,
                action: "edit",
                message: "no active session",
            });
        return goalRuntime.edit(input, id);
    };
    ctx.ports.syncGoalStatus = function (sessionID) { return goalRuntime.refresh(sessionID); };
    // `content.delta` is live-only: one durable event per provider chunk would
    // bloat the journal. Coalesce the deltas into throttled durable
    // `content.partial` batches instead, so an abrupt death keeps the text that
    // was already generated. The batches concatenate to the step's final text.
    var PARTIAL_FLUSH_MS = Math.max(100, Number((_a = process.env.NATALIA_PARTIAL_FLUSH_MS) !== null && _a !== void 0 ? _a : 1000));
    var PARTIAL_FLUSH_CHARS = Math.max(256, Number((_b = process.env.NATALIA_PARTIAL_FLUSH_CHARS) !== null && _b !== void 0 ? _b : 4000));
    var pendingPartialByTurn = new Map();
    function flushPartial(turnID) {
        var pending = pendingPartialByTurn.get(turnID);
        if (!pending)
            return;
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = undefined;
        }
        var text = pending.text;
        pending.text = "";
        var exec = pending.exec;
        if (!text || !exec.session)
            return;
        var partial = {
            type: "content.partial",
            id: turnID,
            text: text,
            at: new Date().toISOString(),
        };
        var partialSeq = exec.nextSessionSeq++;
        (0, contracts_1.markRuntimeEventSessionSeq)(partial, partialSeq);
        (0, substrate_1.feedSessionEventWindow)(exec, partialSeq, partial);
        (0, session_1.appendSessionEvent)(exec.session, partial);
        (0, substrate_2.feedSessionFactState)(exec, partial);
        var sessionStoreController = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
        if (!sessionStoreController)
            return;
        // Partials are durable events like any other and must go through the same
        // per-session persistence chain. Writing them directly let a timer-flushed
        // partial jump ahead of a previously published `thinking.done`, so replay
        // rendered the answer before its reasoning.
        var sessionPersistence = ctx.ports.getSessionPersistenceForSession(exec.session.id);
        var next = sessionPersistence
            .then(function () {
            if (sessionStoreController.status().initialized)
                return sessionStoreController.appendEvent(__assign({}, exec.session), partial);
        })
            .catch(function (error) {
            var _a;
            (_a = ctx.ports.getSink()) === null || _a === void 0 ? void 0 : _a({
                type: "diagnostic",
                level: "warning",
                message: "partial persistence deferred/failed: ".concat(error instanceof Error ? error.message : String(error)),
            });
        });
        ctx.ports.setSessionPersistenceForSession(exec.session.id, next);
        ctx.ports.setSessionPersistence(Promise.allSettled([ctx.ports.getSessionPersistence(), next]).then(function () { return undefined; }));
    }
    function schedulePartialFlush(exec, turnID) {
        var _a, _b, _c, _d;
        var pending = (_a = pendingPartialByTurn.get(turnID)) !== null && _a !== void 0 ? _a : {
            exec: exec,
            text: "",
        };
        pending.exec = exec;
        pendingPartialByTurn.set(turnID, pending);
        if (pending.text.length >= PARTIAL_FLUSH_CHARS) {
            flushPartial(turnID);
            return;
        }
        (_b = pending.timer) !== null && _b !== void 0 ? _b : (pending.timer = setTimeout(function () {
            var current = pendingPartialByTurn.get(turnID);
            if (current)
                current.timer = undefined;
            flushPartial(turnID);
        }, PARTIAL_FLUSH_MS));
        (_d = (_c = pending.timer).unref) === null || _d === void 0 ? void 0 : _d.call(_c);
    }
    // Release any in-flight stream buffer before the store closes, so a graceful
    // shutdown keeps the last <1s of generated text too.
    ctx.ports.flushPendingPartialOutput = function () {
        for (var _i = 0, _a = __spreadArray([], pendingPartialByTurn.keys(), true); _i < _a.length; _i++) {
            var turnID = _a[_i];
            flushPartial(turnID);
        }
    };
    var CONTEXT_EPOCH_WRITE_EVERY = 100;
    var CONTEXT_EPOCH_WRITE_INTERVAL_MS = 5000;
    var contextEpochDirty = new Map();
    function writeContextEpoch(exec, trigger) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionStore, step, snapshot, error_1, message;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        sessionStore = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                        if (!sessionStore || !exec.context)
                            return [2 /*return*/];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        // Flush queued appends before taking the checkpoint. The epoch baseline
                        // is the current max journal seq, so snapshot and baseline must observe
                        // the same persisted prefix.
                        return [4 /*yield*/, sessionStore.flush(exec.session.id).catch(function () { return undefined; })];
                    case 2:
                        // Flush queued appends before taking the checkpoint. The epoch baseline
                        // is the current max journal seq, so snapshot and baseline must observe
                        // the same persisted prefix.
                        _c.sent();
                        step = exec.context.journalStatus().messageCount;
                        snapshot = exec.context.durableCheckpoint(step);
                        sessionStore.writeContextEpoch(exec.session.id, snapshot);
                        (0, runtime_services_1.perfLog)("[perf] contextEpoch.write session=".concat(exec.session.id, " trigger=").concat(trigger, " step=").concat(step, " +0ms"));
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _c.sent();
                        message = error_1 instanceof Error ? error_1.message : String(error_1);
                        (_b = (_a = ctx.ports).publish) === null || _b === void 0 ? void 0 : _b.call(_a, {
                            type: "diagnostic",
                            level: "warning",
                            message: "context epoch write failed: ".concat(message),
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function scheduleContextEpochWrite(exec, event) {
        var _a, _b;
        var sessionID = exec.session.id;
        var dirty = (_a = contextEpochDirty.get(sessionID)) !== null && _a !== void 0 ? _a : {
            pending: 0,
            timer: undefined,
        };
        contextEpochDirty.set(sessionID, dirty);
        if (event.type === "turn.finished" ||
            event.type === "turn.cancelled" ||
            event.type === "session.ready") {
            dirty.pending = 0;
            if (dirty.timer) {
                clearTimeout(dirty.timer);
                dirty.timer = undefined;
            }
            void writeContextEpoch(exec, "boundary");
            return;
        }
        dirty.pending += 1;
        if (dirty.pending >= CONTEXT_EPOCH_WRITE_EVERY) {
            dirty.pending = 0;
            if (dirty.timer) {
                clearTimeout(dirty.timer);
                dirty.timer = undefined;
            }
            void writeContextEpoch(exec, "count");
            return;
        }
        (_b = dirty.timer) !== null && _b !== void 0 ? _b : (dirty.timer = setTimeout(function () {
            dirty.timer = undefined;
            var current = ctx.ports.getExecutionBySession().get(sessionID);
            if (!current)
                return;
            if (dirty.pending > 0) {
                dirty.pending = 0;
                void writeContextEpoch(current, "interval");
            }
        }, CONTEXT_EPOCH_WRITE_INTERVAL_MS));
    }
    return {
        publish: publish,
        publishForSession: publishForSession,
    };
    function publish(event) {
        publishForSession(ctx.ports.getActiveExec(), event);
    }
    function publishForSession(exec, event) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var _k = ctx.ports, getSink = _k.getSink, getSessionPersistence = _k.getSessionPersistence, setSessionPersistence = _k.setSessionPersistence, setPendingHumanTerminal = _k.setPendingHumanTerminal, maybeContinueAfterHumanInput = _k.maybeContinueAfterHumanInput, settleMailboxAtBoundary = _k.settleMailboxAtBoundary, reconcileWorkspaceObservation = _k.reconcileWorkspaceObservation, toolEventTurnID = _k.toolEventTurnID, isSessionSnapshotTrigger = _k.isSessionSnapshotTrigger, publishSessionSnapshot = _k.publishSessionSnapshot, getPluginsController = _k.getPluginsController;
        var _l = ctx.state, runtimeDiagnosticsBySession = _l.runtimeDiagnosticsBySession, runtimeDiagnostics = _l.runtimeDiagnostics, liveMainOutputByTurn = _l.liveMainOutputByTurn, turnSession = _l.turnSession, activeToolByTurn = _l.activeToolByTurn, performanceTrace = _l.performanceTrace;
        var sink = getSink();
        var publishStartedAt = performance.now();
        if (options.episodeID && !event.episodeID)
            event = __assign(__assign({}, event), { episodeID: options.episodeID });
        // D6: while a session is active every event belongs to it. Events that
        // already carry a session id keep their own; events published before the
        // session exists are runtime-level and reach every subscriber. The stamp
        // follows the exec the event is published for — a background turn stamps
        // its own session even when the UI is attached to another.
        if ((exec === null || exec === void 0 ? void 0 : exec.session) && event.sessionID === undefined)
            event = __assign(__assign({}, event), { sessionID: exec.session.id });
        if (event.type === "diagnostic")
            event = __assign(__assign({}, event), { at: (_a = event.at) !== null && _a !== void 0 ? _a : new Date().toISOString() });
        if (event.type === "diagnostic") {
            var diagnostic = __assign(__assign({}, event), { at: (_b = event.at) !== null && _b !== void 0 ? _b : new Date().toISOString() });
            var bucketID = (_c = exec === null || exec === void 0 ? void 0 : exec.session.id) !== null && _c !== void 0 ? _c : event.sessionID;
            if (bucketID) {
                var bucket = (_d = runtimeDiagnosticsBySession.get(bucketID)) !== null && _d !== void 0 ? _d : [];
                bucket.push(diagnostic);
                if (bucket.length > 500)
                    bucket.splice(0, 1);
                runtimeDiagnosticsBySession.set(bucketID, bucket);
            }
            else {
                runtimeDiagnostics.push(diagnostic);
                if (runtimeDiagnostics.length > 500)
                    runtimeDiagnostics.splice(0, 1);
            }
        }
        if (!event.agentID && event.type === "content.delta") {
            var current = (_e = liveMainOutputByTurn.get(event.id)) !== null && _e !== void 0 ? _e : "";
            liveMainOutputByTurn.set(event.id, "".concat(current).concat(event.text).slice(-8000));
            if ((exec === null || exec === void 0 ? void 0 : exec.session) && event.text) {
                var pending = (_f = pendingPartialByTurn.get(event.id)) !== null && _f !== void 0 ? _f : {
                    exec: exec,
                    text: "",
                };
                pending.text += event.text;
                pendingPartialByTurn.set(event.id, pending);
                schedulePartialFlush(exec, event.id);
            }
        }
        // The durable partial batches must cover the step's full text before the
        // final `content.done` lands, or replay would render a truncated answer.
        if (!event.agentID && event.type === "content.done")
            flushPartial(event.id);
        // TERM-M.3 (c): a turn that ended as waiting_human persists the typed
        // pending-human state and clears the turn-level marker.
        if (!event.agentID &&
            event.type === "turn.finished" &&
            event.stopReason === "waiting_human") {
            var pending = exec === null || exec === void 0 ? void 0 : exec.endTurnWaitingHuman;
            if (exec)
                exec.endTurnWaitingHuman = undefined;
            turnSession.delete(event.id);
            if (pending && (exec === null || exec === void 0 ? void 0 : exec.session))
                void setPendingHumanTerminal(exec.session.id, pending);
        }
        else if (!event.agentID && event.type === "turn.finished") {
            // Any other settlement discards a stale marker: a request_human call
            // from a turn that later failed must not bleed into the next turn.
            if (exec)
                exec.endTurnWaitingHuman = undefined;
            turnSession.delete(event.id);
        }
        // Goal round driver: classify a finished goal round, then continue an
        // active, armed goal on the next idle edge (human work always outranks it).
        if (!event.agentID && event.type === "turn.finished" && (exec === null || exec === void 0 ? void 0 : exec.session))
            goalRuntime.onTurnFinished(exec, event);
        // TERM-M.3 (c): when the human releases the requested pane, the runtime
        // starts the continuation turn automatically. Replay never passes through
        // publish, so a replayed detach cannot double-resume.
        if (!event.agentID &&
            event.type === "terminal.timeline" &&
            event.actor === "user" &&
            event.action === "detach")
            void maybeContinueAfterHumanInput(event.id, (_g = exec === null || exec === void 0 ? void 0 : exec.session.id) !== null && _g !== void 0 ? _g : event.sessionID);
        if ((exec === null || exec === void 0 ? void 0 : exec.session) &&
            !event.agentID &&
            event.type !== "session.created" &&
            event.type !== "session.ready") {
            var sessionStoreController_1 = ctx.state.serviceDirectory.get(session_store_1.sessionStoreController);
            // SQLite already persists the latest context checkpoint in
            // `context_epochs`. Persisting the full checkpoint again in the event
            // journal duplicates multi-MB snapshots and forces every full-session
            // clone to carry them. Keep the event live for the UI and rely on the
            // epoch row for recovery. JSON stores keep the durable event because
            // they have no epoch table.
            var sqliteContextCheckpoint = event.type === "context.checkpoint" &&
                sessionStoreController_1.status().mode === "sqlite";
            if (sqliteContextCheckpoint) {
                void writeContextEpoch(exec, "boundary");
            }
            if (!sqliteContextCheckpoint &&
                (0, contracts_1.runtimeEventDurability)(event) === "durable") {
                var sessionSeq = exec.nextSessionSeq++;
                (0, contracts_1.markRuntimeEventSessionSeq)(event, sessionSeq);
                (0, substrate_1.feedSessionEventWindow)(exec, sessionSeq, event);
                (0, session_1.appendSessionEvent)(exec.session, event);
                (0, substrate_2.feedSessionFactState)(exec, event);
                scheduleContextEpochWrite(exec, event);
                if ((0, collab_1.isCollabSnapshotRelevantEvent)(event)) {
                    collabSnapshotScheduler.schedule(exec);
                }
                if (!sessionStoreController_1.status().initialized) {
                    return;
                }
                var sessionSnapshot_1 = __assign({}, exec.session);
                var sessionPersistence = ctx.ports.getSessionPersistenceForSession(exec.session.id);
                var next = sessionPersistence
                    .then(function () {
                    if (sessionStoreController_1.status().initialized)
                        return sessionStoreController_1.appendEvent(sessionSnapshot_1, event);
                })
                    .catch(function (error) {
                    sink === null || sink === void 0 ? void 0 : sink({
                        type: "diagnostic",
                        level: "warning",
                        message: "session persistence deferred/failed: ".concat(error instanceof Error ? error.message : String(error)),
                    });
                });
                ctx.ports.setSessionPersistenceForSession(exec.session.id, next);
                setSessionPersistence(Promise.allSettled([getSessionPersistence(), next]).then(function () { return undefined; }));
            }
        }
        var pluginStartedAt = performance.now();
        if (!event.agentID)
            getPluginsController().dispatch(event);
        var pluginMs = performance.now() - pluginStartedAt;
        var sinkStartedAt = performance.now();
        sink === null || sink === void 0 ? void 0 : sink(event);
        var sinkMs = performance.now() - sinkStartedAt;
        performanceTrace.record(event, {
            publishMs: performance.now() - publishStartedAt,
            pluginMs: pluginMs,
            sinkMs: sinkMs,
        });
        // P8 C1 writer: keep the live work-state tracking current and publish a
        // session intelligence snapshot at work-state boundaries. `session.snapshot`
        // is not a trigger, so the snapshot's own publish cannot recurse here.
        if (!event.agentID && event.type === "tool.update") {
            var turnID = toolEventTurnID(event);
            if (event.status === "running")
                activeToolByTurn.set(turnID, event.name);
            else if (["succeeded", "failed", "rejected", "cancelled"].includes(event.status))
                activeToolByTurn.delete(turnID);
        }
        if (!event.agentID && isSessionSnapshotTrigger(event))
            publishSessionSnapshot(exec);
        if (!event.agentID &&
            (event.type === "turn.finished" || event.type === "turn.cancelled")) {
            flushPartial(event.id);
            pendingPartialByTurn.delete(event.id);
            liveMainOutputByTurn.delete(event.id);
        }
        // P8 C3 safe-boundary scheduler: a finished turn is a safe point (§5.2 —
        // "step complete"). Deliver every queued mailbox message so the main agent
        // sees user intents at the boundary, never mid-token. `mailbox.delivered`
        // is not a trigger, so this cannot recurse. Only a turn that finished on
        // purpose is a settlement: a cancelled/aborted/error turn did not complete
        // its context, so its delivered intents stay delivered for another chance.
        if (!event.agentID &&
            event.type === "turn.finished" &&
            (exec === null || exec === void 0 ? void 0 : exec.session) &&
            event.stopReason === "error") {
            // Automatic Navi wake on main-turn errors is intentionally removed:
            // only a model-issued collaboration tool call may wake Navi.
            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("navi-wake-trigger", "automatic wake removed", {
                turnID: event.id,
                reason: (_h = event.reason) !== null && _h !== void 0 ? _h : "unknown",
            });
        }
        if (!event.agentID &&
            event.type === "nia.chat.turn.finished" &&
            event.stopReason === "done" &&
            (exec === null || exec === void 0 ? void 0 : exec.session)) {
            var niaMessages = (0, session_1.projectedNiaChatMessages)(exec.session.events).filter(function (message) { return message.kind === "message"; });
            var last = niaMessages[niaMessages.length - 1];
            var niaAuditWake = exec.session.events.some(function (candidate) {
                return candidate.type === "nia.chat.turn.started" &&
                    candidate.messageID === event.messageID &&
                    candidate.internal === true;
            });
            var auditReported = exec.session.events.some(function (candidate) {
                return candidate.type === "nia.chat.tool.used" &&
                    candidate.messageID === event.messageID &&
                    candidate.toolName === "audit_report";
            });
            var niaCollabSent = exec.session.events.some(function (candidate) {
                return candidate.type === "nia.chat.tool.used" &&
                    candidate.messageID === event.messageID &&
                    candidate.toolName === "collab_chat";
            });
            var auditReportEvent = exec.session.events.find(function (candidate) {
                return candidate.type === "nia.chat.tool.used" &&
                    candidate.messageID === event.messageID &&
                    candidate.toolName === "audit_report";
            });
            var auditSummary = (_j = last === null || last === void 0 ? void 0 : last.text) !== null && _j !== void 0 ? _j : "";
            var auditVerdict = void 0;
            if (auditReportEvent === null || auditReportEvent === void 0 ? void 0 : auditReportEvent.argumentsRaw) {
                try {
                    var args = JSON.parse(auditReportEvent.argumentsRaw);
                    auditVerdict = args.verdict;
                    if (Array.isArray(args.gaps) && args.gaps.length) {
                        auditSummary += "\n\nGap list from audit_report:\n".concat(args.gaps
                            .map(function (gap, index) { return "".concat(index + 1, ". ").concat(gap); })
                            .join("\n"));
                    }
                }
                catch (_m) {
                    // Keep the natural-language fallback if arguments are not JSON.
                }
            }
            var auditPassed = auditVerdict === "passed";
            // Nia's audit wake usually goes through collab_chat or audit_report.
            // Forward when audit_report was used, even for a manually started Nia
            // audit, because that report has already changed the plan lifecycle.
            // Once the plan is passed there is nothing left to remediate, so do not
            // wake Natalia again. Only skip when Nia actively used collab_chat, so
            // the formal audit message is not duplicated.
            var shouldForwardAudit = (niaAuditWake || auditReported) && !auditPassed;
            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("nia-audit-tail", "", {
                messageID: event.messageID,
                niaAuditWake: niaAuditWake,
                auditReported: auditReported,
                auditVerdict: auditVerdict,
                auditPassed: auditPassed,
                niaCollabSent: niaCollabSent,
                shouldForwardAudit: shouldForwardAudit,
                forwarded: Boolean(last && shouldForwardAudit && !niaCollabSent),
                lastText: last === null || last === void 0 ? void 0 : last.text.slice(0, 120),
            });
            if (last && shouldForwardAudit && !niaCollabSent) {
                var wakeID = "turn_nia_".concat(event.messageID.replace(/[^a-zA-Z0-9]/gu, "_"));
                (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("nia-audit-forward", "scheduling main wake from audit tail", {
                    sessionID: exec.session.id,
                    wakeID: wakeID,
                    responseMessageID: event.messageID,
                    auditSummary: auditSummary.slice(0, 180),
                });
                ctx.ports.scheduleInternalWake(exec, {
                    id: wakeID,
                    text: "(internal Nia audit result: ".concat(auditSummary, ". This is internal context for you and the user. Do not forward it to Navi; act on the findings directly.)"),
                    delivery: "next-turn",
                });
            }
            // If Nia did not call audit_report, fall back to known audit phrasing so
            // the plan lifecycle still closes even when the model forgets the tool.
            if (last && niaAuditWake && !auditReported) {
                var auditDone = /全部完成|全部通过|没有缺口|已完成|audit_passed|no gaps|all done/iu.test(last.text);
                var active = (0, collab_2.activePlanForExec)(ctx, exec);
                if (active && active.status !== "completed") {
                    void ctx.ports.planDocRuntime.planDocUpdateStatus({
                        planID: active.planID,
                        status: auditDone ? "completed" : "audit_gaps",
                        sessionID: exec.session.id,
                    });
                }
            }
        }
        if (!event.agentID &&
            event.type === "turn.finished" &&
            event.stopReason === "done") {
            // P8 C3 safe-boundary scheduler: a finished turn is a safe point (§5.2 —
            // "step complete"). Delivery is consumption-driven, not model-discipline-
            // driven: messages delivered at the previous boundary were injected into
            // this turn's context, so a normal turn finish acknowledges them (they no
            // longer re-inject); messages still queued are delivered for the next
            // turn. The order matters — acknowledge the already-delivered batch before
            // delivering the queued batch, so a fresh delivery is not mis-acked.
            settleMailboxAtBoundary(exec);
            // Nia is no longer woken automatically on every finished turn. The old
            // runtime-owned promotion to `awaiting_audit` started an audit round after
            // each Natalia turn even when the model had not asked for one, which made
            // the audit agent double as a "keep going" mechanism. The model now asks
            // for an audit explicitly (collab_chat to Nia) and continuation is owned
            // by the goal loop. The `awaiting_audit` wake itself stays in
            // planDocUpdateStatus for callers that still set that status.
            // WG4: a finished turn is a natural reconcile point — discover external
            // edits the watcher saw, graph them as isolated nodes, and drift-check
            // them against the active plan. No explicit call needed.
            void reconcileWorkspaceObservation(exec).catch(function (error) {
                if (ctx.ports.isDisposed())
                    return;
                var code = error.code;
                if (code === "ENOENT")
                    return;
                publishForSession(exec, {
                    type: "diagnostic",
                    level: "warning",
                    message: "workspace observation reconcile failed: ".concat(error instanceof Error ? error.message : String(error)),
                });
            });
        }
    }
}
