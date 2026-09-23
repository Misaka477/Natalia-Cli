"use strict";
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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionExecution = createSessionExecution;
/**
 * Session execution state — runtime/session-execution/index.ts.
 *
 * `ensureExecution` creates a session's execution state lazily (its record,
 * context ledger and in-flight markers) and the drain/admit/persist/load
 * helpers that drive the turn controller for a session. Reads host state
 * through `RuntimeContext` at call time.
 */
var runtime_1 = require("@natalia/runtime");
var session_1 = require("@anthelia/session");
var session_store_1 = require("@anthelia/session-store");
var turn_orchestration_1 = require("@anthelia/turn-orchestration");
var context_ledger_1 = require("@natalia/context-ledger");
var substrate_1 = require("@anthelia/substrate");
var runtime_services_1 = require("@natalia/runtime-services");
var runtime_2 = require("@natalia/runtime");
var operation_log_1 = require("@natalia/operation-log");
var MAX_IDLE_SESSION_EXECUTIONS = Math.max(64, Number((_a = process.env.NATALIA_MAX_IDLE_SESSIONS) !== null && _a !== void 0 ? _a : 512));
/**
 * Per-session event-count guard. An idle execution that accumulated a very
 * large journal is the main long-session memory holder; it can be re-created
 * lazily on the next attach/read. Busy sessions are never evicted.
 */
var MAX_IDLE_SESSION_EVENTS = Math.max(5000, Number((_b = process.env.NATALIA_MAX_IDLE_SESSION_EVENTS) !== null && _b !== void 0 ? _b : 20000));
/**
 * Total event-count budget across idle executions. The count is an upper
 * bound on object count; it intentionally avoids walking every event just to
 * estimate bytes during a hot prune check.
 */
var MAX_TOTAL_IDLE_EVENT_COUNT = Math.max(MAX_IDLE_SESSION_EVENTS, Number((_c = process.env.NATALIA_MAX_TOTAL_IDLE_EVENTS) !== null && _c !== void 0 ? _c : 60000));
function isIdleExecution(active, exec) {
    return (exec !== active &&
        !exec.activeAbort &&
        !exec.activeTurnID &&
        !exec.paused &&
        !exec.endTurnWaitingHuman);
}
function pruneIdleSessionExecutions(ctx) {
    var executionBySession = ctx.state.executionBySession;
    var active = ctx.ports.getActiveExec();
    var idle = __spreadArray([], executionBySession.entries(), true).filter(function (_a) {
        var exec = _a[1];
        return isIdleExecution(active, exec);
    });
    // First drop any single idle execution that is already over the per-session
    // event guard. This is the common case after attaching to a very old session.
    for (var _i = 0, idle_1 = idle; _i < idle_1.length; _i++) {
        var _a = idle_1[_i], sessionID = _a[0], exec = _a[1];
        if (exec.session.events.length <= MAX_IDLE_SESSION_EVENTS)
            continue;
        executionBySession.delete(sessionID);
        ctx.state.sessionPersistenceBySession.delete(sessionID);
    }
    var remainingIdleEventCount = __spreadArray([], executionBySession.values(), true).filter(function (exec) { return isIdleExecution(active, exec); })
        .reduce(function (sum, exec) { return sum + exec.session.events.length; }, 0);
    if (executionBySession.size <= MAX_IDLE_SESSION_EXECUTIONS &&
        remainingIdleEventCount <= MAX_TOTAL_IDLE_EVENT_COUNT)
        return;
    // Then evict the largest idle executions until both budgets are satisfied.
    var evictionOrder = __spreadArray([], executionBySession.entries(), true).filter(function (_a) {
        var exec = _a[1];
        return isIdleExecution(active, exec);
    })
        .sort(function (left, right) {
        return right[1].session.events.length - left[1].session.events.length;
    });
    var eventCount = remainingIdleEventCount;
    for (var _b = 0, evictionOrder_1 = evictionOrder; _b < evictionOrder_1.length; _b++) {
        var _c = evictionOrder_1[_b], sessionID = _c[0], exec = _c[1];
        if (executionBySession.size <= MAX_IDLE_SESSION_EXECUTIONS &&
            eventCount <= MAX_TOTAL_IDLE_EVENT_COUNT)
            break;
        executionBySession.delete(sessionID);
        ctx.state.sessionPersistenceBySession.delete(sessionID);
        eventCount -= exec.session.events.length;
    }
}
function createSessionExecution(ctx, options) {
    return {
        drainSessionFor: drainSessionFor,
        drainPendingQueue: drainPendingQueue,
        runAdmittedInput: runAdmittedInput,
        persistInboxPromotion: persistInboxPromotion,
        loadSessionForAttach: loadSessionForAttach,
        ensureExecution: ensureExecution,
    };
    function drainSessionFor(sessionID) {
        var _this = this;
        return function (signal) { return __awaiter(_this, void 0, void 0, function () {
            var controller;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ensureExecution(sessionID)];
                    case 1:
                        _a.sent();
                        controller = ctx.state.serviceDirectory.get(turn_orchestration_1.turnController);
                        return [4 /*yield*/, controller.drain(signal, sessionID)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
    }
    function drainPendingQueue(signal) {
        return __awaiter(this, void 0, void 0, function () {
            var controller;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        controller = ctx.state.serviceDirectory.get(turn_orchestration_1.turnController);
                        return [4 /*yield*/, controller.drainQueue(signal, ctx.ports.getSessionID())];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function runAdmittedInput(id_1, text_1) {
        return __awaiter(this, arguments, void 0, function (id, text, attachments, resources, agents) {
            var controller;
            if (attachments === void 0) { attachments = []; }
            if (resources === void 0) { resources = []; }
            if (agents === void 0) { agents = []; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        controller = ctx.state.serviceDirectory.get(turn_orchestration_1.turnController);
                        return [4 /*yield*/, controller.admit(ctx.ports.getSessionID(), id, text, attachments, resources, agents)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function persistInboxPromotion() {
        return __awaiter(this, arguments, void 0, function (targetSessionID) {
            var controller;
            if (targetSessionID === void 0) { targetSessionID = ctx.ports.getSessionID(); }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        controller = ctx.state.serviceDirectory.get(turn_orchestration_1.turnController);
                        return [4 /*yield*/, controller.persistPromotion(targetSessionID)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function loadSessionForAttach(id) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionStore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sessionStore = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                        if (!sessionStore)
                            throw new Error("session store unavailable (natalia-session-store)");
                        return [4 /*yield*/, sessionStore.load(id)];
                    case 1: return [2 /*return*/, (_a.sent()).session];
                }
            });
        });
    }
    /**
     * D2: the execution state for a session — its record, its context ledger and
     * its in-flight turn markers. Created lazily the first time the session runs
     * work (init, attach or a background submission) and kept for the client's
     * life, so a background turn of A survives attaching to B and back.
     */
    function ensureExecution(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var start, mark, _a, getProviderSource, getProvider, getRuntimeContextConfig, getDefaultPermissionMode, getDefaultPermissionProfile, getAgentRegistry, applyAgentProvider, refreshExecutionContextConfig, executionBySession, existing, sessionStore, contextLedgerFactory, fastPathEnabled, durableEventCount, stored, loaded, recovery, epoch, storeMode, execContext, projection, latestContextCheckpoint, checkpointIndex, checkpointHasSummary, restoreEvents, runtimeRestoreEvents, fastPath, sessionDate, exec;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
            return __generator(this, function (_w) {
                switch (_w.label) {
                    case 0:
                        start = performance.now();
                        mark = function (name) {
                            return (0, runtime_services_1.perfLog)("[perf] ensureExecution.".concat(name, " session=").concat(sessionID, " +").concat((performance.now() - start).toFixed(1), "ms"));
                        };
                        (0, runtime_services_1.perfLog)("[perf] ensureExecution start session=".concat(sessionID));
                        _a = ctx.ports, getProviderSource = _a.getProviderSource, getProvider = _a.getProvider, getRuntimeContextConfig = _a.getRuntimeContextConfig, getDefaultPermissionMode = _a.getDefaultPermissionMode, getDefaultPermissionProfile = _a.getDefaultPermissionProfile, getAgentRegistry = _a.getAgentRegistry, applyAgentProvider = _a.applyAgentProvider, refreshExecutionContextConfig = _a.refreshExecutionContextConfig;
                        executionBySession = ctx.state.executionBySession;
                        existing = executionBySession.get(sessionID);
                        if (existing) {
                            // Log cache hits distinctly: logging `ensure.start` before this check made
                            // every hit look like a fresh (expensive) execution rebuild in the trace.
                            (0, runtime_1.memoryTrace)("execution.ensure.hit", { sessionID: sessionID });
                            (0, runtime_services_1.perfLog)("[perf] ensureExecution hit session=".concat(sessionID, " +").concat((performance.now() - start).toFixed(1), "ms"));
                            return [2 /*return*/, existing];
                        }
                        (0, runtime_1.memoryTrace)("execution.ensure.start", { sessionID: sessionID });
                        sessionStore = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                        if (!sessionStore)
                            throw new Error("session store unavailable (natalia-session-store)");
                        contextLedgerFactory = ctx.state.serviceDirectory.get(context_ledger_1.contextLedgerFactory);
                        fastPathEnabled = process.env.NATALIA_FAST_EXECUTION_LOAD === "1";
                        return [4 /*yield*/, sessionStore.eventCount(sessionID)];
                    case 1:
                        durableEventCount = _w.sent();
                        return [4 /*yield*/, sessionStore.load(sessionID, fastPathEnabled
                                ? { indexedRecovery: true, runtimeEvents: true }
                                : { runtimeEvents: true })];
                    case 2:
                        stored = _w.sent();
                        mark("load");
                        loaded = stored.session;
                        recovery = stored.recovery;
                        epoch = stored.contextEpoch;
                        storeMode = sessionStore.status().mode;
                        loaded.events = (0, substrate_1.filterRuntimeRetainedEvents)(loaded.events, storeMode, Boolean(epoch));
                        execContext = contextLedgerFactory.create();
                        mark("createLedger");
                        projection = (0, session_1.projectSession)(loaded);
                        mark("project");
                        latestContextCheckpoint = __spreadArray([], projection.replayableEvents, true).reverse()
                            .find(function (event) { return event.type === "context.checkpoint"; });
                        checkpointIndex = latestContextCheckpoint
                            ? projection.replayableEvents.indexOf(latestContextCheckpoint)
                            : -1;
                        checkpointHasSummary = (latestContextCheckpoint === null || latestContextCheckpoint === void 0 ? void 0 : latestContextCheckpoint.type) === "context.checkpoint" &&
                            latestContextCheckpoint.snapshot.entries.some(function (entry) { return entry.role === "summary"; });
                        if (epoch)
                            execContext.restoreDurableCheckpoint(epoch.snapshot);
                        else if (checkpointHasSummary && latestContextCheckpoint)
                            execContext.restoreDurableCheckpoint(latestContextCheckpoint.snapshot);
                        mark("checkpointRestore");
                        restoreEvents = epoch
                            ? sessionStore.contextEventsAfter(sessionID, epoch)
                            : checkpointHasSummary && latestContextCheckpoint
                                ? projection.replayableEvents.slice(checkpointIndex + 1)
                                : projection.replayableEvents;
                        runtimeRestoreEvents = (0, substrate_1.filterRuntimeRetainedEvents)(restoreEvents, storeMode, Boolean(epoch));
                        contextLedgerFactory.restore(execContext, runtimeRestoreEvents);
                        mark("restore");
                        fastPath = fastPathEnabled && Boolean(epoch);
                        if (fastPath) {
                            projection.replayableEvents = runtimeRestoreEvents;
                            if (recovery) {
                                projection.selectedAgent =
                                    (_b = recovery.selectedAgent) !== null && _b !== void 0 ? _b : projection.selectedAgent;
                                projection.selectedModel =
                                    (_c = recovery.selectedModel) !== null && _c !== void 0 ? _c : projection.selectedModel;
                                projection.reasoningEffort =
                                    (_d = recovery.reasoningEffort) !== null && _d !== void 0 ? _d : projection.reasoningEffort;
                                projection.chatModelProfile =
                                    (_e = recovery.chatModelProfile) !== null && _e !== void 0 ? _e : projection.chatModelProfile;
                                projection.permissionMode =
                                    (_f = recovery.permissionMode) !== null && _f !== void 0 ? _f : projection.permissionMode;
                                projection.permissionProfile =
                                    (_g = recovery.permissionProfile) !== null && _g !== void 0 ? _g : projection.permissionProfile;
                            }
                            loaded.events = runtimeRestoreEvents;
                        }
                        (0, operation_log_1.logOf)(ctx.state.serviceDirectory).warn("context-restore", "ensureExecution", {
                            sessionID: sessionID,
                            replayableEvents: projection.replayableEvents.length,
                            restoreEvents: runtimeRestoreEvents.length,
                            contextEntries: execContext.snapshot().entries.length,
                            hasEpoch: epoch !== undefined,
                            checkpointHasSummary: checkpointHasSummary,
                            fastPath: fastPath,
                        });
                        sessionDate = (0, runtime_2.today)();
                        exec = {
                            session: loaded,
                            context: execContext,
                            // The session's date is snapshotted here, on the one path that builds the
                            // state, so a later session-resume reuses the value its history was
                            // recorded against rather than re-reading the clock.
                            sessionStartedAt: sessionDate,
                            currentDate: sessionDate,
                            attachmentReferences: new Map(projection.replayableEvents.flatMap(function (event) {
                                var _a;
                                return event.type === "turn.submitted" && ((_a = event.attachments) === null || _a === void 0 ? void 0 : _a.length)
                                    ? [["".concat(event.id, ":user"), event.attachments]]
                                    : [];
                            })),
                            toolCalls: new Map(),
                            provider: (_j = (_h = options.provider) !== null && _h !== void 0 ? _h : (getProviderSource() === "environment" ? getProvider() : undefined)) !== null && _j !== void 0 ? _j : (function () {
                                var config = ctx.ports.getTsRuntimeConfig();
                                return (config === null || config === void 0 ? void 0 : config.defaultModel)
                                    ? (0, runtime_1.providerForModel)(config, config.defaultModel)
                                    : undefined;
                            })(),
                            runtimeContextConfig: getRuntimeContextConfig(),
                            permissionMode: (_l = (_k = recovery === null || recovery === void 0 ? void 0 : recovery.permissionMode) !== null && _k !== void 0 ? _k : projection.permissionMode) !== null && _l !== void 0 ? _l : getDefaultPermissionMode(),
                            permissionProfile: getDefaultPermissionProfile(),
                            selectedAgent: projection.selectedAgent
                                ? (_m = getAgentRegistry()) === null || _m === void 0 ? void 0 : _m.select(projection.selectedAgent)
                                : undefined,
                            selectedModel: (_o = recovery === null || recovery === void 0 ? void 0 : recovery.selectedModel) !== null && _o !== void 0 ? _o : projection.selectedModel,
                            reasoningEffort: (_p = recovery === null || recovery === void 0 ? void 0 : recovery.reasoningEffort) !== null && _p !== void 0 ? _p : projection.reasoningEffort,
                            naviChatLedger: new runtime_1.ContextLedger(),
                            niaChatLedger: new runtime_1.ContextLedger(),
                            tokenMeter: new runtime_1.TokenMeter(),
                            naviTokenMeter: new runtime_1.TokenMeter(),
                            niaTokenMeter: new runtime_1.TokenMeter(),
                            naviChatModelProfile: (_r = ((_q = recovery === null || recovery === void 0 ? void 0 : recovery.chatModelProfile) !== null && _q !== void 0 ? _q : projection.chatModelProfile)) === null || _r === void 0 ? void 0 : _r.navi,
                            niaChatModelProfile: (_t = ((_s = recovery === null || recovery === void 0 ? void 0 : recovery.chatModelProfile) !== null && _s !== void 0 ? _s : projection.chatModelProfile)) === null || _t === void 0 ? void 0 : _t.nia,
                            paused: false,
                            pauseWaiters: [],
                            injectedMailboxIDs: new Set(),
                            // `projectSession` already computed every submitted id; reuse its two
                            // sets instead of scanning the journal again.
                            announcedTurnIDs: new Set(__spreadArray(__spreadArray([], projection.activeTurnIDs, true), projection.completedTurnIDs, true)),
                            naviPendingQueue: [],
                            niaPendingQueue: [],
                            naviAbortWakePending: false,
                            niaAbortWakePending: false,
                            eventCount: durableEventCount,
                            nextSessionSeq: durableEventCount + 1,
                            fullEventsLoaded: !fastPath,
                        };
                        executionBySession.set(sessionID, exec);
                        pruneIdleSessionExecutions(ctx);
                        applyAgentProvider(exec);
                        mark("apply");
                        // Prewarm the default latest-100 message page for any session we attach.
                        // This overlaps with full-event background loading and makes the first
                        // session.messages RPC a cache hit when the prewarm finishes first.
                        void sessionStore.prewarmMessagePage(sessionID).catch(function (error) {
                            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).warn("perf", "ensureExecution message-page prewarm failed session=".concat(sessionID, ": ").concat(error instanceof Error ? error.message : String(error)));
                        });
                        // Never eagerly replace the window with the full durable log. A consumer
                        // that genuinely needs the whole journal calls ensureSessionFullEvents(),
                        // which remains the one explicit escape hatch. Keeping the fast path
                        // windowed is what bounds long-session memory.
                        try {
                            sessionStore.ensureMessageIndex(sessionID);
                        }
                        catch (_x) {
                            // Index rebuild is best-effort; the first messages RPC can retry.
                        }
                        (_v = (_u = ctx.ports).scheduleCollabSnapshot) === null || _v === void 0 ? void 0 : _v.call(_u, exec);
                        return [4 /*yield*/, refreshExecutionContextConfig(exec)];
                    case 3:
                        _w.sent();
                        mark("refresh");
                        (0, runtime_services_1.perfLog)("[perf] ensureExecution done session=".concat(sessionID, " events=").concat(exec.session.events.length, " fast=").concat(fastPath, " +").concat((performance.now() - start).toFixed(1), "ms"));
                        (0, runtime_1.memoryTrace)("execution.ensure.done", {
                            sessionID: sessionID,
                            events: exec.session.events.length,
                            eventCount: exec.eventCount,
                            fastPath: fastPath,
                        });
                        return [2 /*return*/, exec];
                }
            });
        });
    }
}
